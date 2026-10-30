/**
 * Planner behaviour against the bundled DEMO network (the same data as supabase/seed.sql).
 * These checks prove the engine works end-to-end on realistic Accra-shaped data; they do not
 * claim the DEMO routes themselves are real.
 */
import demo from '@/data/demo-network.json';
import { buildSearchIndex, searchPlaces, toPlaceRef } from '@/features/locations/search';
import { planJourneys } from '@/features/routing/planner';
import type { RideLeg } from '@/features/routing/types';
import type { PlaceRef, TransportNetwork } from '@/types/transport';

const network = demo as unknown as TransportNetwork;
const index = buildSearchIndex(network.locations, network.stops);
const placeFor = (q: string): PlaceRef => {
  const r = searchPlaces(index, q)[0];
  if (!r) throw new Error(`No place for ${q}`);
  return toPlaceRef(r);
};
const opts = { today: '2026-10-14' };

describe('DEMO network', () => {
  it('is entirely labelled as demo data', () => {
    expect(network.stops.every((s) => s.quality.isDemo)).toBe(true);
    expect(network.routes.every((r) => r.quality.isDemo)).toBe(true);
    expect(network.fares.every((f) => f.quality.isDemo)).toBe(true);
    expect(network.routes.every((r) => r.quality.verification !== 'verified')).toBe(true);
  });

  it('plans Circle → University of Ghana on the Circle–Madina trotro', () => {
    const r = planJourneys(network, placeFor('Circle'), placeFor('University of Ghana'), opts);
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    const best = r.journeys[0]!;
    const rides = best.legs.filter((l): l is RideLeg => l.kind === 'ride');
    expect(rides).toHaveLength(1);
    expect(rides[0]!.routeName).toBe('Circle – Madina');
    expect(best.fare).toMatchObject({ status: 'complete', knownMinGhs: 8, knownMaxGhs: 9 });
    expect(best.hasDemoData).toBe(true);
  });

  it('plans University of Ghana → Accra Mall with a transfer to a line taxi', () => {
    const r = planJourneys(network, placeFor('Legon'), placeFor('Accra Mall'), opts);
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    const modes = r.journeys.map((j) => j.legs.filter((l): l is RideLeg => l.kind === 'ride').map((l) => l.mode));
    expect(modes.some((m) => m.join('>') === 'trotro>shared_taxi')).toBe(true);
  });

  it('respects one-way demo routes: Achimota → Accra Central is not available', () => {
    const r = planJourneys(network, placeFor('Achimota'), placeFor('Makola'), opts);
    expect(r).toMatchObject({ status: 'no_route', reason: 'no_connection' });
  });

  it('explains when a destination has no nearby stops (Atomic Junction)', () => {
    const r = planJourneys(network, placeFor('Circle'), placeFor('Atomic Junction'), opts);
    expect(r).toMatchObject({ status: 'no_route', reason: 'no_destination_stops' });
  });

  it('marks unknown fares on the reverse route as incomplete, not free', () => {
    const r = planJourneys(network, placeFor('Madina'), placeFor('37 Military Hospital'), opts);
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    const viaTrotro = r.journeys.find((j) => j.legs.some((l) => l.kind === 'ride' && l.routeName === 'Madina – Circle'));
    expect(viaTrotro?.fare.status).toBe('unknown');
  });

  it('supports intercity routes in the same model', () => {
    const r = planJourneys(network, placeFor('Neoplan'), placeFor('Kumasi'), opts);
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    const ride = r.journeys[0]!.legs.find((l): l is RideLeg => l.kind === 'ride')!;
    expect(ride.mode).toBe('intercity_bus');
  });
});
