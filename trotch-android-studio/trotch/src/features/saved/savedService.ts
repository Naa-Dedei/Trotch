import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Journey } from '@/features/routing/types';
import type { PlaceRef } from '@/types/transport';

export class AuthRequiredError extends Error {
  constructor(action = 'save items') {
    super(`Sign in to ${action}.`);
    this.name = 'AuthRequiredError';
  }
}

const placeRefSchema = z.object({
  label: z.string(),
  lat: z.number(),
  lng: z.number(),
  type: z.enum(['location', 'stop', 'geocoded', 'current_location', 'saved_place']),
  refId: z.string().nullable().optional(),
});

const journeySchema = z.custom<Journey>(
  (v) => !!v && typeof v === 'object' && Array.isArray((v as Journey).legs) && typeof (v as Journey).duration === 'object',
  'Invalid saved journey',
);

export const savedPlaceKinds = ['home', 'school', 'work', 'custom'] as const;
export type SavedPlaceKind = (typeof savedPlaceKinds)[number];

const savedPlaceRow = z.object({
  id: z.string(),
  kind: z.enum(savedPlaceKinds),
  label: z.string(),
  place_name: z.string(),
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  location_id: z.string().nullable(),
  stop_id: z.string().nullable(),
});
export interface SavedPlace {
  id: string;
  kind: SavedPlaceKind;
  label: string;
  placeName: string;
  lat: number;
  lng: number;
  locationId: string | null;
  stopId: string | null;
}

const savedRouteRow = z.object({ id: z.string(), route_id: z.string(), nickname: z.string().nullable() });
export interface SavedRoute {
  id: string;
  routeId: string;
  nickname: string | null;
}

const savedJourneyRow = z.object({
  id: z.string(),
  name: z.string(),
  origin: placeRefSchema,
  destination: placeRefSchema,
  journey: journeySchema,
  created_at: z.string(),
});
export interface SavedJourney {
  id: string;
  name: string;
  origin: PlaceRef;
  destination: PlaceRef;
  journey: Journey;
  createdAt: string;
}

const recentRow = z.object({ id: z.string(), origin: placeRefSchema, destination: placeRefSchema, created_at: z.string() });
export interface RecentSearch {
  id: string;
  origin: PlaceRef;
  destination: PlaceRef;
  createdAt: string;
}

export const savedPlaceInputSchema = z.object({
  kind: z.enum(savedPlaceKinds),
  label: z.string().trim().min(1, 'Give this place a name').max(60, 'Keep the name under 60 characters'),
  place: placeRefSchema,
});
export type SavedPlaceInput = z.input<typeof savedPlaceInputSchema>;

export const journeyNameSchema = z.string().trim().min(1, 'Give the journey a name').max(80, 'Keep the name under 80 characters');

/** Strip device-location coordinates before anything is persisted server-side. */
export function isPersistablePlace(p: PlaceRef): boolean {
  return p.type !== 'current_location';
}

/**
 * All saved-item operations. Every method requires a signed-in user and relies on RLS
 * so a user can only ever touch their own rows.
 */
