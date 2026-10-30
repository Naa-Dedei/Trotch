import type { LatLng } from '@/types/transport';

const EARTH_RADIUS_M = 6_371_008.8;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in metres. */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function isValidLatLng(p: Partial<LatLng> | null | undefined): p is LatLng {
  return (
    !!p &&
    typeof p.lat === 'number' &&
    typeof p.lng === 'number' &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    Math.abs(p.lat) <= 90 &&
    Math.abs(p.lng) <= 180
  );
}

/** Approximate bounding box of Ghana, used to sanity-check coordinates. */
export const GHANA_BOUNDS = { minLat: 4.5, maxLat: 11.3, minLng: -3.4, maxLng: 1.3 } as const;

export function isInGhana(p: LatLng): boolean {
  return (
    p.lat >= GHANA_BOUNDS.minLat &&
    p.lat <= GHANA_BOUNDS.maxLat &&
    p.lng >= GHANA_BOUNDS.minLng &&
    p.lng <= GHANA_BOUNDS.maxLng
  );
}

export interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

/** Map region that fits all points with padding. Returns null for an empty list. */
export function regionForPoints(points: LatLng[], paddingFactor = 1.4, minDelta = 0.01): Region | null {
  if (points.length === 0) return null;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const p of points) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
  }
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * paddingFactor, minDelta),
    longitudeDelta: Math.max((maxLng - minLng) * paddingFactor, minDelta),
  };
}

/** Greater Accra default view. */
export const ACCRA_REGION: Region = {
  latitude: 5.6037,
  longitude: -0.187,
  latitudeDelta: 0.16,
  longitudeDelta: 0.16,
};
