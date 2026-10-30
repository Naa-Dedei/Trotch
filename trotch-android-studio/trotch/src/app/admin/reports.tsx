import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { AppText, Badge, Banner, Button, Card, Chip, EmptyState, LoadingState, Row, TextField } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { createAdminService, reportStatuses, type AdminReport, type ReportStatus } from '@/features/admin/adminService';
import { useAuth } from '@/features/auth/AuthProvider';
import { useNetwork } from '@/features/network/NetworkProvider';
import { REPORT_TYPE_LABEL, reportTypes, type ReportType } from '@/features/reports/reportService';
import { formatFareRange, formatRelativeDate } from '@/features/routing/format';
import { friendlyError, supabase } from '@/services/supabase/client';

const STATUS_LABEL: Record<ReportStatus, string> = { open: 'Open', in_review: 'In review', resolved: 'Resolved', rejected: 'Rejected' };

function ReportCard({ report, onReview }: { report: AdminReport; onReview: (status: ReportStatus, notes: string) => Promise<void> }) {
  const { loaded } = useNetwork();
  const [notes, setNotes] = useState(report.reviewer_notes ?? '');
  const route = loaded?.network.routes.find((r) => r.id === report.route_id);
  const stop = loaded?.network.stops.find((s) => s.id === report.stop_id);
  const type = (reportTypes as readonly string[]).includes(report.report_type) ? REPORT_TYPE_LABEL[report.report_type as ReportType] : report.report_type;
  const context = (report.journey_context as { context?: string } | null)?.context;

  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <Badge label={STATUS_LABEL[report.status]} fg={colors.primaryDark} bg={colors.primarySoft} />
        <AppText variant="caption" muted>
          {formatRelativeDate(report.created_at)}
        </AppText>
      </Row>
      <AppText variant="bodyStrong">{type}</AppText>
      <AppText>{report.description}</AppText>
      {context ? <AppText variant="caption" muted>Context: {context}</AppText> : null}
      {report.suggested_min_ghs !== null ? (
        <AppText variant="caption">Suggested fare: {formatFareRange(report.suggested_min_ghs, report.suggested_max_ghs ?? report.suggested_min_ghs)}</AppText>
      ) : null}
      <Row style={{ flexWrap: 'wrap' }}>
        {route ? <Button compact kind="ghost" title={`Edit route: ${route.name}`} onPress={() => router.push({ pathname: '/admin/route/[id]', params: { id: route.id } })} /> : null}
        {stop ? <Button compact kind="ghost" title={`Edit stop: ${stop.name}`} onPress={() => router.push({ pathname: '/admin/stop/[id]', params: { id: stop.id } })} /> : null}
      </Row>
      <TextField label="Reviewer notes" value={notes} onChangeText={setNotes} multiline maxLength={1000} />
      <Row style={{ flexWrap: 'wrap' }}>
        {(['in_review', 'resolved', 'rejected'] as const).map((s) => (
          <Button key={s} compact kind={s === 'rejected' ? 'danger' : 'secondary'} title={STATUS_LABEL[s]} onPress={() => onReview(s, notes)} />
        ))}
      </Row>
      <AppText variant="caption" muted>
        Resolving a report doesn’t change any route data. Edit the route or stop to apply a correction.
      </AppText>
    </Card>
  );
}

export default function AdminReports() {
  const { isStaff } = useAuth();
  const admin = useMemo(() => createAdminService(supabase, isStaff), [isStaff]);
  const [status, setStatus] = useState<ReportStatus | 'all'>('open');
  const [reports, setReports] = useState<AdminReport[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = useCallback(
    async (): Promise<{ reports: AdminReport[]; error: string | null }> => {
      try {
        return { reports: await admin.listReports(status), error: null };
      } catch (e) {
        return { reports: [], error: friendlyError(e) };
      }
    },
    [admin, status],
  );

  useEffect(() => {
    let cancelled = false;
    fetchReports().then((r) => {
      if (cancelled) return;
      setReports(r.reports);
      setError(r.error);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchReports]);

  const load = async () => {
    const r = await fetchReports();
    setReports(r.reports);
    setError(r.error);
  };

  return (
    <Screen edges={['bottom']} refreshing={reports === null} onRefresh={load}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        {(['all', ...reportStatuses] as const).map((s) => (
          <Chip key={s} label={s === 'all' ? 'All' : STATUS_LABEL[s]} selected={status === s} onPress={() => {
              setReports(null);
              setStatus(s);
            }} />
        ))}
      </ScrollView>
      {error ? <Banner tone="danger" message={error} /> : null}
      {reports === null ? (
        <LoadingState />
      ) : reports.length === 0 ? (
        <EmptyState icon="checkmark-done-outline" title="Nothing here" message="No reports with this status." />
      ) : (
        <View style={{ gap: spacing.md }}>
          {reports.map((r) => (
            <ReportCard
              key={r.id}
              report={r}
              onReview={async (s, notes) => {
                try {
                  await admin.reviewReport(r.id, s, notes);
                  await load();
                } catch (e) {
                  Alert.alert('Could not update report', friendlyError(e));
                }
              }}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}
