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
