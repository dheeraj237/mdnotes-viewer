import { RxJsonSchema } from 'rxdb';
import type { CachedFile } from './types';

/**
 * RxDB JSON schema for cached_files collection
 * Stores lightweight file/directory metadata and file content (SSoT)
 */
export const cachedFileSchema: RxJsonSchema<CachedFile> = {
  title: 'cached_files schema',
  version: 2,
  type: 'object',
  primaryKey: 'id',
  additionalProperties: false,
  properties: {
    id: { type: 'string', maxLength: 255 },
    type: { type: 'string', enum: ['file', 'directory'] },
    name: { type: 'string', maxLength: 255 },
    path: { type: 'string', maxLength: 1024 },
    parentId: { type: ['string', 'null'] },
    children: { type: ['array', 'null'], items: { type: 'string' } },
    size: { type: ['number', 'null'] },
    modifiedAt: { type: ['string', 'null'] },
    createdAt: { type: ['string', 'null'] },
    // Legacy field used across the codebase for numeric timestamps
    lastModified: { type: ['number', 'null'] },
    dirty: { type: 'boolean', default: false },
    isSynced: { type: 'boolean', default: true },
    version: { type: ['number', 'null'] },
    mimeType: { type: ['string', 'null'] },
    // Accept both 'drive' and 'gdrive' historically used by adapters
    workspaceType: { type: 'string', maxLength: 50, enum: ['browser', 'local', 'drive', 'gdrive', 's3'] },
    workspaceId: { type: 'string', maxLength: 255 },
    content: { type: ['string', 'null'] },
    meta: { type: ['object', 'null'] },
    // Many modules use `metadata` (not `meta`) — accept both shapes
    metadata: { type: ['object', 'null'] }
  },
  required: ['id', 'name', 'path', 'type', 'workspaceType', 'dirty'],
  // Composite indexes to improve workspace-scoped and name-based lookups
  indexes: [
    ['path'],
    ['workspaceType'],
    ['workspaceId'],
    ['workspaceId', 'path'],
    ['workspaceId', 'name']
  ]
};

/**
 * RxDB JSON schema for crdt_docs collection
 * Stores Yjs encoded state for collaborative editing with CRDT merging
 */
// CRDT docs removed from schema. Content is stored directly on `cached_files`.

/**
 * RxDB JSON schema for sync_queue collection (optional, for batch operations)
 * Tracks pending sync operations to adapters
 */
export const syncQueueSchema: RxJsonSchema<{
  id: string;
  op: 'put' | 'delete';
  target: 'file';
  targetId: string;
  payload?: any;
  attempts?: number;
  createdAt?: number;
}> = {
  title: 'sync_queue schema',
  version: 1,
  type: 'object',
  primaryKey: 'id',
  additionalProperties: false,
  properties: {
    id: {
      type: 'string',
      maxLength: 255,
      description: 'Unique queue entry ID'
    },
    op: {
      type: 'string',
      enum: ['put', 'delete'],
      description: 'Operation type: put (update/create) or delete'
    },
    target: {
      type: 'string',
      enum: ['file'],
      description: 'Target collection'
    },
    targetId: {
      type: 'string',
      maxLength: 255,
      description: 'Primary key of the target document'
    },
    payload: {
      type: ['object', 'null'],
      description: 'Operation payload if needed'
    },
    attempts: {
      type: ['number', 'null'],
      default: 0,
      description: 'Number of sync attempts'
    },
    createdAt: {
      type: 'number',
      multipleOf: 1,
      minimum: 0,
      maximum: 253402300799999,
      default: 0,
      description: 'Queue entry creation time'
    }
  },
  required: ['id', 'op', 'target', 'targetId', 'createdAt'],
  indexes: ['createdAt']
};

/**
 * Migration strategies for schema version upgrades
 */
export const migrationStrategies = {
  cachedFile: {
    1: (doc: any) => doc,  // No-op migration from v0 to v1
    // Migration to v2: normalize legacy fields and ensure defaults
    2: (doc: any) => {
      try {
        // normalize workspaceType: treat 'gdrive' as 'drive'
        if (doc.workspaceType === 'gdrive') doc.workspaceType = 'drive';

        // ensure metadata/meta exist
        if (typeof doc.metadata === 'undefined' && typeof doc.meta !== 'undefined') {
          doc.metadata = doc.meta;
        }
        if (typeof doc.metadata === 'undefined') doc.metadata = null;

        // ensure children is either null or an array
        if (!doc.children) doc.children = null;

        // ensure dirty/isSynced defaults
        if (typeof doc.dirty === 'undefined') doc.dirty = false;
        if (typeof doc.isSynced === 'undefined') doc.isSynced = true;
      } catch (e) {
        // migration best-effort; return doc unchanged on error
      }
      return doc;
    },
  },
  // crdtDoc migrations removed
  syncQueue: {
    1: (doc: any) => doc,  // No-op migration from v0 to v1
  }
};
