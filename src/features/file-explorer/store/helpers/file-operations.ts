import { getDemoAdapter } from "@/hooks/use-demo-mode";

/**
 * Creates a new file in the specified location
 * Supports Google Drive, local file system, and demo mode
 * 
 * @param parentPath - Path of the parent folder (with prefix: 'gdrive-', 'local-', or empty for demo)
 * @param fileName - Name of the file to create
 * @throws Error if file creation fails
 */
export async function createFile(parentPath: string, fileName: string): Promise<void> {
  try {
    if (parentPath.startsWith('gdrive-')) {
      await createGoogleDriveFile(parentPath, fileName);
    } else if (parentPath.startsWith('local-')) {
      await createLocalFile(parentPath, fileName);
    } else {
      await createDemoFile(parentPath, fileName);
    }
  } catch (error) {
    console.error('Error creating file:', error);
    throw error;
  }
}

/**
 * Creates a new folder in the specified location
 * Supports Google Drive, local file system, and demo mode
 * 
 * @param parentPath - Path of the parent folder (with prefix)
 * @param folderName - Name of the folder to create
 * @throws Error if folder creation fails
 */
export async function createFolder(parentPath: string, folderName: string): Promise<void> {
  try {
    if (parentPath.startsWith('gdrive-')) {
      await createGoogleDriveFolder(parentPath, folderName);
    } else if (parentPath.startsWith('local-')) {
      await createLocalFolder(parentPath, folderName);
    } else {
      await createDemoFolder(parentPath, folderName);
    }
  } catch (error) {
    console.error('Error creating folder:', error);
    throw error;
  }
}

/**
 * Deletes a file or folder
 * Supports Google Drive, local file system, and demo mode
 * 
 * @param nodePath - Path of the node to delete (with prefix)
 * @param isFolder - Whether the node is a folder
 * @throws Error if deletion fails
 */
export async function deleteNode(nodePath: string, isFolder: boolean): Promise<void> {
  try {
    if (nodePath.startsWith('gdrive-')) {
      await deleteGoogleDriveNode(nodePath, isFolder);
    } else if (nodePath.startsWith('local-')) {
      await deleteLocalNode(nodePath, isFolder);
    } else {
      await deleteDemoNode(nodePath, isFolder);
    }
  } catch (error) {
    console.error('Error deleting:', error);
    throw error;
  }
}

/**
 * Renames a file or folder (currently only supports demo mode)
 * 
 * @param nodePath - Current path of the node
 * @param newName - New name for the node
 * @throws Error if rename fails or not supported
 */
export async function renameNode(nodePath: string, newName: string): Promise<void> {
  try {
    const isLocal = nodePath.startsWith('local-');

    if (isLocal) {
      alert('Rename is not yet supported for local files via File System Access API');
      return;
    }
    const adapter = getDemoAdapter();
    const fileData = await adapter.readFile(nodePath);
    await adapter.deleteFile(nodePath);

    const pathParts = nodePath.split('/');
    pathParts[pathParts.length - 1] = newName;
    const newPath = pathParts.join('/');

    await adapter.createFile(newPath, fileData.content, fileData.category);
  } catch (error) {
    console.error('Error renaming:', error);
    throw error;
  }
}

/**
 * Creates a file in Google Drive (local-first with background sync)
 */
async function createGoogleDriveFile(parentPath: string, fileName: string): Promise<void> {
  const { GoogleDriveAdapter } = await import('@/core/file-manager/adapters/google-drive-adapter');
  const folderId = parentPath.replace(/^gdrive-/, '');
  const adapter = new GoogleDriveAdapter(folderId);
  
  // Create locally first, then sync in background
  await adapter.createFileLocal(parentPath, fileName, '');
  
  // Notify UI to refresh immediately
  try {
    window.dispatchEvent(new CustomEvent('verve:gdrive:changed'));
  } catch (e) {
    // ignore
  }
}

/**
 * Creates a folder in Google Drive (local-first with background sync)
 */
async function createGoogleDriveFolder(parentPath: string, folderName: string): Promise<void> {
  const { GoogleDriveAdapter } = await import('@/core/file-manager/adapters/google-drive-adapter');
  const folderId = parentPath.replace(/^gdrive-/, '');
  const adapter = new GoogleDriveAdapter(folderId);
  
  // Create locally first, then sync in background
  await adapter.createFolderLocal(parentPath, folderName);
  
  // Notify UI to refresh immediately
  try {
    window.dispatchEvent(new CustomEvent('verve:gdrive:changed'));
  } catch (e) {
    // ignore
  }
}

/**
 * Deletes a file or folder in Google Drive (recursive for folders)
 */
