"use client";

import { useEffect, useRef, useState } from "react";
import { MarkdownFile } from "@/shared/types";

interface CodeEditorProps {
  file: MarkdownFile;
  onContentChange: (content: string) => void;
}

export function CodeEditor({ file, onContentChange }: CodeEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [content, setContent] = useState(file.content);
  const [lineNumbers, setLineNumbers] = useState<number[]>([]);

  useEffect(() => {
    setContent(file.content);
    updateLineNumbers(file.content);
  }, [file.id, file.content]);

  const updateLineNumbers = (text: string) => {
    const lines = text.split("\n").length;
    setLineNumbers(Array.from({ length: lines }, (_, i) => i + 1));
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    updateLineNumbers(newContent);
    onContentChange(newContent);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const newContent = content.substring(0, start) + "  " + content.substring(end);
      setContent(newContent);
      onContentChange(newContent);
      
      // Set cursor position after the inserted tab
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2;
        }
      }, 0);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const lineNumbersEl = document.querySelector(".line-numbers") as HTMLElement;
    if (lineNumbersEl) {
      lineNumbersEl.scrollTop = e.currentTarget.scrollTop;
    }
  };

  return (
    <div className="flex h-full bg-background">
      <div className="line-numbers bg-muted/30 text-muted-foreground text-right px-3 py-4 text-sm font-mono select-none overflow-hidden border-r border-border">
        {lineNumbers.map((num) => (
          <div key={num} className="leading-6">
            {num}
          </div>
        ))}
      </div>
      <textarea
        ref={textareaRef}
        value={content}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onScroll={handleScroll}
        className="flex-1 p-4 bg-background text-foreground font-mono text-sm leading-6 resize-none outline-none"
        spellCheck={false}
      />
    </div>
  );
}
