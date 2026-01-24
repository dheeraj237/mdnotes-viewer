# GitHub Copilot Instructions for MDNotes Viewer

## Project Overview

**MDNotes Viewer** is a modern, VSCode-inspired markdown documentation viewer built with Next.js 15. It provides a professional interface for viewing and editing markdown files with syntax highlighting, auto-save, and a feature-rich editing experience.

### Key Technologies
- **Framework**: Next.js 16.1.4 (App Router) with TypeScript 5
- **Package Manager**: Yarn (for faster development)
- **React**: 19.2.3 with Server/Client Components
- **Styling**: Tailwind CSS 4 with CSS Variables for theming
- **State Management**: Zustand 5.0.10 with persistence
- **UI Components**: Custom components + Radix UI primitives
- **Markdown Rendering**: react-markdown 10.1.0, remark-gfm 4.0.1
- **Markdown Editor**: Milkdown 7.18.0 (WYSIWYG editor framework)
- **Syntax Highlighting**: rehype-prism-plus 2.0.1 with custom theme
- **Panel Layout**: react-resizable-panels 2.0.0
- **Icons**: lucide-react 0.563.0
- **File Tree**: react-complex-tree 2.6.1

### Active Features
- ✅ Three-panel layout (explorer, editor/preview, TOC)
- ✅ Resizable and collapsible panels
- ✅ File explorer with tree navigation
- ✅ Markdown preview with GFM support
- ✅ Milkdown WYSIWYG editor
- ✅ Table of Contents with scroll sync
- ✅ Code blocks with syntax highlighting and copy button
- ✅ Auto-save with 2-second debouncing
- ✅ View mode switching (editor/preview)
- ✅ Theme switching (light/dark)
- ✅ Feature flag management system

### In Development
- 🔄 Mermaid diagram support (feature flag: disabled)
- 🔄 Full-text search
- 🔄 Split view mode (side-by-side editor and preview)

---

## Architecture Principles

### 1. Feature-Based Structure
```
features/
├── file-explorer/        # File tree and navigation
│   ├── components/       # FileExplorer component
│   └── store/           # File tree state management
├── markdown-preview/     # Markdown rendering
│   ├── components/       # MarkdownPreview, CodeBlock, MermaidDiagram, TOC
│   └── store/           # TOC state for scroll sync
├── markdown-editor/      # Milkdown integration
│   ├── components/       # MilkdownEditor
│   ├── plugins/         # Custom Milkdown plugins (mermaid - WIP)
│   └── store/           # Editor state (currentFile, viewMode)
└── roadmap-tracker/      # Development roadmap (disabled)
```

Each feature is self-contained with:
- `components/` - Feature-specific React components
- `hooks/` - Custom hooks for feature logic (if needed)
- `store/` - Zustand store for feature state
- `plugins/` - Feature-specific plugins or extensions

### 2. Shared Resources
```
shared/
├── components/
│   ├── ui/              # Reusable UI primitives (Button, Separator)
│   ├── app-shell.tsx    # Main layout with resizable panels
│   ├── app-toolbar.tsx  # Top toolbar with view toggle
│   ├── theme-provider.tsx
│   ├── theme-toggle.tsx
│   └── view-mode-toggle.tsx
├── hooks/               # Shared custom hooks
├── utils/
│   └── cn.ts           # Class name utility (clsx + tailwind-merge)
└── types/
    └── index.ts        # TypeScript type definitions
```

### 3. Core Configuration
```
core/
├── config/
│   ├── features.ts                        # Feature flag management
│   └── feature-flag-provider.example.tsx  # GrowthBook integration template
└── store/
    └── panel-store.ts                     # Global panel state
```

### 4. App Structure
```
app/
├── layout.tsx           # Root layout with providers
├── page.tsx            # Main page with editor/preview routing
├── globals.css         # Global styles and Milkdown customizations
└── api/
    └── files/
        └── [...path]/
            └── route.ts  # File system API endpoints
```

### 5. Design Tokens
All colors use HSL format with CSS variables for theme switching:
```css
--background: 0 0% 100%;
--foreground: 222.2 47.4% 11.2%;
--primary: 221.2 83.2% 53.3%;
--sidebar-background: 218 18% 97%;
--editor-background: 0 0% 99%;
```

---

## Development Guidelines

### Code Style
1. **Use functional components** with hooks (no class components)
2. **"use client"** directive for client components
3. **TypeScript strict mode** - all components must be typed
4. **Utility-first CSS** - use Tailwind classes, avoid custom CSS
5. **Import organization**:
   ```typescript
   // External libraries
   import { useState } from "react";
   import { FileTree } from "react-complex-tree";
   
   // Internal aliases
   import { Button } from "@/shared/components/ui/button";
   import { useEditorStore } from "@/features/markdown-editor/store/editor-store";
   import { cn } from "@/shared/utils/cn";
   ```

