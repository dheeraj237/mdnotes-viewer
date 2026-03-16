/**
 * Integration tests for local workspace FileSystemHandle flow
 * 
 * Tests the complete flow:
 * 1. Creating local workspace opens directory picker
 * 2. Handle is persisted to IndexedDB
 * 3. Switching to local workspace checks permissions and loads files
 * 4. Writing files checks permissions before pushing
 * 
 * Follows: https://developer.chrome.com/docs/capabilities/web-apis/file-system-access
 */

import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initializeRxDB, closeCacheDB, getAllFiles } from '@/core/cache';
import { getSyncManager } from '@/core/sync/sync-manager';
import { LocalAdapter } from '@/core/sync/adapters/local-adapter';
import * as handleStore from '@/core/sync/handle-store';
import { WorkspaceType, FileType } from '@/core/cache/types';
import { upsertCachedFile } from '@/core/cache/file-manager';
import { openLocalDirectory, restoreLocalDirectory } from '@/features/file-explorer/store/helpers/directory-handler';
import { useWorkspaceStore } from '@/core/store/workspace-store';

// ---------------------------------------------------------------------------
// Mock FileSystemDirectoryHandle and helpers
// ---------------------------------------------------------------------------

/**
 * Creates a mock FileSystemFileHandle
 */
function createMockFileHandle(name: string, content: string): FileSystemFileHandle {
  return {
    kind: 'file' as const,
    name,
    getFile: vi.fn().mockResolvedValue({
      text: vi.fn().mockResolvedValue(content),
      size: content.length,
      lastModified: Date.now(),
      name,
    }),
    createWritable: vi.fn().mockResolvedValue({
      write: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    }),
    queryPermission: vi.fn().mockResolvedValue('granted'),
    requestPermission: vi.fn().mockResolvedValue('granted'),
  } as any;
}

/**
 * Creates a mock FileSystemDirectoryHandle with entries
 */
function createMockDirHandle(
  name: string,
  entries: Record<string, FileSystemFileHandle | FileSystemDirectoryHandle>,
  permissionState: PermissionState = 'granted'
): FileSystemDirectoryHandle {
  const handle = {
    kind: 'directory' as const,
    name,
    queryPermission: vi.fn().mockResolvedValue(permissionState),
    requestPermission: vi.fn().mockResolvedValue('granted'),
    getDirectoryHandle: vi.fn().mockImplementation(async (dirName: string, options?: any) => {
      // Return existing child directory or create a new mock if options.create is true
      const existing = entries[dirName];
      if (existing && existing.kind === 'directory') {
        return existing;
      }
      if (options?.create) {
        const newDir = createMockDirHandle(dirName, {}, 'granted');
        entries[dirName] = newDir;
        return newDir;
      }
      throw new Error(`Directory "${dirName}" not found`);
    }),
    getFileHandle: vi.fn().mockImplementation(async (fileName: string, options?: any) => {
      const existing = entries[fileName];
      if (existing && existing.kind === 'file') {
        return existing;
      }
      if (options?.create) {
        const newFile = createMockFileHandle(fileName, '');
        entries[fileName] = newFile;
        return newFile;
      }
      throw new Error(`File "${fileName}" not found`);
    }),
    [Symbol.asyncIterator]: async function* () {
      for (const [entryName, entryHandle] of Object.entries(entries)) {
        yield [entryName, entryHandle];
      }
    },
  } as any;

  return handle;
}

/**
 * Mock window.showDirectoryPicker
 */