export function createSavedService(client: SupabaseClient | null, userId: string | null) {
  const need = (action?: string) => {
    if (!client || !userId) throw new AuthRequiredError(action);
    return client;
  };
  const check = <T>(res: { data: T; error: unknown }) => {
    if (res.error) throw res.error;
    return res.data;
  };

  return {
    isSignedIn: !!client && !!userId,

    async listPlaces(): Promise<SavedPlace[]> {
      const rows = check(await need().from('saved_places').select('id, kind, label, place_name, lat, lng, location_id, stop_id').order('created_at'));
      return z.array(savedPlaceRow).parse(rows).map((r) => ({
        id: r.id, kind: r.kind, label: r.label, placeName: r.place_name, lat: r.lat, lng: r.lng, locationId: r.location_id, stopId: r.stop_id,
      }));
    },

    async savePlace(input: SavedPlaceInput): Promise<void> {
      const sb = need('save places');
      const v = savedPlaceInputSchema.parse(input);
      check(
        await sb.from('saved_places').insert({
          user_id: userId,
          kind: v.kind,
          label: v.label,
          place_name: v.place.label,
          lat: v.place.lat,
          lng: v.place.lng,
          location_id: v.place.type === 'location' ? (v.place.refId ?? null) : null,
          stop_id: v.place.type === 'stop' ? (v.place.refId ?? null) : null,
        }),
      );
    },

    async renamePlace(id: string, label: string): Promise<void> {
      const clean = savedPlaceInputSchema.shape.label.parse(label);
      check(await need().from('saved_places').update({ label: clean }).eq('id', id));
    },

    async deletePlace(id: string): Promise<void> {
      check(await need().from('saved_places').delete().eq('id', id));
    },

    async listRoutes(): Promise<SavedRoute[]> {
      const rows = check(await need().from('saved_routes').select('id, route_id, nickname').order('created_at'));
      return z.array(savedRouteRow).parse(rows).map((r) => ({ id: r.id, routeId: r.route_id, nickname: r.nickname }));
    },

    async favouriteRoute(routeId: string, nickname: string | null = null): Promise<void> {
      check(await need('save favourite routes').from('saved_routes').insert({ user_id: userId, route_id: routeId, nickname }));
    },

    async renameRoute(id: string, nickname: string): Promise<void> {
      const clean = nickname.trim().slice(0, 60) || null;
      check(await need().from('saved_routes').update({ nickname: clean }).eq('id', id));
    },

    async unfavouriteRoute(id: string): Promise<void> {
      check(await need().from('saved_routes').delete().eq('id', id));
    },

    async listJourneys(): Promise<SavedJourney[]> {
      const rows = check(
        await need().from('saved_journeys').select('id, name, origin, destination, journey, created_at').order('created_at', { ascending: false }),
      );
      return z.array(savedJourneyRow).parse(rows).map((r) => ({
        id: r.id, name: r.name, origin: r.origin, destination: r.destination, journey: r.journey, createdAt: r.created_at,
      }));
    },

    async saveJourney(name: string, journey: Journey): Promise<string> {
      const sb = need('save journeys');
      const clean = journeyNameSchema.parse(name);
      // A journey starting from "my location" is saved under a neutral label without device coordinates.
      const sanitise = (p: PlaceRef): PlaceRef =>
        isPersistablePlace(p) ? p : { ...p, label: 'Your location at the time', type: 'geocoded' };
      const data = check(
        await sb
          .from('saved_journeys')
          .insert({ user_id: userId, name: clean, origin: sanitise(journey.origin), destination: sanitise(journey.destination), journey })
          .select('id')
          .single(),
      ) as { id: string };
      return data.id;
    },

    async renameJourney(id: string, name: string): Promise<void> {
      check(await need().from('saved_journeys').update({ name: journeyNameSchema.parse(name) }).eq('id', id));
    },

    async deleteJourney(id: string): Promise<void> {
      check(await need().from('saved_journeys').delete().eq('id', id));
    },

    async listRecent(): Promise<RecentSearch[]> {
      const rows = check(await need().from('recent_searches').select('id, origin, destination, created_at').order('created_at', { ascending: false }).limit(20));
      return z.array(recentRow).parse(rows).map((r) => ({ id: r.id, origin: r.origin, destination: r.destination, createdAt: r.created_at }));
    },

    /** Returns false (and stores nothing) if either end is the device's current location. */
    async addRecent(origin: PlaceRef, destination: PlaceRef): Promise<boolean> {
      if (!isPersistablePlace(origin) || !isPersistablePlace(destination)) return false;
      check(await need().from('recent_searches').insert({ user_id: userId, origin, destination }));
      return true;
    },

    async clearRecent(): Promise<void> {
      check(await need().from('recent_searches').delete().eq('user_id', userId!));
    },
  };
}

export type SavedService = ReturnType<typeof createSavedService>;
