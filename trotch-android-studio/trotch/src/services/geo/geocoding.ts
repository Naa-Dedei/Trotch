import { env, type GeocoderProvider } from '@/lib/env';
import { GHANA_BOUNDS, isInGhana } from '@/lib/geo';
import type { PlaceRef } from '@/types/transport';

export interface GeocodeResult {
  id: string;
  label: string;
  subtitle: string;
  place: PlaceRef;
}

export interface GeocoderConfig {
  provider: GeocoderProvider;
  baseUrl: string;
  mapboxToken: string | null;
  contactEmail: string | null;
}

const defaultConfig = (): GeocoderConfig => ({
  provider: env.geocoder,
  baseUrl: env.geocoderUrl,
  mapboxToken: env.mapboxToken,
  contactEmail: env.geocoderContact,
});

export const isGeocoderEnabled = (cfg: GeocoderConfig = defaultConfig()) =>
  cfg.provider === 'nominatim' || (cfg.provider === 'mapbox' && !!cfg.mapboxToken);

async function fetchJson(url: string, signal?: AbortSignal, headers: Record<string, string> = {}): Promise<unknown> {
  const res = await fetch(url, { signal, headers: { Accept: 'application/json', ...headers } });
  if (!res.ok) throw new Error(`Geocoder responded ${res.status}`);
  return res.json();
}

/**
 * Optional external place search, restricted to Ghana. Results are only coordinates —
 * they never imply that transport serves that place; the planner decides that.
 */
export async function geocode(query: string, signal?: AbortSignal, cfg: GeocoderConfig = defaultConfig()): Promise<GeocodeResult[]> {
  if (!isGeocoderEnabled(cfg)) return [];
  const q = encodeURIComponent(query);
  if (cfg.provider === 'nominatim') {
    const vb = `${GHANA_BOUNDS.minLng},${GHANA_BOUNDS.maxLat},${GHANA_BOUNDS.maxLng},${GHANA_BOUNDS.minLat}`;
    const email = cfg.contactEmail ? `&email=${encodeURIComponent(cfg.contactEmail)}` : '';
    const data = (await fetchJson(
      `${cfg.baseUrl.replace(/\/$/, '')}/search?q=${q}&format=jsonv2&countrycodes=gh&limit=6&viewbox=${vb}&bounded=1${email}`,
      signal,
    )) as { place_id: number; display_name: string; lat: string; lon: string; name?: string }[];
    return data
      .map((d) => ({ lat: Number(d.lat), lng: Number(d.lon), d }))
      .filter((x) => isInGhana(x))
      .map(({ lat, lng, d }) => {
        const label = d.name || d.display_name.split(',')[0]!.trim();
        return {
          id: `nominatim:${d.place_id}`,
          label,
          subtitle: d.display_name.split(',').slice(1, 3).join(',').trim(),
          place: { label, lat, lng, type: 'geocoded' as const, refId: null },
        };
      });
  }
  // Mapbox Geocoding v6 forward search.
  const data = (await fetchJson(
    `https://api.mapbox.com/search/geocode/v6/forward?q=${q}&country=gh&limit=6&access_token=${encodeURIComponent(cfg.mapboxToken!)}`,
    signal,
  )) as { features: { id: string; geometry: { coordinates: [number, number] }; properties: { name: string; place_formatted?: string } }[] };
  return data.features.map((f) => {
    const [lng, lat] = f.geometry.coordinates;
    return {
      id: `mapbox:${f.id}`,
      label: f.properties.name,
      subtitle: f.properties.place_formatted ?? '',
      place: { label: f.properties.name, lat, lng, type: 'geocoded' as const, refId: null },
    };
  });
}