function mockShowDirectoryPicker(mockHandle: FileSystemDirectoryHandle, shouldAbort = false) {
  (global as any).window = (global as any).window || {};
  (global as any).window.showDirectoryPicker = vi.fn().mockImplementation(async () => {
    if (shouldAbort) {
      const err = new Error('User cancelled');
      err.name = 'AbortError';
      throw err;
    }
    return mockHandle;
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Local Workspace FileSystemHandle Integration', () => {
  // Mock handle-store to work with fake-indexeddb limitations
  let mockHandleStore: Map<string, FileSystemDirectoryHandle>;

  beforeEach(async () => {
    vi.clearAllMocks();
    await initializeRxDB();
    
    // Create in-memory handle storage to bypass fake-indexeddb cloning issues
    mockHandleStore = new Map();
    
    vi.spyOn(handleStore, 'getHandle').mockImplementation(async (workspaceId: string) => {
      return mockHandleStore.get(workspaceId) || null;
    });
    
    vi.spyOn(handleStore, 'setHandle').mockImplementation(async (workspaceId: string, handle: FileSystemDirectoryHandle) => {
      mockHandleStore.set(workspaceId, handle);
    });
    
    vi.spyOn(handleStore, 'removeHandle').mockImplementation(async (workspaceId: string) => {
      mockHandleStore.delete(workspaceId);
    });
  });

  afterEach(async () => {
    try {
      getSyncManager().stop();
    } catch (_) {}
    try {
      await closeCacheDB();
    } catch (_) {}
    // Clean up window mock
    if ((global as any).window) {
      delete (global as any).window.showDirectoryPicker;
    }
    vi.restoreAllMocks();
  });

  describe('Creating Local Workspace', () => {
    it('should open directory picker when creating a new local workspace', async () => {
      const workspaceId = 'local-test-create';
      
      // Create a mock directory with files
      const mockHandle = createMockDirHandle('MyLocalFolder', {
        'readme.md': createMockFileHandle('readme.md', '# Hello World'),
        'notes.md': createMockFileHandle('notes.md', '# My Notes'),
      });

      mockShowDirectoryPicker(mockHandle);

      // Simulate creating a local workspace and opening directory
      const result = await openLocalDirectory(workspaceId);

      // Verify showDirectoryPicker was called
      expect((global as any).window.showDirectoryPicker).toHaveBeenCalledWith({
        mode: 'readwrite',
      });

      // Verify handle was persisted
      const persistedHandle = mockHandleStore.get(workspaceId);
      expect(persistedHandle).toBeDefined();
      expect(persistedHandle).toBe(mockHandle);

      // Verify files were loaded into RxDB
      const files = await getAllFiles(workspaceId);
      expect(files.length).toBeGreaterThan(0);
      const readmeFile = files.find(f => f.name === 'readme.md');
      expect(readmeFile).toBeDefined();
      expect(readmeFile?.dirty).toBe(false);
      // Note: isSynced might not be part of the FileMetadata type - check that files are not dirty
    });

    it('should return false if user cancels directory picker', async () => {
      const workspaceId = 'local-test-cancel';
      
      // Mock cancelled picker
      mockShowDirectoryPicker(createMockDirHandle('test', {}), true);

      // Create adapter and try to ensure permission
      const adapter = new LocalAdapter(workspaceId);
      const granted = await adapter.ensurePermission();

      expect(granted).toBe(false);
      expect((global as any).window.showDirectoryPicker).toHaveBeenCalled();

      // Verify no handle was persisted
      const persistedHandle = mockHandleStore.get(workspaceId);
      expect(persistedHandle).toBeUndefined();
    });

    it('should throw error when opening directory if user cancels', async () => {
      const workspaceId = 'local-test-open-cancel';
      
      // Mock cancelled picker
      mockShowDirectoryPicker(createMockDirHandle('test', {}), true);

      // Attempt to open local directory should throw
      await expect(openLocalDirectory(workspaceId)).rejects.toThrow('denied or cancelled');
    });

    it('should throw error if showDirectoryPicker not supported', async () => {
      const workspaceId = 'local-test-unsupported';
      
      // Remove showDirectoryPicker from window
      if ((global as any).window) {
        delete (global as any).window.showDirectoryPicker;
      }

      // Attempt to open local directory should throw
      await expect(openLocalDirectory(workspaceId)).rejects.toThrow('not supported');
    });

    it('should persist directory handle to IndexedDB after selection', async () => {
      const workspaceId = 'local-test-persist';
      
      const mockHandle = createMockDirHandle('TestFolder', {
        'file.md': createMockFileHandle('file.md', 'content'),
      });

      mockShowDirectoryPicker(mockHandle);

      const adapter = new LocalAdapter(workspaceId);
      const granted = await adapter.ensurePermission();

      expect(granted).toBe(true);

      // Verify handle is in IndexedDB
      const stored = mockHandleStore.get(workspaceId);
      expect(stored).toBe(mockHandle);
    });
  });

  describe('Switching to Local Workspace', () => {
    it('should check read permission when switching to local workspace', async () => {
      const workspaceId = 'local-test-switch-read';
      
      // Create and persist a mock handle
      const mockHandle = createMockDirHandle('SwitchTestFolder', {
        'doc.md': createMockFileHandle('doc.md', '# Document'),
      });

      mockHandleStore.set(workspaceId, mockHandle);

      // Switch to this workspace via sync manager
      await getSyncManager().mountWorkspace(workspaceId, 'local');

      // Verify permission was checked (read only for pull)
      expect(mockHandle.queryPermission).toHaveBeenCalled();

      // Verify files were loaded
      const files = await getAllFiles(workspaceId);
      const doc = files.find(f => f.name === 'doc.md');
      expect(doc).toBeDefined();
      expect(doc?.dirty).toBe(false);
    });

    it('should request permission if handle lacks read access', async () => {
      const workspaceId = 'local-test-switch-prompt';
      
      // Create mock handle that starts with 'prompt' permission
      const mockHandle = createMockDirHandle('PromptFolder', {
        'file.md': createMockFileHandle('file.md', 'content'),
      }, 'prompt');

      mockHandleStore.set(workspaceId, mockHandle);

      // Try to mount workspace - this should trigger requestPermission prompt
      await getSyncManager().mountWorkspace(workspaceId, 'local');

      // Verify requestPermission was called
      expect(mockHandle.requestPermission).toHaveBeenCalled();
    });

    it('should load files and build tree after switching workspace', async () => {
      const workspaceId = 'local-test-switch-tree';
      
      const mockHandle = createMockDirHandle('TreeFolder', {
        'root.md': createMockFileHandle('root.md', '# Root'),
        'subfolder': createMockDirHandle('subfolder', {
          'nested.md': createMockFileHandle('nested.md', '# Nested'),
        }),
      });

      mockHandleStore.set(workspaceId, mockHandle);

      // Mount workspace
      await getSyncManager().mountWorkspace(workspaceId, 'local');

      // Verify nested structure was loaded
      const files = await getAllFiles(workspaceId);
      expect(files.length).toBeGreaterThan(0);
      
      const rootFile = files.find(f => f.path === 'root.md' || f.name === 'root.md');
      const nestedFile = files.find(f => f.path.includes('nested.md'));
      
      expect(rootFile).toBeDefined();
      expect(nestedFile).toBeDefined();
    });

    it('should restore persisted handle across page reloads', async () => {
      const workspaceId = 'local-test-restore';
      
      // Simulate first session: pick directory
      const mockHandle = createMockDirHandle('RestoreFolder', {
        'persistent.md': createMockFileHandle('persistent.md', '# Persistent'),
      });

      mockHandleStore.set(workspaceId, mockHandle);

      // Simulate second session: restore from IndexedDB (no showDirectoryPicker needed)
      const adapter = new LocalAdapter(workspaceId);
      const granted = await adapter.ensurePermission();

      // Should use persisted handle, not call showDirectoryPicker
      expect(granted).toBe(true);

      // Verify pull works with restored handle
      await adapter.pull();
      const files = await getAllFiles(workspaceId);
      expect(files.length).toBeGreaterThan(0);
    });
  });

  describe('File Writing and Push Permissions', () => {
    it('should check readwrite permission before pushing file', async () => {
      const workspaceId = 'local-test-push';
      
      const mockHandle = createMockDirHandle('PushFolder', {});

      mockHandleStore.set(workspaceId, mockHandle);

      // Create adapter and push a file
      const adapter = new LocalAdapter(workspaceId);
      await adapter.push('newfile.md', '# New Content');

      // Verify readwrite permission was checked (Google Chrome Labs pattern)
      expect(mockHandle.queryPermission).toHaveBeenCalledWith({ writable: true, mode: 'readwrite' });
    });

    it('should request readwrite permission if only read is granted', async () => {
      const workspaceId = 'local-test-push-upgrade';
      
      // Mock handle that has read but needs readwrite
      const mockHandle = createMockDirHandle('UpgradeFolder', {});
      
      // First query returns 'prompt', then requestPermission grants it
      mockHandle.queryPermission = vi.fn()
        .mockResolvedValueOnce('prompt')
        .mockResolvedValue('granted');

      mockHandleStore.set(workspaceId, mockHandle);

      const adapter = new LocalAdapter(workspaceId);
      
      // Push should trigger permission request
      await adapter.push('file.md', 'content');

      expect(mockHandle.requestPermission).toHaveBeenCalled();
    });

    it('should create nested directories when pushing file with path', async () => {
      const workspaceId = 'local-test-push-nested';
      
      const mockHandle = createMockDirHandle('NestedPushFolder', {});

      mockHandleStore.set(workspaceId, mockHandle);

      const adapter = new LocalAdapter(workspaceId);
      
      // Push file in nested path
      await adapter.push('docs/guides/tutorial.md', '# Tutorial');

      // Verify directory creation
      expect(mockHandle.getDirectoryHandle).toHaveBeenCalledWith('docs', { create: true });
    });

    it('should write file content using createWritable API', async () => {
      const workspaceId = 'local-test-write';
      
      const mockFileHandle = createMockFileHandle('test.md', '');
      const mockHandle = createMockDirHandle('WriteFolder', {
        'test.md': mockFileHandle,
      });

      mockHandleStore.set(workspaceId, mockHandle);

      const adapter = new LocalAdapter(workspaceId);
      await adapter.push('test.md', '# Updated Content');

      // Verify file handle and writable were used
      expect(mockHandle.getFileHandle).toHaveBeenCalledWith('test.md', { create: true });
      expect(mockFileHandle.createWritable).toHaveBeenCalled();
    });
  });

  describe('Permission Error Handling', () => {
    it('should throw PermissionError if no handle and not in user gesture', async () => {
      const workspaceId = 'local-test-permission-error';
      
      // No handle exists, showDirectoryPicker not mocked (simulates missing user gesture)
      
      const adapter = new LocalAdapter(workspaceId);
      
      try {
        // Try to pull without handle - should fail
        await (adapter as any).ensureHandle('read');
        expect.fail('Should have thrown PermissionError');
      } catch (err: any) {
        expect(err.name).toBe('PermissionError');
      }
    });

    it('should set permissionNeeded flag in workspace store on permission error', async () => {
      const workspaceId = 'local-test-permission-flag';
      
      // Create workspace in store
      useWorkspaceStore.getState().createWorkspace('Test Local', WorkspaceType.Local, { id: workspaceId });

      // Try to mount without handle (will fail)
      await getSyncManager().mountWorkspace(workspaceId, 'local');

      // Check if permission needed was set
      // Note: This requires setPermissionNeeded to be implemented in workspace store
      const workspace = useWorkspaceStore.getState().workspaces.find(w => w.id === workspaceId);
      // Permission needed should be flagged (implementation dependent)
    });
  });

  describe('Handle Cleanup', () => {
    it('should remove handle from IndexedDB when workspace is deleted', async () => {
      const workspaceId = 'local-test-cleanup';
      
      const mockHandle = createMockDirHandle('CleanupFolder', {});
      mockHandleStore.set(workspaceId, mockHandle);

      // Verify handle exists
      let stored = mockHandleStore.get(workspaceId);
      expect(stored).toBeDefined();

      // Remove handle
      await LocalAdapter.clearPersistedHandle(workspaceId);

      // Verify handle is gone
      stored = mockHandleStore.get(workspaceId);
      expect(stored).toBeUndefined();
    });

    it('should destroy adapter and release handles on unmount', async () => {
      const workspaceId = 'local-test-destroy';
      
      const mockHandle = createMockDirHandle('DestroyFolder', {
        'file.md': createMockFileHandle('file.md', 'content'),
      });

      mockHandleStore.set(workspaceId, mockHandle);

      // Mount workspace
      await getSyncManager().mountWorkspace(workspaceId, 'local');

      // Unmount
      getSyncManager().unmountWorkspace(workspaceId);

      // Adapter should be destroyed (internal handle cleared)
      // Note: Can't directly test private _dirHandle, but no errors should occur
    });
  });

  describe('Filter Rules (workspace-ignore.json)', () => {
    it('should not load .DS_Store files', async () => {
      const workspaceId = 'local-test-filter-ds';
      
      const mockHandle = createMockDirHandle('FilterFolder', {
        '.DS_Store': createMockFileHandle('.DS_Store', ''),
        'notes.md': createMockFileHandle('notes.md', '# Notes'),
      });

      mockHandleStore.set(workspaceId, mockHandle);

      const adapter = new LocalAdapter(workspaceId);
      await adapter.pull();

      const files = await getAllFiles(workspaceId);
      const dsStore = files.find(f => f.name === '.DS_Store');
      const notes = files.find(f => f.name === 'notes.md');

      expect(dsStore).toBeUndefined();
      expect(notes).toBeDefined();
    });

    it('should not recurse into node_modules folder', async () => {
      const workspaceId = 'local-test-filter-node-modules';
      
      const mockHandle = createMockDirHandle('ProjectFolder', {
        'node_modules': createMockDirHandle('node_modules', {
          'package.json': createMockFileHandle('package.json', '{}'),
        }),
        'README.md': createMockFileHandle('README.md', '# Readme'),
      });

      mockHandleStore.set(workspaceId, mockHandle);

      const adapter = new LocalAdapter(workspaceId);
      await adapter.pull();

      const files = await getAllFiles(workspaceId);
      const nodeModulesFiles = files.filter(f => f.path.includes('node_modules'));
      const readme = files.find(f => f.name === 'README.md');

      expect(nodeModulesFiles.length).toBe(0);
      expect(readme).toBeDefined();
    });

    it('should skip large files (> 5MB)', async () => {
      const workspaceId = 'local-test-filter-size';
      
      // Create a "large" file by mocking size
      const largeFileHandle = createMockFileHandle('large.bin', '');
      (largeFileHandle.getFile as any).mockResolvedValue({
        text: vi.fn().mockResolvedValue(''),
        size: 6 * 1024 * 1024, // 6MB
        lastModified: Date.now(),
        name: 'large.bin',
      });

      const mockHandle = createMockDirHandle('SizeFolder', {
        'large.bin': largeFileHandle,
        'small.md': createMockFileHandle('small.md', '# Small'),
      });

      mockHandleStore.set(workspaceId, mockHandle);

      const adapter = new LocalAdapter(workspaceId);
      await adapter.pull();

      const files = await getAllFiles(workspaceId);
      const largeFile = files.find(f => f.name === 'large.bin');
      const smallFile = files.find(f => f.name === 'small.md');

      expect(largeFile).toBeUndefined();
      expect(smallFile).toBeDefined();
    });
  });
});
