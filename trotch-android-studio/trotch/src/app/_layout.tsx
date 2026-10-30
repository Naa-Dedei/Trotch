// Per-weight imports so only the five weights the design uses are bundled.
import { Manrope_400Regular } from '@expo-google-fonts/manrope/400Regular';
import { Manrope_500Medium } from '@expo-google-fonts/manrope/500Medium';
import { Manrope_600SemiBold } from '@expo-google-fonts/manrope/600SemiBold';
import { Manrope_700Bold } from '@expo-google-fonts/manrope/700Bold';
import { Manrope_800ExtraBold } from '@expo-google-fonts/manrope/800ExtraBold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors, fonts } from '@/constants/theme';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { NetworkProvider } from '@/features/network/NetworkProvider';
import { PlannerProvider } from '@/features/planner/PlannerProvider';
import { SavedProvider } from '@/features/saved/SavedProvider';

// Keep the splash screen up until the Manrope fonts are ready (avoids a flash of the system font).
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });
  const ready = fontsLoaded || !!fontError;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  // If the fonts fail to load the app still starts, falling back to the system font.
  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NetworkProvider>
          <SavedProvider>
            <PlannerProvider>
              <StatusBar style="dark" />
              <Stack
                screenOptions={{
                  headerTintColor: colors.primary,
                  headerTitleStyle: { color: colors.text, fontFamily: fonts.bold },
                  headerStyle: { backgroundColor: colors.surface },
                  contentStyle: { backgroundColor: colors.background },
                  headerBackButtonDisplayMode: 'minimal',
                }}
              >
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="search" options={{ presentation: 'modal', title: 'Search places' }} />
                <Stack.Screen name="journey/[id]" options={{ title: 'Journey' }} />
                <Stack.Screen name="stop/[id]" options={{ title: 'Stop' }} />
                <Stack.Screen name="route/[id]" options={{ title: 'Route' }} />
                <Stack.Screen name="report" options={{ presentation: 'modal', title: 'Report a problem' }} />
                <Stack.Screen name="saved-place" options={{ presentation: 'modal', title: 'Saved place' }} />
                <Stack.Screen name="settings" options={{ title: 'Settings' }} />
                <Stack.Screen name="auth" options={{ headerShown: false }} />
                <Stack.Screen name="admin" options={{ headerShown: false }} />
              </Stack>
            </PlannerProvider>
          </SavedProvider>
        </NetworkProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
