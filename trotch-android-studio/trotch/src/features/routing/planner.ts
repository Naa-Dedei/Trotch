import { haversineMeters } from '@/lib/geo';
import type { LatLng, PlaceRef, Stop, TransportNetwork } from '@/types/transport';
import { journeyDuration, walkingMinutes } from './durations';
import { quoteRideFare, summariseFares } from './fares';
import {
  buildGraph,
  DESTINATION_NODE,
  ORIGIN_NODE,
  withEndpoints,
  type Edge,
  type RideEdge,
  type TransitGraph,
} from './graph';
import { defaultPlannerOptions, type PlannerOverrides } from './options';
import { edgeCost, settingsFrom, shortestPath, type SearchSettings } from './search';
import type { Journey, JourneyTag, Leg, NetworkIndex, PlannerOptions, PlanResult, RideLeg, WalkLeg } from './types';

const stopRef = (s: Stop): PlaceRef => ({ label: s.name, lat: s.lat, lng: s.lng, type: 'stop', refId: s.id });

function rideGeometry(edge: RideEdge, index: NetworkIndex): LatLng[] {
  const route = index.routesById.get(edge.routeId)!;
  const pts: LatLng[] = [];
  for (let i = edge.fromIdx; i <= edge.toIdx; i++) {
    const s = index.stopsById.get(route.stops[i]!.stopId)!;
    pts.push({ lat: s.lat, lng: s.lng });
  }
  // A recorded path is only used for drawing when it exists; otherwise straight stop-to-stop segments.
  if (route.path && route.path.length >= 2) {
    const first = pts[0]!;
    const last = pts[pts.length - 1]!;
    const path = route.path.map(([lng, lat]) => ({ lat, lng }));
    const nearest = (p: LatLng) => {
      let bi = 0;
      let bd = Infinity;
      path.forEach((q, i) => {
        const d = haversineMeters(p, q);
        if (d < bd) {
          bd = d;
          bi = i;
        }
      });
      return bi;
    };
    const a = nearest(first);
    const b = nearest(last);
    if (a < b) return [first, ...path.slice(a + 1, b), last];
  }
  return pts;
}

function edgesToLegs(
  edges: Edge[],
  graph: TransitGraph,
  origin: PlaceRef,
  destination: PlaceRef,
  opts: PlannerOptions,
): Leg[] {
  const { index } = graph;
  const refFor = (node: string): PlaceRef => {
    if (node === ORIGIN_NODE) return origin;
    if (node === DESTINATION_NODE) return destination;
    return stopRef(index.stopsById.get(node)!);
  };
  return edges.map((edge): Leg => {
    if (edge.kind === 'walk') {
      const from = refFor(edge.from);
      const to = refFor(edge.to);
      const leg: WalkLeg = {
        kind: 'walk',
        from,
        to,
        fromStopId: edge.from === ORIGIN_NODE ? null : edge.from,
        toStopId: edge.to === DESTINATION_NODE ? null : edge.to,
        distanceM: edge.distanceM,
        duration: { minutes: edge.minutes, quality: 'estimated' },
        geometry: [
          { lat: from.lat, lng: from.lng },
          { lat: to.lat, lng: to.lng },
        ],
      };
      return leg;
    }
    const route = index.routesById.get(edge.routeId)!;
    const leg: RideLeg = {
      kind: 'ride',
      mode: route.mode,
      routeId: route.id,
      routeName: route.name,
      routeCode: route.code,
      headsign: route.headsign,
      callOut: route.callOut,
      boardStopId: edge.from,
      alightStopId: edge.to,
      intermediateStopIds: route.stops.slice(edge.fromIdx + 1, edge.toIdx).map((rs) => rs.stopId),
      boardIndex: edge.fromIdx,
      alightIndex: edge.toIdx,
      inVehicle: edge.inVehicle,
      waitMin: edge.recordedWaitMin,
      distanceM: edge.distanceM,
      fare: quoteRideFare(index.faresByRoute.get(route.id), route.id, edge.from, edge.to, opts.today),
      routeVerification: route.quality.verification,
      routeIsDemo: route.quality.isDemo,
      geometry: rideGeometry(edge, index),
    };
    return leg;
  });
}

