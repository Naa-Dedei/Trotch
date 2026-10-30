import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Alert, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { AppText, Button, Card, ListRow, Row, Section } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/AuthProvider';
import { useNetwork } from '@/features/network/NetworkProvider';
import { usePlanner } from '@/features/planner/PlannerProvider';
import { formatRelativeDate } from '@/features/routing/format';
import { useSaved } from '@/features/saved/SavedProvider';

export default function ProfileScreen() {
  const { user, profile, available, isStaff, signOut } = useAuth();
  const { places, routes, journeys } = useSaved();
  const { recents, clearRecents, setPlace } = usePlanner();
  const { loaded } = useNetwork();

  const dataLine =
    loaded?.origin === 'bundled_demo'
      ? 'Using the built-in DEMO network (sample data, not verified).'
      : loaded?.origin === 'cache'
        ? `Using a saved copy from ${formatRelativeDate(loaded.fetchedAt)}.`
        : loaded
          ? `Live network, updated ${formatRelativeDate(loaded.fetchedAt)}.`
          : 'Network not loaded.';

  return (
    <Screen testID="profile-screen">
      <AppText variant="title" accessibilityRole="header">
        Profile
      </AppText>

      {!available ? (
        <Card>
          <AppText variant="heading">Accounts unavailable</AppText>
          <AppText muted>This build has no account backend configured. You can still plan journeys.</AppText>
        </Card>
      ) : !user ? (
        <Card>
          <AppText variant="heading">Sign in to Trotch</AppText>
          <AppText muted>Save places, favourite routes and keep journeys. You don’t need an account to plan trips.</AppText>
          <Button testID="profile-sign-in" title="Sign in" icon="log-in-outline" onPress={() => router.push('/auth/sign-in')} />
          <Button kind="secondary" title="Create an account" onPress={() => router.push('/auth/sign-up')} />
        </Card>
      ) : (
        <Card>
          <Row>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="person" size={24} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="heading">{profile?.displayName ?? 'Trotch traveller'}</AppText>
              <AppText variant="caption" muted>
                {user.email}
              </AppText>
            </View>
          </Row>
          <Row style={{ justifyContent: 'space-around', paddingTop: spacing.sm }}>
            {[
              ['Places', places.length],
              ['Routes', routes.length],
              ['Journeys', journeys.length],
            ].map(([k, v]) => (
              <View key={String(k)} style={{ alignItems: 'center' }}>
                <AppText variant="title">{String(v)}</AppText>
                <AppText variant="caption" muted>
                  {k}
                </AppText>
              </View>
            ))}
          </Row>
        </Card>
      )}

      <Section
        title="Recent searches"
        action={recents.length ? <Button compact kind="ghost" title="Clear" onPress={() => Alert.alert('Clear recent searches?', undefined, [{ text: 'Cancel', style: 'cancel' }, { text: 'Clear', style: 'destructive', onPress: () => void clearRecents() }])} /> : undefined}
      >
        {recents.length === 0 ? (
          <AppText muted>No recent searches. Searches from “My location” are never stored.</AppText>
        ) : (
          <Card style={{ paddingVertical: spacing.xs }}>
            {recents.slice(0, 6).map((t, i) => (
              <ListRow
                key={`${t.at}-${i}`}
                icon="time-outline"
                title={`${t.origin.label} → ${t.destination.label}`}
                subtitle={formatRelativeDate(t.at)}
                onPress={() => {
                  setPlace('origin', t.origin);
                  setPlace('destination', t.destination);
                  router.push('/plan');
                }}
              />
            ))}
          </Card>
        )}
      </Section>

      <Card style={{ paddingVertical: spacing.xs }}>
        {user ? <ListRow icon="settings-outline" title="Settings" subtitle="Display name, privacy and offline data" onPress={() => router.push('/settings')} /> : null}
        {user && isStaff ? (
          <ListRow testID="admin-entry" icon="construct-outline" title="Network admin" subtitle="Edit stops, routes, fares and review reports" onPress={() => router.push('/admin')} />
        ) : null}
        <ListRow icon="information-circle-outline" title="About the data" subtitle={dataLine} />
      </Card>

      {user ? <Button kind="danger" icon="log-out-outline" title="Sign out" onPress={() => void signOut()} /> : null}

      <AppText variant="caption" muted style={{ textAlign: 'center' }}>
        Trotch shows recorded routes only. No live traffic or vehicle tracking.
      </AppText>
    </Screen>
  );
}
