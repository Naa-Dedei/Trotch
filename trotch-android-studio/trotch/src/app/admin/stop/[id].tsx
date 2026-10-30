import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { ChoiceRow, ToggleRow, VerificationChoice } from '@/components/FormControls';
import { TransitMap } from '@/components/map/TransitMap';
import { Screen } from '@/components/Screen';
import { Banner, Button, Row, TextField } from '@/components/ui';
import { spacing } from '@/constants/theme';
import { createAdminService, stopFormSchema, type StopFormInput } from '@/features/admin/adminService';
import { fieldErrors } from '@/features/auth/schemas';
import { useAuth } from '@/features/auth/AuthProvider';
import { useNetwork } from '@/features/network/NetworkProvider';
import { env } from '@/lib/env';
import { getCurrentPosition } from '@/services/geo/location';
import { friendlyError, supabase } from '@/services/supabase/client';
import type { VerificationStatus } from '@/types/transport';

const KINDS = ['terminal', 'station', 'roadside', 'landmark'] as const;

export default function AdminStopEdit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const { isStaff } = useAuth();
  const { loaded, refresh } = useNetwork();
  const admin = useMemo(() => createAdminService(supabase, isStaff), [isStaff]);
  const existing = loaded?.network.stops.find((s) => s.id === id);

  const [form, setForm] = useState<StopFormInput>(() => ({
    cityId: existing?.cityId ?? env.cityId,
    name: existing?.name ?? '',
    kind: existing?.kind ?? 'roadside',
    lat: existing ? String(existing.lat) : '',
    lng: existing ? String(existing.lng) : '',
    landmarkHint: existing?.landmarkHint ?? '',
    aliases: existing?.aliases.join(', ') ?? '',
    verification: existing?.quality.verification ?? 'unverified',
    isActive: existing?.isActive ?? true,
    isDemo: existing?.quality.isDemo ?? false,
    markVerifiedNow: false,
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof StopFormInput>(k: K, v: StopFormInput[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: '' }));
  };

  const lat = Number(form.lat);
  const lng = Number(form.lng);
  const hasPoint = Number.isFinite(lat) && Number.isFinite(lng) && form.lat !== '' && form.lng !== '';

  const save = async () => {
    const parsed = stopFormSchema.safeParse(form);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setBusy(true);
    try {
      await admin.saveStop(isNew ? null : id, form);
      await refresh();
      router.back();
    } catch (e) {
      Alert.alert('Could not save stop', friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      {!isNew && !existing ? <Banner tone="danger" message="Stop not found in the loaded network." /> : null}
      <TextField label="Name" value={form.name} onChangeText={(t) => set('name', t)} error={errors.name || null} />
      <ChoiceRow label="Type" options={KINDS} value={form.kind} onChange={(v) => set('kind', v)} />
      <Row>
        <View style={{ flex: 1 }}>
          <TextField label="Latitude" keyboardType="numbers-and-punctuation" value={String(form.lat)} onChangeText={(t) => set('lat', t)} error={errors.lat || null} />
        </View>
        <View style={{ flex: 1 }}>
          <TextField label="Longitude" keyboardType="numbers-and-punctuation" value={String(form.lng)} onChangeText={(t) => set('lng', t)} error={errors.lng || null} />
        </View>
      </Row>
      <Button
        kind="secondary"
        compact
        icon="locate"
        title="Use my current position"
        onPress={async () => {
          const r = await getCurrentPosition();
          if (r.ok) {
            set('lat', r.position.lat.toFixed(6));
            set('lng', r.position.lng.toFixed(6));
          } else if (r.reason !== 'cancelled') Alert.alert('Location unavailable', r.message);
        }}
      />
      {hasPoint ? <TransitMap style={{ height: 180 }} stops={[{ id: 'p', lat, lng, name: form.name || 'New stop', kind: form.kind, selected: true }]} fitPoints={[{ lat, lng }]} /> : null}
      <TextField label="Boarding hint" placeholder="e.g. Opposite the Shell filling station" value={form.landmarkHint ?? ''} onChangeText={(t) => set('landmarkHint', t)} maxLength={300} error={errors.landmarkHint || null} />
      <TextField label="Other names (comma separated)" value={form.aliases} onChangeText={(t) => set('aliases', t)} hint="Local names people use, e.g. Odawna, Circle" />
      <TextField label="City id" value={form.cityId} onChangeText={(t) => set('cityId', t)} autoCapitalize="none" error={errors.cityId || null} />
      <VerificationChoice value={form.verification as VerificationStatus} onChange={(v) => set('verification', v)} />
      <View style={{ gap: spacing.md }}>
        <ToggleRow label="Record a verification check now" hint="Sets “last checked” to today" value={form.markVerifiedNow} onChange={(v) => set('markVerifiedNow', v)} />
        <ToggleRow label="Active" hint="Inactive stops are hidden from planning" value={form.isActive} onChange={(v) => set('isActive', v)} />
        <ToggleRow label="DEMO record" hint="Labels this stop as fictional/test data" value={form.isDemo} onChange={(v) => set('isDemo', v)} />
      </View>
      <Button title={isNew ? 'Create stop' : 'Save changes'} icon="save-outline" loading={busy} onPress={save} />
    </Screen>
  );
}
