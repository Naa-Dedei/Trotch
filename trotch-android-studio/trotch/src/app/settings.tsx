import { Redirect } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { Screen } from '@/components/Screen';
import { AppText, Banner, Button, Card, Section, TextField } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { useNetwork } from '@/features/network/NetworkProvider';
import { usePlanner } from '@/features/planner/PlannerProvider';
import { formatRelativeDate } from '@/features/routing/format';
import { env } from '@/lib/env';
import { CACHE_KEYS, removeCache } from '@/lib/storage';
import { friendlyError } from '@/services/supabase/client';
import { z } from 'zod';

const nameSchema = z.string().trim().max(60, 'Keep your name under 60 characters');

export default function SettingsScreen() {
  const { user, profile, updateDisplayName } = useAuth();
  const { loaded, refresh, refreshing } = useNetwork();
  const { clearRecents } = usePlanner();
  const [name, setName] = useState(profile?.displayName ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!user) return <Redirect href="/auth/sign-in" />;

  const saveName = async () => {
    const parsed = nameSchema.safeParse(name);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid name');
      return;
    }
    setBusy(true);
    try {
      await updateDisplayName(parsed.data);
      setSaved(true);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <Section title="Profile">
        <TextField label="Display name" value={name} onChangeText={(t) => { setName(t); setError(null); setSaved(false); }} maxLength={60} error={error} />
        {saved ? <Banner tone="success" message="Saved." /> : null}
        <Button title="Save name" onPress={saveName} loading={busy} />
      </Section>

      <Section title="Offline data">
        <Card>
          <AppText>
            {loaded?.origin === 'bundled_demo'
              ? 'This build uses the built-in DEMO network.'
              : `Transport data last downloaded ${formatRelativeDate(loaded?.fetchedAt ?? null)}. Trotch keeps a copy so you can plan journeys without a connection; place search outside the network needs data.`}
          </AppText>
          <Button kind="secondary" icon="refresh" title="Refresh network now" loading={refreshing} onPress={refresh} />
          <Button
            kind="ghost"
            title="Delete downloaded network"
            onPress={() =>
              Alert.alert('Delete downloaded network?', 'It will be downloaded again next time you are online.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => void removeCache(CACHE_KEYS.network(env.cityId)) },
              ])
            }
          />
        </Card>
      </Section>

      <Section title="Privacy">
        <Card>
          <AppText>
            Location is only read when you tap a location button, and only while the app is open. Your precise location is never saved to your search history.
          </AppText>
          <Button kind="ghost" title="Clear recent searches" onPress={() => void clearRecents()} />
        </Card>
      </Section>
    </Screen>
  );
}
