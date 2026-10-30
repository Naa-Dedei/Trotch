import { JourneyPlanner, planJourneys } from '@/features/routing/planner';
import type { Journey, RideLeg } from '@/features/routing/types';
import { fare, lineNetwork, near, place, route } from './fixtures';

const today = { today: '2026-10-14' };
const stopsOf = (net: ReturnType<typeof lineNetwork>) => Object.fromEntries(net.stops.map((s) => [s.id, s]));
const rides = (j: Journey) => j.legs.filter((l): l is RideLeg => l.kind === 'ride');

function okJourneys(result: ReturnType<typeof planJourneys>): Journey[] {
  if (result.status !== 'ok') throw new Error(`Expected journeys, got ${result.reason}: ${result.message}`);
  return result.journeys;
}

describe('journey search', () => {
  it('finds a direct ride with access and egress walks as ordered legs', () => {
    const net = lineNetwork();
    const s = stopsOf(net);
    const [best] = okJourneys(planJourneys(net, near(s.A!), near(s.D!), today));
    expect(best!.legs.map((l) => l.kind)).toEqual(['walk', 'ride', 'walk']);
    const [ride] = rides(best!);
    expect(ride).toMatchObject({ routeId: 'AE', boardStopId: 'A', alightStopId: 'D', intermediateStopIds: ['B', 'C'] });
    expect(best!.transfers).toBe(0);
    expect(best!.tags).toContain('recommended');
  });

  it('does not invent a reverse service: E → A has no route', () => {
    const net = lineNetwork();
    const s = stopsOf(net);
    const result = planJourneys(net, near(s.E!), near(s.A!), today);
    expect(result.status).toBe('no_route');
    if (result.status === 'no_route') {
      expect(result.reason).toBe('no_connection');
      expect(result.message).toMatch(/not yet available in Trotch's verified network/);
    }
  });

  it('handles a transfer that needs a short walk between stops', () => {
    const net = lineNetwork();
    const s = stopsOf(net);
    const [best] = okJourneys(planJourneys(net, near(s.A!), near(s.F!), today));
    expect(best!.legs.map((l) => l.kind)).toEqual(['walk', 'ride', 'walk', 'ride', 'walk']);
    expect(rides(best!).map((r) => [r.routeId, r.boardStopId, r.alightStopId])).toEqual([
      ['AE', 'A', 'C'],
      ['C2F', 'C2', 'F'],
    ]);
    expect(best!.transfers).toBe(1);
  });

  it('respects the maximum number of transfers', () => {
    const net = lineNetwork();
    const s = stopsOf(net);
    const result = planJourneys(net, near(s.A!), near(s.F!), { ...today, maxTransfers: 0 });
    expect(result.status).toBe('no_route');
  });

  it('reports when the origin has no stops within walking distance', () => {
    const net = lineNetwork();
    const s = stopsOf(net);
    const result = planJourneys(net, place('Nowhere', 5.75, -0.35), near(s.D!), today);
    expect(result).toMatchObject({ status: 'no_route', reason: 'no_origin_stops' });
  });

  it('reports when the destination has no stops within walking distance', () => {
    const net = lineNetwork();
    const s = stopsOf(net);
    const result = planJourneys(net, near(s.A!), place('Nowhere', 5.75, -0.35), today);
    expect(result).toMatchObject({ status: 'no_route', reason: 'no_destination_stops' });
  });

  it('isolated stops are not reachable just because they exist', () => {
    const net = lineNetwork();
    const s = stopsOf(net);
    expect(planJourneys(net, near(s.A!), near(s.X!), today).status).toBe('no_route');
  });

  it('rejects identical origin and destination', () => {
    const net = lineNetwork();
    const s = stopsOf(net);
    expect(planJourneys(net, near(s.A!), near(s.A!), today)).toMatchObject({ status: 'no_route', reason: 'same_place' });
  });

  it('limits walking: a long walk to a better stop is not used', () => {
    const net = lineNetwork();
    const s = stopsOf(net);
    // 3 km from A: beyond the access-walk limit.
    const far = place('Far', s.A!.lat + 0.027, s.A!.lng);
    expect(planJourneys(net, far, near(s.D!), today).status).toBe('no_route');
  });

  it('offers a walking-only option when the destination is close', () => {
    const net = lineNetwork();
    const s = stopsOf(net);
    const journeys = okJourneys(planJourneys(net, near(s.A!), near(s.B!), today));
    expect(journeys.some((j) => j.legs.length === 1 && j.legs[0]!.kind === 'walk')).toBe(true);
    const walk = journeys.find((j) => j.legs.length === 1)!;
    expect(walk.fare.status).toBe('not_applicable');
  });

  it('generates ranked alternatives and only tags comparisons the data supports', () => {
    const net = lineNetwork();
    // A slower, cheaper bus that also goes A → E.
    net.routes.push(route('BUS', [['A', null], ['E', 30]], 'bus', { typicalWaitMin: 15 }));
    net.fares.push(fare('fBUS', 'BUS', null, null, 2, 2));
    const s = stopsOf(net);
    const journeys = okJourneys(planJourneys(net, near(s.A!), near(s.E!), today));
    expect(journeys.length).toBeGreaterThanOrEqual(2);
    expect(journeys[0]!.cost).toBeLessThanOrEqual(journeys[1]!.cost);
    const byRoute = (id: string) => journeys.find((j) => rides(j)[0]?.routeId === id)!;
    expect(byRoute('AE').tags).toContain('fastest');
    expect(byRoute('BUS').tags).toContain('lowest_fare');
    // Both have zero transfers → no unique "fewest transfers" winner.
    expect(journeys.some((j) => j.tags.includes('fewest_transfers'))).toBe(false);
  });

  it('does not tag lowest fare when any alternative has an unknown fare', () => {
    const net = lineNetwork();
    net.routes.push(route('BUS', [['A', null], ['E', 30]], 'bus'));
    const s = stopsOf(net);
    const journeys = okJourneys(planJourneys(net, near(s.A!), near(s.E!), today));
    expect(journeys.length).toBeGreaterThanOrEqual(2);
    expect(journeys.some((j) => j.tags.includes('lowest_fare'))).toBe(false);
  });

  it('marks journeys that rely on demo or unverified data', () => {
    const net = lineNetwork();
    net.routes[0] = { ...net.routes[0]!, quality: { verification: 'unverified', lastVerifiedAt: null, sourceId: null, isDemo: true } };
    const s = stopsOf(net);
    const [best] = okJourneys(planJourneys(net, near(s.A!), near(s.D!), today));
    expect(best!.hasDemoData).toBe(true);
    expect(best!.hasUnverifiedData).toBe(true);
  });

  it('reuses one cached graph across searches', () => {
    const net = lineNetwork();
    const s = stopsOf(net);
    const planner = new JourneyPlanner(net, today);
    expect(planner.plan(near(s.A!), near(s.D!)).status).toBe('ok');
    expect(planner.plan(near(s.A!), near(s.F!)).status).toBe('ok');
    expect(planner.plan(near(s.E!), near(s.A!)).status).toBe('no_route');
  });

  it('returns an explicit empty-network result', () => {
    const result = planJourneys({ stops: [], routes: [], fares: [], locations: [], sources: [] }, place('a', 5.6, -0.2), place('b', 5.7, -0.2));
    expect(result).toMatchObject({ status: 'no_route', reason: 'empty_network' });
  });
});
