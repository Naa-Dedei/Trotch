import { useState } from 'react';
import { Screen } from '@/components/Screen';
import { AppText, Banner, Button, TextField } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { emailSchema } from '@/features/auth/schemas';
import { friendlyError } from '@/services/supabase/client';

export default function ForgotPasswordScreen() {
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Invalid email');
    setBusy(true);
    try {
      await sendPasswordReset(parsed.data);
      setSent(true);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <AppText muted>Enter your email and we’ll send you a link to choose a new password.</AppText>
      {sent ? (
        // Same message whether or not the account exists, to avoid revealing who has an account.
        <Banner tone="success" title="Check your email" message="If an account exists for that address, a reset link is on its way. Open it on this phone." />
      ) : (
        <>
          <TextField label="Email" value={email} onChangeText={(t) => { setEmail(t); setError(null); }} autoCapitalize="none" keyboardType="email-address" autoComplete="email" error={error} onSubmitEditing={submit} />
          <Button title="Send reset link" loading={busy} onPress={submit} />
        </>
      )}
    </Screen>
  );
}
