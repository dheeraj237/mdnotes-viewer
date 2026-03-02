**Tech Spec: Make RxDB the single source of truth for workspaces, files, settings, and handle metadata**

Goal (non-ambiguous)
- `RxDB` is the authoritative source of truth for everything UI/stores read and write: workspaces, file metadata, file content cache, user settings, and sync queue.
- Low-level IndexedDB utilities will continue to persist raw `FileSystemDirectoryHandle` objects (browser handles) because they must be stored in native IndexedDB. The `workspace-manager` will be integrated with RxDB via a small helper so RxDB contains canonical metadata and a stable document ID that references the persisted handle.
- UI and Zustand stores must only use RxDB wrapper APIs (CRUD + subscriptions). No direct IndexedDB, `window.showDirectoryPicker`, or file handle usage in UI/stores.
- `SyncManager` coordinates adapters but uses RxDB collections for reads and writes: it observes RxDB for dirty files and writes updates into RxDB. Adapter code (Local/GDrive) is the only code allowed to interact with external storage/handles and must persist results into RxDB via the wrapper API.
- Provide robust dev UX for seamless file editing: optimistic content updates, incremental saves, auto-save debounce, and consistent subscriptions so editor/file tree reflect changes immediately.

Core design: collections + responsibilities
- Collections (RxDB JSON schemas; names below):
  - `workspaces`:
    - Fields: `id` (string PK), `name`, `type` (enum: Browser|Local|Drive), `path?`, `driveFolder?`, `createdAt`, `lastAccessed`
    - Purpose: list of workspaces & active workspace metadata.
  - `files`:
    - Fields: `id` (string PK, e.g., workspaceId + ':' + path), `workspaceId`, `workspaceType`, `path`, `name`, `content` (string), `dirty` (boolean), `lastModified` (number), `size?`, `mimeType?`, `syncStatus?` (enum), `version?` (number)
    - Indexes: `workspaceId`, `dirty`, `path`
    - Purpose: canonical file metadata + content cache.
  - `settings`:
    - Fields: `id` (string PK), `key`, `value` (any), `updatedAt`
    - Purpose: app & user settings used by UI.
  - `directory_handles_meta`:
    - Fields: `id` (string PK = workspaceId), `workspaceId`, `directoryName`, `storedAt`, `permissionStatus` (`granted|prompt|denied`), `notes?`
    - Purpose: metadata for persisted handles. The actual `FileSystemDirectoryHandle` remains in a dedicated low-level idb store; the metadata document keeps RxDB-aware UI informed and is managed via the `workspace-manager`.
  - `sync_queue`:
    - Fields: `id`, `op` (Put/Delete), `target` (`file`), `targetId`, `payload`, `createdAt`, `attempts`
    - Purpose: durable queue for sync operations.
- Additional invariants:
  - `files.content` is authoritative for UI; adapters must write content into `files` (not directly into some other store).
  - Editors read from `files` by `workspaceId` + `path`.
  - When an adapter writes a file to remote or local FS it must also upsert the `files` doc with `dirty=false` and updated `lastModified` and `version`.
  - UI-only writes (editor save) set `dirty=true` and update `content` and `lastModified`; `SyncManager` will observe and push using adapters.

APIs to implement (explicit signatures)
- File: `src/core/rxdb/rxdb-client.ts` (new)
  - export async function `createRxDB()` : Promise<void>
  - export function `getCollection<T>(name: string)`: RxCollection<T>
  - export async function `upsertDoc<T>(collection: string, doc: T & { id: string }): Promise<void>`
  - export async function `getDoc<T>(collection: string, id: string): Promise<T | null>`
  - export async function `findDocs<T>(collection: string, query: { selector?: any; sort?: any; limit?: number }): Promise<T[]>`
  - export function `subscribeDoc<T>(collection: string, id: string, cb: (doc: T | null) => void): () => void`
  - export function `subscribeQuery<T>(collection: string, query, cb: (docs: T[]) => void): () => void`
  - export async function `atomicUpsert<T>(collection: string, id: string, mutator: (current?: T|null) => T): Promise<T>`
  - export async function `bulkWrite<T>(collection: string, docs: Array<T & { id: string }>): Promise<void>`
  - export async function `removeDoc(collection: string, id: string): Promise<void>`
  - export function `observeCollectionChanges(collection: string, handler: (change) => void): Unsubscribe`
  - Export strongly typed TypeScript interfaces for `FileDoc`, `WorkspaceDoc`, etc.
