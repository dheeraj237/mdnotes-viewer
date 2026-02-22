/**
 * Editor Page - Main application interface with file explorer and markdown editor
 * Uses AppShell for 3-panel layout and Editor for content area
 */
"use client";

import { AppShell } from "@/shared/components/app-shell";
import { Editor } from "@/features/editor/components/unified-editor";

export default function EditorPage() {
  return (
    <AppShell>
      <Editor />
    </AppShell>
  );
}
