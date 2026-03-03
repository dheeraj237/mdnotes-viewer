import * as client from '@/core/rxdb/rxdb-client';
import type { FileDoc } from '@/core/rxdb/schemas';

export async function initializeRxDB(): Promise<void> {
  await client.createRxDB();
}

export function getCacheDB(): any {
  // Provide a minimal compatibility wrapper exposing `cached_files` and `sync_queue`
  const filesCol = client.getCollection('files');
  const queueCol = client.getCollection('sync_queue');

  const wrap = (col: any) => ({
    find: (selector?: any) => {
      const base = {
        exec: async () => {
          return (await col.find(selector || {}).exec()) as any[];
        },
        $: (col.find(selector || {}).$) as any,
        where: (field: string) => ({
          eq: (val: any) => ({ exec: async () => {
            const docs = await col.find(selector || {}).exec();
            return docs.filter((d: any) => d[field] === val);
          } })
        })
      } as any;
      return base;
    },
    findOne: (arg: any) => col.findOne(arg),
    upsert: async (doc: any) => { await col.upsert(doc); },
    remove: async (arg: any) => { const d = await col.findOne(arg).exec(); if (d && d.remove) await d.remove(); }
  });

  return {
    cached_files: wrap(filesCol),
    sync_queue: wrap(queueCol),
  } as any;
}

export async function closeCacheDB(): Promise<void> {
  // noop for now; client has no explicit close
}

export async function upsertCachedFile(doc: FileDoc): Promise<void> {
  await client.upsertDoc<FileDoc>('files', doc);
}

export async function getCachedFile(idOrPath: string, workspaceId?: string): Promise<FileDoc | null> {
  // Try by id first
  const byId = await client.getDoc<FileDoc>('files', idOrPath);
  if (byId && (!workspaceId || byId.workspaceId === workspaceId)) return byId;

  // Try path variants
  const variants = [idOrPath];
  if (idOrPath && !idOrPath.startsWith('/')) variants.push(`/${idOrPath}`);
  if (idOrPath && idOrPath.startsWith('/')) variants.push(idOrPath.replace(/^\//, ''));

  const all = await client.findDocs<FileDoc>('files', { selector: {} });
  for (const p of variants) {
    const found = all.find(d => d.path === p && (!workspaceId || d.workspaceId === workspaceId));
    if (found) return found;
  }
  return null;
}

export async function getAllCachedFiles(pathPrefix?: string): Promise<FileDoc[]> {
  if (!pathPrefix) return client.findDocs<FileDoc>('files', {});
  const docs = await client.findDocs<FileDoc>('files', { selector: { path: pathPrefix } });
  return docs;
}

export function observeCachedFiles(cb: (docs: FileDoc[]) => void): { unsubscribe(): void } {
  const unsub = client.subscribeQuery<FileDoc>('files', {}, cb as any);
  return { unsubscribe: unsub } as any;
}

export async function getDirtyCachedFiles(): Promise<FileDoc[]> {
  return client.findDocs<FileDoc>('files', { selector: { dirty: true } });
}

export async function markCachedFileAsSynced(id: string): Promise<void> {
  const doc = await client.getDoc<FileDoc>('files', id);
  if (doc) {
    await client.upsertDoc<FileDoc>('files', { ...doc, dirty: false });
  }
}

export async function removeCachedFile(id: string): Promise<void> {
  await client.removeDoc('files', id);
}

export { FileDoc };
