import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { FileNode } from "@/shared/types";

// Security: Maximum file size (10MB for markdown files)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const POSSIBLE_CONTENT_DIRS = [
  path.join(process.cwd(), "public", "content"),
  path.join(process.cwd(), "content"),
];

async function getBaseContentDir(): Promise<string> {
  for (const d of POSSIBLE_CONTENT_DIRS) {
    try {
      await fs.access(d);
      return path.resolve(d);
    } catch {
      // continue
    }
  }
  throw new Error("Content directory not found");
}

async function buildFileTree(dirPath: string, relativePath: string = ""): Promise<FileNode[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const nodes: FileNode[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relPath = path.join(relativePath, entry.name);

    if (entry.isDirectory()) {
      const children = await buildFileTree(fullPath, relPath);
      nodes.push({
        id: relPath,
        name: entry.name,
        path: relPath,
        type: "folder",
        children,
      });
    } else if (entry.name.endsWith(".md") || entry.name.endsWith(".mdx")) {
      nodes.push({
        id: relPath,
        name: entry.name,
        path: relPath,
        type: "file",
      });
    }
  }

  return nodes.sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === "folder" ? -1 : 1;
  });
}

function validatePathParts(parts: string[]) {
  if (!parts) return false;
  return !parts.some((part) => part.includes("..") || part.includes("\0"));
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: filePath = [] } = await params;

    if (!validatePathParts(filePath)) {
      return NextResponse.json({ error: "Invalid file path" }, { status: 403 });
    }

    const baseDir = await getBaseContentDir();
    const resolvedPath = path.resolve(baseDir, ...filePath);

    if (!resolvedPath.startsWith(baseDir)) {
      return NextResponse.json({ error: "Invalid file path" }, { status: 403 });
    }

    const stats = await fs.stat(resolvedPath);
    if (!stats.isFile()) {
      return NextResponse.json({ error: "Path is not a file" }, { status: 400 });
    }

    if (stats.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large" }, { status: 413 });
    }

    const ext = path.extname(resolvedPath).toLowerCase();
    if (ext !== ".md" && ext !== ".mdx") {
      return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
    }

    const content = await fs.readFile(resolvedPath, "utf-8");

    return NextResponse.json({
      success: true,
      data: { path: filePath.join("/"), content, name: path.basename(resolvedPath) },
    });
  } catch (error) {
    console.error("Error reading file:", error);
    return NextResponse.json({ error: (error as Error).message || "Unknown error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: filePath = [] } = await params;
    if (!validatePathParts(filePath)) {
      return NextResponse.json({ error: "Invalid file path" }, { status: 403 });
    }

    const body = await request.json();
    const baseDir = await getBaseContentDir();
    const targetPath = path.resolve(baseDir, ...filePath);

    if (!targetPath.startsWith(baseDir)) {
      return NextResponse.json({ error: "Invalid file path" }, { status: 403 });
    }

    if (body?.type === "folder") {
      await fs.mkdir(targetPath, { recursive: true });
      return NextResponse.json({ success: true, message: "Folder created" });
    }

    // create file with optional content
    const content = typeof body?.content === "string" ? body.content : "";
    const size = Buffer.byteLength(content, "utf-8");
    if (size > MAX_FILE_SIZE) return NextResponse.json({ error: "Content too large" }, { status: 413 });

    // Ensure parent directory exists
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, content, "utf-8");

    return NextResponse.json({ success: true, message: "File created" });
  } catch (error) {
    console.error("Error creating file/folder:", error);
    return NextResponse.json({ error: (error as Error).message || "Unknown error" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: filePath = [] } = await params;
    if (!validatePathParts(filePath)) {
      return NextResponse.json({ error: "Invalid file path" }, { status: 403 });
    }

    const body = await request.json();
    const { content } = body;
    if (typeof content !== "string") return NextResponse.json({ error: "Content must be a string" }, { status: 400 });

    const size = Buffer.byteLength(content, "utf-8");
    if (size > MAX_FILE_SIZE) return NextResponse.json({ error: "Content too large" }, { status: 413 });

    const baseDir = await getBaseContentDir();
    const targetPath = path.resolve(baseDir, ...filePath);
    if (!targetPath.startsWith(baseDir)) return NextResponse.json({ error: "Invalid file path" }, { status: 403 });

    // Ensure file exists
    const stats = await fs.stat(targetPath);
    if (!stats.isFile()) return NextResponse.json({ error: "Path is not a file" }, { status: 400 });

    await fs.writeFile(targetPath, content, "utf-8");
    return NextResponse.json({ success: true, message: "File saved successfully" });
  } catch (error) {
    console.error("Error saving file:", error);
    return NextResponse.json({ error: (error as Error).message || "Unknown error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: filePath = [] } = await params;
    if (!validatePathParts(filePath)) {
      return NextResponse.json({ error: "Invalid file path" }, { status: 403 });
    }

    const body = await request.json();
    const { newName } = body;
    if (typeof newName !== "string") return NextResponse.json({ error: "newName required" }, { status: 400 });

    const baseDir = await getBaseContentDir();
    const sourcePath = path.resolve(baseDir, ...filePath);
    if (!sourcePath.startsWith(baseDir)) return NextResponse.json({ error: "Invalid file path" }, { status: 403 });

    const destPath = path.resolve(path.dirname(sourcePath), newName);
    if (!destPath.startsWith(baseDir)) return NextResponse.json({ error: "Invalid destination" }, { status: 403 });

    await fs.rename(sourcePath, destPath);
    return NextResponse.json({ success: true, message: "Renamed successfully" });
  } catch (error) {
    console.error("Error renaming:", error);
    return NextResponse.json({ error: (error as Error).message || "Unknown error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: filePath = [] } = await params;
    if (!validatePathParts(filePath)) {
      return NextResponse.json({ error: "Invalid file path" }, { status: 403 });
    }

    const baseDir = await getBaseContentDir();
    const targetPath = path.resolve(baseDir, ...filePath);
    if (!targetPath.startsWith(baseDir)) return NextResponse.json({ error: "Invalid file path" }, { status: 403 });

    // Use rm to support folders
    await fs.rm(targetPath, { recursive: true, force: true });
    return NextResponse.json({ success: true, message: "Deleted" });
  } catch (error) {
    console.error("Error deleting:", error);
    return NextResponse.json({ error: (error as Error).message || "Unknown error" }, { status: 500 });
  }
}
