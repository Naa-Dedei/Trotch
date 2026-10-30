import type { TransportNetwork } from '@/types/transport';
import { parseNetwork } from './schema';

export type NetworkOrigin = 'live' | 'cache' | 'bundled_demo';

export interface LoadedNetwork {
  network: TransportNetwork;
  origin: NetworkOrigin;
  /** When this copy was fetched from the server (null for bundled demo data). */
  fetchedAt: string | null;
  /** Set when a refresh failed and an older copy is being shown. */
  refreshError: string | null;
}

export interface NetworkDeps {
  /** Fetch a fresh snapshot from the backend, or null if no backend is configured. */
  fetchRemote: (() => Promise<unknown>) | null;
  readCache: () => Promise<{ savedAt: string; value: unknown } | null>;
  writeCache: (value: TransportNetwork) => Promise<void>;
  bundledDemo: (() => unknown) | null;
}

export class NetworkUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkUnavailableError';
  }
}

/**
 * Load order:
 *   1. Backend configured → fetch live; on success, cache it.
 *   2. Fetch failed → use the cached copy (clearly labelled as cached), if any.
 *   3. No backend configured → bundled DEMO network (if allowed).
 * A backend outage never silently swaps in fictional demo data.
 */
export async function loadNetwork(deps: NetworkDeps): Promise<LoadedNetwork> {
  if (deps.fetchRemote) {
    try {
      const network = parseNetwork(await deps.fetchRemote());
      await deps.writeCache(network);
      return { network, origin: 'live', fetchedAt: new Date().toISOString(), refreshError: null };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      const cached = await deps.readCache();
      if (cached) {
        try {
          return {
            network: parseNetwork(cached.value),
            origin: 'cache',
            fetchedAt: cached.savedAt,
            refreshError: reason,
          };
        } catch {
          // fall through: corrupt cache
        }
      }
      throw new NetworkUnavailableError(
        "Couldn't load transport data. Check your connection and try again — once loaded, Trotch keeps a copy for when you're offline.",
      );
    }
  }
  if (deps.bundledDemo) {
    return { network: parseNetwork(deps.bundledDemo()), origin: 'bundled_demo', fetchedAt: null, refreshError: null };
  }
  throw new NetworkUnavailableError('No transport data source is configured for this build.');
}
