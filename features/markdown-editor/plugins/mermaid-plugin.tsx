import { $view } from "@milkdown/utils";
import type { Node } from "@milkdown/prose/model";
import type { EditorView } from "@milkdown/prose/view";
import { useEffect, useRef, useState } from "react";
import { createRoot, Root } from "react-dom/client";

interface MermaidNodeViewProps {
  node: Node;
  view: EditorView;
  getPos: () => number | undefined;
}

function MermaidNodeView({ node, view, getPos }: MermaidNodeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string>("");
  const [isEditing, setIsEditing] = useState(false);
  const hasRenderedRef = useRef(false);
  const instanceIdRef = useRef(`mermaid-${Math.random().toString(36).substr(2, 9)}`);

  const code = node.textContent;

  useEffect(() => {
    if (hasRenderedRef.current || isEditing) return;

    const renderDiagram = async () => {
      if (!containerRef.current || !code) return;

      try {
        const mermaid = (await import("mermaid")).default;

        mermaid.initialize({
          startOnLoad: false,
          theme: "default",
          securityLevel: "loose",
          fontFamily: "inherit",
          suppressErrors: true,
        });

        const id = instanceIdRef.current;
        const { svg } = await mermaid.render(id, code);

        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
          hasRenderedRef.current = true;
          setError("");
        }
      } catch (err) {
        console.error("Mermaid rendering error:", err);
        setError(err instanceof Error ? err.message : "Failed to render diagram");
      }
    };

    renderDiagram();
  }, [code, isEditing]);

  const handleDoubleClick = () => {
    setIsEditing(true);
    const pos = getPos();
    if (pos !== undefined) {
      // Focus the editor at the position of this node
      view.focus();
      view.dispatch(view.state.tr.setSelection(
        view.state.selection.constructor.near(view.state.doc.resolve(pos + 1))
      ));
    }
  };

  if (error) {
    return (
      <div className="border border-destructive bg-destructive/10 rounded-lg p-4 my-4">
        <p className="text-sm text-destructive font-medium mb-2">
          Failed to render Mermaid diagram
        </p>
        <pre className="text-xs text-muted-foreground overflow-auto">
          {error}
        </pre>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="mermaid-diagram flex justify-center items-center my-6 p-4 bg-muted/30 rounded-lg border border-border overflow-auto cursor-pointer hover:border-primary/50 transition-colors"
      contentEditable={false}
      onDoubleClick={handleDoubleClick}
      title="Double-click to edit"
    />
  );
}

export const mermaidPlugin = $view("fence", () => (node, view, getPos) => {
  const language = node.attrs.language;

  // Only render if it's a mermaid code block
  if (language !== "mermaid") {
    return {};
  }

  const dom = document.createElement("div");
  dom.className = "mermaid-wrapper";
  dom.contentEditable = "false";
  
  let root: Root | null = null;

  // Render the React component
  root = createRoot(dom);
  root.render(<MermaidNodeView node={node} view={view} getPos={getPos} />);

  return {
    dom,
    destroy: () => {
      if (root) {
        root.unmount();
        root = null;
      }
    },
    // Prevent ProseMirror from handling mutations inside this node
    ignoreMutation: () => true,
    // Allow selection
    stopEvent: () => false,
  };
});
