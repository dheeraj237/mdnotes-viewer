"use client";

import { $view } from "@milkdown/utils";
import type { Node } from "@milkdown/prose/model";
import { createRoot, Root } from "react-dom/client";
import { Copy, Check } from "lucide-react";
import { useState } from "react";

interface CodeBlockViewProps {
  node: Node;
}

function CodeBlockView({ node }: CodeBlockViewProps) {
  const [copied, setCopied] = useState(false);
  const code = node.textContent;
  const language = node.attrs.language || "text";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="milkdown-code-copy-btn"
      aria-label="Copy code"
      title={copied ? "Copied!" : "Copy code"}
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5" />
          <span>Copied!</span>
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" />
          <span>Copy</span>
        </>
      )}
    </button>
  );
}

export const codeBlockPlugin = $view("fence", () => (node, view, getPos) => {
  const dom = document.createElement("div");
  dom.className = "milkdown-code-block-wrapper";
  
  // Create container for the actual code fence
  const codeContainer = document.createElement("div");
  codeContainer.className = "milkdown-code-fence";
  
  // Create language label
  const languageLabel = document.createElement("span");
  languageLabel.className = "milkdown-code-language-label";
  languageLabel.textContent = node.attrs.language || "text";
  
  // Create copy button container
  const buttonContainer = document.createElement("div");
  buttonContainer.className = "milkdown-code-copy-container";
  
  // Render React copy button
  const root = createRoot(buttonContainer);
  root.render(<CodeBlockView node={node} />);
  
  // Create the actual code element
  const pre = document.createElement("pre");
  const code = document.createElement("code");
  code.className = node.attrs.language ? `language-${node.attrs.language}` : "";
  code.textContent = node.textContent;
  pre.appendChild(code);
  
  // Assemble the structure
  codeContainer.appendChild(languageLabel);
  codeContainer.appendChild(buttonContainer);
  codeContainer.appendChild(pre);
  dom.appendChild(codeContainer);

  return {
    dom,
    destroy: () => {
      root.unmount();
    },
    // Prevent ProseMirror from handling mutations inside this node
    ignoreMutation: () => true,
    stopEvent: () => false,
  };
});
