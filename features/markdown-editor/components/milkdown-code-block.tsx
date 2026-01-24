"use client";

import { useEffect, useRef } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/shared/utils/cn";

interface MilkdownCodeBlockProps {
  language: string;
  code: string;
  onCopy?: () => void;
}

export function MilkdownCodeBlock({ language, code, onCopy }: MilkdownCodeBlockProps) {
  const codeRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (codeRef.current && typeof window !== "undefined") {
      // Apply Prism highlighting if available
      if ((window as any).Prism) {
        (window as any).Prism.highlightElement(codeRef.current);
      }
    }
  }, [code, language]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    if (onCopy) onCopy();
  };

  return (
    <div className="milkdown-code-wrapper">
      <div className="milkdown-code-header">
        <span className="milkdown-code-language">{language || "text"}</span>
        <button
          onClick={handleCopy}
          className="milkdown-code-copy"
          aria-label="Copy code"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      </div>
      <pre className="milkdown-code-pre">
        <code
          ref={codeRef}
          className={cn("milkdown-code-content", language && `language-${language}`)}
        >
          {code}
        </code>
      </pre>
    </div>
  );
}
