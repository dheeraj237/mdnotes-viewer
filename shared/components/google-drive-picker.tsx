"use client";

import React, { useEffect, useState, useRef } from "react";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/shared/components/ui/dialog";
import { requestDriveAccessToken, ensureGapiPickerLoaded } from "@/core/auth/google";
import { toast } from "@/shared/utils/toast";

export function GoogleDrivePicker({ onFolderSelected }: { onFolderSelected: (id: string) => void }) {
  const [folders, setFolders] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const pickerRef = useRef<any>(null);

  const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;

  async function openPicker() {
    try {
      setLoading(true);

      if (!apiKey) {
        toast.error("Google API key not configured (VITE_GOOGLE_API_KEY)");
        return;
      }

      // Ensure GIS and Picker libraries are loaded
      const token = await requestDriveAccessToken(true);
      if (!token) {
        toast.info("Google sign-in cancelled");
        return;
      }

      await ensureGapiPickerLoaded();

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const google = (window as any).google;
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const gapi = (window as any).gapi;

      if (!gapi || !google || !(gapi as any).picker) {
        toast.error("Google Picker failed to load");
        return;
      }

      // Build a DocsView for folders
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const view = new (window as any).google.picker.DocsView((window as any).google.picker.ViewId.FOLDERS)
        .setIncludeFolders(true)
        .setSelectFolderEnabled(true)
        .setMode((window as any).google.picker.DocsViewMode.LIST);

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const picker = new (window as any).google.picker.PickerBuilder()
        .enableFeature((window as any).google.picker.Feature.NAV_HIDDEN)
        .addView(view)
        .setOAuthToken(token)
        .setDeveloperKey(apiKey)
        .setCallback((data: any) => {
          if (data.action === (window as any).google.picker.Action.PICKED) {
            const doc = data.docs && data.docs[0];
            if (doc) {
              const id = doc.id;
              setSelected(id);
              window.localStorage.setItem("verve_gdrive_folder_id", id);
              onFolderSelected(id);
              toast.success("Google Drive folder selected");
            }
          } else if (data.action === (window as any).google.picker.Action.CANCEL) {
            // user cancelled
          }
        })
        .build();

      picker.setVisible(true);
      pickerRef.current = picker;
    } catch (err) {
      console.error(err);
      toast.error("Failed to open Google Picker");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // no-op: load when dialog opens via user action
  }, []);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 hidden lg:inline-flex" title="Open Google Drive Folder">
          Open
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Select Google Drive Folder</DialogTitle>
          <DialogDescription>
            Choose a folder to sync your files with Verve. You will be asked to grant Drive access.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-4">
          <div className="flex gap-2">
            <Button onClick={openPicker} disabled={loading}>{loading ? "Opening…" : "Open Google Picker"}</Button>
            <Button variant="secondary" onClick={() => {
              const id = window.prompt("Paste folder ID to select:");
              if (id) {
                setSelected(id.trim());
                window.localStorage.setItem("verve_gdrive_folder_id", id.trim());
              }
            }}>Paste ID</Button>
          </div>

          <div className="max-h-64 overflow-auto border rounded p-2">
            {selected ? (
              <div className="p-2">Selected folder id: {selected}</div>
            ) : (
              <div className="text-sm text-muted-foreground">No folder selected yet. Use the Picker to choose a folder.</div>
            )}
          </div>
        </div>

        <DialogFooter>
          <div className="flex gap-2 w-full justify-end">
            <Button onClick={() => {
              if (!selected) {
                toast.error("No folder selected");
                return;
              }
              window.localStorage.setItem("verve_gdrive_folder_id", selected);
              onFolderSelected(selected);
              toast.success("Folder selected");
            }}>Select Folder</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default GoogleDrivePicker;
