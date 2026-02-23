"use client";

import { FileText, FolderPlus, Edit2, Trash2 } from "lucide-react";
import {
  ContextMenu as ContextMenuPrimitive,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/shared/components/ui/context-menu";

interface FileContextMenuProps {
  children: React.ReactNode;
  onNewFile?: () => void;
  onNewFolder?: () => void;
  onRename: () => void;
  onDelete: () => void;
  isFolder: boolean;
}

export function FileContextMenu({
  children,
  onNewFile,
  onNewFolder,
  onRename,
  onDelete,
  isFolder,
}: FileContextMenuProps) {
  return (
    <ContextMenuPrimitive>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent>
        {isFolder && (
          <>
            <ContextMenuItem onClick={onNewFile} className="cursor-pointer">
              <FileText className="mr-2 h-4 w-4" />
              New File
            </ContextMenuItem>
            <ContextMenuItem onClick={onNewFolder} className="cursor-pointer">
              <FolderPlus className="mr-2 h-4 w-4" />
              New Folder
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}
        <ContextMenuItem onClick={onRename} className="cursor-pointer">
          <Edit2 className="mr-2 h-4 w-4" />
          Rename
        </ContextMenuItem>
        <ContextMenuItem onClick={onDelete} className="cursor-pointer text-destructive">
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenuPrimitive>
  );
}
