# File Manager Architecture

## Overview

The File Manager provides a robust, extensible file operation system with git-like workflow for managing file content across different storage backends.

## Architecture

```
┌─────────────┐
│   Editor    │  (LiveMarkdownEditor)
└──────┬──────┘
       │ onContentChange
       ▼
┌─────────────┐
│EditorStore  │  (Zustand)
│             │
│ - openTabs  │
│ - activeTab │
│ - cache     │
└──────┬──────┘
       │ applyEditorPatch
       ▼
┌─────────────┐
│FileManager  │  (Core)
│             │
│ Pull        │ ← Fetch latest from FS
│ Apply Patch │ ← Update cache
│ Commit/Push │ ← Write to FS
│ Watch       │ ← Detect external changes
└──────┬──────┘
       │
       ▼
┌─────────────────────────────┐
│  FileSystemAdapter          │
├─────────────────────────────┤
│ LocalFileSystemAdapter      │
│ ServerFileSystemAdapter     │
│ S3Adapter (future)          │
│ FirebaseAdapter (future)    │
│ GitHubAdapter (future)      │
└─────────────────────────────┘
```

## Workflow

### 1. **File Loading**
```typescript
// File is loaded from directory and cached in store
await fileManager.loadFile(path);
// → Adapter reads file
// → FileManager caches content + metadata
// → Store receives file data
// → Editor displays content
```

### 2. **Editor Updates**
```typescript
// User types in editor
editor.onChange(content);
// → onContentChange callback fired
// → UnifiedEditor updates local state
// → Auto-save timer started (2s debounce)
```

### 3. **Saving (Git-like)**
```typescript
// When auto-save triggers
await applyEditorPatch(fileId, content);
// → FileManager.applyPatch() called
// → Cache updated immediately
// → Write operation queued (async)

// Before writing:
// 1. Pull: Check for external changes
const latestVersion = await adapter.getFileVersion(path);

// 2. Conflict detection
if (latestVersion !== cachedVersion) {
  // File was modified externally
  await pullLatest(); // Update editor
  return; // Abort this save
}

// 3. Commit/Push: Write to file system
await adapter.writeFile(path, content);

// 4. Update cache version
cache.version = newVersion;
cache.isDirty = false;
```

### 4. **External Change Detection**
```typescript
// FileManager watches files every 5 seconds
setInterval(() => {
  const latestVersion = await adapter.getFileVersion(path);
  
  if (latestVersion !== cachedVersion) {
    // Pull latest content
    const latest = await adapter.readFile(path);
    
    // Update cache
    cache.content = latest.content;
    cache.version = latest.version;
    
    // Notify store → editor
    emitUpdate(fileId, latest.content);
  }
}, 5000);
```

### 5. **Seamless Editor Updates**
```typescript
// In LiveMarkdownEditor
useEffect(() => {
  if (file.isExternalUpdate) {
    // Save scroll position
    const scrollPos = editor.scrollDOM.scrollTop;
    
    // Update content
    editor.dispatch({
      changes: { from: 0, to: length, insert: file.content }
    });
    
    // Restore scroll (seamless!)
    setTimeout(() => {
      editor.scrollDOM.scrollTop = scrollPos;
    }, 0);
  }
}, [file.content, file.isExternalUpdate]);
```

## File System Adapters

### Local File System
```typescript
const adapter = new LocalFileSystemAdapter();
adapter.registerFileHandle(path, fileHandle);
await adapter.writeFile(path, content);
```

### Server API
```typescript
const adapter = new ServerFileSystemAdapter("/api/files");
await adapter.writeFile(path, content);
// → PUT /api/files/{path} with content
```

### Future: S3
```typescript
const adapter = new S3FileSystemAdapter({
  bucket: "my-bucket",
  region: "us-east-1",
  credentials: {...}
});
```

### Future: Firebase
```typescript
const adapter = new FirebaseFileSystemAdapter({
  storagePath: "documents/",
  firebaseConfig: {...}
});
```

### Future: GitHub
```typescript
const adapter = new GitHubFileSystemAdapter({
  repo: "owner/repo",
  branch: "main",
  token: "ghp_..."
});
```

## Key Features

### ✅ **Non-blocking saves**
- Editor updates are async
- UI remains responsive during saves
- Background file operations

### ✅ **Conflict resolution**
- Detects external file modifications
- Pulls latest content automatically
- Updates editor seamlessly without scroll jump

### ✅ **Scroll preservation**
- Editor maintains scroll position during:
  - Auto-saves
  - Manual saves
  - External file updates
- Only scrolls to top when switching files

### ✅ **Git-like workflow**
- Pull before push (conflict detection)
- Version tracking with ETags/timestamps
- Atomic operations

### ✅ **Extensible**
- Clean adapter interface
- Easy to add new file systems
- Pluggable architecture

## Usage Example

```typescript
// In your app initialization
import { FileManager } from "@/core/file-manager";
import { ServerFileSystemAdapter } from "@/core/file-manager/adapters/server-adapter";

const adapter = new ServerFileSystemAdapter();
const fileManager = new FileManager(adapter);

// Setup event handlers
fileManager.onUpdate((fileId, content) => {
  // Update store when file is pulled from external source
  useEditorStore.getState().handleExternalUpdate(fileId, content);
});

// Load a file
const fileData = await fileManager.loadFile("content/notes.md");

// Apply editor changes (async)
await fileManager.applyPatch({
  fileId: "file-123",
  content: updatedContent,
  timestamp: Date.now(),
});

// File manager handles:
// - Checking for conflicts
// - Writing to file system
// - Updating cache
// - Notifying on external changes
```

## API Reference

### FileManager

#### `loadFile(path: string): Promise<FileData>`
Load a file from the file system and cache it.

#### `applyPatch(patch: FilePatch): Promise<void>`
Apply editor changes asynchronously with conflict detection.

#### `pullLatest(fileId: string, path: string): Promise<FileData>`
Fetch latest content from file system.

#### `getCachedFile(fileId: string): FileData | null`
Get cached file data.

#### `closeFile(fileId: string): void`
Close file and stop watching for changes.

#### `onUpdate(handler: (fileId, content) => void): void`
Register callback for external file updates.

#### `onConflict(handler: (conflict) => void): void`
Register callback for file conflicts.

### FileSystemAdapter

#### `readFile(path: string): Promise<FileData>`
Read file content from the file system.

#### `writeFile(path: string, content: string): Promise<void>`
Write file content to the file system.

#### `getFileVersion(path: string): Promise<string | undefined>`
Get file version/ETag for conflict detection.

#### `listFiles(directory: string): Promise<FileMetadata[]>`
List files in a directory.

#### `deleteFile(path: string): Promise<void>`
Delete a file.

## Benefits

1. **Editor Independence**: Editor maintains its own state, doesn't react to store updates during saves
2. **Background Operations**: File operations happen asynchronously without blocking UI
3. **Conflict Free**: Automatic detection and resolution of external changes
4. **Smooth UX**: No scroll jumping, seamless updates
5. **Extensible**: Easy to add support for S3, Firebase, GitHub, etc.
6. **Maintainable**: Clean separation of concerns, testable components

## Future Enhancements

- [ ] Implement S3FileSystemAdapter
- [ ] Implement FirebaseFileSystemAdapter
- [ ] Implement GitHubFileSystemAdapter
- [ ] Add conflict resolution UI (merge tool)
- [ ] Add file versioning/history
- [ ] Add offline mode with sync queue
- [ ] Add collaborative editing support
- [ ] Add file locking mechanism
