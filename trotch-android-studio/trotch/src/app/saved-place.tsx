import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { PlaceSearch } from '@/components/PlaceSearch';
import { Screen } from '@/components/Screen';
import { AppText, Button, Card, Chip, Row, TextField } from '@/components/ui';
import { spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/AuthProvider';
import { savedPlaceInputSchema, type SavedPlaceKind } from '@/features/saved/savedService';
import { useSaved } from '@/features/saved/SavedProvider';
import { friendlyError } from '@/services/supabase/client';
import type { PlaceRef } from '@/types/transport';

const KINDS: { kind: SavedPlaceKind; label: string; icon: 'home' | 'school' | 'briefcase' | 'star' }[] = [
  { kind: 'home', label: 'Home', icon: 'home' },
  { kind: 'school', label: 'School / Uni', icon: 'school' },
  { kind: 'work', label: 'Work', icon: 'briefcase' },
  { kind: 'custom', label: 'Other', icon: 'star' },
];

export default function SavedPlaceScreen() {
  const { user } = useAuth();
  const { service, refresh, places } = useSaved();
  const [kind, setKind] = useState<SavedPlaceKind>('home');
  const [label, setLabel] = useState('Home');
  const [place, setPlaceRef] = useState<PlaceRef | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!user) return <Redirect href="/auth/sign-in" />;

  const taken = (k: SavedPlaceKind) => k !== 'custom' && places.some((p) => p.kind === k);

  const save = async () => {
    if (!place) return;
    // Device coordinates are allowed here only because the user explicitly chose to save them as a named place.
    const stored: PlaceRef = place.type === 'current_location' ? { ...place, type: 'geocoded', label: label || 'Saved location' } : place;
    const parsed = savedPlaceInputSchema.safeParse({ kind, label, place: stored });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the details');
      return;
    }
    setBusy(true);
    try {
      await service.savePlace(parsed.data);
      await refresh();
      router.back();
    } catch (e) {
      Alert.alert('Could not save place', friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <Row style={{ flexWrap: 'wrap' }}>
        {KINDS.map((k) => (
          <Chip
            key={k.kind}
            label={taken(k.kind) ? `${k.label} (saved)` : k.label}
            icon={k.icon}
            selected={kind === k.kind}
            onPress={() => {
              setKind(k.kind);
              setLabel(k.kind === 'custom' ? '' : k.label.split(' ')[0]!);
            }}
          />
        ))}
      </Row>
      {taken(kind) ? <AppText variant="caption" muted>You already have a {kind} place. Delete it first to replace it.</AppText> : null}
      <TextField label="Name" value={label} onChangeText={(t) => { setLabel(t); setError(null); }} maxLength={60} error={error} placeholder="e.g. Auntie’s house" />
      {place ? (
        <Card>
          <AppText variant="caption" muted>
            LOCATION
          </AppText>
          <AppText variant="bodyStrong">{place.label}</AppText>
          <Button compact kind="ghost" title="Change" onPress={() => setPlaceRef(null)} />
        </Card>
      ) : (
        <View style={{ gap: spacing.sm }}>
          <AppText variant="heading">Choose the location</AppText>
          <PlaceSearch onPick={setPlaceRef} showShortcuts={false} />
        </View>
      )}
      <Button title="Save place" icon="bookmark" onPress={save} loading={busy} disabled={!place || taken(kind)} />
    </Screen>
  );
}
