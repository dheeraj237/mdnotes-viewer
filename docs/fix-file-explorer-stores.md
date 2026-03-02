# Fixing File Explorer Stores: Audit & Migration Guide

Goal: Ensure all UI components and stores only talk to RxDB. Move any workspace-specific file system or remote calls into Sync Manager adapters.

## Summary

- UI / stores: read/write RxDB only.
- Sync Manager: subscribe to RxDB changes + Active Workspace; choose the correct adapter.
- Adapters: Browser / Local / GDrive — implement all workspace-specific CRUD.

## Files/areas to audit (suggested start list)

- `src/features/file-explorer/store/file-explorer-store.ts`
- `src/features/file-explorer/components/` (file list, tree, actions)
- `src/core/cache/file-manager.ts`
- `src/core/cache/file-repo.ts`
- `src/core/sync/sync-manager.ts`
- `src/core/sync/adapters/` (new location to add adapters)
- `src/core/init/workspace-manager.ts` or `workspace-store` implementations

Search for any direct usage of:
- File System Access API (FileHandle, showOpenFilePicker, showDirectoryPicker)
- Google Drive REST/clients
- Node fs operations in client code


## Checklist: audit

- [ ] Find UI/store files that call workspace APIs directly.
- [ ] Flag every call that touches external persistence (FileHandle, Drive API, local fs).
- [ ] Replace direct calls with RxDB writes (create/update/delete documents).
- [ ] Ensure RxDB schema captures necessary metadata (path, remoteId, syncStatus, fileHandleId).

## Adapter interface (typescript)

Add a shared adapter interface under `src/core/sync/adapters/adapter-types.ts`:

```ts
export interface WorkspaceAdapter {
  init(): Promise<void>;
  dispose(): Promise<void>;
  createFile(path: string, content: Uint8Array | Blob, meta?: any): Promise<{remoteId?: string}>;
  readFile(path: string): Promise<Uint8Array | Blob>;
  updateFile(path: string, content: Uint8Array | Blob, meta?: any): Promise<void>;
  deleteFile(path: string): Promise<void>;
  createDir(path: string): Promise<void>;
  deleteDir(path: string): Promise<void>;
  // optional pub/sub hooks for adapter-specific events
  watch?(path: string, onChange: (ev: any) => void): () => void;
}
```

Implementations:
- `browser-adapter.ts` — minimal/no-op (returns metadata only)
- `local-adapter.ts` — wraps File System Access API; manages `FileHandle` mapping
- `gdrive-adapter.ts` — wraps Google Drive API (OAuth, resumable uploads)


## Example: store -> RxDB only (before/after)

Before (anti-pattern): store calls FileHandle directly

```ts
// BAD: store performing workspace operation
async function saveFile(filePath, content) {
  // directly write to disk
  await fileHandle.write(content);
  // update UI state
  setState({ saving: false });
}
```

After (correct): store writes only to RxDB

```ts
// GOOD: store writes to RxDB; Sync Manager handles persisting
async function saveFile(fileDoc) {
  await rxdb.files.upsert(fileDoc);
  // Sync Manager will pick up the change and call the active adapter
}
```


## Changes to `Sync Manager` (implementation notes)

- Subscribe to RxDB change feed for file documents (creation/update/delete).
- Subscribe to `Active Workspace` store changes.
- Maintain a single `activeAdapter: WorkspaceAdapter | null` instance.
- On RxDB event, normalize the event into a queue item and call the adapter API.
- Record adapter operation results back into RxDB (e.g., `syncStatus`, `remoteId`, `lastSyncAt`, `error`).
- If active workspace type is `browser`, skip heavy adapter ops — simply update metadata or set `syncStatus = 'local-only'`.
- Provide a retry policy for failed adapter ops.

Pseudo:

```ts
rxdb.files.$.subscribe(change => {
  queue.push(normalize(change));
  processQueue();
});

activeWorkspace$.subscribe(ws => {
  if (adapter) await adapter.dispose();
  adapter = createAdapterFor(ws.type);
  await adapter.init();
});

async function processQueue() {
  while (queue.length) {
    const item = queue.shift();
    try {
      await adapter.perform(item);
      await rxdb.files.upsert({ id: item.id, syncStatus: 'synced', lastSyncAt: Date.now() });
    } catch (err) {
      await rxdb.files.upsert({ id: item.id, syncStatus: 'error', lastError: String(err) });
    }
  }
}
```


## Migration steps (practical)

1. Add adapter interface and empty adapter implementations under `src/core/sync/adapters/`.
2. Update Sync Manager to instantiate adapters and to subscribe to RxDB change feed and `Active Workspace` store.
3. Audit each store in `src/features/*/store`:
   - Replace direct filesystem/drive calls with RxDB writes.
   - Add missing RxDB fields required by adapters (e.g., `remoteId`, `syncStatus`, `fileHandleId`).
4. Add tests for:
   - Store: ensures RxDB write happens and UI state is updated.
   - Sync: switch workspace types, ensure adapter init/dispose called.
   - Adapter: unit tests for adapter contract using mocks.
5. Run lint/tests: `yarn test` and `yarn lint`.
6. Create a migration PR with small, focused commits (one per module refactor).


## Verification checklist

- [ ] No direct FileHandle / fs / Drive API calls in `src/features/*`.
- [ ] `Sync Manager` subscribes to RxDB changes and `Active Workspace`.
- [ ] Each adapter writes back status to RxDB.
- [ ] UI shows sync state based exclusively on RxDB fields.
- [ ] Tests cover adapter selection and basic CRUD flows.


## Example small adapter stub (local)

```ts
// src/core/sync/adapters/local-adapter.ts
import type { WorkspaceAdapter } from './adapter-types';
export class LocalAdapter implements WorkspaceAdapter {
  async init() { /* open handles */ }
  async dispose() { /* release handles */ }
  async createFile(path: string, content: Uint8Array) { /* use FileHandle to write */ }
  async readFile(path: string) { /* read FileHandle */ return new Uint8Array(); }
  async updateFile(path: string, content: Uint8Array) { /* write */ }
  async deleteFile(path: string) { /* delete */ }
}
```


---

File created: docs/fix-file-explorer-stores.md
