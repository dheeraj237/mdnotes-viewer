import { BehaviorSubject, Observable } from 'rxjs';
import { throttleTime, distinctUntilChanged } from 'rxjs/operators';
// Yjs disabled: CRDT merging turned off for now
import {
  getCacheDB,
  getCachedFile,
  markCachedFileAsSynced,
  subscribeToDirtyWorkspaceFiles,
  upsertCachedFile,
  loadFile,
  saveFile,
  // NEW FileNode API
  queryDirtyFiles,
  getFileNodeWithContent,
  saveFileNode,
  updateSyncStatus,
} from '../cache';
import type { ISyncAdapter as AdapterISyncAdapter } from './adapter-types';
import { MergeStrategy, NoOpMergeStrategy } from './merge-strategies';
import { defaultRetryPolicy } from './retry-policy';
import { v4 as uuidv4 } from 'uuid';
import { useWorkspaceStore } from '@/core/store/workspace-store';
import { WorkspaceType, FileType } from '@/core/cache/types';
import type { FileNode } from '@/shared/types';
import { toAdapterDescriptor } from './adapter-types';
import { pushCachedFile } from './adapter-bridge';
// NEW: FileNode Bridge for type conversions
import { fileNodeBridge } from './file-node-bridge';
import { adapterEntryToCachedFile } from './adapter-normalize';

// CRDT/Yjs handling removed from SyncManager. SyncManager now operates
// on plain file content strings. Adapters should accept/return string
// content. CRDT merging can be reintroduced later as a cache-layer
// responsibility and via adapter contracts.

/**
 * Sync adapter interface for pushing/pulling changes from remote sources
 * Adapters are only used for non-browser workspaces (local, gdrive, s3, etc.)
 * Browser workspaces have no sync adapter (purely local IndexedDB)
 * 
 * Implementations: LocalAdapter, GDriveAdapter, (future) S3Adapter
 */
export type ISyncAdapter = AdapterISyncAdapter;

export enum SyncStatus {
  IDLE = 'idle',
  SYNCING = 'syncing',
  ONLINE = 'online',
  OFFLINE = 'offline',
  ERROR = 'error'
}

export interface SyncStats {
  totalSynced: number;
  totalFailed: number;
  lastSyncTime: number;
  upcomingSyncFiles: string[];
}

/**
 * Central SyncManager orchestrates multi-adapter sync
 * Watches RxDB for dirty files, coordinates with adapters,
 * and applies remote content into the cache (CRDT merging disabled)
 */
export class SyncManager {
  private adapters: Map<string, ISyncAdapter> = new Map();
  private statusSubject = new BehaviorSubject<SyncStatus>(SyncStatus.IDLE);
  private statsSubject = new BehaviorSubject<SyncStats>({
    totalSynced: 0,
    totalFailed: 0,
    lastSyncTime: 0,
    upcomingSyncFiles: []
  });

  private mergeStrategy: MergeStrategy = new NoOpMergeStrategy();
  private remoteWatcherSubs: Map<string, any> = new Map();
  private isRunning = false;
  private maxRetries = 3;
  private retryDelays = [1000, 3000, 5000]; // exponential backoff: 1s, 3s, 5s
  private retryMap: Map<string, { attempts: number; timer: ReturnType<typeof setTimeout> | null }> = new Map();
  private cachedFilesSub: any = null;
  private workspaceSub: any = null;
  private activeWorkspaceId: string | null = null;
  private pullInterval: ReturnType<typeof setInterval> | null = null;
  private periodicPullIntervalMs = 60000; // 1 minute
  // Temporary safety switch: when false, skip pulling remote content after a successful push.
  // This hard-coded flag addresses the immediate issue where any file update triggered pulls
  // across all adapters/workspaces. Set to `true` to re-enable pull-after-push behavior.
  private pullAfterPush = false;

  constructor(private batchSize = 5) {}

