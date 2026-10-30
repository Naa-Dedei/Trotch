import { haversineMeters } from '@/lib/geo';
import type { Stop, TransportRoute } from '@/types/transport';
import type { Duration, Leg, PlannerOptions } from './types';

export function walkingMinutes(straightLineM: number, opts: PlannerOptions): { distanceM: number; minutes: number } {
  const distanceM = straightLineM * opts.walkDetourFactor;
  const minutes = distanceM / ((opts.walkSpeedKmh * 1000) / 60);
  return { distanceM, minutes };
}

/**
 * In-vehicle time between two positions on a route.
 * Uses recorded hop times where available; any missing hop is estimated from distance
 * and the whole ride is then flagged as estimated.
 */
export function rideDuration(
  route: TransportRoute,
  fromIdx: number,
  toIdx: number,
  stopsById: Map<string, Stop>,
  opts: PlannerOptions,
): { duration: Duration; distanceM: number } {
  if (fromIdx < 0 || toIdx >= route.stops.length || fromIdx >= toIdx) {
    throw new RangeError(`Invalid ride segment ${fromIdx}→${toIdx} on route ${route.id}`);
  }
  let minutes = 0;
  let distanceM = 0;
  let estimated = false;
  const speedMpm = (opts.fallbackSpeedKmh[route.mode] * 1000) / 60;
  for (let i = fromIdx + 1; i <= toIdx; i++) {
    const prev = stopsById.get(route.stops[i - 1]!.stopId);
    const cur = stopsById.get(route.stops[i]!.stopId);
    if (!prev || !cur) throw new Error(`Route ${route.id} references a missing stop`);
    const hopM = haversineMeters(prev, cur) * opts.roadDetourFactor;
    distanceM += hopM;
    const recorded = route.stops[i]!.minutesFromPrevious;
    if (recorded !== null && recorded >= 0) {
      minutes += recorded;
    } else {
      estimated = true;
      minutes += hopM / speedMpm;
    }
  }
  return { duration: { minutes, quality: estimated ? 'estimated' : 'recorded' }, distanceM };
}

/** Total journey time. Waiting is only counted where the route records a typical wait. */
export function journeyDuration(legs: Leg[]): Duration {
  let minutes = 0;
  let estimated = false;
  for (const leg of legs) {
    if (leg.kind === 'walk') {
      minutes += leg.duration.minutes;
      // Walking times are always estimates from distance.
      estimated = true;
    } else {
      minutes += leg.inVehicle.minutes;
      if (leg.inVehicle.quality === 'estimated') estimated = true;
      if (leg.waitMin !== null) minutes += leg.waitMin;
      else estimated = true;
    }
  }
  return { minutes, quality: estimated ? 'estimated' : 'recorded' };
}
