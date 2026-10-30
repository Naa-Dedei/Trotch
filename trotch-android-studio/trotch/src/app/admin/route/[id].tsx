import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { ChoiceRow, ToggleRow, VerificationChoice } from '@/components/FormControls';
import { TransitMap } from '@/components/map/TransitMap';
import { Screen } from '@/components/Screen';
import { AppText, Banner, Button, Card, IconButton, ListRow, Row, Section, TextField } from '@/components/ui';
import { colors, modeStyle, spacing } from '@/constants/theme';
import { createAdminService, fareFormSchema, routeFormSchema, routeStopsSchema, type FareFormInput, type RouteFormInput } from '@/features/admin/adminService';
import { fieldErrors } from '@/features/auth/schemas';
import { useAuth } from '@/features/auth/AuthProvider';
import { routeOverlay } from '@/features/map/journeyOverlays';
import { normalise } from '@/features/locations/search';
import { useNetwork } from '@/features/network/NetworkProvider';
import { formatFareRange, MODE_LABEL, VERIFICATION_LABEL } from '@/features/routing/format';
import { env } from '@/lib/env';
import { friendlyError, supabase } from '@/services/supabase/client';
import type { VerificationStatus } from '@/types/transport';

const MODES = ['trotro', 'shared_taxi', 'bus', 'intercity_bus'] as const;

interface EditableStop {
  stopId: string;
  minutes: string;
}

