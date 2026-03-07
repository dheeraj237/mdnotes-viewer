/**
 * Sync Manager
 * 
 * Pure RxDB-based orchestration:
 * - Subscribes to active workspace + dirty files in RxDB
 * - Detects dirty files and pushes them to the appropriate adapter
 * - Adapters update RxDB directly to mark files clean
 * - No direct messaging with components
 */

import { BehaviorSubject, Observable } from 'rxjs';
import type { ISyncAdapter, AdapterInitContext } from './types';
import { SyncStatus } from './types';
import { AdapterRegistry } from './adapter-registry';
import { subscribeQuery } from '@/core/rxdb/rxdb-client';
import Collections from '@/core/rxdb/collections';
import type { FileNode } from '@/shared/types';

/**
 * SyncManager - singular responsibility: watch RxDB for dirty files and push them
 */
export class SyncManager {
  private static instance: SyncManager | null = null;

  private statusSubject = new BehaviorSubject<SyncStatus>(SyncStatus.IDLE);
  private adaptersByWorkspace: Map<string, ISyncAdapter> = new Map();
  private subscriptions: Array<{ unsubscribe: () => void }> = [];
  private workspaceUnsubscribers: Map<string, () => void> = new Map();
  private registry: AdapterRegistry;
  private rxdbClient: any = null;
  private isRunning = false;

  private constructor() {
    this.registry = AdapterRegistry.getInstance();
  }

  static getInstance(): SyncManager {
    if (!SyncManager.instance) {
      SyncManager.instance = new SyncManager();
    }
    return SyncManager.instance;
  }

  /**
   * Initialize sync manager with RxDB client
   */
  async initialize(rxdbClient: any): Promise<void> {
    if (this.isRunning) {
      console.warn('[SyncManager] Already initialized');
      return;
    }

    this.rxdbClient = rxdbClient;
    // No durable queue here; we subscribe directly to RxDB queries.
    this.isRunning = true;

    console.log('[SyncManager] Initialized');
  }

  /**
   * Get status as observable
   */
  status$(): Observable<SyncStatus> {
    return this.statusSubject.asObservable();
  }

  /**
   * Initialize workspace-specific adapter
   * Called when workspace becomes active or is created
   */
  async initializeForWorkspace(workspaceId: string, workspaceType: string, dirHandle?: any): Promise<void> {
    if (!this.rxdbClient) {
      throw new Error('SyncManager not initialized - call initialize() first');
    }

    // Destroy old adapter if exists
    if (this.adaptersByWorkspace.has(workspaceId)) {
      await this.destroyForWorkspace(workspaceId);
    }

    try {
      // Create adapter for this workspace type
      const adapter = await this.registry.create(workspaceType, {
        workspaceId,
        workspaceType,
        rxdbClient: this.rxdbClient,
        dirHandle,
      });

      // Initialize adapter
      await adapter.initialize({
        workspaceId,
        workspaceType,
        rxdbClient: this.rxdbClient,
      } as AdapterInitContext);

      this.adaptersByWorkspace.set(workspaceId, adapter);
      console.log(`[SyncManager] Initialized adapter for workspace: ${workspaceId}`);

      // Start watching dirty files for this workspace
      this.watchWorkspaceDirtyFiles(workspaceId);
    } catch (err) {
      console.error(
        `[SyncManager] Failed to initialize adapter for workspace ${workspaceId}:`,
        err
      );
      this.statusSubject.next(SyncStatus.ERROR);
    }
  }

  /**
   * Destroy workspace-specific adapter
   * Called when workspace is deleted or switched away
   */
  async destroyForWorkspace(workspaceId: string): Promise<void> {
    const adapter = this.adaptersByWorkspace.get(workspaceId);
    if (!adapter) return;

    try {
      await adapter.destroy();
      this.adaptersByWorkspace.delete(workspaceId);
      // Unsubscribe any dirty-file watcher for this workspace
      const unsub = this.workspaceUnsubscribers.get(workspaceId);
      try { if (unsub) unsub(); } catch (_) { }
      this.workspaceUnsubscribers.delete(workspaceId);
      console.log(`[SyncManager] Destroyed adapter for workspace: ${workspaceId}`);
    } catch (err) {
      console.error(`[SyncManager] Error destroying adapter for ${workspaceId}:`, err);
    }
  }

