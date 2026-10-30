import { Link, router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Screen } from '@/components/Screen';
import { AppText, Banner, Button, Divider, Row, TextField } from '@/components/ui';
import { colors, fonts, spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/AuthProvider';
import { fieldErrors, signInSchema } from '@/features/auth/schemas';
import { friendlyError } from '@/services/supabase/client';

export default function SignInScreen() {
  const { available, signInWithPassword, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'password' | 'google' | null>(null);

  const done = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const submit = async () => {
    const parsed = signInSchema.safeParse({ email, password });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setBusy('password');
    setFormError(null);
    try {
      await signInWithPassword(parsed.data.email, parsed.data.password);
      done();
    } catch (e) {
      setFormError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  };

  const google = async () => {
    setBusy('google');
    setFormError(null);
    try {
      if ((await signInWithGoogle()) === 'signed_in') done();
    } catch (e) {
      setFormError(friendlyError(e, 'Google sign-in failed. Please try again.'));
    } finally {
      setBusy(null);
    }
  };

  if (!available) {
    return (
      <Screen edges={['bottom']}>
        <Banner tone="info" title="Accounts unavailable" message="This build of Trotch has no account backend configured. You can still plan journeys without signing in." />
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']} testID="sign-in-screen">
      <View style={{ gap: spacing.xs }}>
        <AppText variant="title">Welcome back</AppText>
        <AppText muted>Sign in to use your saved places and journeys.</AppText>
      </View>
      <TextField
        testID="email"
        label="Email"
        value={email}
        onChangeText={(t) => { setEmail(t); setErrors((e) => ({ ...e, email: '' })); }}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        error={errors.email || null}
      />
      <TextField
        testID="password"
        label="Password"
        value={password}
        onChangeText={(t) => { setPassword(t); setErrors((e) => ({ ...e, password: '' })); }}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        error={errors.password || null}
        onSubmitEditing={submit}
        returnKeyType="go"
      />
      {formError ? <Banner tone="danger" message={formError} /> : null}
      <Button testID="sign-in-submit" title="Sign in" loading={busy === 'password'} disabled={!!busy} onPress={submit} />
      <Link href="/auth/forgot-password" style={{ color: colors.primary, fontFamily: fonts.semibold, alignSelf: 'center' }}>
        Forgot your password?
      </Link>
      <Row>
        <View style={{ flex: 1 }}><Divider /></View>
        <AppText variant="caption" muted>or</AppText>
        <View style={{ flex: 1 }}><Divider /></View>
      </Row>
      <Button kind="secondary" icon="logo-google" title="Continue with Google" loading={busy === 'google'} disabled={!!busy} onPress={google} />
      <Row style={{ justifyContent: 'center' }}>
        <AppText muted>New to Trotch?</AppText>
        <Link href="/auth/sign-up" replace style={{ color: colors.primary, fontFamily: fonts.semibold }}>
          Create an account
        </Link>
      </Row>
    </Screen>
  );
}
