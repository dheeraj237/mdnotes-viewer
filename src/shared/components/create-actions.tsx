import { Button } from "@/shared/components/ui/button";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/shared/components/ui/dropdown-menu";
import { 
  Plus, 
  FolderPlus, 
  ChevronDown,
  FileText
} from "lucide-react";
import { ThemeToggle } from "@/shared/components/theme-toggle";

interface CreateActionsProps {
  onNewNote: () => void;
  onNewWorkspace: () => void;
}

export function CreateActions({ onNewNote, onNewWorkspace }: CreateActionsProps) {
  return (
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
          <DropdownMenuItem onClick={onNewNote} className="cursor-pointer">
            <FileText className="h-4 w-4 mr-2" />
            New Note
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onNewWorkspace} className="cursor-pointer">
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
  );
}