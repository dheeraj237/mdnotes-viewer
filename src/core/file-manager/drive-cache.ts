/**
 * Google Drive Local Cache
 * Provides local-first file tree and content caching using IndexedDB
 */

import type { FileMetadata } from './types';

export interface CachedFile extends FileMetadata {
  content?: string;
  syncStatus: 'synced' | 'pending' | 'failed';
  localModified?: number;
}

class DriveCacheManager {
  private db: IDBDatabase | null = null;
  private dbName = 'verve_drive_cache';
  private version = 1;

  /**
   * Initialize the database
   */
  async init(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Store for file metadata and content
        if (!db.objectStoreNames.contains('files')) {
          const fileStore = db.createObjectStore('files', { keyPath: 'id' });
          fileStore.createIndex('parentId', 'parentId', { unique: false });
          fileStore.createIndex('path', 'path', { unique: false });
          fileStore.createIndex('syncStatus', 'syncStatus', { unique: false });
        }

        // Store for folder structure (workspace-specific)
        if (!db.objectStoreNames.contains('folders')) {
          const folderStore = db.createObjectStore('folders', { keyPath: 'folderId' });
          folderStore.createIndex('workspaceId', 'workspaceId', { unique: false });
        }
      };
    });
  }

  /**
   * Get file metadata from cache
   */
  async getFile(fileId: string): Promise<CachedFile | null> {
    await this.init();
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['files'], 'readonly');
      const store = transaction.objectStore('files');
      const request = store.get(fileId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all files in a folder
   */
  async getFilesInFolder(folderId: string): Promise<CachedFile[]> {
    await this.init();
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['files'], 'readonly');
      const store = transaction.objectStore('files');
      const index = store.index('parentId');
      const request = index.getAll(folderId);

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Store file in cache
   */
  async putFile(file: CachedFile): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['files'], 'readwrite');
      const store = transaction.objectStore('files');
      const request = store.put(file);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Store multiple files in cache
   */
  async putFiles(files: CachedFile[]): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['files'], 'readwrite');
      const store = transaction.objectStore('files');

      let completed = 0;
      const total = files.length;

      files.forEach(file => {
        const request = store.put(file);
        request.onsuccess = () => {
          completed++;
          if (completed === total) resolve();
        };
        request.onerror = () => reject(request.error);
      });

      if (total === 0) resolve();
    });
  }

  /**
   * Delete file from cache
   */
  async deleteFile(fileId: string): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['files'], 'readwrite');
      const store = transaction.objectStore('files');
      const request = store.delete(fileId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get folder structure for workspace
   */
  async getFolderStructure(workspaceId: string): Promise<any> {
    await this.init();
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['folders'], 'readonly');
      const store = transaction.objectStore('folders');
      const request = store.get(workspaceId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Save folder structure for workspace
   */
  async saveFolderStructure(workspaceId: string, folderId: string, structure: any): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['folders'], 'readwrite');
      const store = transaction.objectStore('folders');
      const request = store.put({
        folderId: workspaceId,
        workspaceId,
        rootFolderId: folderId,
        structure,
        lastUpdated: Date.now(),
      });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear cache for a specific workspace
   */
  async clearWorkspace(workspaceId: string): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['files', 'folders'], 'readwrite');
      
      // Clear folder structure
      const folderStore = transaction.objectStore('folders');
      folderStore.delete(workspaceId);

      // Clear files (would need to track workspaceId in files too for full cleanup)
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * Clear all cache
   */
  async clearAll(): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['files', 'folders'], 'readwrite');
      const fileStore = transaction.objectStore('files');
      const folderStore = transaction.objectStore('folders');
      
      fileStore.clear();
      folderStore.clear();

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * Get pending files (not synced)
   */
  async getPendingFiles(): Promise<CachedFile[]> {
    await this.init();
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['files'], 'readonly');
      const store = transaction.objectStore('files');
      const index = store.index('syncStatus');
      const request = index.getAll('pending');

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Update file sync status
   */
  async updateSyncStatus(fileId: string, status: 'synced' | 'pending' | 'failed'): Promise<void> {
    await this.init();
    if (!this.db) return;

    const file = await this.getFile(fileId);
    if (!file) return;

    file.syncStatus = status;
    await this.putFile(file);
  }
}

// Singleton instance
export const driveCache = new DriveCacheManager();
