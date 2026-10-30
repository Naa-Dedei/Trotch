import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Share, View } from 'react-native';
import { LegStrip } from '@/components/journey/JourneyCard';
import { Timeline } from '@/components/journey/Timeline';
import { MapFab, TransitMap, type TransitMapHandle } from '@/components/map/TransitMap';
import { Screen } from '@/components/Screen';
import { AppText, Banner, Button, Card, EmptyState, IconButton, Row, TextField } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/AuthProvider';
import { journeyOverlays, journeyPoints, journeyStopIds } from '@/features/map/journeyOverlays';
import { useNetwork } from '@/features/network/NetworkProvider';
import { usePlanner } from '@/features/planner/PlannerProvider';
import { formatDistance, formatDuration, formatFareSummary } from '@/features/routing/format';
import { buildInstructions } from '@/features/routing/instructions';
import type { Journey } from '@/features/routing/types';
import { journeyNameSchema } from '@/features/saved/savedService';
import { useWalkingPaths } from '@/hooks/useWalkingPaths';
import { useSaved } from '@/features/saved/SavedProvider';
import { friendlyError } from '@/services/supabase/client';

export default function JourneyScreen() {
  const { id, saved: savedId } = useLocalSearchParams<{ id: string; saved?: string }>();
  const { result } = usePlanner();
  const { planner, loaded } = useNetwork();
  const { user, available } = useAuth();
  const { journeys: savedJourneys, service, refresh } = useSaved();
  const mapRef = useRef<TransitMapHandle>(null);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);

  const savedEntry = savedId ? savedJourneys.find((j) => j.id === savedId) : undefined;
  const journey: Journey | null = savedEntry
    ? savedEntry.journey
    : result?.status === 'ok'
      ? (result.journeys[Number(id)] ?? null)
      : null;

  const walking = useWalkingPaths(journey);
  const steps = journey && planner ? buildInstructions(journey, planner.index) : [];
  const journeyStops = journey ? new Set(journeyStopIds(journey)) : new Set<string>();
  const stopMarkers = (loaded?.network.stops ?? [])
    .filter((s) => journeyStops.has(s.id))
    .map((s) => ({ id: s.id, lat: s.lat, lng: s.lng, name: s.name, kind: s.kind }));

  if (!journey) {
    return (
      <Screen edges={['bottom']}>
        <EmptyState
          title="Journey not available"
          message={savedId ? 'This saved journey could not be loaded. Pull to refresh your saved items.' : 'Plan a journey first, then open its steps.'}
          action={<Button title="Plan a journey" onPress={() => router.replace('/plan')} />}
        />
      </Screen>
    );
  }

  const fare = formatFareSummary(journey.fare);
  const points = journeyPoints(journey);

  const doSave = async () => {
    const parsed = journeyNameSchema.safeParse(name || `${journey.origin.label} to ${journey.destination.label}`);
    if (!parsed.success) {
      setNameError(parsed.error.issues[0]?.message ?? 'Invalid name');
      return;
    }
    setSaving(true);
    try {
      await service.saveJourney(parsed.data, journey);
      await refresh();
      setSavedOk(true);
    } catch (e) {
      Alert.alert('Could not save', friendlyError(e));
    } finally {
      setSaving(false);
    }
  };

  const share = () => {
    const text = [`Trotch journey: ${journey.origin.label} → ${journey.destination.label}`, ...steps.map((s, i) => `${i + 1}. ${s.title}`)].join('\n');
    void Share.share({ message: text });
  };

  return (
    <Screen edges={['bottom']} testID="journey-screen">
      <Stack.Screen
        options={{
          title: savedEntry?.name ?? 'Journey',
          headerRight: () => <IconButton icon="share-outline" label="Share journey steps" onPress={share} />,
        }}
      />
      <View>
        <AppText variant="caption" muted>
          FROM
        </AppText>
        <AppText variant="heading">{journey.origin.label}</AppText>
        <AppText variant="caption" muted style={{ marginTop: spacing.xs }}>
          TO
        </AppText>
        <AppText variant="heading">{journey.destination.label}</AppText>
      </View>

      <View>
        <TransitMap
          ref={mapRef}
          testID="journey-map"
          style={{ height: 260 }}
          overlays={journeyOverlays(journey).map((o, i) => {
            const street = walking.paths.get(i);
            return street ? { ...o, coordinates: street } : o;
          })}
          stops={stopMarkers}
          origin={journey.origin}
          destination={journey.destination}
          fitPoints={points}
          onStopPress={(sid) => router.push({ pathname: '/stop/[id]', params: { id: sid } })}
        />
        <MapFab icon="scan-outline" label="Fit journey on map" onPress={() => mapRef.current?.fitTo(points)} style={{ position: 'absolute', right: 10, bottom: 10 }} />
      </View>

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <View>
            <AppText variant="caption" muted>
              TIME
            </AppText>
            <AppText variant="title">{formatDuration(journey.duration)}</AppText>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <AppText variant="caption" muted>
              FARE
            </AppText>
            <AppText variant="title">{fare.headline}</AppText>
          </View>
        </Row>
        <AppText variant="caption" muted>
          {journey.transfers === 0 ? 'No transfers' : `${journey.transfers} transfer${journey.transfers > 1 ? 's' : ''}`} · {formatDistance(journey.walkingMeters)} walking
        </AppText>
        {fare.note ? <AppText variant="caption" color={colors.warning}>{fare.note}</AppText> : null}
        {journey.duration.quality === 'estimated' ? (
          <AppText variant="caption" muted>
            Time is approximate: some travel or waiting times aren’t recorded. No live traffic or vehicle tracking is used.
          </AppText>
        ) : null}
        <LegStrip journey={journey} />
      </Card>

      {journey.hasDemoData ? (
        <Banner tone="warning" title="DEMO data" message="This journey uses sample DEMO routes and fares. Don’t rely on it for real travel." />
      ) : journey.hasUnverifiedData ? (
        <Banner tone="warning" message="Parts of this journey use unverified or community-reported information. Confirm with the driver or mate." />
      ) : null}
      {savedEntry ? (
        <Banner tone="info" message={`Saved snapshot from ${new Date(savedEntry.createdAt).toLocaleDateString()}. Plan again for the latest routes and fares.`} />
      ) : null}

      <View style={{ gap: spacing.md }}>
        <AppText variant="title" accessibilityRole="header">
          Step by step
        </AppText>
        <Timeline steps={steps} journey={journey} onStopPress={(sid) => router.push({ pathname: '/stop/[id]', params: { id: sid } })} />
      </View>

      {!savedEntry ? (
        <Card>
          <AppText variant="heading">Save this journey</AppText>
          {!available ? (
            <AppText muted>Saving needs an account, which isn’t available on this build.</AppText>
          ) : !user ? (
            <Button testID="signin-to-save" kind="secondary" title="Sign in to save" icon="log-in-outline" onPress={() => router.push('/auth/sign-in')} />
          ) : savedOk ? (
            <Banner tone="success" message="Saved. Find it under the Saved tab." />
          ) : (
            <>
              <TextField
                testID="journey-name"
                label="Name"
                placeholder={`${journey.origin.label} to ${journey.destination.label}`}
                value={name}
                onChangeText={(t) => {
                  setName(t);
                  setNameError(null);
                }}
                maxLength={80}
                error={nameError}
              />
              <Button testID="save-journey" title="Save journey" icon="bookmark" loading={saving} onPress={doSave} />
            </>
          )}
        </Card>
      ) : null}

      <Button
        kind="ghost"
        icon="flag-outline"
        title="Report a problem with this journey"
        onPress={() => {
          const firstRide = journey.legs.find((l) => l.kind === 'ride');
          router.push({
            pathname: '/report',
            params: {
              type: 'route_info',
              routeId: firstRide && firstRide.kind === 'ride' ? firstRide.routeId : '',
              context: `${journey.origin.label} → ${journey.destination.label}`,
            },
          });
        }}
      />
    </Screen>
  );
}
