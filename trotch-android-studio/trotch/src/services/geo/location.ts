import * as Location from 'expo-location';
import { Alert } from 'react-native';
import { CACHE_KEYS, readCache, writeCache } from '@/lib/storage';
import type { LatLng } from '@/types/transport';

export type LocationResult =
  | { ok: true; position: LatLng; accuracyM: number | null }
  | { ok: false; reason: 'denied' | 'unavailable' | 'cancelled'; message: string };

/** Explain why before the OS prompt, the first time only. */
async function explainOnce(): Promise<boolean> {
  const seen = await readCache<boolean>(CACHE_KEYS.locationExplained);
  if (seen?.value) return true;
  const proceed = await new Promise<boolean>((resolve) =>
    Alert.alert(
      'Use your location?',
      'Trotch uses your location only when you tap this button — to find stops near you and start a journey from where you are. It is not tracked or stored in your history.',
      [
        { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Continue', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
  if (proceed) await writeCache(CACHE_KEYS.locationExplained, true);
  return proceed;
}

/** Request foreground permission on demand and read one position. Nothing is persisted. */
export async function getCurrentPosition(): Promise<LocationResult> {
  try {
    const existing = await Location.getForegroundPermissionsAsync();
    if (existing.status !== 'granted') {
      if (!existing.canAskAgain) {
        return { ok: false, reason: 'denied', message: 'Location access is turned off for Trotch. You can enable it in Settings, or search for a place instead.' };
      }
      if (!(await explainOnce())) return { ok: false, reason: 'cancelled', message: 'You can search for your starting point instead.' };
      const req = await Location.requestForegroundPermissionsAsync();
      if (req.status !== 'granted') {
        return { ok: false, reason: 'denied', message: 'Without location access, search for your starting point instead.' };
      }
    }
    const last = await Location.getLastKnownPositionAsync({ maxAge: 60_000, requiredAccuracy: 200 });
    const pos = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    return { ok: true, position: { lat: pos.coords.latitude, lng: pos.coords.longitude }, accuracyM: pos.coords.accuracy ?? null };
  } catch {
    return { ok: false, reason: 'unavailable', message: "Couldn't get your location. Make sure location services are on, or search for a place instead." };
  }
}
