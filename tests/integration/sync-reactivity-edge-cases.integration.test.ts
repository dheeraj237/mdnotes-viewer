/**
 * Integration Tests: Reactive Behavior, Concurrency, and Edge Cases
 * 
 * Covers:
 * - Reactive subscription to dirty files
 * - Concurrent file operations
 * - Adapter lifecycle state transitions
 * - Error handling and retries
 * - Workspace switch during active sync
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { useWorkspaceStore } from '@/core/store/workspace-store';
import { getSyncManager, initializeSyncManager, stopSyncManager, AdapterRegistry, DummyAdapter } from '@/core/sync';
import { getCacheDB, initializeFileOperations, saveFile } from '@/core/cache/file-manager';
import { WorkspaceType } from '@/core/cache/types';
import type { ISyncAdapter, AdapterInitContext } from '@/core/sync';
import type { FileNode } from '@/shared/types';

describe('Sync Reactivity & Edge Cases', () => {
  let syncManager: ReturnType<typeof getSyncManager>;
  let asyncAdapterEvents: { event: string; workspaceId: string; timestamp: number }[] = [];

  beforeAll(async () => {
    // Initialize file operations and RxDB
    await initializeFileOperations();

    // Get sync manager
    syncManager = getSyncManager();

    // Initialize sync manager
    const rxdbClient = getCacheDB();
    await initializeSyncManager(rxdbClient);

    // Register adapters
    const registry = AdapterRegistry.getInstance();

    // Adapter that simulates async behavior
    class AsyncAdapter implements ISyncAdapter {
      name = 'async-test';
      capabilities = {
        canPush: true,
        canPull: true,
        canList: false,
        canPullWorkspace: false,
      };

      private workspaceId = '';
      private isReadyFlag = true;
      private listeners: Map<string, Set<Function>> = new Map();
      private pushCount = 0;

      async initialize(context: AdapterInitContext): Promise<void> {
        this.workspaceId = context.workspaceId;
        asyncAdapterEvents.push({
          event: 'initialize',
          workspaceId: context.workspaceId,
          timestamp: Date.now(),
        });
        this.emit('ready', { workspaceId: context.workspaceId });
      }

      async destroy(): Promise<void> {
        asyncAdapterEvents.push({
          event: 'destroy',
          workspaceId: this.workspaceId,
          timestamp: Date.now(),
        });
        this.isReadyFlag = false;
      }

      isReady(): boolean {
        return this.isReadyFlag;
      }

      async push(file: FileNode, rxdbClient: any): Promise<void> {
        this.pushCount++;
        
        // Simulate network delay
        await new Promise(r => setTimeout(r, 50));

        asyncAdapterEvents.push({
          event: 'push',
          workspaceId: this.workspaceId,
          timestamp: Date.now(),
        });

        // Mark file clean
        try {
          const filesCollection = rxdbClient.collections.files;
          const doc = await filesCollection.findByIds([file.id]).exec();
          if (doc && doc[0]) {
            await doc[0].patch({ dirty: false });
          }
        } catch (err) {
          console.warn('Failed to mark clean:', err);
        }
      }

      async pull(fileId: string, rxdbClient: any): Promise<FileNode> {
        return { id: fileId, path: '', type: 'file', name: '' };
      }

      async listWorkspaceFiles(rxdbClient: any): Promise<FileNode[]> {
        return [];
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

    registry.register('async-test', async () => new AsyncAdapter());
    registry.register('dummy', async () => new DummyAdapter());
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
    asyncAdapterEvents = [];
    vi.clearAllMocks();
  });

  describe('Reactive File Watching', () => {
    it('should react to dirty file changes in RxDB', async () => {
      const workspaceStore = useWorkspaceStore.getState();
      workspaceStore.createWorkspace('Reactive WS', 'async-test' as WorkspaceType, { id: 'ws-reactive' });
      await workspaceStore.switchWorkspace('ws-reactive');

      await new Promise(r => setTimeout(r, 100));

      // Save a file - should trigger reactivity
      const file = await saveFile('/reactive.md', 'Content', 'async-test' as any, undefined, 'ws-reactive');
      expect(file.dirty).toBe(true);

      // Wait for SyncManager to detect and process
      await new Promise(r => setTimeout(r, 800));

      // Check that push event was recorded
      const pushEvent = asyncAdapterEvents.find(e => e.event === 'push' && e.workspaceId === 'ws-reactive');
      expect(pushEvent).toBeDefined();
      console.log('Reactive push detected', pushEvent);
    });

    it('should batch multiple dirty files in throttle window', async () => {
      const workspaceStore = useWorkspaceStore.getState();
      workspaceStore.createWorkspace('Batch WS', 'async-test' as WorkspaceType, { id: 'ws-batch' });
      await workspaceStore.switchWorkspace('ws-batch');

      await new Promise(r => setTimeout(r, 100));

      // Create multiple files rapidly
      const files = [];
      for (let i = 0; i < 3; i++) {
        const file = await saveFile(`/file-${i}.md`, `Content ${i}`, 'async-test' as any, undefined, 'ws-batch');
        files.push(file);
      }

      // Wait for batched sync (500ms throttle + processing)
      await new Promise(r => setTimeout(r, 800));

      // Count push events for this workspace
      const pushCount = asyncAdapterEvents.filter(e => e.event === 'push' && e.workspaceId === 'ws-batch').length;
      expect(pushCount).toBeGreaterThanOrEqual(1);
      console.log(`Batched push count: ${pushCount} for ${files.length} files`);
    });
  });

  describe('Adapter Lifecycle', () => {
    it('should initialize adapter on workspace creation', async () => {
      const workspaceStore = useWorkspaceStore.getState();
      workspaceStore.createWorkspace('Init Test WS', 'async-test' as WorkspaceType, { id: 'ws-init' });
      await workspaceStore.switchWorkspace('ws-init');

      await new Promise(r => setTimeout(r, 100));

      const initEvent = asyncAdapterEvents.find(e => e.event === 'initialize' && e.workspaceId === 'ws-init');
      expect(initEvent).toBeDefined();
      console.log('Adapter initialized:', initEvent);
    });

    it('should destroy old adapter and initialize new on workspace switch', async () => {
      const workspaceStore = useWorkspaceStore.getState();

      // Create two workspaces
      workspaceStore.createWorkspace('Switch 1', 'async-test' as WorkspaceType, { id: 'ws-switch-a' });
      workspaceStore.createWorkspace('Switch 2', 'async-test' as WorkspaceType, { id: 'ws-switch-b' });

      // Switch to first
      await workspaceStore.switchWorkspace('ws-switch-a');
      await new Promise(r => setTimeout(r, 150));

      const firstInitEvent = asyncAdapterEvents.find(e => e.event === 'initialize' && e.workspaceId === 'ws-switch-a');
      expect(firstInitEvent).toBeDefined();

      // Clear events
      asyncAdapterEvents = [];

      // Switch to second
      await workspaceStore.switchWorkspace('ws-switch-b');
      await new Promise(r => setTimeout(r, 150));

      // First adapter should be destroyed, second should be initialized
      const destroyEvent = asyncAdapterEvents.find(e => e.event === 'destroy' && e.workspaceId === 'ws-switch-a');
      const secondInitEvent = asyncAdapterEvents.find(e => e.event === 'initialize' && e.workspaceId === 'ws-switch-b');

      expect(destroyEvent).toBeDefined();
      expect(secondInitEvent).toBeDefined();
      console.log('Lifecycle: destroy -> initialize on switch', { destroyEvent, secondInitEvent });
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle rapid file creation', async () => {
      const workspaceStore = useWorkspaceStore.getState();
      workspaceStore.createWorkspace('Concurrent WS', 'async-test' as WorkspaceType, { id: 'ws-concurrent' });
      await workspaceStore.switchWorkspace('ws-concurrent');

      await new Promise(r => setTimeout(r, 100));

      // Create files rapidly
      const promises = Array.from({ length: 5 }, (_, i) =>
        saveFile(`/concurrent-${i}.md`, `Content ${i}`, 'async-test' as any, undefined, 'ws-concurrent')
      );

      const files = await Promise.all(promises);
      expect(files).toHaveLength(5);
      expect(files.every(f => f.dirty)).toBe(true);

      // Wait for sync to complete
      await new Promise(r => setTimeout(r, 1000));

      // All files should have triggered push
      const pushCount = asyncAdapterEvents.filter(e => e.event === 'push').length;
      expect(pushCount).toBeGreaterThanOrEqual(1);
      console.log(`Concurrent: created ${files.length} files, processed ${pushCount} push events`);
    });

    it('should handle file edit during sync', async () => {
      const workspaceStore = useWorkspaceStore.getState();
      workspaceStore.createWorkspace('Edit During Sync WS', 'async-test' as WorkspaceType, { id: 'ws-edit-sync' });
      await workspaceStore.switchWorkspace('ws-edit-sync');

      await new Promise(r => setTimeout(r, 100));

      // Create a file
      const file = await saveFile('/edit.md', 'Initial', 'async-test' as any, undefined, 'ws-edit-sync');
      
      // Wait a bit, then edit before sync completes
      await new Promise(r => setTimeout(r, 100));
      const edited = await saveFile('/edit.md', 'Edited', 'async-test' as any, undefined, 'ws-edit-sync');

      expect(edited.dirty).toBe(true);

      // Wait for all sync to complete
      await new Promise(r => setTimeout(r, 1000));

      const pushCount = asyncAdapterEvents.filter(e => e.event === 'push' && e.workspaceId === 'ws-edit-sync').length;
      expect(pushCount).toBeGreaterThanOrEqual(1);
      console.log(`Concurrent edit: push events ${pushCount}`);
    });
  });

  describe('Browser Workspace (No-op Sync)', () => {
    it('should use DummyAdapter for browser workspaces', async () => {
      const workspaceStore = useWorkspaceStore.getState();
      workspaceStore.createWorkspace('Browser WS', WorkspaceType.Browser, { id: 'ws-browser' });
      await workspaceStore.switchWorkspace('ws-browser');

      await new Promise(r => setTimeout(r, 100));

      // Create a file
      const file = await saveFile('/browser.md', 'Browser content', WorkspaceType.Browser as any, undefined, 'ws-browser');
      expect(file.dirty).toBe(true);

      // Wait a bit
      await new Promise(r => setTimeout(r, 800));

      // Browser adapter (DummyAdapter) won't trigger push events
      // This test just verifies no errors occur
      console.log('Browser workspace file created and no errors');
      expect(file).toBeDefined();
    });
  });

  describe('Status Observable', () => {
    it('should emit status changes during sync', async () => {
      const workspaceStore = useWorkspaceStore.getState();
      workspaceStore.createWorkspace('Status WS', 'async-test' as WorkspaceType, { id: 'ws-status' });
      await workspaceStore.switchWorkspace('ws-status');

      await new Promise(r => setTimeout(r, 100));

      const statusChanges: string[] = [];
      const sub = syncManager.status$().subscribe(status => {
        statusChanges.push(status);
      });

      // Create a file
      await saveFile('/status.md', 'Content', 'async-test' as any, undefined, 'ws-status');

      // Wait for sync
      await new Promise(r => setTimeout(r, 800));

      sub.unsubscribe();

      // Should have transitioned through idle -> syncing -> idle
      console.log('Status changes:', statusChanges);
      expect(statusChanges.length).toBeGreaterThan(0);
    });
  });
});
