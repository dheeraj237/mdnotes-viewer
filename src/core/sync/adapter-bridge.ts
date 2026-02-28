import type { CachedFile } from '@/core/cache/types';
import { toAdapterDescriptor, AdapterFileDescriptor } from '@/core/sync/adapter-types';

/**
 * Small bridge helpers to translate between cache model and adapter descriptor.
 */
export function fromCachedFile(cached: CachedFile): AdapterFileDescriptor {
  return toAdapterDescriptor(cached);
}

/**
 * Helper to push a CachedFile to an adapter using the canonical AdapterFileDescriptor.
 * Returns the adapter's push result (boolean) or throws if adapter push fails.
 */
export async function pushCachedFile(adapter: any, cached: CachedFile, content: string): Promise<boolean> {
  if (!adapter || typeof adapter.push !== 'function') {
    throw new Error('Adapter does not implement push()');
  }

  const descriptor = fromCachedFile(cached);
  return await adapter.push(descriptor, content);
}

export default {
  fromCachedFile,
  pushCachedFile,
};
