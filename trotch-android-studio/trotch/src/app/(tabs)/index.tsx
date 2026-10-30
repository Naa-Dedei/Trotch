import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { DataStatusBanner } from '@/components/DataStatusBanner';
import { PlaceInputs, QuickPlaceButton } from '@/components/PlaceInputs';
import { Screen } from '@/components/Screen';
import { AppText, Banner, Button, Card, Chip, ListRow, LoadingState, Row, Section } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/AuthProvider';
import { useNetwork } from '@/features/network/NetworkProvider';
import { usePlanner } from '@/features/planner/PlannerProvider';
import { useSaved } from '@/features/saved/SavedProvider';
import type { PlaceRef } from '@/types/transport';

const SUGGESTED = ['Circle', 'University of Ghana, Legon', 'Accra Mall', 'Madina'];

function greeting(d = new Date()): string {
  const h = d.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen() {
  const { status, loaded, error, refresh } = useNetwork();
  const { origin, destination, setPlace, plan, recents } = usePlanner();
  const { user, profile, available } = useAuth();
  const { places } = useSaved();
  const [locationError, setLocationError] = useState<string | null>(null);

  const suggestions = useMemo<PlaceRef[]>(() => {
    const locs = loaded?.network.locations ?? [];
    return SUGGESTED.flatMap((name) => {
      const l = locs.find((x) => x.name === name);
      return l ? [{ label: l.name, lat: l.lat, lng: l.lng, type: 'location' as const, refId: l.id }] : [];
    });
  }, [loaded]);

  const findRoutes = () => {
    if (plan()) router.push('/plan');
  };

  const goTo = (place: PlaceRef) => {
    setPlace('destination', place);
    if (!origin) router.push({ pathname: '/search', params: { field: 'origin' } });
  };

  const name = profile?.displayName?.split(' ')[0];

  return (
    <Screen testID="home-screen">
      <Row style={{ justifyContent: 'space-between' }}>
        <Row gap={spacing.sm}>
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="bus" size={20} color="#fff" />
          </View>
          <View>
            <AppText variant="heading" color={colors.primaryDark}>
              Trotch
            </AppText>
            <AppText variant="caption" muted>
              {greeting()}
              {name ? `, ${name}` : ''} 👋🏾
            </AppText>
          </View>
        </Row>
      </Row>

      <View style={{ gap: spacing.xs }}>
        <AppText variant="display" accessibilityRole="header">
          Where are you going?
        </AppText>
        <AppText muted>Know where to go. Know what to take. Get there.</AppText>
      </View>

      <DataStatusBanner compact />

      <PlaceInputs onLocationError={setLocationError} />
      {locationError ? <Banner tone="warning" message={locationError} /> : null}

      {status === 'loading' ? (
        <LoadingState message="Loading transport network…" />
      ) : status === 'error' ? (
        <Banner tone="danger" title="Transport data unavailable" message={error ?? ''} action={<Button title="Try again" kind="ghost" compact onPress={refresh} />} />
      ) : null}

      <Button
        testID="find-routes"
        title="Find routes"
        icon="search"
        onPress={findRoutes}
        disabled={!origin || !destination || status !== 'ready'}
        accessibilityHint="Searches the Trotch network for journeys"
      />

      {user && places.length > 0 ? (
        <Section title="Saved places">
          <Row style={{ flexWrap: 'wrap' }}>
            {places.map((p) => (
              <QuickPlaceButton
                key={p.id}
                icon={p.kind === 'home' ? 'home' : p.kind === 'school' ? 'school' : p.kind === 'work' ? 'briefcase' : 'star'}
                label={p.label}
                onPress={() => goTo({ label: p.label, lat: p.lat, lng: p.lng, type: 'saved_place', refId: p.id })}
              />
            ))}
          </Row>
        </Section>
      ) : available && !user ? (
        <Card onPress={() => router.push('/auth/sign-in')} accessibilityLabel="Sign in to save home, school and work">
          <Row>
            <Ionicons name="bookmark-outline" size={20} color={colors.primary} />
            <AppText style={{ flex: 1 }}>Sign in to save Home, School and Work for one-tap journeys.</AppText>
          </Row>
        </Card>
      ) : null}

      {recents.length > 0 ? (
        <Section title="Recent">
          <Card style={{ paddingVertical: spacing.xs }}>
            {recents.slice(0, 4).map((t, i) => (
              <ListRow
                key={`${t.at}-${i}`}
                icon="time-outline"
                title={t.destination.label}
                subtitle={`from ${t.origin.label}`}
                onPress={() => {
                  setPlace('origin', t.origin);
                  setPlace('destination', t.destination);
                }}
              />
            ))}
          </Card>
        </Section>
      ) : null}

      {suggestions.length > 0 && !destination ? (
        <Section title="Popular places">
          <AppText variant="caption" muted>
            Sample places to search. They don’t guarantee a route exists.
          </AppText>
          <Row style={{ flexWrap: 'wrap' }}>
            {suggestions.map((s) => (
              <Chip key={s.label} label={s.label} icon="location-outline" onPress={() => goTo(s)} />
            ))}
          </Row>
        </Section>
      ) : null}

      <Card onPress={() => router.push('/explore')} accessibilityLabel="Explore stops and routes near you">
        <Row>
          <Ionicons name="map" size={22} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <AppText variant="bodyStrong">Explore stops near you</AppText>
            <AppText variant="caption" muted>
              Terminals, roadside stops and the routes that serve them.
            </AppText>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Row>
      </Card>
    </Screen>
  );
}
