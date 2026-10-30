import { buildGraph, nearbyStops, type RideEdge } from '@/features/routing/graph';
import { defaultPlannerOptions } from '@/features/routing/options';
import { lineNetwork, route, stop } from './fixtures';

const opts = defaultPlannerOptions({ today: '2026-10-14' });

const rideEdges = (g: ReturnType<typeof buildGraph>, from: string) =>
  (g.adjacency.get(from) ?? []).filter((e): e is RideEdge => e.kind === 'ride');

describe('route graph construction', () => {
  it('creates ride edges only in the recorded direction of travel', () => {
    const g = buildGraph(lineNetwork(), opts);
    expect(rideEdges(g, 'A').map((e) => e.to).sort()).toEqual(['B', 'C', 'D', 'E']);
    expect(rideEdges(g, 'C').map((e) => e.to).sort()).toEqual(['D', 'E']);
    // The last stop has no onward ride, and nothing rides "backwards".
    expect(rideEdges(g, 'E')).toHaveLength(0);
    expect(rideEdges(g, 'D').some((e) => e.to === 'A')).toBe(false);
  });

  it('builds n·(n−1)/2 ride edges per route', () => {
    const g = buildGraph(lineNetwork(), opts);
    const ae = [...g.adjacency.values()].flat().filter((e) => e.kind === 'ride' && e.routeId === 'AE');
    expect(ae).toHaveLength(10);
  });

  it('links nearby stops with walking transfers, never with rides', () => {
    const g = buildGraph(lineNetwork(), opts);
    const fromC = g.adjacency.get('C') ?? [];
    expect(fromC.some((e) => e.kind === 'walk' && e.to === 'C2')).toBe(true);
    expect((g.adjacency.get('C2') ?? []).some((e) => e.kind === 'walk' && e.to === 'C')).toBe(true);
    // Proximity never creates a ride edge between C and C2.
    expect(fromC.some((e) => e.kind === 'ride' && e.to === 'C2')).toBe(false);
  });

  it('does not create walking links beyond the transfer limit', () => {
    const g = buildGraph(lineNetwork(), opts);
    // A and B are ~1.1 km apart (≈1.4 km on foot) — too far for a transfer walk.
    expect((g.adjacency.get('A') ?? []).some((e) => e.kind === 'walk' && e.to === 'B')).toBe(false);
  });

  it('skips inactive routes, routes with inactive stops and excluded routes', () => {
    const net = lineNetwork();
    net.routes.push(route('DEAD', [['A', null], ['E', 10]], 'bus', { isActive: false }));
    net.routes.push(route('OLD', [['B', null], ['D', 10]], 'bus', { quality: { verification: 'inactive', lastVerifiedAt: null, sourceId: null, isDemo: false } }));
    net.stops.push(stop('Z', 5.6, -0.15, { isActive: false }));
    net.routes.push(route('TOZ', [['E', null], ['Z', 3]]));
    const g = buildGraph(net, { ...opts, excludedRouteIds: ['C2F'] });
    const all = [...g.adjacency.values()].flat().filter((e): e is RideEdge => e.kind === 'ride');
    const ids = new Set(all.map((e) => e.routeId));
    expect(ids.has('DEAD')).toBe(false);
    expect(ids.has('OLD')).toBe(false);
    expect(ids.has('TOZ')).toBe(false);
    expect(ids.has('C2F')).toBe(false);
    expect(ids.has('AE')).toBe(true);
  });

  it('rejects routes that reference unknown stops', () => {
    const net = lineNetwork();
    net.routes.push(route('GHOST', [['A', null], ['NOPE', 5]]));
    const g = buildGraph(net, opts);
    expect([...g.adjacency.values()].flat().some((e) => e.kind === 'ride' && e.routeId === 'GHOST')).toBe(false);
  });

  it('finds nearby stops sorted by walking distance', () => {
    const g = buildGraph(lineNetwork(), opts);
    const near = nearbyStops(g, { lat: 5.6003, lng: -0.1801 }, 500, opts);
    expect(near.map((n) => n.stopId)).toEqual(['C2', 'C']);
    expect(near[0]!.distanceM).toBeLessThan(near[1]!.distanceM);
  });
});
