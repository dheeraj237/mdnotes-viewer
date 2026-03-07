/**
 * Workspace Manager - workspace lifecycle and switching helpers
 *
 * This is a lightweight skeleton for workspace CRUD and switching logic.
 * The implementation will be expanded in follow-up PRs.
 */

import { initializeRxDB } from '@/core/rxdb/rxdb-client';
import { WorkspaceType } from './types';
import { loadSamplesIntoWorkspace } from '@/core/cache/sample-loader';
import { saveFile } from '@/core/cache/file-manager';
// FileSystem handle persistence/permission logic has been removed from this
// manager. Adapters are responsible for handling any File System Access API
// interactions and persistence. Keep minimal no-op helpers here so callers
// won't crash if they call these functions.
import { findDocs, removeDoc } from '@/core/rxdb/rxdb-client';

export interface WorkspaceRecord {
  id: string;
  name: string;
  type: WorkspaceType;
  createdAt: string;
  lastAccessed: string;
}

export async function createWorkspace(name: string, type: WorkspaceType, id?: string): Promise<WorkspaceRecord> {
  const workspaceId = id || generateWorkspaceId(type);
  const workspace: WorkspaceRecord = {
    id: workspaceId,
    name,
    type,
    createdAt: new Date().toISOString(),
    lastAccessed: new Date().toISOString(),
  };

  // Only create a default `verve.md` for browser workspaces (skip samples and non-browser types)
  if (type === WorkspaceType.Browser && workspaceId !== 'verve-samples') {
    try {
      await initializeRxDB();
    } catch (e) {
      // best-effort
    }
    try {
      await saveFile('verve.md', '# Verve 🚀', type, undefined, workspaceId);
    } catch (err) {
      console.warn('Failed to create default verve.md for workspace', workspaceId, err);
    }
  }

  return workspace;
}

/**
 * Generate a reasonably-unique workspace id for the given type.
 * Exported so other modules (or tests) can reuse an identical strategy.
 */
export function generateWorkspaceId(type: WorkspaceType) {
  return `${type}-${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
}

export async function listWorkspaces(): Promise<WorkspaceRecord[]> {
  // Persistence is handled by useWorkspaceStore; return empty by default.
  return [];
}

export async function getWorkspace(id: string): Promise<WorkspaceRecord | null> {
  return null;
}

export async function deleteWorkspace(id: string): Promise<void> {
  // Deletion of workspace metadata and clearing related files is handled
  // by the store and file-manager.
}

export async function switchWorkspace(id: string): Promise<void> {
  // Ensure RxDB is initialized during workspace switch
  try {
    await initializeRxDB();
  } catch (e) {
    // ignore init errors; caller will handle user-facing flow
  }
}

export async function createSampleWorkspaceIfMissing(): Promise<WorkspaceRecord> {
  // Create a deterministic 'verve-samples' workspace and populate it with sample files
  const workspaceId = 'verve-samples';
  const workspace: WorkspaceRecord = {
    id: workspaceId,
    name: 'Verve Samples',
    type: WorkspaceType.Browser,
    createdAt: new Date().toISOString(),
    lastAccessed: new Date().toISOString(),
  };

  try {
    await initializeRxDB();
    await loadSamplesIntoWorkspace(workspaceId);
  } catch (e) {
    console.warn('Failed to create sample workspace:', e);
  }

  return workspace;
}

/**
 * Persist a directory handle for the given workspace and upsert RxDB metadata
 */
export async function storeDirectoryHandle(workspaceId: string, /*directoryHandle: FileSystemDirectoryHandle*/ _directoryHandle: any): Promise<void> {
  console.warn('storeDirectoryHandle: removed filesystem-handle persistence from workspace-manager; no-op');
  return Promise.resolve();
}

/**
 * Restore a persisted directory handle (if any) and ensure RxDB metadata is present.
 */
export async function restoreDirectoryHandle(workspaceId: string): Promise<any | null> {
  // Handle restoration has moved to adapters; return null to indicate none
  // is available via the workspace manager.
  return null;
}

export async function listPersistedHandles() {
  // Persisted handle metadata is no longer managed here. Return an empty
  // list to avoid consumers depending on this implementation.
  try {
    return await findDocs<any>('directory_handles_meta', { selector: {} });
  } catch (e) {
    return [];
  }
}

/**
 * Remove persisted directory handle for workspace and delete RxDB metadata
 */
export async function removeDirectoryHandle(workspaceId: string): Promise<void> {
  try {
    await removeDoc('directory_handles_meta', workspaceId);
  } catch (err) {
    console.warn('removeDirectoryHandle: failed or removed persistence layer for', workspaceId, err);
  }
}

/**
 * Request permission for a workspace handle (must be called from a user gesture).
 * Uses the `directory_handles_meta` RxDB doc to obtain the persisted `directoryHandle`.
 * If permission granted, upsert RxDB metadata and return the handle.
 */
export async function requestPermissionForWorkspace(workspaceId: string): Promise<any | null> {
  // Permission/requesting directory handles is now performed by adapters and
  // must be called directly from user gestures. Return null as a safe default.
  console.warn('requestPermissionForWorkspace: removed - adapters must handle FS permission requests');
  return null;
}

/**
 * Request permission for a local workspace handle (must be called from a user gesture).
 * This internally uses SyncManager to request permission via File System Access API.
 */
export async function requestPermissionForLocalWorkspace(workspaceId: string): Promise<boolean> {
  try {
    // TODO: Implement permission request via adapter
    // In the new architecture, this should be handled by the adapter initialization
    console.warn('requestPermissionForLocalWorkspace: removed - adapters handle local workspace permissions');
    return false;
  } catch (err) {
    console.warn('requestPermissionForLocalWorkspace failed:', err);
    return false;
  }
}

/**
 * Open a local directory using File System Access API.
 * This internally uses SyncManager to show the directory picker and scan files.
 */
export async function openLocalDirectory(workspaceId?: string): Promise<boolean> {
  try {
    // TODO: Implement directory picker via adapter
    // In the new architecture, adapters handle FS API interactions
    console.warn('openLocalDirectory: removed - adapters must open local directories');
    return false;
  } catch (err) {
    console.warn('openLocalDirectory failed:', err);
    return false;
  }
}

/**
 * Check if a local directory is currently open/ready
 */
export async function hasLocalDirectory(): Promise<boolean> {
  try {
    // TODO: Check adapter readiness
    // In the new architecture, check adapter state via SyncManager.getAdapter()
    return false;
  } catch (e) {
    return false;
  }
}

/**
 * Clear the currently open local directory and dispose the adapter
 */
export async function clearLocalDirectory(): Promise<void> {
  try {
    // No-op: adapters handle cleanup
  } catch (e) {
    // ignore
  }
}
