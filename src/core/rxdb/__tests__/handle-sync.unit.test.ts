import 'fake-indexeddb/auto';
import { vi } from 'vitest';

// Use real RxDB client for this test
vi.unmock('@/core/rxdb/rxdb-client');

import { createRxDB, getDoc } from '@/core/rxdb/rxdb-client';
import { storeHandleForWorkspace, getHandleMeta } from '@/core/rxdb/handle-sync';

describe('handle-sync', () => {
  beforeEach(async () => {
    await createRxDB();
  });

  test('stores directoryHandle metadata in directory_handles_meta', async () => {
    // Use a serializable handle-like object so fake-indexeddb can clone it.
    const fakeHandle: any = {
      name: 'root'
    };

    await storeHandleForWorkspace('ws-test', fakeHandle as any);

    const meta = await getHandleMeta('ws-test');
    expect(meta).not.toBeNull();
    const doc: any = meta as any;
    expect(doc.directoryName).toBe('root');
    // NOTE: directoryHandle object is NOT stored because FileSystemDirectoryHandle
    // doesn't serialize properly in IndexedDB. Only metadata is stored.
    // The actual handle must be restored from user gesture (e.g., directory picker).
    expect(doc.permissionStatus).toBe('granted');
  });
});
