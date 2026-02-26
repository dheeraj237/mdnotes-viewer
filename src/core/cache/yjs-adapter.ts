// CRDT/Yjs adapter removed. Previously provided helpers for Yjs document
// persistence into RxDB. CRDT functionality is disabled and replaced with
// storing plain `content` on `cached_files`. Keep lightweight stubs so
// callers can migrate later.

export async function createOrLoadYjsDoc(): Promise<null> {
  throw new Error('CRDT/Yjs functionality is disabled. Use cached_files content instead.');
}

export function getYjsDoc(): null {
  return null;
}

export async function unloadYjsDoc(): Promise<void> {
  return;
}

export function getYjsText(): string {
  return '';
}

export function setYjsText(): void {
  // no-op
}

export function observeYjsText(): () => void {
  return () => {};
}

export async function mergeYjsState(): Promise<void> {
  return;
}

export function clearYjsRegistry(): void {
  // no-op
}
