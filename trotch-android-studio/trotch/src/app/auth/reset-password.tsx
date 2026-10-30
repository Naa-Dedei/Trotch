import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Screen } from '@/components/Screen';
import { AppText, Banner, Button, LoadingState, TextField } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { fieldErrors, resetSchema } from '@/features/auth/schemas';
import { friendlyError } from '@/services/supabase/client';

/** Opened from the password-reset email link (trotch://auth/reset-password?code=…). */
export default function ResetPasswordScreen() {
  const url = Linking.useLinkingURL();
  const { session, exchangeCodeFromUrl, updatePassword } = useAuth();
  const [exchanging, setExchanging] = useState(true);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (url && !session) await exchangeCodeFromUrl(url);
      } catch (e) {
        if (active) setLinkError(friendlyError(e, 'This reset link is invalid or has expired. Request a new one.'));
      } finally {
        if (active) setExchanging(false);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  const submit = async () => {
    const parsed = resetSchema.safeParse(form);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setBusy(true);
    try {
      await updatePassword(parsed.data.password);
      setDone(true);
    } catch (e) {
      setErrors({ form: friendlyError(e) });
    } finally {
      setBusy(false);
    }
  };

  if (exchanging) return <LoadingState message="Checking your link…" />;
  if (done) {
    return (
      <Screen edges={['bottom']}>
        <Banner tone="success" title="Password updated" message="You’re signed in with your new password." />
        <Button title="Continue" onPress={() => router.replace('/')} />
      </Screen>
    );
  }
  if (linkError || !session) {
    return (
      <Screen edges={['bottom']}>
        <Banner tone="danger" message={linkError ?? 'Open the reset link from your email on this phone to continue.'} />
        <Button kind="secondary" title="Request a new link" onPress={() => router.replace('/auth/forgot-password')} />
      </Screen>
    );
  }
  return (
    <Screen edges={['bottom']}>
      <AppText muted>Choose a new password for {session.user.email}.</AppText>
      <TextField label="New password" secureTextEntry value={form.password} onChangeText={(t) => setForm((f) => ({ ...f, password: t }))} autoComplete="new-password" error={errors.password || null} />
      <TextField label="Confirm password" secureTextEntry value={form.confirm} onChangeText={(t) => setForm((f) => ({ ...f, confirm: t }))} error={errors.confirm || null} />
      {errors.form ? <Banner tone="danger" message={errors.form} /> : null}
      <Button title="Update password" loading={busy} onPress={submit} />
    </Screen>
  );
}
