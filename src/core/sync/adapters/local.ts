/**
 * Local Adapter
 * 
 * Uses File System Access API to sync files with local filesystem.
 * 
 * Core responsibility:
 * 1. Push files to local filesystem
 * 2. Pull files from filesystem when requested
 * 3. Update RxDB directly to mark files clean after push
 */

import type { ISyncAdapter, AdapterInitContext, AdapterCapabilities } from '../types';
import type { FileNode } from '@/shared/types';

export class LocalAdapter implements ISyncAdapter {
  name = 'local';

  capabilities: AdapterCapabilities = {
    canPush: true,
    canPull: true,
    canList: true,
    canPullWorkspace: true,
  };

  private workspaceId: string = '';
  private workspaceType: string = '';
  private dirHandle: FileSystemDirectoryHandle | null = null;
  private isReadyFlag = false;
  private listeners: Map<string, Set<Function>> = new Map();
  private rxdbClient: any = null;

  async initialize(context: AdapterInitContext): Promise<void> {
    this.workspaceId = context.workspaceId;
    this.workspaceType = context.workspaceType;
    this.rxdbClient = context.rxdbClient;

    try {
      // Try to get directory handle from context or restore from storage
      if (context.dirHandle) {
        this.dirHandle = context.dirHandle;
        this.isReadyFlag = true;
        console.log(`[LocalAdapter] Initialized with provided directory handle`);
        this.emit('ready', { workspaceId: this.workspaceId });
        return;
      }

      // Try to restore from IndexedDB
      const stored = await this.restoreDirectoryHandle();
      if (stored) {
        this.dirHandle = stored;
        this.isReadyFlag = true;
        console.log(`[LocalAdapter] Restored directory handle from storage`);
        this.emit('ready', { workspaceId: this.workspaceId });
        return;
      }

      // Not ready yet - waiting for user to select directory
      console.log(
        `[LocalAdapter] No directory handle available. Waiting for user gesture.`
      );
      this.emit('state-changed', { state: 'waiting-for-permission' });
    } catch (err) {
      console.error(`[LocalAdapter] Initialization error:`, err);
      this.emit('error', {
        code: 'INIT_FAILED',
        message: String(err),
      });
    }
  }

  async destroy(): Promise<void> {
    this.dirHandle = null;
    this.isReadyFlag = false;
    console.log(`[LocalAdapter] Destroyed`);
  }

  isReady(): boolean {
    return this.isReadyFlag && this.dirHandle !== null;
  }

  /**
   * Push a file to local filesystem
   * Must update RxDB to mark file clean after success
   */
  async push(file: FileNode, rxdbClient: any): Promise<void> {
    if (!this.dirHandle) {
      throw new Error('Directory handle not available');
    }

    try {
      // Create file in filesystem
      const handle = await this.getFileHandle(file.path, true);
      const writable = await handle.createWritable({ keepExistingData: false });
      
      // Write content (file.content or empty if not present)
      const content = (file as any).content || '';
      await writable.write(content);
      await writable.close();

      console.log(`[LocalAdapter] Pushed file: ${file.path}`);

      // Mark file as clean in RxDB
      await this.markFileClean(file.id, rxdbClient);
    } catch (err) {
      console.error(`[LocalAdapter] Error pushing file ${file.path}:`, err);
      throw err;
    }
  }

  /**
   * Pull a single file from filesystem
   */
  async pull(fileId: string, rxdbClient: any): Promise<FileNode> {
    if (!this.dirHandle) {
      throw new Error('Directory handle not available');
    }

    try {
      // Get file metadata from RxDB to know where to read it
      const filesCollection = rxdbClient.collections.files;
      const file = await filesCollection.findByIds([fileId]).exec();

      if (!file || !file[0]) {
        throw new Error(`File not found: ${fileId}`);
      }

      const fileNode = file[0].toJSON() as FileNode;

      // Read file from filesystem
      const handle = await this.getFileHandle(fileNode.path, false);
      const file$ = await handle.getFile();
      const content = await file$.text();

      return {
        ...fileNode,
        content: content as any,
      };
    } catch (err) {
      console.error(`[LocalAdapter] Error pulling file ${fileId}:`, err);
      throw err;
    }
  }

