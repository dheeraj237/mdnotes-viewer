/**
 * Directory Picker — simplified File System Access API wrapper
 *
 * Based on: https://github.com/GoogleChromeLabs/text-editor/tree/main/src/inline-scripts
 * 
 * This module provides direct access to showDirectoryPicker with minimal abstraction.
 * All checks and calls happen directly in browser/client context to avoid
 * evaluation issues with module loaders.
 */

/**
 * Check if File System Access API is supported.
 * This check happens directly in browser context.
 */
export function isFileSystemAccessSupported(): boolean {
  // Direct check in window context - no conditions
  if (typeof window === 'undefined') return false;
  if (typeof (window as any).showDirectoryPicker === 'undefined') return false;
  return 'showDirectoryPicker' in window;
}

/**
 * Open the native directory picker.
 * MUST be called from a user gesture (button click, etc.)
 * 
 * @returns Directory handle if successful, null if user cancelled
 * @throws Error if File System Access API is not supported
 */
export async function pickDirectory(): Promise<FileSystemDirectoryHandle | null> {
  if (!isFileSystemAccessSupported()) {
    throw new Error(
      'File System Access API is not supported in this browser. ' +
      'Please use Chrome 86+, Edge 86+, or Safari 15.2+'
    );
  }

  try {
    // Call showDirectoryPicker directly with readwrite mode
    const dirHandle = await (window as any).showDirectoryPicker({
      mode: 'readwrite',
    });
    return dirHandle;
  } catch (err: any) {
    // User cancelled the picker
    if (err?.name === 'AbortError') {
      return null;
    }
    throw err;
  }
}

/**
 * Check if we have permission to read/write a directory.
 * Safe to call without user gesture.
 * 
 * @param handle - Directory handle to check
 * @param needWrite - True to check write permission (default: true)
 * @returns True if permission is granted
 */
export async function hasPermission(
  handle: FileSystemDirectoryHandle,
  needWrite: boolean = true
): Promise<boolean> {
  if (!handle || !(handle as any).queryPermission) return false;

  const options = {
    mode: needWrite ? ('readwrite' as const) : ('read' as const),
  };

  try {
    const status = await (handle as any).queryPermission(options);
    return status === 'granted';
  } catch {
    return false;
  }
}

/**
 * Request permission to read/write a directory.
 * MUST be called from a user gesture.
 * 
 * @param handle - Directory handle to request permission for
 * @param needWrite - True to request write permission (default: true)
 * @returns True if permission was granted
 */
export async function requestPermission(
  handle: FileSystemDirectoryHandle,
  needWrite: boolean = true
): Promise<boolean> {
  if (!handle || !(handle as any).requestPermission) return false;

  const options = {
    mode: needWrite ? ('readwrite' as const) : ('read' as const),
  };

  try {
    const status = await (handle as any).requestPermission(options);
    return status === 'granted';
  } catch {
    return false;
  }
}

/**
 * Verify permission is granted, requesting if necessary.
 * MUST be called from a user gesture.
 * 
 * @param handle - Directory handle to verify
 * @param needWrite - True to verify write permission (default: true)
 * @returns True if permission is granted (either already had it or user granted it)
 */
export async function verifyPermission(
  handle: FileSystemDirectoryHandle,
  needWrite: boolean = true
): Promise<boolean> {
  // Check if we already have permission
  if (await hasPermission(handle, needWrite)) {
    return true;
  }

  // Request permission (requires user gesture)
  return await requestPermission(handle, needWrite);
}
