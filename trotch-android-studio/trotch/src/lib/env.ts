/**
 * Public client configuration. Only EXPO_PUBLIC_* values are available in the app bundle,
 * and Expo inlines them at build time, so each must be referenced literally here.
 * Never add secrets (e.g. the Supabase service-role key) to EXPO_PUBLIC_* variables.
 */

const str = (v: string | undefined): string | null => {
  const t = v?.trim();
  return t ? t : null;
};

/**
 * Values copied unchanged from .env.example (e.g. YOUR-PROJECT-REF, REPLACE_ME) are treated
 * as unset, so a fresh `.env` falls back to DEMO mode instead of failing to reach a fake backend.
 */
export const isPlaceholder = (v: string | null): boolean =>
  !!v && /YOUR[-_]PROJECT[-_]REF|REPLACE[-_]ME|YOUR[-_]KEY/i.test(v);

const configured = (v: string | undefined): string | null => {
  const t = str(v);
  return t && !isPlaceholder(t) ? t : null;
};

export type GeocoderProvider = 'none' | 'nominatim' | 'mapbox';
export type WalkingProvider = 'none' | 'osrm' | 'mapbox';

const oneOf = <T extends string>(v: string | null, allowed: readonly T[], fallback: T): T =>
  v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;

export const env = {
  supabaseUrl: configured(process.env.EXPO_PUBLIC_SUPABASE_URL),
  supabaseKey:
    configured(process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ?? configured(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY),
  cityId: str(process.env.EXPO_PUBLIC_CITY_ID) ?? 'accra',
  /** When true and Supabase is not configured, the bundled DEMO network is used. */
  allowDemoFallback: (str(process.env.EXPO_PUBLIC_ALLOW_DEMO_FALLBACK) ?? 'true') === 'true',
  geocoder: oneOf<GeocoderProvider>(str(process.env.EXPO_PUBLIC_GEOCODER), ['none', 'nominatim', 'mapbox'], 'none'),
  geocoderUrl: str(process.env.EXPO_PUBLIC_GEOCODER_URL) ?? 'https://nominatim.openstreetmap.org',
  geocoderContact: str(process.env.EXPO_PUBLIC_GEOCODER_CONTACT_EMAIL),
  walking: oneOf<WalkingProvider>(str(process.env.EXPO_PUBLIC_WALKING_PROVIDER), ['none', 'osrm', 'mapbox'], 'none'),
  osrmUrl: str(process.env.EXPO_PUBLIC_OSRM_URL),
  mapboxToken: configured(process.env.EXPO_PUBLIC_MAPBOX_TOKEN),
  mapTileUrl: configured(process.env.EXPO_PUBLIC_MAP_TILE_URL),
  mapTileAttribution: str(process.env.EXPO_PUBLIC_MAP_TILE_ATTRIBUTION),
} as const;

export const isSupabaseConfigured = (): boolean => !!env.supabaseUrl && !!env.supabaseKey;
