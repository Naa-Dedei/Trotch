import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Screen } from '@/components/Screen';
import { Button, Card, ListRow, TextField } from '@/components/ui';
import { modeStyle, spacing } from '@/constants/theme';
import { normalise } from '@/features/locations/search';
import { useNetwork } from '@/features/network/NetworkProvider';
import { MODE_LABEL, VERIFICATION_LABEL } from '@/features/routing/format';

export default function AdminRoutes() {
  const { loaded, refresh, refreshing } = useNetwork();
  const [q, setQ] = useState('');
  const routes = useMemo(() => {
    const n = normalise(q);
    return (loaded?.network.routes ?? []).filter((r) => !n || normalise(`${r.name} ${r.headsign} ${r.code ?? ''}`).includes(n));
  }, [loaded, q]);

  return (
    <Screen edges={['bottom']} refreshing={refreshing} onRefresh={refresh}>
      <Button icon="add" title="New route" onPress={() => router.push({ pathname: '/admin/route/[id]', params: { id: 'new' } })} />
      <TextField label="Search" icon="search" value={q} onChangeText={setQ} autoCorrect={false} />
      <Card style={{ paddingVertical: spacing.xs }}>
        {routes.map((r) => (
          <ListRow
            key={r.id}
            icon={modeStyle[r.mode].icon}
            iconColor={modeStyle[r.mode].color}
            title={r.name}
            subtitle={`${MODE_LABEL[r.mode]} → ${r.headsign} · ${r.stops.length} stops · ${VERIFICATION_LABEL[r.quality.verification]}${r.quality.isDemo ? ' · DEMO' : ''}${r.isActive ? '' : ' · inactive'}`}
            onPress={() => router.push({ pathname: '/admin/route/[id]', params: { id: r.id } })}
          />
        ))}
      </Card>
    </Screen>
  );
}
