/**
 * LocalAdapter — local filesystem adapter following Google Chrome Labs patterns.
 *
 * Based on: https://github.com/GoogleChromeLabs/text-editor
 * API Reference: https://developer.chrome.com/docs/capabilities/web-apis/file-system-access
 *
 * Implements IAdapter: pull (filesystem → RxDB), push (RxDB → filesystem),
 * ensurePermission (public, call from user-gesture handler), filter contract,
 * and destroy (short-circuits any in-flight pull via _destroyed flag).
 *
 * Permission flow (matching Chrome Labs text-editor pattern):
 *  1. verifyPermission() — checks queryPermission, then requestPermission if needed  
 *  2. getDirectoryHandle() — opens native picker via directory-picker module
 *  3. ensureHandle() — checks in-memory → IDB-persisted → throws PermissionError
 *
 * Handle persistence is delegated to handle-store.ts (vanilla IndexedDB, no Dexie).
 * Filter rules are loaded from workspace-ignore.json at module load time.
 */

import type { IAdapter } from '../adapter';
import { getHandle, setHandle, removeHandle, checkPermission } from '../handle-store';
import { isFileSystemAccessSupported } from '../directory-picker';
import { upsertCachedFile } from '@/core/cache/file-manager';
import { FileType, WorkspaceType } from '@/core/cache/types';
import ignoreConfig from '../workspace-ignore.json';

/**
 * Thrown by ensureHandle() when no granted filesystem permission exists.
 * UI components should catch this and prompt the user to grant permissions.
 */
export class PermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermissionError';
  }
}

type PermissionMode = 'read' | 'readwrite';

export class LocalAdapter implements IAdapter {
  readonly workspaceId: string;
  readonly type = 'local' as const;

  private _dirHandle: FileSystemDirectoryHandle | null = null;
  private _destroyed = false;

