"use client";
import React from 'react';
import { useWorkspaceStore } from '@/core/store/workspace-store';

export function SyncIndicator() {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const permissionNeeded = useWorkspaceStore((s) => s.permissionNeeded);

  if (!activeWorkspaceId || !permissionNeeded[activeWorkspaceId]) return null;

  return (
    <div className="fixed right-4 bottom-4 z-[9999] flex items-center space-x-2">
      <div className="h-3 w-3 rounded-full bg-destructive" />
      <div className="text-sm text-muted-foreground">File access required</div>
    </div>
  );
}

export default SyncIndicator;
