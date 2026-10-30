import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { AppText, IconButton } from '@/components/ui';
import { colors, radius, spacing, TOUCH_TARGET } from '@/constants/theme';
import { usePlanner } from '@/features/planner/PlannerProvider';
import { getCurrentPosition } from '@/services/geo/location';
import type { PlaceRef } from '@/types/transport';

function Field({
  label,
  value,
  placeholder,
  dotColor,
  onPress,
  testID,
}: {
  label: string;
  value: PlaceRef | null;
  placeholder: string;
  dotColor: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value?.label ?? 'not set'}`}
      accessibilityHint="Opens place search"
      style={({ pressed }) => [styles.field, pressed && { backgroundColor: colors.primarySoft }]}
    >
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <View style={{ flex: 1 }}>
        <AppText variant="label" muted>
          {label.toUpperCase()}
        </AppText>
        <AppText variant="bodyStrong" numberOfLines={1} color={value ? colors.text : colors.textMuted}>
          {value?.label ?? placeholder}
        </AppText>
      </View>
    </Pressable>
  );
}

/** Origin/destination pickers with swap and "use my location". */
export function PlaceInputs({ onLocationError }: { onLocationError?: (message: string) => void }) {
  const { origin, destination, setPlace, swap } = usePlanner();
  const [locating, setLocating] = useState(false);

  const useMyLocation = async () => {
    setLocating(true);
    const res = await getCurrentPosition();
    setLocating(false);
    if (res.ok) setPlace('origin', { label: 'My location', lat: res.position.lat, lng: res.position.lng, type: 'current_location', refId: null });
    else if (res.reason !== 'cancelled') onLocationError?.(res.message);
  };

  return (
    <View style={styles.box}>
      <View style={{ flex: 1 }}>
        <Field
          testID="origin-field"
          label="From"
          value={origin}
          placeholder="Starting point"
          dotColor={colors.origin}
          onPress={() => router.push({ pathname: '/search', params: { field: 'origin' } })}
        />
        <View style={styles.sep} />
        <Field
          testID="destination-field"
          label="To"
          value={destination}
          placeholder="Where are you going?"
          dotColor={colors.destination}
          onPress={() => router.push({ pathname: '/search', params: { field: 'destination' } })}
        />
      </View>
      <View style={styles.actions}>
        {locating ? (
          <View style={styles.spinner}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <IconButton testID="use-location" icon="locate" label="Start from my current location" onPress={useMyLocation} />
        )}
        <IconButton testID="swap-places" icon="swap-vertical" label="Swap start and destination" onPress={swap} disabled={!origin && !destination} />
      </View>
    </View>
  );
}

export function QuickPlaceButton({ icon, label, onPress }: { icon: 'home' | 'school' | 'briefcase' | 'star'; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Go to ${label}`} style={({ pressed }) => [styles.quick, pressed && { opacity: 0.8 }]}>
      <Ionicons name={icon} size={16} color={colors.primary} />
      <AppText variant="caption" style={{ fontWeight: '600' }} numberOfLines={1}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingLeft: spacing.sm },
  field: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.sm, minHeight: TOUCH_TARGET + 12, borderRadius: radius.md },
  dot: { width: 12, height: 12, borderRadius: 6 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 32 },
  actions: { justifyContent: 'space-around', paddingHorizontal: spacing.xs, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.border },
  spinner: { width: TOUCH_TARGET, height: TOUCH_TARGET, alignItems: 'center', justifyContent: 'center' },
  quick: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, minHeight: 38, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, maxWidth: 180 },
});
