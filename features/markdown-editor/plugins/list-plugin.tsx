/**
 * Custom list plugin for CodeMirror to render markdown lists with proper styling
 * This plugin adds visual bullets for unordered lists and checkboxes for task lists
 */

import { ViewPlugin, EditorView, Decoration, DecorationSet, WidgetType } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { RangeSetBuilder } from "@codemirror/state";

/**
 * Widget to replace list markers (-, *, +) with visual bullets
 */
class BulletWidget extends WidgetType {
  constructor(private level: number) {
    super();
  }

  eq(other: BulletWidget) {
    return this.level === other.level;
  }

  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-list-bullet";
    span.setAttribute("data-level", this.level.toString());
    
    // Different bullets for different levels
    const bullets = ["•", "◦", "▪"];
    span.textContent = bullets[Math.min(this.level - 1, 2)];
    
    return span;
  }

  ignoreEvent() {
    return false;
  }
}

/**
 * Widget to replace task list brackets with checkboxes
 */
class CheckboxWidget extends WidgetType {
  constructor(private checked: boolean, private pos: number) {
    super();
  }

  eq(other: CheckboxWidget) {
    return this.checked === other.checked;
  }

  toDOM(view: EditorView) {
    const span = document.createElement("span");
    span.className = "cm-task-checkbox";
    span.setAttribute("role", "checkbox");
    span.setAttribute("aria-checked", this.checked.toString());
    span.setAttribute("data-checked", this.checked.toString());
    
    // Add checkmark for checked items
    if (this.checked) {
      span.textContent = "✓";
      span.classList.add("cm-task-checkbox-checked");
    }
    
    // Make it clickable to toggle
    span.style.cursor = "pointer";
    span.onclick = () => {
      this.toggleCheckbox(view, this.pos);
    };
    
    return span;
  }

  toggleCheckbox(view: EditorView, pos: number) {
    // Find the task marker at this position and toggle it
    const line = view.state.doc.lineAt(pos);
    const text = line.text;
    
    // Match [ ] or [x] or [X]
    const match = text.match(/\[([ xX])\]/);
    if (match && match.index !== undefined) {
      const isChecked = match[1] !== ' ';
      const newChar = isChecked ? ' ' : 'x';
      const from = line.from + match.index + 1;
      const to = from + 1;
      
      view.dispatch({
        changes: { from, to, insert: newChar }
      });
    }
  }

  ignoreEvent() {
    return false;
  }
}

/**
 * Build decorations for lists
 */
function buildListDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  
  syntaxTree(view.state).iterate({
    enter: (node) => {
      const { from, to, name } = node;
      
      // Debug: log node names to understand the structure
      // console.log("Node:", name, view.state.doc.sliceString(from, to));
      
      // Handle list markers - check for BulletList, OrderedList child nodes
      if (name === "BulletList" || name === "OrderedList") {
        // Iterate children to find list markers
        const line = view.state.doc.lineAt(from);
        const lineText = line.text;
        const markerMatch = lineText.match(/^(\s*)([\-\*\+])\s/);
        
        if (markerMatch) {
          const leadingSpaces = markerMatch[1].length;
          const level = Math.floor(leadingSpaces / 2) + 1;
          const markerStart = line.from + markerMatch[1].length;
          const markerEnd = markerStart + 1;
          
          // Hide the original marker and add bullet widget
          builder.add(
            markerStart,
            markerEnd,
            Decoration.replace({
              widget: new BulletWidget(level),
            })
          );
        }
      }
      
      // Handle task list markers - check for Task node
      if (name === "Task") {
        const line = view.state.doc.lineAt(from);
        const lineText = line.text;
        const match = lineText.match(/^(\s*)[\-\*\+]\s+\[([ xX])\]/);
        
        if (match) {
          const isChecked = match[2] !== ' ';
          const checkboxStart = line.from + match[1].length + 2; // After "- "
          const checkboxEnd = checkboxStart + 3; // "[x]" length
          
          // Replace the entire [x] or [ ] with checkbox widget
          builder.add(
            checkboxStart,
            checkboxEnd,
            Decoration.replace({
              widget: new CheckboxWidget(isChecked, checkboxStart),
            })
          );
        }
      }
    }
  });
  
  return builder.finish();
}

/**
 * List plugin that renders bullets and checkboxes
 */
export const listPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    
    constructor(view: EditorView) {
      this.decorations = buildListDecorations(view);
    }
    
    update(update: any) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildListDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);
