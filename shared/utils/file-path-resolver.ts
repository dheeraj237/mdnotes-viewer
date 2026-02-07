/**
 * File path resolution utilities for markdown link navigation
 * Handles relative paths, wiki links, and file tree searching
 */

import { FileNode } from "@/shared/types";

/**
 * Normalize a path by resolving . and .. segments
 */
export function normalizePath(path: string): string {
  const parts = path.split('/').filter(Boolean);
  const result: string[] = [];

  for (const part of parts) {
    if (part === '..') {
      result.pop();
    } else if (part !== '.') {
      result.push(part);
    }
  }

  return result.join('/');
}

/**
 * Resolve a relative link against a base file path
 * @param currentFilePath - Current file's path (e.g., "topics/answers/01-file.md")
 * @param linkHref - Link href from markdown (e.g., "../02-file.md" or "./subfolder/file.md")
 * @returns Resolved absolute path or null if invalid
 */
export function resolveRelativePath(currentFilePath: string, linkHref: string): string | null {
  // Handle empty or invalid links
  if (!linkHref || !currentFilePath) {
    return null;
  }

  // Remove any URL fragments or query params
  const cleanHref = linkHref.split('#')[0].split('?')[0].trim();
  
  if (!cleanHref) {
    return null;
  }

  // If it's an absolute URL, return null (not a local file)
  if (/^https?:\/\//i.test(cleanHref) || /^mailto:/i.test(cleanHref)) {
    return null;
  }

  // Get the directory of the current file
  const currentDir = currentFilePath.split('/').slice(0, -1).join('/');

  let resolvedPath: string;

  if (cleanHref.startsWith('/')) {
    // Absolute path from root (e.g., "/topics/file.md")
    resolvedPath = cleanHref.slice(1); // Remove leading slash
  } else if (cleanHref.startsWith('./') || cleanHref.startsWith('../')) {
    // Relative path (e.g., "./file.md" or "../file.md")
    const combined = currentDir ? `${currentDir}/${cleanHref}` : cleanHref;
    resolvedPath = normalizePath(combined);
  } else {
    // No prefix, treat as relative to current directory
    const combined = currentDir ? `${currentDir}/${cleanHref}` : cleanHref;
    resolvedPath = normalizePath(combined);
  }

  return resolvedPath;
}

/**
 * Check if a link is a markdown file link
 */
export function isMarkdownFileLink(href: string): boolean {
  if (!href) return false;
  
  // Exclude external URLs
  if (/^https?:\/\//i.test(href) || /^mailto:/i.test(href)) {
    return false;
  }

  // Exclude anchor links
  if (href.startsWith('#')) {
    return false;
  }

  // Check for markdown extensions
  const cleanHref = href.split('#')[0].split('?')[0].trim();
  return /\.(md|markdown)$/i.test(cleanHref);
}

/**
 * Check if a link is a wiki-style link [[Link]]
 */
export function isWikiLink(text: string): boolean {
  return /^\[\[.+\]\]$/.test(text);
}

/**
 * Parse wiki-style link [[Page Name]] or [[path/to/file]]
 * Returns the target page name or path
 */
export function parseWikiLink(text: string): string | null {
  const match = text.match(/^\[\[(.+?)\]\]$/);
  if (!match) return null;
  
  let target = match[1].trim();
  
  // If target doesn't have extension, add .md
  if (!target.match(/\.(md|markdown)$/i)) {
    target += '.md';
  }
  
  return target;
}

/**
 * Search for a file in the file tree by path
 * @param fileTree - Root file tree nodes
 * @param targetPath - Path to search for (can be partial)
 * @returns FileNode if found, null otherwise
 */
export function findFileInTree(fileTree: FileNode[], targetPath: string): FileNode | null {
  if (!targetPath || !fileTree) {
    return null;
  }

  const normalizedTarget = normalizePath(targetPath);
  
  function searchNode(node: FileNode): FileNode | null {
    // Match exact path
    if (node.type === 'file' && node.path === normalizedTarget) {
      return node;
    }

    // Search in children
    if (node.children) {
      for (const child of node.children) {
        const result = searchNode(child);
        if (result) return result;
      }
    }

    return null;
  }

  // Search through all root nodes
  for (const node of fileTree) {
    const result = searchNode(node);
    if (result) return result;
  }

  // Try case-insensitive search as fallback
  function searchNodeCaseInsensitive(node: FileNode): FileNode | null {
    if (node.type === 'file' && node.path.toLowerCase() === normalizedTarget.toLowerCase()) {
      return node;
    }

    if (node.children) {
      for (const child of node.children) {
        const result = searchNodeCaseInsensitive(child);
        if (result) return result;
      }
    }

    return null;
  }

  for (const node of fileTree) {
    const result = searchNodeCaseInsensitive(node);
    if (result) return result;
  }

  return null;
}

/**
 * Get basename from path
 */
export function getBasename(path: string): string {
  return path.split('/').pop() || path;
}

/**
 * Search for a file by name only (when path resolution fails)
 * Useful for wiki links like [[File Name]]
 */
export function findFileByName(fileTree: FileNode[], fileName: string): FileNode | null {
  if (!fileName || !fileTree) {
    return null;
  }

  const normalizedName = fileName.toLowerCase();

  function searchNode(node: FileNode): FileNode | null {
    if (node.type === 'file' && node.name.toLowerCase() === normalizedName) {
      return node;
    }

    if (node.children) {
      for (const child of node.children) {
        const result = searchNode(child);
        if (result) return result;
      }
    }

    return null;
  }

  for (const node of fileTree) {
    const result = searchNode(node);
    if (result) return result;
  }

  return null;
}
