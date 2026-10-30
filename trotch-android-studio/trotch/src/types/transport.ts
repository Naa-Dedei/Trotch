/**
 * Core transport domain types shared by the routing engine, data layer and UI.
 * These are deliberately framework-free so the routing engine can run in tests
 * and (with a cached network) without connectivity.
 */

export type TransportMode = 'trotro' | 'shared_taxi' | 'bus' | 'intercity_bus';

export type StopKind = 'terminal' | 'station' | 'roadside' | 'landmark';

export type LocationKind = 'neighbourhood' | 'landmark' | 'terminal' | 'institution' | 'market' | 'junction';

export type VerificationStatus = 'verified' | 'community_reported' | 'unverified' | 'outdated' | 'inactive';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface DataQuality {
  verification: VerificationStatus;
  /** ISO date string of the last time a person checked this record. */
  lastVerifiedAt: string | null;
  sourceId: string | null;
  /** True for fictional/illustrative records used to demonstrate the app. */
  isDemo: boolean;
}

export interface Stop extends LatLng {
  id: string;
  cityId: string;
  name: string;
  kind: StopKind;
  aliases: string[];
  /** Plain-language help for finding the boarding point, e.g. "Opposite the Shell filling station". */
  landmarkHint: string | null;
  isActive: boolean;
  quality: DataQuality;
}

export interface RouteStop {
  stopId: string;
  /** Minutes travelled from the previous stop on this route. null = unknown. First stop is always null. */
  minutesFromPrevious: number | null;
}

export interface TransportRoute {
  id: string;
  cityId: string;
  /** Many trotro routes have no official number. */
  code: string | null;
  name: string;
  mode: TransportMode;
  /** Text shown on the vehicle / called by the mate, e.g. "Madina". */
  headsign: string;
  /** What the mate typically shouts, if known, e.g. "Madina! Madina!". */
  callOut: string | null;
  /** Typical waiting time to board in minutes, if known. */
  typicalWaitMin: number | null;
  /** Ordered stops. Routes are directional: the reverse journey is a separate route. */
  stops: RouteStop[];
  /** Optional drawn path [lng, lat][] (GeoJSON order). Falls back to straight stop-to-stop lines. */
  path: [number, number][] | null;
  isActive: boolean;
  quality: DataQuality;
  notes: string | null;
}

export interface FareRecord {
  id: string;
  routeId: string;
  /** null/null = flat fare for the whole route. Otherwise a fare for this exact boarding/alighting pair. */
  fromStopId: string | null;
  toStopId: string | null;
  minGhs: number;
  maxGhs: number;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  quality: DataQuality;
}

export interface PlaceLocation extends LatLng {
  id: string;
  cityId: string;
  name: string;
  kind: LocationKind;
  aliases: string[];
  description: string | null;
  isDemo: boolean;
}

export interface DataSource {
  id: string;
  name: string;
  kind: 'field_survey' | 'operator' | 'official' | 'community' | 'demo';
  url: string | null;
  isDemo: boolean;
}

export interface TransportNetwork {
  stops: Stop[];
  routes: TransportRoute[];
  fares: FareRecord[];
  locations: PlaceLocation[];
  sources: DataSource[];
}

/** A place the user picked as origin or destination. */
export interface PlaceRef extends LatLng {
  label: string;
  /** Where this place came from. Current-location coordinates are never persisted in history. */
  type: 'location' | 'stop' | 'geocoded' | 'current_location' | 'saved_place';
  refId?: string | null;
}