  /**
   * Facade: request user to open a local directory (must be called from a user gesture).
   * Delegates to the registered `local` adapter if it supports `openDirectoryPicker`.
   */
  async requestOpenLocalDirectory(workspaceId?: string): Promise<void> {
    const adapter = this.adapters.get('local');
    if (!adapter) throw new Error('Local adapter not registered');
    const impl: any = adapter as any;
    if (typeof impl.openDirectoryPicker === 'function') {
      await impl.openDirectoryPicker(workspaceId);
      // If a workspace id was provided, attempt to populate cache from the adapter
      if (workspaceId) {
        try {
          await this.pullWorkspace({ id: workspaceId, type: WorkspaceType.Local });
        } catch (e) {
          // Non-fatal - UI should continue even if full pull fails
          console.warn('pullWorkspace after openLocalDirectory failed:', e);
        }
      }
      return;
    }
    throw new Error('Local adapter does not support directory picker');
  }

  /**
   * Facade: prompt for permission and restore a stored local directory handle.
   * Delegates to the local adapter if available.
   */
  async requestPermissionForLocalWorkspace(workspaceId: string): Promise<boolean> {
    const adapter = this.adapters.get('local');
    if (!adapter) return false;
    const impl: any = adapter as any;
    if (typeof impl.promptPermissionAndRestore === 'function') {
      const res = await impl.promptPermissionAndRestore(workspaceId);
      if (res && workspaceId) {
        try {
          await this.pullWorkspace({ id: workspaceId, type: WorkspaceType.Local });
        } catch (e) {
          console.warn('pullWorkspace after permission restore failed:', e);
        }
      }
      return !!res;
    }
    return false;
  }

  /**
   * Facade: pull a single file from the adapter into RxDB cache.
   * Adapter must implement `pull(fileId)` which returns string content.
   */
  async pullFileToCache(fileId: string, workspaceType: WorkspaceType | string, workspaceId?: string): Promise<void> {
    try {
      const adapterName = (String(workspaceType) === 'drive' || workspaceType === WorkspaceType.GDrive) ? 'gdrive' : String(workspaceType);
      const adapter = this.adapters.get(adapterName);
      if (!adapter || typeof (adapter as any).pull !== 'function') {
        throw new Error(`Adapter not available for ${adapterName}`);
      }
      const content = await (adapter as any).pull(fileId);
      if (typeof content === 'string') {
        // Normalize into cached file and upsert
        const normalized = adapterEntryToCachedFile({ fileId }, workspaceType as any, workspaceId);
        await upsertCachedFile({ ...normalized, dirty: false });
        await saveFile(normalized.path || fileId, content, workspaceType as any, undefined, workspaceId);
      }
    } catch (err) {
      console.warn('pullFileToCache failed:', err);
      throw err;
    }
  }

  /**
   * Enqueue a saved file for direct push processing (bypasses persistent queue).
   * This is intended to be called for saves originating from the active workspace
   * so that authorship is authoritative and pushes happen with minimal latency.
   */
  public async enqueueAndProcess(fileId: string, path: string, workspaceType: string, workspaceId?: string): Promise<void> {
    try {
      const cached = await getCachedFile(fileId, workspaceId);
      if (cached) {
        // Push directly to adapter without queue
        await this.pushDirtyFile(cached as FileNode);
      }
    } catch (err) {
      console.error('enqueueAndProcess error for', fileId, err);
    }
  }

  /**
   * Register a sync adapter (e.g., local, GDrive, browser storage)
   */
  registerAdapter(adapter: ISyncAdapter): void {
    this.adapters.set(adapter.name, adapter);
    console.log(`Registered sync adapter: ${adapter.name}`);
  }

  /**
   * Get a registered adapter by name
   */
  getAdapter(name: string): ISyncAdapter | undefined {
    return this.adapters.get(name);
  }

  /**
   * Start the sync manager (begins polling)
   */
  start(): void {
    if (this.isRunning) {
      console.warn('[SyncManager] Already running, skipping start');
      return;
    }

    this.isRunning = true;
    this.statusSubject.next(SyncStatus.IDLE);
    console.log('[SyncManager] ✓ Status set to IDLE');

    // Subscribe to active workspace changes and listen to dirty files for that workspace
    try {
      console.log('[SyncManager] Setting up workspace change subscription...');

      this.workspaceSub = (useWorkspaceStore.subscribe as any)(
        (s) => s.activeWorkspaceId,
        (newId: string | null) => {
          console.log(`[SyncManager] 📋 Workspace changed to: "${newId}"`);
          this.setupDirtyFilesSubscription(newId);
        }
      );

      // Initialize subscription with current active workspace
      const currentWorkspaceId = useWorkspaceStore.getState().activeWorkspaceId;
      console.log(`[SyncManager] Initializing with current workspace: "${currentWorkspaceId}"`);
      this.setupDirtyFilesSubscription(currentWorkspaceId);

      console.log('[SyncManager] ✓ Workspace subscription registered');
    } catch (err) {
      console.error('[SyncManager] ❌ Failed to subscribe to workspace changes:', err);
    }

    console.log('[SyncManager] ✅ SyncManager started successfully (isRunning=true)');
  }

