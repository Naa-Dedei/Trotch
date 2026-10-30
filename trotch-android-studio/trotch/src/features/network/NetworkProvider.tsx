import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import demoNetwork from '@/data/demo-network.json';
import { buildSearchIndex, type SearchablePlace } from '@/features/locations/search';
import { JourneyPlanner } from '@/features/routing/planner';
import { env } from '@/lib/env';
import { CACHE_KEYS, readCache, writeCache } from '@/lib/storage';
import { supabase } from '@/services/supabase/client';
import type { TransportNetwork } from '@/types/transport';
import { loadNetwork, type LoadedNetwork, type NetworkDeps } from './repository';
import { parseNetwork } from './schema';

interface NetworkState {
  status: 'loading' | 'ready' | 'error';
  loaded: LoadedNetwork | null;
  planner: JourneyPlanner | null;
  searchIndex: SearchablePlace[];
  error: string | null;
  refreshing: boolean;
  refresh: () => Promise<void>;
}

const NetworkContext = createContext<NetworkState | null>(null);

export function defaultNetworkDeps(): NetworkDeps {
  const city = env.cityId;
  return {
    fetchRemote: supabase
      ? async () => {
          // Load every city so intercity routes resolve; filter by city in the UI if needed.
          const { data, error } = await supabase!.rpc('get_network', { p_city_id: null });
          if (error) throw new Error(error.message);
          return data;
        }
      : null,
    readCache: () => readCache<unknown>(CACHE_KEYS.network(city)),
    writeCache: (value: TransportNetwork) => writeCache(CACHE_KEYS.network(city), value),
    bundledDemo: env.allowDemoFallback ? () => demoNetwork : null,
  };
}

export function NetworkProvider({ children, deps }: { children: ReactNode; deps?: NetworkDeps }) {
  const depsRef = useRef<NetworkDeps>(deps ?? defaultNetworkDeps());
  const [loaded, setLoaded] = useState<LoadedNetwork | null>(null);
  const [status, setStatus] = useState<NetworkState['status']>('loading');
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const result = await loadNetwork(depsRef.current);
      setLoaded(result);
      setStatus('ready');
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load transport data.');
      setStatus((prev) => (prev === 'ready' ? 'ready' : 'error'));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Show the cached copy immediately (fast start on slow networks), then refresh.
      if (depsRef.current.fetchRemote) {
        const cached = await depsRef.current.readCache();
        if (cached && !cancelled) {
          try {
            setLoaded({ network: parseNetwork(cached.value), origin: 'cache', fetchedAt: cached.savedAt, refreshError: null });
            setStatus('ready');
          } catch {
            // ignore corrupt cache
          }
        }
      }
      if (!cancelled) await refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const planner = useMemo(() => (loaded ? new JourneyPlanner(loaded.network) : null), [loaded]);
  const searchIndex = useMemo(
    () => (loaded ? buildSearchIndex(loaded.network.locations, loaded.network.stops) : []),
    [loaded],
  );

  const value = useMemo<NetworkState>(
    () => ({ status, loaded, planner, searchIndex, error, refreshing, refresh }),
    [status, loaded, planner, searchIndex, error, refreshing, refresh],
  );
  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

export function useNetwork(): NetworkState {
  const ctx = useContext(NetworkContext);
  if (!ctx) throw new Error('useNetwork must be used inside <NetworkProvider>');
  return ctx;
}
