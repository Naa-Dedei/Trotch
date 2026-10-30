import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Screen } from '@/components/Screen';
import { AppText, Banner, Button, Row, TextField } from '@/components/ui';
import { colors, fonts } from '@/constants/theme';
import { useAuth } from '@/features/auth/AuthProvider';
import { fieldErrors, signUpSchema } from '@/features/auth/schemas';
import { friendlyError } from '@/services/supabase/client';

export default function SignUpScreen() {
  const { available, signUp } = useAuth();
  const [form, setForm] = useState({ displayName: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  const set = (k: keyof typeof form) => (t: string) => {
    setForm((f) => ({ ...f, [k]: t }));
    setErrors((e) => ({ ...e, [k]: '' }));
  };

  const submit = async () => {
    const parsed = signUpSchema.safeParse(form);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setBusy(true);
    setFormError(null);
    try {
      const { needsConfirmation } = await signUp(parsed.data.email, parsed.data.password, parsed.data.displayName);
      if (needsConfirmation) setCheckEmail(true);
      else if (router.canGoBack()) router.back();
      else router.replace('/');
    } catch (e) {
      setFormError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  if (!available) {
    return (
      <Screen edges={['bottom']}>
        <Banner tone="info" message="Accounts aren’t available on this build." />
      </Screen>
    );
  }
  if (checkEmail) {
    return (
      <Screen edges={['bottom']}>
        <Banner tone="success" title="Check your email" message={`We sent a confirmation link to ${form.email.trim()}. Open it on this phone to finish creating your account.`} />
        <Button kind="secondary" title="Back to sign in" onPress={() => router.replace('/auth/sign-in')} />
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']}>
      <AppText variant="title">Create your account</AppText>
      <TextField label="Your name" value={form.displayName} onChangeText={set('displayName')} autoComplete="name" maxLength={60} error={errors.displayName || null} />
      <TextField label="Email" value={form.email} onChangeText={set('email')} autoCapitalize="none" autoComplete="email" keyboardType="email-address" error={errors.email || null} />
      <TextField label="Password" value={form.password} onChangeText={set('password')} secureTextEntry autoComplete="new-password" textContentType="newPassword" hint="At least 8 characters, with a letter and a number" error={errors.password || null} />
      <TextField label="Confirm password" value={form.confirm} onChangeText={set('confirm')} secureTextEntry autoComplete="new-password" error={errors.confirm || null} onSubmitEditing={submit} />
      {formError ? <Banner tone="danger" message={formError} /> : null}
      <Button title="Create account" loading={busy} onPress={submit} />
      <Row style={{ justifyContent: 'center' }}>
        <AppText muted>Already have an account?</AppText>
        <Link href="/auth/sign-in" replace style={{ color: colors.primary, fontFamily: fonts.semibold }}>
          Sign in
        </Link>
      </Row>
    </Screen>
  );
}
