"use client";

import { PanelLeft, PanelRight, Eye, Code2, Sparkles } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { ThemeToggle } from "@/shared/components/theme-toggle";
import { usePanelStore } from "@/core/store/panel-store";
import { useEditorStore } from "@/features/markdown-editor/store/editor-store";
import { Separator } from "@/shared/components/ui/separator";
import { cn } from "@/shared/utils/cn";

export function AppToolbar() {
  const { toggleLeftPanel, toggleRightPanel } = usePanelStore();
  const { activeTabId, viewMode, setViewMode } = useEditorStore();

  const hasActiveFile = activeTabId !== null;

  return (
    <div className="h-12 border-b bg-background px-4 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-2">
        <div className="text-sm font-medium text-muted-foreground" title="MarkDown Is All You Need">
          MDIAYN Editor
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Mode Switcher - only show when file is open */}
        {hasActiveFile && (
          <>
            <div className="flex items-center gap-0.5 bg-muted/30 rounded-md p-0.5">
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-7 w-7 cursor-pointer",
                  viewMode === "code" && "bg-background shadow-sm"
                )}
                onClick={() => setViewMode("code")}
                title="Code Editor"
              >
                <Code2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-7 w-7 cursor-pointer",
                  viewMode === "live" && "bg-background shadow-sm"
                )}
                onClick={() => setViewMode("live")}
                title="Live Preview Editor"
              >
                <Sparkles className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-7 w-7 cursor-pointer",
                  viewMode === "preview" && "bg-background shadow-sm"
                )}
                onClick={() => setViewMode("preview")}
                title="Preview Mode"
              >
                <Eye className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Separator orientation="vertical" className="h-6" />
          </>
        )}

        {/* Panel toggles */}
        <Button variant="ghost" size="icon" className="cursor-pointer h-8 w-8" onClick={toggleLeftPanel}>
          <PanelLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="cursor-pointer h-8 w-8" onClick={toggleRightPanel}>
          <PanelRight className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="h-6" />
        <ThemeToggle />
      </div>
    </div>
  );
}
