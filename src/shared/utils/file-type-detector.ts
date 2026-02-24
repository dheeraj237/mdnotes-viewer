/**
 * Detect file type based on extension
 */

export type FileType = "markdown" | "code" | "text";

export const MARKDOWN_EXTENSIONS = [".md", ".markdown", ".mdown", ".mkdn"];
export const CODE_EXTENSIONS = [
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".py",
  ".java",
  ".cpp",
  ".c",
  ".cs",
  ".php",
  ".rb",
  ".go",
  ".rs",
  ".swift",
  ".kt",
  ".scala",
  ".sql",
  ".html",
  ".css",
  ".scss",
  ".less",
  ".json",
  ".xml",
  ".yaml",
  ".yml",
  ".toml",
  ".ini",
  ".conf",
  ".sh",
  ".bash",
  ".zsh",
];
export const TEXT_EXTENSIONS = [".txt", ".text", ".log"];

export function detectFileType(filename: string): FileType {
  const ext = filename
    .substring(filename.lastIndexOf("."))
    .toLowerCase();

  if (MARKDOWN_EXTENSIONS.includes(ext)) {
    return "markdown";
  }

  if (CODE_EXTENSIONS.includes(ext)) {
    return "code";
  }

  if (TEXT_EXTENSIONS.includes(ext)) {
    return "text";
  }

  // Default to code for unknown extensions if it looks like a code file
  if (ext.startsWith(".")) {
    return "code";
  }

  return "text";
}

export function isMarkdownFile(filename: string): boolean {
  return detectFileType(filename) === "markdown";
}

export function isCodeFile(filename: string): boolean {
  const type = detectFileType(filename);
  return type === "code" || type === "text";
}

/**
 * Get the appropriate CodeMirror language extension for a file
 */
export function getLanguageExtension(filename: string) {
  const ext = filename
    .substring(filename.lastIndexOf("."))
    .toLowerCase();

  // This would need proper imports from @codemirror/lang-*
  // For now returning extension name string
  const extensionMap: Record<string, string> = {
    ".js": "javascript",
    ".jsx": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".py": "python",
    ".java": "java",
    ".cpp": "cpp",
    ".c": "cpp",
    ".cs": "csharp",
    ".php": "php",
    ".rb": "ruby",
    ".go": "go",
    ".rs": "rust",
    ".swift": "swift",
    ".kt": "kotlin",
    ".scala": "scala",
    ".sql": "sql",
    ".html": "html",
    ".css": "css",
    ".scss": "sass",
    ".less": "less",
    ".json": "json",
    ".xml": "xml",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".toml": "toml",
    ".sh": "bash",
    ".bash": "bash",
    ".zsh": "bash",
  };

  return extensionMap[ext] || "plain";
}