  /**
   * Setup dirty files subscription for a specific workspace
   * Tears down previous subscription and creates a new one for the given workspace
   */
  private setupDirtyFilesSubscription(workspaceId: string | null): void {
    try {
      // Teardown previous dirty files subscription
      if (this.cachedFilesSub) {
        console.log('[SyncManager] Tearing down previous dirty files subscription...');
        try {
          if (typeof this.cachedFilesSub === 'function') {
            this.cachedFilesSub(); // Call the unsubscribe function
          } else if (typeof this.cachedFilesSub.unsubscribe === 'function') {
            this.cachedFilesSub.unsubscribe();
          }
        } catch (u) {
          console.warn('[SyncManager] Error during teardown:', u);
        }
        this.cachedFilesSub = null;
        console.log('[SyncManager] ✓ Previous subscription torn down');
      }

      this.activeWorkspaceId = workspaceId;

      // If there's no active workspace, don't subscribe to dirty files
      if (!workspaceId) {
        console.log('[SyncManager] No active workspace, skipping dirty file subscription');
        return;
      }

      // Subscribe ONLY to dirty files in the active workspace
      // Query-level filtering at RxDB prevents unnecessary processing
      console.log(`[SyncManager] 👁️ Subscribing to DIRTY files for workspace: "${workspaceId}"`);
      this.cachedFilesSub = subscribeToDirtyWorkspaceFiles(workspaceId, (dirtyFiles) => {
        console.log(`[SyncManager] 📊 Dirty files subscription fired: ${dirtyFiles.length} dirty file(s) in workspace "${workspaceId}"`);
        if (dirtyFiles.length > 0) {
          console.log(`[SyncManager] 📤 Queuing ${dirtyFiles.length} dirty file(s) for sync:`, dirtyFiles.map(f => `${f.id}(${f.path})`).join(', '));
          for (const f of dirtyFiles) {
            console.log(`[SyncManager]   → Pushing file: ${f.id} (path: ${f.path})`);
            this.pushDirtyFile(f as FileNode).catch((err) => {
              console.warn(`[SyncManager] ❌ Push failed for ${f.id}:`, err);
            });
          }
        }
      });
      console.log('[SyncManager] ✓ Dirty files subscription established (only active workspace, no filtering needed)');
    } catch (err) {
      console.error('[SyncManager] ❌ Failed to set up dirty file subscription:', err);
    }
  }

  /**
   * Stop the sync manager
   */
  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;

    // Clean up retry timers
    for (const [fileId, retry] of this.retryMap.entries()) {
      if (retry.timer) {
        clearTimeout(retry.timer);
      }
    }
    this.retryMap.clear();

    if (this.pullInterval) {
      clearInterval(this.pullInterval);
      this.pullInterval = null;
    }
    // Unsubscribe from dirty files subscription
    try {
      if (this.cachedFilesSub && typeof this.cachedFilesSub.unsubscribe === 'function') {
        this.cachedFilesSub.unsubscribe();
      } else if (this.cachedFilesSub && typeof this.cachedFilesSub === 'function') {
        this.cachedFilesSub();
      }
      // Unsubscribe from workspace store subscription
      if (this.workspaceSub && typeof this.workspaceSub === 'function') {
        try {
          this.workspaceSub();
        } catch (e) {
          // ignore
        }
      } else if (this.workspaceSub && typeof this.workspaceSub.unsubscribe === 'function') {
        try {
          this.workspaceSub.unsubscribe();
        } catch (e) {
          // ignore
        }
      }
    } catch (err) {
      console.warn('Error unsubscribing cachedFilesSub:', err);
    }

