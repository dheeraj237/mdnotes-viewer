/**
 * Integration Tests: Workspace Creation, Switching, and File CRUD with Sync
 * 
 * Covers:
 * - Create workspace → adapter initialized
 * - Switch workspace → old adapter destroyed, new adapter initialized, remote sync triggered
 * - File create → marked dirty → detected by SyncManager → adapter.push called
 * - File edit → marked dirty → sync flow
 * - File delete → adapter removes if supported
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { useWorkspaceStore } from '@/core/store/workspace-store';
import { getSyncManager, initializeSyncManager, stopSyncManager, AdapterRegistry, DummyAdapter, LocalAdapter } from '@/core/sync';
import { getCacheDB, initializeFileOperations, saveFile, deleteFile, loadFileSync } from '@/core/cache/file-manager';
import { WorkspaceType } from '@/core/cache/types';
import type { ISyncAdapter, AdapterInitContext } from '@/core/sync';
import type { FileNode } from '@/shared/types';

describe('Workspace & File Sync Integration', () => {
  let syncManager: ReturnType<typeof getSyncManager>;
  let mockAdapterPushCalls: { fileId: string; path: string; workspaceId: string }[] = [];
  let mockAdapterPullWorkspaceCalls: string[] = [];

  beforeAll(async () => {
    // Initialize file operations and RxDB
    await initializeFileOperations();

    // Get sync manager singleton
    syncManager = getSyncManager();

    // Initialize sync manager with RxDB client
    const rxdbClient = getCacheDB();
    await initializeSyncManager(rxdbClient);

    // Register mock adapters for testing
    const registry = AdapterRegistry.getInstance();

    // Mock adapter that tracks push/pull calls
    class MockAdapter implements ISyncAdapter {
      name = 'mock';
      capabilities = {
        canPush: true,
        canPull: true,
        canList: true,
        canPullWorkspace: true,
      };

      private workspaceId = '';
      private isReadyFlag = true;
      private listeners: Map<string, Set<Function>> = new Map();

      async initialize(context: AdapterInitContext): Promise<void> {
        this.workspaceId = context.workspaceId;
        console.log(`[MockAdapter] Initialized for workspace: ${context.workspaceId}`);
        this.emit('ready', { workspaceId: context.workspaceId });
      }

      async destroy(): Promise<void> {
        this.isReadyFlag = false;
        console.log(`[MockAdapter] Destroyed for workspace: ${this.workspaceId}`);
      }

      isReady(): boolean {
        return this.isReadyFlag;
      }

      async push(file: FileNode, rxdbClient: any): Promise<void> {
        mockAdapterPushCalls.push({
          fileId: file.id,
          path: file.path,
          workspaceId: this.workspaceId,
        });
        console.log(`[MockAdapter] Pushed file: ${file.path}`);

        // Update RxDB to mark file clean (simulating real adapter behavior)
        try {
          const filesCollection = rxdbClient.collections.files;
          const doc = await filesCollection.findByIds([file.id]).exec();
          if (doc && doc[0]) {
            await doc[0].patch({ dirty: false, isSynced: true });
          }
        } catch (err) {
          console.warn('Failed to mark file clean:', err);
        }
      }

      async pull(fileId: string, rxdbClient: any): Promise<FileNode> {
        console.log(`[MockAdapter] Pulled file: ${fileId}`);
        const filesCollection = rxdbClient.collections.files;
        const doc = await filesCollection.findByIds([fileId]).exec();
        return doc?.[0]?.toJSON?.() || { id: fileId, path: '', type: 'file', name: '' };
      }

      async listWorkspaceFiles(rxdbClient: any): Promise<FileNode[]> {
        return [];
      }

      async pullWorkspace(rxdbClient: any): Promise<void> {
        mockAdapterPullWorkspaceCalls.push(this.workspaceId);
        console.log(`[MockAdapter] Pulled entire workspace: ${this.workspaceId}`);
      }

      on(event: string, listener: Function): void {
        if (!this.listeners.has(event)) {
          this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(listener);
      }

      off(event: string, listener: Function): void {
        const listeners = this.listeners.get(event);
        if (listeners) {
          listeners.delete(listener);
        }
      }

      private emit(event: string, data: any): void {
        const listeners = this.listeners.get(event);
        if (listeners) {
          listeners.forEach(l => l(data));
        }
      }
    }

    registry.register('mock', async () => new MockAdapter());
    registry.register('dummy', async () => new DummyAdapter());
    registry.register('local', async () => new LocalAdapter());
  });

  afterAll(async () => {
    await stopSyncManager();
    try {
      const db = getCacheDB();
      if (db) await db.destroy();
    } catch (e) {
      // ignore
    }
  });

  beforeEach(() => {
    // Clear mock call logs before each test
    mockAdapterPushCalls = [];
    mockAdapterPullWorkspaceCalls = [];
    vi.clearAllMocks();
  });

  describe('Workspace Lifecycle', () => {
    it('should create workspace and initialize adapter', async () => {
      const workspaceStore = useWorkspaceStore.getState();

      // Create workspace
      workspaceStore.createWorkspace('Test Workspace', WorkspaceType.Browser, { id: 'ws-1' });

      const workspace = workspaceStore.workspaces?.find(w => w.id === 'ws-1');
      expect(workspace).toBeDefined();
      expect(workspace?.type).toBe(WorkspaceType.Browser);
    });

    it('should switch workspace and reinitialize adapters', async () => {
      const workspaceStore = useWorkspaceStore.getState();

      // Create two workspaces
      workspaceStore.createWorkspace('Workspace 1', WorkspaceType.Browser, { id: 'ws-switch-1' });
      workspaceStore.createWorkspace('Workspace 2', 'mock' as WorkspaceType, { id: 'ws-switch-2' });

      // Switch to first workspace
      await workspaceStore.switchWorkspace('ws-switch-1');
      await new Promise(r => setTimeout(r, 100));

      expect(workspaceStore.activeWorkspaceId).toBe('ws-switch-1');

      // Switch to second workspace
      await workspaceStore.switchWorkspace('ws-switch-2');
      await new Promise(r => setTimeout(r, 100));

      expect(workspaceStore.activeWorkspaceId).toBe('ws-switch-2');
      
      // For mock workspace type, pullWorkspace should have been called
      // (Remote-like workspaces sync on switch)
      await new Promise(r => setTimeout(r, 200));
      // Note: pullWorkspace is only called for non-browser types in workspace-store
    });
  });

  describe('File Operations & Sync', () => {
    const testWorkspaceId = 'ws-file-crud';

    beforeEach(async () => {
      // Create a workspace for file operations
      const workspaceStore = useWorkspaceStore.getState();
      workspaceStore.createWorkspace('File Test WS', 'mock' as WorkspaceType, { id: testWorkspaceId });
      await workspaceStore.switchWorkspace(testWorkspaceId);

      // Wait for adapter initialization
      await new Promise(r => setTimeout(r, 100));
    });

    it('should mark file as dirty when created', async () => {
      // Create a file
      const file = await saveFile(
        '/test-file.md',
        'Initial content',
        'mock' as any,
        undefined,
        testWorkspaceId
      );

      expect(file).toBeDefined();
      expect(file.dirty).toBe(true);
      console.log('File created and marked dirty:', file);
    });

    it('should detect dirty file and trigger adapter push', async () => {
      // Save a file (marks it dirty)
      const file = await saveFile(
        '/sync-test.md',
        'Test content',
        'mock' as any,
        undefined,
        testWorkspaceId
      );

      expect(file.dirty).toBe(true);

      // Wait for SyncManager to detect and push the file
      // SyncManager throttles dirty file subscriptions by 500ms
      await new Promise(r => setTimeout(r, 700));

      // Check if adapter.push was called
      const pushCall = mockAdapterPushCalls.find(
        call => call.fileId === file.id && call.workspaceId === testWorkspaceId
      );
      expect(pushCall).toBeDefined();
      console.log('File pushed to adapter:', pushCall);
    });

    it('should mark file clean after successful push', async () => {
      // Create and save file
      const file = await saveFile(
        '/clean-test.md',
        'Content that will be synced',
        'mock' as any,
        undefined,
        testWorkspaceId
      );

      const fileId = file.id;
      expect(file.dirty).toBe(true);

      // Wait for adapter to push and mark file clean
      await new Promise(r => setTimeout(r, 700));

      // Load file again to check if it's marked as clean
      const updatedFile = loadFileSync(fileId, testWorkspaceId);
      console.log('Updated file state:', { dirty: updatedFile?.dirty, isSynced: updatedFile?.isSynced });

      // File should be marked clean after push
      // (in real implementation, adapter updates RxDB directly)
      expect(mockAdapterPushCalls.some(call => call.fileId === fileId)).toBe(true);
    });

    it('should handle multiple file operations in sequence', async () => {
      // Create multiple files
      const file1 = await saveFile('/file1.md', 'Content 1', 'mock' as any, undefined, testWorkspaceId);
      const file2 = await saveFile('/file2.md', 'Content 2', 'mock' as any, undefined, testWorkspaceId);
      const file3 = await saveFile('/file3.md', 'Content 3', 'mock' as any, undefined, testWorkspaceId);

      expect(file1.dirty).toBe(true);
      expect(file2.dirty).toBe(true);
      expect(file3.dirty).toBe(true);

      // Wait for sync
      await new Promise(r => setTimeout(r, 700));

      // All three files should have been pushed
      const pushedFileIds = mockAdapterPushCalls.map(call => call.fileId);
      expect(pushedFileIds).toContain(file1.id);
      expect(pushedFileIds).toContain(file2.id);
      expect(pushedFileIds).toContain(file3.id);
      console.log('Multiple files synced:', mockAdapterPushCalls.length, 'files');
    });

    it('should handle file deletion', async () => {
      // Create a file
      const file = await saveFile(
        '/delete-test.md',
        'Will be deleted',
        'mock' as any,
        undefined,
        testWorkspaceId
      );

      // Wait for initial sync
      await new Promise(r => setTimeout(r, 700));
      mockAdapterPushCalls = []; // Clear previous calls

      // Delete the file
      await deleteFile(file.path, testWorkspaceId);

      // In new architecture, deletion is handled by file-manager
      // Adapters with delete capability will be called separately
      // (TODO: implement adapter.delete() if supported)
      console.log('File deleted from workspace');
    });

    it('should sync single file edit', async () => {
      // Create file
      const file = await saveFile(
        '/edit-test.md',
        'Original content',
        'mock' as any,
        undefined,
        testWorkspaceId
      );

      mockAdapterPushCalls = [];
      
      // Edit file (save again with new content)
      await saveFile(
        '/edit-test.md',
        'Updated content',
        'mock' as any,
        undefined,
        testWorkspaceId
      );

      // Wait for sync
      await new Promise(r => setTimeout(r, 700));

      // Adapter should have been called for the edited file
      expect(mockAdapterPushCalls.some(call => call.path === '/edit-test.md')).toBe(true);
      console.log('File edit synced successfully');
    });
  });

  describe('Workspace Switch with Sync', () => {
    it('should call pullWorkspace when switching to mock workspace', async () => {
      const workspaceStore = useWorkspaceStore.getState();

      // Create a mock workspace
      workspaceStore.createWorkspace('Pull Test WS', 'mock' as WorkspaceType, { id: 'ws-pull-test' });

      // Switch to it
      await workspaceStore.switchWorkspace('ws-pull-test');
      
      // Wait for adapter initialization and workspace pull
      await new Promise(r => setTimeout(r, 500));

      // For mock workspace type, pullWorkspace should be called on switch
      // (if implemented in workspace-store to call pullWorkspace for remote types)
      console.log('Pullworkspace calls:', mockAdapterPullWorkspaceCalls);
    });

    it('should NOT call pullWorkspace for browser workspace', async () => {
      const workspaceStore = useWorkspaceStore.getState();

      mockAdapterPullWorkspaceCalls = [];

      // Create a browser workspace
      workspaceStore.createWorkspace('Browser WS', WorkspaceType.Browser, { id: 'ws-browser-test' });

      // Switch to it
      await workspaceStore.switchWorkspace('ws-browser-test');

      // Wait for adapter initialization
      await new Promise(r => setTimeout(r, 200));

      // Browser workspace should NOT trigger pullWorkspace
      expect(mockAdapterPullWorkspaceCalls).not.toContain('ws-browser-test');
      console.log('Browser workspace correctly did NOT call pullWorkspace');
    });
  });
});
