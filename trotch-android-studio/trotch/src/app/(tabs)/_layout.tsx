import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';
import type { ColorValue } from 'react-native';
import { colors, fonts, type IconName } from '@/constants/theme';

function icon(name: IconName, focusedName: IconName) {
  return function TabIcon({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) {
    return <Ionicons name={focused ? focusedName : name} color={color as string} size={size} />;
  };
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 11, fontFamily: fonts.semibold },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home-outline', 'home'), tabBarButtonTestID: 'tab-home' }} />
      <Tabs.Screen name="plan" options={{ title: 'Plan', tabBarIcon: icon('navigate-outline', 'navigate'), tabBarButtonTestID: 'tab-plan' }} />
      <Tabs.Screen name="explore" options={{ title: 'Explore', tabBarIcon: icon('map-outline', 'map'), tabBarButtonTestID: 'tab-explore' }} />
      <Tabs.Screen name="saved" options={{ title: 'Saved', tabBarIcon: icon('bookmark-outline', 'bookmark'), tabBarButtonTestID: 'tab-saved' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('person-circle-outline', 'person-circle'), tabBarButtonTestID: 'tab-profile' }} />
    </Tabs>
  );
}