  /**
   * Check if the File System Access API is supported in this browser.
   * Based on Google Chrome Labs text-editor pattern.
   */
  static get isSupported(): boolean {
    return isFileSystemAccessSupported();
  }

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
  }

  // ---------------------------------------------------------------------------
  // Static helpers — used by directory-handler.ts to avoid direct IDB imports
  // ---------------------------------------------------------------------------

  /**
   * Returns true when a persisted FileSystemDirectoryHandle exists in IndexedDB
   * for the given workspace. Does NOT verify that the handle still has permission.
   */
  static async hasPersistedHandle(workspaceId: string): Promise<boolean> {
    const handle = await getHandle(workspaceId);
    return handle != null;
  }

  /**
   * Removes the persisted FileSystemDirectoryHandle for the given workspace
   * from IndexedDB. Used when clearing / deleting a local workspace.
   */
  static async clearPersistedHandle(workspaceId: string): Promise<void> {
    await removeHandle(workspaceId);
  }

  // ---------------------------------------------------------------------------
  // IAdapter — filter contract
  // ---------------------------------------------------------------------------

  /** @inheritdoc */
  shouldIncludeFolder(name: string): boolean {
    return !ignoreConfig.ignoreFolders.includes(name);
  }

  /** @inheritdoc */
  shouldIncludeFile(path: string, name: string, sizeBytes: number): boolean {
    if (ignoreConfig.ignoreNames.includes(name)) return false;
    const ext = name.includes('.') ? `.${name.split('.').pop()!.toLowerCase()}` : '';
    if (ext && ignoreConfig.ignoreExtensions.includes(ext)) return false;
    if (sizeBytes > ignoreConfig.maxFileSizeMB * 1024 * 1024) return false;
    return true;
  }

  // ---------------------------------------------------------------------------
  // IAdapter — pull / push / ensurePermission / destroy
  // ---------------------------------------------------------------------------

  /**
   * Reads all files from the directory into RxDB cache.
   * Follows Google Chrome Labs pattern for file reading.
   *
   * @param signal - Checked before each directory level to short-circuit stale
   *   pulls on rapid workspace switches.
   */
  async pull(signal?: AbortSignal): Promise<void> {
    const handle = await this.ensureHandle('read');
    await this._walkDir(handle, '', signal);
  }

  /**
   * Writes content to disk following Google Chrome Labs writeFile pattern.
   * Creates intermediate directories as needed.
   *
   * @param path - Relative path within the workspace
   * @param content - File content to write
   * @throws {PermissionError} if write permission not granted
   */
  async push(path: string, content: string): Promise<void> {
    const rootHandle = await this.ensureHandle('readwrite');
    const segments = path.split('/').filter(Boolean);
    const fileName = segments.pop()!;

    // Navigate to the target directory, creating as needed
    let dir: FileSystemDirectoryHandle = rootHandle;
    for (const seg of segments) {
      dir = await dir.getDirectoryHandle(seg, { create: true });
    }

    // Get file handle and write using createWritable pattern (Chrome 83+)
    const fileHandle = await dir.getFileHandle(fileName, { create: true });

    // Create a FileSystemWritableFileStream to write to
    const writable = await fileHandle.createWritable();
    try {
      // Write the contents of the file to the stream
      await writable.write(content);
    } finally {
      // Close the file and write the contents to disk
      await writable.close();
    }
  }

  /**
   * Marks the adapter as destroyed and releases the directory handle.
   * Any in-flight _walkDir stops at its next iteration check.
   */
  destroy(): void {
    this._destroyed = true;
    this._dirHandle = null;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Returns a granted directory handle for the requested access mode.
   *
   * Tries in-memory cached handle first, then IndexedDB-persisted handle.
   * Only checks permission (does NOT request) - throws PermissionError if not granted.
   *
   * NOTE: UI components are responsible for requesting permissions via user gestures.
   * This method only validates that permissions exist.
   *
   * @throws {PermissionError} when no granted handle can be obtained
   */
  private async ensureHandle(mode: PermissionMode): Promise<FileSystemDirectoryHandle> {
    const needsWrite = mode === 'readwrite';

    // Try in-memory handle
    if (this._dirHandle && (await checkPermission(this._dirHandle, needsWrite))) {
      return this._dirHandle;
    }

    // Try IDB-persisted handle
    const persisted = await getHandle(this.workspaceId);
    if (persisted) {
      if (await checkPermission(persisted, needsWrite)) {
        this._dirHandle = persisted;
        return persisted;
      }
      // Handle exists but permission not granted
      throw new PermissionError(
        `Permission not granted for workspace "${this.workspaceId}". ` +
        'User must grant permission from UI.'
      );
    }

    // No handle stored
    throw new PermissionError(
      `No directory handle found for workspace "${this.workspaceId}". ` +
      'User must select a directory from UI.'
    );
  }

  /**
   * Reads a file's content following Google Chrome Labs pattern.
   * Uses file.text() API for modern browsers.
   *
   * @param file - File object from FileSystemFileHandle.getFile()
   * @returns Promise resolving to file content as string
   */
  private async readFile(file: File): Promise<string> {
    // Use the modern .text() reader if available (it is in all modern browsers)
    if (file.text) {
      return file.text();
    }
    // Fallback for older browsers (unlikely to be needed)
    return this._readFileLegacy(file);
  }

  /**
   * Legacy file reading using FileReader (fallback for older browsers).
   * Based on Google Chrome Labs text-editor pattern.
   */
  private _readFileLegacy(file: File): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.addEventListener('loadend', (e) => {
        const text = (e.target as FileReader).result as string;
        resolve(text);
      });
      reader.readAsText(file);
    });
  }

  /**
   * Recursively walks the directory tree, reading and upserting files into RxDB.
   * Respects filter rules for folders and files.
   *
   * @param dirHandle - The directory to walk
   * @param prefix - Accumulated relative path prefix for nested entries
   * @param signal - AbortSignal to short-circuit stale traversals
   */
  private async _walkDir(
    dirHandle: FileSystemDirectoryHandle,
    prefix: string,
    signal?: AbortSignal,
  ): Promise<void> {
    if (signal?.aborted || this._destroyed) return;

    for await (const [name, entry] of (dirHandle as any)) {
      if (signal?.aborted || this._destroyed) return;

      if (entry.kind === 'directory') {
        // Check folder filter rules
        if (!this.shouldIncludeFolder(name)) continue;
        const childPrefix = prefix ? `${prefix}/${name}` : name;
        await this._walkDir(entry as FileSystemDirectoryHandle, childPrefix, signal);
      } else {
        const relPath = prefix ? `${prefix}/${name}` : name;

        // Get file from handle
        const fileHandle = entry as FileSystemFileHandle;
        const file: File = await fileHandle.getFile();

        // Check file filter rules
        if (!this.shouldIncludeFile(relPath, name, file.size)) continue;

        if (signal?.aborted || this._destroyed) return;

        // Read file content using Google Chrome Labs pattern
        const content = await this.readFile(file);

        // Upsert into RxDB cache with dirty:false, isSynced:true
        await upsertCachedFile({
          id: this._fileId(relPath),
          path: relPath,
          name,
          type: FileType.File,
          workspaceId: this.workspaceId,
          workspaceType: WorkspaceType.Local,
          content,
          size: file.size,
          dirty: false,
          isSynced: true,
          modifiedAt: new Date(file.lastModified).toISOString(),
        });
      }
    }
  }

  /**
   * Returns a workspace-scoped, deterministic file ID so the same path always
   * maps to the same RxDB document across repeated pulls.
   */
  private _fileId(relPath: string): string {
    return `${this.workspaceId}:${relPath}`;
  }
}
