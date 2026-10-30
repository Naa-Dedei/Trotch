import { geocode, isGeocoderEnabled } from '@/services/geo/geocoding';
import { walkingDirections } from '@/services/geo/walking';

const okJson = (body: unknown) => ({ ok: true, json: async () => body }) as unknown as Response;

afterEach(() => {
  jest.restoreAllMocks();
});

describe('geocoding provider', () => {
  it('is off unless configured', async () => {
    const cfg = { provider: 'none' as const, baseUrl: 'https://x', mapboxToken: null, contactEmail: null };
    expect(isGeocoderEnabled(cfg)).toBe(false);
    expect(await geocode('Osu', undefined, cfg)).toEqual([]);
    expect(isGeocoderEnabled({ ...cfg, provider: 'mapbox' })).toBe(false); // no token
  });

  it('parses Nominatim results, restricted to Ghana', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      okJson([
        { place_id: 1, display_name: 'Labadi Beach, La, Accra, Ghana', lat: '5.56', lon: '-0.15', name: 'Labadi Beach' },
        { place_id: 2, display_name: 'Somewhere, Lagos, Nigeria', lat: '6.5', lon: '3.4' },
      ]),
    );
    const res = await geocode('Labadi', undefined, { provider: 'nominatim', baseUrl: 'https://geo.example/', mapboxToken: null, contactEmail: 'a@b.c' });
    expect(fetchMock.mock.calls[0]![0]).toMatch(/^https:\/\/geo\.example\/search\?q=Labadi&format=jsonv2&countrycodes=gh/);
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({ label: 'Labadi Beach', place: { type: 'geocoded', lat: 5.56, lng: -0.15 } });
  });
});

describe('walking directions provider', () => {
  const cfg = { provider: 'osrm' as const, osrmUrl: 'https://osrm.example', mapboxToken: null };

  it('returns street geometry from an OSRM foot route', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      okJson({ routes: [{ distance: 420, duration: 300, geometry: { coordinates: [[-0.2, 5.6], [-0.199, 5.601], [-0.198, 5.602]] } }] }),
    );
    const r = await walkingDirections({ lat: 5.6, lng: -0.2 }, { lat: 5.602, lng: -0.198 }, undefined, cfg);
    expect(r).toEqual({ distanceM: 420, minutes: 5, geometry: [{ lat: 5.6, lng: -0.2 }, { lat: 5.601, lng: -0.199 }, { lat: 5.602, lng: -0.198 }] });
  });

  it('returns null (straight-line fallback) on failure or when not configured', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('offline'));
    expect(await walkingDirections({ lat: 5.6, lng: -0.2 }, { lat: 5.61, lng: -0.2 }, undefined, cfg)).toBeNull();
    expect(await walkingDirections({ lat: 5.6, lng: -0.2 }, { lat: 5.61, lng: -0.2 }, undefined, { ...cfg, provider: 'none' })).toBeNull();
  });
});
