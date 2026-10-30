import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { CACHE_KEYS, readCache, writeCache } from '@/lib/storage';
import { friendlyError, supabase } from '@/services/supabase/client';
import { createSavedService, type SavedJourney, type SavedPlace, type SavedRoute, type SavedService } from './savedService';

interface SavedState {
  service: SavedService;
  places: SavedPlace[];
  routes: SavedRoute[];
  journeys: SavedJourney[];
  loading: boolean;
  error: string | null;
  /** True when journeys are shown from the on-device copy because the server couldn't be reached. */
  fromCache: boolean;
  refresh: () => Promise<void>;
}

interface Snapshot {
  userId: string;
  places: SavedPlace[];
  routes: SavedRoute[];
  journeys: SavedJourney[];
  error: string | null;
  fromCache: boolean;
}

const SavedContext = createContext<SavedState | null>(null);

async function fetchSnapshot(service: SavedService, userId: string): Promise<Snapshot> {
  try {
    const [places, routes, journeys] = await Promise.all([service.listPlaces(), service.listRoutes(), service.listJourneys()]);
    // Keep an on-device copy of saved journeys so they open without a connection.
    await writeCache(CACHE_KEYS.savedJourneysCopy(userId), journeys);
    return { userId, places, routes, journeys, error: null, fromCache: false };
  } catch (e) {
    const cached = await readCache<SavedJourney[]>(CACHE_KEYS.savedJourneysCopy(userId));
    return {
      userId,
      places: [],
      routes: [],
      journeys: cached?.value ?? [],
      error: friendlyError(e, "Couldn't load your saved items."),
      fromCache: !!cached,
    };
  }
}

export function SavedProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const service = useMemo(() => createSavedService(supabase, userId), [userId]);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!service.isSignedIn || !userId) return;
    let cancelled = false;
    fetchSnapshot(service, userId).then((s) => {
      if (!cancelled) setSnapshot(s);
    });
    return () => {
      cancelled = true;
    };
  }, [service, userId]);

  const refresh = useCallback(async () => {
    if (!service.isSignedIn || !userId) return;
    setRefreshing(true);
    try {
      setSnapshot(await fetchSnapshot(service, userId));
    } finally {
      setRefreshing(false);
    }
  }, [service, userId]);

  // Data belonging to a previous user is never shown.
  const current = snapshot && snapshot.userId === userId ? snapshot : null;
  const loading = refreshing || (!!userId && !current);

  const value = useMemo<SavedState>(
    () => ({
      service,
      places: current?.places ?? [],
      routes: current?.routes ?? [],
      journeys: current?.journeys ?? [],
      loading,
      error: current?.error ?? null,
      fromCache: current?.fromCache ?? false,
      refresh,
    }),
    [service, current, loading, refresh],
  );
  return <SavedContext.Provider value={value}>{children}</SavedContext.Provider>;
}

export function useSaved(): SavedState {
  const ctx = useContext(SavedContext);
  if (!ctx) throw new Error('useSaved must be used inside <SavedProvider>');
  return ctx;
}
