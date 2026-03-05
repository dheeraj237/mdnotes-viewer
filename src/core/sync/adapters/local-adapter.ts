import { Observable } from 'rxjs';
import type { ISyncAdapter, AdapterFileDescriptor } from '../adapter-types';
import type { FileNode } from '@/shared/types';
import { requestPermissionForWorkspace, storeDirectoryHandle as workspaceStoreDirectoryHandle } from '@/core/cache/workspace-manager';
import { buildFileTreeFromDirectory } from '@/features/file-explorer/store/helpers/file-tree-builder';
import { upsertCachedFile } from '@/core/cache/file-manager';
import { FileType, WorkspaceType } from '@/core/cache/types';

/**
 * Browser-friendly Local Adapter using the File System Access API.
 * Manages workspace-scoped directory handles with simple, direct CRUD operations.
 * 
 * Pattern: directory handles are cached per workspace. Each CRUD operation
 * uses currentWorkspaceId or can accept a workspaceId parameter.
 */
export class LocalAdapter implements ISyncAdapter {
  name = 'local';
  // Cache of directory handles per workspace (simple key-value map)
  private dirHandleCache: Map<string, FileSystemDirectoryHandle> = new Map();
  // Current active workspace (fallback when not specified)
  private currentWorkspaceId: string | null = null;

  constructor() { }

  /**
   * Set the currently active workspace (used as default when workspaceId not provided)
   */
  setCurrentWorkspace(workspaceId: string | null): void {
    this.currentWorkspaceId = workspaceId;
  }

  /**
   * Initialize adapter with a directory handle for a specific workspace.
   */
  async initialize(directoryHandle?: FileSystemDirectoryHandle, workspaceId?: string): Promise<void> {
    const wsId = workspaceId || this.currentWorkspaceId;
    if (!wsId) {
      throw new Error('Workspace ID is required for LocalAdapter initialization');
    }

    if (!directoryHandle) {
      throw new Error(`Local directory not initialized for workspace "${wsId}". Please open directory picker.`);
    }

    // Store handle for this workspace
    this.dirHandleCache.set(wsId, directoryHandle);

    // Set global fallback for page reload recovery
    (window as any).__localDirHandle = directoryHandle;
    (window as any).__localWorkspaceId = wsId;
  }

  /**
   * User-gesture: open directory picker and initialize for a workspace.
   * Stores handle and loads directory tree into cache.
   */
  async openDirectoryPicker(workspaceId?: string): Promise<void> {
    const wsId = workspaceId || this.currentWorkspaceId;
    if (!wsId) {
      throw new Error('Workspace ID is required');
    }

    if (!('showDirectoryPicker' in window)) {
      throw new Error('Directory picker not supported in this browser');
    }

    // User gesture: open directory picker
    const dirHandle = await (window as any).showDirectoryPicker();

    // Persist handle metadata to IndexedDB
    try {
      await workspaceStoreDirectoryHandle(wsId, dirHandle);
    } catch (e) {
      console.warn('Failed to store directory handle metadata:', e);
    }

    // Initialize this workspace
    await this.initialize(dirHandle, wsId);

    // Scan and populate cache with directory contents
    try {
      const tree = await buildFileTreeFromDirectory(dirHandle);
      await this.walkAndUpsertTree(tree, wsId);
    } catch (e) {
      console.warn('Failed to scan and cache directory contents:', e);
    }
  }

  /**
   * Helper: walk directory tree and upsert files/folders into cache
   */
  private async walkAndUpsertTree(nodes: any[], workspaceId: string): Promise<void> {
    for (const node of nodes) {
      await this.walkAndUpsertNode(node, workspaceId);
    }
  }

