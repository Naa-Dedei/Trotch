import type { ExpoConfig, ConfigContext } from 'expo/config';

/**
 * Trotch Expo configuration.
 *
 * Public, client-side settings come from EXPO_PUBLIC_* variables (see .env.example).
 * Native-only secrets used at build time (Google Maps SDK keys) come from plain
 * environment variables and are embedded in the native binary, never in JS.
 * Never put the Supabase service-role key anywhere in this project.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Trotch',
  slug: 'trotch',
  platforms: ['ios', 'android'],
  scheme: 'trotch',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  backgroundColor: '#F7F8F5',
  ios: {
    supportsTablet: false,
    bundleIdentifier: process.env.TROTCH_IOS_BUNDLE_ID ?? 'com.realfin.trotch',
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        'Trotch uses your location only when you ask for it, to find nearby stops and start a journey from where you are.',
    },
  },
  android: {
    package: process.env.TROTCH_ANDROID_PACKAGE ?? 'com.realfin.trotch',
    adaptiveIcon: {
      backgroundColor: '#126B45',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    permissions: ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION'],
    blockedPermissions: ['ACCESS_BACKGROUND_LOCATION'],
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    'expo-router',
    ['expo-splash-screen', { image: './assets/splash-icon.png', imageWidth: 180, resizeMode: 'contain', backgroundColor: '#126B45' }],
    'expo-secure-store',
    'expo-web-browser',
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Trotch uses your location only when you ask for it, to find nearby stops and start a journey from where you are.',
        isAndroidBackgroundLocationEnabled: false,
        isIosBackgroundLocationEnabled: false,
      },
    ],
    // Listed before react-native-maps on purpose: Expo applies manifest mods last-listed-first,
    // so this runs after the maps plugin has removed the empty key and puts back a
    // build-time placeholder. Without the entry, Google Maps crashes on the first map screen.
    './plugins/withAndroidMapsKey',
    [
      'react-native-maps',
      {
        // The Android key is filled in by Gradle at build time (see the plugin below).
        // iOS uses Apple Maps by default; this key is only needed if you switch iOS to Google Maps.
        iosGoogleMapsApiKey: process.env.GOOGLE_MAPS_IOS_API_KEY ?? '',
      },
    ],
    'expo-font',
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: process.env.EAS_PROJECT_ID ? { projectId: process.env.EAS_PROJECT_ID } : undefined,
  },
});
