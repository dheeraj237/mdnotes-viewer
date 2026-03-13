/**
 * LocalAdapter — simplified v2 adapter for local filesystem workspaces.
 *
 * Implements IAdapter: pull (filesystem → RxDB), push (RxDB → filesystem),
 * ensurePermission (public, call from user-gesture handler), filter contract,
 * and destroy (short-circuits any in-flight pull via _destroyed flag).
 *
 * Handle persistence is delegated to handle-store.ts (vanilla IndexedDB, no Dexie).
 * Filter rules are loaded from workspace-ignore.json at module load time.
 */

import type { IAdapter } from '../adapter';
import { getHandle, setHandle } from '../handle-store';
import { upsertCachedFile } from '@/core/cache/file-manager';
import { FileType, WorkspaceType } from '@/core/cache/types';
import ignoreConfig from '../workspace-ignore.json';

/**
 * Thrown by ensureHandle() when no granted filesystem permission exists.
 * SyncManager catches this and sets permissionNeeded:true on the workspace store
 * so the UI can render a "Grant Access" button that calls ensurePermission().
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

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
  }

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

  /**
   * Walks the directory tree and upserts every included file into RxDB
   * with dirty:false, isSynced:true.
   *
   * @param signal - Checked before each directory level to short-circuit stale
   *   pulls on rapid workspace switches.
   */
  async pull(signal?: AbortSignal): Promise<void> {
    const handle = await this.ensureHandle('read');
    await this._walkDir(handle, '', signal);
  }

  private async _walkDir(
    dirHandle: FileSystemDirectoryHandle,
    prefix: string,
    signal?: AbortSignal,
  ): Promise<void> {
    if (signal?.aborted || this._destroyed) return;

    for await (const [name, entry] of (dirHandle as any)) {
      if (signal?.aborted || this._destroyed) return;

      if (entry.kind === 'directory') {
        if (!this.shouldIncludeFolder(name)) continue;
        const childPrefix = prefix ? `${prefix}/${name}` : name;
        await this._walkDir(entry as FileSystemDirectoryHandle, childPrefix, signal);
      } else {
        const relPath = prefix ? `${prefix}/${name}` : name;
        const file: File = await (entry as FileSystemFileHandle).getFile();
        if (!this.shouldIncludeFile(relPath, name, file.size)) continue;

        if (signal?.aborted || this._destroyed) return;

        const content = await file.text();

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
   * Writes content to the workspace-relative path on the local filesystem,
   * creating intermediate directories as needed.
   */
  async push(path: string, content: string): Promise<void> {
    const rootHandle = await this.ensureHandle('readwrite');
    const segments = path.split('/').filter(Boolean);
    const fileName = segments.pop()!;

    let dir: FileSystemDirectoryHandle = rootHandle;
    for (const seg of segments) {
      dir = await dir.getDirectoryHandle(seg, { create: true });
    }

    const fileHandle = await dir.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    try {
      await writable.write(content);
    } finally {
      await writable.close();
    }
  }

  /**
   * Ensures readwrite permission is granted, showing native dialogs as needed.
   * MUST be called from a direct user-gesture handler (e.g. a button click)
   * because requestPermission() requires a live user activation.
   *
   * @returns true if permission was granted, false if the user cancelled.
   */
  async ensurePermission(): Promise<boolean> {
    try {
      if (this._dirHandle) {
        const status = await (this._dirHandle as any).queryPermission({ mode: 'readwrite' });
        if (status === 'granted') return true;
        const requested = await (this._dirHandle as any).requestPermission({ mode: 'readwrite' });
        if (requested === 'granted') return true;
      }

      if (!('showDirectoryPicker' in window)) return false;
      const picked: FileSystemDirectoryHandle = await (window as any).showDirectoryPicker({
        mode: 'readwrite',
      });
      this._dirHandle = picked;
      await setHandle(this.workspaceId, picked);
      return true;
    } catch (err: any) {
      if (err?.name === 'AbortError') return false;
      throw err;
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

  /**
   * Returns a workspace-scoped, deterministic file ID so the same path always
   * maps to the same RxDB document across repeated pulls.
   */
  private _fileId(relPath: string): string {
    return `${this.workspaceId}:${relPath}`;
  }

  /**
   * Returns a granted directory handle for the requested access mode.
   * Tries the in-memory cache first, then the IndexedDB-persisted handle,
   * calling requestPermission() at each step before giving up.
   *
   * @throws {PermissionError} when no granted handle can be obtained without a user gesture.
   */
  private async ensureHandle(mode: PermissionMode): Promise<FileSystemDirectoryHandle> {
    if (this._dirHandle) {
      const status = await (this._dirHandle as any).queryPermission({ mode });
      if (status === 'granted') return this._dirHandle;
      if (status === 'prompt') {
        const requested = await (this._dirHandle as any).requestPermission({ mode });
        if (requested === 'granted') return this._dirHandle;
      }
    }

    const persisted = await getHandle(this.workspaceId);
    if (persisted) {
      const status = await (persisted as any).queryPermission({ mode });
      if (status === 'granted') {
        this._dirHandle = persisted;
        return persisted;
      }
      if (status === 'prompt') {
        const requested = await (persisted as any).requestPermission({ mode });
        if (requested === 'granted') {
          this._dirHandle = persisted;
          return persisted;
        }
      }
    }

    throw new PermissionError(
      `No granted ${mode} permission for workspace "${this.workspaceId}". ` +
        'Call adapter.ensurePermission() during a user gesture.',
    );
  }
}
