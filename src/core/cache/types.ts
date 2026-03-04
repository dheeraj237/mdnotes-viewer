import type { FileNode as SharedFileNode } from '../../shared/types';

// Re-export enums from shared types location
export { FileType, WorkspaceType } from '../../shared/types';



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