    this.statusSubject.next(SyncStatus.IDLE);
    console.log('SyncManager stopped');
  }

  /**
   * Observable for sync status changes
   */
  status$(): Observable<SyncStatus> {
    return this.statusSubject.asObservable();
  }

  /**
   * Observable for sync statistics
   */
  stats$(): Observable<SyncStats> {
    return this.statsSubject.asObservable().pipe(
      throttleTime(1000),
      distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr))
    );
  }

  /**
   * Manually trigger a sync cycle - finds all dirty files and pushes them
   */
  async syncNow(): Promise<void> {
    if (!this.isRunning) {
      console.warn('SyncManager not running');
      return;
    }

    this.statusSubject.next(SyncStatus.SYNCING);
    try {
      // Get all dirty files from active workspace
      const workspace = useWorkspaceStore.getState().activeWorkspace?.();
      if (!workspace) {
        this.statusSubject.next(SyncStatus.IDLE);
        return;
      }

      const dirtyFiles = await queryDirtyFiles(workspace.id);
      if (dirtyFiles.length === 0) {
        this.statusSubject.next(SyncStatus.ONLINE);
        return;
      }

      // Push all dirty files
      await Promise.allSettled(dirtyFiles.map((file) => this.pushDirtyFile(file as FileNode)));

      const stats = this.statsSubject.value;
      stats.lastSyncTime = Date.now();
      this.statsSubject.next(stats);
      this.statusSubject.next(SyncStatus.ONLINE);
    } catch (error) {
      console.error('Sync failed:', error);
      this.statusSubject.next(SyncStatus.ERROR);
    }
  }

  /**
   * Push a single dirty file to its adapter with in-memory retry backoff
   * - On success: mark file as synced (dirty = false)
   * - On failure: schedule retry with exponential backoff
   */
  private async pushDirtyFile(file: FileNode): Promise<void> {
    const { id: fileId } = file;

    try {
      // Skip browser workspaces (no sync needed)
      if (String(file.workspaceType) === WorkspaceType.Browser) {
        return;
      }

      // Skip if already synced
      if (!file.dirty) {
        return;
      }

      // Load the latest content from cache (RxDB) as a plain string
      const fileData = await loadFile(file.path, file.workspaceType as any, file.workspaceId);
      const content = fileData?.content ?? '';

      // Get the adapter for this file's workspace type
      const adapterName = (String(file.workspaceType) === 'drive' || file.workspaceType === WorkspaceType.GDrive) ? 'gdrive' : String(file.workspaceType);
      const targetAdapter = this.adapters.get(adapterName);

      if (!targetAdapter) {
        console.warn(`[SyncManager] No adapter registered for workspace type: ${file.workspaceType}`);
        return;
      }

      // Check adapter readiness (optional)
      const isReady = typeof (targetAdapter as any).isReady === 'function' ? (targetAdapter as any).isReady(file.workspaceId) : true;
      if (!isReady) {
        console.info(`[SyncManager] Adapter ${adapterName} not ready, will retry on next edit`);
        return;
      }

      // Try to push to adapter
      const descriptor = toAdapterDescriptor(file);
      const success = await targetAdapter.push(descriptor, content);

      if (success) {
      // Mark as synced (dirty = false)
        await markCachedFileAsSynced(fileId);

        // Clear any pending retry for this file
        const retry = this.retryMap.get(fileId);
        if (retry && retry.timer) {
          clearTimeout(retry.timer);
        }
        this.retryMap.delete(fileId);

        // Update stats
        const stats = this.statsSubject.value;
        stats.totalSynced++;
        this.statsSubject.next(stats);

        console.debug(`[SyncManager] Synced ${fileId} → ${adapterName}`);
      } else {
        // Push failed - schedule retry with backoff
        this.scheduleRetry(file as FileNode, adapterName);
      }
    } catch (error) {
      console.error(`[SyncManager] Push error for ${fileId}:`, error);

      // Schedule retry on error
      this.scheduleRetry(file as FileNode, 'unknown');

      const stats = this.statsSubject.value;
      stats.totalFailed++;
      this.statsSubject.next(stats);
    }
  }

  /**
   * Schedule a retry for a file push with exponential backoff
   */
  private scheduleRetry(file: FileNode, adapterName: string): void {
    const fileId = file.id;

    // Get or create retry record
    let retry = this.retryMap.get(fileId);
    if (!retry) {
      retry = { attempts: 0, timer: null };
      this.retryMap.set(fileId, retry);
    }

    // Increment attempts
    retry.attempts++;

    // Check if we've exceeded max retries
    if (retry.attempts >= this.maxRetries) {
      console.warn(`[SyncManager] Max retries (${this.maxRetries}) exceeded for ${fileId}`);
      this.retryMap.delete(fileId);
      return;
    }

    // Calculate delay for this attempt (1s, 3s, 5s)
    const delayMs = this.retryDelays[retry.attempts - 1] || this.retryDelays[this.retryDelays.length - 1];

    console.info(`[SyncManager] Retrying ${fileId} in ${delayMs}ms (attempt ${retry.attempts}/${this.maxRetries})`);

    // Cancel previous timer if any
    if (retry.timer) {
      clearTimeout(retry.timer);
    }

    // Schedule retry
    retry.timer = setTimeout(async () => {
      try {
        const latestFile = await getCachedFile(fileId, file.workspaceId);
        if (latestFile && latestFile.dirty) {
          console.log(`[SyncManager] Retrying push for ${fileId}`);
          await this.pushDirtyFile(latestFile as FileNode);
        }
      } catch (err) {
        console.error(`[SyncManager] Retry failed for ${fileId}:`, err);
      }
    }, delayMs);
  }

  /**
   * Sync a single file: push local, pull remote, merge if needed
   */
  /**
   * Merge remote content with local cache (CRDT merging currently disabled)
   * This method is a no-op; future CRDT behavior should be implemented in the cache layer.
   */
  private async mergeRemoteChanges(docId: string, remoteContent: string): Promise<void> {
    return Promise.resolve();
  }

  /**
   * Setup watchers for remote changes
   * Adapters can emit change notifications via their watch() observable
   */
  private setupRemoteWatchers(): void {
    for (const adapter of this.adapters.values()) {
      if (adapter.watch) {
        try {
          const watcher = adapter.watch();
          watcher.subscribe(
            (changedFileId) => {
              console.log(`Remote change detected in ${adapter.name}: ${changedFileId}`);
              // Trigger pull for this file
              this.pullFileFromAdapter(changedFileId, adapter).catch((error) => {
                console.error(`Failed to pull ${changedFileId} from ${adapter.name}:`, error);
              });
            },
            (error) => {
              console.error(`Watch error in ${adapter.name}:`, error);
            }
          );
        } catch (error) {
          console.warn(`Failed to setup watcher for ${adapter.name}:`, error);
        }
      }
    }
  }

  /**
   * Public API to pull an entire workspace's remote state and upsert into RxDB.
   * This is used during blocking workspace switches to ensure RxDB contains
   * the latest remote files before the UI renders the workspace.
   */
  async pullWorkspace(workspace: { id: string; type: WorkspaceType | string; path?: string }): Promise<void> {
    if (!workspace) return;

    const adapterName = (String(workspace.type) === 'drive' || workspace.type === WorkspaceType.GDrive) ? 'gdrive' : String(workspace.type);
    const adapter = this.adapters.get(adapterName);
    if (!adapter) {
      console.warn(`No adapter registered for workspace type: ${workspace.type}`);
      return;
    }

    this.statusSubject.next(SyncStatus.SYNCING);

    try {
      // If adapter provides an optimized workspace pull, use it
      if (typeof adapter.pullWorkspace === 'function') {
        const items = await adapter.pullWorkspace(workspace.id, workspace.path);
        for (const item of items || []) {
          try {
            // Adapter should return content string in `content`.
            const content = (item as any).content ?? '';
            const id = (item as any).fileId ?? (item as any).id ?? '';

            // Normalize minimal info into canonical cached file and upsert
            const normalized = adapterEntryToCachedFile({ fileId: id }, workspace.type as any, workspace.id);
            await upsertCachedFile({ ...normalized, dirty: false });
            // Don't mark files as dirty during initial workspace load
            await saveFile(normalized.path || id, content, workspace.type as any, undefined, workspace.id, { markDirty: false });
          } catch (err) {
            console.warn('Failed to upsert remote item during pullWorkspace:', err);
          }
        }
      } else if (typeof adapter.listWorkspaceFiles === 'function') {
        // Fall back to listing files and pulling each individually
        const list = await adapter.listWorkspaceFiles(workspace.id, workspace.path);
        for (const entry of list || []) {
          try {
            const remoteContent = await adapter.pull(entry.id);
            const normalized = adapterEntryToCachedFile(entry as any, workspace.type as any, workspace.id);
            await upsertCachedFile({ ...normalized, dirty: false });
            if (typeof remoteContent === 'string' && remoteContent.length > 0) {
              // Don't mark files as dirty during initial workspace load
              await saveFile(normalized.path || entry.path || entry.id, remoteContent, workspace.type as any, undefined, workspace.id, { markDirty: false });
            }
          } catch (err) {
            console.warn('Failed to pull remote file during pullWorkspace:', err);
          }
        }
      } else {
        // Adapter does not support workspace pulls; nothing to pull
        console.info(`Adapter ${adapter.name} does not support workspace pulls`);
      }

      this.statusSubject.next(SyncStatus.ONLINE);
    } catch (error) {
      // Non-fatal: adapter initialization or listing failures (e.g. local dir not provided)
      // should not throw and block workspace switching. Log a warning and continue.
      console.warn('pullWorkspace warning (non-fatal):', error);
      this.statusSubject.next(SyncStatus.OFFLINE);
      return;
    }
  }

  /**
   * Periodic pull scaffolding for future background pulls. Not enabled by default.
   */
  startPeriodicPulls(intervalMs?: number): void {
    const ms = intervalMs ?? this.periodicPullIntervalMs;
    if (this.pullInterval) return;
    this.pullInterval = setInterval(() => {
      this.performPull().catch((err) => console.error('Periodic pull failed:', err));
    }, ms);
  }

  stopPeriodicPulls(): void {
    if (this.pullInterval) {
      clearInterval(this.pullInterval);
      this.pullInterval = null;
    }
  }

  /**
   * Public helper to enable periodic pulls (opt-in).
   */
  enablePeriodicPull(ms?: number): void {
    this.startPeriodicPulls(ms);
  }

  private async performPull(): Promise<void> {
    // Placeholder: iterate through configured workspaces and call pullWorkspace
    // Future enhancement: discover active workspaces and only pull those
    try {
      const workspace = useWorkspaceStore.getState().activeWorkspace?.();
      if (workspace) {
        await this.pullWorkspace(workspace);
      }
    } catch (err) {
      console.warn('performPull error:', err);
    }
  }

  /**
   * Pull a specific file's changes from an adapter and merge
   */
  private async pullFileFromAdapter(fileId: string, adapter: ISyncAdapter): Promise<void> {
    try {
      const workspace = useWorkspaceStore.getState().activeWorkspace?.();
      const workspaceId = workspace?.id;

      const file = await getCachedFile(fileId, workspaceId);
      if (!file) return;

      const remoteContent = await adapter.pull(fileId);
      if (typeof remoteContent === 'string' && remoteContent.length > 0) {
        // Delegate to merge strategy instead of blind overwrite
        await this.mergeStrategy.handlePull(file, remoteContent);
      }
    } catch (error) {
      console.error(`pullFileFromAdapter error:`, error);
    }
  }

  // ==================== NEW FileNode-Based Sync Methods ====================
  /**
   * Pull changes from adapter using FileNode API
   * Converts adapter entries to FileNode and persists to RxDB
   * @param adapter Sync adapter to pull from
   * @param workspaceId Target workspace ID
   */
  async pullFromAdapterWithFileNode(
    adapter: ISyncAdapter,
    workspaceId: string
  ): Promise<void> {
    try {
      // Get adapter entries (if listWorkspaceFiles exists)
      const adapterImpl = adapter as any;
      if (!adapterImpl.listWorkspaceFiles) {
        console.warn(`[SyncManager] Adapter ${adapter.name} does not support listWorkspaceFiles`);
        return;
      }

      const entries = await adapterImpl.listWorkspaceFiles(workspaceId);
      if (!entries || entries.length === 0) {
        console.info(`[SyncManager] No files to pull from ${adapter.name}`);
        return;
      }

      // Convert adapter entries to FileNode
      const fileNodes = fileNodeBridge.adapterResponseToFileNode(
        entries,
        adapter.name as any,
        workspaceId
      );

      // Persist to RxDB
      for (const fileNode of fileNodes) {
        try {
          await saveFileNode(fileNode);
        } catch (e) {
          console.warn(`[SyncManager] Failed to save FileNode ${fileNode.id}`, e);
        }
      }

      console.info(`[SyncManager] Pulled ${fileNodes.length} files from ${adapter.name} for workspace ${workspaceId}`);
    } catch (e) {
      console.error(`[SyncManager] pullFromAdapterWithFileNode failed:`, e);
    }
  }

  /**
   * Push dirty files to adapter using FileNode API
   * Converts dirty FileNodes to adapter descriptors and pushes
   * @param adapter S adapter to push to
   * @param workspaceId Target workspace ID
   */
  async pushToAdapterWithFileNode(
    adapter: ISyncAdapter,
    workspaceId: string
  ): Promise<void> {
    try {
      // Get all dirty files for this workspace
      const dirtyFiles = await queryDirtyFiles(workspaceId);
      if (dirtyFiles.length === 0) {
        console.info(`[SyncManager] No dirty files to push for workspace ${workspaceId}`);
        return;
      }

      // Load content for files if needed
      const filesWithContent = await Promise.all(
        dirtyFiles.map(async (file) => {
          if (file.type === FileType.File && !file.content) {
            return getFileNodeWithContent(file.id) || file;
          }
          return file;
        })
      );

      // Convert to adapter descriptors
      const descriptors = fileNodeBridge.fileNodeToAdapterDescriptor(
        filesWithContent,
        adapter.name as any
      );

      // Push to adapter
      const adapterImpl = adapter as any;
      if (adapterImpl.pushChanges && typeof adapterImpl.pushChanges === 'function') {
        await adapterImpl.pushChanges(descriptors);
      } else {
        console.warn(`[SyncManager] Adapter ${adapter.name} does not support pushChanges`);
        return;
      }

      // Mark files as synced
      for (const file of dirtyFiles) {
        try {
          await updateSyncStatus(file.id, 'idle', (file.version ?? 0) + 1);
        } catch (e) {
          console.warn(`[SyncManager] Failed to update sync status for ${file.id}`, e);
        }
      }

      console.info(`[SyncManager] Pushed ${dirtyFiles.length} files to ${adapter.name} for workspace ${workspaceId}`);
    } catch (e) {
      console.error(`[SyncManager] pushToAdapterWithFileNode failed:`, e);
    }
  }
}