- Special Handle helpers: `src/core/rxdb/handle-sync.ts`
  - export async function `saveHandleMeta(workspaceId: string, handleMeta: {directoryName:string, permissionStatus:string}): Promise<void>`
  - export async function `getHandleMeta(workspaceId: string): Promise<HandleMeta | null>`
  - export async function `ensureHandleForWorkspace(workspaceId: string): Promise<FileSystemDirectoryHandle | null>`
    - Implementation: check RxDB `directory_handles_meta` doc for workspaceId; call underlying `workspace-manager.getDirectoryHandle(workspaceId)` (or equivalent low-level handle accessor exposed by `workspace-manager`) to retrieve handle and return it.
  - export async function `storeHandleForWorkspace(workspaceId: string, handle: FileSystemDirectoryHandle): Promise<void>`
    - Implementation: call `workspace-manager.storeDirectoryHandle(workspaceId, handle)` (or an equivalent `workspace-manager` API) then upsert metadata into RxDB with `permissionStatus` set to `granted`.
- File operations facade changes (adapter integration):
  - `saveFile(path, content, workspaceType, options?, workspaceId?)` — should call `upsertDoc('files', fileDoc)` using `atomicUpsert` to avoid race conditions and increment `version`.
  - `loadFile(path, workspaceType, workspaceId)` — should call `getDoc('files', id)` and return content and metadata.
  - `getAllFiles(workspaceId)` — `findDocs('files', { selector: { workspaceId }})`.

SyncManager responsibilities (concrete)
- Do not read file content from disk or browser handles directly. Instead:
  - Observe RxDB `files` collection using `subscribeQuery` or `observeCollectionChanges`.
  - When a `files` doc becomes `dirty === true` and `workspaceType !== Browser`, enqueue/push via adapter.
- Pull workflow on workspace switch:
  - When user switches to workspace (handled by `useWorkspaceStore.switchWorkspace`), `SyncManager.pullWorkspace({id, type})` should call adapter.pullWorkspace and for each returned item:
    - `await upsertDoc('files', normalizedDoc)` and `saveFile(...)` as appropriate.
  - If local adapter requires a directory handle to enumerate files, `SyncManager` should call `ensureHandleForWorkspace(workspaceId)` from `handle-sync.ts` to obtain the handle (if not available, `promptPermissionAndRestore` remains for user gestures). If non-null, adapter can `initialize(handle)` internally.
- Push workflow:
  - `SyncManager` will call adapter.push when `files` doc is dirty. After successful push, `SyncManager` will mark doc `dirty=false`, update `lastModified` and `syncStatus`.
- When adapter reports remote changes (via `watch()` or pull), adapter must upsert `files` documents in RxDB only — adapters must not write to any external store other than remote APIs / FS.

Migration approach for persisted handle integration (explicit)
- Keep low-level idb utilities to store raw handles (unchanged functionally). The `workspace-manager` will act as the higher-level coordinator that integrates these raw handles with RxDB metadata.
  - After the low-level store persists a handle, `workspace-manager` should call `handle-sync` to upsert a `directory_handles_meta` document into RxDB.
  - Permission flows (e.g., `requestPermissionForWorkspace`) should be routed through `workspace-manager`; when a handle is returned and permission is granted, `workspace-manager` must upsert the corresponding `directory_handles_meta` with `permissionStatus: granted`.
  - Remove any code that directly reads the low-level idb handle store except inside adapters and the `workspace-manager`. UI/stores should only query RxDB metadata.

- Migration script:
  - On startup migration, query the low-level idb handle store (e.g., `getAllDirectoryHandles()`) and write a mirrored metadata doc to RxDB for each handle. Set `permissionStatus` to `granted` if `queryPermission` returns `granted`, otherwise `prompt`.

Schema & indexing (explicit)
- Define JSON schema for `files` and `workspaces` in `src/core/rxdb/schemas.ts`. Example `files` schema:
  - primary key `id` (string)
  - required: `id`, `workspaceId`, `workspaceType`, `path`, `content`, `dirty`, `lastModified`
  - indexes: `workspaceId`, `dirty`, `path`, `syncStatus`
- Add migration versioning: `rxdb-client` should initialize RxDB with a controlled `migrationStrategies` handler to migrate older docs.