  /**
   * List all files in the workspace
   */
  async listWorkspaceFiles(rxdbClient: any): Promise<FileNode[]> {
    if (!this.dirHandle) {
      throw new Error('Directory handle not available');
    }

    try {
      const files: FileNode[] = [];
      const visited = new Set<string>();

      const walk = async (dirHandle: FileSystemDirectoryHandle, pathPrefix: string) => {
        for await (const [name, handle] of (dirHandle as any).entries()) {
          const path = pathPrefix ? `${pathPrefix}/${name}` : name;

          if (handle.kind === 'file') {
            files.push({
              id: path, // Use path as ID for consistency
              type: 'file',
              name,
              path,
              mimeType: this.getMimeType(name),
            } as FileNode);
          } else if (handle.kind === 'directory' && !visited.has(path)) {
            visited.add(path);
            await walk(handle as FileSystemDirectoryHandle, path);
          }
        }
      };

      await walk(this.dirHandle, '');
      console.log(`[LocalAdapter] Listed ${files.length} files from workspace`);
      return files;
    } catch (err) {
      console.error(`[LocalAdapter] Error listing workspace:`, err);
      throw err;
    }
  }

  /**
   * Sync entire workspace from remote filesystem
   * Overwrites local RxDB with files from filesystem
   */
  async pullWorkspace(rxdbClient: any): Promise<void> {
    if (!this.dirHandle) {
      throw new Error('Directory handle not available');
    }

    try {
      console.log(`[LocalAdapter] Pulling entire workspace from filesystem`);

      // List all files from filesystem
      const files = await this.listWorkspaceFiles(rxdbClient);

      // For each file, read content and upsert into RxDB
      const filesCollection = rxdbClient.collections.files;

      for (const file of files) {
        try {
          const fileWithContent = await this.pull(file.id, rxdbClient);
          
          // Upsert file into RxDB with content from filesystem
          await filesCollection.upsert({
            ...fileWithContent,
            workspaceId: this.workspaceId,
            dirty: false, // Files from filesystem are clean
            isSynced: true,
          });
        } catch (err) {
          console.warn(`[LocalAdapter] Error pulling file ${file.path}:`, err);
          // Continue with next file on error
        }
      }

      console.log(`[LocalAdapter] Pulled workspace: ${files.length} files synced`);
    } catch (err) {
      console.error(`[LocalAdapter] Error pulling workspace:`, err);
      throw err;
    }
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

  // ========================================================================
  // Private helpers
  // ========================================================================

  private async getFileHandle(
    filePath: string,
    create: boolean = false
  ): Promise<FileSystemFileHandle> {
    if (!this.dirHandle) {
      throw new Error('Directory handle not available');
    }

    const parts = filePath.split('/').filter(Boolean);
    const fileName = parts.pop();

    if (!fileName) {
      throw new Error('Invalid file path');
    }

    // Navigate/create directories as needed
    let currentDir = this.dirHandle;
    for (const part of parts) {
      currentDir = await currentDir.getDirectoryHandle(part, { create });
    }

    // Get or create file handle
    return currentDir.getFileHandle(fileName, { create });
  }

  private async restoreDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
    try {
      const dm = await import('@/core/cache/db-manage');
      if (dm && typeof dm.getHandle === 'function') {
        const h = await dm.getHandle(this.workspaceId);
        return h || null;
      }
      return null;
    } catch (err) {
      console.warn('Could not restore directory handle:', err);
      return null;
    }
  }

  private async markFileClean(fileId: string, rxdbClient: any): Promise<void> {
    try {
      const filesCollection = rxdbClient.collections.files;
      const file = await filesCollection.findByIds([fileId]).exec();

      if (file && file[0]) {
        // Update file to mark as clean and synced
        await file[0].patch({
          dirty: false,
          isSynced: true,
        });
        console.log(`[LocalAdapter] Marked file clean in RxDB: ${fileId}`);
      }
    } catch (err) {
      console.error(`[LocalAdapter] Error marking file clean:`, err);
      // Don't throw - marking clean is best-effort
    }
  }

  private getMimeType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const mimeTypes: { [key: string]: string } = {
      md: 'text/markdown',
      txt: 'text/plain',
      json: 'application/json',
      js: 'application/javascript',
      ts: 'application/typescript',
      html: 'text/html',
      css: 'text/css',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      svg: 'image/svg+xml',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  private emit(event: string, data: any): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(listener => listener(data));
    }
  }
}
