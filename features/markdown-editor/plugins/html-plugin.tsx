/**
 * Custom HTML plugin for CodeMirror to render HTML blocks and collapsable details/summary
 * Supports inline HTML, styled divs, and details/summary elements
 */

import { syntaxTree } from '@codemirror/language';
import { EditorState, Range, StateField } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView, WidgetType } from '@codemirror/view';
import { shouldShowWidgetSourceState, sanitizeHTML, containsMarkdown } from './plugin-utils';

/**
 * Check if HTML content contains a details/summary block
 */
function isDetailsBlock(html: string): boolean {
  return /<details[\s>]/i.test(html) && /<summary[\s>]/i.test(html);
}

/**
 * Extract content between details tags
 */
function extractDetailsContent(html: string): { summary: string; content: string } | null {
  const detailsMatch = html.match(/<details[^>]*>([\s\S]*?)<\/details>/i);
  if (!detailsMatch) return null;

  const innerContent = detailsMatch[1];
  const summaryMatch = innerContent.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i);

  if (!summaryMatch) return null;

  const summary = summaryMatch[1].trim();
  const content = innerContent.substring(summaryMatch[0].length).trim();

  return { summary, content };
}

/**
 * Widget to render HTML content
 */
class HTMLBlockWidget extends WidgetType {
  constructor(private html: string) {
    super();
  }

  eq(other: HTMLBlockWidget) {
    return other instanceof HTMLBlockWidget && this.html === other.html;
  }

  toDOM() {
    const container = document.createElement('div');
    container.className = 'cm-html-block-widget';

    try {
      const sanitized = sanitizeHTML(this.html);
      const contentWrapper = document.createElement('div');
      contentWrapper.className = 'cm-html-content';
      contentWrapper.innerHTML = sanitized;
      container.appendChild(contentWrapper);
    } catch (err) {
      console.error('[HTMLBlockWidget] Error rendering:', err);
      container.innerHTML = '<div style="color: red;">Error rendering HTML block</div>';
    }

    return container;
  }

  ignoreEvent() {
    return false;
  }
}

/**
 * Widget to render collapsable details/summary blocks
 */
class DetailsBlockWidget extends WidgetType {
  private summaryElement: HTMLElement | null = null;

  constructor(private summary: string, private content: string) {
    super();
  }

  eq(other: DetailsBlockWidget) {
    return other instanceof DetailsBlockWidget &&
           this.summary === other.summary &&
           this.content === other.content;
  }

  toDOM() {
    const container = document.createElement('div');
    container.className = 'cm-details-block-widget';

    try {
      const details = document.createElement('details');
      details.className = 'cm-details';

      const summary = document.createElement('summary');
      summary.className = 'cm-summary';
      this.summaryElement = summary;

      const arrow = document.createElement('span');
      arrow.className = 'cm-summary-arrow';
      arrow.textContent = '▶';
      summary.appendChild(arrow);

      const summaryText = document.createElement('span');
      summaryText.className = 'cm-summary-text';
      summaryText.innerHTML = sanitizeHTML(this.summary);
      summary.appendChild(summaryText);

      details.addEventListener('toggle', () => {
        if (details.open) {
          arrow.style.transform = 'rotate(90deg)';
        } else {
          arrow.style.transform = 'rotate(0deg)';
        }
      });

      const contentWrapper = document.createElement('div');
      contentWrapper.className = 'cm-details-content';
      contentWrapper.innerHTML = sanitizeHTML(this.content);

      details.appendChild(summary);
      details.appendChild(contentWrapper);
      container.appendChild(details);
    } catch (err) {
      console.error('[DetailsBlockWidget] Error rendering:', err);
      container.innerHTML = '<div style="color: red;">Error rendering details block</div>';
    }

    return container;
  }

  ignoreEvent(event: Event) {
    if (!event.target) return false;
    const target = event.target as HTMLElement;

    if (this.summaryElement && this.summaryElement.contains(target)) {
      if (event.type === 'mousedown' || event.type === 'click') {
        return true;
      }
    }

    return false;
  }
}

/**
 * Check if content is a complete HTML block
 */
function isCompleteHTMLBlock(content: string): boolean {
  const trimmed = content.trim();

  if (!/^<([a-zA-Z][a-zA-Z0-9]*)[^>]*>/.test(trimmed)) {
    return false;
  }

  const openTagMatch = trimmed.match(/^<([a-zA-Z][a-zA-Z0-9]*)/);
  if (!openTagMatch) return false;

  const tagName = openTagMatch[1].toLowerCase();

  const selfClosingTags = ['br', 'hr', 'img', 'input', 'meta', 'link'];
  if (selfClosingTags.includes(tagName)) {
    return true;
  }

  const closeTagRegex = new RegExp(`</${tagName}[^>]*>\\s*$`, 'i');
  return closeTagRegex.test(trimmed);
}

/**
 * Build decorations for HTML blocks
 */
function buildHTMLDecorations(state: EditorState): DecorationSet {
  const decorations: Range<Decoration>[] = [];

  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name === 'HTMLBlock') {
        const content = state.doc.sliceString(node.from, node.to).trim();

        if (!content) return;
        if (!isCompleteHTMLBlock(content)) return;
        if (containsMarkdown(content)) return;

        // Use shared utility to check if source should be shown
        const shouldShowSource = shouldShowWidgetSourceState(state, node.from, node.to);

        if (!shouldShowSource) {
          if (isDetailsBlock(content)) {
            const detailsContent = extractDetailsContent(content);
            if (detailsContent) {
              if (containsMarkdown(detailsContent.content)) return;

              const widget = new DetailsBlockWidget(
                detailsContent.summary,
                detailsContent.content
              );
              decorations.push(
                Decoration.replace({ widget, block: true }).range(node.from, node.to)
              );
              return;
            }
          }

          const widget = new HTMLBlockWidget(content);
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
 * Create HTML StateField
 */
const htmlField = StateField.define<DecorationSet>({
  create(state) {
    return buildHTMLDecorations(state);
  },

  update(deco, tr) {
    if (tr.docChanged || tr.reconfigured) {
      return buildHTMLDecorations(tr.state);
    }

    // Rebuild on selection change to show source
    if (tr.selection) {
      return buildHTMLDecorations(tr.state);
    }

    return deco;
  },

  provide: (f) => EditorView.decorations.from(f),
});

/**
 * HTML plugin
 * Renders HTML blocks and collapsable details/summary elements
 */
export const htmlPlugin = htmlField;
