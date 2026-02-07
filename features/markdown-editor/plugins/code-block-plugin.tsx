/**
 * Custom code block plugin for CodeMirror to render code blocks
 * Skips mermaid and math blocks (handled by other plugins)
 * Shows syntax highlighting and line numbers for code blocks
 */

import { syntaxTree } from '@codemirror/language';
import { EditorState, Range, StateField } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView, WidgetType } from '@codemirror/view';
import { shouldShowSource } from 'codemirror-live-markdown';

/**
 * Languages to skip (handled by other plugins)
 */
const SKIP_LANGUAGES = new Set(['mermaid', 'math', 'latex']);

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
 * Build decorations for code blocks
 */
function buildCodeBlockDecorations(state: EditorState): DecorationSet {
  const decorations: Range<Decoration>[] = [];

  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name === 'FencedCode') {
        // Get language info
        const codeInfo = node.node.getChild('CodeInfo');
        let language = 'text';

        if (codeInfo) {
          language = state.doc.sliceString(codeInfo.from, codeInfo.to).trim().toLowerCase();
        }

        // Skip special languages (handled by other plugins)
        if (SKIP_LANGUAGES.has(language)) {
          return;
        }

        // Get code content
        const codeText = node.node.getChild('CodeText');
        const code = codeText
          ? state.doc.sliceString(codeText.from, codeText.to)
          : '';

        if (!code.trim()) return;

        // Check if cursor/selection is inside
        const isTouched = shouldShowSource(state, node.from, node.to);

        if (!isTouched) {
          // Render mode: show widget
          const widget = new CodeBlockWidget(code, language);

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
 * Create code block StateField
 */
const codeBlockField = StateField.define<DecorationSet>({
  create(state) {
    return buildCodeBlockDecorations(state);
  },

  update(deco, tr) {
    // Rebuild on document or config change
    if (tr.docChanged || tr.reconfigured) {
      return buildCodeBlockDecorations(tr.state);
    }

    // Rebuild on selection change
    if (tr.selection) {
      return buildCodeBlockDecorations(tr.state);
    }

    return deco;
  },

  provide: (f) => EditorView.decorations.from(f),
});

/**
 * Code block plugin
 * Renders code blocks with syntax highlighting and line numbers
 */
export const codeBlockPlugin = codeBlockField;

