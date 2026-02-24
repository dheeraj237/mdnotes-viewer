/**
 * Server File System Adapter
 * Handles file operations for server-based file system via API
 */

import { 
  FileSystemAdapter, 
  FileSystemType, 
  FileData, 
  FileMetadata 
} from "../types";

export class ServerFileSystemAdapter implements FileSystemAdapter {
  type = FileSystemType.SERVER;
  private baseUrl: string;

  constructor(baseUrl: string = "/api/files") {
    this.baseUrl = baseUrl;
  }

  async readFile(path: string): Promise<FileData> {
    const response = await fetch(`${this.baseUrl}/${path}`);
    
    if (!response.ok) {
      throw new Error(`Failed to read file: ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      id: data.id || path,
      path: data.path || path,
      name: data.name || path.split("/").pop() || path,
      category: data.category || "server",
      content: data.content,
      version: response.headers.get("ETag") || undefined,
      size: data.size,
      lastModified: data.lastModified ? new Date(data.lastModified) : undefined,
      mimeType: data.mimeType,
    };
  }

  async writeFile(path: string, content: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${path}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to write file");
    }
  }

  async getFileVersion(path: string): Promise<string | undefined> {
    const response = await fetch(`${this.baseUrl}/${path}`, {
      method: "HEAD",
    });

    if (!response.ok) return undefined;

    return response.headers.get("ETag") || undefined;
  }

  async listFiles(directory: string): Promise<FileMetadata[]> {
    const response = await fetch(`${this.baseUrl}?directory=${encodeURIComponent(directory)}`);
    
    if (!response.ok) {
      throw new Error(`Failed to list files: ${response.statusText}`);
    }

    const data = await response.json();
    return data.files || [];
  }

  async deleteFile(path: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${path}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error(`Failed to delete file: ${response.statusText}`);
    }
  }
}