UI/store migration checklist (explicit, file-level)
- `src/features/file-explorer/store/*`:
  - Replace direct calls to `getAllFiles` or `file-operations` implementations that read IndexedDB directly with `rxdb-client` wrappers (e.g., `findDocs('files', {selector:{workspaceId}})`).
  - Replace `hasLocalDirectory()` to read `directory_handles_meta` doc and `isReady()` from adapter via `getSyncManager().getAdapter('local')`.
- editor-store.ts:
  - All saves must call `saveFile` (which now writes to RxDB).
  - Editor open must read from RxDB `files` doc, and if missing call `getSyncManager().pullFileToCache(...)`.
- `src/core/sync/*`:
  - Ensure `observeCachedFiles` uses `rxdb-client.observeCollectionChanges('files', handler)` and not a custom watch that bypasses wrapper.
 - `workspace-manager.ts`:
  - Only adapters and the `workspace-manager` (via `handle-sync`) should call low-level raw handle functions. UI should never call these directly; UI must read handle metadata from RxDB.

Concurrency & UX details (unambiguous)
- Use `atomicUpsert` for all writes to `files` to avoid lost updates:
  - `atomicUpsert('files', id, (current) => ({ ...current, content: newContent, dirty: true, lastModified: Date.now(), version: (current?.version || 0) + 1 }))`
- Auto-save UX:
  - Editor will debounce saves: 1000ms default; on save, call `atomicUpsert` and set `dirty=true`. Show a save indicator subscribing to the doc's `syncStatus`.
  - Optimistic UI: `content` in `files` doc is updated immediately for editor reads.
- Conflict UI:
  - `SyncManager` should set `syncStatus` to `conflict` when the adapter returns a remote `version` > local `version`. Expose `merge` strategy hooks and an API in `rxdb-client` to `subscribeDoc` to show conflict badge.
- Performance:
  - Use RxDB queries with selectors and indexes to limit reactivity to the active workspace to avoid UI updates for unrelated workspaces.
  - For file lists (explorer tree), query only summary fields (`id`, `name`, `path`, `lastModified`) to avoid moving large content around.

Testing & verification (explicit)
- Unit tests:
  - `rxdb-client` CRUD + subscriptions
  - `handle-sync` saving & retrieval with `workspace-manager` mocked
  - `file-operations` writes upsert proper `files` docs and set `dirty`.
  - `SyncManager` push/pull flows with mocked adapters that simulate success/failure and remote versions.
- End-to-end tests:
  - Scenario: Persisted local handle exists → reload app → `SyncManager` auto-initializes adapter → `pullWorkspace` populates `files` docs → explorer shows files.
  - Scenario: Editor edits file → debounced save → `files` doc dirty true → `SyncManager` pushes to adapter → adapter succeeds → `dirty=false`.
  - Scenario: Remote change arrives while local dirty → conflict detected & UI merge flow is displayed.
- Test harness: reuse existing Jest+fake-indexeddb and add `rxdb-client` initialization in test `beforeEach`.

Concrete implementation tasks & copy‑paste prompts
(Each prompt is ready for you to paste to me to implement the corresponding change; pick one by one.)

1) Task: Add RxDB schemas & `rxdb-client` wrapper
- Files to create:
  - `src/core/rxdb/schemas.ts` (JSON schemas for `files`, `workspaces`, `settings`, `directory_handles_meta`, `sync_queue`)
  - `src/core/rxdb/rxdb-client.ts`
- Prompt to paste to assistant:
  > "Create `src/core/rxdb/schemas.ts` and `src/core/rxdb/rxdb-client.ts`. Implement schema definitions (files, workspaces, settings, directory_handles_meta, sync_queue) and a wrapper with functions: `createRxDB()`, `getCollection()`, `upsertDoc()`, `getDoc()`, `findDocs()`, `subscribeDoc()`, `subscribeQuery()`, `atomicUpsert()`, `bulkWrite()`, `removeDoc()`, `observeCollectionChanges()`. Use `rxdb` v14 APIs and `fake-indexeddb` for tests. Export TypeScript types `FileDoc`, `WorkspaceDoc`."

2) Task: Integrate persisted handles via `workspace-manager` and RxDB metadata
- Files to edit/create:
  - update `workspace-manager.ts` to call new `handle-sync.ts` after persisting or restoring directory handles and when requesting permissions.
  - create `src/core/rxdb/handle-sync.ts` with helpers `storeHandleForWorkspace`, `getHandleMeta`, `ensureHandleForWorkspace`.
