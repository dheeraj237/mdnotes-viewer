/**
 * Browser Initialization Hook
 * Initializes RxDB cache and default workspace on app startup
 */

import { useEffect, useState } from 'react';
import { initializeFileOperations, loadSampleFilesFromFolder } from '@/core/cache/file-operations';
import { useWorkspaceStore } from '@/core/store/workspace-store';

export function useBrowserMode() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { createWorkspace, workspaces } = useWorkspaceStore();

  useEffect(() => {
    const initializeCache = async () => {
      try {
        // Initialize RxDB cache as single source of truth
        await initializeFileOperations();

        // Create default workspace if it doesn't exist
        const verveStore = useWorkspaceStore.getState();
        const hasVerveWorkspace = verveStore.workspaces.some(ws => ws.id === 'verve-samples');
        
        if (!hasVerveWorkspace) {
          console.log('[BrowserMode] Creating default "Verve Samples" workspace...');
          verveStore.createWorkspace('Verve Samples', 'browser', { id: 'verve-samples' });
          
          // Load sample files into the new workspace
          console.log('[BrowserMode] Loading sample files...');
          await loadSampleFilesFromFolder();
          console.log('[BrowserMode] Sample files loaded');
        }

        setIsInitialized(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize file cache');
        console.error('File cache initialization error:', err);
      }
    };

    initializeCache();
  }, []);

  return {
    isInitialized,
    error,
  };
}

/**
 * Get the global file cache (deprecated - use file-operations directly)
 */
export function getBrowserAdapter(workspaceId: string = 'default') {
  console.warn('getBrowserAdapter is deprecated - use file-operations from @/core/cache instead');
  return null;
}

export function getBrowserFileManager() {
  console.warn('getBrowserFileManager is deprecated - use file-operations from @/core/cache instead');
  return null;
}
