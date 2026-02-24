/**
 * Global Workspace Loading Indicator
 * Shows a fixed loading bar at the top of the app without affecting layout
 */
import { useWorkspaceStore } from "@/core/store/workspace-store";

export function WorkspaceLoader() {
  const { isWorkspaceSwitching } = useWorkspaceStore();

  if (!isWorkspaceSwitching) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-9999 h-1 bg-primary/20">
      <div className="h-full bg-primary animate-progress-indeterminate"></div>
    </div>
  );
}
