import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { AuthRequiredError } from '@/features/saved/savedService';

export const reportTypes = ['stop_location', 'route_info', 'fare_change', 'missing_route', 'other'] as const;
export type ReportType = (typeof reportTypes)[number];

export const REPORT_TYPE_LABEL: Record<ReportType, string> = {
  stop_location: 'Stop is in the wrong place',
  route_info: 'Route information is wrong',
  fare_change: 'Fare has changed',
  missing_route: 'A route is missing',
  other: 'Something else',
};

const money = z
  .string()
  .trim()
  .transform((s) => (s === '' ? null : Number(s.replace(',', '.'))))
  .refine((n) => n === null || (Number.isFinite(n) && n >= 0 && n <= 10000), 'Enter an amount in cedis, e.g. 8 or 8.50');

export const reportFormSchema = z
  .object({
    type: z.enum(reportTypes),
    description: z.string().trim().min(10, 'Please describe the problem in at least 10 characters').max(1000, 'Keep it under 1000 characters'),
    routeId: z.string().uuid().nullable(),
    stopId: z.string().uuid().nullable(),
    suggestedMin: money,
    suggestedMax: money,
  })
  .refine((v) => v.suggestedMin === null || v.suggestedMax === null || v.suggestedMax >= v.suggestedMin, {
    message: 'Maximum fare must be at least the minimum',
    path: ['suggestedMax'],
  });

export type ReportFormInput = z.input<typeof reportFormSchema>;

export async function submitReport(
  client: SupabaseClient | null,
  userId: string | null,
  input: ReportFormInput,
  context: Record<string, unknown> | null = null,
): Promise<void> {
  if (!client || !userId) throw new AuthRequiredError('report a problem');
  const v = reportFormSchema.parse(input);
  const { error } = await client.from('route_reports').insert({
    user_id: userId,
    report_type: v.type,
    route_id: v.routeId,
    stop_id: v.stopId,
    description: v.description,
    suggested_min_ghs: v.suggestedMin,
    suggested_max_ghs: v.suggestedMax,
    journey_context: context,
  });
  if (error) throw error;
}
