/**
 * Sync adapters — v2
 *
 * LocalAdapter   — filesystem sync via File System Access API
 * BrowserAdapter — no-op for IndexedDB-only browser workspaces
 *
 * IAdapter is re-exported here so callers can import everything from one place.
 */

export { LocalAdapter, PermissionError } from './local-adapter';
export { BrowserAdapter } from './browser-adapter';
export type { IAdapter } from '../adapter';