async function deleteGoogleDriveNode(nodePath: string, isFolder: boolean): Promise<void> {
  const idPart = nodePath.replace(/^gdrive-/, '');
  const parts = idPart.split('/');
  const targetId = parts[0];
  
  const { requestDriveAccessToken } = await import('@/core/auth/google');
  const token = await requestDriveAccessToken(true);
  
  if (!token) throw new Error('Not authenticated with Google Drive');

  const deleteFile = async (fileId: string) => {
    await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  };

  if (isFolder) {
    const listChildren = async (parentId: string): Promise<string[]> => {
      const out: string[] = [];
      let pageToken: string | null = null;
      
      do {
        const q = encodeURIComponent(`'${parentId}' in parents and trashed = false`);
        const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=nextPageToken,files(id,mimeType)&pageSize=1000${pageToken ? `&pageToken=${pageToken}` : ''}`;
        const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        
        if (!resp.ok) break;
        
        const json = await resp.json();
        for (const f of json.files || []) {
          out.push(f.id);
          if (f.mimeType === 'application/vnd.google-apps.folder') {
            const child = await listChildren(f.id);
            out.push(...child);
          }
        }
        pageToken = json.nextPageToken || null;
      } while (pageToken);
      
      return out;
    };

    const all = await listChildren(targetId);
    for (const fid of all) {
      await deleteFile(fid);
    }
    await deleteFile(targetId);
  } else {
    await deleteFile(targetId);
  }
}

/**
 * Creates a file in the local file system
 */
async function createLocalFile(parentPath: string, fileName: string): Promise<void> {
  const dirHandle = (window as any).__localDirHandle;
  if (!dirHandle) throw new Error('No directory handle');

  const cleanPath = parentPath.replace(/^local-(file|dir)-/, '');
  const handle = await navigateToPath(dirHandle, cleanPath);
  
  const fileHandle = await handle.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write('');
  await writable.close();
}

/**
 * Creates a folder in the local file system
 */
async function createLocalFolder(parentPath: string, folderName: string): Promise<void> {
  const dirHandle = (window as any).__localDirHandle;
  if (!dirHandle) throw new Error('No directory handle');

  const cleanPath = parentPath.replace(/^local-(file|dir)-/, '');
  const handle = await navigateToPath(dirHandle, cleanPath);
  
  await handle.getDirectoryHandle(folderName, { create: true });
}

/**
 * Deletes a file or folder in the local file system
 */
async function deleteLocalNode(nodePath: string, isFolder: boolean): Promise<void> {
  const dirHandle = (window as any).__localDirHandle;
  if (!dirHandle) throw new Error('No directory handle');

  const cleanPath = nodePath.replace(/^local-(file|dir)-/, '');
  const pathParts = cleanPath.split('/');
  const fileName = pathParts.pop();
  
  const handle = await navigateToPath(dirHandle, pathParts.join('/'));
  
  if (isFolder) {
    await handle.removeEntry(fileName!, { recursive: true });
  } else {
    await handle.removeEntry(fileName!);
  }
}

/**
 * Navigates to a path in the directory handle
 */
async function navigateToPath(
  dirHandle: FileSystemDirectoryHandle, 
  path: string
): Promise<FileSystemDirectoryHandle> {
  const pathParts = path ? path.split('/') : [];
  let currentHandle = dirHandle;

  for (const part of pathParts) {
    currentHandle = await currentHandle.getDirectoryHandle(part);
  }

  return currentHandle;
}

/**
 * Creates a file in demo mode (localStorage)
 */
async function createDemoFile(parentPath: string, fileName: string): Promise<void> {
  const adapter = getDemoAdapter();
  const fullPath = parentPath ? `${parentPath}/${fileName}` : `/${fileName}`;
  await adapter.createFile(fullPath, '', parentPath || 'demo');
}

/**
 * Creates a folder in demo mode (creates a .keep placeholder file)
 */
async function createDemoFolder(parentPath: string, folderName: string): Promise<void> {
  const adapter = getDemoAdapter();
  const fullPath = parentPath ? `${parentPath}/${folderName}/.keep` : `/${folderName}/.keep`;
  await adapter.createFile(fullPath, '', parentPath || 'demo');
}

/**
 * Deletes a file or folder in demo mode
 * For folders, deletes all files that start with the folder path
 */
async function deleteDemoNode(nodePath: string, isFolder: boolean): Promise<void> {
  const adapter = getDemoAdapter();
  
  if (isFolder) {
    const tree = await adapter.getFileTree();
    const allFiles = getAllFiles(tree);
    const filesToDelete = allFiles.filter(f => f.startsWith(nodePath));
    
    for (const file of filesToDelete) {
      await adapter.deleteFile(file);
    }
  } else {
    await adapter.deleteFile(nodePath);
  }
}

/**
 * Recursively gets all file paths from a demo file tree
 */
function getAllFiles(obj: any, basePath: string = ''): string[] {
  const files: string[] = [];
  
  for (const [key, value] of Object.entries(obj)) {
    const path = basePath ? `${basePath}/${key}` : key;
    
    if (value && typeof value === 'object' && 'content' in value) {
      files.push(`/${path}`);
    } else if (value && typeof value === 'object') {
      files.push(...getAllFiles(value, path));
    }
  }
  
  return files;
}
