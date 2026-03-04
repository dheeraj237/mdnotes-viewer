/**
 * Unified FileNode Type
 * Single source of truth for all file representations across:
 * - UI components (file explorer, editor)
 * - Stores (file-explorer-store, editor-store)
 * - Persistence (RxDB)
 * - Sync operations (push/pull with adapters)
 */
export interface FileNode {
  // ========== CORE IDENTITY ==========
  id: string; // Unique identifier (workspace-scoped)
  path: string; // '/parent/child/file.md' (workspace root relative)
  name: string; // 'file.md'

  // ========== TYPE & HIERARCHY ==========
  type: FileType; // 'file' | 'directory'
  parentId?: string | null; // Parent directory ID (null for root)
  children?: FileNode[]; // Nested objects for UI tree rendering (lazy-built)

  // ========== CONTENT (LAZY-LOADED) ==========
  content?: string; // Omitted by default, loaded on demand via getFileNodeWithContent()
  contentHash?: string; // SHA-256 hash for change detection

  // ========== METADATA ==========
  size?: number; // File size in bytes
  mimeType?: string; // 'text/markdown', 'application/json', etc.

  // ========== TIMESTAMPS (NORMALIZED) ==========
  createdAt?: string; // ISO 8601 timestamp
  modifiedAt?: string; // ISO 8601 timestamp (canonical, used everywhere)

  // ========== WORKSPACE CONTEXT ==========
  workspaceId?: string; // Which workspace this file belongs to (may be inferred)
  workspaceType?: WorkspaceType; // 'browser' | 'local' | 'gdrive' | 's3' (may be inferred)

  // ========== SYNC STATE ==========
  dirty?: boolean; // Has unsaved changes (defaults to false)
  isSynced?: boolean; // Successfully synced to remote (defaults to false)
  syncStatus?: 'idle' | 'syncing' | 'conflict' | 'error'; // Current sync state (defaults to idle)
  version?: number; // Conflict detection & merge tracking (defaults to 0)

  // ========== EDITOR SUPPORT ==========
  isLocal?: boolean; // Opened via File System Access API
  fileHandle?: FileSystemFileHandle; // Browser File System API handle
}

/**
 * File type enumeration (unified)
 * Replaces old FileNodeType and FileType enums
 */
export enum FileType {
  File = 'file',
  Directory = 'directory',
}

/**
 * Workspace type enumeration
 * Determines which adapters to use for sync
 */
export enum WorkspaceType {
  Browser = 'browser',
  Local = 'local',
  GDrive = 'gdrive',
  S3 = 's3',
}

export enum ViewMode {
  Code = 'code',
  Live = 'live',
  Preview = 'preview',
}

export interface EditorState {
  currentFile: FileNode | null;
  viewMode: ViewMode;
  isLoading: boolean;
}

export interface Feature {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  experimental?: boolean;
  description?: string;
}

export interface OpenedFile {
  id: string;
  name: string;
  path: string;
  isActive: boolean;
  isDirty: boolean; // Has unsaved changes
  workspaceId: string;
}
