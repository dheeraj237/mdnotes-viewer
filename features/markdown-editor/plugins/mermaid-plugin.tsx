/**
 * Mermaid plugin for CodeMirror to render mermaid diagrams
 * Converts ```mermaid code blocks into visual diagrams
 */

import { syntaxTree } from '@codemirror/language';
import { RangeSetBuilder } from '@codemirror/state';
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  WidgetType,
} from '@codemirror/view';
import { shouldShowSource } from 'codemirror-live-markdown';

// Mermaid instance counter to generate unique IDs
let mermaidCounter = 0;

/**
 * Widget to render Mermaid diagram
 */
class MermaidWidget extends WidgetType {
  constructor(private code: string, private id: string) {
    super();
  }

  eq(other: MermaidWidget) {
    return other instanceof MermaidWidget && this.code === other.code;
  }

  toDOM() {
    const container = document.createElement("div");
    container.className = "cm-mermaid-diagram";

    // Add loading message
    container.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--muted-foreground);">Loading diagram...</div>';

    // Render mermaid asynchronously
    this.renderMermaid(container, this.code, this.id);

    return container;
  }

  async renderMermaid(container: HTMLElement, code: string, id: string) {
    try {
      // Dynamically import mermaid
      const mermaid = (await import("mermaid")).default;

      // Detect theme - check for dark class on html/body or use media query
      const htmlEl = document.documentElement;
      const isDark = htmlEl.classList.contains('dark') ||
                     (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
      const theme = isDark ? "dark" : "default";

      // Initialize mermaid with configuration
      mermaid.initialize({
        startOnLoad: false,
        theme: theme,
        securityLevel: "loose",
        fontFamily: "inherit",
        flowchart: {
          useMaxWidth: true,
        },
      });

      // Render the diagram
      const { svg } = await mermaid.render(id, code);
      container.innerHTML = svg;
    } catch (err) {
      console.error("Mermaid rendering error:", err);
      container.innerHTML = `
        <div style="padding: 1rem; background: hsl(var(--destructive) / 0.1); border: 1px solid hsl(var(--destructive) / 0.3); border-radius: 0.375rem; color: hsl(var(--destructive));">
          <strong>Failed to render Mermaid diagram:</strong>
          <pre style="margin-top: 0.5rem; font-size: 0.75rem; white-space: pre-wrap;">${err instanceof Error ? err.message : "Unknown error"}</pre>
        </div>
      `;
    }
  }

  ignoreEvent() {
    return false;
  }
}

/**
 * Check if a range overlaps with any selection
 */
function hasSelectionOverlap(view: EditorView, from: number, to: number): boolean {
  const { selection } = view.state;
  for (const range of selection.ranges) {
    if (range.from < to && range.to > from) {
      return true;
    }
  }
  return false;
}

/**
 * Build decorations for mermaid diagrams
 */
function buildMermaidDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const processedBlocks = new Set<number>();

  // Process each visible range
  for (let { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter: (node) => {
        // Look for FencedCode nodes
        if (node.name === 'FencedCode') {
          const blockStart = node.from;
          const blockEnd = node.to;

          // Skip if already processed
          if (processedBlocks.has(blockStart)) return;
          processedBlocks.add(blockStart);

          // Get the full text of the code block
          const blockText = view.state.doc.sliceString(blockStart, blockEnd);

          // Check if it's a mermaid code block - look for ```mermaid
          if (!blockText.toLowerCase().includes('mermaid')) return;

          // Extract code between ```mermaid and ```
          const lines = blockText.split('\n');
          if (lines.length < 3 || !lines[0].trim().match(/^```\s*mermaid\s*$/i)) return;

          // Get code content (everything between first and last line)
          const mermaidCode = lines.slice(1, -1).join('\n').trim();
          if (!mermaidCode) return;

          // Show raw source when caret is inside or selection overlaps
          if (shouldShowSource(view.state, blockStart, blockEnd) ||
              hasSelectionOverlap(view, blockStart, blockEnd)) {
            return;
          }

          // Generate stable unique ID for this diagram
          const id = `mermaid-${blockStart}-${mermaidCounter++}`;

          // Replace the entire code block with the mermaid widget
          const widget = new MermaidWidget(mermaidCode, id);
          builder.add(
            blockStart,
            blockEnd,
            Decoration.replace({ widget })
          );
        }
      },
    });
  }

  return builder.finish();
}

/**
 * Mermaid plugin
 * Renders mermaid diagrams in code blocks
 */
export const mermaidPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildMermaidDecorations(view);
    }

    update(update: any) {
      // Rebuild on document, viewport, or selection changes
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = buildMermaidDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

