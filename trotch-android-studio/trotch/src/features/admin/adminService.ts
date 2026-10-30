import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { isInGhana } from '@/lib/geo';

/**
 * Staff-only data management. Every write is enforced server-side by RLS
 * (public.is_network_editor()); the client checks are only for good error messages.
 */

const verification = z.enum(['verified', 'community_reported', 'unverified', 'outdated', 'inactive']);
const coord = (min: number, max: number, label: string) =>
  z.coerce.number({ message: `${label} must be a number` }).min(min, `${label} out of range`).max(max, `${label} out of range`);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep it under ${max} characters`)
    .transform((s) => (s === '' ? null : s));

export const stopFormSchema = z
  .object({
    cityId: z.string().trim().regex(/^[a-z0-9-]{2,40}$/, 'Invalid city id'),
    name: z.string().trim().min(2, 'Name is too short').max(120),
    kind: z.enum(['terminal', 'station', 'roadside', 'landmark']),
    lat: coord(-90, 90, 'Latitude'),
    lng: coord(-180, 180, 'Longitude'),
    landmarkHint: optionalText(300),
    aliases: z.string().transform((s) => [...new Set(s.split(',').map((a) => a.trim()).filter(Boolean))]),
    verification,
    isActive: z.boolean(),
    isDemo: z.boolean(),
    markVerifiedNow: z.boolean(),
  })
  .refine((v) => isInGhana(v), { message: 'Coordinates must be in Ghana', path: ['lat'] });
export type StopFormInput = z.input<typeof stopFormSchema>;

export const routeFormSchema = z.object({
  cityId: z.string().trim().regex(/^[a-z0-9-]{2,40}$/, 'Invalid city id'),
  name: z.string().trim().min(2, 'Name is too short').max(120),
  code: optionalText(20),
  mode: z.enum(['trotro', 'shared_taxi', 'bus', 'intercity_bus']),
  headsign: z.string().trim().min(1, 'Headsign is required').max(80),
  callOut: optionalText(80),
  typicalWaitMin: z
    .string()
    .trim()
    .transform((s) => (s === '' ? null : Number(s)))
    .refine((n) => n === null || (Number.isInteger(n) && n >= 0 && n <= 240), 'Wait must be 0–240 minutes'),
  notes: optionalText(1000),
  verification,
  isActive: z.boolean(),
  isDemo: z.boolean(),
  markVerifiedNow: z.boolean(),
});
export type RouteFormInput = z.input<typeof routeFormSchema>;

export const routeStopsSchema = z
  .array(
    z.object({
      stopId: z.string().uuid(),
      minutes: z
        .string()
        .trim()
        .transform((s) => (s === '' ? null : Number(s)))
        .refine((n) => n === null || (Number.isFinite(n) && n >= 0 && n <= 600), 'Minutes must be 0–600'),
    }),
  )
  .min(2, 'A route needs at least two stops');

export const fareFormSchema = z
  .object({
    fromStopId: z.string().uuid().nullable(),
    toStopId: z.string().uuid().nullable(),
    min: z.coerce.number({ message: 'Enter a fare' }).min(0).max(10000),
    max: z.coerce.number({ message: 'Enter a fare' }).min(0).max(10000),
    effectiveFrom: z
      .string()
      .trim()
      .transform((s) => (s === '' ? null : s))
      .refine((s) => s === null || /^\d{4}-\d{2}-\d{2}$/.test(s), 'Use YYYY-MM-DD'),
    verification,
    isDemo: z.boolean(),
  })
  .refine((v) => v.max >= v.min, { message: 'Max must be at least min', path: ['max'] })
  .refine((v) => (v.fromStopId === null) === (v.toStopId === null), { message: 'Choose both stops, or neither for a whole-route fare', path: ['toStopId'] });
export type FareFormInput = z.input<typeof fareFormSchema>;

export const reportStatuses = ['open', 'in_review', 'resolved', 'rejected'] as const;
export type ReportStatus = (typeof reportStatuses)[number];

const reportRow = z.object({
  id: z.string(),
  report_type: z.string(),
  route_id: z.string().nullable(),
  stop_id: z.string().nullable(),
  description: z.string(),
  suggested_min_ghs: z.coerce.number().nullable(),
  suggested_max_ghs: z.coerce.number().nullable(),
  journey_context: z.unknown().nullable(),
  status: z.enum(reportStatuses),
  reviewer_notes: z.string().nullable(),
  created_at: z.string(),
});
export type AdminReport = z.infer<typeof reportRow>;

export class NotStaffError extends Error {
  constructor() {
    super('Only network editors can do this.');
    this.name = 'NotStaffError';
  }
}

export function createAdminService(client: SupabaseClient | null, isStaff: boolean) {
  const sb = () => {
    if (!client || !isStaff) throw new NotStaffError();
    return client;
  };
  const ok = <T>(res: { data: T; error: unknown }) => {
    if (res.error) throw res.error;
    return res.data;
  };
  const now = () => new Date().toISOString();

  return {
    async saveStop(id: string | null, input: StopFormInput): Promise<string> {
      const v = stopFormSchema.parse(input);
      const row = {
        city_id: v.cityId,
        name: v.name,
        kind: v.kind,
        lat: v.lat,
        lng: v.lng,
        landmark_hint: v.landmarkHint,
        verification_status: v.verification,
        is_active: v.isActive,
        is_demo: v.isDemo,
        ...(v.markVerifiedNow ? { last_verified_at: now() } : {}),
      };
      const saved = id
        ? (ok(await sb().from('stops').update(row).eq('id', id).select('id').single()) as { id: string })
        : (ok(await sb().from('stops').insert(row).select('id').single()) as { id: string });
      ok(await sb().from('stop_aliases').delete().eq('stop_id', saved.id));
      if (v.aliases.length) ok(await sb().from('stop_aliases').insert(v.aliases.map((alias) => ({ stop_id: saved.id, alias }))));
      return saved.id;
    },

    async saveRoute(id: string | null, input: RouteFormInput): Promise<string> {
      const v = routeFormSchema.parse(input);
      const row = {
        city_id: v.cityId,
        name: v.name,
        code: v.code,
        mode: v.mode,
        headsign: v.headsign,
        call_out: v.callOut,
        typical_wait_min: v.typicalWaitMin,
        notes: v.notes,
        verification_status: v.verification,
        is_active: v.isActive,
        is_demo: v.isDemo,
        ...(v.markVerifiedNow ? { last_verified_at: now() } : {}),
      };
      const saved = id
        ? (ok(await sb().from('routes').update(row).eq('id', id).select('id').single()) as { id: string })
        : (ok(await sb().from('routes').insert(row).select('id').single()) as { id: string });
      return saved.id;
    },

    async replaceRouteStops(routeId: string, stops: z.input<typeof routeStopsSchema>): Promise<void> {
      const v = routeStopsSchema.parse(stops);
      ok(
        await sb().rpc('replace_route_stops', {
          p_route_id: routeId,
          p_stops: v.map((s, i) => ({ stopId: s.stopId, minutesFromPrevious: i === 0 ? null : s.minutes })),
        }),
      );
    },

    /** Store a drawn path. Pass null to clear it (the app then draws straight stop-to-stop lines). */
    async setRoutePath(routeId: string, coordinates: [number, number][] | null): Promise<void> {
      const path = coordinates && coordinates.length >= 2 ? { type: 'LineString', coordinates } : null;
      ok(await sb().from('routes').update({ path_geojson: path }).eq('id', routeId));
    },

    async addFare(routeId: string, input: FareFormInput): Promise<void> {
      const v = fareFormSchema.parse(input);
      ok(
        await sb().from('fares').insert({
          route_id: routeId,
          from_stop_id: v.fromStopId,
          to_stop_id: v.toStopId,
          min_ghs: v.min,
          max_ghs: v.max,
          effective_from: v.effectiveFrom,
          verification_status: v.verification,
          is_demo: v.isDemo,
          last_verified_at: v.verification === 'verified' ? now() : null,
        }),
      );
    },

    /** Retire a fare by ending its effective period (keeps history), or delete it outright. */
    async retireFare(fareId: string): Promise<void> {
      const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
      ok(await sb().from('fares').update({ effective_to: yesterday, verification_status: 'outdated' }).eq('id', fareId));
    },

    async deleteFare(fareId: string): Promise<void> {
      ok(await sb().from('fares').delete().eq('id', fareId));
    },

    async listReports(status: ReportStatus | 'all'): Promise<AdminReport[]> {
      let q = sb()
        .from('route_reports')
        .select('id, report_type, route_id, stop_id, description, suggested_min_ghs, suggested_max_ghs, journey_context, status, reviewer_notes, created_at')
        .order('created_at', { ascending: false })
        .limit(100);
      if (status !== 'all') q = q.eq('status', status);
      return z.array(reportRow).parse(ok(await q));
    },

    async reviewReport(id: string, status: ReportStatus, notes: string): Promise<void> {
      ok(await sb().rpc('review_report', { p_report_id: id, p_status: status, p_notes: notes }));
    },
  };
}

export type AdminService = ReturnType<typeof createAdminService>;
