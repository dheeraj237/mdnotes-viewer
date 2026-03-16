/**
 * HandleStore — vanilla IndexedDB storage for FileSystemDirectoryHandle objects.
 *
 * Why NOT Dexie/RxDB: Dexie's internal pipeline can attempt JSON normalization
 * during replication/sync that corrupts structured-clone objects. A dedicated
 * raw IndexedDB database keeps handle storage completely isolated from the
 * app's RxDB/Dexie databases, preventing accidental schema-migration wipes.
 *
 * Note on Chrome 86+ behaviour: FileSystemDirectoryHandle objects correctly
 * survive structured clone (the Chrome 84 bug is long fixed). Handles stored
 * here retain all their methods after retrieval.
 */

import {
  pickDirectory,
  verifyPermission,
  hasPermission,
  isFileSystemAccessSupported,
} from './directory-picker';

const DB_NAME = 'verve-handles';
const STORE_NAME = 'handles';
const DB_VERSION = 1;

function isAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        // No keyPath — we pass the workspaceId as the explicit key on put/get.
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

/**
 * Retrieve a stored FileSystemDirectoryHandle for the given workspace.
 * Returns null if no handle exists or if IndexedDB is unavailable (SSR).
 */
export async function getHandle(
  workspaceId: string
): Promise<FileSystemDirectoryHandle | null> {
  if (!isAvailable()) return null;

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(workspaceId);

    request.onsuccess = () => {
      db.close();
      resolve((request.result as FileSystemDirectoryHandle) ?? null);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

/**
 * Persist a FileSystemDirectoryHandle for the given workspace.
 * Uses the structured-clone path, which preserves all handle methods.
 */
export async function setHandle(
  workspaceId: string,
  handle: FileSystemDirectoryHandle
): Promise<void> {
  if (!isAvailable()) return;

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(handle, workspaceId);

    request.onsuccess = () => {
      db.close();
      resolve();
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

/**
 * Remove the stored handle for a workspace (e.g. on workspace deletion).
 */
export async function removeHandle(workspaceId: string): Promise<void> {
  if (!isAvailable()) return;

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(workspaceId);

    request.onsuccess = () => {
      db.close();
      resolve();
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

// ---------------------------------------------------------------------------
// Re-export simplified directory picker functions
// MUST be called from UI components with user gestures
// ---------------------------------------------------------------------------

/**
 * Check if File System Access API is supported.
 * Use this in UI to show/hide local workspace options.
 */
export { isFileSystemAccessSupported };

/**
 * Opens the native directory picker to get a directory handle.
 * MUST be called from a user gesture (button click, etc.)
 * 
 * @returns FileSystemDirectoryHandle if successful, null if user cancelled
 */
export { pickDirectory as openDirectoryPicker };

/**
 * Verify permission is granted, requesting if necessary.
 * MUST be called from a user gesture.
 * 
 * @param handle - Directory handle to verify
 * @param needWrite - True to verify write permission (default: true)
 * @returns True if permission is granted
 */
export { verifyPermission as verifyAndRequestPermission };

/**
 * Check if we have permission WITHOUT requesting it.
 * Safe to call without user gesture.
 * 
 * @param handle - Directory handle to check
 * @param needWrite - True to check write permission (default: true)
 * @returns True if permission is granted
 */
export { hasPermission as checkPermission };
