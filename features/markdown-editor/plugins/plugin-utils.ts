/**
 * Shared utility functions for CodeMirror plugins
 * Provides common functionality for rendering widgets and handling selections
 */

import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { shouldShowSource } from 'codemirror-live-markdown';

/**
 * Check if a range overlaps with any selection
 * Used to show source when user selects text that includes the widget
 */
export function hasSelectionOverlap(view: EditorView, from: number, to: number): boolean {
  const { selection } = view.state;
  for (const range of selection.ranges) {
    if (range.from < to && range.to > from) {
      return true;
    }
  }
  return false;
}

/**
 * Check if a range overlaps with any selection (for StateField plugins)
 */
export function hasSelectionOverlapState(state: EditorState, from: number, to: number): boolean {
  const { selection } = state;
  for (const range of selection.ranges) {
    if (range.from < to && range.to > from) {
      return true;
    }
  }
  return false;
}

/**
 * Determine if source should be shown for a widget
 * Combines shouldShowSource with selection overlap check
 */
export function shouldShowWidgetSource(view: EditorView, from: number, to: number): boolean {
  return shouldShowSource(view.state, from, to) || hasSelectionOverlap(view, from, to);
}

/**
 * Determine if source should be shown for a widget (StateField version)
 */
export function shouldShowWidgetSourceState(state: EditorState, from: number, to: number): boolean {
  return shouldShowSource(state, from, to) || hasSelectionOverlapState(state, from, to);
}

/**
 * Sanitize HTML to remove dangerous attributes
 */
export function sanitizeHTML(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]*/gi, '');
}

/**
 * Check if content contains markdown syntax
 */
export function containsMarkdown(content: string): boolean {
  // Check for code blocks
  if (/```/.test(content)) return true;
  // Check for lists
  if (/^\s*[-*+]\s/m.test(content)) return true;
  // Check for headings
  if (/^#{1,6}\s/m.test(content)) return true;
  return false;
}
