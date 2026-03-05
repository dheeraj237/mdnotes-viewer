/**
 * Deployment Version Manager
 * 
 * Detects new app deployments and automatically wipes IndexedDB cache
 * to prevent stale data issues after version updates.
 * 
 * The app version is automatically extracted from package.json and injected
 * at build time via Vite's define plugin. When package.json version changes,
 * all IndexedDB databases are automatically wiped on app startup.
 */

const STORAGE_KEY = '__verve_deployment_version';

/**
 * Get the current app version from package.json (injected at build time)
 */
function getCurrentVersion(): string {
  // Version is injected from package.json during build via Vite's define plugin
  const envVersion = (import.meta.env as any).VITE_APP_VERSION;
  if (envVersion) return envVersion;
  
  // Fallback should never happen in normal operation
  return '0.0.0';
}

/**
 * Get the previously stored deployment version from localStorage
 */
function getStoredVersion(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    console.warn('[deploymentVersionManager] Failed to read stored version:', e);
    return null;
  }
}

/**
 * Update the stored deployment version in localStorage
 */
function setStoredVersion(version: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, version);
  } catch (e) {
    console.warn('[deploymentVersionManager] Failed to store version:', e);
  }
}

/**
 * Delete all IndexedDB databases
 * Used when a new deployment is detected
 */
export async function deleteAllIndexedDBs(): Promise<void> {
  if (typeof indexedDB === 'undefined') {
    console.warn('[deploymentVersionManager] indexedDB not available, skipping wipe');
    return;
  }

  try {
    // Get list of all IDB database names
    const dbs = await (indexedDB as any).databases?.();
    if (!dbs || !Array.isArray(dbs)) {
      console.warn('[deploymentVersionManager] Unable to enumerate IndexedDB databases');
      return;
    }

    // Delete each database
    for (const dbInfo of dbs) {
      const dbName = dbInfo.name;
      if (!dbName) continue;

      try {
        await new Promise<void>((resolve, reject) => {
          const deleteReq = indexedDB.deleteDatabase(dbName);
          deleteReq.onsuccess = () => {
            console.log(`[deploymentVersionManager] Deleted IndexedDB: ${dbName}`);
            resolve();
          };
          deleteReq.onerror = () => {
            console.warn(`[deploymentVersionManager] Failed to delete IndexedDB: ${dbName}`);
            resolve(); // Continue even on error
          };
          deleteReq.onblocked = () => {
            console.warn(`[deploymentVersionManager] IndexedDB delete blocked: ${dbName}`);
            resolve(); // Continue even if blocked
          };
        });
      } catch (dbErr) {
        console.warn(`[deploymentVersionManager] Error deleting ${dbName}:`, dbErr);
        // Continue to next database
      }
    }
  } catch (error) {
    console.warn('[deploymentVersionManager] Error deleting IndexedDBs:', error);
  }
}

/**
 * Check deployment version and wipe IndexedDB if a new version is detected
 * Call this BEFORE initializing RxDB
 */
export async function checkAndHandleDeployment(): Promise<boolean> {
  const currentVersion = getCurrentVersion();
  const storedVersion = getStoredVersion();

  // No previous version - first load
  if (!storedVersion) {
    console.log(`[deploymentVersionManager] First load, version=${currentVersion}`);
    setStoredVersion(currentVersion);
    return false; // No wipe needed
  }

  // Same version - no new deployment
  if (currentVersion === storedVersion) {
    return false; // No wipe needed
  }

  // New deployment detected!
  console.warn(
    `[deploymentVersionManager] New deployment detected: ${storedVersion} → ${currentVersion}`,
  );

  try {
    await deleteAllIndexedDBs();
    console.log('[deploymentVersionManager] IndexedDB wipe complete');
  } catch (error) {
    console.error('[deploymentVersionManager] Error wiping IndexedDB:', error);
    // Continue anyway - the app can work with potentially stale data
    // better than crashing during initialization
  }

  setStoredVersion(currentVersion);
  return true; // Wipe occurred
}
