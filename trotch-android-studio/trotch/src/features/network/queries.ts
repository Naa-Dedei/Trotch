import { haversineMeters } from '@/lib/geo';
import type { LatLng, Stop, TransportMode, TransportNetwork, TransportRoute } from '@/types/transport';

export interface StopService {
  route: TransportRoute;
  /** Where this route goes after the stop (its headsign), and the next few stops. */
  nextStops: Stop[];
  /** True if the stop is the last stop of this route (alighting only). */
  terminatesHere: boolean;
}

/** Routes that call at a stop, in their recorded direction. */
export function servicesAtStop(network: TransportNetwork, stopId: string): StopService[] {
  const stopsById = new Map(network.stops.map((s) => [s.id, s]));
  const out: StopService[] = [];
  for (const route of network.routes) {
    if (!route.isActive) continue;
    const idx = route.stops.findIndex((rs) => rs.stopId === stopId);
    if (idx < 0) continue;
    const nextStops = route.stops
      .slice(idx + 1, idx + 4)
      .map((rs) => stopsById.get(rs.stopId))
      .filter((s): s is Stop => !!s);
    out.push({ route, nextStops, terminatesHere: idx === route.stops.length - 1 });
  }
  return out.sort((a, b) => Number(a.terminatesHere) - Number(b.terminatesHere) || a.route.name.localeCompare(b.route.name));
}

export function modesAtStop(network: TransportNetwork, stopId: string): Set<TransportMode> {
  return new Set(servicesAtStop(network, stopId).map((s) => s.route.mode));
}

export function stopsNear(network: TransportNetwork, point: LatLng, radiusM: number, limit = 20): { stop: Stop; distanceM: number }[] {
  return network.stops
    .filter((s) => s.isActive)
    .map((stop) => ({ stop, distanceM: haversineMeters(point, stop) }))
    .filter((x) => x.distanceM <= radiusM)
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, limit);
}
