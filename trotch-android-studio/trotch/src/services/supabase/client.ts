import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import { env, isSupabaseConfigured } from '@/lib/env';
import { secureSessionStorage } from './secureStorage';

/**
 * The Supabase client, or null when the app runs without a backend (DEMO mode).
 * Uses only the publishable/anon key — Row Level Security protects the data.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured()
  ? createClient(env.supabaseUrl!, env.supabaseKey!, {
      auth: {
        storage: Platform.OS === 'web' ? undefined : secureSessionStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
    })
  : null;

if (supabase && Platform.OS !== 'web') {
  // Refresh tokens only while the app is in the foreground.
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

export class BackendUnavailableError extends Error {
  constructor() {
    super('Accounts and syncing are not available: the Trotch backend is not configured on this build.');
    this.name = 'BackendUnavailableError';
  }
}

export function requireSupabase(): SupabaseClient {
  if (!supabase) throw new BackendUnavailableError();
  return supabase;
}

/** Turn Supabase/PostgREST errors into messages that are safe to show (no secrets, no SQL). */
export function friendlyError(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (err instanceof BackendUnavailableError) return err.message;
  const e = err as { message?: string; code?: string; status?: number } | null;
  const msg = e?.message ?? '';
  if (/network request failed|failed to fetch|timeout/i.test(msg)) return "Can't reach Trotch right now. Check your connection and try again.";
  if (e?.code === '42501' || /row-level security|permission denied/i.test(msg)) return "You don't have permission to do that.";
  if (e?.code === '23505' || /duplicate key/i.test(msg)) return 'You already have one of those saved.';
  if (/invalid login credentials/i.test(msg)) return 'Email or password is incorrect.';
  if (/email not confirmed/i.test(msg)) return 'Please confirm your email address first — check your inbox.';
  if (/user already registered/i.test(msg)) return 'An account with this email already exists. Try signing in.';
  if (/password should be/i.test(msg)) return msg;
  if (__DEV__ && msg) console.warn('[trotch] backend error:', e?.code, msg);
  return fallback;
}
