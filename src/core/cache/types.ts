import type { FileNode as SharedFileNode } from '../../shared/types';

// Re-export enums from shared types location
export { FileType, WorkspaceType } from '../../shared/types';

// DEPRECATED: SyncOp and SyncQueueEntry are no longer used
// The persistent sync queue has been replaced with direct RxDB subscription-driven sync
// with in-memory retry backoff. These types are only kept for backward compatibility
// with test files that haven't been updated yet.
export enum SyncOp {
  Put = 'put',
  Delete = 'delete',
}

export type SyncQueueEntry = {
  id: string;
  op: SyncOp;
  target: 'file';
  targetId: string;
  payload?: any;
  attempts?: number;
};