### Component Patterns
```typescript
// Always export named functions
export function ComponentName() {
  // State
  const [state, setState] = useState();
  const store = useStore();
  
  // Effects
  useEffect(() => {
    // Effect logic
  }, [dependencies]);
  
  // Handlers
  const handleAction = () => {
    // Handler logic
  };
  
  // Render
  return (
    <div className={cn("base-classes", conditional && "conditional-class")}>
      {/* Component JSX */}
    </div>
  );
}
```

### State Management with Zustand
```typescript
// Create store in feature/store/ directory
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface StoreState {
  value: string;
  setValue: (val: string) => void;
}

export const useFeatureStore = create<StoreState>()(
  persist(
    (set) => ({
      value: "",
      setValue: (val) => set({ value: val }),
    }),
    { name: "feature-storage" }
  )
);
```

### File Naming Conventions
- Components: `kebab-case.tsx` (e.g., `file-explorer.tsx`)
- Hooks: `use-feature-name.ts` (e.g., `use-file-tree.ts`)
- Types: `index.ts` or `feature-types.ts`
- Stores: `feature-store.ts` (e.g., `editor-store.ts`)
- Utils: `utility-name.ts` (e.g., `cn.ts`)

---

## Current Project Status

### ✅ Completed
- Next.js 16.1.4 project with TypeScript 5
- Tailwind CSS 4 with design tokens (light/dark theme)
- Feature-based folder structure
- Zustand stores (panel, editor, file-explorer, toc)
- Theme provider with next-themes
- VSCode-like three-panel layout with resizable panels
- App toolbar with view mode toggle and theme toggle
- File explorer with tree navigation
- Markdown preview with react-markdown and GFM support
- Code blocks with syntax highlighting (rehype-prism-plus) and copy button
- Table of Contents with scroll sync and active heading detection
- Milkdown WYSIWYG editor integration
- Auto-save with 2-second debouncing
- File system API routes
- Feature flag management system with GrowthBook integration template

### 🚧 In Progress
- Mermaid diagram support (disabled via feature flag)
- Split view mode (side-by-side editor and preview)
- Full-text search functionality

---

## Feature Flag Management

### Overview
The application uses a centralized feature flag system located in `core/config/features.ts`. Features can be toggled on/off at runtime and support integration with third-party services like GrowthBook for A/B testing and gradual rollouts.

### Usage
```typescript
import { isFeatureEnabled, getFeature } from "@/core/config/features";

// Check if a feature is enabled
if (isFeatureEnabled("mermaidDiagrams")) {
  // Render mermaid diagrams
}

// Get feature details
const feature = getFeature("markdownEditor");
console.log(feature?.version); // "1.0.0"
```

### Available Features
- `fileExplorer` - Tree-based file navigation (enabled)
- `markdownPreview` - Read-only markdown rendering (enabled)
- `markdownEditor` - Milkdown WYSIWYG editor (enabled)
- `mermaidDiagrams` - Mermaid diagram support (disabled, experimental)
- `tableOfContents` - Auto-generated TOC (enabled)
- `roadmapTracker` - Development roadmap (disabled, experimental)
- `searchFeature` - Full-text search (disabled, experimental)
- `aiAssistant` - AI-powered assistance (disabled, experimental)

### GrowthBook Integration
To integrate with GrowthBook or similar services:
1. Install SDK: `yarn add @growthbook/growthbook-react`
2. Copy `core/config/feature-flag-provider.example.tsx` to `feature-flag-provider.tsx`
3. Configure API key in environment variables
4. Wrap app with provider in `app/layout.tsx`

See `feature-flag-provider.example.tsx` for complete implementation template.

---

## Common Tasks & Patterns

### Adding a New Feature
1. Create feature directory: `features/feature-name/`
2. Add subdirectories: `components/`, `hooks/`, `store/`, `plugins/` (if needed)
3. Create store if needed: `store/feature-store.ts`
4. **Add feature flag**: Update `core/config/features.ts` with new feature entry
5. Implement components using shared UI components
6. Guard feature with `isFeatureEnabled()` check in consuming components
7. Export main component from `components/index.ts`

### Creating a UI Component
```typescript
// shared/components/ui/component-name.tsx
"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/shared/utils/cn";

const componentVariants = cva(
  "base-classes",
  {
    variants: {
      variant: {
        default: "default-classes",
        secondary: "secondary-classes",
      },
      size: {
        default: "default-size",
        sm: "small-size",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

interface ComponentProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof componentVariants> {
  // Additional props
}

export function Component({ className, variant, size, ...props }: ComponentProps) {
  return (
    <div
      className={cn(componentVariants({ variant, size, className }))}
      {...props}
    />
  );
}
```

### Adding an API Route
```typescript
// app/api/feature/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Logic
    return NextResponse.json({ data: "result" });
  } catch (error) {
    return NextResponse.json(
      { error: "Error message" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  // Logic
  return NextResponse.json({ success: true });
}
```

### Working with Markdown
```typescript
// Use react-markdown with plugins
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypePrism from "rehype-prism-plus";

export function MarkdownPreview({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypePrism]}
      className="prose dark:prose-invert max-w-none"
      components={{
        // Custom components for links, images, etc.
        a: ({ href, children }) => (
          <a href={href} className="text-primary hover:underline">
            {children}
          </a>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
```

