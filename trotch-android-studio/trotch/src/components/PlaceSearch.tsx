import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { AppText, Badge, Banner, Card, ListRow, Section, TextField } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { searchPlaces, toPlaceRef, validateLocationQuery } from '@/features/locations/search';
import { useNetwork } from '@/features/network/NetworkProvider';
import { usePlanner } from '@/features/planner/PlannerProvider';
import { useSaved } from '@/features/saved/SavedProvider';
import { geocode, isGeocoderEnabled, type GeocodeResult } from '@/services/geo/geocoding';
import { getCurrentPosition } from '@/services/geo/location';
import type { PlaceRef } from '@/types/transport';

export function PlaceSearch({
  onPick,
  showCurrentLocation = true,
  showShortcuts = true,
  placeholder = 'Search a place, stop or landmark',
}: {
  onPick: (place: PlaceRef) => void;
  showCurrentLocation?: boolean;
  showShortcuts?: boolean;
  placeholder?: string;
}) {
  const { searchIndex } = useNetwork();
  const { recents } = usePlanner();
  const { places } = useSaved();
  const [query, setQuery] = useState('');
  const [remoteState, setRemoteState] = useState<{ query: string; results: GeocodeResult[]; error: boolean; loading: boolean } | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const validation = query.trim().length === 0 ? null : validateLocationQuery(query);
  const local = useMemo(() => (validation?.ok ? searchPlaces(searchIndex, query, 10) : []), [searchIndex, query, validation?.ok]);
  const savedMatches = useMemo(() => {
    if (!validation?.ok) return [];
    const q = query.trim().toLowerCase();
    return places.filter((p) => p.label.toLowerCase().includes(q) || p.placeName.toLowerCase().includes(q));
  }, [places, query, validation?.ok]);

  // External geocoder (optional), debounced and cancellable for slow connections.
  const trimmed = query.trim();
  useEffect(() => {
    if (!validation?.ok || !isGeocoderEnabled() || trimmed.length < 3) return;
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setRemoteState({ query: trimmed, results: [], error: false, loading: true });
      try {
        const results = await geocode(trimmed, ctrl.signal);
        setRemoteState({ query: trimmed, results, error: false, loading: false });
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setRemoteState({ query: trimmed, results: [], error: true, loading: false });
      }
    }, 450);
    return () => clearTimeout(t);
  }, [trimmed, validation?.ok]);
  // Only show remote results for the text currently typed.
  const remoteCurrent = remoteState?.query === trimmed ? remoteState : null;
  const remote = remoteCurrent?.results ?? [];
  const remoteLoading = remoteCurrent?.loading ?? false;
  const remoteError = remoteCurrent?.error ?? false;

  const pickCurrent = async () => {
    setLocError(null);
    setLocating(true);
    const res = await getCurrentPosition();
    setLocating(false);
    if (res.ok) onPick({ label: 'My location', lat: res.position.lat, lng: res.position.lng, type: 'current_location', refId: null });
    else if (res.reason !== 'cancelled') setLocError(res.message);
  };

  const recentPlaces = useMemo(() => {
    const seen = new Set<string>();
    const out: PlaceRef[] = [];
    for (const t of recents) {
      for (const p of [t.destination, t.origin]) {
        if (!seen.has(p.label)) {
          seen.add(p.label);
          out.push(p);
        }
      }
    }
    return out.slice(0, 5);
  }, [recents]);

  return (
    <View style={{ gap: spacing.lg }}>
      <TextField
        testID="place-search-input"
        label="Search"
        icon="search"
        placeholder={placeholder}
        value={query}
        onChangeText={setQuery}
        autoFocus
        autoCorrect={false}
        returnKeyType="search"
        error={validation && !validation.ok && query.trim().length >= 2 ? validation.error : null}
        hint="Try a neighbourhood, landmark, terminal or common name like “Circle” or “Legon”."
      />

      {showCurrentLocation ? (
        <Card style={{ paddingVertical: spacing.xs }}>
          <ListRow
            testID="pick-current-location"
            icon="locate"
            title={locating ? 'Finding your location…' : 'Use my current location'}
            subtitle="Only used for this search — never saved"
            onPress={pickCurrent}
            right={locating ? <ActivityIndicator color={colors.primary} /> : undefined}
          />
        </Card>
      ) : null}
      {locError ? <Banner tone="warning" message={locError} /> : null}

      {query.trim().length === 0 && showShortcuts ? (
        <>
          {places.length ? (
            <Section title="Saved places">
              <Card style={{ paddingVertical: spacing.xs }}>
                {places.map((p) => (
                  <ListRow
                    key={p.id}
                    icon={p.kind === 'home' ? 'home' : p.kind === 'work' ? 'briefcase' : p.kind === 'school' ? 'school' : 'star'}
                    title={p.label}
                    subtitle={p.placeName}
                    onPress={() => onPick({ label: p.label, lat: p.lat, lng: p.lng, type: 'saved_place', refId: p.id })}
                  />
                ))}
              </Card>
            </Section>
          ) : null}
          {recentPlaces.length ? (
            <Section title="Recent">
              <Card style={{ paddingVertical: spacing.xs }}>
                {recentPlaces.map((p) => (
                  <ListRow key={p.label} icon="time-outline" title={p.label} onPress={() => onPick(p)} />
                ))}
              </Card>
            </Section>
          ) : null}
        </>
      ) : null}

      {savedMatches.length ? (
        <Section title="Your places">
          <Card style={{ paddingVertical: spacing.xs }}>
            {savedMatches.map((p) => (
              <ListRow key={p.id} icon="bookmark" title={p.label} subtitle={p.placeName} onPress={() => onPick({ label: p.label, lat: p.lat, lng: p.lng, type: 'saved_place', refId: p.id })} />
            ))}
          </Card>
        </Section>
      ) : null}

      {validation?.ok ? (
        <Section title="In the Trotch network">
          {local.length === 0 ? (
            <AppText muted>No matching places or stops in the network yet.</AppText>
          ) : (
            <Card style={{ paddingVertical: spacing.xs }}>
              {local.map((r) => (
                <ListRow
                  key={r.key}
                  testID={`place-result-${r.name}`}
                  icon={r.type === 'stop' ? 'bus-outline' : 'location-outline'}
                  title={r.name}
                  subtitle={`${r.subtitle}${r.matchedAlias ? ` · also called “${r.matchedAlias}”` : ''}`}
                  right={r.isDemo ? <Badge label="DEMO" fg="#fff" bg={colors.primaryDark} /> : undefined}
                  onPress={() => onPick(toPlaceRef(r))}
                />
              ))}
            </Card>
          )}
        </Section>
      ) : null}

      {isGeocoderEnabled() && validation?.ok && query.trim().length >= 3 ? (
        <Section title="Other places in Ghana" action={remoteLoading ? <ActivityIndicator color={colors.primary} /> : undefined}>
          <AppText variant="caption" muted>
            From map search. A place being found doesn’t mean Trotch has a route there.
          </AppText>
          {remoteError ? <AppText variant="caption" color={colors.warning}>Map search is unavailable right now.</AppText> : null}
          {remote.length ? (
            <Card style={{ paddingVertical: spacing.xs }}>
              {remote.map((r) => (
                <ListRow key={r.id} icon="map-outline" title={r.label} subtitle={r.subtitle} onPress={() => onPick(r.place)} />
              ))}
            </Card>
          ) : null}
        </Section>
      ) : null}
    </View>
  );
}
