import { haversineMeters } from '@/lib/geo';
import type { FareRecord, LatLng, Stop, TransportNetwork, TransportRoute } from '@/types/transport';
import { rideDuration, walkingMinutes } from './durations';
import type { Duration, NetworkIndex, PlannerOptions } from './types';

export const ORIGIN_NODE = '__origin__';
export const DESTINATION_NODE = '__destination__';

export interface RideEdge {
  kind: 'ride';
  from: string;
  to: string;
  routeId: string;
  fromIdx: number;
  toIdx: number;
  inVehicle: Duration;
  distanceM: number;
  /** Recorded typical wait, or null if unknown. */
  recordedWaitMin: number | null;
  /** Wait used for ranking only (recorded, else the mode's assumed wait). */
  rankingWaitMin: number;
}

export interface WalkEdge {
  kind: 'walk';
  from: string;
  to: string;
  distanceM: number;
  minutes: number;
}

export type Edge = RideEdge | WalkEdge;

export interface TransitGraph {
  index: NetworkIndex;
  /** Adjacency list keyed by node id (stop ids plus the virtual origin/destination). */
  adjacency: Map<string, Edge[]>;
  /** Coordinates of every node, for geometry and heuristics. */
  positions: Map<string, LatLng>;
}

export function indexNetwork(network: TransportNetwork): NetworkIndex {
  const stopsById = new Map<string, Stop>();
  for (const s of network.stops) stopsById.set(s.id, s);
  const routesById = new Map<string, TransportRoute>();
  for (const r of network.routes) routesById.set(r.id, r);
  const faresByRoute = new Map<string, FareRecord[]>();
  for (const f of network.fares) {
    const list = faresByRoute.get(f.routeId) ?? [];
    list.push(f);
    faresByRoute.set(f.routeId, list);
  }
  return { stopsById, routesById, faresByRoute };
}

function isUsableRoute(route: TransportRoute, stopsById: Map<string, Stop>): boolean {
  if (!route.isActive || route.quality.verification === 'inactive') return false;
  if (route.stops.length < 2) return false;
  return route.stops.every((rs) => {
    const s = stopsById.get(rs.stopId);
    return !!s && s.isActive && s.quality.verification !== 'inactive';
  });
}

function addEdge(adj: Map<string, Edge[]>, edge: Edge) {
  const list = adj.get(edge.from);
  if (list) list.push(edge);
  else adj.set(edge.from, [edge]);
}

/**
 * Build the stop graph.
 *
 * Ride edges come ONLY from recorded routes, and only in the route's recorded direction:
 * for a route A→B→C we add A→B, A→C and B→C, never the reverse.
 * Walk edges connect distinct stops that are within walking distance (for transfers).
 * Geographic proximity never creates a ride edge.
 */
export function buildGraph(network: TransportNetwork, opts: PlannerOptions): TransitGraph {
  const index = indexNetwork(network);
  const adjacency = new Map<string, Edge[]>();
  const positions = new Map<string, LatLng>();
  const excluded = new Set(opts.excludedRouteIds);

  const activeStops = network.stops.filter((s) => s.isActive && s.quality.verification !== 'inactive');
  for (const s of activeStops) positions.set(s.id, { lat: s.lat, lng: s.lng });

  for (const route of network.routes) {
    if (excluded.has(route.id) || !isUsableRoute(route, index.stopsById)) continue;
    const n = route.stops.length;
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        const from = route.stops[i]!.stopId;
        const to = route.stops[j]!.stopId;
        if (from === to) continue;
        const { duration, distanceM } = rideDuration(route, i, j, index.stopsById, opts);
        addEdge(adjacency, {
          kind: 'ride',
          from,
          to,
          routeId: route.id,
          fromIdx: i,
          toIdx: j,
          inVehicle: duration,
          distanceM,
          recordedWaitMin: route.typicalWaitMin,
          rankingWaitMin: route.typicalWaitMin ?? opts.assumedWaitMin[route.mode],
        });
      }
    }
  }

  // Transfer walks between nearby stops. O(n^2) is fine for a city-sized stop list;
  // swap for a spatial grid if the network grows to tens of thousands of stops.
  for (let a = 0; a < activeStops.length; a++) {
    for (let b = a + 1; b < activeStops.length; b++) {
      const sa = activeStops[a]!;
      const sb = activeStops[b]!;
      const straight = haversineMeters(sa, sb);
      const { distanceM, minutes } = walkingMinutes(straight, opts);
      if (distanceM > opts.maxTransferWalkM) continue;
      addEdge(adjacency, { kind: 'walk', from: sa.id, to: sb.id, distanceM, minutes });
      addEdge(adjacency, { kind: 'walk', from: sb.id, to: sa.id, distanceM, minutes });
    }
  }

  return { index, adjacency, positions };
}

export interface NearbyStop {
  stopId: string;
  distanceM: number;
  minutes: number;
}

/** Stops within walking distance of a point, nearest first. */
export function nearbyStops(graph: TransitGraph, point: LatLng, maxWalkM: number, opts: PlannerOptions): NearbyStop[] {
  const out: NearbyStop[] = [];
  for (const [stopId, pos] of graph.positions) {
    if (stopId === ORIGIN_NODE || stopId === DESTINATION_NODE) continue;
    const { distanceM, minutes } = walkingMinutes(haversineMeters(point, pos), opts);
    if (distanceM <= maxWalkM) out.push({ stopId, distanceM, minutes });
  }
  return out.sort((x, y) => x.distanceM - y.distanceM);
}

/**
 * Returns a new graph with the virtual origin/destination nodes connected by walking edges.
 * The base graph is not mutated, so it can be cached and reused between searches.
 */
export function withEndpoints(
  graph: TransitGraph,
  origin: LatLng,
  destination: LatLng,
  opts: PlannerOptions,
): { graph: TransitGraph; originStops: NearbyStop[]; destinationStops: NearbyStop[] } {
  const originStops = nearbyStops(graph, origin, opts.maxAccessWalkM, opts);
  const destinationStops = nearbyStops(graph, destination, opts.maxAccessWalkM, opts);
  const adjacency = new Map<string, Edge[]>();
  for (const [k, v] of graph.adjacency) adjacency.set(k, v.slice());
  const positions = new Map(graph.positions);
  positions.set(ORIGIN_NODE, origin);
  positions.set(DESTINATION_NODE, destination);
  for (const s of originStops) {
    addEdge(adjacency, { kind: 'walk', from: ORIGIN_NODE, to: s.stopId, distanceM: s.distanceM, minutes: s.minutes });
  }
  for (const s of destinationStops) {
    addEdge(adjacency, { kind: 'walk', from: s.stopId, to: DESTINATION_NODE, distanceM: s.distanceM, minutes: s.minutes });
  }
  return { graph: { index: graph.index, adjacency, positions }, originStops, destinationStops };
}
