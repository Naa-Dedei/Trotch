import type {
  FareRecord,
  LatLng,
  PlaceRef,
  Stop,
  TransportMode,
  TransportRoute,
  VerificationStatus,
} from '@/types/transport';

export type DurationQuality = 'recorded' | 'estimated';

export interface Duration {
  minutes: number;
  quality: DurationQuality;
}

export interface FareQuote {
  minGhs: number;
  maxGhs: number;
  /** 'segment' = fare recorded for this exact boarding/alighting pair; 'route_flat' = one fare for the whole route. */
  basis: 'segment' | 'route_flat';
  verification: VerificationStatus;
  lastVerifiedAt: string | null;
  sourceId: string | null;
  isDemo: boolean;
  fareId: string;
}

export interface WalkLeg {
  kind: 'walk';
  from: PlaceRef;
  to: PlaceRef;
  /** Stop id at either end, when the endpoint is a stop. */
  fromStopId: string | null;
  toStopId: string | null;
  distanceM: number;
  duration: Duration;
  /** Straight-line based estimate unless replaced by a walking-directions provider. */
  geometry: LatLng[];
}

export interface RideLeg {
  kind: 'ride';
  mode: TransportMode;
  routeId: string;
  routeName: string;
  routeCode: string | null;
  headsign: string;
  callOut: string | null;
  boardStopId: string;
  alightStopId: string;
  /** Stop ids strictly between boarding and alighting, in travel order. */
  intermediateStopIds: string[];
  /** Index of the boarding/alighting stop in the route's ordered stop list. */
  boardIndex: number;
  alightIndex: number;
  inVehicle: Duration;
  /** Typical wait to board, only when the route records it. */
  waitMin: number | null;
  distanceM: number;
  fare: FareQuote | null;
  routeVerification: VerificationStatus;
  routeIsDemo: boolean;
  geometry: LatLng[];
}

export type Leg = WalkLeg | RideLeg;

export type FareStatus = 'complete' | 'partial' | 'unknown' | 'not_applicable';

export interface FareSummary {
  status: FareStatus;
  /** Sum of the known legs only. Unknown legs are never treated as free. */
  knownMinGhs: number;
  knownMaxGhs: number;
  knownLegCount: number;
  unknownLegCount: number;
  /** True only if every ride leg has a verified fare. */
  allVerified: boolean;
}

export type JourneyTag = 'recommended' | 'fastest' | 'lowest_fare' | 'fewest_transfers';

export interface Journey {
  id: string;
  origin: PlaceRef;
  destination: PlaceRef;
  legs: Leg[];
  duration: Duration;
  fare: FareSummary;
  transfers: number;
  walkingMeters: number;
  /** Generalised cost used for ranking (minutes-equivalent). */
  cost: number;
  tags: JourneyTag[];
  /** True if any part relies on demo/unverified/outdated data. */
  hasUnverifiedData: boolean;
  hasDemoData: boolean;
  /** Stable signature used to de-duplicate alternatives. */
  signature: string;
}

export interface RoutingWeights {
  /** Cost multiplier per walking minute. */
  walk: number;
  /** Cost multiplier per waiting minute. */
  wait: number;
  /** Cost multiplier per in-vehicle minute. */
  inVehicle: number;
  /** Fixed penalty (minutes-equivalent) for each transfer. */
  transferPenaltyMin: number;
}

export interface PlannerOptions {
  weights: RoutingWeights;
  /** Max walk from origin to first stop, and from last stop to destination. */
  maxAccessWalkM: number;
  /** Max walk between two stops when transferring. */
  maxTransferWalkM: number;
  /** Max walk for a walking-only journey. */
  maxDirectWalkM: number;
  maxTransfers: number;
  maxAlternatives: number;
  walkSpeedKmh: number;
  /** Straight-line distance is multiplied by this to approximate real streets. */
  walkDetourFactor: number;
  roadDetourFactor: number;
  /** Used for ranking only when a route has no recorded wait. Never displayed as fact. */
  assumedWaitMin: Record<TransportMode, number>;
  /** Used to estimate in-vehicle time when hop times are missing. Results are flagged as estimated. */
  fallbackSpeedKmh: Record<TransportMode, number>;
  /** Today's date (YYYY-MM-DD) for fare effective-date checks. */
  today: string;
  excludedRouteIds: string[];
}

export type PlanFailureReason =
  | 'same_place'
  | 'no_origin_stops'
  | 'no_destination_stops'
  | 'no_connection'
  | 'empty_network';

export type PlanResult =
  | { status: 'ok'; journeys: Journey[] }
  | { status: 'no_route'; reason: PlanFailureReason; message: string };

export interface NetworkIndex {
  stopsById: Map<string, Stop>;
  routesById: Map<string, TransportRoute>;
  faresByRoute: Map<string, FareRecord[]>;
}