export default function AdminRouteEdit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const { isStaff } = useAuth();
  const { loaded, refresh } = useNetwork();
  const admin = useMemo(() => createAdminService(supabase, isStaff), [isStaff]);
  const network = loaded?.network;
  const existing = network?.routes.find((r) => r.id === id);
  const stopsById = useMemo(() => new Map((network?.stops ?? []).map((s) => [s.id, s])), [network]);

  // --- route details -------------------------------------------------------
  const [form, setForm] = useState<RouteFormInput>(() => ({
    cityId: existing?.cityId ?? env.cityId,
    name: existing?.name ?? '',
    code: existing?.code ?? '',
    mode: existing?.mode ?? 'trotro',
    headsign: existing?.headsign ?? '',
    callOut: existing?.callOut ?? '',
    typicalWaitMin: existing?.typicalWaitMin != null ? String(existing.typicalWaitMin) : '',
    notes: existing?.notes ?? '',
    verification: existing?.quality.verification ?? 'unverified',
    isActive: existing?.isActive ?? true,
    isDemo: existing?.quality.isDemo ?? false,
    markVerifiedNow: false,
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const set = <K extends keyof RouteFormInput>(k: K, v: RouteFormInput[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: '' }));
  };

  // --- ordered stops ---------------------------------------------------------
  const [stops, setStops] = useState<EditableStop[]>(() =>
    (existing?.stops ?? []).map((s) => ({ stopId: s.stopId, minutes: s.minutesFromPrevious == null ? '' : String(s.minutesFromPrevious) })),
  );
  const [stopQuery, setStopQuery] = useState('');
  const [stopsError, setStopsError] = useState<string | null>(null);
  const candidates = useMemo(() => {
    const n = normalise(stopQuery);
    if (n.length < 2) return [];
    return (network?.stops ?? []).filter((s) => normalise(`${s.name} ${s.aliases.join(' ')}`).includes(n)).slice(0, 6);
  }, [network, stopQuery]);

  const move = (i: number, d: -1 | 1) =>
    setStops((list) => {
      const j = i + d;
      if (j < 0 || j >= list.length) return list;
      const next = list.slice();
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });

  // --- fares -----------------------------------------------------------------
  const fares = useMemo(() => (network?.fares ?? []).filter((f) => f.routeId === id), [network, id]);
  const [fare, setFare] = useState<FareFormInput>({ fromStopId: null, toStopId: null, min: '', max: '', effectiveFrom: '', verification: 'unverified', isDemo: false });
  const [fareErrors, setFareErrors] = useState<Record<string, string>>({});

  const run = async (key: string, fn: () => Promise<void>, title: string) => {
    setBusy(key);
    try {
      await fn();
      await refresh();
    } catch (e) {
      const issues = (e as { issues?: { message: string }[] }).issues;
      Alert.alert(title, issues?.[0]?.message ?? friendlyError(e));
    } finally {
      setBusy(null);
    }
  };

  const saveDetails = async () => {
    const parsed = routeFormSchema.safeParse(form);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    await run(
      'details',
      async () => {
        const newId = await admin.saveRoute(isNew ? null : id, form);
        if (isNew) router.replace({ pathname: '/admin/route/[id]', params: { id: newId } });
      },
      'Could not save route',
    );
  };

  const saveStops = async () => {
    const parsed = routeStopsSchema.safeParse(stops);
    if (!parsed.success) return setStopsError(parsed.error.issues[0]?.message ?? 'Check the stops');
    setStopsError(null);
    await run('stops', () => admin.replaceRouteStops(id, stops), 'Could not save stop order');
  };

  const addFare = async () => {
    const parsed = fareFormSchema.safeParse(fare);
    if (!parsed.success) return setFareErrors(fieldErrors(parsed.error));
    setFareErrors({});
    await run(
      'fare',
      async () => {
        await admin.addFare(id, fare);
        setFare((f) => ({ ...f, min: '', max: '' }));
      },
      'Could not add fare',
    );
  };

  const overlay = network && existing ? routeOverlay(network, existing.id) : null;
  const pathFromStops = stops.flatMap((s) => {
    const st = stopsById.get(s.stopId);
    return st ? [[st.lng, st.lat] as [number, number]] : [];
  });
  const stopName = (sid: string | null) => (sid ? (stopsById.get(sid)?.name ?? '?') : '');

  return (
    <Screen edges={['bottom']}>
      {!isNew && !existing ? <Banner tone="danger" message="Route not found in the loaded network." /> : null}

      <Section title="Details">
        <TextField label="Name" placeholder="e.g. Circle – Madina" value={form.name} onChangeText={(t) => set('name', t)} error={errors.name || null} />
        <ChoiceRow label="Mode" options={MODES} value={form.mode} onChange={(v) => set('mode', v)} labels={MODE_LABEL} />
        <TextField label="Headsign (where it goes)" value={form.headsign} onChangeText={(t) => set('headsign', t)} error={errors.headsign || null} />
        <TextField label="Route number (optional)" value={form.code ?? ''} onChangeText={(t) => set('code', t)} hint="Leave blank — most trotro routes have no number" error={errors.code || null} />
        <TextField label="Mate’s call (optional)" value={form.callOut ?? ''} onChangeText={(t) => set('callOut', t)} placeholder="e.g. Madina! Madina!" />
        <TextField label="Typical wait, minutes (optional)" keyboardType="number-pad" value={form.typicalWaitMin} onChangeText={(t) => set('typicalWaitMin', t)} error={errors.typicalWaitMin || null} />
        <TextField label="Notes" value={form.notes ?? ''} onChangeText={(t) => set('notes', t)} multiline />
        <TextField label="City id" value={form.cityId} onChangeText={(t) => set('cityId', t)} autoCapitalize="none" error={errors.cityId || null} />
        <VerificationChoice value={form.verification as VerificationStatus} onChange={(v) => set('verification', v)} />
        <ToggleRow label="Record a verification check now" value={form.markVerifiedNow} onChange={(v) => set('markVerifiedNow', v)} />
        <ToggleRow label="Active" hint="Inactive routes are not used for planning" value={form.isActive} onChange={(v) => set('isActive', v)} />
        <ToggleRow label="DEMO record" value={form.isDemo} onChange={(v) => set('isDemo', v)} />
        <Button title={isNew ? 'Create route' : 'Save details'} icon="save-outline" loading={busy === 'details'} onPress={saveDetails} />
      </Section>

      {isNew ? (
        <AppText muted>Save the route first, then add its stops and fares.</AppText>
      ) : (
        <>
          <Section title="Stops in travel order">
            <AppText variant="caption" muted>
              Routes are one-way. Create a separate route for the return direction. Minutes = travel time from the previous stop (leave blank if unknown).
            </AppText>
            <Card style={{ paddingVertical: spacing.xs }}>
              {stops.length === 0 ? <AppText muted>No stops yet.</AppText> : null}
              {stops.map((s, i) => (
                <View key={`${s.stopId}-${i}`} style={{ paddingVertical: spacing.xs, gap: spacing.xs }}>
                  <Row>
                    <AppText variant="bodyStrong" style={{ flex: 1 }}>
                      {i + 1}. {stopName(s.stopId)}
                    </AppText>
                    <IconButton icon="arrow-up" label="Move up" onPress={() => move(i, -1)} disabled={i === 0} />
                    <IconButton icon="arrow-down" label="Move down" onPress={() => move(i, 1)} disabled={i === stops.length - 1} />
                    <IconButton icon="trash-outline" label="Remove stop" color={colors.danger} onPress={() => setStops((l) => l.filter((_, k) => k !== i))} />
                  </Row>
                  {i > 0 ? (
                    <TextField
                      label="Minutes from previous"
                      keyboardType="decimal-pad"
                      value={s.minutes}
                      onChangeText={(t) => setStops((l) => l.map((x, k) => (k === i ? { ...x, minutes: t } : x)))}
                    />
                  ) : null}
                </View>
              ))}
            </Card>
            <TextField label="Add a stop" icon="add" placeholder="Search stops" value={stopQuery} onChangeText={setStopQuery} autoCorrect={false} />
            {candidates.map((c) => (
              <ListRow
                key={c.id}
                icon="add-circle-outline"
                title={c.name}
                subtitle={c.kind}
                onPress={() => {
                  setStops((l) => [...l, { stopId: c.id, minutes: '' }]);
                  setStopQuery('');
                }}
              />
            ))}
            {stopsError ? <Banner tone="danger" message={stopsError} /> : null}
            <Button title="Save stop order" icon="save-outline" loading={busy === 'stops'} onPress={saveStops} />
          </Section>

          <Section title="Map path">
            {overlay ? (
              <TransitMap
                style={{ height: 200 }}
                overlays={[overlay]}
                stops={stops.flatMap((s) => {
                  const st = stopsById.get(s.stopId);
                  return st ? [{ id: st.id, lat: st.lat, lng: st.lng, name: st.name, kind: st.kind, color: modeStyle[form.mode].color }] : [];
                })}
                fitPoints={overlay.coordinates}
              />
            ) : null}
            <AppText variant="caption" muted>
              {existing?.path ? 'A drawn path is stored for this route.' : 'No drawn path: the map shows straight lines between stops.'}
            </AppText>
            <Row>
              <Button style={{ flex: 1 }} kind="secondary" compact title="Path from stops" loading={busy === 'path'} onPress={() => run('path', () => admin.setRoutePath(id, pathFromStops), 'Could not update path')} />
              <Button style={{ flex: 1 }} kind="ghost" compact title="Clear path" onPress={() => run('path', () => admin.setRoutePath(id, null), 'Could not clear path')} />
            </Row>
          </Section>

          <Section title="Fares (GH₵)">
            <Card style={{ paddingVertical: spacing.xs }}>
              {fares.length === 0 ? <AppText muted>No fares recorded.</AppText> : null}
              {fares.map((f) => (
                <ListRow
                  key={f.id}
                  icon="cash-outline"
                  title={`${f.fromStopId ? `${stopName(f.fromStopId)} → ${stopName(f.toStopId)}` : 'Whole route'}: ${formatFareRange(f.minGhs, f.maxGhs)}`}
                  subtitle={`${VERIFICATION_LABEL[f.quality.verification]}${f.quality.isDemo ? ' · DEMO' : ''} · ${f.effectiveFrom ?? 'no start'} → ${f.effectiveTo ?? 'current'}`}
                  right={
                    <Row gap={0}>
                      <IconButton icon="archive-outline" label="Mark fare outdated" color={colors.warning} onPress={() => run('fare', () => admin.retireFare(f.id), 'Could not retire fare')} />
                      <IconButton
                        icon="trash-outline"
                        label="Delete fare"
                        color={colors.danger}
                        onPress={() =>
                          Alert.alert('Delete fare?', 'Prefer “mark outdated” to keep history.', [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Delete', style: 'destructive', onPress: () => void run('fare', () => admin.deleteFare(f.id), 'Could not delete fare') },
                          ])
                        }
                      />
                    </Row>
                  }
                />
              ))}
            </Card>
            <Card>
              <AppText variant="heading">Add fare</AppText>
              <ChoiceRow
                label="Boarding stop (leave on ‘Whole route’ for a flat fare)"
                options={['__whole__', ...(existing?.stops.slice(0, -1).map((s) => s.stopId) ?? [])]}
                value={fare.fromStopId ?? '__whole__'}
                onChange={(v) => setFare((f) => ({ ...f, fromStopId: v === '__whole__' ? null : v, toStopId: v === '__whole__' ? null : f.toStopId }))}
                labels={Object.fromEntries([['__whole__', 'Whole route'], ...(existing?.stops ?? []).map((s) => [s.stopId, stopName(s.stopId)])])}
              />
              {fare.fromStopId ? (
                <ChoiceRow
                  label="Alighting stop"
                  options={(existing?.stops ?? [])
                    .slice((existing?.stops.findIndex((s) => s.stopId === fare.fromStopId) ?? 0) + 1)
                    .map((s) => s.stopId)}
                  value={fare.toStopId ?? ''}
                  onChange={(v) => setFare((f) => ({ ...f, toStopId: v }))}
                  labels={Object.fromEntries((existing?.stops ?? []).map((s) => [s.stopId, stopName(s.stopId)]))}
                />
              ) : null}
              {fareErrors.toStopId ? <AppText variant="caption" color={colors.danger}>{fareErrors.toStopId}</AppText> : null}
              <Row>
                <View style={{ flex: 1 }}>
                  <TextField label="Min" keyboardType="decimal-pad" value={String(fare.min)} onChangeText={(t) => setFare((f) => ({ ...f, min: t }))} error={fareErrors.min || null} />
                </View>
                <View style={{ flex: 1 }}>
                  <TextField label="Max" keyboardType="decimal-pad" value={String(fare.max)} onChangeText={(t) => setFare((f) => ({ ...f, max: t }))} error={fareErrors.max || null} />
                </View>
              </Row>
              <TextField label="Effective from (YYYY-MM-DD)" value={fare.effectiveFrom} onChangeText={(t) => setFare((f) => ({ ...f, effectiveFrom: t }))} error={fareErrors.effectiveFrom || null} />
              <VerificationChoice value={fare.verification as VerificationStatus} onChange={(v) => setFare((f) => ({ ...f, verification: v }))} />
              <ToggleRow label="DEMO fare" value={fare.isDemo} onChange={(v) => setFare((f) => ({ ...f, isDemo: v }))} />
              <Button title="Add fare" icon="add" loading={busy === 'fare'} onPress={addFare} />
            </Card>
          </Section>
        </>
      )}
    </Screen>
  );
}
