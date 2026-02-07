/**
 * Main application page - Composes the VSCode-like interface
 * Uses AppShell for 3-panel layout and UnifiedEditor for content area
 */
"use client";

import { AppShell } from "@/shared/components/app-shell";
import { UnifiedEditor } from "@/features/markdown-editor/components/unified-editor";

export default function Home() {
  return (
    <AppShell>
      <UnifiedEditor />
    </AppShell>
  );
}
