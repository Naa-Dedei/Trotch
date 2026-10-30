import demo from '@/data/demo-network.json';
import { buildSearchIndex, normalise, searchPlaces, validateLocationQuery } from '@/features/locations/search';
import { buildInstructions } from '@/features/routing/instructions';
import { planJourneys } from '@/features/routing/planner';
import type { TransportNetwork } from '@/types/transport';
import { lineNetwork, near } from './fixtures';

const network = demo as unknown as TransportNetwork;
const index = buildSearchIndex(network.locations, network.stops);

describe('location search validation', () => {
  it('requires 2–80 characters after trimming', () => {
    expect(validateLocationQuery(' a ')).toEqual({ ok: false, error: 'Type at least 2 characters' });
    expect(validateLocationQuery('x'.repeat(81)).ok).toBe(false);
    expect(validateLocationQuery('  Legon   main gate ')).toEqual({ ok: true, query: 'Legon main gate' });
  });

  it('rejects control characters and markup', () => {
    expect(validateLocationQuery('Circle\u0000').ok).toBe(false);
    expect(validateLocationQuery('<script>').ok).toBe(false);
  });

  it('returns no results for invalid queries', () => {
    expect(searchPlaces(index, 'a')).toEqual([]);
  });
});

describe('location search', () => {
  it('normalises case, accents and punctuation', () => {
    expect(normalise('  Kwame-Nkrumah  CIRCLE! ')).toBe('kwame nkrumah circle');
    expect(normalise('Café')).toBe('cafe');
  });

  it('finds places by common aliases', () => {
    expect(searchPlaces(index, 'Legon')[0]!.name).toBe('University of Ghana, Legon');
    expect(searchPlaces(index, 'nkrumah circle')[0]!.name).toBe('Circle');
    expect(searchPlaces(index, 'KIA')[0]!.name).toBe('Kotoka International Airport');
  });

  it('matches multi-word partial queries', () => {
    expect(searchPlaces(index, 'uni ghana')[0]!.name).toBe('University of Ghana, Legon');
  });

  it('includes stops and terminals as well as places', () => {
    const r = searchPlaces(index, 'Tetteh Quarshie');
    expect(r.some((x) => x.type === 'stop')).toBe(true);
  });

  it('labels demo records', () => {
    expect(searchPlaces(index, 'Accra Mall').every((r) => r.isDemo)).toBe(true);
  });
});

describe('instructions', () => {
  it('produce a chronological timeline from leg data, including the transfer', () => {
    const net = lineNetwork();
    const s = Object.fromEntries(net.stops.map((x) => [x.id, x]));
    const r = planJourneys(net, near(s.A!, 'Home'), near(s.F!, 'Office'), { today: '2026-10-14' });
    if (r.status !== 'ok') throw new Error('expected ok');
    const steps = buildInstructions(r.journeys[0]!, { stopsById: new Map(net.stops.map((x) => [x.id, x])), routesById: new Map(), faresByRoute: new Map() });
    expect(steps.map((x) => x.kind)).toEqual(['start', 'walk', 'board', 'ride', 'alight', 'transfer', 'board', 'ride', 'alight', 'walk', 'arrive']);
    expect(steps[0]!.title).toBe('Start at Home');
    expect(steps[2]!.title).toBe('Board a trotro to E at Stop A');
    expect(steps[4]!.title).toBe('Get off at Stop C');
    expect(steps[5]!.title).toMatch(/Walk to Stop C2 to change vehicles/);
    expect(steps[6]!.title).toMatch(/shared \(line\) taxi/);
    expect(steps.at(-1)!.title).toBe('Arrive at Office');
  });

  it('says a fare is not recorded rather than inventing one', () => {
    const net = lineNetwork();
    net.fares = [];
    const s = Object.fromEntries(net.stops.map((x) => [x.id, x]));
    const r = planJourneys(net, near(s.A!), near(s.D!), { today: '2026-10-14' });
    if (r.status !== 'ok') throw new Error('expected ok');
    const steps = buildInstructions(r.journeys[0]!, { stopsById: new Map(net.stops.map((x) => [x.id, x])), routesById: new Map(), faresByRoute: new Map() });
    expect(steps.find((x) => x.kind === 'board')!.details.join(' ')).toMatch(/Fare not yet recorded/);
  });
});