  /**
   * Recursively walk and upsert a tree node
   */
  private async walkAndUpsertNode(node: any, workspaceId: string): Promise<void> {
    try {
      if (node.type === FileType.File) {
        const filePath = node.path;
        let content = '';

        // Read file content via handle
        try {
          const fileHandle = await this.getFileHandle(filePath, false, workspaceId).catch(() => undefined);
          if (fileHandle) {
            const f = await fileHandle.getFile();
            content = await f.text();
          }
        } catch (e) {
          console.warn(`Failed to read file content for ${filePath}:`, e);
        }

        const cached: FileNode = {
          id: filePath,
          name: node.name,
          path: filePath,
          type: FileType.File,
          workspaceType: WorkspaceType.Local,
          workspaceId: workspaceId,
          content,
          lastModified: Date.now(),
          dirty: false,
          isSynced: true,
          syncStatus: 'idle',
          version: 1,
        } as any;

        await upsertCachedFile(cached).catch((e) =>
          console.warn(`Failed to upsert file ${filePath}:`, e)
        );
      } else if (node.type === FileType.Directory) {
        const dirPath = node.path;
        const cached: FileNode = {
          id: dirPath,
          name: node.name,
          path: dirPath,
          type: FileType.Directory,
          workspaceType: WorkspaceType.Local,
          workspaceId: workspaceId,
          children: node.children || [],
          dirty: false,
          isSynced: true,
          syncStatus: 'idle',
          version: 1,
        } as any;

        await upsertCachedFile(cached).catch((e) =>
          console.warn(`Failed to upsert directory ${dirPath}:`, e)
        );
      }

      // Recurse into children
      const children = node.children || [];
      for (const child of children) {
        await this.walkAndUpsertNode(child, workspaceId);
      }
    } catch (e) {
      console.warn('Error walking tree node:', e);
    }
  }

  /**
   * Restore handle for a workspace from stored metadata.
   * Uses browser prompts to request permission without user gesture.
   */
  async promptPermissionAndRestore(workspaceId: string): Promise<boolean> {
    try {
      // Attempt to restore handle from workspace-manager (uses stored metadata)
      const handle = await requestPermissionForWorkspace(workspaceId);
      if (!handle) {
        console.warn(`[LocalAdapter] No stored handle for workspace "${workspaceId}"`);
        return false;
      }

      // Validate handle has required methods
      if (typeof (handle as any).getDirectoryHandle !== 'function') {
        console.warn(`[LocalAdapter] Retrieved handle is invalid for workspace "${workspaceId}"`);
        return false;
      }

      // Persist handle metadata for future recovery
      try {
        await workspaceStoreDirectoryHandle(workspaceId, handle);
      } catch (e) {
        console.warn('Failed to persist directory handle:', e);
      }

      // Initialize this workspace with restored handle
      await this.initialize(handle, workspaceId);

      console.log(`[LocalAdapter] Successfully restored handle for workspace "${workspaceId}"`);
      return true;
    } catch (e) {
      console.warn(`[LocalAdapter] Failed to restore handle for workspace "${workspaceId}":`, e);
      return false;
    }
  }

  /**
   * Check if adapter is ready for the current workspace.
   * Supports recovery from cache and global fallback.
   */
  isReady(): boolean {
    const wsId = this.currentWorkspaceId;
    if (!wsId) return false;

    // Check if we have a cached handle for this workspace
    const cachedHandle = this.dirHandleCache.get(wsId);
    if (cachedHandle) {
      return true;
    }

    // Try to recover from global fallback (page reload recovery)
    if (wsId === (window as any).__localWorkspaceId) {
      const globalHandle = (window as any).__localDirHandle;
      if (globalHandle) {
        this.dirHandleCache.set(wsId, globalHandle);
        return true;
      }
    }

    return false;
  }

  /**
   * Simple CRUD Operations
   */

