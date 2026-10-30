import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Screen } from '@/components/Screen';
import { AppText, Banner, Card, ListRow } from '@/components/ui';
import { spacing } from '@/constants/theme';
import { createAdminService } from '@/features/admin/adminService';
import { useAuth } from '@/features/auth/AuthProvider';
import { useNetwork } from '@/features/network/NetworkProvider';
import { supabase } from '@/services/supabase/client';

export default function AdminHome() {
  const { isStaff } = useAuth();
  const { loaded } = useNetwork();
  const admin = useMemo(() => createAdminService(supabase, isStaff), [isStaff]);
  const [openReports, setOpenReports] = useState<number | null>(null);

  useEffect(() => {
    admin
      .listReports('open')
      .then((r) => setOpenReports(r.length))
      .catch(() => setOpenReports(null));
  }, [admin]);

  const n = loaded?.network;
  const demoCount = n ? n.routes.filter((r) => r.quality.isDemo).length : 0;
  const unverified = n ? n.routes.filter((r) => r.quality.verification !== 'verified').length : 0;

  return (
    <Screen edges={['bottom']} testID="admin-home">
      <AppText muted>Changes go live for everyone once saved. Mark data as verified only after it has been checked.</AppText>
      {demoCount > 0 ? <Banner tone="warning" message={`${demoCount} route(s) are DEMO records. Replace them with surveyed data before launch.`} /> : null}
      <Card style={{ paddingVertical: spacing.xs }}>
        <ListRow icon="location-outline" title="Stops" subtitle={`${n?.stops.length ?? 0} stops`} onPress={() => router.push('/admin/stops')} />
        <ListRow icon="git-branch-outline" title="Routes, stop order, fares and paths" subtitle={`${n?.routes.length ?? 0} routes · ${unverified} not verified`} onPress={() => router.push('/admin/routes')} />
        <ListRow icon="flag-outline" title="Community reports" subtitle={openReports === null ? 'Review user reports' : `${openReports} open`} onPress={() => router.push('/admin/reports')} />
      </Card>
    </Screen>
  );
}
