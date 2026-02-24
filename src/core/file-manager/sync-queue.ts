/**
 * Sync Queue Manager
 * Handles background synchronization of local changes to Google Drive
 */

export interface SyncOperation {
  id: string;
  type: 'create-file' | 'create-folder' | 'delete' | 'update' | 'rename';
  parentPath: string;
  name: string;
  content?: string;
  timestamp: number;
  retries: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  driveId?: string; // ID after successful creation on Drive
}

class SyncQueueManager {
  private queue: SyncOperation[] = [];
  private processing = false;
  private listeners: Set<(queue: SyncOperation[]) => void> = new Set();
  private storageKey = 'verve_sync_queue';
  private maxRetries = 3;

  constructor() {
    this.loadQueue();
  }

  /**
   * Load queue from localStorage
   */
  private loadQueue() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        this.queue = JSON.parse(stored);
        // Reset processing status on load (in case app crashed)
        this.queue.forEach(op => {
          if (op.status === 'processing') {
            op.status = 'pending';
          }
        });
      }
    } catch (error) {
      console.error('Failed to load sync queue:', error);
    }
  }

  /**
   * Save queue to localStorage
   */
  private saveQueue() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.queue));
      this.notifyListeners();
    } catch (error) {
      console.error('Failed to save sync queue:', error);
    }
  }

  /**
   * Add operation to queue
   */
  addOperation(operation: Omit<SyncOperation, 'id' | 'timestamp' | 'retries' | 'status'>): string {
    const id = `${operation.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const syncOp: SyncOperation = {
      ...operation,
      id,
      timestamp: Date.now(),
      retries: 0,
      status: 'pending',
    };

    this.queue.push(syncOp);
    this.saveQueue();
    
    // Start processing if not already running
    this.processQueue();
    
    return id;
  }

  /**
   * Get all operations
   */
  getQueue(): SyncOperation[] {
    return [...this.queue];
  }

  /**
   * Get pending operations count
   */
  getPendingCount(): number {
    return this.queue.filter(op => op.status === 'pending' || op.status === 'processing').length;
  }

  /**
   * Check if queue is syncing
   */
  isSyncing(): boolean {
    return this.processing;
  }

  /**
   * Subscribe to queue changes
   */
  subscribe(listener: (queue: SyncOperation[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners
   */
  private notifyListeners() {
    this.listeners.forEach(listener => listener([...this.queue]));
  }

  /**
   * Process queue
   */
  async processQueue() {
    if (this.processing) return;
    
    this.processing = true;
    this.notifyListeners();

    while (this.queue.length > 0) {
      const operation = this.queue.find(op => op.status === 'pending');
      if (!operation) break;

      operation.status = 'processing';
      this.saveQueue();

      try {
        await this.executeOperation(operation);
        operation.status = 'completed';
        // Remove completed operations after a short delay
        setTimeout(() => {
          this.queue = this.queue.filter(op => op.id !== operation.id);
          this.saveQueue();
        }, 1000);
      } catch (error) {
        operation.retries++;
        if (operation.retries >= this.maxRetries) {
          operation.status = 'failed';
          operation.error = (error as Error).message;
          console.error('Sync operation failed after max retries:', operation, error);
        } else {
          operation.status = 'pending';
          console.warn(`Sync operation failed, will retry (${operation.retries}/${this.maxRetries}):`, error);
        }
      }

      this.saveQueue();
      
      // Small delay between operations
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.processing = false;
    this.notifyListeners();
  }

  /**
   * Execute a single operation
   */
  private async executeOperation(operation: SyncOperation): Promise<void> {
    const { requestDriveAccessToken } = await import('@/core/auth/google');
    const token = await requestDriveAccessToken(false);
    
    if (!token) {
      throw new Error('Not authenticated with Google Drive');
    }

    const folderId = operation.parentPath.replace(/^gdrive-/, '');

    switch (operation.type) {
      case 'create-file': {
        const metadata = { name: operation.name, parents: [folderId] };
        const boundary = '-------314159265358979323846';
        const content = operation.content || '';
        const multipart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: text/markdown\r\n\r\n${content}\r\n--${boundary}--`;
        
        const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name', {
          method: 'POST',
          headers: { 
            Authorization: `Bearer ${token}`, 
            'Content-Type': `multipart/related; boundary=${boundary}` 
          },
          body: multipart,
        });
        
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`Failed to create file: ${errorText}`);
        }
        
        const data = await res.json();
        operation.driveId = data.id;
        break;
      }

      case 'create-folder': {
        const metadata = { 
          name: operation.name, 
          mimeType: 'application/vnd.google-apps.folder', 
          parents: [folderId] 
        };
        
        const res = await fetch('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers: { 
            Authorization: `Bearer ${token}`, 
            'Content-Type': 'application/json' 
          },
          body: JSON.stringify(metadata),
        });
        
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`Failed to create folder: ${errorText}`);
        }
        
        const data = await res.json();
        operation.driveId = data.id;
        break;
      }

      case 'delete': {
        // Implementation for delete operation
        break;
      }

      case 'update': {
        // Implementation for update operation
        break;
      }

      case 'rename': {
        // Implementation for rename operation
        break;
      }
    }
  }

  /**
   * Clear all completed operations
   */
  clearCompleted() {
    this.queue = this.queue.filter(op => op.status !== 'completed');
    this.saveQueue();
  }

  /**
   * Clear all operations
   */
  clearAll() {
    this.queue = [];
    this.saveQueue();
  }

  /**
   * Retry failed operations
   */
  retryFailed() {
    this.queue.forEach(op => {
      if (op.status === 'failed') {
        op.status = 'pending';
        op.retries = 0;
        op.error = undefined;
      }
    });
    this.saveQueue();
    this.processQueue();
  }
}

// Singleton instance
export const syncQueue = new SyncQueueManager();