  async push(descriptor: AdapterFileDescriptor, content: string): Promise<boolean> {
    const context = `[LocalAdapter] push(${descriptor.id})`;
    try {
      if (!this.currentWorkspaceId) {
        throw new Error('No active workspace');
      }

      const fileHandle = await this.getFileHandle(descriptor.path, true, this.currentWorkspaceId);
      if (!fileHandle) throw new Error('Failed to get file handle');

      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();

      return true;
    } catch (err) {
      console.error(`${context}: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }

  async pull(fileId: string, localVersion?: number): Promise<string | null> {
    try {
      if (!this.currentWorkspaceId) {
        throw new Error('No active workspace');
      }

      const fileHandle = await this.getFileHandle(fileId, false, this.currentWorkspaceId);
      if (!fileHandle) return null;

      const file = await fileHandle.getFile();
      const content = await file.text();
      return content;
    } catch (err) {
      console.debug('[LocalAdapter] pull error:', err);
      return null;
    }
  }

  async exists(fileId: string): Promise<boolean> {
    try {
      if (!this.currentWorkspaceId) return false;

      const handle = await this.getFileHandle(fileId, false, this.currentWorkspaceId);
      return !!handle;
    } catch {
      return false;
    }
  }

  async delete(fileId: string): Promise<boolean> {
    try {
      if (!this.currentWorkspaceId) {
        throw new Error('No active workspace');
      }

      const parts = fileId.split('/').filter(Boolean);
      const fileName = parts.pop()!;
      const dir = await this.getDirectoryHandle(parts.join('/'), this.currentWorkspaceId);

      await dir.removeEntry(fileName);
      return true;
    } catch (err) {
      console.error('[LocalAdapter] delete error:', err);
      return false;
    }
  }

  async listFiles(directory = ''): Promise<Array<{ id: string; path: string; name: string }>> {
    if (!this.currentWorkspaceId) {
      throw new Error('No active workspace');
    }

    const dir = await this.getDirectoryHandle(directory, this.currentWorkspaceId);
    const out: Array<{ id: string; path: string; name: string }> = [];

    // @ts-ignore - values() is available in modern browsers
    for await (const entry of dir.values()) {
      if (entry.kind === 'file') {
        const filePath = directory ? `${directory}/${entry.name}` : entry.name;
        out.push({ id: filePath, path: filePath, name: entry.name });
      }
    }
    return out;
  }

  async listWorkspaceFiles(workspaceId?: string, directory = ''): Promise<Array<{ id: string; path: string; metadata?: any }>> {
    const wsId = workspaceId || this.currentWorkspaceId;
    if (!wsId) {
      throw new Error('No workspace specified');
    }

    // Temporarily set workspace, list files, then restore
    const originalWsId = this.currentWorkspaceId;
    try {
      this.currentWorkspaceId = wsId;
      const files = await this.listFiles(directory);
      return files.map(f => ({ id: f.id, path: f.path, metadata: { name: f.name } }));
    } finally {
      this.currentWorkspaceId = originalWsId;
    }
  }

  async pullWorkspace(workspaceId?: string, directory = ''): Promise<Array<{ fileId: string; content: string }>> {
    const wsId = workspaceId || this.currentWorkspaceId;
    if (!wsId) {
      throw new Error('No workspace specified');
    }

    // Temporarily set workspace, pull files, then restore
    const originalWsId = this.currentWorkspaceId;
    try {
      this.currentWorkspaceId = wsId;
      const files = await this.listFiles(directory);
      const out: Array<{ fileId: string; content: string }> = [];

      for (const f of files) {
        const content = (await this.pull(f.path)) ?? '';
        out.push({ fileId: f.path, content });
      }

      return out;
    } finally {
      this.currentWorkspaceId = originalWsId;
    }
  }

  /**
   * Helper: Get or create a file handle for a workspace.
   * Navigates the directory tree and returns a file handle.
   */
  private async getFileHandle(
    path: string,
    create = false,
    workspaceId?: string
  ): Promise<FileSystemFileHandle | undefined> {
    const wsId = workspaceId || this.currentWorkspaceId;
    if (!wsId) {
      throw new Error('Workspace ID is required');
    }

    const rootHandle = this.dirHandleCache.get(wsId);
    if (!rootHandle) {
      throw new Error(`Root handle not initialized for workspace "${wsId}"`);
    }

    // Navigate to file through directory hierarchy
    const parts = path.split('/').filter(Boolean);
    const fileName = parts.pop()!;
    let dir: FileSystemDirectoryHandle = rootHandle;

    for (const part of parts) {
      dir = await dir.getDirectoryHandle(part, { create });
    }

    return await dir.getFileHandle(fileName, { create });
  }

  /**
   * Helper: Get a directory handle for a workspace.
   */
  private async getDirectoryHandle(
    path: string,
    workspaceId?: string,
    create = false
  ): Promise<FileSystemDirectoryHandle> {
    const wsId = workspaceId || this.currentWorkspaceId;
    if (!wsId) {
      throw new Error('Workspace ID is required');
    }

    const rootHandle = this.dirHandleCache.get(wsId);
    if (!rootHandle) {
      throw new Error(`Root handle not initialized for workspace "${wsId}"`);
    }

    if (!path) return rootHandle;

    const parts = path.split('/').filter(Boolean);
    let dir: FileSystemDirectoryHandle = rootHandle;

    for (const part of parts) {
      dir = await dir.getDirectoryHandle(part, { create });
    }

    return dir;
  }
}
