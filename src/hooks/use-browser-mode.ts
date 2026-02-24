/**
 * Browser Initialization Hook
 * Initializes browser files on app startup with File Manager V2
 */

import { useEffect, useState } from 'react';
import { BrowserAdapterV2 } from '@/core/file-manager-v2/adapters/browser-adapter';
import { FileManager } from '@/core/file-manager-v2/file-manager';

let browserAdapter: BrowserAdapterV2 | null = null;
let fileManager: FileManager | null = null;
export function useBrowserMode() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeBrowser = async () => {
      try {
        if (!browserAdapter) {
          browserAdapter = new BrowserAdapterV2();
          await browserAdapter.initialize();
          fileManager = new FileManager(browserAdapter);
        }
        setIsInitialized(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize browser adapter');
        console.error('Browser adapter initialization error:', err);
      }
    };

    initializeBrowser();
  }, []);

  return {
    isInitialized,
    error,
    adapter: browserAdapter,
    fileManager,
  };
}

export function getBrowserAdapter(workspaceId: string = 'default') {
  // Always create a new adapter with the specific workspace ID
  // This ensures each workspace has its own isolated adapter
  const adapter = new BrowserAdapterV2(workspaceId);
  adapter.initialize().catch(err => {
    console.error(`Failed to initialize browser adapter for workspace ${workspaceId}:`, err);
  });
  return adapter;
}

export function getBrowserFileManager() {
  if (!fileManager) {
    fileManager = new FileManager(getBrowserAdapter());
  }
  return fileManager;
}
