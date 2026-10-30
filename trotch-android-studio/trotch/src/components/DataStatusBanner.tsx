import { Banner, Button } from '@/components/ui';
import { useNetwork } from '@/features/network/NetworkProvider';
import { formatRelativeDate } from '@/features/routing/format';

/** Tells the user where the transport data came from: live, cached (offline) or bundled DEMO. */
export function DataStatusBanner({ compact }: { compact?: boolean }) {
  const { loaded, error, refreshing, refresh } = useNetwork();
  if (!loaded) return null;
  if (loaded.origin === 'bundled_demo') {
    return (
      <Banner
        testID="demo-banner"
        tone="warning"
        title="Demo mode"
        message={
          compact
            ? 'Sample DEMO routes — not real-world verified.'
            : 'Trotch is showing a small DEMO network with sample routes and fares. It is for testing only and is not real-world verified.'
        }
      />
    );
  }
  if (loaded.origin === 'cache' && (error || loaded.refreshError)) {
    return (
      <Banner
        testID="cache-banner"
        tone="info"
        title="Showing saved copy"
        message={`Couldn't refresh transport data. Using the copy saved ${formatRelativeDate(loaded.fetchedAt)}.`}
        action={compact ? undefined : <Button title="Retry" kind="ghost" compact icon="refresh" loading={refreshing} onPress={refresh} />}
      />
    );
  }
  return null;
}