function signatureOf(legs: Leg[]): string {
  return legs
    .map((l) => (l.kind === 'ride' ? `R:${l.routeId}:${l.boardStopId}>${l.alightStopId}` : 'W'))
    .join('|');
}

function assembleJourney(legs: Leg[], cost: number, origin: PlaceRef, destination: PlaceRef, index: NetworkIndex): Journey {
  const rides = legs.filter((l): l is RideLeg => l.kind === 'ride');
  const walkingMeters = legs.reduce((sum, l) => (l.kind === 'walk' ? sum + l.distanceM : sum), 0);
  const stopIds = new Set<string>();
  for (const r of rides) {
    stopIds.add(r.boardStopId);
    stopIds.add(r.alightStopId);
  }
  const stops = [...stopIds].map((id) => index.stopsById.get(id)!);
  const hasUnverifiedData =
    rides.some((r) => r.routeVerification !== 'verified' || (r.fare && r.fare.verification !== 'verified')) ||
    stops.some((s) => s.quality.verification !== 'verified');
  const hasDemoData = rides.some((r) => r.routeIsDemo || r.fare?.isDemo) || stops.some((s) => s.quality.isDemo);
  const signature = signatureOf(legs);
  return {
    id: signature,
    origin,
    destination,
    legs,
    duration: journeyDuration(legs),
    fare: summariseFares(legs),
    transfers: Math.max(0, rides.length - 1),
    walkingMeters,
    cost,
    tags: [],
    hasUnverifiedData,
    hasDemoData,
    signature,
  };
}

/** Tag alternatives only when the data actually supports the comparison. */
export function tagJourneys(journeys: Journey[]): Journey[] {
  if (journeys.length === 0) return journeys;
  const tagged = journeys.map((j) => ({ ...j, tags: [] as JourneyTag[] }));
  tagged[0]!.tags.push('recommended');
  if (tagged.length < 2) return tagged;

  const uniqueMin = (values: number[], tol = 0) => {
    const min = Math.min(...values);
    const idx = values.flatMap((v, i) => (v <= min + tol ? [i] : []));
    return idx.length === 1 ? idx[0]! : -1;
  };

  // Fastest: require a meaningful (≥3 min) margin because many durations are estimates.
  const mins = tagged.map((j) => j.duration.minutes);
  const fastest = uniqueMin(mins, 3);
  if (fastest >= 0) tagged[fastest]!.tags.push('fastest');

  // Lowest fare: only when every alternative has a complete fare.
  if (tagged.every((j) => j.fare.status === 'complete' || j.fare.status === 'not_applicable')) {
    const cheapest = uniqueMin(tagged.map((j) => j.fare.knownMaxGhs));
    if (cheapest >= 0) tagged[cheapest]!.tags.push('lowest_fare');
  }

  const fewest = uniqueMin(tagged.map((j) => j.transfers));
  if (fewest >= 0) tagged[fewest]!.tags.push('fewest_transfers');
  return tagged;
}

function walkOnlyJourney(origin: PlaceRef, destination: PlaceRef, opts: PlannerOptions, index: NetworkIndex): Journey | null {
  const { distanceM, minutes } = walkingMinutes(haversineMeters(origin, destination), opts);
  if (distanceM > opts.maxDirectWalkM) return null;
  const leg: WalkLeg = {
    kind: 'walk',
    from: origin,
    to: destination,
    fromStopId: origin.type === 'stop' ? (origin.refId ?? null) : null,
    toStopId: destination.type === 'stop' ? (destination.refId ?? null) : null,
    distanceM,
    duration: { minutes, quality: 'estimated' },
    geometry: [
      { lat: origin.lat, lng: origin.lng },
      { lat: destination.lat, lng: destination.lng },
    ],
  };
  return assembleJourney([leg], minutes * opts.weights.walk, origin, destination, index);
}

