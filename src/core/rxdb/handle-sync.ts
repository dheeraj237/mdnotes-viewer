import { upsertDoc, getDoc, initializeRxDB } from './rxdb-client';

// NOTE: FileSystemDirectoryHandle objects cannot be reliably serialized/deserialized
// in IndexedDB - they lose their methods when stored. We store only metadata here.
// The actual handle is kept in-memory (sessionStorage) and is lost on page reload.
// Users must re-grant permission to access local directories after page reload.

export interface HandleMeta {
  id: string;
  workspaceId: string;
  directoryName: string;
  storedAt: number;
  permissionStatus: 'granted' | 'prompt' | 'denied' | string;
  notes?: string;
}

export async function storeHandleForWorkspace(workspaceId: string, handle: FileSystemDirectoryHandle): Promise<void> {
  // Ensure the DB is initialized before attempting to persist handle metadata.
  // This makes the helper safe to call in tests and in code paths where the
  // RxDB instance may not have been eagerly created.
  try { await initializeRxDB(); } catch (_) { /* best-effort */ }
  
  // Store metadata only, NOT the handle object (handles don't serialize properly)
  const meta: any = {
    id: workspaceId,
    workspaceId,
    directoryName: handle?.name || 'unknown',
    storedAt: Date.now(),
    permissionStatus: 'granted',
    // NOTE: directoryHandle is NOT stored - it will be lost on page reload
  };

  await upsertDoc('directory_handles_meta', meta as any);
}

export async function getHandleMeta(workspaceId: string): Promise<HandleMeta | null> {
  return await getDoc<HandleMeta>('directory_handles_meta', workspaceId);
}

export async function ensureHandleForWorkspace(workspaceId: string): Promise<FileSystemDirectoryHandle | null> {
  // Cannot restore actual handle from IndexedDB (doesn't serialize properly)
  // Return null - caller should handle this by re-requesting from user
  return null;
}
