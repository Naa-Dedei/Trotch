import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Screen } from '@/components/Screen';
import { AppText, Banner, Button, Chip, Row, TextField } from '@/components/ui';
import { spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/AuthProvider';
import { useNetwork } from '@/features/network/NetworkProvider';
import { REPORT_TYPE_LABEL, reportFormSchema, reportTypes, submitReport, type ReportType } from '@/features/reports/reportService';
import { friendlyError, supabase } from '@/services/supabase/client';

export default function ReportScreen() {
  const params = useLocalSearchParams<{ type?: string; routeId?: string; stopId?: string; context?: string }>();
  const { user, available } = useAuth();
  const { loaded } = useNetwork();
  const initialType = (reportTypes as readonly string[]).includes(params.type ?? '') ? (params.type as ReportType) : 'route_info';
  const [type, setType] = useState<ReportType>(initialType);
  const [description, setDescription] = useState('');
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (!available) {
    return (
      <Screen edges={['bottom']}>
        <Banner tone="info" message="Reporting needs the Trotch backend, which isn’t configured on this build." />
      </Screen>
    );
  }
  if (!user) return <Redirect href="/auth/sign-in" />;

  const routeName = loaded?.network.routes.find((r) => r.id === params.routeId)?.name;
  const stopName = loaded?.network.stops.find((s) => s.id === params.stopId)?.name;
  // Report targets must be real network ids; ignore anything else (e.g. demo-only data without a backend).
  const isUuid = (v?: string) => !!v && /^[0-9a-f-]{36}$/i.test(v);

  const submit = async () => {
    const input = {
      type,
      description,
      routeId: isUuid(params.routeId) ? params.routeId! : null,
      stopId: isUuid(params.stopId) ? params.stopId! : null,
      suggestedMin: min,
      suggestedMax: max,
    };
    const parsed = reportFormSchema.safeParse(input);
    if (!parsed.success) {
      const e: Record<string, string> = {};
      for (const issue of parsed.error.issues) e[String(issue.path[0])] ??= issue.message;
      setErrors(e);
      return;
    }
    setBusy(true);
    setSubmitError(null);
    try {
      await submitReport(supabase, user.id, input, params.context ? { context: params.context } : null);
      setDone(true);
    } catch (e) {
      setSubmitError(friendlyError(e, "Couldn't send your report. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Screen edges={['bottom']}>
        <Banner tone="success" title="Thank you!" message="Your report was sent to the Trotch team for review. Community reports are checked before any route information is changed." />
        <Button title="Done" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']} testID="report-screen">
      {routeName || stopName || params.context ? (
        <AppText muted>About: {routeName ?? stopName ?? params.context}</AppText>
      ) : null}
      <View style={{ gap: spacing.sm }}>
        <AppText variant="heading">What’s wrong?</AppText>
        <Row style={{ flexWrap: 'wrap' }}>
          {reportTypes.map((t) => (
            <Chip key={t} testID={`report-type-${t}`} label={REPORT_TYPE_LABEL[t]} selected={type === t} onPress={() => setType(t)} />
          ))}
        </Row>
      </View>
      <TextField
        testID="report-description"
        label="Details"
        placeholder={type === 'missing_route' ? 'Where does it start and end? Which stops does it pass?' : 'Tell us what you saw'}
        value={description}
        onChangeText={(t) => { setDescription(t); setErrors((e) => ({ ...e, description: '' })); }}
        multiline
        numberOfLines={5}
        style={{ minHeight: 110, textAlignVertical: 'top' }}
        maxLength={1000}
        error={errors.description || null}
      />
      {type === 'fare_change' ? (
        <Row>
          <View style={{ flex: 1 }}>
            <TextField label="Fare now (min GH₵)" keyboardType="decimal-pad" value={min} onChangeText={setMin} error={errors.suggestedMin || null} />
          </View>
          <View style={{ flex: 1 }}>
            <TextField label="Max GH₵ (optional)" keyboardType="decimal-pad" value={max} onChangeText={setMax} error={errors.suggestedMax || null} />
          </View>
        </Row>
      ) : null}
      {submitError ? <Banner tone="danger" message={submitError} /> : null}
      <Button testID="submit-report" title="Send report" icon="send" loading={busy} onPress={submit} />
      <AppText variant="caption" muted>
        Reports are reviewed by the Trotch team. They are never applied automatically.
      </AppText>
    </Screen>
  );
}
