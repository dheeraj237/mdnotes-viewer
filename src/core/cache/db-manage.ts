// Simple key-value store for storing blobs (FileSystemDirectoryHandle) by workspace id.
// Uses IndexedDB directly to avoid extra dependencies.

const DB_NAME = 'verve-kv-store';
const STORE_NAME = 'kv';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = (ev) => {
        const db = (ev.target as any).result as IDBDatabase;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      };
      req.onsuccess = () => resolve(req.result as IDBDatabase);
      req.onerror = () => reject(req.error);
    } catch (err) {
      reject(err);
    }
  });
}

export async function storeHandle(workspaceId: string, value: any): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(value, workspaceId);
      req.onsuccess = () => { resolve(); db.close(); };
      req.onerror = () => { reject(req.error); db.close(); };
    });
  } catch (err) {
    // Best-effort; non-fatal
    console.warn('db-manage.storeHandle failed:', err);
  }
}

export async function getHandle(workspaceId: string): Promise<any | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(workspaceId);
      req.onsuccess = () => { resolve(req.result ?? null); db.close(); };
      req.onerror = () => { reject(req.error); db.close(); };
    });
  } catch (err) {
    console.warn('db-manage.getHandle failed:', err);
    return null;
  }
}

export async function removeHandle(workspaceId: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(workspaceId);
      req.onsuccess = () => { resolve(); db.close(); };
      req.onerror = () => { reject(req.error); db.close(); };
    });
  } catch (err) {
    console.warn('db-manage.removeHandle failed:', err);
  }
}

export async function listHandles(): Promise<string[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAllKeys();
      req.onsuccess = () => { resolve((req.result as any[]) || []); db.close(); };
      req.onerror = () => { reject(req.error); db.close(); };
    });
  } catch (err) {
    console.warn('db-manage.listHandles failed:', err);
    return [];
  }
}

export default {
  storeHandle,
  getHandle,
  removeHandle,
  listHandles,
};
