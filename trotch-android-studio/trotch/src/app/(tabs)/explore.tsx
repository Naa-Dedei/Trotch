import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DataStatusBanner } from '@/components/DataStatusBanner';
import { MapFab, TransitMap, type TransitMapHandle } from '@/components/map/TransitMap';
import { AppText, Banner, Button, Chip, ListRow, LoadingState, QualityBadge, Row, TextField } from '@/components/ui';
import { colors, modeStyle, radius, spacing } from '@/constants/theme';
import { routeOverlay } from '@/features/map/journeyOverlays';
import { normalise } from '@/features/locations/search';
import { useNetwork } from '@/features/network/NetworkProvider';
import { modesAtStop, servicesAtStop, stopsNear } from '@/features/network/queries';
import { formatDistance, formatRelativeDate, MODE_LABEL } from '@/features/routing/format';
import { getCurrentPosition } from '@/services/geo/location';
import type { LatLng, TransportMode } from '@/types/transport';

type ModeFilter = 'all' | TransportMode;
const MODES: ModeFilter[] = ['all', 'trotro', 'shared_taxi', 'bus', 'intercity_bus'];

export default function ExploreScreen() {
  const { loaded, status } = useNetwork();
  const mapRef = useRef<TransitMapHandle>(null);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<ModeFilter>('all');
  const [terminalsOnly, setTerminalsOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [me, setMe] = useState<LatLng | null>(null);
  const [locMessage, setLocMessage] = useState<string | null>(null);

  const network = loaded?.network ?? null;

  const visibleStops = useMemo(() => {
    if (!network) return [];
    const q = normalise(query);
    return network.stops.filter((s) => {
      if (!s.isActive) return false;
      if (terminalsOnly && s.kind !== 'terminal' && s.kind !== 'station') return false;
      if (mode !== 'all' && !modesAtStop(network, s.id).has(mode)) return false;
      if (q.length >= 2 && ![s.name, ...s.aliases].some((n) => normalise(n).includes(q))) return false;
      return true;
    });
  }, [network, query, mode, terminalsOnly]);

  const selected = network?.stops.find((s) => s.id === selectedId) ?? null;
  const services = useMemo(() => (network && selected ? servicesAtStop(network, selected.id) : []), [network, selected]);

  const overlays = useMemo(() => {
    if (!network) return [];
    const routeIds = selected
      ? services.map((s) => s.route.id)
      : network.routes.filter((r) => r.isActive && (mode === 'all' || r.mode === mode)).map((r) => r.id);
    return routeIds.flatMap((id) => {
      const o = routeOverlay(network, id, !selected);
      return o ? [o] : [];
    });
  }, [network, selected, services, mode]);

  const nearby = useMemo(() => (network && me ? stopsNear(network, me, 1500, 8) : []), [network, me]);

  const locate = async () => {
    setLocMessage(null);
    const res = await getCurrentPosition();
    if (res.ok) {
      setMe(res.position);
      mapRef.current?.recenter(res.position);
    } else if (res.reason !== 'cancelled') setLocMessage(res.message);
  };

  if (status === 'loading' || !network) return <LoadingState message="Loading transport network…" />;

  return (
    <SafeAreaView style={styles.safe} edges={['top']} testID="explore-screen">
      <View style={styles.header}>
        <AppText variant="title" accessibilityRole="header">
          Explore
        </AppText>
        <TextField label="Find a stop" icon="search" placeholder="Stop, terminal or landmark" value={query} onChangeText={setQuery} autoCorrect={false} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          {MODES.map((m) => (
            <Chip
              key={m}
              label={m === 'all' ? 'All' : MODE_LABEL[m]}
              icon={m === 'all' ? 'apps' : modeStyle[m].icon}
              color={m === 'all' ? colors.primary : modeStyle[m].color}
              selected={mode === m}
              onPress={() => setMode(m)}
            />
          ))}
          <Chip label="Terminals" icon="business" selected={terminalsOnly} onPress={() => setTerminalsOnly((v) => !v)} />
        </ScrollView>
        <DataStatusBanner compact />
        {locMessage ? <Banner tone="warning" message={locMessage} /> : null}
      </View>

      <View style={{ flex: 1 }}>
        <TransitMap
          ref={mapRef}
          testID="explore-map"
          style={{ flex: 1, borderRadius: 0 }}
          stops={visibleStops.map((s) => ({ id: s.id, lat: s.lat, lng: s.lng, name: s.name, kind: s.kind, selected: s.id === selectedId }))}
          overlays={overlays}
          origin={me}
          showsUserLocation={!!me}
          onStopPress={setSelectedId}
        />
        <MapFab icon="locate" label="Show stops near me" onPress={locate} style={{ position: 'absolute', right: 12, top: 12 }} />
      </View>

      <View style={styles.panel}>
        {selected ? (
          <ScrollView contentContainerStyle={{ gap: spacing.sm, padding: spacing.lg }}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1, gap: 4 }}>
                <AppText variant="heading">{selected.name}</AppText>
                <QualityBadge verification={selected.quality.verification} isDemo={selected.quality.isDemo} />
                <AppText variant="caption" muted>
                  Last checked: {formatRelativeDate(selected.quality.lastVerifiedAt)}
                </AppText>
              </View>
              <Button compact kind="ghost" title="Close" onPress={() => setSelectedId(null)} />
            </Row>
            {services.length === 0 ? (
              <AppText muted>No routes recorded at this stop yet.</AppText>
            ) : (
              services.map((s) => (
                <ListRow
                  key={s.route.id}
                  icon={modeStyle[s.route.mode].icon}
                  iconColor={modeStyle[s.route.mode].color}
                  title={s.terminatesHere ? `${s.route.name} (arrives here)` : `${MODE_LABEL[s.route.mode]} to ${s.route.headsign}`}
                  subtitle={s.nextStops.length ? `Next: ${s.nextStops.map((n) => n.name).join(', ')}` : s.route.name}
                  onPress={() => router.push({ pathname: '/route/[id]', params: { id: s.route.id } })}
                />
              ))
            )}
            <Button title="Stop details" kind="secondary" onPress={() => router.push({ pathname: '/stop/[id]', params: { id: selected.id } })} />
          </ScrollView>
        ) : me ? (
          <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
            <AppText variant="heading">Stops near you</AppText>
            {nearby.length === 0 ? (
              <AppText muted>No stops in the Trotch network within 1.5 km.</AppText>
            ) : (
              nearby.map(({ stop, distanceM }) => (
                <ListRow key={stop.id} icon="bus-outline" title={stop.name} subtitle={`${formatDistance(distanceM)} away (straight line)`} onPress={() => setSelectedId(stop.id)} />
              ))
            )}
          </ScrollView>
        ) : (
          <View style={{ padding: spacing.lg }}>
            <AppText muted>
              {visibleStops.length} stop{visibleStops.length === 1 ? '' : 's'} shown. Tap a stop for its routes, or use the locate button to see what’s near you.
            </AppText>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.lg, paddingBottom: spacing.sm, gap: spacing.sm },
  panel: { maxHeight: '42%', backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
});