### Mermaid Integration Pattern
```typescript
// Client-side only
"use client";

import { useEffect, useRef } from "react";
import mermaid from "mermaid";

export function MermaidDiagram({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      mermaid.initialize({ theme: "default" });
      mermaid.render("mermaid-diagram", code).then(({ svg }) => {
        if (ref.current) {
          ref.current.innerHTML = svg;
        }
      });
    }
  }, [code]);

  return <div ref={ref} className="mermaid-container" />;
}
```

---

## Performance Considerations

### Bundle Size
- Keep initial bundle < 200KB
- Use dynamic imports for heavy components:
  ```typescript
  const MermaidDiagram = dynamic(() => import("./mermaid-diagram"), {
    loading: () => <div>Loading diagram...</div>,
  });
  ```

### Code Splitting
- Feature components should be lazy-loaded when not immediately needed
- Use React.lazy() for route-level splitting
- Milkdown and Mermaid should be dynamically imported

### Optimization
- Use `useMemo` for expensive computations
- Use `useCallback` for stable function references
- Implement virtualization for large file lists
- Debounce search inputs (300ms)

---
  const MermaidDiagram = dynamic(() => import("./mermaid-diagram"), {
    loading: () => <div>Loading diagram...</div>,
  });
  ```

### Code Splitting
- Feature components should be lazy-loaded when not immediately needed
- Use React.lazy() for route-level splitting
- CodeMirror and Mermaid should be dynamically imported

### Optimization
- Use `useMemo` for expensive computations
- Use `useCallback` for stable function references
- Implement virtualization for large file lists
- Debounce search inputs (300ms)

---

## Testing Guidelines

### Component Testing
- Test user interactions
- Test theme switching
- Test responsive behavior
- Test accessibility (keyboard navigation)

### Integration Testing
- Test file upload flow
- Test markdown rendering
- Test view mode switching
- Test panel resizing and collapse

---

## Accessibility Requirements

- All interactive elements must be keyboard accessible
- Use semantic HTML (button, nav, aside, main, article)
- Include ARIA labels for icon-only buttons
- Maintain proper heading hierarchy
- Support screen readers
- Ensure color contrast meets WCAG 2.1 AA standards

---

## Error Handling

### Pattern for Components
```typescript
import { useEffect, useState } from "react";

export function Component() {
  const [error, setError] = useState<Error | null>(null);

  if (error) {
    return (
      <div className="text-destructive p-4">
        <p>Error: {error.message}</p>
      </div>
    );
  }

  return <div>Component content</div>;
}
```

### Pattern for API Routes
```typescript
export async function GET(request: NextRequest) {
  try {
    // Logic
    return NextResponse.json({ data: "result" });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
```

---

## VSCode Settings

Recommended `.vscode/settings.json`:
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.preferences.importModuleSpecifier": "non-relative",
  "tailwindCSS.experimental.classRegex": [
    ["cva\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"],
    ["cn\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"]
  ]
}
```

---

## Quick Reference: Key Files

### Configuration
- `tailwind.config.ts` - Tailwind configuration with design tokens
- `tsconfig.json` - TypeScript configuration
- `next.config.ts` - Next.js configuration
- `core/config/features.ts` - Feature flags

### State Management
- `core/store/panel-store.ts` - Panel visibility and sizes
- `features/markdown-editor/store/editor-store.ts` - Editor state and mode
- `features/file-explorer/store/file-explorer-store.ts` - File tree state
- `features/markdown-preview/store/toc-store.ts` - TOC state for scroll sync

### Key Components
- `shared/components/app-shell.tsx` - Main layout with panels
- `shared/components/app-toolbar.tsx` - Top toolbar
- `shared/components/theme-provider.tsx` - Theme context
- `shared/components/theme-toggle.tsx` - Theme switcher button

### Utilities
- `shared/utils/cn.ts` - Class name merger (clsx + tailwind-merge)
- `shared/types/index.ts` - Core TypeScript types

---

## Important Notes

### DO
✅ Use "use client" directive for client components  
✅ Follow feature-based architecture  
✅ Use Zustand for state management  
✅ Apply design tokens for colors  
✅ Add proper TypeScript types  
✅ Use semantic HTML  
✅ Implement error boundaries  
✅ Optimize for performance  
✅ Check feature flags before rendering experimental features

### DON'T
❌ Use class components  
❌ Hardcode colors (use CSS variables)  
❌ Mix features in shared components  
❌ Ignore accessibility  
❌ Skip error handling  
❌ Create large bundle sizes  
❌ Use npm (use yarn instead)  
❌ Use slow build tools  

---

## Resources

- [Next.js App Router Docs](https://nextjs.org/docs/app)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Zustand Docs](https://github.com/pmndrs/zustand)
- [react-markdown](https://github.com/remarkjs/react-markdown)
- [Mermaid Docs](https://mermaid.js.org/)
- [Milkdown](https://milkdown.dev/)
- [Radix UI](https://www.radix-ui.com/)

---

**Last Updated**: January 24, 2026  
**Version**: 1.0.0-alpha  
**Maintainer**: Development Team
