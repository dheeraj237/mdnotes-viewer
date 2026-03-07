/**
 * Sync System Types
 * 
 * Clean, minimal interfaces for adapters and the sync manager.
 * All adapters follow this contract and interact with RxDB directly.
 */

import type { FileNode } from '@/shared/types';

/**
 * Adapter capabilities - what operations this adapter supports
 */
export interface AdapterCapabilities {
  canPush: boolean;        // Can push files to remote
  canPull: boolean;        // Can pull individual files from remote
  canList: boolean;        // Can list files in remote
  canPullWorkspace: boolean; // Can sync entire workspace from remote
}

/**
 * Context provided when initializing an adapter for a workspace
 */
export interface AdapterInitContext {
  workspaceId: string;
  workspaceType: string;
  dirHandle?: FileSystemDirectoryHandle;
  rxdbClient: any; // RxDB database instance
  [key: string]: any;
}

/**
 * Lifecycle events emitted by adapters
 */
export type AdapterEvent = 
  | { type: 'ready'; workspaceId: string }
  | { type: 'error'; code: string; message: string }
  | { type: 'state-changed'; state: string };

/**
 * Core adapter interface - all adapters must implement this
 * 
 * Key: Adapters DO NOT call SyncManager back. They only:
 * 1. Receive operations (push/pull/pullWorkspace)
 * 2. Interact with RxDB directly to update file status
 * 3. Emit events to notify of state changes
 */
export interface ISyncAdapter {
  name: string;
  capabilities: AdapterCapabilities;

  /**
   * Initialize adapter for a workspace
   */
  initialize(context: AdapterInitContext): Promise<void>;

  /**
   * Destroy adapter and cleanup resources
   */
  destroy(): Promise<void>;

  /**
   * Check if adapter is ready to perform I/O
   */
  isReady(): boolean;

  /**
   * Push a file to remote - adapter must update RxDB to mark file clean after success
   */
  push?(file: FileNode, rxdbClient: any): Promise<void>;

  /**
   * Pull a specific file from remote
   */
  pull?(fileId: string, rxdbClient: any): Promise<FileNode>;

  /**
   * List files in remote workspace
   */
  listWorkspaceFiles?(rxdbClient: any): Promise<FileNode[]>;

  /**
   * Sync entire workspace from remote - overwrites local files with remote content
   * Adapter should upsert files directly into RxDB
   */
  pullWorkspace?(rxdbClient: any): Promise<void>;

  /**
   * Register event listener
   */
  on(event: string, listener: (evt: AdapterEvent) => void): void;

  /**
   * Remove event listener
   */
  off(event: string, listener: (evt: AdapterEvent) => void): void;
}

/**
 * Adapter factory type
 */
export type AdapterFactory = (
  config: any,
  context?: Partial<AdapterInitContext>
) => Promise<ISyncAdapter>;

/**
 * Sync manager status
 */
export const SyncStatus = {
  IDLE: 'idle',
  SYNCING: 'syncing',
  ERROR: 'error',
} as const;

export type SyncStatus = typeof SyncStatus[keyof typeof SyncStatus];

/**
 * Queue entry for tracking pending sync operations
 */
export interface QueueEntry {
  id: string;
  workspaceId: string;
  op: 'push' | 'pull' | 'delete';
  targetId: string;
  attempts: number;
  createdAt: number;
}
