import { journeyDuration, rideDuration } from '@/features/routing/durations';
import { isFareEffective, quoteRideFare, summariseFares } from '@/features/routing/fares';
import { formatDuration, formatFareSummary } from '@/features/routing/format';
import { indexNetwork } from '@/features/routing/graph';
import { defaultPlannerOptions } from '@/features/routing/options';
import { planJourneys } from '@/features/routing/planner';
import type { Leg, RideLeg } from '@/features/routing/types';
import { fare, lineNetwork, near, route } from './fixtures';

const TODAY = '2026-10-14';
const opts = defaultPlannerOptions({ today: TODAY });

describe('fare lookup', () => {
  const fares = [
    fare('flat', 'R', null, null, 5, 6),
    fare('seg', 'R', 'A', 'C', 3, 4),
    fare('old', 'R', 'A', 'B', 1, 1, { effectiveFrom: '2025-01-01', effectiveTo: '2025-12-31' }),
    fare('future', 'R', 'B', 'C', 9, 9, { effectiveFrom: '2027-01-01' }),
  ];

  it('prefers a fare recorded for the exact boarding/alighting pair', () => {
    expect(quoteRideFare(fares, 'R', 'A', 'C', TODAY)).toMatchObject({ minGhs: 3, maxGhs: 4, basis: 'segment' });
  });

  it('falls back to the flat route fare and says so', () => {
    expect(quoteRideFare(fares, 'R', 'A', 'D', TODAY)).toMatchObject({ minGhs: 5, maxGhs: 6, basis: 'route_flat' });
  });

  it('ignores fares outside their effective dates', () => {
    expect(isFareEffective(fares[2]!, TODAY)).toBe(false);
    expect(isFareEffective(fares[3]!, TODAY)).toBe(false);
    expect(quoteRideFare(fares, 'R', 'A', 'B', TODAY)?.basis).toBe('route_flat');
  });

  it('ignores inactive fares and prefers verified over unverified', () => {
    const list = [
      fare('u', 'R', null, null, 4, 4, { quality: { verification: 'unverified', lastVerifiedAt: '2026-09-01', sourceId: null, isDemo: false } }),
      fare('v', 'R', null, null, 5, 5, { quality: { verification: 'verified', lastVerifiedAt: '2026-01-01', sourceId: null, isDemo: false } }),
      fare('i', 'R', null, null, 1, 1, { quality: { verification: 'inactive', lastVerifiedAt: '2026-10-01', sourceId: null, isDemo: false } }),
    ];
    expect(quoteRideFare(list, 'R', 'A', 'B', TODAY)?.fareId).toBe('v');
  });

  it('returns null (unknown) when no fare is recorded', () => {
    expect(quoteRideFare([], 'R', 'A', 'B', TODAY)).toBeNull();
    expect(quoteRideFare(fares, 'OTHER', 'A', 'B', TODAY)).toBeNull();
  });
});

describe('fare totals', () => {
  const ride = (fareVal: RideLeg['fare']): Leg => ({ kind: 'ride', fare: fareVal }) as RideLeg;
  const q = (min: number, max: number, verification: 'verified' | 'unverified' = 'verified') => ({
    minGhs: min, maxGhs: max, basis: 'route_flat' as const, verification, lastVerifiedAt: null, sourceId: null, isDemo: false, fareId: 'x',
  });

  it('sums known legs into a complete total', () => {
    const s = summariseFares([ride(q(3, 4)), ride(q(8, 10))]);
    expect(s).toMatchObject({ status: 'complete', knownMinGhs: 11, knownMaxGhs: 14, allVerified: true });
    expect(formatFareSummary(s).headline).toBe('GH₵11–14');
  });

  it('never treats an unknown leg as free', () => {
    const s = summariseFares([ride(q(3, 4)), ride(null)]);
    expect(s).toMatchObject({ status: 'partial', knownMinGhs: 3, knownMaxGhs: 4, unknownLegCount: 1, allVerified: false });
    const f = formatFareSummary(s);
    expect(f.headline).toBe('GH₵3–4 + ?');
    expect(f.note).toMatch(/total is incomplete/);
  });

  it('reports a fully unknown fare', () => {
    expect(summariseFares([ride(null)]).status).toBe('unknown');
  });

  it('flags unverified fares', () => {
    const s = summariseFares([ride(q(3, 4, 'unverified'))]);
    expect(s.allVerified).toBe(false);
    expect(formatFareSummary(s).note).toMatch(/unverified/);
  });

  it('end-to-end: transfer journey with an unknown leg is partial', () => {
    const net = lineNetwork();
    net.fares = net.fares.filter((f) => f.routeId !== 'C2F');
    const s = Object.fromEntries(net.stops.map((x) => [x.id, x]));
    const r = planJourneys(net, near(s.A!), near(s.F!), { today: TODAY });
    if (r.status !== 'ok') throw new Error('expected ok');
    expect(r.journeys[0]!.fare).toMatchObject({ status: 'partial', knownMinGhs: 3, knownMaxGhs: 4, unknownLegCount: 1 });
  });
});

describe('durations', () => {
  it('sums recorded hop times', () => {
    const net = lineNetwork();
    const idx = indexNetwork(net);
    const r = idx.routesById.get('AE')!;
    expect(rideDuration(r, 0, 3, idx.stopsById, opts).duration).toEqual({ minutes: 12, quality: 'recorded' });
  });

  it('estimates missing hops from distance and flags the result', () => {
    const net = lineNetwork();
    net.routes.push(route('GAP', [['A', null], ['B', null], ['C', 4]]));
    const idx = indexNetwork(net);
    const { duration } = rideDuration(idx.routesById.get('GAP')!, 0, 2, idx.stopsById, opts);
    expect(duration.quality).toBe('estimated');
    // ~1.1 km × 1.35 detour at 16 km/h ≈ 5.6 min, plus the recorded 4 min.
    expect(duration.minutes).toBeGreaterThan(8);
    expect(duration.minutes).toBeLessThan(11);
  });

  it('rejects backwards or out-of-range segments', () => {
    const net = lineNetwork();
    const idx = indexNetwork(net);
    const r = idx.routesById.get('AE')!;
    expect(() => rideDuration(r, 3, 1, idx.stopsById, opts)).toThrow(RangeError);
    expect(() => rideDuration(r, 0, 9, idx.stopsById, opts)).toThrow(RangeError);
  });

  it('counts waiting only where the route records it, otherwise marks the total as estimated', () => {
    const base = { kind: 'ride', inVehicle: { minutes: 10, quality: 'recorded' } } as const;
    expect(journeyDuration([{ ...base, waitMin: 5 } as RideLeg])).toEqual({ minutes: 15, quality: 'recorded' });
    expect(journeyDuration([{ ...base, waitMin: null } as RideLeg])).toEqual({ minutes: 10, quality: 'estimated' });
  });

  it('formats recorded times precisely and estimates as rounded ranges', () => {
    expect(formatDuration({ minutes: 23, quality: 'recorded' })).toBe('23 min');
    expect(formatDuration({ minutes: 75, quality: 'recorded' })).toBe('1 h 15 min');
    expect(formatDuration({ minutes: 23, quality: 'estimated' })).toBe('about 20–30 min');
    expect(formatDuration({ minutes: 6, quality: 'estimated' })).toBe('about 6 min');
    expect(formatDuration({ minutes: 300, quality: 'estimated' })).toBe('about 4 h 15 min–6 h 15 min');
  });
});
