import type { TransportMode, VerificationStatus } from '@/types/transport';
import type { Duration, FareQuote, FareSummary } from './types';

export const MODE_LABEL: Record<TransportMode, string> = {
  trotro: 'Trotro',
  shared_taxi: 'Shared taxi',
  bus: 'Bus',
  intercity_bus: 'Intercity bus',
};

export const MODE_ARTICLE: Record<TransportMode, string> = {
  trotro: 'a trotro',
  shared_taxi: 'a shared (line) taxi',
  bus: 'a bus',
  intercity_bus: 'an intercity bus',
};

export const VERIFICATION_LABEL: Record<VerificationStatus, string> = {
  verified: 'Verified',
  community_reported: 'Community-reported',
  unverified: 'Unverified',
  outdated: 'Outdated',
  inactive: 'Inactive',
};

const hoursMinutes = (n: number) => {
  if (n < 60) return `${n} min`;
  const h = Math.floor(n / 60);
  const m = n % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
};

const roundTo = (n: number, step: number) => Math.max(step, Math.round(n / step) * step);

/**
 * Recorded durations are shown as-is (rounded to the minute).
 * Estimated durations are shown as a rounded range so they don't look falsely precise.
 */
export function formatDuration(d: Duration): string {
  if (d.quality === 'recorded') {
    return hoursMinutes(Math.max(1, Math.round(d.minutes)));
  }
  if (d.minutes < 10) return `about ${Math.max(1, Math.round(d.minutes))} min`;
  const low = roundTo(d.minutes * 0.85, 5);
  const high = roundTo(d.minutes * 1.25, 5);
  if (high >= 60) return `about ${hoursMinutes(low)}–${hoursMinutes(high)}`;
  return `about ${low}–${high} min`;
}

export function formatGhs(amount: number): string {
  return `GH₵${amount.toFixed(2).replace(/\.00$/, '')}`;
}

export function formatFareRange(min: number, max: number): string {
  return min === max ? formatGhs(min) : `${formatGhs(min)}–${formatGhs(max).replace('GH₵', '')}`;
}

export function formatFareQuote(q: FareQuote | null): string {
  if (!q) return 'Fare not yet recorded';
  return formatFareRange(q.minGhs, q.maxGhs);
}

/** Never presents a partial total as the full fare. */
export function formatFareSummary(f: FareSummary): { headline: string; note: string | null } {
  switch (f.status) {
    case 'not_applicable':
      return { headline: 'No fare', note: 'Walking only' };
    case 'complete':
      return {
        headline: formatFareRange(f.knownMinGhs, f.knownMaxGhs),
        note: f.allVerified ? null : 'Includes unverified fares',
      };
    case 'partial':
      return {
        headline: `${formatFareRange(f.knownMinGhs, f.knownMaxGhs)} + ?`,
        note: `Fare unknown for ${f.unknownLegCount} of ${f.knownLegCount + f.unknownLegCount} legs — total is incomplete`,
      };
    case 'unknown':
      return { headline: 'Fare unknown', note: 'No fares recorded for this journey yet' };
  }
}

export function formatDistance(m: number): string {
  if (m < 1000) return `${roundTo(m, 10)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export function formatRelativeDate(iso: string | null, now: Date = new Date()): string {
  if (!iso) return 'never verified';
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return 'unknown date';
  const days = Math.floor((now.getTime() - then.getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 31) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years > 1 ? 's' : ''} ago`;
}
