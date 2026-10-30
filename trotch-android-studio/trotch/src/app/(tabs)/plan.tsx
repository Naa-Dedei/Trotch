import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { DataStatusBanner } from '@/components/DataStatusBanner';
import { JourneyCard } from '@/components/journey/JourneyCard';
import { TransitMap } from '@/components/map/TransitMap';
import { PlaceInputs } from '@/components/PlaceInputs';
import { Screen } from '@/components/Screen';
import { AppText, Banner, Button, EmptyState, Section } from '@/components/ui';
import { spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/AuthProvider';
import { journeyOverlays, journeyPoints } from '@/features/map/journeyOverlays';
import { useNetwork } from '@/features/network/NetworkProvider';
import { usePlanner } from '@/features/planner/PlannerProvider';

export default function PlanScreen() {
  const { status } = useNetwork();
  const { origin, destination, result, plan, selectedIndex, select } = usePlanner();
  const { user, available } = useAuth();
  const [locationError, setLocationError] = useState<string | null>(null);

  const journeys = useMemo(() => (result?.status === 'ok' ? result.journeys : []), [result]);
  const selected = journeys[selectedIndex] ?? journeys[0] ?? null;
  const overlays = useMemo(
    () => [
      ...journeys.filter((j) => j !== selected).flatMap((j) => journeyOverlays(j, true)),
      ...(selected ? journeyOverlays(selected) : []),
    ],
    [journeys, selected],
  );
  const fitPoints = useMemo(() => (selected ? journeyPoints(selected) : undefined), [selected]);

  return (
    <Screen testID="plan-screen">
      <AppText variant="title" accessibilityRole="header">
        Plan a journey
      </AppText>
      <PlaceInputs onLocationError={setLocationError} />
      {locationError ? <Banner tone="warning" message={locationError} /> : null}
      <Button
        testID="plan-find-routes"
        title={result ? 'Search again' : 'Find routes'}
        icon="search"
        onPress={plan}
        disabled={!origin || !destination || status !== 'ready'}
      />
      <DataStatusBanner compact />

      {!result ? (
        <EmptyState
          icon="navigate-outline"
          title="Choose where you’re going"
          message="Pick a starting point and destination. Trotch compares trotro, shared taxi, bus and walking options in its network."
        />
      ) : result.status === 'no_route' ? (
        <View style={{ gap: spacing.md }} testID="no-route">
          <Banner tone="info" title="No journey found" message={result.message} />
          <AppText muted>
            Trotch only shows journeys built from recorded routes — it never guesses connections. If you know how to make this trip, tell us so we can add it.
          </AppText>
          {available ? (
            <Button
              kind="secondary"
              icon="add-circle-outline"
              title={user ? 'Report a missing route' : 'Sign in to report a missing route'}
              onPress={() =>
                user
                  ? router.push({ pathname: '/report', params: { type: 'missing_route', context: `${origin?.label ?? ''} → ${destination?.label ?? ''}` } })
                  : router.push('/auth/sign-in')
              }
            />
          ) : null}
        </View>
      ) : (
        <View style={{ gap: spacing.md }}>
          <TransitMap
            testID="plan-map"
            style={{ height: 240 }}
            overlays={overlays}
            origin={origin}
            destination={destination}
            fitPoints={fitPoints}
          />
          <Section title={`${journeys.length} option${journeys.length === 1 ? '' : 's'}`}>
            <AppText variant="caption" muted>
              Tap an option to show it on the map. Times are estimates — trotros often leave when full.
            </AppText>
            {journeys.map((j, i) => (
              <View key={j.id} style={{ gap: spacing.xs }}>
                <JourneyCard testID={`journey-option-${i}`} journey={j} selected={j === selected} onPress={() => select(i)} />
                {j === selected ? (
                  <Button testID="view-steps" title="View step-by-step" icon="list" onPress={() => router.push({ pathname: '/journey/[id]', params: { id: String(i) } })} />
                ) : null}
              </View>
            ))}
          </Section>
        </View>
      )}
    </Screen>
  );
}
