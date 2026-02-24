/**
 * Panel Store - Manages the collapsed/expanded state of side panels
 * Used in the app shell to control left and right panel visibility
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface PanelState {
  leftPanelCollapsed: boolean;
  rightPanelCollapsed: boolean;

  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  closeLeftPanel: () => void;
  closeRightPanel: () => void;
  openLeftPanel: () => void;
  openRightPanel: () => void;
}
export const usePanelStore = create<PanelState>()(
  persist(
    (set) => ({
      leftPanelCollapsed: false,
      rightPanelCollapsed: false,
      toggleLeftPanel: () =>
        set((state) => ({ leftPanelCollapsed: !state.leftPanelCollapsed })),
      toggleRightPanel: () =>
        set((state) => ({ rightPanelCollapsed: !state.rightPanelCollapsed })),
      closeLeftPanel: () => set({ leftPanelCollapsed: true }),
      closeRightPanel: () => set({ rightPanelCollapsed: true }),
      openLeftPanel: () => set({ leftPanelCollapsed: false }),
      openRightPanel: () => set({ rightPanelCollapsed: false }),
    }),
    {
      name: "panel-storage",
    }
  )
);
