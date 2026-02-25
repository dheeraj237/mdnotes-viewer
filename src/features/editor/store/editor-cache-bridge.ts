import { useEffect, useState, useCallback } from 'react';
import {
  initializeRxDB,
  getCachedFile,
  upsertCachedFile,
  observeCachedFiles,
  getCrdtDoc,
  upsertCrdtDoc,
  saveFile,
  loadFile,
} from '../../../core/cache';
import { useWorkspaceStore } from '@/core/store/workspace-store';
import type { CachedFile } from '../../../core/cache/types';

export interface EditorCacheContextType {
  initialized: boolean;
  currentFileId: string | null;
  content: string;
  fileMetadata: CachedFile | null;
  isDirty: boolean;
  error: Error | null;
}

/**
 * Hook to initialize RxDB and manage the editor cache lifecycle
 */
export function useEditorCache() {
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        await initializeRxDB();
        setInitialized(true);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        console.error('Failed to initialize editor cache:', error);
      }
    };

    init();
  }, []);

  return { initialized, error };
}

/**
 * Hook to open a file for editing with Yjs CRDT document
 * Returns the Y.Doc instance and file metadata
 */
export function useOpenFileForEditing(
  fileId: string | null,
  filePath?: string,
  workspaceType: 'browser' | 'local' | 'gdrive' | 's3' = 'browser'
) {
  const [content, setContent] = useState<string>('');
  const [fileMetadata, setFileMetadata] = useState<CachedFile | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!fileId) {
      setContent('');
      setFileMetadata(null);
      return;
    }

    const loadFile = async () => {
      try {
        const workspace = useWorkspaceStore.getState().activeWorkspace?.();
        const workspaceId = workspace?.id;

        // Load or create cached file entry
        let cachedFile = await getCachedFile(fileId, workspaceId);
        if (!cachedFile) {
          // Create new cached file if doesn't exist
          cachedFile = {
            id: fileId,
            name: filePath?.split('/').pop() || 'Untitled',
            path: filePath || fileId,
            type: 'file',
            workspaceType,
            dirty: false,
            workspaceId: workspaceId
          };
          await upsertCachedFile(cachedFile);
        }
        // Ensure CRDT doc exists (stores raw content as base64)
        const crdtId = cachedFile.crdtId || `crdt_${fileId}`;
        let crdt = await getCrdtDoc(crdtId);
        if (!crdt) {
          await upsertCrdtDoc({ id: crdtId, fileId, yjsState: '', lastUpdated: Date.now() });
          crdt = await getCrdtDoc(crdtId);
        }

        // Decode content from crdt doc
        let fileContent = '';
        try {
          if (crdt && crdt.yjsState) {
            const state = typeof crdt.yjsState === 'string' ? Buffer.from(crdt.yjsState, 'base64') : crdt.yjsState;
            fileContent = state ? Buffer.from(state).toString('utf-8') : '';
          }
        } catch (e) {
          console.warn('Failed to decode CRDT content:', e);
        }

        // Update cached file with CRDT link if new
        if (!cachedFile.crdtId) {
          await upsertCachedFile({ ...cachedFile, crdtId, workspaceId: cachedFile.workspaceId });
        }

        setContent(fileContent);
        setFileMetadata(cachedFile);
        setIsDirty(Boolean(cachedFile.dirty));
        setError(null);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        console.error('Failed to open file for editing:', fileId, error);
      }
    };

    loadFile();
  }, [fileId, filePath, workspaceType]);

  return { content, fileMetadata, isDirty, error };
}

/**
 * Hook to sync editor content with Yjs document and mark as dirty
 */
export function useEditorSync(fileId: string | null, initialContent: string) {
  const [content, setContent] = useState(initialContent || '');

  useEffect(() => {
    setContent(initialContent || '');
  }, [initialContent]);

  /**
   * Update editor content and persist to RxDB (background save via saveFile)
   */
  const updateContent = useCallback(
    async (newContent: string) => {
      setContent(newContent);

      if (!fileId) return;
      try {
        const workspace = useWorkspaceStore.getState().activeWorkspace?.();
        const workspaceType = workspace?.type || 'browser';
        const workspaceId = workspace?.id;

        // Determine path to save: prefer an explicit path; if fileId looks like an id, resolve cached file
        let savePath = fileId as string;
        if (savePath && !savePath.includes('/')) {
          try {
            const cached = await getCachedFile(fileId || '');
            if (cached && cached.path) savePath = cached.path;
          } catch (e) {
            // ignore and fall back to using fileId as path
          }
        }

        // Use saveFile to persist content to cache (RxDB) — marks as dirty for non-browser workspaces
        await saveFile(savePath || fileId || '', newContent, workspaceType, undefined, workspaceId);
      } catch (err) {
        console.error('Failed to persist editor content:', err);
      }
    },
    [fileId]
  );

  return { content, updateContent };
}

/**
 * Mark a file as dirty (has unsaved changes) in RxDB
 */
async function markFileAsDirty(fileId: string): Promise<void> {
  try {
    const workspace = useWorkspaceStore.getState().activeWorkspace?.();
    const workspaceId = workspace?.id;
    const fileMetadata = await getCachedFile(fileId, workspaceId);
    if (fileMetadata && !fileMetadata.dirty) {
      await upsertCachedFile({ ...fileMetadata, dirty: true, workspaceId: fileMetadata.workspaceId });
    }
  } catch (error) {
    console.error('Failed to mark file as dirty:', fileId, error);
  }
}

/**
 * Hook to monitor all cached files for UI updates (e.g., file tree)
 */
export function useCachedFilesList(pathPrefix?: string) {
  const [files, setFiles] = useState<CachedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    const workspace = useWorkspaceStore.getState().activeWorkspace?.();
    const workspaceId = workspace?.id;

    const subscription = observeCachedFiles((cachedFiles) => {
      // Prefer workspace-scoped files when an active workspace exists
      let filteredByWorkspace = cachedFiles;
      if (workspaceId) {
        filteredByWorkspace = cachedFiles.filter(f => f.workspaceId === workspaceId);
      } else if (workspace) {
        filteredByWorkspace = cachedFiles.filter(f => f.workspaceType === workspace.type);
      }

      // Filter by path prefix if provided
      const filtered = pathPrefix
        ? filteredByWorkspace.filter((f) => f.path.startsWith(pathPrefix))
        : filteredByWorkspace;
      setFiles(filtered);
      setLoading(false);
    });

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [pathPrefix]);

  return { files, loading, error };
}

/**
 * Hook to get uncommitted changes (dirty files) in cache
 */
export function useDirtyFiles() {
  const [dirtyFiles, setDirtyFiles] = useState<CachedFile[]>([]);

  useEffect(() => {
    const workspace = useWorkspaceStore.getState().activeWorkspace?.();
    const workspaceId = workspace?.id;
    const subscription = observeCachedFiles((cachedFiles) => {
      let filtered = cachedFiles;
      if (workspaceId) {
        filtered = cachedFiles.filter(f => f.workspaceId === workspaceId);
      } else if (workspace) {
        filtered = cachedFiles.filter(f => f.workspaceType === workspace.type);
      }

      const dirty = filtered.filter((f) => f.dirty);
      setDirtyFiles(dirty);
    });

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  return dirtyFiles;
}

/**
 * Helper to close/unload a file from cache (useful for cleanup)
 */
export async function closeEditorFile(fileId: string): Promise<void> {
  try {
    // Optionally unload Yjs doc here if needed
    // For now, just mark it as synced or keep in memory cache
  } catch (error) {
    console.error('Failed to close editor file:', fileId, error);
  }
}
