import * as SecureStore from 'expo-secure-store';

/**
 * Auth session storage backed by the device keychain/keystore (expo-secure-store).
 * SecureStore values should stay under ~2 KB, and Supabase sessions can be larger,
 * so values are split into chunks.
 */
const CHUNK = 1800;
const safeKey = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, '_');

export const secureSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    const k = safeKey(key);
    const countRaw = await SecureStore.getItemAsync(`${k}.n`);
    if (countRaw === null) return null;
    const n = Number(countRaw);
    if (!Number.isInteger(n) || n < 0 || n > 50) return null;
    const parts: string[] = [];
    for (let i = 0; i < n; i++) {
      const part = await SecureStore.getItemAsync(`${k}.${i}`);
      if (part === null) return null;
      parts.push(part);
    }
    return parts.join('');
  },
  async setItem(key: string, value: string): Promise<void> {
    const k = safeKey(key);
    await this.removeItem(key);
    const n = Math.ceil(value.length / CHUNK);
    for (let i = 0; i < n; i++) {
      await SecureStore.setItemAsync(`${k}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK));
    }
    await SecureStore.setItemAsync(`${k}.n`, String(n));
  },
  async removeItem(key: string): Promise<void> {
    const k = safeKey(key);
    const countRaw = await SecureStore.getItemAsync(`${k}.n`);
    const n = Number(countRaw ?? 0);
    for (let i = 0; i < (Number.isInteger(n) ? n : 0); i++) {
      await SecureStore.deleteItemAsync(`${k}.${i}`);
    }
    await SecureStore.deleteItemAsync(`${k}.n`);
  },
};
