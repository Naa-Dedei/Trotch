import type { FareRecord, VerificationStatus } from '@/types/transport';
import type { FareQuote, FareSummary, Leg } from './types';

const VERIFICATION_RANK: Record<VerificationStatus, number> = {
  verified: 4,
  community_reported: 3,
  unverified: 2,
  outdated: 1,
  inactive: 0,
};

/** A fare applies if it is not inactive and today falls inside its effective window. */
export function isFareEffective(fare: FareRecord, today: string): boolean {
  if (fare.quality.verification === 'inactive') return false;
  if (fare.effectiveFrom && fare.effectiveFrom > today) return false;
  if (fare.effectiveTo && fare.effectiveTo < today) return false;
  return true;
}

function better(a: FareRecord, b: FareRecord): FareRecord {
  const ra = VERIFICATION_RANK[a.quality.verification];
  const rb = VERIFICATION_RANK[b.quality.verification];
  if (ra !== rb) return ra > rb ? a : b;
  const da = a.quality.lastVerifiedAt ?? a.effectiveFrom ?? '';
  const db = b.quality.lastVerifiedAt ?? b.effectiveFrom ?? '';
  return da >= db ? a : b;
}

/**
 * Find the fare for riding a route from one stop to another.
 * Prefers a fare recorded for that exact pair; falls back to a flat whole-route fare.
 * Returns null when nothing is recorded — callers must treat that as "unknown", never as free.
 */
export function quoteRideFare(
  fares: FareRecord[] | undefined,
  routeId: string,
  boardStopId: string,
  alightStopId: string,
  today: string,
): FareQuote | null {
  if (!fares || fares.length === 0) return null;
  let segment: FareRecord | null = null;
  let flat: FareRecord | null = null;
  for (const f of fares) {
    if (f.routeId !== routeId || !isFareEffective(f, today)) continue;
    if (f.fromStopId === boardStopId && f.toStopId === alightStopId) {
      segment = segment ? better(segment, f) : f;
    } else if (f.fromStopId === null && f.toStopId === null) {
      flat = flat ? better(flat, f) : f;
    }
  }
  const chosen = segment ?? flat;
  if (!chosen) return null;
  return {
    minGhs: chosen.minGhs,
    maxGhs: chosen.maxGhs,
    basis: segment ? 'segment' : 'route_flat',
    verification: chosen.quality.verification,
    lastVerifiedAt: chosen.quality.lastVerifiedAt,
    sourceId: chosen.quality.sourceId,
    isDemo: chosen.quality.isDemo,
    fareId: chosen.id,
  };
}

const roundMoney = (n: number) => Math.round(n * 100) / 100;

/** Combine per-leg fares into a journey total. Unknown legs make the total incomplete. */
export function summariseFares(legs: Leg[]): FareSummary {
  let knownMin = 0;
  let knownMax = 0;
  let known = 0;
  let unknown = 0;
  let allVerified = true;
  for (const leg of legs) {
    if (leg.kind !== 'ride') continue;
    if (leg.fare) {
      known += 1;
      knownMin += leg.fare.minGhs;
      knownMax += leg.fare.maxGhs;
      if (leg.fare.verification !== 'verified') allVerified = false;
    } else {
      unknown += 1;
      allVerified = false;
    }
  }
  const rides = known + unknown;
  let status: FareSummary['status'];
  if (rides === 0) status = 'not_applicable';
  else if (unknown === 0) status = 'complete';
  else if (known === 0) status = 'unknown';
  else status = 'partial';
  return {
    status,
    knownMinGhs: roundMoney(knownMin),
    knownMaxGhs: roundMoney(knownMax),
    knownLegCount: known,
    unknownLegCount: unknown,
    allVerified: rides > 0 && allVerified,
  };
}
