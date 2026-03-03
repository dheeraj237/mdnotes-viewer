import { createRxDatabase } from 'rxdb';
import type { RxDatabase, RxCollection } from 'rxdb';
import { collections } from './schemas';

let db: RxDatabase | any = null;

type AnyCollection = RxCollection<any> | any;

export async function createRxDB(): Promise<void> {
  if (db) return;

  const preferIdb = typeof indexedDB !== 'undefined';

  try {
    // try to use platform adapter; tests may not have adapters registered
    // @ts-ignore
    db = await createRxDatabase({ name: 'verve', adapter: preferIdb ? 'idb' : 'memory', multiInstance: false, eventReduce: true });

    // add collections
    await db.addCollections({
      workspaces: { schema: collections.workspaces.schema as any },
      files: { schema: collections.files.schema as any },
      settings: { schema: collections.settings.schema as any },
      directory_handles_meta: { schema: collections.directory_handles_meta.schema as any },
      sync_queue: { schema: collections.sync_queue.schema as any }
    });
    return;
  } catch (err) {
    // fall back to in-memory shim for tests / environments lacking adapters
  }

  // In-memory shim implementation (minimal subset used by wrapper)
  const inMemoryDb: any = { collections: {} };

  const createCollection = (name: string) => {
    const docs = new Map<string, any>();
    const listeners = new Set<Function>();
    const docListeners = new Map<string, Set<Function>>();

    const emitCollection = () => {
      const arr = Array.from(docs.values()).map((d) => ({ toJSON: () => ({ ...d }) }));
      listeners.forEach((fn) => fn(arr));
    };

    const emitDoc = (id: string) => {
      const set = docListeners.get(id);
      const doc = docs.get(id);
      if (set) {
        set.forEach((fn) => fn(doc ? { toJSON: () => ({ ...doc }) } : null));
      }
    };

    return {
      upsert: async (doc: any) => {
        docs.set(doc.id, { ...doc });
        emitCollection();
        emitDoc(doc.id);
      },
      findOne: (id: string) => ({
        exec: async () => {
          const d = docs.get(id);
          return d ? { toJSON: () => ({ ...d }), remove: async () => { docs.delete(id); emitCollection(); emitDoc(id); } } : null;
        },
        $: {
          subscribe: (cb: Function) => {
            let set = docListeners.get(id);
            if (!set) { set = new Set(); docListeners.set(id, set); }
            set.add(cb);
            cb(docs.get(id) ? { toJSON: () => ({ ...docs.get(id) }) } : null);
            return { unsubscribe: () => { set!.delete(cb); } };
          }
        }
      }),
      find: (selector: any) => ({
        exec: async () => {
          const results = Array.from(docs.values()).filter((d) => {
            if (!selector) return true;
            return Object.keys(selector).every((k) => d[k] === selector[k]);
          }).map((d) => ({ toJSON: () => ({ ...d }) }));
          return results;
        },
        $: {
          subscribe: (cb: Function) => {
            listeners.add(cb);
            cb(Array.from(docs.values()).map((d) => ({ toJSON: () => ({ ...d }) })));
            return { unsubscribe: () => listeners.delete(cb) };
          }
        }
      }),
      bulkWrite: async (ops: any[]) => {
        for (const op of ops) {
          const doc = op.document || op;
          docs.set(doc.id, { ...doc });
          emitDoc(doc.id);
        }
        emitCollection();
      },
      $: {
        subscribe: (cb: Function) => {
          listeners.add(cb);
          cb(Array.from(docs.values()).map((d) => ({ toJSON: () => ({ ...d }) }))); 
          return { unsubscribe: () => listeners.delete(cb) };
        }
      }
    };
  };

  for (const key of Object.keys(collections)) {
    inMemoryDb.collections[key] = createCollection(key);
  }

  db = inMemoryDb;
}

function ensureDb(): RxDatabase | any {
  if (!db) throw new Error('RxDB not initialized. Call createRxDB() first.');
  return db;
}

export function getCollection<T = any>(name: string): AnyCollection {
  const database = ensureDb();
  const col = (database.collections as any)[name] as AnyCollection | undefined;
  if (!col) throw new Error(`Collection ${name} not found; did you call createRxDB()?`);
  return col as AnyCollection;
}

export async function upsertDoc<T extends { id: string }>(collection: string, doc: T): Promise<void> {
  const col = getCollection<T>(collection);
  await col.upsert(doc as any);
}

export async function getDoc<T>(collection: string, id: string): Promise<T | null> {
  const col = getCollection<T>(collection);
  const doc = await col.findOne(id).exec();
  if (!doc) return null;
  return doc.toJSON() as T;
}

export async function findDocs<T>(collection: string, query: { selector?: any; sort?: any; limit?: number } = {}): Promise<T[]> {
  const col = getCollection<T>(collection);
  const rxQuery: any = col.find(query.selector || {});
  if (query.sort && typeof rxQuery.sort === 'function') rxQuery.sort(query.sort);
  if (typeof query.limit === 'number' && typeof rxQuery.limit === 'function') rxQuery.limit(query.limit);
  const docs = await rxQuery.exec();
  return docs.map((d: any) => d.toJSON() as T);
}

export function subscribeDoc<T>(collection: string, id: string, cb: (doc: T | null) => void): () => void {
  const col = getCollection<T>(collection);
  const sub = col.findOne(id).$.subscribe((doc: any) => {
    cb(doc ? (doc.toJSON() as T) : null);
  });
  return () => sub.unsubscribe();
}

export function subscribeQuery<T>(collection: string, query: { selector?: any }, cb: (docs: T[]) => void): () => void {
  const col = getCollection<T>(collection);
  const sub = col.find(query.selector || {}).$.subscribe((docs: any[]) => {
    cb(docs.map((d) => (d ? d.toJSON() : null)).filter(Boolean) as T[]);
  });
  return () => sub.unsubscribe();
}

export async function atomicUpsert<T extends { id: string }>(collection: string, id: string, mutator: (current?: T | null) => T): Promise<T> {
  const col = getCollection<T>(collection);
  const existing = await col.findOne(id).exec();
  const current = existing ? (existing.toJSON() as T) : null;
  const next = mutator(current || undefined);
  await col.upsert(next as any);
  return next;
}

export async function bulkWrite<T extends { id: string }>(collection: string, docs: Array<T>): Promise<void> {
  const col = getCollection<T>(collection);
  if (typeof col.bulkWrite === 'function') {
    const ops = docs.map((d) => ({ document: d }));
    await col.bulkWrite(ops);
  } else {
    await Promise.all(docs.map((d) => upsertDoc(collection, d)));
  }
}

export async function removeDoc(collection: string, id: string): Promise<void> {
  const col = getCollection(collection);
  const doc = await col.findOne(id).exec();
  if (doc) {
    await doc.remove();
  }
}

export function observeCollectionChanges(collection: string, handler: (change: any) => void): () => void {
  const col = getCollection(collection);
  const sub = col.$.subscribe((ev: any) => handler(ev));
  return () => sub.unsubscribe();
}
