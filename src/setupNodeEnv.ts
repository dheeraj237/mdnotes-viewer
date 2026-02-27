// Polyfill IndexedDB for RxDB/Dexie in Jest Node environment
try {
  // eslint-disable-next-line global-require
  require('fake-indexeddb/auto');
} catch (err) {
  // ignore if unavailable
}

process.on('unhandledRejection', (reason) => {
  // Ensure we see details of unhandled rejections happening during test load
  // eslint-disable-next-line no-console
  console.error('Global UnhandledRejection:', reason);
});

process.on('uncaughtException', (err) => {
  // eslint-disable-next-line no-console
  console.error('Global UncaughtException:', err);
  throw err;
});
