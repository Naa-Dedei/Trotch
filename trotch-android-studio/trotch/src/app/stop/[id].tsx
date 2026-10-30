import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';
import { TransitMap } from '@/components/map/TransitMap';
import { Screen } from '@/components/Screen';
import { AppText, Banner, Button, Card, EmptyState, ListRow, QualityBadge, Section } from '@/components/ui';
import { modeStyle, spacing } from '@/constants/theme';
import { routeOverlay } from '@/features/map/journeyOverlays';
import { useNetwork } from '@/features/network/NetworkProvider';
import { servicesAtStop, stopsNear } from '@/features/network/queries';
import { usePlanner } from '@/features/planner/PlannerProvider';
import { formatDistance, formatRelativeDate, MODE_LABEL } from '@/features/routing/format';

const KIND_LABEL = { terminal: 'Terminal / lorry station', station: 'Station or rank', roadside: 'Roadside stop', landmark: 'Landmark stop' } as const;

export default function StopScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { loaded } = useNetwork();
  const { setPlace } = usePlanner();
  const network = loaded?.network;
  const stop = network?.stops.find((s) => s.id === id);
  const services = useMemo(() => (network && stop ? servicesAtStop(network, stop.id) : []), [network, stop]);
  const nearby = useMemo(() => (network && stop ? stopsNear(network, stop, 600, 6).filter((n) => n.stop.id !== stop.id) : []), [network, stop]);
  const source = network?.sources.find((s) => s.id === stop?.quality.sourceId);

  if (!network || !stop) {
    return (
      <Screen edges={['bottom']}>
        <EmptyState title="Stop not found" message="This stop may have been removed from the network." />
      </Screen>
    );
  }

  const asPlace = { label: stop.name, lat: stop.lat, lng: stop.lng, type: 'stop' as const, refId: stop.id };

  return (
    <Screen edges={['bottom']} testID="stop-screen">
      <Stack.Screen options={{ title: stop.name }} />
      <View style={{ gap: spacing.xs }}>
        <AppText variant="title">{stop.name}</AppText>
        <AppText muted>{KIND_LABEL[stop.kind]}</AppText>
        <QualityBadge verification={stop.quality.verification} isDemo={stop.quality.isDemo} />
        <AppText variant="caption" muted>
          Last checked {formatRelativeDate(stop.quality.lastVerifiedAt)}
          {source ? ` · Source: ${source.name}` : ''}
        </AppText>
      </View>
      {stop.aliases.length ? <AppText variant="caption" muted>Also known as: {stop.aliases.join(', ')}</AppText> : null}
      {stop.landmarkHint ? <Banner tone="info" title="Finding the boarding point" message={stop.landmarkHint} /> : null}

      <TransitMap
        style={{ height: 220 }}
        stops={[{ id: stop.id, lat: stop.lat, lng: stop.lng, name: stop.name, kind: stop.kind, selected: true }, ...nearby.map((n) => ({ id: n.stop.id, lat: n.stop.lat, lng: n.stop.lng, name: n.stop.name, kind: n.stop.kind }))]}
        overlays={services.flatMap((s) => {
          const o = routeOverlay(network, s.route.id);
          return o ? [o] : [];
        })}
        fitPoints={[stop]}
        onStopPress={(sid) => sid !== stop.id && router.push({ pathname: '/stop/[id]', params: { id: sid } })}
      />

      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Button style={{ flex: 1 }} kind="secondary" icon="navigate" title="Go here" onPress={() => { setPlace('destination', asPlace); router.push('/plan'); }} />
        <Button style={{ flex: 1 }} kind="secondary" icon="radio-button-on" title="Start here" onPress={() => { setPlace('origin', asPlace); router.push('/plan'); }} />
      </View>

      <Section title="Routes from this stop">
        {services.length === 0 ? (
          <AppText muted>No routes are recorded at this stop yet.</AppText>
        ) : (
          <Card style={{ paddingVertical: spacing.xs }}>
            {services.map((s) => (
              <ListRow
                key={s.route.id}
                icon={modeStyle[s.route.mode].icon}
                iconColor={modeStyle[s.route.mode].color}
                title={s.terminatesHere ? `${s.route.name} — arrives here` : `${MODE_LABEL[s.route.mode]} to ${s.route.headsign}`}
                subtitle={s.nextStops.length ? `Then ${s.nextStops.map((n) => n.name).join(' → ')}` : null}
                onPress={() => router.push({ pathname: '/route/[id]', params: { id: s.route.id } })}
              />
            ))}
          </Card>
        )}
        <AppText variant="caption" muted>
          Routes are listed in the direction they’re recorded. A service in one direction doesn’t mean there’s one coming back.
        </AppText>
      </Section>

      {nearby.length ? (
        <Section title="Other stops nearby">
          <Card style={{ paddingVertical: spacing.xs }}>
            {nearby.map((n) => (
              <ListRow key={n.stop.id} icon="walk-outline" title={n.stop.name} subtitle={`${formatDistance(n.distanceM)} (straight line)`} onPress={() => router.push({ pathname: '/stop/[id]', params: { id: n.stop.id } })} />
            ))}
          </Card>
        </Section>
      ) : null}

      <Button kind="ghost" icon="flag-outline" title="Report a problem with this stop" onPress={() => router.push({ pathname: '/report', params: { type: 'stop_location', stopId: stop.id, context: stop.name } })} />
    </Screen>
  );
}
