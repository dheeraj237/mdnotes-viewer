"use client";
import React, { useEffect, useState } from 'react';
import { getSyncManager, SyncStatus } from '@/core/sync';
import type { SyncStatus as SyncStatusType } from '@/core/sync';

export function SyncIndicator() {
  const [status, setStatus] = useState<SyncStatusType>(SyncStatus.IDLE);

  useEffect(() => {
    const sub = getSyncManager().status$().subscribe((s) => setStatus(s));
    return () => sub.unsubscribe();
  }, []);

  if (status === SyncStatus.IDLE) return null;

  return (
    <div className="fixed right-4 bottom-4 z-[9999] flex items-center space-x-2">
      <div className="h-3 w-3 rounded-full bg-primary animate-pulse" />
      <div className="text-sm text-muted-foreground">
        {status === SyncStatus.SYNCING ? 'Syncing...' : 'Sync Error'}
      </div>
    </div>
  );
}

export default SyncIndicator;
