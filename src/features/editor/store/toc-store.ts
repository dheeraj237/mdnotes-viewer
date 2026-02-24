/**
 * Table of Contents (TOC) Store - Manages the markdown document outline
 * Tracks headings and their active state for navigation
 */
import { create } from "zustand";

/**
 * Represents a single heading in the table of contents
 */
interface TocItem {
  /** Unique identifier for the heading (usually slug) */
  id: string;
  /** The heading text content */
  text: string;
  /** Heading level (1-6 for h1-h6) */
  level: number;
  /** Line number in the source document */
  line: number;
}

/**
 * TOC Store State Interface
 */
interface TocState {
  /** Array of all headings in the document */
  items: TocItem[];
  /** ID of the currently active heading */
  activeId: string;
  /** Whether the active heading was manually selected by the user */
  isManualSelection: boolean;

  /** Updates the list of headings */
  setItems: (items: TocItem[]) => void;
  /** Sets the active heading (auto-scroll based) */
  setActiveId: (id: string) => void;
  /** Sets the active heading (user clicked) */
  setManualActiveId: (id: string) => void;
  /** Clears the manual selection flag */
  clearManualSelection: () => void;
}

/**
 * TOC Store Implementation
 * No persistence - state is rebuilt when document changes
 */
export const useTocStore = create<TocState>((set) => ({
  items: [],
  activeId: "",
  isManualSelection: false,
  setItems: (items) => set({ items }),
  setActiveId: (id) => set({ activeId: id }),
  setManualActiveId: (id) => set({ activeId: id, isManualSelection: true }),
  clearManualSelection: () => set({ isManualSelection: false }),
}));
