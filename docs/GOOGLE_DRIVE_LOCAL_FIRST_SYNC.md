# Google Drive Local-First Sync

This document explains the local-first synchronization feature for Google Drive workspaces.

## Overview

The local-first sync feature enables seamless file and folder creation in Google Drive workspaces by:

1. **Instant Local Creation**: Files/folders are created locally first and appear immediately in the file tree
2. **Background Sync**: Changes are queued and synced to Google Drive in the background
3. **Offline Support**: Create files/folders even when offline; they'll sync when connection is restored
4. **Visual Feedback**: Sync status indicators show pending operations and sync progress

## Architecture

### Components

#### 1. Sync Queue Manager (`sync-queue.ts`)
- Manages a queue of pending sync operations
- Handles retries for failed operations (max 3 attempts)
- Persists queue to localStorage for reliability
- Notifies subscribers of queue changes

**Key Methods:**
- `addOperation()` - Add a new sync operation
- `getQueue()` - Get all operations
- `getPendingCount()` - Get count of pending operations
- `isSyncing()` - Check if sync is in progress
- `retryFailed()` - Retry failed operations
- `subscribe()` - Subscribe to queue changes

#### 2. Drive Cache Manager (`drive-cache.ts`)
- Caches file metadata and content locally using IndexedDB
- Stores folder structures per workspace
- Tracks sync status for each file (synced, pending, failed)
- Enables offline file access

**Key Methods:**
- `putFile()` - Store file in cache
- `getFile()` - Retrieve file from cache
- `getFilesInFolder()` - Get all files in a folder
- `updateSyncStatus()` - Update file sync status

#### 3. Google Drive Adapter Updates
Enhanced with local-first methods:
- `createFileLocal()` - Create file locally, queue for sync
- `createFolderLocal()` - Create folder locally, queue for sync
- `listFilesWithCache()` - List files with local cache support

#### 4. File Operations Updates
Updated `createGoogleDriveFile()` and `createGoogleDriveFolder()` to use the new local-first approach.

#### 5. UI Components

**Workspace Dropdown Enhancement**
Shows sync status with pending operation count:
```tsx
{currentWorkspace?.type === 'drive' && (isSyncingDrive || pendingSyncCount > 0) && (
  <span className="flex items-center gap-1">
    <Loader2 /> {/* Spinning icon */}
    {pendingSyncCount > 0 && <span>{pendingSyncCount}</span>}
  </span>
)}
```

**Drive Sync Status Component** (`drive-sync-status.tsx`)
Detailed sync status display showing:
- Current sync state (synced, syncing, errors)
- Pending operations count
- Failed operations with error details
- Retry button for failed operations

## Usage

### For Users

1. **Creating Files/Folders**
   - Create files/folders normally in Google Drive workspaces
   - They appear instantly in the file tree
   - A spinning icon with count shows pending sync operations
   - Files are automatically synced to Google Drive in background

2. **Viewing Sync Status**
   - Check the workspace dropdown for sync indicator
   - See pending operation count next to the spinning icon
   - All operations sync automatically

3. **Handling Sync Errors**
   - Failed operations are indicated with error icons
   - Click the sync status to see error details
   - Use "Retry Failed Operations" to try again

### For Developers

#### Adding the Sync Status Component

In your app toolbar or file explorer:

```tsx
import { DriveSyncStatus } from "@/shared/components/drive-sync-status";

export function MyComponent() {
  return (
    <div>
      {/* Other components */}
      <DriveSyncStatus />
    </div>
  );
}
```

#### Accessing Sync State

```tsx
import { useFileExplorerStore } from "@/features/file-explorer/store/file-explorer-store";
import { syncQueue } from "@/core/file-manager/sync-queue";

function MyComponent() {
  const { pendingSyncCount, isSyncingDrive } = useFileExplorerStore();
  
  // Or directly from sync queue
  const isCurrentlySyncing = syncQueue.isSyncing();
  const queue = syncQueue.getQueue();
  
  return (
    <div>
      {pendingSyncCount > 0 && <p>Syncing {pendingSyncCount} items...</p>}
    </div>
  );
}
```

#### Creating Custom Sync Operations

```tsx
import { syncQueue } from "@/core/file-manager/sync-queue";

// Add a custom sync operation
syncQueue.addOperation({
  type: 'create-file',
  parentPath: 'gdrive-folderId',
  name: 'new-file.md',
  content: 'Initial content',
});
```

## How It Works

### File Creation Flow

1. **User Action**: User creates a new file/folder
2. **Local Update**: 
   - Generate temporary local ID
   - Create cached file entry with `syncStatus: 'pending'`
   - Store in IndexedDB
3. **UI Update**: 
   - File appears immediately in file tree
   - Pending count increases
4. **Background Sync**:
   - Operation added to sync queue
   - Queue processor picks up operation
   - API call made to Google Drive
   - On success: Update cache with real Drive ID, mark as synced
   - On failure: Increment retry count, mark as failed if max retries reached
5. **UI Feedback**:
   - Pending count decreases when synced
   - Error indicator shown if sync fails

### Workspace Initialization

When creating a new Google Drive workspace:

1. Empty file tree is shown immediately
2. No initial sync required
3. Root folder structure is minimal
4. Files/folders created by user appear instantly
5. Background sync handles persistence to Drive

## Benefits

1. **Instant Feedback**: No waiting for API calls
2. **Better UX**: Seamless experience, no loading states
3. **Offline Support**: Work continues even without internet
4. **Reliability**: Automatic retries and error handling
5. **Transparency**: Clear sync status and error reporting

## Configuration

### Retry Settings

In `sync-queue.ts`:
```typescript
private maxRetries = 3; // Adjust retry count
```

### Storage Keys

- Sync queue: `verve_sync_queue`
- Drive cache: `verve_drive_cache` (IndexedDB)
- Folder IDs: `verve_gdrive_folder_id`

## Troubleshooting

### Operations Not Syncing

1. Check browser console for errors
2. Verify Google Drive authentication
3. Check network connectivity
4. Use "Retry Failed Operations" button

### Cache Issues

Clear cache using browser DevTools:
1. Application → IndexedDB → verve_drive_cache → Delete
2. LocalStorage → verve_sync_queue → Delete
3. Refresh page

### Debugging

Enable debug logging in sync-queue.ts by modifying executeOperation to log more details.

## Future Enhancements

Potential improvements:
- [ ] Conflict resolution for concurrent edits
- [ ] Batch sync operations for efficiency
- [ ] Sync progress percentage for large files
- [ ] Offline indicator in UI
- [ ] Manual sync trigger button
- [ ] Sync settings (auto-sync interval, etc.)
