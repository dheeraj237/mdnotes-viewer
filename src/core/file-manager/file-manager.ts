/**
 * File Manager
 * Central manager for file operations with git-like workflow:
 * - Pull: Fetch latest content from file system
 * - Apply Patch: Update local cache with editor changes
 * - Commit/Push: Write changes back to file system
 * - Conflict Resolution: Handle external file modifications
 */

import { 
  FileSystemAdapter, 
  FileData, 
  FilePatch, 
  FileCache, 
  FileConflict,
  FileOperation,
  FileMetadata 
} from "./types";

export class FileManager {
  private adapter: FileSystemAdapter;
  private cache: FileCache = {};
  private operations: FileOperation[] = [];
  private syncInterval: number = 5000; // Check for external changes every 5s
  private syncTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(adapter: FileSystemAdapter) {
    this.adapter = adapter;
  }

  /**
   * Load a file from the file system and cache it
   */
  async loadFile(path: string): Promise<FileData> {
    const fileData = await this.adapter.readFile(path);
    

    this.cache[fileData.id] = {
      metadata: {
        id: fileData.id,
        path: fileData.path,
        name: fileData.name,
        category: fileData.category,
        size: fileData.size,
        lastModified: fileData.lastModified,
        mimeType: fileData.mimeType,
      },
      content: fileData.content,
      version: fileData.version,
      lastSync: Date.now(),
      isDirty: false,
    };

    this.startWatching(fileData.id, path);

    return fileData;
  }

  /**
   * Apply a patch from the editor (async, non-blocking)
   */
  async applyPatch(patch: FilePatch): Promise<void> {
    const cached = this.cache[patch.fileId];
    if (!cached) {
      throw new Error(`File not found in cache: ${patch.fileId}`);
    }


    cached.content = patch.content;
    cached.isDirty = true;
    cached.lastSync = Date.now();

    this.queueWrite(patch);
  }

  /**
   * Queue a write operation to be processed asynchronously
   */
  private queueWrite(patch: FilePatch): void {
    const operation: FileOperation = {
      type: "push",
      fileId: patch.fileId,
      path: this.cache[patch.fileId].metadata.path,
      content: patch.content,
      timestamp: patch.timestamp,
      status: "pending",
    };

    this.operations.push(operation);
    this.processNextOperation();
  }

  /**
   * Process queued operations
   */
  private async processNextOperation(): Promise<void> {
    const pending = this.operations.find(op => op.status === "pending");
    if (!pending) return;

    pending.status = "in-progress";

    try {

      const latestVersion = await this.adapter.getFileVersion(pending.path);
      const cached = this.cache[pending.fileId];


      if (latestVersion && cached.version && latestVersion !== cached.version) {

        await this.handleConflict(pending.fileId, pending.path);
        pending.status = "failed";
        pending.error = "File was modified externally";
        return;
      }

      await this.adapter.writeFile(pending.path, pending.content!);
      

      cached.version = await this.adapter.getFileVersion(pending.path);
      cached.isDirty = false;
      cached.lastSync = Date.now();

      pending.status = "completed";
    } catch (error) {
      pending.status = "failed";
      pending.error = error instanceof Error ? error.message : "Unknown error";
      console.error("Failed to process operation:", error);
    }


    this.processNextOperation();
  }

  /**
   * Handle file conflicts by pulling latest content
   */
  private async handleConflict(fileId: string, path: string): Promise<FileConflict> {
    const cached = this.cache[fileId];
    const latest = await this.adapter.readFile(path);


    cached.content = latest.content;
    cached.version = latest.version;
    cached.lastSync = Date.now();
    cached.isDirty = false;

    const conflict: FileConflict = {
      fileId,
      localContent: cached.content,
      remoteContent: latest.content,
      baseVersion: cached.version,
    };

    this.emitConflict(conflict);

    return conflict;
  }

  /**
   * Watch for external file changes
   */
  private startWatching(fileId: string, path: string): void {
    const existingTimer = this.syncTimers.get(fileId);
    if (existingTimer) {
      clearInterval(existingTimer);
    }

    const timer = setInterval(async () => {
      const cached = this.cache[fileId];
      if (!cached) {
        this.stopWatching(fileId);
        return;
      }

      if (cached.isDirty) return;

      try {
        const latestVersion = await this.adapter.getFileVersion(path);
        if (latestVersion && cached.version && latestVersion !== cached.version) {
          await this.pullLatest(fileId, path);
        }
      } catch (error) {
        console.error("Error watching file:", error);
      }
    }, this.syncInterval);

    this.syncTimers.set(fileId, timer);
  }

  /**
   * Stop watching a file
   */
  private stopWatching(fileId: string): void {
    const timer = this.syncTimers.get(fileId);
    if (timer) {
      clearInterval(timer);
      this.syncTimers.delete(fileId);
    }
  }

  /**
   * Pull latest content from file system
   */
  async pullLatest(fileId: string, path: string): Promise<FileData> {
    const latest = await this.adapter.readFile(path);
    const cached = this.cache[fileId];

    if (cached) {
      cached.content = latest.content;
      cached.version = latest.version;
      cached.lastSync = Date.now();
      cached.isDirty = false;
    }

    // Emit event for editor to update
    this.emitUpdate(fileId, latest.content);

    return latest;
  }

  /**
   * Get cached file data
   */
  getCachedFile(fileId: string): FileData | null {
    const cached = this.cache[fileId];
    if (!cached) return null;

    return {
      ...cached.metadata,
      content: cached.content,
      version: cached.version,
    };
  }

  /**
   * Get all cached files
   */
  getAllCachedFiles(): FileData[] {
    return Object.values(this.cache).map(cached => ({
      ...cached.metadata,
      content: cached.content,
      version: cached.version,
    }));
  }

  /**
   * Close a file and stop watching
   */
  closeFile(fileId: string): void {
    this.stopWatching(fileId);
    delete this.cache[fileId];
  }

  /**
   * List files from the file system
   */
  async listFiles(directory: string): Promise<FileMetadata[]> {
    return this.adapter.listFiles(directory);
  }

  /**
   * Event emitters (to be connected to store)
   */
  private eventHandlers: {
    onUpdate?: (fileId: string, content: string) => void;
    onConflict?: (conflict: FileConflict) => void;
  } = {};

  onUpdate(handler: (fileId: string, content: string) => void): void {
    this.eventHandlers.onUpdate = handler;
  }

  onConflict(handler: (conflict: FileConflict) => void): void {
    this.eventHandlers.onConflict = handler;
  }

  private emitUpdate(fileId: string, content: string): void {
    this.eventHandlers.onUpdate?.(fileId, content);
  }

  private emitConflict(conflict: FileConflict): void {
    this.eventHandlers.onConflict?.(conflict);
  }

  /**
   * Cleanup on unmount
   */
  destroy(): void {
    this.syncTimers.forEach(timer => clearInterval(timer));
    this.syncTimers.clear();
    this.cache = {};
    this.operations = [];
  }
}
