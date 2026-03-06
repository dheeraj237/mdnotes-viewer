/**
 * Browser Initialization Hook
 * Initializes RxDB cache and default workspace on app startup
 */

import { useEffect, useState } from 'react';
import { initializeFileOperations, loadSampleFilesFromFolder } from '@/core/cache/file-manager';
import { initializeSyncManager, getSyncManager } from '@/core/sync/sync-manager';
import { LocalAdapter } from '@/core/sync/adapters/local-adapter';
import { AdapterRegistry } from '@/core/sync/adapter-registry';
import type { AdapterConfig, AdapterInitContext } from '@/core/sync/adapter-types';
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

  // Register adapter factories with AdapterRegistry (Java-style singleton)
  const registry = AdapterRegistry.getInstance();

  // Factory for LocalAdapter - workspace-scoped instance
  registry.register('local', async (config: AdapterConfig, context?: Partial<AdapterInitContext>) => {
    const workspaceId = context?.workspaceId || '';
    const adapter = await LocalAdapter.create(workspaceId);
    // Don't call initialize() here - SyncManager will do it
    return adapter;
  });

  // TODO: Register GDrive and S3 factories when implementations are complete
  // registry.register('gdrive', async (config, context) => { ... })
  // registry.register('s3', async (config, context) => { ... })

  // Initialize SyncManager with new patterns
  // SyncManager will call initializeForWorkspace for the active workspace
  await initializeSyncManager();

  // After sync manager initialized, pull the active workspace to populate cache
  try {
    const active = useWorkspaceStore.getState().activeWorkspace?.();
    if (active && active.type !== WorkspaceType.Browser) {
      const manager = getSyncManager();
      await manager.initializeForWorkspace(active.id);
      await manager.pullWorkspace(active);
    }
  } catch (err) {
    console.warn('Failed to initialize adapter or pull active workspace during initializeApp:', err);
  }
}

export function useBrowserMode() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { createWorkspace, workspaces } = useWorkspaceStore();

  useEffect(() => {
    initializeApp().then(() => setIsInitialized(true)).catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to initialize file cache');
      console.error('File cache initialization error:', err);
    });
  }, []);

  return {
    isInitialized,
    error,
  };
}

/**
 * Get the global file cache (deprecated - use file-manager directly)
 */
export function getBrowserAdapter(workspaceId: string = 'default') {
  console.warn('getBrowserAdapter is deprecated - use file-manager from @/core/cache instead');
  return null;
}

export function getBrowserFileManager() {
  console.warn('getBrowserFileManager is deprecated - use file-manager from @/core/cache instead');
  return null;
}
