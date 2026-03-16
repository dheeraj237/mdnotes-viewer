import { FileNode } from "@/shared/types";
import { buildFileTreeFromDirectory, buildFileTreeFromAdapter } from "./file-tree-builder";
import { WorkspaceType } from '@/core/cache/types';
import { getSyncManager } from '@/core/sync/sync-manager';
import { LocalAdapter } from '@/core/sync/adapters/local-adapter';

/**
 * Opens a local directory using File System Access API.
 * Shows directory picker and builds file tree from selected directory.
 * Follows Google Chrome Labs text-editor pattern.
 * 
 * UI component must call this from a user gesture context.
 * 
 * @param workspaceId - Optional workspace ID for storing the directory handle
 * @returns Promise with the directory name, path, and file tree
 * @throws Error if user cancels, API not supported, or permission denied
 */
export async function openLocalDirectory(
  workspaceId?: string
): Promise<{
  name: string;
  path: string;
  fileTree: FileNode[];
}> {
  const wsId = workspaceId ?? 'local';

  // Check if File System Access API is supported
  if (!LocalAdapter.isSupported) {
    throw new Error(
      'File System Access API is not supported in this browser. ' +
      'Please use a modern browser like Chrome 86+, Edge 86+, or Safari 15.2+.'
    );
  }

  // Import handle-store functions
  const { openDirectoryPicker, setHandle, verifyAndRequestPermission } = await import('@/core/sync/handle-store');

  // Open directory picker (requires user gesture)
  const handle = await openDirectoryPicker();
  if (!handle) {
    throw new Error('Directory access was denied or cancelled. Please try again.');
  }

  // Verify and request permission (requires user gesture)
  const granted = await verifyAndRequestPermission(handle, true);
  if (!granted) {
    throw new Error('Permission denied to read/write the selected directory.');
  }

  // Save handle to IndexedDB
  await setHandle(wsId, handle);

  // Mount workspace and pull files
  await getSyncManager().mountWorkspace(wsId, 'local');

  // Build file tree from adapter (files now in RxDB)
  const tree = await buildFileTreeFromAdapter(undefined, '', 'local-', WorkspaceType.Local, workspaceId);
  return { name: workspaceId ?? 'Local', path: workspaceId ?? '/', fileTree: tree };
}

/**
 * Restores a previously opened local directory from IndexedDB
 * Used to persist directory access across browser sessions
 * 
 * NOTE: This only checks permission, does NOT request it (requires user gesture).
 * If permission check fails, caller should prompt user to grant permission.
 * 
 * @param workspaceId - Workspace ID used when storing the directory
 * @returns Promise with the directory data or null if not found/permission denied
 */
export async function restoreLocalDirectory(workspaceId: string): Promise<{
  name: string;
  path: string;
  fileTree: FileNode[];
} | null> {
  try {
    const { getHandle, checkPermission } = await import('@/core/sync/handle-store');

    // Get stored handle
    const handle = await getHandle(workspaceId);
    if (!handle) {
      console.warn('No stored handle for workspace:', workspaceId);
      return null;
    }

    // Check permission (don't request - requires user gesture)
    const hasPermission = await checkPermission(handle, true);
    if (!hasPermission) {
      console.warn('Permission not granted for workspace:', workspaceId);
      return null; // Caller should prompt user to grant permission
    }

    // Mount workspace and pull files
    await getSyncManager().mountWorkspace(workspaceId, 'local');

    const tree = await buildFileTreeFromAdapter(undefined, '', 'local-', WorkspaceType.Local, workspaceId);
    return { name: workspaceId, path: workspaceId, fileTree: tree };
  } catch (error) {
    console.error('Error restoring directory:', error);
    return null;
  }
}

/**
 * Prompt the user (via a click/gesture) to re-request permission for a stored workspace.
 * Returns the directory data if permission is granted and the tree can be built.
 * 
 * MUST be called from a user gesture context.
 */
export async function promptPermissionAndRestore(workspaceId: string): Promise<{
  name: string;
  path: string;
  fileTree: FileNode[];
} | null> {
  try {
    const { getHandle, verifyAndRequestPermission } = await import('@/core/sync/handle-store');

    // Get stored handle
    const handle = await getHandle(workspaceId);
    if (!handle) {
      console.error('No stored handle for workspace:', workspaceId);
      return null;
    }

    // Request permission (requires user gesture)
    const granted = await verifyAndRequestPermission(handle, true);
    if (!granted) {
      console.warn('User denied permission for workspace:', workspaceId);
      return null;
    }

    // Mount workspace and build tree
    await getSyncManager().mountWorkspace(workspaceId, 'local');
    const tree = await buildFileTreeFromAdapter(undefined, '', 'local-', WorkspaceType.Local, workspaceId);
    return { name: workspaceId, path: workspaceId, fileTree: tree };
  } catch (error) {
    console.error('Error prompting permission and restoring directory:', error);
    return null;
  }
}

/**
 * Refreshes the file tree for the currently opened local directory
 * Re-scans the directory to pick up any external changes
 * 
 * @returns Promise with the updated file tree or null if no directory is open
 */
export async function refreshLocalDirectory(): Promise<FileNode[] | null> {
  // Rebuild tree from cache for the active local workspace
  try {
    // Attempt to discover active workspace id
    const activeWs = (await import('@/core/store/workspace-store')).useWorkspaceStore.getState().activeWorkspace?.();
    const wsId = activeWs?.id;
    const tree = await buildFileTreeFromAdapter(undefined, '', 'local-', WorkspaceType.Local, wsId);
    return tree;
  } catch (e) {
    console.warn('refreshLocalDirectory failed:', e);
    return null;
  }
}

/**
 * Checks if a local directory is currently open
 * 
 * @returns true if a directory handle exists
 */
export async function hasLocalDirectoryAsync(): Promise<boolean> {
  const { useWorkspaceStore } = await import('@/core/store/workspace-store');
  const activeWs = useWorkspaceStore.getState().activeWorkspace?.();
  if (!activeWs || activeWs.type !== 'local') return false;
  return LocalAdapter.hasPersistedHandle(activeWs.id);
}

/**
 * Clears the currently open local directory
 * Removes the global directory handle reference
 */
export async function clearLocalDirectory(): Promise<void> {
  try {
    const { useWorkspaceStore } = await import('@/core/store/workspace-store');
    const wsId = useWorkspaceStore.getState().activeWorkspace?.()?.id;
    if (wsId) {
      getSyncManager().unmountWorkspace(wsId);
      await LocalAdapter.clearPersistedHandle(wsId);
    }
  } catch (_) {
    // ignore
  }
}
