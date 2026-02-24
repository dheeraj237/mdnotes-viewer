import { useState, useEffect } from "react";
import * as React from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { 
  Plus, 
  FolderOpen, 
  Cloud, 
  Globe, 
  Trash,
  MoreHorizontal,
  ChevronDown 
} from "lucide-react";
import { useWorkspaceStore, Workspace } from "@/core/store/workspace-store";
import { useFileExplorerStore } from "@/features/file-explorer/store/file-explorer-store";
import { cn } from "@/shared/utils/cn";
import { toast } from "@/shared/utils/toast";
import { WorkspaceTypePicker } from "@/shared/components/workspace-type-picker";

interface WorkspaceDropdownProps {
  className?: string;
}

export function WorkspaceDropdown({ className }: WorkspaceDropdownProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isTypePickerOpen, setIsTypePickerOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [selectedWorkspaceType, setSelectedWorkspaceType] = useState<Workspace['type']>('browser');
  
  const { 
    workspaces, 
    activeWorkspace, 
    isWorkspacePickerOpen, 
    setWorkspacePickerOpen,
    switchWorkspace,
    createWorkspace,
    deleteWorkspace
  } = useWorkspaceStore();

  const { openLocalDirectory, setGoogleFolder } = useFileExplorerStore();

  const currentWorkspace = activeWorkspace();

  // Initialize default demo workspace if no workspaces exist
  React.useEffect(() => {
    if (workspaces.length === 0) {
      createWorkspace("Demo", "browser");
    }
  }, [workspaces.length, createWorkspace]);

  // Listen for new workspace modal trigger
  React.useEffect(() => {
    const handleOpenModal = () => {
      setIsTypePickerOpen(true);
    };

    document.addEventListener('openNewWorkspaceModal', handleOpenModal);
    return () => document.removeEventListener('openNewWorkspaceModal', handleOpenModal);
  }, []);

  const handleTypeSelected = (type: 'browser' | 'local') => {
    setSelectedWorkspaceType(type);
    setIsCreateDialogOpen(true);
  };

  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim()) {
      toast.error("Please enter a workspace name");
      return;
    }

    try {
      if (selectedWorkspaceType === 'local') {
        // For local workspace, open directory picker
        await openLocalDirectory();
        // Create workspace with the selected directory
        createWorkspace(newWorkspaceName, 'local');
        toast.success("Local workspace created successfully!");
      } else {
        // Browser workspace
        createWorkspace(newWorkspaceName, 'browser');
        toast.success("Browser workspace created successfully!");
      }
      
      setIsCreateDialogOpen(false);
      setNewWorkspaceName("");
      setSelectedWorkspaceType('browser');
    } catch (error) {
      toast.error("Failed to create workspace", (error as Error).message);
    }
  };

  const handleDeleteWorkspace = (workspace: Workspace) => {
    if (workspaces.length <= 1) {
      toast.error("Cannot delete the last workspace");
      return;
    }
    
    deleteWorkspace(workspace.id);
    toast.success(`Workspace "${workspace.name}" deleted`);
  };

  const getWorkspaceIcon = (type: Workspace['type']) => {
    switch (type) {
      case 'local':
        return <FolderOpen className="h-3 w-3" />;
      case 'drive':
        return <Cloud className="h-3 w-3" />;
      default:
        return <Globe className="h-3 w-3" />;
    }
  };

  const getWorkspaceTypeLabel = (type: Workspace['type']) => {
    switch (type) {
      case 'local':
        return 'Local Files';
      case 'drive':
        return 'Google Drive';
      default:
        return 'Browser Storage';
    }
  };

  return (
    <div className={cn("w-full", className)}>
      <DropdownMenu open={isWorkspacePickerOpen} onOpenChange={setWorkspacePickerOpen}>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            className="w-full justify-between text-left font-normal h-8 px-2"
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {currentWorkspace && getWorkspaceIcon(currentWorkspace.type)}
              <span className="truncate">
                {currentWorkspace?.name || "No workspace selected"}
              </span>
            </div>
            <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          {workspaces.map((workspace) => (
            <div key={workspace.id} className="flex items-center group">
              <DropdownMenuItem
                onClick={() => switchWorkspace(workspace.id)}
                className={cn(
                  "cursor-pointer flex-1 flex items-center gap-2",
                  workspace.id === currentWorkspace?.id && "bg-accent"
                )}
              >
                {getWorkspaceIcon(workspace.type)}
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="truncate">{workspace.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {getWorkspaceTypeLabel(workspace.type)}
                  </span>
                </div>
              </DropdownMenuItem>
              {workspaces.length > 1 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity mr-1"
                    >
                      <MoreHorizontal className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem 
                      onClick={() => handleDeleteWorkspace(workspace)}
                      className="text-destructive cursor-pointer"
                    >
                      <Trash className="h-3 w-3 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          ))}
          {workspaces.length > 0 && <DropdownMenuSeparator />}
          <DropdownMenuItem 
            onClick={() => setIsTypePickerOpen(true)} 
            className="cursor-pointer"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Create Workspace Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              Create {selectedWorkspaceType === 'browser' ? 'Browser' : 'Local'} Workspace
            </DialogTitle>
            <DialogDescription>
              Give your {selectedWorkspaceType === 'browser' ? 'browser' : 'local'} workspace a name.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="workspace-name">Workspace Name</Label>
              <Input
                id="workspace-name"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                placeholder={`My ${selectedWorkspaceType === 'browser' ? 'Browser' : 'Local'} Workspace`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateWorkspace();
                  }
                }}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              {selectedWorkspaceType === 'browser'
                ? 'Your workspace will be saved in browser storage and available on this device.'
                : 'Your workspace will connect to a folder on your computer for file access.'
              }
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsCreateDialogOpen(false);
                setIsTypePickerOpen(true);
              }}
            >
              Back
            </Button>
            <Button onClick={handleCreateWorkspace}>
              Create Workspace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Workspace Type Picker */}
      <WorkspaceTypePicker
        open={isTypePickerOpen}
        onOpenChange={setIsTypePickerOpen}
        onSelectType={handleTypeSelected}
      />
    </div>
  );
}