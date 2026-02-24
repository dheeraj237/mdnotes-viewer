import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { cn } from "@/shared/utils/cn";

interface WorkspaceTypePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectType: (type: 'browser' | 'local') => void;
}

export function WorkspaceTypePicker({ 
  open, 
  onOpenChange, 
  onSelectType 
}: WorkspaceTypePickerProps) {
  const [selectedType, setSelectedType] = useState<'browser' | 'local'>('browser');

  const handleNext = () => {
    onSelectType(selectedType);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Select a workspace type</DialogTitle>
          <DialogDescription className="sr-only">
            Choose how you want to store your workspace data.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-6">
          <div className="space-y-3">
            {/* Browser option */}
            <button
              type="button"
              onClick={() => setSelectedType('browser')}
              className={cn(
                "w-full text-left p-4 rounded-lg border-2 transition-colors",
                "hover:border-primary/50 focus:outline-none focus:border-primary",
                selectedType === 'browser' 
                  ? "border-primary bg-primary/5" 
                  : "border-border"
              )}
            >
              <div className="flex items-center space-x-3">
                <div className={cn(
                  "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                  selectedType === 'browser' 
                    ? "border-primary" 
                    : "border-muted-foreground"
                )}>
                  {selectedType === 'browser' && (
                    <div className="w-2 h-2 rounded-full bg-primary" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-medium">Browser</div>
                  <div className="text-sm text-muted-foreground">
                    Save workspace data in browser storage
                  </div>
                </div>
              </div>
            </button>

            {/* Native File System option */}
            <button
              type="button"
              onClick={() => setSelectedType('local')}
              className={cn(
                "w-full text-left p-4 rounded-lg border-2 transition-colors",
                "hover:border-primary/50 focus:outline-none focus:border-primary",
                selectedType === 'local' 
                  ? "border-primary bg-primary/5" 
                  : "border-border"
              )}
            >  
              <div className="flex items-center space-x-3">
                <div className={cn(
                  "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                  selectedType === 'local' 
                    ? "border-primary" 
                    : "border-muted-foreground"
                )}>
                  {selectedType === 'local' && (
                    <div className="w-2 h-2 rounded-full bg-primary" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-medium">Native File System</div>
                  <div className="text-sm text-muted-foreground">
                    Save workspace data in native file system
                  </div>
                </div>
                {selectedType === 'local' && (
                  <div className="text-primary">✓</div>
                )}
              </div>
            </button>
          </div>

          <div className="text-center pt-4">
            <p className="text-sm text-muted-foreground">
              Your data stays with you
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleNext} className="w-full">
            Next
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}