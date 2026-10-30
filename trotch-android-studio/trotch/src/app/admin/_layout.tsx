import { Redirect, Stack } from 'expo-router';
import { Screen } from '@/components/Screen';
import { EmptyState, LoadingState } from '@/components/ui';
import { colors } from '@/constants/theme';
import { useAuth } from '@/features/auth/AuthProvider';

/**
 * Admin area guard. This only hides the UI — the real protection is Row Level Security
 * in the database, which rejects writes from anyone without an admin/editor role.
 */
export default function AdminLayout() {
  const { user, isStaff, initialising } = useAuth();
  if (initialising) return <LoadingState />;
  if (!user) return <Redirect href="/auth/sign-in" />;
  if (!isStaff) {
    return (
      <Screen testID="admin-denied">
        <EmptyState icon="lock-closed-outline" title="Staff only" message="Your account doesn’t have permission to manage the Trotch network." />
      </Screen>
    );
  }
  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.text },
        contentStyle: { backgroundColor: colors.background },
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Network admin' }} />
      <Stack.Screen name="stops" options={{ title: 'Stops' }} />
      <Stack.Screen name="stop/[id]" options={{ title: 'Edit stop' }} />
      <Stack.Screen name="routes" options={{ title: 'Routes' }} />
      <Stack.Screen name="route/[id]" options={{ title: 'Edit route' }} />
      <Stack.Screen name="reports" options={{ title: 'Reports' }} />
    </Stack>
  );
}
