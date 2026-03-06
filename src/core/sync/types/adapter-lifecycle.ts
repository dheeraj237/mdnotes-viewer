/**
 * Adapter Lifecycle Type Definitions
 * Provides strict, immutable state machine types for adapter initialization
 * and configuration in a Java-style OOP approach.
 *
 * Key concept: Adapters transition through defined states, not checked ad-hoc.
 * State is immutable at each transition, preventing invalid state combinations.
 */

/** Adapter lifecycle states - strict state machine */
export enum AdapterState {
  UNINITIALIZED = 'UNINITIALIZED',
  INITIALIZING = 'INITIALIZING',
  READY = 'READY',
  ERRORED = 'ERRORED',
  DESTROYING = 'DESTROYING',
  DESTROYED = 'DESTROYED',
}

/** Error codes for adapter initialization failures */
export enum AdapterErrorCode {
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  DIRECTORY_NOT_FOUND = 'DIRECTORY_NOT_FOUND',
  HANDLE_INVALID = 'HANDLE_INVALID',
  WORKSPACE_NOT_FOUND = 'WORKSPACE_NOT_FOUND',
  INITIALIZATION_FAILED = 'INITIALIZATION_FAILED',
  STORAGE_EXCEEDED = 'STORAGE_EXCEEDED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  CREDENTIALS_INVALID = 'CREDENTIALS_INVALID',
  CREDENTIALS_EXPIRED = 'CREDENTIALS_EXPIRED',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Immutable error descriptor for adapter initialization failures.
 * Java-style: constructor-based immutability, readonly fields.
 */
export class AdapterInitError {
  readonly code: AdapterErrorCode;
  readonly message: string;
  readonly causedBy: Error | null;
  readonly timestamp: Date;

  constructor(
    code: AdapterErrorCode,
    message: string,
    causedBy: Error | null = null,
    timestamp: Date = new Date()
  ) {
    this.code = code;
    this.message = message;
    this.causedBy = causedBy;
    this.timestamp = timestamp;
  }

  toString(): string {
    return `[${this.code}] ${this.message}${this.causedBy ? ` (caused by: ${this.causedBy.message})` : ''}`;
  }
}

/**
 * Immutable context provided during adapter initialization.
 * Enumerates all prerequisites the adapter needs in a type-safe way.
 *
 * Follows builder pattern but immutable (no setters after construction).
 */
export interface AdapterInitContext {
  /** Workspace ID being initialized for - IMMUTABLE, never changes after init */
  readonly workspaceId: string;

  /** For local adapters: FileSystemDirectoryHandle (if available) */
  readonly dirHandle?: FileSystemDirectoryHandle;

  /** For cloud adapters: auth token or credentials object */
  readonly credentials?: { [key: string]: unknown };

  /** User explicitly requested initialization (vs. auto-recovery) */
  readonly isUserGesture?: boolean;

  /** Timestamp when context was created */
  readonly createdAt: Date;
}

/**
 * Immutable configuration for an adapter.
 * Set once at registration time, never changed.
 */
export interface AdapterConfig {
  /** Unique adapter name: 'local', 'gdrive', 's3', etc. */
  readonly name: string;

  /** Supported workspace type: 'local', 'gdrive', 'browser', etc. */
  readonly workspaceType: 'local' | 'gdrive' | 's3' | 'browser';

  /** Capabilities this adapter supports */
  readonly capabilities: {
    readonly canPush: boolean;
    readonly canPull: boolean;
    readonly canWatch: boolean;
    readonly canDelete: boolean;
    readonly requiresAuth: boolean;
  };

  /** Optional metadata or feature flags */
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Adapter lifecycle event types.
 * Emitted by adapters to notify SyncManager of state changes.
 */
export type AdapterLifecycleEvent =
  | {
      type: 'state-changed';
      state: AdapterState;
      previousState: AdapterState;
      timestamp: Date;
    }
  | {
      type: 'initialization-failed';
      error: AdapterInitError;
      timestamp: Date;
    }
  | {
      type: 'ready';
      workspaceId: string;
      timestamp: Date;
    };

/**
 * Listener callback type for adapter events.
 */
export type AdapterEventListener = (event: AdapterLifecycleEvent) => void;

/**
 * Immutable snapshot of adapter readiness.
 * Returned by adapter.getReadinessInfo() to provide complete state visibility.
 */
export class AdapterReadinessInfo {
  readonly isReady: boolean;
  readonly state: AdapterState;
  readonly error: AdapterInitError | null;
  readonly workspaceId: string | null;
  readonly hasValidHandle: boolean;
  readonly timestamp: Date;

  constructor(
    isReady: boolean,
    state: AdapterState,
    error: AdapterInitError | null,
    workspaceId: string | null,
    hasValidHandle: boolean,
    timestamp: Date = new Date()
  ) {
    this.isReady = isReady;
    this.state = state;
    this.error = error;
    this.workspaceId = workspaceId;
    this.hasValidHandle = hasValidHandle;
    this.timestamp = timestamp;
  }
}
