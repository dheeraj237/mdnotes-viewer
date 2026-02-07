"use client";

import { X, Loader2, Eye, Code2 } from "lucide-react";
import { useEditorStore } from "@/features/markdown-editor/store/editor-store";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/utils/cn";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";

export function FileTabs() {
  const { openTabs, activeTabId, setActiveTab, closeTab, viewMode, isLivePreviewMode, setLivePreviewMode } = useEditorStore();

  if (openTabs.length === 0) return null;

  const formatLastSaved = (lastSaved?: Date) => {
    if (!lastSaved) return "Not saved yet";
    return `Last saved: ${lastSaved.toLocaleTimeString()}`;
  };

  const togglePreviewMode = () => {
    setLivePreviewMode(!isLivePreviewMode);
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center overflow-x-auto flex-1">
        {openTabs.map((tab) => (
          <Tooltip key={tab.id}>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "flex items-center gap-2 px-3 py-2.5 border-r border-border cursor-pointer transition-colors min-w-30 max-w-50 group relative",
                  activeTabId === tab.id
                    ? "bg-editor-background text-foreground"
                    : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                )}
                onClick={() => setActiveTab(tab.id)}
              >
                {activeTabId === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                )}
                <span className="text-sm truncate flex-1">{tab.name}</span>
                {tab.isSaving ? (
                  <Loader2 className="h-3 w-3 animate-spin text-primary" />
                ) : (
                    <button
                      className={cn(
                        "hover:bg-accent rounded p-0.5 transition-opacity *:cursor-pointer",
                        activeTabId === tab.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTab(tab.id);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </button>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              <div className="space-y-1">
                <div className="font-medium">{tab.path}</div>
                <div className="text-muted-foreground">{formatLastSaved(tab.lastSaved)}</div>
              </div>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
      {viewMode === "live" && openTabs.length > 0 && (
        <div className="flex items-center gap-2 px-3 border-l border-border">
          <Button
            size="sm"
            variant={isLivePreviewMode ? "default" : "outline"}
            onClick={togglePreviewMode}
            className="gap-2 h-7 text-xs"
            title={isLivePreviewMode ? "Switch to Source Mode" : "Switch to Live Preview"}
          >
            {isLivePreviewMode ? (
              <>
                <Eye className="h-3 w-3" />
                Live Preview
              </>
            ) : (
              <>
                <Code2 className="h-3 w-3" />
                Source Mode
              </>
            )}
          </Button>
        </div>
      )}
    </TooltipProvider>
  );
}
