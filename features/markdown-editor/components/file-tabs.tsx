"use client";

import { X } from "lucide-react";
import { useEditorStore } from "@/features/markdown-editor/store/editor-store";
import { cn } from "@/shared/utils/cn";

export function FileTabs() {
  const { openTabs, activeTabId, setActiveTab, closeTab } = useEditorStore();

  if (openTabs.length === 0) return null;

  return (
    <div className="flex items-center overflow-x-auto flex-1">
      {openTabs.map((tab) => (
        <div
          key={tab.id}
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
        </div>
      ))}
    </div>
  );
}
