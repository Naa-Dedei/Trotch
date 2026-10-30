import { modeStyle } from '@/constants/theme';
import type { Journey } from '@/features/routing/types';
import type { LatLng, TransportNetwork } from '@/types/transport';

export interface OverlaySpec {
  id: string;
  coordinates: LatLng[];
  color: string;
  dashed: boolean;
  muted: boolean;
}

/** Map overlays for a journey: dashed grey walks, solid mode-coloured rides. */
export function journeyOverlays(journey: Journey, muted = false): OverlaySpec[] {
  return journey.legs.map((leg, i) => ({
    id: `${journey.id}:${i}${muted ? ':m' : ''}`,
    coordinates: leg.geometry,
    color: leg.kind === 'walk' ? modeStyle.walk.color : modeStyle[leg.mode].color,
    dashed: leg.kind === 'walk',
    muted,
  }));
}

export function journeyPoints(journey: Journey): LatLng[] {
  return journey.legs.flatMap((l) => l.geometry);
}

/** Stops touched by a journey (boarding, alighting and intermediate). */
export function journeyStopIds(journey: Journey): string[] {
  const ids: string[] = [];
  for (const l of journey.legs) {
    if (l.kind === 'ride') ids.push(l.boardStopId, ...l.intermediateStopIds, l.alightStopId);
  }
  return [...new Set(ids)];
}

/** Overlay for a whole route: recorded path if present, else stop-to-stop. */
export function routeOverlay(network: TransportNetwork, routeId: string, muted = false): OverlaySpec | null {
  const route = network.routes.find((r) => r.id === routeId);
  if (!route) return null;
  const stopsById = new Map(network.stops.map((s) => [s.id, s]));
  const coordinates =
    route.path && route.path.length >= 2
      ? route.path.map(([lng, lat]) => ({ lat, lng }))
      : route.stops.flatMap((rs) => {
          const s = stopsById.get(rs.stopId);
          return s ? [{ lat: s.lat, lng: s.lng }] : [];
        });
  return { id: `route:${routeId}${muted ? ':m' : ''}`, coordinates, color: modeStyle[route.mode].color, dashed: false, muted };
}
