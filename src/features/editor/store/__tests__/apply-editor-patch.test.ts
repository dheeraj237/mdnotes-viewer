import { vi } from 'vitest';
import type { Mock } from 'vitest';

const enqueueMock = vi.fn();

vi.mock('@/core/cache/file-manager', () => ({
  initializeFileOperations: vi.fn(),
  loadFile: vi.fn(),
  saveFile: vi.fn(() => Promise.resolve({ id: 'file-1', name: 'doc', path: '/doc.md', content: 'new content' })),
  listFiles: vi.fn(),
}));

vi.mock('@/core/sync/sync-manager', () => ({
  getSyncManager: () => ({ enqueueAndProcess: enqueueMock }),
}));

vi.mock('@/core/config/features', () => ({
  isFeatureEnabled: vi.fn(() => true),
}));

import { useEditorStore } from '../editor-store';
import { useWorkspaceStore } from '@/core/store/workspace-store';
import { saveFile } from '@/core/cache/file-manager';
import { getSyncManager } from '@/core/sync';
import { WorkspaceType } from '@/core/cache/types';
// FileCategory removed in unified FileNode; indicate local files via `isLocal`

describe('applyEditorPatch sync behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set up workspace store with active workspace
    useWorkspaceStore.setState({ workspaces: [{ id: 'ws-1', name: 'WS', type: WorkspaceType.Local, createdAt: new Date().toISOString(), lastAccessed: new Date().toISOString() }], activeWorkspaceId: 'ws-1' });

    // Set editor open tabs (use `isLocal` flag instead of removed `FileCategory`)
    useEditorStore.setState({ openTabs: [{ id: 'file-1', path: '/doc.md', name: 'doc', content: 'old', isLocal: true }], activeTabId: 'file-1' });
  });

  it('saves file through file-manager when workspace is active', async () => {
    const apply = useEditorStore.getState().applyEditorPatch;

    await apply('file-1', 'new content');

    // Allow promise microtasks to run
    await new Promise((r) => setTimeout(r, 0));

    // In the new architecture, file-manager saves the file and marks it dirty in RxDB
    // SyncManager then picks up dirty files reactively and pushes them via adapters
    expect(saveFile).toHaveBeenCalledWith('/doc.md', 'new content', expect.any(String), undefined, 'ws-1');
    // No explicit enqueue call in new architecture - SyncManager handles dirty file detection
  });
});