/** Cached base graph so repeated searches don't rebuild it. */
export class JourneyPlanner {
  private readonly graph: TransitGraph;
  readonly options: PlannerOptions;

  constructor(
    private readonly network: TransportNetwork,
    overrides: PlannerOverrides = {},
  ) {
    this.options = defaultPlannerOptions(overrides);
    this.graph = buildGraph(network, this.options);
  }

  get index(): NetworkIndex {
    return this.graph.index;
  }

  plan(origin: PlaceRef, destination: PlaceRef): PlanResult {
    const opts = this.options;
    if (this.network.routes.length === 0 || this.network.stops.length === 0) {
      return { status: 'no_route', reason: 'empty_network', message: 'Trotch has no transport data loaded yet.' };
    }
    if (haversineMeters(origin, destination) < 50) {
      return { status: 'no_route', reason: 'same_place', message: 'Your starting point and destination are the same place.' };
    }

    const { graph, originStops, destinationStops } = withEndpoints(this.graph, origin, destination, opts);
    const walkOnly = walkOnlyJourney(origin, destination, opts, graph.index);

    if (originStops.length === 0 && !walkOnly) {
      return {
        status: 'no_route',
        reason: 'no_origin_stops',
        message: `There are no stops in Trotch's verified network within walking distance of ${origin.label} yet.`,
      };
    }
    if (destinationStops.length === 0 && !walkOnly) {
      return {
        status: 'no_route',
        reason: 'no_destination_stops',
        message: `There are no stops in Trotch's verified network within walking distance of ${destination.label} yet.`,
      };
    }

    const candidates = new Map<string, Journey>();
    const run = (settings: SearchSettings) => {
      const found = shortestPath(graph, settings);
      if (!found) return null;
      const legs = edgesToLegs(found.edges, graph, origin, destination, opts);
      // Re-score with the default weights so candidates from different profiles are comparable.
      let rides = 0;
      let cost = 0;
      for (const e of found.edges) {
        cost += edgeCost(e, rides, opts.weights);
        if (e.kind === 'ride') rides += 1;
      }
      const journey = assembleJourney(legs, cost, origin, destination, graph.index);
      if (!candidates.has(journey.signature)) candidates.set(journey.signature, journey);
      return { found, journey };
    };

    const base = settingsFrom(opts);
    const best = run(base);
    if (best) {
      // Alternatives: ban each route used by the best journey in turn, plus a "fewest transfers" profile.
      const usedRoutes = best.journey.legs.flatMap((l) => (l.kind === 'ride' ? [l.routeId] : []));
      for (const routeId of usedRoutes) {
        const excluded = new Set(base.excludedRouteIds);
        excluded.add(routeId);
        run({ ...base, excludedRouteIds: excluded });
      }
      run(settingsFrom(opts, { transferPenaltyMin: 40 }));
      run(settingsFrom(opts, { walk: 4 }));
    }
    if (walkOnly) candidates.set(walkOnly.signature, walkOnly);

    if (candidates.size === 0) {
      return {
        status: 'no_route',
        reason: 'no_connection',
        message: `This journey is not yet available in Trotch's verified network. We couldn't find recorded routes connecting ${origin.label} to ${destination.label}.`,
      };
    }

    const sorted = [...candidates.values()].sort((a, b) => a.cost - b.cost);
    const bestCost = sorted[0]!.cost;
    const reasonable = sorted.filter((j) => j.cost <= bestCost * 1.8 + 15).slice(0, opts.maxAlternatives);
    return { status: 'ok', journeys: tagJourneys(reasonable) };
  }
}

export function planJourneys(
  network: TransportNetwork,
  origin: PlaceRef,
  destination: PlaceRef,
  overrides: PlannerOverrides = {},
): PlanResult {
  return new JourneyPlanner(network, overrides).plan(origin, destination);
}
