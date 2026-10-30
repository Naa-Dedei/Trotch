import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { useNetwork } from '@/features/network/NetworkProvider';
import type { PlanResult } from '@/features/routing/types';
import { createSavedService, isPersistablePlace } from '@/features/saved/savedService';
import { CACHE_KEYS, readCache, removeCache, writeCache } from '@/lib/storage';
import { supabase } from '@/services/supabase/client';
import type { PlaceRef } from '@/types/transport';

export interface RecentTrip {
  origin: PlaceRef;
  destination: PlaceRef;
  at: string;
}

type Field = 'origin' | 'destination';

interface PlannerState {
  origin: PlaceRef | null;
  destination: PlaceRef | null;
  setPlace: (field: Field, place: PlaceRef | null) => void;
  swap: () => void;
  result: PlanResult | null;
  selectedIndex: number;
  select: (i: number) => void;
  plan: () => PlanResult | null;
  recents: RecentTrip[];
  clearRecents: () => Promise<void>;
}

const PlannerContext = createContext<PlannerState | null>(null);
const MAX_RECENTS = 10;

const sameTrip = (a: RecentTrip, b: RecentTrip) =>
  a.origin.label === b.origin.label && a.destination.label === b.destination.label;

export function PlannerProvider({ children }: { children: ReactNode }) {
  const { planner } = useNetwork();
  const { user } = useAuth();
  const [origin, setOrigin] = useState<PlaceRef | null>(null);
  const [destination, setDestination] = useState<PlaceRef | null>(null);
  const [planned, setPlanned] = useState<{ origin: PlaceRef; destination: PlaceRef } | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recents, setRecents] = useState<RecentTrip[]>([]);

  const saved = useMemo(() => createSavedService(supabase, user?.id ?? null), [user?.id]);

  // Recents: on-device for everyone; also synced to the account when signed in.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const local = (await readCache<RecentTrip[]>(CACHE_KEYS.recentSearchesLocal))?.value ?? [];
      if (!cancelled) setRecents(local);
      if (saved.isSignedIn) {
        try {
          const remote = await saved.listRecent();
          const merged = [...remote.map((r) => ({ origin: r.origin, destination: r.destination, at: r.createdAt })), ...local];
          const unique = merged.filter((t, i) => merged.findIndex((x) => sameTrip(x, t)) === i).slice(0, MAX_RECENTS);
          if (!cancelled) setRecents(unique);
        } catch {
          // offline: keep local copy
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [saved]);

  const rememberTrip = useCallback(
    async (o: PlaceRef, d: PlaceRef) => {
      // Never store the device's precise location in history.
      if (!isPersistablePlace(o) || !isPersistablePlace(d)) return;
      const trip: RecentTrip = { origin: o, destination: d, at: new Date().toISOString() };
      setRecents((prev) => {
        const next = [trip, ...prev.filter((t) => !sameTrip(t, trip))].slice(0, MAX_RECENTS);
        void writeCache(CACHE_KEYS.recentSearchesLocal, next);
        return next;
      });
      if (saved.isSignedIn) saved.addRecent(o, d).catch(() => undefined);
    },
    [saved],
  );

  const setPlace = useCallback((field: Field, place: PlaceRef | null) => {
    if (field === 'origin') setOrigin(place);
    else setDestination(place);
    setPlanned(null);
  }, []);

  const swap = useCallback(() => {
    setOrigin(destination);
    setDestination(origin);
    setPlanned(null);
  }, [origin, destination]);

  // Derived, so results are recomputed automatically when the network refreshes with newer data.
  const result = useMemo<PlanResult | null>(
    () => (planner && planned ? planner.plan(planned.origin, planned.destination) : null),
    [planner, planned],
  );

  const plan = useCallback((): PlanResult | null => {
    if (!planner || !origin || !destination) return null;
    setPlanned({ origin, destination });
    setSelectedIndex(0);
    void rememberTrip(origin, destination);
    return planner.plan(origin, destination);
  }, [planner, origin, destination, rememberTrip]);

  const clearRecents = useCallback(async () => {
    setRecents([]);
    await removeCache(CACHE_KEYS.recentSearchesLocal);
    if (saved.isSignedIn) await saved.clearRecent().catch(() => undefined);
  }, [saved]);

  const value = useMemo<PlannerState>(
    () => ({ origin, destination, setPlace, swap, result, selectedIndex, select: setSelectedIndex, plan, recents, clearRecents }),
    [origin, destination, setPlace, swap, result, selectedIndex, plan, recents, clearRecents],
  );
  return <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>;
}

export function usePlanner(): PlannerState {
  const ctx = useContext(PlannerContext);
  if (!ctx) throw new Error('usePlanner must be used inside <PlannerProvider>');
  return ctx;
}
