import type { Session, User } from '@supabase/supabase-js';
import { makeRedirectUri } from 'expo-auth-session';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase, requireSupabase } from '@/services/supabase/client';

WebBrowser.maybeCompleteAuthSession();

export interface Profile {
  id: string;
  displayName: string | null;
}

interface AuthState {
  /** False when the build has no backend; accounts are then unavailable but planning still works. */
  available: boolean;
  initialising: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  /** Server-confirmed staff status (admin/editor). The database enforces this independently via RLS. */
  isStaff: boolean;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ needsConfirmation: boolean }>;
  signInWithGoogle: () => Promise<'signed_in' | 'cancelled'>;
  sendPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  exchangeCodeFromUrl: (url: string) => Promise<boolean>;
  updateDisplayName: (name: string) => Promise<void>;
  signOut: () => Promise<void>;
  reloadProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/**
 * A PKCE code can be exchanged only once. On Android the OAuth redirect reaches both
 * openAuthSessionAsync() and the /auth/callback deep-link route, so both would try to
 * exchange it and the loser would show a false "link expired" error. Share one exchange per code.
 */
const codeExchanges = new Map<string, Promise<void>>();

export const authRedirect = (path: 'auth/callback' | 'auth/reset-password') => makeRedirectUri({ scheme: 'trotch', path });

function codeFromUrl(url: string): { code: string | null; error: string | null } {
  const { queryParams } = Linking.parse(url);
  const get = (k: string) => {
    const v = queryParams?.[k];
    return typeof v === 'string' ? v : null;
  };
  return { code: get('code'), error: get('error_description') ?? get('error') };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initialising, setInitialising] = useState(!!supabase);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isStaff, setIsStaff] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    supabase.auth
      .getSession()
      .then(({ data }) => mounted && setSession(data.session))
      .finally(() => mounted && setInitialising(false));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user.id ?? null;

  const fetchProfile = useCallback(async (): Promise<{ profile: Profile; isStaff: boolean } | null> => {
    if (!supabase || !userId) return null;
    const [{ data: p }, { data: staff }] = await Promise.all([
      supabase.from('profiles').select('id, display_name').eq('id', userId).maybeSingle(),
      supabase.rpc('is_network_editor'),
    ]);
    const row = p as { id: string; display_name: string | null } | null;
    return { profile: row ? { id: row.id, displayName: row.display_name } : { id: userId, displayName: null }, isStaff: staff === true };
  }, [userId]);

  const reloadProfile = useCallback(async () => {
    const r = await fetchProfile();
    setProfile(r?.profile ?? null);
    setIsStaff(r?.isStaff ?? false);
  }, [fetchProfile]);

  useEffect(() => {
    let cancelled = false;
    fetchProfile()
      .then((r) => {
        if (cancelled || !r) return;
        setProfile(r.profile);
        setIsStaff(r.isStaff);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [fetchProfile]);

  // Never expose a previous user's profile or staff flag after sign-out / account switch.
  const currentProfile = userId && profile?.id === userId ? profile : null;
  const currentIsStaff = !!currentProfile && isStaff;

  const exchangeCodeFromUrl = useCallback(async (url: string) => {
    const sb = requireSupabase();
    const { code, error } = codeFromUrl(url);
    if (error) throw new Error(error);
    if (!code) return false;
    let pending = codeExchanges.get(code);
    if (!pending) {
      pending = sb.auth.exchangeCodeForSession(code).then(({ error: exErr }) => {
        if (exErr) throw exErr;
      });
      codeExchanges.set(code, pending);
    }
    await pending;
    return true;
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      available: !!supabase,
      initialising,
      session,
      user: session?.user ?? null,
      profile: currentProfile,
      isStaff: currentIsStaff,
      reloadProfile,
      exchangeCodeFromUrl,
      async signInWithPassword(email, password) {
        const { error } = await requireSupabase().auth.signInWithPassword({ email, password });
        if (error) throw error;
      },
      async signUp(email, password, displayName) {
        const { data, error } = await requireSupabase().auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName }, emailRedirectTo: authRedirect('auth/callback') },
        });
        if (error) throw error;
        return { needsConfirmation: !data.session };
      },
      async signInWithGoogle() {
        const sb = requireSupabase();
        const redirectTo = authRedirect('auth/callback');
        const { data, error } = await sb.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo, skipBrowserRedirect: true },
        });
        if (error) throw error;
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        if (result.type !== 'success') return 'cancelled';
        const ok = await exchangeCodeFromUrl(result.url);
        return ok ? 'signed_in' : 'cancelled';
      },
      async sendPasswordReset(email) {
        const { error } = await requireSupabase().auth.resetPasswordForEmail(email, {
          redirectTo: authRedirect('auth/reset-password'),
        });
        if (error) throw error;
      },
      async updatePassword(password) {
        const { error } = await requireSupabase().auth.updateUser({ password });
        if (error) throw error;
      },
      async updateDisplayName(name) {
        const sb = requireSupabase();
        if (!userId) throw new Error('Sign in first.');
        const { error } = await sb.from('profiles').upsert({ id: userId, display_name: name.trim() || null });
        if (error) throw error;
        await reloadProfile();
      },
      async signOut() {
        if (!supabase) return;
        await supabase.auth.signOut();
        setProfile(null);
        setIsStaff(false);
      },
    }),
    [initialising, session, currentProfile, currentIsStaff, reloadProfile, exchangeCodeFromUrl, userId],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
