import { FileNode } from "@/shared/types";
import { MARKDOWN_EXTENSIONS, CODE_EXTENSIONS, TEXT_EXTENSIONS } from "@/shared/utils/file-type-detector";

/**
 * Builds a file tree from a local directory handle
 * 
 * @param handle - FileSystemDirectoryHandle from File System Access API
 * @param path - Current path in the tree (for recursive calls)
 * @returns Promise<FileNode[]> - Array of file nodes sorted by type and name
 * 
 * @example
 * const dirHandle = await window.showDirectoryPicker();
 * const tree = await buildFileTreeFromDirectory(dirHandle);
 */
export async function buildFileTreeFromDirectory(
  handle: FileSystemDirectoryHandle,
  path: string = ''
): Promise<FileNode[]> {
  const nodes: FileNode[] = [];
  const allowedExtensions = [...MARKDOWN_EXTENSIONS, ...CODE_EXTENSIONS, ...TEXT_EXTENSIONS];
  // @ts-ignore - values() is a valid method on FileSystemDirectoryHandle
  for await (const entry of handle.values()) {
    const entryPath = path ? `${path}/${entry.name}` : entry.name;

    if (entry.kind === 'file') {
      const hasAllowedExt = allowedExtensions.some(ext => entry.name.toLowerCase().endsWith(ext));
      
      if (hasAllowedExt) {
        nodes.push({
          id: `local-file-${entryPath}`,
          name: entry.name,
          path: entryPath,
          type: 'file',
        });
      }
    } else if (entry.kind === 'directory') {
      const children = await buildFileTreeFromDirectory(entry, entryPath);
      if (children.length > 0) {
        nodes.push({
          id: `local-dir-${entryPath}`,
          name: entry.name,
          path: entryPath,
          type: 'folder',
          children,
        });
      }
    }
  }

  return sortFileNodes(nodes);
}

/**
 * Sorts file nodes: folders first, then files, alphabetically
 * 
 * @param nodes - Array of file nodes to sort
 * @returns Sorted array of file nodes
 */
export function sortFileNodes(nodes: FileNode[]): FileNode[] {
  return nodes.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'folder' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

/**
 * Gets all folder IDs from a file tree recursively
 * Used for expanding all folders in the UI
 * 
 * @param nodes - Array of file nodes to traverse
 * @returns Array of folder IDs
 */
export function getAllFolderIds(nodes: FileNode[]): string[] {
  const ids: string[] = [];
  
  for (const node of nodes) {
    if (node.type === 'folder') {
      ids.push(node.id);
      if (node.children) {
        ids.push(...getAllFolderIds(node.children));
      }
    }
  }
  
  return ids;
}
