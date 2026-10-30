/**
 * Trotch design-system primitives: text, buttons, cards, fields, badges, rows and state views.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { forwardRef, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { colors, fontForWeight, fonts, radius, shadow, spacing, TOUCH_TARGET, typography, verificationStyle, type IconName } from '@/constants/theme';
import { VERIFICATION_LABEL } from '@/features/routing/format';
import type { VerificationStatus } from '@/types/transport';

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------
type Variant = keyof typeof typography;

export function AppText({
  variant = 'body',
  muted,
  color,
  style,
  ...rest
}: TextProps & { variant?: Variant; muted?: boolean; color?: string }) {
  const base = typography[variant];
  const flat = StyleSheet.flatten(style) as TextStyle | undefined;
  const family = flat?.fontFamily ?? fontForWeight(flat?.fontWeight ?? base.fontWeight);
  return (
    <Text
      {...rest}
      maxFontSizeMultiplier={1.6}
      style={[base, { color: color ?? (muted ? colors.textMuted : colors.text) }, style, { fontFamily: family, fontWeight: undefined }]}
    />
  );
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------
type ButtonKind = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  title,
  onPress,
  kind = 'primary',
  icon,
  loading,
  disabled,
  style,
  accessibilityHint,
  testID,
  compact,
}: {
  title: string;
  onPress?: () => void;
  kind?: ButtonKind;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
  testID?: string;
  compact?: boolean;
}) {
  const palette: Record<ButtonKind, { bg: string; fg: string; border: string }> = {
    primary: { bg: colors.primary, fg: '#FFFFFF', border: colors.primary },
    secondary: { bg: colors.surface, fg: colors.primary, border: colors.borderStrong },
    ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
    danger: { bg: colors.surface, fg: colors.danger, border: colors.danger },
  };
  const p = palette[kind];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        { backgroundColor: p.bg, borderColor: p.border, opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={p.fg} /> : null}
          <AppText variant="bodyStrong" color={p.fg}>
            {title}
          </AppText>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({
  icon,
  label,
  onPress,
  color = colors.primary,
  style,
  testID,
  disabled,
}: {
  icon: IconName;
  label: string;
  onPress?: () => void;
  color?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={({ pressed }) => [styles.iconButton, { opacity: disabled ? 0.4 : pressed ? 0.6 : 1 }, style]}
    >
      <Ionicons name={icon} size={22} color={color} />
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------
export function Card({ children, style, onPress, testID, accessibilityLabel }: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: PressableProps['onPress'];
  testID?: string;
  accessibilityLabel?: string;
}) {
  if (onPress) {
    return (
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [styles.card, shadow, pressed && { opacity: 0.9 }, style]}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View testID={testID} style={[styles.card, shadow, style]}>
      {children}
    </View>
  );
}

export function Section({ title, action, children, style }: { title: string; action?: ReactNode; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ gap: spacing.sm }, style]}>
      <View style={styles.sectionHeader}>
        <AppText variant="heading" accessibilityRole="header">
          {title}
        </AppText>
        {action}
      </View>
      {children}
    </View>
  );
}

export function Row({ children, style, gap = spacing.sm }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function Divider() {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />;
}

export function ListRow({
  icon,
  iconColor = colors.primary,
  title,
  subtitle,
  right,
  onPress,
  testID,
  accessibilityLabel,
}: {
  icon?: IconName;
  iconColor?: string;
  title: string;
  subtitle?: string | null;
  right?: ReactNode;
  onPress?: () => void;
  testID?: string;
  accessibilityLabel?: string;
}) {
  const content = (
    <>
      {icon ? (
        <View style={styles.rowIcon}>
          <Ionicons name={icon} size={20} color={iconColor} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <AppText variant="bodyStrong" numberOfLines={2}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" muted numberOfLines={2}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textMuted} /> : null)}
    </>
  );
  if (!onPress) return <View style={styles.listRow}>{content}</View>;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (subtitle ? `${title}, ${subtitle}` : title)}
      onPress={onPress}
      style={({ pressed }) => [styles.listRow, pressed && { backgroundColor: colors.primarySoft }]}
    >
      {content}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------
export const TextField = forwardRef<TextInput, TextInputProps & { label: string; error?: string | null; hint?: string; icon?: IconName }>(
  function TextField({ label, error, hint, icon, style, ...rest }, ref) {
    return (
      <View style={{ gap: spacing.xs }}>
        <AppText variant="label" muted>
          {label.toUpperCase()}
        </AppText>
        <View style={[styles.field, !!error && { borderColor: colors.danger }]}>
          {icon ? <Ionicons name={icon} size={18} color={colors.textMuted} /> : null}
          <TextInput
            ref={ref}
            accessibilityLabel={label}
            placeholderTextColor={colors.textMuted}
            style={[styles.fieldInput, style as StyleProp<TextStyle>]}
            {...rest}
          />
        </View>
        {error ? (
          <AppText variant="caption" color={colors.danger} accessibilityLiveRegion="polite">
            {error}
          </AppText>
        ) : hint ? (
          <AppText variant="caption" muted>
            {hint}
          </AppText>
        ) : null}
      </View>
    );
  },
);

export function Chip({
  label,
  selected,
  onPress,
  icon,
  color = colors.primary,
  testID,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  color?: string;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={[styles.chip, selected ? { backgroundColor: color, borderColor: color } : { borderColor: colors.borderStrong }]}
    >
      {icon ? <Ionicons name={icon} size={14} color={selected ? '#fff' : color} /> : null}
      <AppText variant="caption" color={selected ? '#FFFFFF' : colors.text} style={{ fontWeight: '600' }}>
        {label}
      </AppText>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------
export function Badge({ label, fg, bg, icon }: { label: string; fg: string; bg: string; icon?: IconName }) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]} accessible accessibilityLabel={label}>
      {icon ? <Ionicons name={icon} size={12} color={fg} /> : null}
      <AppText variant="label" color={fg}>
        {label}
      </AppText>
    </View>
  );
}

export function QualityBadge({ verification, isDemo }: { verification: VerificationStatus; isDemo?: boolean }) {
  const s = verificationStyle[verification];
  return (
    <Row gap={spacing.xs} style={{ flexWrap: 'wrap' }}>
      {isDemo ? <Badge label="DEMO" fg="#FFFFFF" bg={colors.primaryDark} icon="flask" /> : null}
      <Badge label={VERIFICATION_LABEL[verification]} fg={s.fg} bg={s.bg} icon={s.icon} />
    </Row>
  );
}

// ---------------------------------------------------------------------------
// Banners and state views
// ---------------------------------------------------------------------------
type Tone = 'info' | 'warning' | 'danger' | 'success';
const toneColors: Record<Tone, { fg: string; bg: string; icon: IconName }> = {
  info: { fg: colors.info, bg: colors.infoSoft, icon: 'information-circle' },
  warning: { fg: colors.warning, bg: colors.warningSoft, icon: 'warning' },
  danger: { fg: colors.danger, bg: colors.dangerSoft, icon: 'alert-circle' },
  success: { fg: colors.primaryDark, bg: colors.primarySoft, icon: 'checkmark-circle' },
};

export function Banner({ tone = 'info', title, message, action, testID }: { tone?: Tone; title?: string; message: string; action?: ReactNode; testID?: string }) {
  const t = toneColors[tone];
  return (
    <View testID={testID} style={[styles.banner, { backgroundColor: t.bg }]} accessibilityRole="alert">
      <Ionicons name={t.icon} size={20} color={t.fg} />
      <View style={{ flex: 1, gap: 2 }}>
        {title ? (
          <AppText variant="bodyStrong" color={t.fg}>
            {title}
          </AppText>
        ) : null}
        <AppText variant="caption" color={t.fg}>
          {message}
        </AppText>
        {action}
      </View>
    </View>
  );
}

export function LoadingState({ message = 'Loading…' }: { message?: string }) {
  return (
    <View style={styles.centered} accessibilityLiveRegion="polite">
      <ActivityIndicator color={colors.primary} size="large" />
      <AppText muted>{message}</AppText>
    </View>
  );
}

export function EmptyState({ icon = 'map-outline', title, message, action }: { icon?: IconName; title: string; message?: string; action?: ReactNode }) {
  return (
    <View style={styles.centered}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={28} color={colors.primary} />
      </View>
      <AppText variant="heading" style={{ textAlign: 'center' }}>
        {title}
      </AppText>
      {message ? (
        <AppText muted style={{ textAlign: 'center' }}>
          {message}
        </AppText>
      ) : null}
      {action}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <EmptyState
      icon="cloud-offline-outline"
      title="Something went wrong"
      message={message}
      action={onRetry ? <Button title="Try again" kind="secondary" icon="refresh" onPress={onRetry} /> : undefined}
    />
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: TOUCH_TARGET + 4,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  buttonCompact: { minHeight: 36, paddingHorizontal: spacing.md },
  iconButton: { width: TOUCH_TARGET, height: TOUCH_TARGET, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.xs, minHeight: TOUCH_TARGET + 8 },
  rowIcon: { width: 36, height: 36, borderRadius: radius.pill, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    minHeight: TOUCH_TARGET + 4,
  },
  fieldInput: { flex: 1, ...typography.body, fontWeight: undefined, fontFamily: fonts.regular, color: colors.text, paddingVertical: spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, minHeight: 34, backgroundColor: colors.surface },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm, alignSelf: 'flex-start' },
  banner: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, alignItems: 'flex-start' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
