import type {
  FareRecord,
  PlaceRef,
  Stop,
  TransportMode,
  TransportNetwork,
  TransportRoute,
  VerificationStatus,
} from '@/types/transport';

const q = (verification: VerificationStatus = 'verified', isDemo = false) => ({
  verification,
  lastVerifiedAt: '2026-09-01',
  sourceId: 'src',
  isDemo,
});

/**
 * A synthetic line along the equator-ish latitude 5.6, spaced ~1.1 km apart (0.01° lng):
 *
 *   A(0) — B(1) — C(2) — D(3) — E(4)          trotro "AE" A→B→C→D→E  (one direction only)
 *                  |
 *                  C2 (60 m from C)           taxi "C2F" C2→F
 *                  F (north, ~2.2 km)
 *
 *   X (far away, isolated stop, no routes)
 */
export function stop(id: string, lat: number, lng: number, extra: Partial<Stop> = {}): Stop {
  return {
    id,
    cityId: 'test',
    name: `Stop ${id}`,
    kind: 'roadside',
    lat,
    lng,
    aliases: [],
    landmarkHint: null,
    isActive: true,
    quality: q(),
    ...extra,
  };
}

export function route(
  id: string,
  stops: [string, number | null][],
  mode: TransportMode = 'trotro',
  extra: Partial<TransportRoute> = {},
): TransportRoute {
  return {
    id,
    cityId: 'test',
    code: null,
    name: `Route ${id}`,
    mode,
    headsign: stops[stops.length - 1]![0],
    callOut: null,
    typicalWaitMin: 5,
    stops: stops.map(([stopId, m], i) => ({ stopId, minutesFromPrevious: i === 0 ? null : m })),
    path: null,
    isActive: true,
    quality: q(),
    notes: null,
    ...extra,
  };
}

export function fare(
  id: string,
  routeId: string,
  from: string | null,
  to: string | null,
  min: number,
  max: number,
  extra: Partial<FareRecord> = {},
): FareRecord {
  return {
    id,
    routeId,
    fromStopId: from,
    toStopId: to,
    minGhs: min,
    maxGhs: max,
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    quality: q(),
    ...extra,
  };
}

export function lineNetwork(): TransportNetwork {
  return {
    stops: [
      stop('A', 5.6, -0.2),
      stop('B', 5.6, -0.19),
      stop('C', 5.6, -0.18),
      stop('D', 5.6, -0.17),
      stop('E', 5.6, -0.16),
      stop('C2', 5.6005, -0.18),
      stop('F', 5.62, -0.18),
      stop('X', 5.9, -0.5),
    ],
    routes: [
      route('AE', [
        ['A', null],
        ['B', 4],
        ['C', 4],
        ['D', 4],
        ['E', 4],
      ]),
      route('C2F', [
        ['C2', null],
        ['F', 6],
      ], 'shared_taxi'),
    ],
    fares: [fare('fAE', 'AE', null, null, 5, 6), fare('fAC', 'AE', 'A', 'C', 3, 4), fare('fC2F', 'C2F', null, null, 8, 10)],
    locations: [],
    sources: [],
  };
}

export const place = (label: string, lat: number, lng: number): PlaceRef => ({ label, lat, lng, type: 'location' });

/** Points ~100 m from a stop (so access walks are short). */
export const near = (s: Stop, label = `Near ${s.id}`): PlaceRef => place(label, s.lat + 0.0009, s.lng);
