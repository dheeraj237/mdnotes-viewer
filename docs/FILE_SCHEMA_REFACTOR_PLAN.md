**File Schema Refactor & Test Plan**

Overview
- Goal: unify the file/directory schema across backend (RxDB), stores, and UI components so any component can render file trees and manage file state (dirty, synced, metadata) without additional transformation.
- Outcome: incremental small PRs, each focused and test-covered, that collectively refactor schema, update stores, update UI consumers, and verify sync behavior.

Unified schema (recommended canonical shape)
Use this as the single source-of-truth for all file/directory representations in code and tests:

```
type FileNode = {
  id: string;               // unique id (uuid or path-based)
  type: 'file' | 'directory';
  name: string;             // base name
  path: string;             // full path within workspace
  parentId?: string | null; // parent id (null for workspace root)
  children?: string[];      // array of child ids (only for directory)
  size?: number;            // bytes (files)
  modifiedAt?: string;      // ISO timestamp
  createdAt?: string;       // ISO timestamp
  dirty?: boolean;          // user-local changes not pushed
  synced?: boolean;         // whether last change is synced
  version?: number;         // incrementing revision/version
  mimeType?: string;
  meta?: Record<string, any>;
}
```

Key principles
- All code that produces file nodes (RxDB writes, importers, adapters) must emit the canonical `FileNode` shape.
- UI components consume `FileNode` directly with no further normalization.
- Stores hold maps from `id` -> `FileNode` and separate lists of root ids for workspaces.
- Subscriptions: UI subscribes to a workspace-specific RxDB query/observable; SyncManager subscribes to the same active-workspace observable but only for push operations.
- Active-workspace: there is a single active workspace at a time; switching must tear down previous subscriptions and start new ones.

Tests and scenarios (for small PRs)

PR 1 — Schema Normalizer unit tests
- Purpose: add tests for a small utility `normalizeToFileNode(raw)` that converts existing shapes to canonical `FileNode`.
- Tests:
  - raw with missing timestamps gets defaults
  - directory raw with `children` array transforms correctly
  - file raw sets `type: 'file'` and no children
  - unknown fields are preserved in `meta`
- Files to add/modify: add `src/shared/utils/normalize-file-node.test.ts` and `src/shared/utils/normalize-file-node.ts`.
- PR prompt (commit message + description): "Add normalizeToFileNode utility and unit tests — ensures inputs normalize to canonical FileNode"

PR 2 — Add shared types and RxDB schema validation
- Purpose: add `src/shared/types/file-node.ts` and align RxDB collections to enforce the same fields (at least in tests/migrations).
- Tests:
  - RxDB insert of a FileNode missing required fields should fail (or be normalized by a pre-insert hook)
  - Migration test to convert old docs to new shape
- Files to change: `src/core/cache/schemas.ts` (or existing rxdb schema file), new `src/shared/types/file-node.ts`.
- PR prompt: "Introduce canonical FileNode type and update RxDB collection schema + migration tests"

PR 3 — Adapter write path produces canonical FileNode
- Purpose: ensure all adapters (Google Drive, filesystem adapters) produce canonical nodes when pushing/pulling.
- Tests:
  - unit test that adapter transform produces `FileNode`
  - snapshot of a small directory import
- Files: `src/core/sync/adapter-bridge.ts`, adapter transform utility.
- PR prompt: "Normalize adapter outputs to canonical FileNode before inserting into RxDB"

PR 4 — File-tree builder & stores use unified schema
- Purpose: refactor file-tree builder and stores to store and expose maps of `id->FileNode` and provide selectors for tree traversal.
- Tests:
  - unit tests for store selectors: getChildren(id), getPath(id), isDirty(id)
  - ensure building a tree from list of FileNode works deterministically
- Files: `src/core/cache/file-repo.ts`, `src/core/store/workspace-store.ts`, `src/features/file-explorer/*`
- PR prompt: "Refactor file-store to use canonical FileNode map and add selectors + tests"

PR 5 — UI components consume schema & subscribe to active workspace
- Purpose: update UI components (file tree, editor tabs, dirty badges) to accept `FileNode` and subscribe to an active-workspace observable from store/RxDB.
- Tests:
  - component unit tests (react-testing-library) asserting render when passed FileNode map
  - small integration test: mocking RxDB observable that emits a file list, verify UI updates
- Files: `src/features/file-explorer/*`, `src/shared/components/*`
- PR prompt: "Make file-explorer consume canonical FileNode map and subscribe to active workspace observable"

PR 6 — SyncManager subscribes to active workspace and pushes changes
- Purpose: the `sync-manager` should watch the active-workspace change stream and push local changes for that workspace to the adapter; when workspace switches, it should unsubscribe and attach to new workspace.
- Tests:
  - unit test mocking RxDB observable and adapter to assert push behavior
  - smoke integration test where UI edits set `dirty=true` and SyncManager calls adapter push for that file
- Files: `src/core/sync/sync-manager.ts`, `src/core/sync/adapter-bridge.ts`
- PR prompt: "Subscribe SyncManager to active workspace observable; push changes via adapter (tests included)"

PR 7 — Integration tests: RxDB ↔ UI ↔ SyncManager
- Purpose: integration tests that wire a test RxDB instance, a simplified store, the SyncManager (with adapter mocked), and a headless render of the file-explorer.
- Scenarios:
  - insert file into RxDB for active workspace → UI updates and shows file
  - UI edit toggles `dirty` → SyncManager pushes to adapter
  - switch active workspace → previous subscriptions stop, new workspace shows different files
- Files: `tests/integration/active-workspace-sync.test.ts` (use jest + @testing-library/react + in-memory rxdb)
- PR prompt: "Add integration tests for active-workspace RxDB subscription, UI update, and SyncManager push behavior"

PR 8 — E2E/UI tests for workspace switch UX
- Purpose: simulate a user switching active workspace and confirm UI unsubscribes/resubscribes and editor state resets/loads correct workspace files.
- Tests: use Playwright or Cypress; steps: seed two workspaces, start app test server, switch workspace in UI, assert visible file list changes and no cross-workspace dirty leaks.
- PR prompt: "Add E2E tests to validate workspace switching behavior in UI"

Implementation guidance and small-PR checklist
- Keep PRs small: one logical change + tests + type updates.
- Always include unit tests for any data-shape change.
- For refactors touching many files, provide migration utilities and feature-flag the change behind a branch until coverage exists.
- Breaking-change checklist inside PR description:
  - list of types/files changed
  - sample before/after doc stored in tests
  - migration script (if applicable)

How to run tests (examples)
- unit tests: `yarn test` or `npm test`
- UI unit tests: `yarn test src/features/file-explorer` (adjust to repo test runner)
- integration tests: `yarn test tests/integration/active-workspace-sync.test.ts`

Prompts for step-by-step work (copy into PR description or into issue comments)
- "Step X: implement [short task]. Run tests with [command]. Notify when ready for code review."
- Example: "Step 2: Add `FileNode` type and update RxDB schema. Run `yarn test` and `yarn test:schemas`. Ready for PR review."

Notes
- This plan assumes existing RxDB usage in `src/core/cache` and a `sync-manager` in `src/core/sync`. Adjust exact paths per repo.
- Keep adapters idempotent: avoid double-writes when the same FileNode arrives again (use `id` + `version`).

Contact flow
- I'll implement these PR steps one-by-one; say which PR you'd like first (I recommend PR 1: `normalizeToFileNode` + unit tests). 
