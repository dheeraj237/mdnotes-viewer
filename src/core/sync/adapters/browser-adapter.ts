/**
 * BrowserAdapter — no-op IAdapter for browser (IndexedDB-only) workspaces.
 *
 * Browser workspaces use RxDB/IndexedDB as source of truth — there is no
 * remote filesystem to pull from or push to.  All methods are intentional
 * no-ops so SyncManager can treat every workspace type uniformly without
 * special-casing.
 */

import type { IAdapter } from '../adapter';

export class BrowserAdapter implements IAdapter {
  readonly workspaceId: string;
  readonly type = 'browser' as const;

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
  }

  // RxDB is the source of truth — nothing to pull.
  pull(_signal?: AbortSignal): Promise<void> {
    return Promise.resolve();
  }

  // Nothing to write to.
  push(_path: string, _content: string): Promise<void> {
    return Promise.resolve();
  }

  // All files and folders are included (RxDB manages filtering).
  shouldIncludeFile(_path: string, _name: string, _sizeBytes: number): boolean {
    return true;
  }

  shouldIncludeFolder(_name: string): boolean {
    return true;
  }

  // Nothing to release.
  destroy(): void {}
}

