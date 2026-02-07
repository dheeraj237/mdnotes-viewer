/**
 * Custom code block plugin for CodeMirror to render code blocks
 * Skips mermaid and math blocks (handled by other plugins)
 * Uses mini CodeMirror instances for syntax highlighting and line numbers
 */

import { syntaxTree } from '@codemirror/language';
import { EditorState as CMEditorState, Range, StateField } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView, WidgetType, lineNumbers } from '@codemirror/view';
import { shouldShowSource } from 'codemirror-live-markdown';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { json } from '@codemirror/lang-json';
import { sql } from '@codemirror/lang-sql';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';

/**
 * Languages to skip (handled by other plugins)
 */
const SKIP_LANGUAGES = new Set(['mermaid', 'math', 'latex']);

/**
 * Map language names to CodeMirror language extensions
 */
function getLanguageExtension(lang: string) {
  const langLower = lang.toLowerCase();

  switch (langLower) {
    case 'javascript':
    case 'js':
    case 'jsx':
      return javascript({ jsx: true });
    case 'typescript':
    case 'ts':
    case 'tsx':
      return javascript({ typescript: true, jsx: true });
    case 'python':
    case 'py':
      return python();
    case 'css':
    case 'scss':
    case 'sass':
    case 'less':
      return css();
    case 'html':
    case 'xml':
    case 'svg':
      return html();
    case 'json':
    case 'jsonc':
      return json();
    case 'sql':
    case 'mysql':
    case 'postgres':
      return sql();
    case 'markdown':
    case 'md':
      return markdown();
    default:
      return null;
  }
}

/**
 * Widget to render code block using a mini CodeMirror editor
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

    // Create CodeMirror container
    const editorDiv = document.createElement("div");
    editorDiv.className = "cm-code-block-editor";

    // Get language extension for syntax highlighting
    const langExtension = getLanguageExtension(this.language);

    // Check if dark mode is enabled
    const isDark = document.documentElement.classList.contains('dark');

    // Create mini CodeMirror instance
    const extensions = [
      EditorView.editable.of(false), // Read-only
      EditorView.lineWrapping, // Wrap long lines
      lineNumbers(), // Show line numbers
    ];

    // Add language support if available
    if (langExtension) {
      extensions.push(langExtension);
    }

    // Add dark theme if needed
    if (isDark) {
      extensions.push(oneDark);
    }

    const view = new EditorView({
      state: CMEditorState.create({
        doc: this.code,
        extensions,
      }),
      parent: editorDiv,
    });

    container.appendChild(editorDiv);

    // Store view reference for cleanup
    (container as any)._cmView = view;

    return container;
  }

  destroy(dom: HTMLElement) {
    // Clean up CodeMirror instance
    const view = (dom as any)._cmView;
    if (view) {
      view.destroy();
    }
  }

  ignoreEvent() {
    return false;
  }
}

/**
 * Build decorations for code blocks
 */
function buildCodeBlockDecorations(state: CMEditorState): DecorationSet {
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

