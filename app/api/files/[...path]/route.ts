import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: filePath } = await params;
    const fullPath = path.join(process.cwd(), "content", ...filePath);

    // Security: prevent directory traversal
    const contentDir = path.join(process.cwd(), "content");
    const resolvedPath = path.resolve(fullPath);
    if (!resolvedPath.startsWith(contentDir)) {
      return NextResponse.json(
        { error: "Invalid file path" },
        { status: 403 }
      );
    }

    // Check if file exists
    try {
      const stats = await fs.stat(resolvedPath);
      if (!stats.isFile()) {
        return NextResponse.json(
          { error: "Path is not a file" },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      );
    }

    // Read file content
    const content = await fs.readFile(resolvedPath, "utf-8");
    
    return NextResponse.json({
      success: true,
      data: {
        path: filePath.join("/"),
        content,
        name: path.basename(resolvedPath),
      },
    });
  } catch (error) {
    console.error("Error reading file:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: filePath } = await params;
    const body = await request.json();
    const { content } = body;

    if (typeof content !== "string") {
      return NextResponse.json(
        { error: "Content must be a string" },
        { status: 400 }
      );
    }

    const fullPath = path.join(process.cwd(), "content", ...filePath);

    // Security: prevent directory traversal
    const contentDir = path.join(process.cwd(), "content");
    const resolvedPath = path.resolve(fullPath);
    if (!resolvedPath.startsWith(contentDir)) {
      return NextResponse.json(
        { error: "Invalid file path" },
        { status: 403 }
      );
    }

    // Check if file exists
    try {
      const stats = await fs.stat(resolvedPath);
      if (!stats.isFile()) {
        return NextResponse.json(
          { error: "Path is not a file" },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      );
    }

    // Write file content
    await fs.writeFile(resolvedPath, content, "utf-8");

    return NextResponse.json({
      success: true,
      message: "File saved successfully",
      data: {
        path: filePath.join("/"),
        name: path.basename(resolvedPath),
      },
    });
  } catch (error) {
    console.error("Error saving file:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