// Singleton instance
let syncManagerInstance: SyncManager | null = null;

/**
 * Get or create the global SyncManager instance
 */
export function getSyncManager(): SyncManager {
  if (!syncManagerInstance) {
    syncManagerInstance = new SyncManager();
  }
  return syncManagerInstance;
}

/**
 * Initialize and start the SyncManager
 */
/**
 * Initialize and start the SyncManager with direct subscription-driven sync
 * Removes persistent queue complexity in favor of simple in-memory retry with backoff
 */
export async function initializeSyncManager(adapters: ISyncAdapter[]): Promise<SyncManager> {
  const manager = getSyncManager();
  for (const adapter of adapters) {
    manager.registerAdapter(adapter);
  }
  // Attempt to auto-initialize local adapter from persisted directory handle for the active workspace.
  try {
    const active = useWorkspaceStore.getState().activeWorkspace?.();
    if (active && active.type === WorkspaceType.Local) {
      const localAdapter = manager.getAdapter('local') as any;
      if (localAdapter && typeof localAdapter.initialize === 'function') {
        try {
          // Ensure RxDB is available for handle metadata helpers and attempt to restore
          // the persisted handle via `workspace-manager` which will also upsert RxDB metadata.
          const { initializeRxDB } = await import('@/core/cache/file-manager');
          const { restoreDirectoryHandle } = await import('@/core/cache/workspace-manager');
          try { await initializeRxDB(); } catch (e) { /* best-effort */ }
          const handle = await restoreDirectoryHandle(active.id);
          if (handle) {
            await localAdapter.initialize(handle);
          }
        } catch (e) {
          // Non-fatal: log and continue. UI/gesture based flows will prompt when needed.
          console.warn('Failed to auto-initialize local adapter from stored handle:', e);
        }
      }
    }
  } catch (e) {
    // ignore errors during best-effort adapter restore
  }
  manager.start();
  return manager;
}

/**
 * Cleanup: stop the SyncManager
 */
export function stopSyncManager(): void {
  if (syncManagerInstance) {
    syncManagerInstance.stop();
  }
}
