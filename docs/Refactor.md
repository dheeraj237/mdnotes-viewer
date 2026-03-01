TL;DR — Extend the `file-manager` to expose a workspace-scoped subscription API so UI can auto-update file tree when files are created/updated/deleted or when the active workspace switches. Keep all RxDB CRUD in `file-manager`; `workspace-manager` will manage switching and trigger workspace population. Wire `useWorkspaceStore` and the file-explorer to use the new subscription. Update schemas and tests accordingly.

**Steps**
1. **File manager**: implement subscription API in src/core/cache/file-manager.ts
   - **Export**: `subscribeToWorkspaceFiles(workspaceId: string, cb: (files: FileMetadata[]) => void): () => void`
   - **Behavior**: subscribe to RxDB changes (use existing `observeCachedFiles`/`rxdb` helpers), filter by `workspaceId`, normalize paths per schema, and call `cb` with current file list (or diffs). Return an unsubscribe function.
   - **Also export**: `observeWorkspaceFiles(workspaceId: string)` — returns an observable/iterator for consumers that prefer reactive streams.
   - **Keep**: all CRUD (`initializeFileOperations`, `loadFile`, `saveFile`, `deleteFile`, `renameFile`, `createDirectory`, `listFiles`, `getAllFiles`, `existsInWorkspace`, etc.) in this module.
2. **Workspace manager**: in src/core/cache/workspace-manager.ts
   - **Ensure** `switchWorkspace` updates files’ `workspaceId`/`workspaceType`/`dirty` appropriately (moved from prior `switchWorkspaceType`) and that switching emits to subscriptions (i.e., subscription callbacks for previous/new `workspaceId` are updated).
   - **Implement** `createSampleWorkspaceIfMissing()` which calls the `sample-loader` and then switches to the sample workspace.
3. **Sample loader**: add src/core/cache/sample-loader.ts
   - **Read** content and `saveFile` into `verve-samples` workspace using deterministic IDs.
   - **Browser tests**: support mocking `fetch`; Node tests can read files directly.
4. **Schemas**: review/update schemas.ts
   - **Enforce** file/dir `type`, `path` normalization (single canonical convention), `workspaceId`, and indexes on `path`, `workspaceId`, `type`.
   - **Ensure** `listFiles`/prefix queries are efficient and deterministic so UI needs no extra computation.
5. **Wire UI/store**:
   - Update workspace-store.ts to call `workspace-manager` for create/switch operations.
   - Update file-explorer entrypoints (original helper file-operations.ts or renamed helper) to:
     - subscribe to the active workspace via `file-manager.subscribeToWorkspaceFiles(activeWorkspaceId, setTree)`
     - use `file-manager` CRUD functions (no extra normalization in the stores/UI).
6. **Tests**:
   - Add unit tests for `subscribeToWorkspaceFiles` to verify callbacks on create/update/delete/rename and on workspace switch.
   - Update integration/e2e tests that previously polled RxDB to instead rely on subscription updates where appropriate.
   - Update all test imports to new modules (`file-manager`, `workspace-manager`, `sample-loader`).
7. **Barrel & imports**:
   - Update index.ts to re-export new modules.
   - Run automated import updates across repo replacing `@/core/cache/file-operations` → `@/core/cache/file-manager` and adjust workspace-related imports.
8. **Verification**
   - Run `yarn test` and targeted suites (cache, file-explorer, workspace-store).
   - Manual smoke: fresh app start → `createSampleWorkspaceIfMissing()` creates and populates `verve-samples`; file-explorer auto-updates when files are created/renamed/deleted and when workspace switches.

**Decisions**
- Subscription API is workspace-scoped and returns an unsubscribe function for easy UI lifecycle management.
- `file-manager` will own the subscription implementation (uses RxDB `observeCachedFiles`) so UI components remain schema-agnostic.
- Keep schema canonicalization at the DB layer so stores and UI receive normalized objects.

**Updated PR task list (small PRs)**

- PR 1 — Skeletons & barrel
  - Add src/core/cache/file-manager.ts (skeleton), src/core/cache/workspace-manager.ts (skeleton), update index.ts.
- PR 2 — Move file ops + add subscription
  - Move file CRUD into `file-manager`.
  - Implement `subscribeToWorkspaceFiles` and `observeWorkspaceFiles`.
  - Update imports used by file-explorer and editor to `file-manager`.
  - Tests: add unit tests for subscription behavior.
- PR 3 — Workspace-manager + sample creation
  - Implement workspace CRUD and `createSampleWorkspaceIfMissing()`.
  - Wire `switchWorkspace` to notify subscriptions.
  - Update `useWorkspaceStore` to call `workspace-manager`.
  - Tests: workspace store tests & sample-creation test.
- PR 4 — Sample-loader
  - Implement [src/core/cache/sample-loader.ts] to load content into `verve-samples` via `file-manager`.
  - Tests: mock `fetch` and verify upserts.
- PR 5 — Schema updates & migrations
  - Review/update [src/core/cache/schemas.ts], add indexes and migration notes.
  - Update `rxdb` helpers to use indexes and normalization.
  - Tests: migration and schema tests.
- PR 6 — UI wiring & helper rename
  - Update feature helper (file-operations.ts) to subscribe to `file-manager` and use its CRUD methods.
  - Optionally rename helper to avoid naming confusion.
  - Tests: update file-explorer tests to rely on subscription updates.
- PR 7 — Repo-wide imports & tests stabilization
  - Apply automated import fixes, update tests, run full suite and fix failures.
- PR 8 — Cleanup & docs
  - Remove/mark deprecated old `file-operations` file, add docs for `file-manager` subscription API and workspace lifecycle.