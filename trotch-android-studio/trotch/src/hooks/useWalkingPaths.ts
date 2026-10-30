import { useEffect, useState } from 'react';
import type { Journey } from '@/features/routing/types';
import { isWalkingProviderEnabled, walkingDirections } from '@/services/geo/walking';
import type { LatLng } from '@/types/transport';

/**
 * Street-level geometry for a journey's walking legs, when a walking-directions provider
 * is configured. Returns a map of leg index → path; legs without a result keep their
 * straight-line geometry. Never blocks rendering and fails silently (e.g. offline).
 */
export function useWalkingPaths(journey: Journey | null): { paths: Map<number, LatLng[]>; journeyId: string | null } {
  const [state, setState] = useState<{ journeyId: string | null; paths: Map<number, LatLng[]> }>({ journeyId: null, paths: new Map() });

  useEffect(() => {
    if (!journey || !isWalkingProviderEnabled()) return;
    const ctrl = new AbortController();
    const walkLegs = journey.legs.flatMap((l, i) => (l.kind === 'walk' ? [{ i, from: l.from, to: l.to }] : []));
    Promise.all(walkLegs.map(async ({ i, from, to }) => [i, await walkingDirections(from, to, ctrl.signal)] as const)).then((results) => {
      if (ctrl.signal.aborted) return;
      const paths = new Map<number, LatLng[]>();
      for (const [i, r] of results) if (r && r.geometry.length >= 2) paths.set(i, r.geometry);
      setState({ journeyId: journey.id, paths });
    });
    return () => ctrl.abort();
  }, [journey]);

  return journey && state.journeyId === journey.id ? state : { journeyId: null, paths: new Map() };
}
