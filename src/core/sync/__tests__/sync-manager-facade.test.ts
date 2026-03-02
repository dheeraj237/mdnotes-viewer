import { getSyncManager, initializeSyncManager, stopSyncManager } from '@/core/sync/sync-manager';
import type { ISyncAdapter } from '@/core/sync/adapter-types';

describe('SyncManager facade', () => {
  afterEach(() => {
    try {
      stopSyncManager();
    } catch (e) {
      // ignore
    }
  });

  test('requestOpenLocalDirectory delegates to local adapter', async () => {
    const manager = getSyncManager();

    let opened = false;
    const mockAdapter: Partial<ISyncAdapter> & { name: string } = {
      name: 'local',
      openDirectoryPicker: async (workspaceId?: string) => {
        opened = true;
        return;
      },
    } as any;

    manager.registerAdapter(mockAdapter as any);

    await manager.requestOpenLocalDirectory('ws-test');

    expect(opened).toBeTruthy();
  });

  test('requestPermissionForLocalWorkspace delegates and returns boolean', async () => {
    const manager = getSyncManager();

    const mockAdapter: Partial<ISyncAdapter> & { name: string } = {
      name: 'local',
      promptPermissionAndRestore: async (workspaceId: string) => {
        return true;
      },
    } as any;

    manager.registerAdapter(mockAdapter as any);

    const res = await manager.requestPermissionForLocalWorkspace('ws-test');
    expect(res).toBe(true);
  });
});
