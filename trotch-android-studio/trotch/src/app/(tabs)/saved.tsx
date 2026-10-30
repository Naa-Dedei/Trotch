import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView } from 'react-native';
import { EditableRow } from '@/components/EditableRow';
import { Screen } from '@/components/Screen';
import { AppText, Banner, Button, Card, Chip, EmptyState, Section } from '@/components/ui';
import { spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/AuthProvider';
import { useNetwork } from '@/features/network/NetworkProvider';
import { usePlanner } from '@/features/planner/PlannerProvider';
import { formatDuration, formatFareSummary, MODE_LABEL } from '@/features/routing/format';
import { useSaved } from '@/features/saved/SavedProvider';

type Tab = 'places' | 'journeys' | 'routes';

export default function SavedScreen() {
  const { user, available } = useAuth();
  const { places, routes, journeys, loading, error, fromCache, refresh, service } = useSaved();
  const { loaded } = useNetwork();
  const { setPlace } = usePlanner();
  const [tab, setTab] = useState<Tab>('places');

  if (!available) {
    return (
      <Screen>
        <EmptyState icon="bookmark-outline" title="Saving isn’t available" message="This build of Trotch has no account backend configured. Journey planning still works." />
      </Screen>
    );
  }
  if (!user) {
    return (
      <Screen testID="saved-signed-out">
        <EmptyState
          icon="bookmark-outline"
          title="Save places and journeys"
          message="Sign in to save Home, School and Work, favourite routes and keep journeys you take often."
          action={<Button title="Sign in" icon="log-in-outline" onPress={() => router.push('/auth/sign-in')} />}
        />
      </Screen>
    );
  }

  const routeName = (id: string) => loaded?.network.routes.find((r) => r.id === id);

  return (
    <Screen testID="saved-screen" refreshing={loading} onRefresh={refresh}>
      <AppText variant="title" accessibilityRole="header">
        Saved
      </AppText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        <Chip label={`Places (${places.length})`} selected={tab === 'places'} onPress={() => setTab('places')} icon="location" />
        <Chip testID="saved-tab-journeys" label={`Journeys (${journeys.length})`} selected={tab === 'journeys'} onPress={() => setTab('journeys')} icon="git-commit" />
        <Chip label={`Routes (${routes.length})`} selected={tab === 'routes'} onPress={() => setTab('routes')} icon="heart" />
      </ScrollView>
      {error ? <Banner tone={fromCache ? 'info' : 'danger'} message={fromCache ? `${error} Showing journeys saved on this device.` : error} /> : null}

      {tab === 'places' ? (
        <Section title="Places" action={<Button compact kind="ghost" icon="add" title="Add" onPress={() => router.push('/saved-place')} />}>
          {places.length === 0 ? (
            <AppText muted>Add Home, School, Work or any place you visit often.</AppText>
          ) : (
            <Card style={{ paddingVertical: spacing.xs }}>
              {places.map((p) => (
                <EditableRow
                  key={p.id}
                  icon={p.kind === 'home' ? 'home' : p.kind === 'school' ? 'school' : p.kind === 'work' ? 'briefcase' : 'star'}
                  title={p.label}
                  subtitle={p.placeName}
                  deleteLabel="place"
                  onPress={() => {
                    setPlace('destination', { label: p.label, lat: p.lat, lng: p.lng, type: 'saved_place', refId: p.id });
                    router.push('/plan');
                  }}
                  onRename={async (name) => {
                    await service.renamePlace(p.id, name);
                    await refresh();
                  }}
                  onDelete={async () => {
                    await service.deletePlace(p.id);
                    await refresh();
                  }}
                />
              ))}
            </Card>
          )}
        </Section>
      ) : tab === 'journeys' ? (
        <Section title="Journeys">
          {journeys.length === 0 ? (
            <AppText muted>Open a journey’s steps and tap “Save journey” to keep it here.</AppText>
          ) : (
            <Card style={{ paddingVertical: spacing.xs }}>
              {journeys.map((j) => (
                <EditableRow
                  key={j.id}
                  testID={`saved-journey-${j.id}`}
                  icon="git-commit-outline"
                  title={j.name}
                  subtitle={`${formatDuration(j.journey.duration)} · ${formatFareSummary(j.journey.fare).headline}`}
                  deleteLabel="journey"
                  onPress={() => router.push({ pathname: '/journey/[id]', params: { id: 'saved', saved: j.id } })}
                  onRename={async (name) => {
                    await service.renameJourney(j.id, name);
                    await refresh();
                  }}
                  onDelete={async () => {
                    await service.deleteJourney(j.id);
                    await refresh();
                  }}
                />
              ))}
            </Card>
          )}
        </Section>
      ) : (
        <Section title="Favourite routes">
          {routes.length === 0 ? (
            <AppText muted>Open any route and tap “Add to favourites”.</AppText>
          ) : (
            <Card style={{ paddingVertical: spacing.xs }}>
              {routes.map((r) => {
                const route = routeName(r.routeId);
                return (
                  <EditableRow
                    key={r.id}
                    icon="heart"
                    title={r.nickname ?? route?.name ?? 'Route no longer available'}
                    subtitle={route ? `${MODE_LABEL[route.mode]} to ${route.headsign}` : null}
                    deleteLabel="favourite"
                    onPress={route ? () => router.push({ pathname: '/route/[id]', params: { id: route.id } }) : undefined}
                    onRename={async (name) => {
                      await service.renameRoute(r.id, name);
                      await refresh();
                    }}
                    onDelete={async () => {
                      await service.unfavouriteRoute(r.id);
                      await refresh();
                    }}
                  />
                );
              })}
            </Card>
          )}
        </Section>
      )}
    </Screen>
  );
}
