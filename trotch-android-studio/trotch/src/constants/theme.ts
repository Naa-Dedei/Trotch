import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Platform } from 'react-native';
import type { TransportMode, VerificationStatus } from '@/types/transport';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export const colors = {
  primary: '#126B45',
  primaryDark: '#0B3D2E',
  primarySoft: '#E3F0E9',
  background: '#F7F8F5',
  surface: '#FFFFFF',
  text: '#17231D',
  textMuted: '#68736C',
  border: '#E1E5E0',
  borderStrong: '#C9D0CA',
  danger: '#B3261E',
  dangerSoft: '#FBE9E7',
  warning: '#8A5A00',
  warningSoft: '#FFF4D6',
  info: '#1F5F8B',
  infoSoft: '#E5F0F8',
  origin: '#126B45',
  destination: '#C0392B',
  overlay: 'rgba(11, 61, 46, 0.45)',
} as const;

/** Consistent visual language for modes on maps, chips and timelines. */
export const modeStyle: Record<TransportMode | 'walk', { color: string; icon: IconName; label: string }> = {
  trotro: { color: '#D98E04', icon: 'bus-outline', label: 'Trotro' },
  shared_taxi: { color: '#B5651D', icon: 'car-outline', label: 'Shared taxi' },
  bus: { color: '#1F5F8B', icon: 'bus', label: 'Bus' },
  intercity_bus: { color: '#6A3D9A', icon: 'bus-sharp', label: 'Intercity bus' },
  walk: { color: '#68736C', icon: 'walk-outline', label: 'Walk' },
};

export const verificationStyle: Record<VerificationStatus, { fg: string; bg: string; icon: IconName }> = {
  verified: { fg: '#0B5A39', bg: '#DDF1E5', icon: 'checkmark-circle' },
  community_reported: { fg: '#1F5F8B', bg: '#E5F0F8', icon: 'people' },
  unverified: { fg: '#8A5A00', bg: '#FFF4D6', icon: 'help-circle' },
  outdated: { fg: '#8A3A00', bg: '#FDE8D7', icon: 'time' },
  inactive: { fg: '#5D635F', bg: '#ECEEEC', icon: 'remove-circle' },
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

/**
 * Manrope (the Figma design-system typeface), loaded in the root layout.
 * Each weight is its own family: Android does not pick weights from one family name, and
 * combining a custom family with fontWeight makes it synthesise a fake bold.
 */
export const fonts = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
} as const;

/** Maps a fontWeight to the matching Manrope family. */
export function fontForWeight(weight: string | number | undefined): string {
  const w = weight === 'bold' ? 700 : weight === 'normal' || weight == null ? 400 : Number(weight);
  if (w >= 800) return fonts.extrabold;
  if (w >= 700) return fonts.bold;
  if (w >= 600) return fonts.semibold;
  if (w >= 500) return fonts.medium;
  return fonts.regular;
}

/** Legacy alias kept for any caller that wants the base family. */
export const fontFamily = fonts.regular;

export const typography = {
  display: { fontSize: 28, lineHeight: 34, fontWeight: '800' as const },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '800' as const },
  heading: { fontSize: 17, lineHeight: 22, fontWeight: '700' as const },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400' as const },
  bodyStrong: { fontSize: 15, lineHeight: 21, fontWeight: '600' as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '600' as const, letterSpacing: 0.3 },
};

export const shadow = Platform.select({
  ios: { shadowColor: '#0B3D2E', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  default: { elevation: 2 },
});

/** Minimum touch target recommended by both platforms. */
export const TOUCH_TARGET = 44;
