import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { TransitMap } from '@/components/map/TransitMap';
import { Screen } from '@/components/Screen';
import { AppText, Badge, Button, Card, EmptyState, ListRow, QualityBadge, Section } from '@/components/ui';
import { colors, modeStyle, spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/AuthProvider';
import { routeOverlay } from '@/features/map/journeyOverlays';
import { useNetwork } from '@/features/network/NetworkProvider';
import { isFareEffective } from '@/features/routing/fares';
import { formatFareRange, formatRelativeDate, MODE_LABEL, VERIFICATION_LABEL } from '@/features/routing/format';
import { todayIso } from '@/features/routing/options';
import { useSaved } from '@/features/saved/SavedProvider';
import { friendlyError } from '@/services/supabase/client';

export default function RouteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { loaded } = useNetwork();
  const { user, available } = useAuth();
  const { routes: favourites, service, refresh } = useSaved();
  const [busy, setBusy] = useState(false);
  const network = loaded?.network;
  const route = network?.routes.find((r) => r.id === id);
  const stopsById = useMemo(() => new Map((network?.stops ?? []).map((s) => [s.id, s])), [network]);
  const fares = useMemo(() => {
    const today = todayIso();
    return (network?.fares ?? []).filter((f) => f.routeId === id && isFareEffective(f, today));
  }, [network, id]);
  const favourite = favourites.find((f) => f.routeId === id);

  if (!network || !route) {
    return (
      <Screen edges={['bottom']}>
        <EmptyState title="Route not found" message="This route may have been removed from the network." />
      </Screen>
    );
  }

  const overlay = routeOverlay(network, route.id);
  const stops = route.stops.map((rs) => stopsById.get(rs.stopId)).filter((s): s is NonNullable<typeof s> => !!s);
  const style = modeStyle[route.mode];

  const toggleFavourite = async () => {
    if (!user) {
      router.push('/auth/sign-in');
      return;
    }
    setBusy(true);
    try {
      if (favourite) await service.unfavouriteRoute(favourite.id);
      else await service.favouriteRoute(route.id);
      await refresh();
    } catch (e) {
      Alert.alert('Could not update favourites', friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['bottom']} testID="route-screen">
      <Stack.Screen options={{ title: route.name }} />
      <View style={{ gap: spacing.xs }}>
        <Badge label={MODE_LABEL[route.mode]} fg="#fff" bg={style.color} icon={style.icon} />
        <AppText variant="title">{route.name}</AppText>
        <AppText muted>
          Towards {route.headsign}
          {route.code ? ` · Route ${route.code}` : ' · No official route number'}
        </AppText>
        <QualityBadge verification={route.quality.verification} isDemo={route.quality.isDemo} />
        <AppText variant="caption" muted>
          Last checked {formatRelativeDate(route.quality.lastVerifiedAt)}
        </AppText>
      </View>
      {route.callOut ? <AppText>The mate usually calls “{route.callOut}”.</AppText> : null}
      {route.notes ? <AppText variant="caption" muted>{route.notes}</AppText> : null}

      <TransitMap
        style={{ height: 220 }}
        overlays={overlay ? [overlay] : []}
        stops={stops.map((s) => ({ id: s.id, lat: s.lat, lng: s.lng, name: s.name, kind: s.kind, color: style.color }))}
        fitPoints={stops}
        onStopPress={(sid) => router.push({ pathname: '/stop/[id]', params: { id: sid } })}
      />

      {available ? (
        <Button
          kind={favourite ? 'secondary' : 'primary'}
          icon={favourite ? 'heart' : 'heart-outline'}
          title={!user ? 'Sign in to favourite' : favourite ? 'Remove from favourites' : 'Add to favourites'}
          loading={busy}
          onPress={toggleFavourite}
        />
      ) : null}

      <Section title="Stops in order">
        <Card style={{ paddingVertical: spacing.xs }}>
          {route.stops.map((rs, i) => {
            const s = stopsById.get(rs.stopId);
            return (
              <ListRow
                key={`${rs.stopId}-${i}`}
                icon={i === 0 ? 'radio-button-on' : i === route.stops.length - 1 ? 'flag' : 'ellipse-outline'}
                iconColor={style.color}
                title={s?.name ?? 'Unknown stop'}
                subtitle={i === 0 ? 'Start' : rs.minutesFromPrevious !== null ? `${rs.minutesFromPrevious} min from previous stop` : 'Time from previous stop not recorded'}
                onPress={s ? () => router.push({ pathname: '/stop/[id]', params: { id: s.id } }) : undefined}
              />
            );
          })}
        </Card>
        <AppText variant="caption" muted>
          This route is recorded in one direction only. Check for a separate route for the return trip.
        </AppText>
      </Section>

      <Section title="Fares (GH₵)">
        {fares.length === 0 ? (
          <AppText muted>No fares recorded for this route yet.</AppText>
        ) : (
          <Card style={{ paddingVertical: spacing.xs }}>
            {fares.map((f) => (
              <ListRow
                key={f.id}
                icon="cash-outline"
                title={f.fromStopId ? `${stopsById.get(f.fromStopId)?.name ?? '?'} → ${stopsById.get(f.toStopId!)?.name ?? '?'}` : 'Whole route'}
                subtitle={`${VERIFICATION_LABEL[f.quality.verification]}${f.quality.isDemo ? ' · DEMO' : ''}${f.effectiveFrom ? ` · from ${f.effectiveFrom}` : ''}`}
                right={<AppText variant="bodyStrong">{formatFareRange(f.minGhs, f.maxGhs)}</AppText>}
              />
            ))}
          </Card>
        )}
        <AppText variant="caption" color={colors.textMuted}>
          Fares change often. Confirm with the mate before you board.
        </AppText>
      </Section>

      <Button kind="ghost" icon="flag-outline" title="Report incorrect route or fare" onPress={() => router.push({ pathname: '/report', params: { type: 'route_info', routeId: route.id, context: route.name } })} />
    </Screen>
  );
}
