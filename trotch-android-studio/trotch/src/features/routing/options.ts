import type { PlannerOptions, RoutingWeights } from './types';

export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const DEFAULT_WEIGHTS: RoutingWeights = {
  walk: 1.6,
  wait: 1.3,
  inVehicle: 1.0,
  transferPenaltyMin: 8,
};

export type PlannerOverrides = Partial<Omit<PlannerOptions, 'weights'>> & { weights?: Partial<RoutingWeights> };

export function defaultPlannerOptions(overrides: PlannerOverrides = {}): PlannerOptions {
  const { weights, ...rest } = overrides;
  return {
    maxAccessWalkM: 1200,
    maxTransferWalkM: 500,
    maxDirectWalkM: 1500,
    maxTransfers: 2,
    maxAlternatives: 3,
    walkSpeedKmh: 4.5,
    walkDetourFactor: 1.3,
    roadDetourFactor: 1.35,
    assumedWaitMin: { trotro: 8, shared_taxi: 5, bus: 15, intercity_bus: 30 },
    // Conservative Accra urban speeds incl. congestion; used only when hop times are missing.
    fallbackSpeedKmh: { trotro: 16, shared_taxi: 18, bus: 15, intercity_bus: 45 },
    today: todayIso(),
    excludedRouteIds: [],
    ...rest,
    weights: { ...DEFAULT_WEIGHTS, ...weights },
  };
}
