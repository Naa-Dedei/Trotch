import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Screen } from '@/components/Screen';
import { Banner, Button, LoadingState } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { friendlyError } from '@/services/supabase/client';

/** Landing route for email-confirmation and OAuth deep links (trotch://auth/callback?code=…). */
export default function AuthCallbackScreen() {
  const url = Linking.useLinkingURL();
  const { session, exchangeCodeFromUrl } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session) {
      router.replace('/');
      return;
    }
    if (!url) return;
    exchangeCodeFromUrl(url)
      .then((ok) => ok && router.replace('/'))
      .catch((e) => setError(friendlyError(e, 'This sign-in link is invalid or has expired.')));
  }, [url, session, exchangeCodeFromUrl]);

  if (error) {
    return (
      <Screen edges={['bottom']}>
        <Banner tone="danger" message={error} />
        <Button title="Back to sign in" onPress={() => router.replace('/auth/sign-in')} />
      </Screen>
    );
  }
  return <LoadingState message="Signing you in…" />;
}
