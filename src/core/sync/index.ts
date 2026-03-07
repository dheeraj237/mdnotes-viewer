/**
 * Sync Module Public API
 */

export { SyncManager, getSyncManager, initializeSyncManager, stopSyncManager } from './manager';
export { AdapterRegistry } from './adapter-registry';
export { SyncQueue } from './queue';
export { DummyAdapter } from './adapters/dummy';
export { LocalAdapter } from './adapters/local';
export { SyncStatus } from './types';

export type {
  ISyncAdapter,
  AdapterCapabilities,
  AdapterInitContext,
  AdapterEvent,
  AdapterFactory,
  QueueEntry,
} from './types';