- Prompt:
  > "Add `src/core/rxdb/handle-sync.ts` exposing `storeHandleForWorkspace`, `getHandleMeta`, and `ensureHandleForWorkspace`. Modify `workspace-manager.ts` so when it persists or restores directory handles it calls `handle-sync` to upsert metadata in RxDB. Keep the low-level idb handle storage as-is; `workspace-manager` will be the integration point."

3) Task: Update `file-operations` to use `rxdb-client`
- Files to edit:
  - file-operations.ts
  - `src/core/cache/rxdb` usages
- Prompt:
  > "Refactor file-operations.ts to use `rxdb-client.upsertDoc('files', fileDoc)` and `rxdb-client.getDoc('files', id)` for `saveFile` and `loadFile`. Ensure `saveFile` uses `atomicUpsert` to increment `version` and set `dirty` according to `options`."

4) Task: Refactor stores/UI to use RxDB wrapper exclusively
- Files to edit:
  - `src/features/file-explorer/store/*`, editor-store.ts, and any UI components that used direct indexedDB or window handle
- Prompt:
  > "Replace direct calls to `workspace-manager` or handle usage in UI/stores with `rxdb-client` reads/subscriptions. For file lists, use `rxdb-client.subscribeQuery('files', { selector:{workspaceId}}, cb)`. For reading a file open, use `rxdb-client.getDoc('files', id)`."

5) Task: Adjust `SyncManager` to use `rxdb-client` observation and handle push/pull via adapters
- Files to edit:
  - sync-manager.ts
- Prompt:
  > "Refactor `SyncManager` to use `rxdb-client.observeCollectionChanges('files', handler)` and to perform pushes when a doc's `dirty` flag becomes true. When pulling a workspace, ensure adapter results upsert into RxDB using `upsertDoc('files', ...)`. Use `handle-sync.ensureHandleForWorkspace(workspaceId)` when local adapter needs a handle."

6) Task: Add test coverage & e2e scenarios
- Files to add:
  - `src/core/rxdb/__tests__/rxdb-client.unit.test.ts`
  - `src/core/sync/__tests__/sync-manager.integration.test.ts`
  - update existing e2e tests to initialize `createRxDB()` in beforeEach
- Prompt:
  > "Add tests for `rxdb-client` CRUD and subscriptions, adapter/harness tests to simulate local handle flows, and e2e tests for reload -> restore -> file explorer population."

7) Task: Migration script & verification
- Files to add:
  - `scripts/migrate-handles-to-rxdb.ts` (node script invoked in local dev to populate `directory_handles_meta` for existing idb handles)
- Prompt:
  > "Create `scripts/migrate-handles-to-rxdb.ts` that calls `workspace-manager.getAllDirectoryHandles()` (or the low-level handle listing API exposed by `workspace-manager`) and writes corresponding metadata docs into RxDB using `rxdb-client.upsertDoc('directory_handles_meta', ...)`. Add a verification mode that lists workspaceIds and permissionStatus."

8) Task: UX polish (auto-save, optimistic updates, conflict UI)
- Changes to plan:
  - Editor: debounce saves 1000ms, call `atomicUpsert`.
  - File-tree: subscribe to `files` doc summary fields.
  - Conflict UI: subscribe to `files` doc; when `syncStatus === 'conflict'` show merge dialog; expose `rxdb-client.atomicUpsert` to merge.
- Prompt:
  > "Implement editor auto-save (1000ms) using `atomicUpsert('files', id, mutator)` and update file-tree to subscribe to `files` summaries. Add a conflict banner when `file.syncStatus === 'conflict'` and a `resolveConflict` helper that merges content and sets `dirty` appropriately."

Rollout & verification checklist (explicit)
- Developer PR checklist:
  - Add `rxdb-client` + schemas with migration strategy.
  - Ensure tests pass locally: `yarn test`.
  - Run migration script and verify output.
  - Manual QA: open app, open local workspace, create file, edit, reload, verify explorer shows files without prompting for directory (if permission was previously granted).
- CI checklist:
  - Add `createRxDB()` step in test setup.
  - Ensure `fake-indexeddb` is available in test environment.
  - Add `--detectOpenHandles` in Jest for flaky tests.