  /**
   * Watch for dirty files in a workspace and push them
   * 
   * This is the core sync loop:
   * 1. Subscribe to dirty files in RxDB for this workspace
   * 2. When dirty files appear, get the adapter for that workspace
   * 3. Call adapter.push(file) which will update RxDB to mark clean
   * 4. Move on to next dirty file
   */
  private watchWorkspaceDirtyFiles(workspaceId: string): void {
    if (!this.rxdbClient) return;

    try {
      // Subscribe to dirty files using shared rxdb-client helper.
      const unsubscribe = subscribeQuery(Collections.Files, { selector: { workspaceId, dirty: true } }, async (docs: any[]) => {
        const dirtyFiles: FileNode[] = (docs || []) as FileNode[];
        if (!dirtyFiles || dirtyFiles.length === 0) return;

        this.statusSubject.next(SyncStatus.SYNCING);

        for (const file of dirtyFiles) {
          try {
            await this.pushFileToAdapter(workspaceId, file);
          } catch (err) {
            console.error(`[SyncManager] Error pushing file ${file.id}:`, err);
          }
        }

        this.statusSubject.next(SyncStatus.IDLE);
      });

      this.subscriptions.push({ unsubscribe });
      this.workspaceUnsubscribers.set(workspaceId, unsubscribe);
    } catch (err) {
      console.error(`[SyncManager] Error setting up dirty file watcher for ${workspaceId}:`, err);
    }
  }

  /**
   * Push a single file to the workspace adapter
   * Adapter will update RxDB to mark clean after success
   */
  private async pushFileToAdapter(workspaceId: string, file: FileNode): Promise<void> {
    const adapter = this.adaptersByWorkspace.get(workspaceId);
    if (!adapter) {
      console.warn(`[SyncManager] No adapter for workspace: ${workspaceId}`);
      return;
    }

    if (!adapter.isReady()) {
      console.warn(`[SyncManager] Adapter not ready for workspace: ${workspaceId}`);
      return;
    }

    if (!adapter.push) {
      console.warn(`[SyncManager] Adapter does not support push: ${adapter.name}`);
      return;
    }

    try {
      console.log(`[SyncManager] Pushing file ${file.id} (${file.name}) to adapter ${adapter.name}`);
      await adapter.push(file, this.rxdbClient);
      // Adapter is responsible for marking file clean in RxDB
    } catch (err) {
      console.error(`[SyncManager] Error pushing file ${file.id}:`, err);
      throw err;
    }
  }

  /**
   * Manually trigger workspace sync from remote
   * Used when switching workspaces to overwrite local files with remote content
   */
  async pullWorkspace(workspaceId: string): Promise<void> {
    const adapter = this.adaptersByWorkspace.get(workspaceId);
    if (!adapter) {
      console.warn(`[SyncManager] No adapter for workspace: ${workspaceId}`);
      return;
    }

    if (!adapter.pullWorkspace) {
      console.log(
        `[SyncManager] Adapter ${adapter.name} does not support workspace pull`
      );
      return;
    }

    if (!adapter.isReady()) {
      console.warn(`[SyncManager] Adapter not ready for workspace pull: ${workspaceId}`);
      return;
    }

    try {
      this.statusSubject.next(SyncStatus.SYNCING);
      console.log(`[SyncManager] Pulling workspace ${workspaceId} from adapter ${adapter.name}`);
      await adapter.pullWorkspace(this.rxdbClient);
      this.statusSubject.next(SyncStatus.IDLE);
    } catch (err) {
      console.error(`[SyncManager] Error pulling workspace:`, err);
      this.statusSubject.next(SyncStatus.ERROR);
      throw err;
    }
  }

  /**
   * Shutdown manager and cleanup
   */
  async shutdown(): Promise<void> {
    // Destroy all adapters
    for (const [workspaceId] of this.adaptersByWorkspace) {
      await this.destroyForWorkspace(workspaceId);
    }

    // Unsubscribe from all observables
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];

    this.isRunning = false;
    this.statusSubject.next(SyncStatus.IDLE);
    console.log('[SyncManager] Shutdown complete');
  }
}

/**
 * Get the global SyncManager instance
 */
export function getSyncManager(): SyncManager {
  return SyncManager.getInstance();
}

/**
 * Initialize the sync manager with an RxDB client
 * Call this during app startup after RxDB is initialized
 */
export async function initializeSyncManager(rxdbClient: any): Promise<void> {
  const manager = getSyncManager();
  await manager.initialize(rxdbClient);
}

/**
 * Shutdown the sync manager
 * Call this during app cleanup
 */
export async function stopSyncManager(): Promise<void> {
  const manager = getSyncManager();
  await manager.shutdown();
}
