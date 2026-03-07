/**
 * Browser Initialization Hook
 * Initializes RxDB cache and default workspace on app startup
 */

import { useEffect, useState } from 'react';
import { initializeFileOperations, loadSampleFilesFromFolder, getCacheDB } from '@/core/cache/file-manager';
import { initializeSyncManager, getSyncManager } from '@/core/sync';
import { LocalAdapter } from '@/core/sync/adapters/local';
import { DummyAdapter } from '@/core/sync/adapters/dummy';
import { AdapterRegistry } from '@/core/sync/adapter-registry';
import { useWorkspaceStore } from '@/core/store/workspace-store';
import { WorkspaceType } from '@/core/cache/types';
import { checkAndHandleDeployment } from '@/core/init/deployment-version-manager';

// Exported for testing: performs app initialization and pulls active workspace
export async function initializeApp(adapters?: any[]) {
  // Check for new deployment and wipe IndexedDB if needed BEFORE initializing RxDB
  const deploymentOccurred = await checkAndHandleDeployment();

  if (deploymentOccurred) {
    console.log('[initializeApp] New deployment detected - IndexedDB was cleared');
  }

  // Initialize RxDB cache as single source of truth
  await initializeFileOperations();

  // Create default workspace only when there are no existing workspaces
  const verveStore = useWorkspaceStore.getState();
  // Ensure the `verve-samples` browser workspace exists and is populated.
  const hasSamples = verveStore.workspaces && verveStore.workspaces.find(w => w.id === 'verve-samples');
  if (!hasSamples) {
    verveStore.createWorkspace('Verve Samples', WorkspaceType.Browser, { id: 'verve-samples' });
    // Ensure store state contains the sample workspace immediately (defensive against rehydration timing)
    useWorkspaceStore.setState((s) => {
      const exists = s.workspaces && s.workspaces.find(w => w.id === 'verve-samples');
      if (exists) return s;
      const ws = {
        id: 'verve-samples',
        name: 'Verve Samples',
        type: WorkspaceType.Browser,
        createdAt: new Date().toISOString(),
        lastAccessed: new Date().toISOString(),
      } as any;
      return { workspaces: [...(s.workspaces || []), ws], activeWorkspaceId: 'verve-samples' } as any;
    });
    await loadSampleFilesFromFolder();
  }

  // Register adapter factories with AdapterRegistry
  const registry = AdapterRegistry.getInstance();

  // Register DummyAdapter for browser-only workspaces
  registry.register('browser', async () => new DummyAdapter());

  // Register LocalAdapter for local file system workspaces
  registry.register('local', async () => new LocalAdapter());

  // TODO: Register GDrive and S3 adapters when implementations are complete
  // registry.register('gdrive', async () => new GDriveAdapter());
  // registry.register('s3', async () => new S3Adapter());

  // Get RxDB client and initialize SyncManager
  const rxdbClient = getCacheDB();
  if (!rxdbClient) {
    throw new Error('RxDB client not initialized');
  }

  await initializeSyncManager(rxdbClient);

  // After sync manager initialized, set up active workspace adapter and pull if needed
  try {
    const active = useWorkspaceStore.getState().activeWorkspace?.();
    if (active) {
      const manager = getSyncManager();
      // Try to fetch any stored directory handle for this workspace so the
      // LocalAdapter can be initialized with it.
      let dirHandle: any = null;
      try {
        const mod = await import('@/core/cache/db-manage');
        if (mod && typeof mod.getHandle === 'function') {
          dirHandle = await mod.getHandle(active.id);
        }
      } catch (e) {
        // ignore - best-effort
      }

      await manager.initializeForWorkspace(active.id, active.type, dirHandle);

      // If workspace is remote type, sync files from source
      if (active.type === WorkspaceType.Local) {
        await manager.pullWorkspace(active.id);
      }
    }
  } catch (err) {
    console.warn('Failed to initialize adapter or pull active workspace during initializeApp:', err);
  }
}

export function useBrowserMode() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initializeApp()
      .then(() => setIsInitialized(true))
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to initialize app');
        console.error('App initialization error:', err);
      });
  }, []);

  return {
    isInitialized,
    error,
  };
}
