import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Workspace {
  id: string;
  name: string;
  type: 'browser' | 'local' | 'drive';
  path?: string; // For local workspaces
  driveFolder?: string; // For Google Drive workspaces
  createdAt: string;
  lastAccessed: string;
  isDefault?: boolean;
}

interface WorkspaceStore {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  isWorkspacePickerOpen: boolean;
  
  // Actions
  createWorkspace: (name: string, type: Workspace['type'], options?: { path?: string; driveFolder?: string }) => void;
  deleteWorkspace: (id: string) => void;
  switchWorkspace: (id: string) => void;
  updateWorkspace: (id: string, updates: Partial<Workspace>) => void;
  setWorkspacePickerOpen: (open: boolean) => void;
  
  // Computed
  activeWorkspace: () => Workspace | null;
  getBrowserWorkspaces: () => Workspace[];
  getLocalWorkspaces: () => Workspace[];
  getDriveWorkspaces: () => Workspace[];
}

export const useWorkspaceStore = create<WorkspaceStore>()(
  persist(
    (set, get) => ({
      workspaces: [],
      activeWorkspaceId: null,
      isWorkspacePickerOpen: false,

      createWorkspace: (name, type, options = {}) => {
        const workspace: Workspace = {
          id: `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name,
          type,
          path: options.path,
          driveFolder: options.driveFolder,
          createdAt: new Date().toISOString(),
          lastAccessed: new Date().toISOString(),
        };

        set((state) => ({
          workspaces: [...state.workspaces, workspace],
          activeWorkspaceId: workspace.id,
        }));
      },

      deleteWorkspace: (id) => {
        set((state) => {
          const newWorkspaces = state.workspaces.filter(w => w.id !== id);
          const newActiveId = state.activeWorkspaceId === id ? 
            (newWorkspaces[0]?.id || null) : state.activeWorkspaceId;
          
          return {
            workspaces: newWorkspaces,
            activeWorkspaceId: newActiveId,
          };
        });
      },

      switchWorkspace: (id) => {
        set((state) => {
          const workspace = state.workspaces.find(w => w.id === id);
          if (!workspace) return state;

          // Update last accessed time
          const updatedWorkspaces = state.workspaces.map(w =>
            w.id === id ? { ...w, lastAccessed: new Date().toISOString() } : w
          );

          return {
            workspaces: updatedWorkspaces,
            activeWorkspaceId: id,
          };
        });
      },

      updateWorkspace: (id, updates) => {
        set((state) => ({
          workspaces: state.workspaces.map(w =>
            w.id === id ? { ...w, ...updates } : w
          ),
        }));
      },

      setWorkspacePickerOpen: (open) => {
        set({ isWorkspacePickerOpen: open });
      },

      // Computed getters
      activeWorkspace: () => {
        const { workspaces, activeWorkspaceId } = get();
        return workspaces.find(w => w.id === activeWorkspaceId) || null;
      },

      getBrowserWorkspaces: () => {
        return get().workspaces.filter(w => w.type === 'browser');
      },

      getLocalWorkspaces: () => {
        return get().workspaces.filter(w => w.type === 'local');
      },

      getDriveWorkspaces: () => {
        return get().workspaces.filter(w => w.type === 'drive');
      },
    }),
    {
      name: 'verve-workspace-store',
      partialize: (state) => ({
        workspaces: state.workspaces,
        activeWorkspaceId: state.activeWorkspaceId,
      }),
    }
  )
);