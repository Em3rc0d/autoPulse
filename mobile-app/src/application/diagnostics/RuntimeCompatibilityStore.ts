import type { CompatibilitySnapshot } from '../../domain/diagnostics';

class RuntimeCompatibilityStore {
  private readonly bySession = new Map<string, CompatibilitySnapshot>();

  set(sessionId: string, snapshot: CompatibilitySnapshot): void {
    this.bySession.set(sessionId, snapshot);
  }

  get(sessionId: string): CompatibilitySnapshot | undefined {
    return this.bySession.get(sessionId);
  }

  remove(sessionId: string): void {
    this.bySession.delete(sessionId);
  }

  clear(): void {
    this.bySession.clear();
  }
}

/**
 * Session-scoped bridge from startup characterization into Live/Health UI.
 * This is intentionally not the durable compatibility evidence repository;
 * persistence is a separate boundary so Live acquisition is never blocked by it.
 */
export const runtimeCompatibilityStore = new RuntimeCompatibilityStore();
