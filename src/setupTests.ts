// Global teardown to stop background services and close DBs so Jest can exit cleanly
afterAll(async () => {
  try {
    // require lazily so tests can mock these modules per-test if needed
    // eslint-disable-next-line global-require
    const { stopSyncManager } = require('@/core/sync/sync-manager');
    try {
      stopSyncManager();
    } catch (err) {
      // ignore
    }
  } catch (err) {
    // ignore if module not available
  }

  try {
    // eslint-disable-next-line global-require
    const { getCacheDB } = require('@/core/cache/rxdb');
    try {
      const db = getCacheDB();
      if (db && typeof db.destroy === 'function') {
        await db.destroy();
      }
    } catch (err) {
      // ignore
    }
  } catch (err) {
    // ignore if module not available or mocked
  }
});

// Debugging helpers were removed to keep test output clean.

// Log unhandled rejections during tests to help diagnose failures
process.on('unhandledRejection', (reason) => {
  // eslint-disable-next-line no-console
  console.error('UnhandledRejection during tests:', reason);
});

process.on('uncaughtException', (err) => {
  // eslint-disable-next-line no-console
  console.error('UncaughtException during tests:', err);
  throw err;
});
