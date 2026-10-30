import { z } from 'zod';
import type { TransportNetwork } from '@/types/transport';

const verification = z.enum(['verified', 'community_reported', 'unverified', 'outdated', 'inactive']);
const mode = z.enum(['trotro', 'shared_taxi', 'bus', 'intercity_bus']);
const num = z.coerce.number().refine(Number.isFinite, 'Expected a finite number');
const nullableNum = z.union([z.null(), num]);

const quality = z.object({
  verification,
  lastVerifiedAt: z.string().nullable(),
  sourceId: z.string().nullable(),
  isDemo: z.boolean(),
});

const stop = z.object({
  id: z.string(),
  cityId: z.string(),
  name: z.string(),
  kind: z.enum(['terminal', 'station', 'roadside', 'landmark']),
  lat: num,
  lng: num,
  aliases: z.array(z.string()).default([]),
  landmarkHint: z.string().nullable(),
  isActive: z.boolean(),
  quality,
});

const route = z.object({
  id: z.string(),
  cityId: z.string(),
  code: z.string().nullable(),
  name: z.string(),
  mode,
  headsign: z.string(),
  callOut: z.string().nullable(),
  typicalWaitMin: nullableNum,
  stops: z.array(z.object({ stopId: z.string(), minutesFromPrevious: nullableNum })),
  path: z.array(z.tuple([num, num])).nullable().catch(null),
  isActive: z.boolean(),
  notes: z.string().nullable(),
  quality,
});

const fare = z.object({
  id: z.string(),
  routeId: z.string(),
  fromStopId: z.string().nullable(),
  toStopId: z.string().nullable(),
  minGhs: num,
  maxGhs: num,
  effectiveFrom: z.string().nullable(),
  effectiveTo: z.string().nullable(),
  quality,
});

const location = z.object({
  id: z.string(),
  cityId: z.string(),
  name: z.string(),
  kind: z.enum(['neighbourhood', 'landmark', 'terminal', 'institution', 'market', 'junction']),
  lat: num,
  lng: num,
  aliases: z.array(z.string()).default([]),
  description: z.string().nullable(),
  isDemo: z.boolean(),
});

const source = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(['field_survey', 'operator', 'official', 'community', 'demo']),
  url: z.string().nullable(),
  isDemo: z.boolean(),
});

export const networkSchema = z.object({
  stops: z.array(stop),
  routes: z.array(route),
  fares: z.array(fare),
  locations: z.array(location),
  sources: z.array(source),
});

export function parseNetwork(input: unknown): TransportNetwork {
  return networkSchema.parse(input);
}
