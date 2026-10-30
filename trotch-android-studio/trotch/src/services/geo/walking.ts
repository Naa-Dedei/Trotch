import { env, type WalkingProvider } from '@/lib/env';
import type { LatLng } from '@/types/transport';

export interface WalkingRoute {
  geometry: LatLng[];
  distanceM: number;
  minutes: number;
}

export interface WalkingConfig {
  provider: WalkingProvider;
  osrmUrl: string | null;
  mapboxToken: string | null;
}

const defaultConfig = (): WalkingConfig => ({ provider: env.walking, osrmUrl: env.osrmUrl, mapboxToken: env.mapboxToken });

export const isWalkingProviderEnabled = (cfg: WalkingConfig = defaultConfig()) =>
  (cfg.provider === 'osrm' && !!cfg.osrmUrl) || (cfg.provider === 'mapbox' && !!cfg.mapboxToken);

/**
 * Street-level walking directions for drawing walk legs. Optional: when not configured
 * (or on failure) callers keep the straight-line estimate and label it as such.
 */
export async function walkingDirections(from: LatLng, to: LatLng, signal?: AbortSignal, cfg: WalkingConfig = defaultConfig()): Promise<WalkingRoute | null> {
  if (!isWalkingProviderEnabled(cfg)) return null;
  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const url =
    cfg.provider === 'osrm'
      ? `${cfg.osrmUrl!.replace(/\/$/, '')}/route/v1/foot/${coords}?overview=full&geometries=geojson`
      : `https://api.mapbox.com/directions/v5/mapbox/walking/${coords}?overview=full&geometries=geojson&access_token=${encodeURIComponent(cfg.mapboxToken!)}`;
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const data = (await res.json()) as { routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[] };
    const r = data.routes?.[0];
    if (!r) return null;
    return {
      geometry: r.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
      distanceM: r.distance,
      minutes: r.duration / 60,
    };
  } catch {
    return null;
  }
}
