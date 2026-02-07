/**
 * Mermaid plugin for CodeMirror to render mermaid diagrams
 * Converts ```mermaid code blocks into visual diagrams
 */

import { syntaxTree } from '@codemirror/language';
import { EditorState, Range, StateField } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView, WidgetType } from '@codemirror/view';
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
 * Build decorations for mermaid diagrams
 */
function buildMermaidDecorations(state: EditorState): DecorationSet {
  const decorations: Range<Decoration>[] = [];

  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name === 'FencedCode') {
        // Get language info
        const codeInfo = node.node.getChild('CodeInfo');
        if (!codeInfo) return;

        const language = state.doc.sliceString(codeInfo.from, codeInfo.to).trim().toLowerCase();

        // Only process mermaid blocks
        if (language !== 'mermaid') return;

        // Get code content
        const codeText = node.node.getChild('CodeText');
        const code = codeText
          ? state.doc.sliceString(codeText.from, codeText.to).trim()
          : '';

        if (!code) return;

        // Check if cursor/selection is inside
        const isTouched = shouldShowSource(state, node.from, node.to);

        if (!isTouched) {
          // Render mode: show widget
          const id = `mermaid-${node.from}-${mermaidCounter++}`;
          const widget = new MermaidWidget(code, id);

          decorations.push(
            Decoration.replace({ widget, block: true }).range(node.from, node.to)
          );
        }
      }
    },
  });

  return Decoration.set(decorations.sort((a, b) => a.from - b.from), true);
}

/**
 * Create mermaid StateField
 */
const mermaidField = StateField.define<DecorationSet>({
  create(state) {
    return buildMermaidDecorations(state);
  },

  update(deco, tr) {
    // Rebuild on document or config change
    if (tr.docChanged || tr.reconfigured) {
      return buildMermaidDecorations(tr.state);
    }

    // Rebuild on selection change
    if (tr.selection) {
      return buildMermaidDecorations(tr.state);
    }

    return deco;
  },

  provide: (f) => EditorView.decorations.from(f),
});

/**
 * Mermaid plugin
 * Renders mermaid diagrams in code blocks
 */
export const mermaidPlugin = mermaidField;

