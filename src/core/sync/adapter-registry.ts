/**
 * Adapter Registry
 * 
 * Type-safe registry for adapter constructors/factories.
 * Enables SyncManager to create appropriate adapter instances by workspace type.
 * 
 * Java-style: Private constructor, immutable registration.
 */

import type { ISyncAdapter, AdapterConfig } from './adapter-types';
import type { AdapterInitContext } from './types/adapter-lifecycle';

/**
 * Factory function to create an adapter instance.
 * 
 * Signature: Takes config and context, returns a promise of initialized adapter.
 * Adapter should be in UNINITIALIZED state; caller must call initialize().
 */
export type AdapterFactory = (
  config: AdapterConfig,
  context?: Partial<AdapterInitContext>
) => Promise<ISyncAdapter>;

/**
 * Immutable registry of adapter factories by workspace type.
 * 
 * Design:
 * - Private constructor (use getInstance)
 * - Registration is one-time (register at app init, never change)
 * - Thread-safe singleton (JavaScript is single-threaded, but principle applies)
 * - Factories are readonly after registration
 */
export class AdapterRegistry {
  private static instance: AdapterRegistry | null = null;
  private readonly factories: Map<string, AdapterFactory> = new Map();

  /**
   * Private constructor enforces singleton pattern.
   */
  private constructor() {}

  /**
   * Get or create the global AdapterRegistry singleton.
   */
  static getInstance(): AdapterRegistry {
    if (!AdapterRegistry.instance) {
      AdapterRegistry.instance = new AdapterRegistry();
    }
    return AdapterRegistry.instance;
  }

  /**
   * Register an adapter factory by workspace type (name).
   * 
   * Can only be called during app initialization.
   * Multiple registrations for the same type will overwrite previous (warning logged).
   * 
   * @param workspaceType Name of the workspace type: 'local', 'gdrive', 's3', 'browser'
   * @param factory The adapter factory function
   * @throws If factory is falsey
   */
  register(workspaceType: string, factory: AdapterFactory): void {
    if (!factory) {
      throw new Error(`Cannot register null/undefined factory for workspace type "${workspaceType}"`);
    }
    if (this.factories.has(workspaceType)) {
      console.warn(
        `[AdapterRegistry] Re-registering adapter factory for workspace type "${workspaceType}". ` +
        `This should only happen during app initialization.`
      );
    }
    this.factories.set(workspaceType, factory);
    console.log(`[AdapterRegistry] Registered adapter factory for workspace type: ${workspaceType}`);
  }

  /**
   * Create a new adapter instance for the given workspace type.
   * 
   * @param workspaceType Name of the workspace type
   * @param config Immutable configuration for the adapter
   * @param context Optional initialization context (directory handle, credentials, etc.)
   * @returns Promise<ISyncAdapter> - adapter in UNINITIALIZED state
   * @throws If no factory registered for the workspace type
   */
  async createAdapter(
    workspaceType: string,
    config: AdapterConfig,
    context?: Partial<AdapterInitContext>
  ): Promise<ISyncAdapter> {
    const factory = this.factories.get(workspaceType);
    if (!factory) {
      throw new Error(
        `No adapter factory registered for workspace type "${workspaceType}". ` +
        `Available types: ${Array.from(this.factories.keys()).join(', ')}`
      );
    }

    try {
      const adapter = await factory(config, context);
      console.log(`[AdapterRegistry] Created adapter instance for workspace type: ${workspaceType}`);
      return adapter;
    } catch (error) {
      console.error(
        `[AdapterRegistry] Failed to create adapter for workspace type "${workspaceType}":`,
        error
      );
      throw error;
    }
  }

  /**
   * Check if a factory is registered for the given workspace type.
   */
  has(workspaceType: string): boolean {
    return this.factories.has(workspaceType);
  }

  /**
   * Get all registered workspace types (for debugging/logging).
   */
  getRegisteredTypes(): readonly string[] {
    return Array.from(this.factories.keys());
  }
}
