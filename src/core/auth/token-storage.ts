const DB_NAME = 'verve-auth-store';
const DB_VERSION = 1;
const STORE_NAME = 'tokens';

interface TokenRecord {
  key: string;
  token: string;
  expiresAt: number;
}

let db: IDBDatabase | null = null;

async function initDB(): Promise<IDBDatabase> {
  if (db) return db;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(new Error('Failed to open auth DB'));
    req.onsuccess = () => { db = req.result; resolve(db); };
    req.onupgradeneeded = (ev) => {
      const database = (ev.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
  });
}

export async function storeToken(key: string, token: string, expiresAt: number): Promise<void> {
  try {
    const database = await initDB();
    return new Promise((resolve, reject) => {
      const tx = database.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const rec: TokenRecord = { key, token, expiresAt };
      const req = store.put(rec);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(new Error('Failed to store token'));
    });
  } catch (e) {
    console.warn('storeToken failed', e);
  }
}

export async function getTokenRecord(key: string): Promise<TokenRecord | null> {
  try {
    const database = await initDB();
    return new Promise((resolve, reject) => {
      const tx = database.transaction([STORE_NAME], 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(new Error('Failed to get token'));
    });
  } catch (e) {
    console.warn('getTokenRecord failed', e);
    return null;
  }
}

export async function removeToken(key: string): Promise<void> {
  try {
    const database = await initDB();
    return new Promise((resolve, reject) => {
      const tx = database.transaction([STORE_NAME], 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(new Error('Failed to remove token'));
    });
  } catch (e) {
    console.warn('removeToken failed', e);
  }
}

export default { initDB, storeToken, getTokenRecord, removeToken };
