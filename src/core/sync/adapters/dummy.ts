/**
 * Dummy Adapter
 * 
 * No-op adapter for browser-only workspaces.
 * Maintains symmetry - all workspace types have an adapter.
 */

import type { ISyncAdapter, AdapterInitContext, AdapterCapabilities } from '../types';

export class DummyAdapter implements ISyncAdapter {
  name = 'dummy';
  
  capabilities: AdapterCapabilities = {
    canPush: false,
    canPull: false,
    canList: false,
    canPullWorkspace: false,
  };

  private workspaceId: string = '';
  private isReadyFlag = false;
  private listeners: Map<string, Set<Function>> = new Map();

  async initialize(context: AdapterInitContext): Promise<void> {
    this.workspaceId = context.workspaceId;
    this.isReadyFlag = true;
    this.emit('ready', { workspaceId: context.workspaceId });
    console.log(`[DummyAdapter] Initialized for workspace: ${context.workspaceId}`);
  }

  async destroy(): Promise<void> {
    this.isReadyFlag = false;
    console.log(`[DummyAdapter] Destroyed for workspace: ${this.workspaceId}`);
  }

  isReady(): boolean {
    return this.isReadyFlag;
  }

  on(event: string, listener: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  off(event: string, listener: Function): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  private emit(event: string, data: any): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(listener => listener(data));
    }
  }
}
