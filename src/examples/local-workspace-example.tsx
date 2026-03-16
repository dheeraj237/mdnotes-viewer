/**
 * Example: Local Workspace Creation Component
 * 
 * This demonstrates the simplified File System Access API workflow
 * following Google Chrome Labs text-editor patterns.
 * 
 * Key principles:
 * 1. Check support BEFORE showing UI
 * 2. Call pickDirectory() as FIRST async operation from user gesture
 * 3. Verify permission while still in user gesture context
 * 4. Handle errors clearly for better UX
 */

import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { 
  isFileSystemAccessSupported, 
  pickDirectory, 
  verifyPermission 
} from '@/core/sync/directory-picker';
import { setHandle } from '@/core/sync/handle-store';
import { getSyncManager } from '@/core/sync/sync-manager';
import { useWorkspaceStore } from '@/core/store/workspace-store';
import { WorkspaceType } from '@/core/cache/types';
import { toast } from '@/shared/utils/toast';

export function LocalWorkspaceExample() {
  const [isCreating, setIsCreating] = useState(false);
  const { createWorkspace } = useWorkspaceStore();

  // Check if File System Access API is supported
  const isSupported = isFileSystemAccessSupported();

  /**
   * Handle creating a local workspace.
   * MUST be called from a user gesture (button click).
   */
  const handleCreateLocalWorkspace = async () => {
    setIsCreating(true);

    try {
      // Generate workspace ID
      const workspaceId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      
      // CRITICAL: pickDirectory() must be the FIRST async operation
      // to preserve user gesture activation for permission prompts.
      const dirHandle = await pickDirectory();
      
      if (!dirHandle) {
        // User cancelled the picker
        toast.info('Directory selection was cancelled');
        return;
      }

      // Verify/request permission while still in user gesture context
      const granted = await verifyPermission(dirHandle, true);
      
      if (!granted) {
        toast.error('Permission denied', 'Unable to read/write to the selected directory');
        return;
      }

      // Now we have a valid handle with permissions - proceed with workspace creation
      
      // 1. Save handle to IndexedDB
      await setHandle(workspaceId, dirHandle);

      // 2. Create workspace entry in store
      createWorkspace(dirHandle.name, WorkspaceType.Local, { id: workspaceId });

      // 3. Mount workspace (pulls files from directory into RxDB)
      await getSyncManager().mountWorkspace(workspaceId, 'local');

      // 4. Show success message
      toast.success(`Local workspace "${dirHandle.name}" created successfully!`);

    } catch (error: any) {
      console.error('Failed to create local workspace:', error);
      toast.error('Failed to create workspace', error?.message || 'Unknown error');
    } finally {
      setIsCreating(false);
    }
  };

  // Don't show button if File System Access API is not supported
  if (!isSupported) {
    return (
      <div className="text-sm text-muted-foreground">
        Local workspaces require a modern browser (Chrome 86+, Edge 86+, or Safari 15.2+)
      </div>
    );
  }

  return (
    <Button 
      onClick={handleCreateLocalWorkspace}
      disabled={isCreating}
    >
      {isCreating ? 'Creating...' : 'Create Local Workspace'}
    </Button>
  );
}

/**
 * Example: Re-requesting Permission for Existing Workspace
 * 
 * When switching to a local workspace that lost permission (e.g., after browser restart),
 * the UI should show a button to re-request permission.
 */
export function RequestPermissionExample({ workspaceId }: { workspaceId: string }) {
  const [isRequesting, setIsRequesting] = useState(false);

  const handleRequestPermission = async () => {
    setIsRequesting(true);

    try {
      // Import handle storage utilities
      const { getHandle } = await import('@/core/sync/handle-store');
      
      // Get the stored handle
      const handle = await getHandle(workspaceId);
      
      if (!handle) {
        toast.error('Directory handle not found', 'The workspace may have been deleted');
        return;
      }

      // Request permission (MUST be called from user gesture)
      const granted = await verifyPermission(handle, true);
      
      if (!granted) {
        toast.error('Permission denied', 'Unable to access the directory');
        return;
      }

      // Permission granted - try mounting the workspace again
      await getSyncManager().mountWorkspace(workspaceId, 'local');
      
      toast.success('Permission granted', 'Workspace is now accessible');

    } catch (error: any) {
      console.error('Failed to request permission:', error);
      toast.error('Failed to request permission', error?.message || 'Unknown error');
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <div className="flex items-center gap-2 p-4 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
      <div className="flex-1">
        <p className="text-sm font-medium">Permission Required</p>
        <p className="text-xs text-muted-foreground">
          This workspace needs permission to access its directory
        </p>
      </div>
      <Button 
        onClick={handleRequestPermission}
        disabled={isRequesting}
        size="sm"
      >
        {isRequesting ? 'Requesting...' : 'Grant Permission'}
      </Button>
    </div>
  );
}
