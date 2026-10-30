import { z } from 'zod';
import type { LatLng, PlaceLocation, PlaceRef, Stop } from '@/types/transport';

export const locationQuerySchema = z
  .string()
  .transform((s) => s.replace(/\s+/g, ' ').trim())
  .pipe(
    z
      .string()
      .min(2, 'Type at least 2 characters')
      .max(80, 'That search is too long')
      .refine((s) => !/[\u0000-\u001f\u007f<>{}]/.test(s), 'Remove unusual characters from your search'),
  );

export type QueryValidation = { ok: true; query: string } | { ok: false; error: string };

export function validateLocationQuery(raw: string): QueryValidation {
  const parsed = locationQuerySchema.safeParse(raw);
  if (parsed.success) return { ok: true, query: parsed.data };
  return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid search' };
}

/** Lower-case, strip accents and punctuation so "Kwame Nkrumah Circle" ~ "kwame-nkrumah circle". */
export function normalise(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface SearchablePlace extends LatLng {
  key: string;
  refId: string;
  type: 'location' | 'stop' | 'saved_place';
  name: string;
  subtitle: string;
  aliases: string[];
  isDemo: boolean;
}

export interface PlaceSearchResult extends SearchablePlace {
  score: number;
  /** The name or alias that matched, if it wasn't the primary name. */
  matchedAlias: string | null;
}

const STOP_KIND_LABEL: Record<Stop['kind'], string> = {
  terminal: 'Terminal',
  station: 'Station',
  roadside: 'Roadside stop',
  landmark: 'Landmark stop',
};

const LOCATION_KIND_LABEL: Record<PlaceLocation['kind'], string> = {
  neighbourhood: 'Neighbourhood',
  landmark: 'Landmark',
  terminal: 'Terminal',
  institution: 'Institution',
  market: 'Market',
  junction: 'Junction',
};

export function buildSearchIndex(locations: PlaceLocation[], stops: Stop[]): SearchablePlace[] {
  const out: SearchablePlace[] = [];
  for (const l of locations) {
    out.push({
      key: `location:${l.id}`,
      refId: l.id,
      type: 'location',
      name: l.name,
      subtitle: LOCATION_KIND_LABEL[l.kind],
      aliases: l.aliases,
      lat: l.lat,
      lng: l.lng,
      isDemo: l.isDemo,
    });
  }
  for (const s of stops) {
    if (!s.isActive) continue;
    out.push({
      key: `stop:${s.id}`,
      refId: s.id,
      type: 'stop',
      name: s.name,
      subtitle: STOP_KIND_LABEL[s.kind],
      aliases: s.aliases,
      lat: s.lat,
      lng: s.lng,
      isDemo: s.quality.isDemo,
    });
  }
  return out;
}

function scoreText(q: string, text: string): number {
  const t = normalise(text);
  if (!t) return 0;
  if (t === q) return 100;
  if (t.startsWith(q)) return 85;
  if (t.split(' ').some((w) => w.startsWith(q))) return 70;
  // Every query word appears at the start of some word ("uni ghana" → "University of Ghana").
  const qWords = q.split(' ');
  const tWords = t.split(' ');
  if (qWords.length > 1 && qWords.every((qw) => tWords.some((tw) => tw.startsWith(qw)))) return 65;
  if (t.includes(q)) return 50;
  return 0;
}

/** Search names and aliases. Returns [] for invalid queries — call validateLocationQuery for the message. */
export function searchPlaces(index: SearchablePlace[], rawQuery: string, limit = 8): PlaceSearchResult[] {
  const v = validateLocationQuery(rawQuery);
  if (!v.ok) return [];
  const q = normalise(v.query);
  if (q.length < 2) return [];
  const results: PlaceSearchResult[] = [];
  for (const p of index) {
    let score = scoreText(q, p.name);
    let matchedAlias: string | null = null;
    for (const a of p.aliases) {
      const s = scoreText(q, a) - 3; // primary names win ties
      if (s > score) {
        score = s;
        matchedAlias = a;
      }
    }
    if (score <= 0) continue;
    // Prefer places (neighbourhoods, landmarks) over individual stops on ties.
    if (p.type === 'location') score += 2;
    if (p.type === 'saved_place') score += 4;
    results.push({ ...p, score, matchedAlias });
  }
  results.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  // De-duplicate identical names at the same spot (e.g. a location and its terminal stop).
  const seen = new Set<string>();
  const unique: PlaceSearchResult[] = [];
  for (const r of results) {
    const k = `${normalise(r.name)}@${r.lat.toFixed(3)},${r.lng.toFixed(3)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(r);
    if (unique.length >= limit) break;
  }
  return unique;
}

export function toPlaceRef(p: SearchablePlace): PlaceRef {
  return { label: p.name, lat: p.lat, lng: p.lng, type: p.type, refId: p.refId };
}
