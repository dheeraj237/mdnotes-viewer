import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { 
  Plus, 
  FolderPlus, 
  ChevronDown,
  FolderOpen,
  FileText
} from "lucide-react";
import { cn } from "@/shared/utils/cn";
import { useWorkspaceStore } from "@/core/store/workspace-store";
import { useFileExplorerStore } from "@/features/file-explorer/store/file-explorer-store";
import { useEditorStore } from "@/features/editor/store/editor-store";
import { ThemeToggle } from "@/shared/components/theme-toggle";
import { EmbeddedFileExplorer } from "@/features/file-explorer/components/embedded-file-explorer";
import { WorkspaceDropdown } from "@/shared/components/workspace-dropdown";
import { OpenedFilesSection } from "@/shared/components/opened-files-section";
import { SearchBar } from "@/shared/components/search-bar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/shared/components/ui/dropdown-menu";

interface LeftNavigationPanelProps {
  className?: string;
}

export function LeftNavigationPanel({ className }: LeftNavigationPanelProps) {
  const { createWorkspace } = useWorkspaceStore();
  const { openLocalDirectory } = useFileExplorerStore();
  const { openLocalFile } = useEditorStore();
  
  const handleNewNote = () => {
    // This will be connected to the file creation logic
    console.log("Creating new note...");
  };

  const handleNewWorkspace = () => {
    // Open the workspace creation modal from WorkspaceDropdown
    const workspaceDropdownEvent = new CustomEvent('openNewWorkspaceModal');
    document.dispatchEvent(workspaceDropdownEvent);
  };

  const handleOpenFolder = async () => {
    try {
      await openLocalDirectory();
    } catch (error) {
      console.error("Error opening folder:", error);
    }
  };

  const handleOpenFile = async () => {
    try {
      await openLocalFile();
    } catch (error) {
      console.error("Error opening file:", error);
    }
  };

  return (
    <div className={cn("h-full flex flex-col bg-sidebar-background", className)}>
      {/* Workspace Dropdown */}
      <div className="px-3 py-2 border-b border-sidebar-border">
        <WorkspaceDropdown />
      </div>

      {/* Search Bar */}
      <div className="px-3 py-2 border-b border-sidebar-border">
        <SearchBar />
      </div>

      {/* Opened Files Section */}
      <OpenedFilesSection />

      {/* Open folder/file buttons */}
      <div className="px-3 py-2 border-b border-sidebar-border">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenFolder}
            className="flex-1 gap-2 text-xs cursor-pointer"
            title="Open folder"
          >
            <FolderOpen className="h-4 w-4" />
            Folder
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenFile}
            className="flex-1 gap-2 text-xs cursor-pointer"
            title="Open file"
          >
            <FileText className="h-4 w-4" />
            File
          </Button>
        </div>
      </div>

      {/* Files Section - Contains the file explorer */}
      <div className="flex-1 overflow-hidden">
        <EmbeddedFileExplorer />
      </div>

      {/* Bottom Actions Dropdown */}
      <div className="px-3 py-2 border-t border-sidebar-border">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              className="w-full justify-start h-8 text-xs"
            >
              <Plus className="h-3 w-3 mr-2" />
              Create
              <ChevronDown className="h-3 w-3 ml-auto" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem onClick={handleNewNote} className="cursor-pointer">
              <Plus className="h-4 w-4 mr-2" />
              New Note
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleNewWorkspace} className="cursor-pointer">
              <FolderPlus className="h-4 w-4 mr-2" />
              New Workspace
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer">
              <div className="flex items-center justify-between w-full">
                <span>Change Theme</span>
                <ThemeToggle />
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}