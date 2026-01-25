import { create } from "zustand";
import { MarkdownFile, ViewMode } from "@/shared/types";
import { FileManager } from "@/core/file-manager";
import { ServerFileSystemAdapter } from "@/core/file-manager/adapters/server-adapter";
import { LocalFileSystemAdapter } from "@/core/file-manager/adapters/local-adapter";

// Initialize file manager with server adapter as default
const serverAdapter = new ServerFileSystemAdapter();
const localAdapter = new LocalFileSystemAdapter();
let fileManager: FileManager | null = null;

// Get or create file manager instance
function getFileManager(isLocal: boolean = false): FileManager {
  if (!fileManager) {
    fileManager = new FileManager(isLocal ? localAdapter : serverAdapter);

    // Setup event handlers
    fileManager.onUpdate((fileId, content) => {
      // Update store when file is pulled from external source
      useEditorStore.getState().handleExternalUpdate(fileId, content);
    });
  }
  return fileManager;
}

interface EditorStore {
  openTabs: MarkdownFile[];
  activeTabId: string | null;
  viewMode: ViewMode;
  isLoading: boolean;
  openFile: (file: MarkdownFile) => void;
  closeTab: (fileId: string) => void;
  setActiveTab: (fileId: string) => void;
  updateFileContent: (fileId: string, content: string) => void;
  handleExternalUpdate: (fileId: string, content: string) => void;
  applyEditorPatch: (fileId: string, content: string) => Promise<void>;
  setViewMode: (mode: ViewMode) => void;
  setIsLoading: (loading: boolean) => void;
  openLocalFile: () => Promise<void>;
  loadFileFromManager: (path: string, isLocal?: boolean) => Promise<void>;
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  openTabs: [],
  activeTabId: null,
  viewMode: "live",
  isLoading: false,

  openFile: (file) => set((state) => {
    // Check if file is already open
    const existingTab = state.openTabs.find(tab => tab.id === file.id);
    if (existingTab) {
      return { activeTabId: file.id };
    }
    return {
      openTabs: [...state.openTabs, file],
      activeTabId: file.id,
    };
  }),

  closeTab: (fileId) => set((state) => {
    const newTabs = state.openTabs.filter(tab => tab.id !== fileId);
    let newActiveId = state.activeTabId;

    // If closing active tab, switch to another tab
    if (state.activeTabId === fileId) {
      const currentIndex = state.openTabs.findIndex(tab => tab.id === fileId);
      if (newTabs.length > 0) {
        // Switch to next tab, or previous if last
        const nextIndex = currentIndex < newTabs.length ? currentIndex : currentIndex - 1;
        newActiveId = newTabs[nextIndex]?.id || null;
      } else {
        newActiveId = null;
      }
    }

    return {
      openTabs: newTabs,
      activeTabId: newActiveId,
    };
  }),

  setActiveTab: (fileId) => set({ activeTabId: fileId }),

  updateFileContent: (fileId, content) => set((state) => ({
    openTabs: state.openTabs.map(tab =>
      tab.id === fileId ? { ...tab, content } : tab
    ),
  })),

  /**
   * Handle external file updates (from file system watcher)
   * This is called when file manager detects external changes
   */
  handleExternalUpdate: (fileId, content) => set((state) => {
    const tab = state.openTabs.find(t => t.id === fileId);
    if (!tab) return state;

    return {
      openTabs: state.openTabs.map(t =>
        t.id === fileId ? { ...t, content, isExternalUpdate: true } : t
      ),
    };
  }),

  /**
   * Apply editor patch asynchronously to file manager
   * This is called when editor content changes
   */
  applyEditorPatch: async (fileId, content) => {
    const tab = get().openTabs.find(t => t.id === fileId);
    if (!tab) return;

    const manager = getFileManager(tab.isLocal);

    // Apply patch to file manager (async, non-blocking)
    await manager.applyPatch({
      fileId,
      content,
      timestamp: Date.now(),
    });

    // Update local store immediately for UI responsiveness
    get().updateFileContent(fileId, content);
  },

  /**
   * Load file through file manager
   */
  loadFileFromManager: async (path, isLocal = false) => {
    try {
      set({ isLoading: true });

      const manager = getFileManager(isLocal);
      const fileData = await manager.loadFile(path);

      const markdownFile: MarkdownFile = {
        id: fileData.id,
        path: fileData.path,
        name: fileData.name,
        content: fileData.content,
        category: fileData.category,
        isLocal,
      };

      get().openFile(markdownFile);
    } catch (error) {
      console.error("Failed to load file:", error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  openLocalFile: async () => {
    try {
      // Check if File System Access API is supported
      if (!('showOpenFilePicker' in window)) {
        alert('File System Access API is not supported in this browser. Please use Chrome, Edge, or another Chromium-based browser.');
        return;
      }

      const [fileHandle] = await (window as any).showOpenFilePicker({
        types: [
          {
            description: 'Markdown Files',
            accept: {
              'text/markdown': ['.md', '.markdown'],
              'text/plain': ['.txt'],
            },
          },
        ],
        multiple: false,
      });

      const file = await fileHandle.getFile();
      const content = await file.text();

      const markdownFile: MarkdownFile = {
        id: `local-${file.name}-${Date.now()}`,
        path: file.name,
        name: file.name,
        content,
        category: 'local',
        fileHandle,
        isLocal: true,
      };

      get().openFile(markdownFile);
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Error opening local file:', error);
        alert('Failed to open file: ' + (error as Error).message);
      }
    }
  },

  setViewMode: (mode) => set({ viewMode: mode }),
  setIsLoading: (loading) => set({ isLoading: loading }),
}));

// Helper to get current file
export const useCurrentFile = () => {
  const { openTabs, activeTabId } = useEditorStore();
  return openTabs.find(tab => tab.id === activeTabId) || null;
};
