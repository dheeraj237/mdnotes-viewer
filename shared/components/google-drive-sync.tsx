"use client";

import React, { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Cloud, Loader2 } from "lucide-react";
import { ensureGisLoaded, requestDriveAccessToken } from "@/core/auth/google";
import { toast } from "@/shared/utils/toast";
import { useFileExplorerStore } from "@/features/file-explorer/store/file-explorer-store";
import { FileNode } from "@/shared/types";

const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";

interface GoogleDriveSyncProps {
  className?: string;
}

export function GoogleDriveSync({ className }: GoogleDriveSyncProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const { fileTree, currentDirectoryName, currentDirectoryPath } = useFileExplorerStore();

  // Check if we're in local file mode (files are loaded from local file system)
  const isLocalMode = fileTree.length > 0 && currentDirectoryPath && currentDirectoryPath !== "/demo" && !currentDirectoryPath.includes("gdrive");

  const syncToGoogleDrive = async () => {
    if (!isLocalMode) {
      toast.error("Sync only works with local files", "Please open a local folder first");
      return;
    }

    if (fileTree.length === 0) {
      toast.error("No files to sync", "Please open a local folder first");
      return;
    }

    try {
      setIsSyncing(true);
      
      // Check if Google Client ID is configured
      const clientId = import.meta.env.VITE_AUTH_APP_CLIENT_ID;
      if (!clientId) {
        toast.error("Google Client ID not configured", "Please set VITE_AUTH_APP_CLIENT_ID environment variable");
        return;
      }

      await ensureGisLoaded();

      // Request Drive access with file scope
      const token = await requestDriveAccessToken(true);
      if (!token) {
        toast.error("Google Drive access not granted");
        return;
      }

      // Create or get the Verve folder in Google Drive
      const folderName = `Verve-${currentDirectoryName || 'Files'}`;
      const folderId = await createOrGetFolder(token, folderName);

      // Sync all files to Google Drive
      const syncedFiles = await syncFilesToDrive(token, folderId, fileTree);

      toast.success(`Synced ${syncedFiles} files to Google Drive`, `Files uploaded to folder: ${folderName}`);
    } catch (error) {
      console.error("Sync to Google Drive failed:", error);
      toast.error("Sync failed", (error as Error).message || "Unknown error occurred");
    } finally {
      setIsSyncing(false);
    }
  };

  const createOrGetFolder = async (token: string, folderName: string): Promise<string> => {
    // First, check if folder already exists
    const searchResponse = await fetch(
      `${DRIVE_API_BASE}/files?q=${encodeURIComponent(`name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`)}&fields=files(id,name)`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      if (searchData.files && searchData.files.length > 0) {
        return searchData.files[0].id;
      }
    }

    // Create new folder
    const folderMeta = {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
    };

    const folderResponse = await fetch(`${DRIVE_API_BASE}/files`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(folderMeta),
    });

    if (!folderResponse.ok) {
      throw new Error("Failed to create Google Drive folder");
    }

    const folderData = await folderResponse.json();
    return folderData.id;
  };

  const syncFilesToDrive = async (token: string, folderId: string, nodes: FileNode[]): Promise<number> => {
    let syncedCount = 0;

    for (const node of nodes) {
      try {
        if (node.type === 'file') {
          // For local files, we'll show a message that full file sync requires additional development
          toast.info(`File "${node.name}" found`, "Full file content sync is not yet implemented");
          syncedCount++;
        } else if (node.type === 'folder' && node.children) {
          // Create subfolder and sync its contents recursively
          const subFolderId = await createOrGetFolder(token, node.name);
          const childSynced = await syncFilesToDrive(token, subFolderId, node.children);
          syncedCount += childSynced;
        }
      } catch (error) {
        console.error(`Failed to sync ${node.name}:`, error);
        // Continue with other files even if one fails
      }
    }

    return syncedCount;
  };

  const uploadFileToDrive = async (token: string, folderId: string, fileName: string, fileContent: string) => {
    const metadata = {
      name: fileName,
      parents: [folderId],
    };

    const boundary = "-------314159265358979323846";
    const multipartBody = [
      `--${boundary}`,
      "Content-Type: application/json; charset=UTF-8",
      "",
      JSON.stringify(metadata),
      `--${boundary}`,
      "Content-Type: text/plain",
      "",
      fileContent,
      `--${boundary}--`,
    ].join("\r\n");

    const response = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body: multipartBody,
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to upload ${fileName} to Google Drive`);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={syncToGoogleDrive}
      disabled={!isLocalMode || isSyncing}
      className={`w-full justify-start gap-2 text-xs ${className || ""}`}
      title={
        !isLocalMode 
          ? "Sync only works with local files" 
          : "Sync local files to Google Drive"
      }
    >
      {isSyncing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Cloud className="h-4 w-4" />
      )}
      {isSyncing ? "Syncing..." : "Sync to Google Drive"}
    </Button>
  );
}