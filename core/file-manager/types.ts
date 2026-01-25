/**
 * File Manager Types
 * Defines interfaces for extensible file system operations
 */

export interface FileMetadata {
  id: string;
  path: string;
  name: string;
  category: string;
  size?: number;
  lastModified?: Date;
  mimeType?: string;
}

export interface FileContent {
  content: string;
  version?: string; // For conflict detection
  checksum?: string; // For integrity verification
}

export interface FileData extends FileMetadata, FileContent {}

export interface FilePatch {
  fileId: string;
  content: string;
  timestamp: number;
  version?: string;
}

export interface FileConflict {
  fileId: string;
  localContent: string;
  remoteContent: string;
  baseVersion?: string;
}

export enum FileSystemType {
  LOCAL = "local",
  SERVER = "server",
  S3 = "s3",
  FIREBASE = "firebase",
  GITHUB = "github",
}

export interface FileSystemAdapter {
  type: FileSystemType;
  
  /**
   * Read file content from the file system
   */
  readFile(path: string): Promise<FileData>;
  
  /**
   * Write file content to the file system
   */
  writeFile(path: string, content: string): Promise<void>;
  
  /**
   * Check if file has been modified externally
   */
  getFileVersion(path: string): Promise<string | undefined>;
  
  /**
   * List files in a directory
   */
  listFiles(directory: string): Promise<FileMetadata[]>;
  
  /**
   * Delete a file
   */
  deleteFile(path: string): Promise<void>;
}

export interface FileOperation {
  type: "read" | "write" | "delete" | "pull" | "push";
  fileId: string;
  path: string;
  content?: string;
  timestamp: number;
  status: "pending" | "in-progress" | "completed" | "failed";
  error?: string;
}

export interface FileCache {
  [fileId: string]: {
    metadata: FileMetadata;
    content: string;
    version?: string;
    lastSync: number;
    isDirty: boolean;
  };
}
