/**
 * Local File System Adapter
 * Handles file operations for local file system using File System Access API
 */

import { 
  FileSystemAdapter, 
  FileSystemType, 
  FileData, 
  FileMetadata 
} from "../types";

export class LocalFileSystemAdapter implements FileSystemAdapter {
  type = FileSystemType.LOCAL;
  private fileHandles: Map<string, FileSystemFileHandle> = new Map();

  async readFile(path: string): Promise<FileData> {
    const handle = this.fileHandles.get(path);
    if (!handle) {
      throw new Error(`No file handle found for path: ${path}`);
    }

    const file = await handle.getFile();
    const content = await file.text();
    
    return {
      id: `local-${file.name}-${file.lastModified}`,
      path: file.name,
      name: file.name,
      category: "local",
      content,
      size: file.size,
      lastModified: new Date(file.lastModified),
      version: file.lastModified.toString(),
      mimeType: file.type,
    };
  }

  async writeFile(path: string, content: string): Promise<void> {
    const handle = this.fileHandles.get(path);
    if (!handle) {
      throw new Error(`No file handle found for path: ${path}`);
    }

    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
  }

  async getFileVersion(path: string): Promise<string | undefined> {
    const handle = this.fileHandles.get(path);
    if (!handle) return undefined;

    const file = await handle.getFile();
    return file.lastModified.toString();
  }

  async listFiles(directory: string): Promise<FileMetadata[]> {
    // Not implemented for local file system
    // Would require directory access API
    throw new Error("listFiles not supported for local file system");
  }

  async deleteFile(path: string): Promise<void> {
    this.fileHandles.delete(path);
  }

  /**
   * Register a file handle for future operations
   */
  registerFileHandle(path: string, handle: FileSystemFileHandle): void {
    this.fileHandles.set(path, handle);
  }

  /**
   * Get file handle for a path
   */
  getFileHandle(path: string): FileSystemFileHandle | undefined {
    return this.fileHandles.get(path);
  }
}
