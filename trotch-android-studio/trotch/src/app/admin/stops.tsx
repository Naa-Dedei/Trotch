import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Screen } from '@/components/Screen';
import { Button, Card, ListRow, TextField } from '@/components/ui';
import { spacing } from '@/constants/theme';
import { normalise } from '@/features/locations/search';
import { useNetwork } from '@/features/network/NetworkProvider';
import { VERIFICATION_LABEL } from '@/features/routing/format';

export default function AdminStops() {
  const { loaded, refresh, refreshing } = useNetwork();
  const [q, setQ] = useState('');
  const stops = useMemo(() => {
    const n = normalise(q);
    return (loaded?.network.stops ?? []).filter((s) => !n || normalise(`${s.name} ${s.aliases.join(' ')}`).includes(n));
  }, [loaded, q]);

  return (
    <Screen edges={['bottom']} refreshing={refreshing} onRefresh={refresh}>
      <Button icon="add" title="New stop" onPress={() => router.push({ pathname: '/admin/stop/[id]', params: { id: 'new' } })} />
      <TextField label="Search" icon="search" value={q} onChangeText={setQ} autoCorrect={false} />
      <Card style={{ paddingVertical: spacing.xs }}>
        {stops.map((s) => (
          <ListRow
            key={s.id}
            icon={s.isActive ? 'location' : 'remove-circle-outline'}
            title={s.name}
            subtitle={`${s.kind} · ${VERIFICATION_LABEL[s.quality.verification]}${s.quality.isDemo ? ' · DEMO' : ''}${s.isActive ? '' : ' · inactive'}`}
            onPress={() => router.push({ pathname: '/admin/stop/[id]', params: { id: s.id } })}
          />
        ))}
      </Card>
    </Screen>
  );
}
