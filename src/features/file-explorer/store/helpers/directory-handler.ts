import { FileNode } from "@/shared/types";
import { buildFileTreeFromDirectory } from "./file-tree-builder";
import { storeDirectoryHandle, getDirectoryHandle } from "@/shared/utils/idb-storage";
import { requestPermissionForWorkspace } from "@/shared/utils/idb-storage";

/**
 * Opens a local directory using File System Access API
 * Shows directory picker and builds file tree from selected directory
 * Optionally stores the directory handle in IndexedDB for later restoration
 * 
 * @param workspaceId - Optional workspace ID for storing the directory handle
 * @returns Promise with the directory name, path, and file tree
 * @throws Error if user cancels or API not supported
 */
export async function openLocalDirectory(workspaceId?: string): Promise<{
  name: string;
  path: string;
  fileTree: FileNode[];
}> {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  if (!('showDirectoryPicker' in window)) {
    if (isIOS) {
      throw new Error(
        'File System Access is not supported on iOS. Please use a Chromium-based browser on desktop (Chrome, Edge, Brave) to access your local files. The app currently supports reading the default content folder on all devices.'
      );
    }
    throw new Error('Directory Picker is not supported in this browser. Please use Chrome, Edge, or another Chromium-based browser.');
  }

  const dirHandle = await (window as any).showDirectoryPicker();

  if (workspaceId) {
    try {
      await storeDirectoryHandle(workspaceId, dirHandle);
    } catch (error) {
      console.error('Failed to store directory handle:', error);
    }
  }

  const fileTree = await buildFileTreeFromDirectory(dirHandle);

  (window as any).__localDirHandle = dirHandle;

  return { name: dirHandle.name, path: dirHandle.name, fileTree };
}

/**
 * Restores a previously opened local directory from IndexedDB
 * Used to persist directory access across browser sessions
 * 
 * @param workspaceId - Workspace ID used when storing the directory
 * @returns Promise with the directory data or null if not found/failed
 */
export async function restoreLocalDirectory(workspaceId: string): Promise<{
  name: string;
  path: string;
  fileTree: FileNode[];
} | null> {
  try {
    const dirHandle = await getDirectoryHandle(workspaceId);
    if (!dirHandle) return null;
    const fileTree = await buildFileTreeFromDirectory(dirHandle);
    (window as any).__localDirHandle = dirHandle;
    return { name: dirHandle.name, path: dirHandle.name, fileTree };
  } catch (error) {
    console.error('Error restoring directory:', error);
    return null;
  }
}

/**
 * Prompt the user (via a click/gesture) to re-request permission for a stored workspace.
 * Returns the directory data if permission is granted and the tree can be built.
 */
export async function promptPermissionAndRestore(workspaceId: string): Promise<{
  name: string;
  path: string;
  fileTree: FileNode[];
} | null> {
  try {
    const handle = await requestPermissionForWorkspace(workspaceId);
    if (!handle) return null;

    // If granted, build the file tree
    const fileTree = await buildFileTreeFromDirectory(handle);
    (window as any).__localDirHandle = handle;
    return { name: handle.name, path: handle.name, fileTree };
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
  const dirHandle = (window as any).__localDirHandle;
  if (!dirHandle) return null;
  const fileTree = await buildFileTreeFromDirectory(dirHandle);
  return fileTree;
}

/**
 * Checks if a local directory is currently open
 * 
 * @returns true if a directory handle exists
 */
export function hasLocalDirectory(): boolean {
  return !!(window as any).__localDirHandle;
}

/**
 * Clears the currently open local directory
 * Removes the global directory handle reference
 */
export function clearLocalDirectory(): void {
  delete (window as any).__localDirHandle;
}
