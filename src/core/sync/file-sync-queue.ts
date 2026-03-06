/**
 * Immutable File Sync Queue
 * 
 * Manages pending file sync operations across adapter reinitializations.
 * Preserves queue state when workspaces switch or adapters are destroyed.
 * 
 * Implemented as immutable entries with readonly properties.
 */

/**
 * Immutable queue entry for a file awaiting sync.
 */
export class FileSyncQueueEntry {
  readonly fileId: string;
  readonly workspaceId: string;
  readonly retryCount: number;
  readonly lastRetryTime: Date;
  readonly createdAt: Date;

  constructor(
    fileId: string,
    workspaceId: string,
    retryCount: number = 0,
    lastRetryTime: Date = new Date(),
    createdAt: Date = new Date()
  ) {
    this.fileId = fileId;
    this.workspaceId = workspaceId;
    this.retryCount = retryCount;
    this.lastRetryTime = lastRetryTime;
    this.createdAt = createdAt;
  }

  /**
   * Create a new entry with incremented retry count (immutable update)
   */
  withIncrementedRetry(): FileSyncQueueEntry {
    return new FileSyncQueueEntry(
      this.fileId,
      this.workspaceId,
      this.retryCount + 1,
      new Date(),
      this.createdAt
    );
  }
}

/**
 * Immutable queue manager for file sync operations.
 * 
 * Design:
 * - Entries are immutable (readonly properties)
 * - Queue as a Map<fileId, FileSyncQueueEntry>
 * - Preserved across workspace switches and adapter reinits
 * - Cleared only on explicit destroy() or when files sync successfully
 */
export class FileSyncQueue {
  private readonly entries: Map<string, FileSyncQueueEntry>;
  private maxRetries: number;

  constructor(maxRetries: number = 3, initialEntries?: FileSyncQueueEntry[]) {
    this.maxRetries = maxRetries;
    this.entries = new Map();
    
    if (initialEntries) {
      for (const entry of initialEntries) {
        this.entries.set(entry.fileId, entry);
      }
    }
  }

  /**
   * Enqueue a file for sync. Returns the queue entry.
   * If file is already queued, increments retry count.
   */
  enqueue(fileId: string, workspaceId: string): FileSyncQueueEntry {
    const existing = this.entries.get(fileId);
    
    if (existing) {
      // Already queued: increment retry
      const updated = existing.withIncrementedRetry();
      this.entries.set(fileId, updated);
      return updated;
    }
    
    // New entry
    const entry = new FileSyncQueueEntry(fileId, workspaceId);
    this.entries.set(fileId, entry);
    return entry;
  }

  /**
   * Remove a file from the queue (after successful sync).
   */
  dequeue(fileId: string): FileSyncQueueEntry | null {
    const entry = this.entries.get(fileId);
    if (entry) {
      this.entries.delete(fileId);
    }
    return entry;
  }

  /**
   * Get a queued entry by fileId, or null if not queued.
   */
  get(fileId: string): FileSyncQueueEntry | null {
    return this.entries.get(fileId) || null;
  }

  /**
   * Get all pending entries for a specific workspace.
   * Returns a readonly snapshot (not live-updating).
   */
  getByWorkspace(workspaceId: string): readonly FileSyncQueueEntry[] {
    return Array.from(this.entries.values()).filter(
      (entry) => entry.workspaceId === workspaceId
    );
  }

  /**
   * Get all pending entries (readonly snapshot).
   */
  getAll(): readonly FileSyncQueueEntry[] {
    return Array.from(this.entries.values());
  }

  /**
   * Check if a file has exceeded max retries.
   */
  hasExceededRetries(fileId: string): boolean {
    const entry = this.entries.get(fileId);
    if (!entry) return false;
    return entry.retryCount >= this.maxRetries;
  }

  /**
   * Get the number of pending operations.
   */
  size(): number {
    return this.entries.size;
  }

  /**
   * Check if queue is empty.
   */
  isEmpty(): boolean {
    return this.entries.size === 0;
  }

  /**
   * Clear the entire queue (only on SyncManager destroy).
   */
  clear(): void {
    this.entries.clear();
  }

  /**
   * Get a snapshot of all queue state.
   * Useful for debugging and testing.
   */
  snapshot(): Readonly<Record<string, FileSyncQueueEntry>> {
    const obj: Record<string, FileSyncQueueEntry> = {};
    for (const [fileId, entry] of this.entries.entries()) {
      obj[fileId] = entry;
    }
    return Object.freeze(obj);
  }
}
