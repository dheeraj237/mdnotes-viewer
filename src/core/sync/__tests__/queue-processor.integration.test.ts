import 'fake-indexeddb/auto';
import { initializeRxDB, getCacheDB, closeCacheDB } from '@/core/cache/rxdb';
import { enqueueSyncEntry, processPendingQueueOnce } from '@/core/sync/sync-queue-processor';
import { GDriveMock } from '@/core/sync/mocks/gdrive-mock';
import { upsertCachedFile, getCachedFile } from '@/core/cache/rxdb';
import { SyncOp } from '@/core/cache/types';

describe('Queue processor integration', () => {
  beforeAll(async () => {
    await initializeRxDB();
  });

  afterAll(async () => {
    try {
      await closeCacheDB();
    } catch { }
  });

  test('saveFile enqueues and processor pushes to adapter and clears dirty', async () => {
    const db = getCacheDB();
    const adapter = new GDriveMock();

    // insert a cached file
    const file = { id: 'f1', name: 'f1.md', path: 'f1.md', type: 'file', workspaceType: 'gdrive', workspaceId: 'ws1', content: 'hello', lastModified: Date.now(), dirty: true } as any;
    await upsertCachedFile(file);

    // enqueue entry
    await enqueueSyncEntry({ op: SyncOp.Put, target: 'file', targetId: 'f1', payload: null });

    // process queue
    await processPendingQueueOnce(new Map([['gdrive', adapter]]));

    // adapter should have content
    const pulled = await adapter.pull('f1');
    expect(pulled).toBe('hello');

    // cached file should be marked not dirty
    const cached = await getCachedFile('f1', 'ws1');
    expect(cached?.dirty).toBe(false);
  });
});

