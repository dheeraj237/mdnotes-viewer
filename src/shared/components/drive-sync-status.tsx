/**
 * Drive Sync Status Component
 * Shows detailed sync status for Google Drive operations
 */

"use client";

import { useEffect, useState } from "react";
import { Cloud, CloudOff, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { syncQueue, type SyncOperation } from "@/core/file-manager/sync-queue";
import { Button } from "@/shared/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { cn } from "@/shared/utils/cn";

export function DriveSyncStatus() {
  const [queue, setQueue] = useState<SyncOperation[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = syncQueue.subscribe(setQueue);
    return unsubscribe;
  }, []);

  const pendingCount = queue.filter(
    (op) => op.status === "pending" || op.status === "processing"
  ).length;
  const failedCount = queue.filter((op) => op.status === "failed").length;
  const isSyncing = syncQueue.isSyncing();

  if (pendingCount === 0 && failedCount === 0) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              <span>Synced</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>All changes synced to Google Drive</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={cn(
              "flex items-center gap-1 text-xs transition-colors",
              failedCount > 0
                ? "text-red-500 hover:text-red-600"
                : "text-blue-500 hover:text-blue-600"
            )}
          >
            {isSyncing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : failedCount > 0 ? (
              <AlertCircle className="h-3 w-3" />
            ) : (
              <Cloud className="h-3 w-3" />
            )}
            <span>
              {isSyncing
                ? "Syncing..."
                : failedCount > 0
                ? `${failedCount} failed`
                : `${pendingCount} pending`}
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p className="font-medium">Google Drive Sync</p>
            {pendingCount > 0 && <p>{pendingCount} operations pending</p>}
            {failedCount > 0 && (
              <p className="text-red-500">{failedCount} operations failed</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-popover border rounded-md shadow-lg p-4 z-50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium">Sync Queue</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              ×
            </button>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {queue.length === 0 ? (
              <p className="text-xs text-muted-foreground">No pending operations</p>
            ) : (
              queue.map((op) => (
                <div
                  key={op.id}
                  className="flex items-start gap-2 text-xs p-2 bg-muted rounded"
                >
                  {op.status === "processing" ? (
                    <Loader2 className="h-3 w-3 animate-spin shrink-0 mt-0.5" />
                  ) : op.status === "completed" ? (
                    <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0 mt-0.5" />
                  ) : op.status === "failed" ? (
                    <AlertCircle className="h-3 w-3 text-red-500 shrink-0 mt-0.5" />
                  ) : (
                    <Cloud className="h-3 w-3 text-blue-500 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{op.name}</p>
                    <p className="text-muted-foreground capitalize">
                      {op.type.replace("-", " ")}
                      {op.retries > 0 && ` (retry ${op.retries})`}
                    </p>
                    {op.error && (
                      <p className="text-red-500 text-xs mt-1">{op.error}</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {failedCount > 0 && (
            <div className="mt-3 pt-3 border-t">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  syncQueue.retryFailed();
                  setIsOpen(false);
                }}
                className="w-full"
              >
                Retry Failed Operations
              </Button>
            </div>
          )}
        </div>
      )}
    </TooltipProvider>
  );
}
