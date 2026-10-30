import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Small JSON cache for NON-sensitive data (public network snapshot, saved-journey copies,
 * anonymous recent searches). Auth tokens never go here — they live in SecureStore.
 */
export interface Cached<T> {
  savedAt: string;
  value: T;
}

export async function readCache<T>(key: string): Promise<Cached<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Cached<T>;
    if (!parsed || typeof parsed.savedAt !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeCache<T>(key: string, value: T): Promise<void> {
  try {
    const entry: Cached<T> = { savedAt: new Date().toISOString(), value };
    await AsyncStorage.setItem(key, JSON.stringify(entry));
  } catch (e) {
    if (__DEV__) console.warn('[trotch] cache write failed', key, e);
  }
}

export async function removeCache(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export const CACHE_KEYS = {
  network: (city: string) => `trotch.network.v1.${city}`,
  recentSearchesLocal: 'trotch.recent.v1',
  savedJourneysCopy: (userId: string) => `trotch.savedJourneys.v1.${userId}`,
  locationExplained: 'trotch.locationExplained.v1',
} as const;
