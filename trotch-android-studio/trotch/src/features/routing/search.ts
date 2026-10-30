import { DESTINATION_NODE, ORIGIN_NODE, type Edge, type TransitGraph } from './graph';
import type { PlannerOptions, RoutingWeights } from './types';

/** Small binary min-heap keyed by cost. */
class MinHeap<T> {
  private items: { cost: number; value: T }[] = [];
  get size() {
    return this.items.length;
  }
  push(cost: number, value: T) {
    const items = this.items;
    items.push({ cost, value });
    let i = items.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (items[p]!.cost <= items[i]!.cost) break;
      [items[p], items[i]] = [items[i]!, items[p]!];
      i = p;
    }
  }
  pop(): { cost: number; value: T } | undefined {
    const items = this.items;
    if (items.length === 0) return undefined;
    const top = items[0]!;
    const last = items.pop()!;
    if (items.length > 0) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < items.length && items[l]!.cost < items[m]!.cost) m = l;
        if (r < items.length && items[r]!.cost < items[m]!.cost) m = r;
        if (m === i) break;
        [items[m], items[i]] = [items[i]!, items[m]!];
        i = m;
      }
    }
    return top;
  }
}

interface Label {
  node: string;
  rides: number;
  lastKind: 'start' | 'walk' | 'ride';
  lastRouteId: string | null;
  cost: number;
  prev: Label | null;
  edge: Edge | null;
}

const stateKey = (node: string, rides: number, kind: string, routeId: string | null) =>
  `${node}|${rides}|${kind}|${routeId ?? ''}`;

export interface SearchSettings {
  weights: RoutingWeights;
  maxTransfers: number;
  excludedRouteIds?: ReadonlySet<string>;
}

export function settingsFrom(opts: PlannerOptions, weights?: Partial<RoutingWeights>): SearchSettings {
  return {
    weights: { ...opts.weights, ...weights },
    maxTransfers: opts.maxTransfers,
    excludedRouteIds: new Set(opts.excludedRouteIds),
  };
}

export function edgeCost(edge: Edge, ridesSoFar: number, w: RoutingWeights): number {
  if (edge.kind === 'walk') return edge.minutes * w.walk;
  const transfer = ridesSoFar > 0 ? w.transferPenaltyMin : 0;
  return edge.inVehicle.minutes * w.inVehicle + edge.rankingWaitMin * w.wait + transfer;
}

/**
 * Multi-label Dijkstra from the virtual origin to the virtual destination.
 *
 * State = (node, number of rides, kind of last edge). Tracking ride count lets us
 * enforce the transfer limit exactly, and tracking the last edge kind forbids
 * walk→walk chains (which would let a "transfer" quietly become a long hike).
 * Returns the edge sequence of the cheapest path, or null if no valid path exists.
 */
export function shortestPath(graph: TransitGraph, settings: SearchSettings): { edges: Edge[]; cost: number } | null {
  const maxRides = settings.maxTransfers + 1;
  const best = new Map<string, number>();
  const heap = new MinHeap<Label>();
  const start: Label = { node: ORIGIN_NODE, rides: 0, lastKind: 'start', lastRouteId: null, cost: 0, prev: null, edge: null };
  heap.push(0, start);

  while (heap.size > 0) {
    const { value: label } = heap.pop()!;
    const key = stateKey(label.node, label.rides, label.lastKind, label.lastRouteId);
    const seen = best.get(key);
    if (seen !== undefined && seen < label.cost) continue;

    if (label.node === DESTINATION_NODE) {
      if (label.rides === 0) continue; // walking-only journeys are produced separately
      const edges: Edge[] = [];
      for (let l: Label | null = label; l && l.edge; l = l.prev) edges.push(l.edge);
      return { edges: edges.reverse(), cost: label.cost };
    }

    for (const edge of graph.adjacency.get(label.node) ?? []) {
      if (edge.kind === 'walk' && label.lastKind === 'walk') continue;
      if (edge.kind === 'ride') {
        if (label.rides >= maxRides) continue;
        if (settings.excludedRouteIds?.has(edge.routeId)) continue;
        // Re-boarding the same route right after leaving it is never useful.
        if (edge.routeId === label.lastRouteId) continue;
      }
      // Never walk back into the origin, or onward from the destination.
      if (edge.to === ORIGIN_NODE) continue;
      const rides = edge.kind === 'ride' ? label.rides + 1 : label.rides;
      const cost = label.cost + edgeCost(edge, label.rides, settings.weights);
      const nextKind = edge.kind;
      const nextRouteId = edge.kind === 'ride' ? edge.routeId : label.lastRouteId;
      const nextKey = stateKey(edge.to, rides, nextKind, nextRouteId);
      const prevBest = best.get(nextKey);
      if (prevBest !== undefined && prevBest <= cost) continue;
      best.set(nextKey, cost);
      heap.push(cost, {
        node: edge.to,
        rides,
        lastKind: nextKind,
        lastRouteId: nextRouteId,
        cost,
        prev: label,
        edge,
      });
    }
  }
  return null;
}
