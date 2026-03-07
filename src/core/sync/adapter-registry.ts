/**
 * Adapter Registry
 * 
 * Simple factory registry to create adapters by workspace type
 */

import type { AdapterFactory, ISyncAdapter, AdapterInitContext } from './types';

export class AdapterRegistry {
  private static instance: AdapterRegistry;
  private factories: Map<string, AdapterFactory> = new Map();

  private constructor() {}

  static getInstance(): AdapterRegistry {
    if (!AdapterRegistry.instance) {
      AdapterRegistry.instance = new AdapterRegistry();
    }
    return AdapterRegistry.instance;
  }

  /**
   * Register an adapter factory for a workspace type
   */
  register(workspaceType: string, factory: AdapterFactory): void {
    this.factories.set(workspaceType, factory);
    console.log(`[AdapterRegistry] Registered adapter for workspace type: ${workspaceType}`);
  }

  /**
   * Create an adapter instance for a workspace type
   */
  async create(
    workspaceType: string,
    context?: Partial<AdapterInitContext>
  ): Promise<ISyncAdapter> {
    const factory = this.factories.get(workspaceType);
    if (!factory) {
      throw new Error(`No adapter registered for workspace type: ${workspaceType}`);
    }
    return factory({}, context);
  }

  /**
   * Check if adapter exists for workspace type
   */
  has(workspaceType: string): boolean {
    return this.factories.has(workspaceType);
  }
}
