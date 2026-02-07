/**
 * Custom code block plugin for CodeMirror to render code blocks
 * Skips mermaid and math blocks (handled by other plugins)
 * Shows syntax highlighting and line numbers for code blocks
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

/**
 * Widget to render code block with syntax highlighting and line numbers
 */
class CodeBlockWidget extends WidgetType {
  constructor(private code: string, private language: string) {
    super();
  }

  eq(other: CodeBlockWidget) {
    return other instanceof CodeBlockWidget &&
           this.code === other.code &&
           this.language === other.language;
  }

  toDOM() {
    const container = document.createElement("div");
    container.className = "cm-code-block-widget";

    // Create header with language label if specified
    if (this.language && this.language !== 'text' && this.language !== 'plain') {
      const header = document.createElement("div");
      header.className = "cm-code-block-lang";
      header.textContent = this.language;
      container.appendChild(header);
    }

    // Create code container
    const codeWrapper = document.createElement("div");
    codeWrapper.className = "cm-code-block-content";

    // Create line numbers
    const lines = this.code.split('\n');
    const lineNumbersDiv = document.createElement("div");
    lineNumbersDiv.className = "cm-code-block-line-numbers";
    lines.forEach((_, i) => {
      const lineNum = document.createElement("div");
      lineNum.className = "cm-code-block-line-number";
      lineNum.textContent = String(i + 1);
      lineNumbersDiv.appendChild(lineNum);
    });

    // Create code content
    const codeDiv = document.createElement("pre");
    codeDiv.className = "cm-code-block-pre";
    const codeElement = document.createElement("code");
    codeElement.className = `cm-code-block-code language-${this.language || 'text'}`;
    codeElement.textContent = this.code;
    codeDiv.appendChild(codeElement);

    codeWrapper.appendChild(lineNumbersDiv);
    codeWrapper.appendChild(codeDiv);
    container.appendChild(codeWrapper);

    return container;
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
 * Build decorations for code blocks
 */
function buildCodeBlockDecorations(view: EditorView): DecorationSet {
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

          // Skip mermaid blocks (handled by mermaid plugin)
          if (blockText.toLowerCase().includes('mermaid')) return;

          // Skip math blocks (handled by math plugin)
          if (blockText.match(/^```\s*(math|latex)\s*$/mi)) return;

          // Extract language and code
          const lines = blockText.split('\n');
          if (lines.length < 2) return;

          // First line is ```language
          const firstLine = lines[0].trim();
          const langMatch = firstLine.match(/^```\s*(\w+)?/);
          if (!langMatch) return;

          const language = langMatch[1] || 'text';

          // Get code content (everything between first and last line)
          const codeContent = lines.slice(1, -1).join('\n');

          // Skip empty code blocks
          if (!codeContent.trim()) return;

          // Show raw source when caret is inside or selection overlaps
          if (shouldShowSource(view.state, blockStart, blockEnd) ||
              hasSelectionOverlap(view, blockStart, blockEnd)) {
            return;
          }

          // Replace the entire code block with the widget
          const widget = new CodeBlockWidget(codeContent, language);
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
 * Code block plugin
 * Renders code blocks with syntax highlighting and line numbers
 */
export const codeBlockPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildCodeBlockDecorations(view);
    }

    update(update: any) {
      // Rebuild on document, viewport, or selection changes
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = buildCodeBlockDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

