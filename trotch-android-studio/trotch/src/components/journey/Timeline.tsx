import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui';
import { colors, modeStyle, spacing, type IconName } from '@/constants/theme';
import type { InstructionStep, StepKind } from '@/features/routing/instructions';
import type { Journey } from '@/features/routing/types';

const ICON: Record<StepKind, IconName> = {
  start: 'radio-button-on',
  walk: 'walk',
  board: 'enter-outline',
  ride: 'ellipsis-vertical',
  alight: 'exit-outline',
  transfer: 'swap-horizontal',
  arrive: 'flag',
};

function stepColor(step: InstructionStep, journey: Journey): string {
  if (step.kind === 'start') return colors.origin;
  if (step.kind === 'arrive') return colors.destination;
  const leg = step.legIndex !== null ? journey.legs[step.legIndex] : undefined;
  if (!leg || leg.kind === 'walk') return modeStyle.walk.color;
  return modeStyle[leg.mode].color;
}

/** Chronological, accessible journey instructions. */
export function Timeline({
  steps,
  journey,
  onStopPress,
}: {
  steps: InstructionStep[];
  journey: Journey;
  onStopPress?: (stopId: string) => void;
}) {
  return (
    <View accessibilityRole="list">
      {steps.map((step, i) => {
        const color = stepColor(step, journey);
        const last = i === steps.length - 1;
        const tappable = !!step.stopId && !!onStopPress;
        const body = (
          <View style={{ flex: 1, paddingBottom: last ? 0 : spacing.lg, gap: 2 }}>
            <AppText variant="bodyStrong">{step.title}</AppText>
            {step.details.map((d, k) => (
              <AppText key={k} variant="caption" muted>
                {d}
              </AppText>
            ))}
            {step.warning ? (
              <AppText variant="caption" color={colors.warning}>
                ⚠ {step.warning}
              </AppText>
            ) : null}
            {tappable ? (
              <AppText variant="caption" color={colors.primary} style={{ fontWeight: '600' }}>
                Stop details ›
              </AppText>
            ) : null}
          </View>
        );
        return (
          <View key={step.key} style={styles.row} accessibilityRole="text" accessibilityLabel={`Step ${i + 1}. ${step.title}. ${step.details.join(' ')}`}>
            <View style={styles.rail}>
              <View style={[styles.node, { backgroundColor: step.kind === 'ride' ? 'transparent' : color }]}>
                <Ionicons name={ICON[step.kind]} size={step.kind === 'ride' ? 18 : 13} color={step.kind === 'ride' ? color : '#fff'} />
              </View>
              {!last ? <View style={[styles.line, { backgroundColor: color }, step.kind === 'walk' && styles.dashed]} /> : null}
            </View>
            {tappable ? (
              <Pressable style={{ flex: 1 }} onPress={() => onStopPress!(step.stopId!)} accessibilityRole="button" accessibilityHint="Opens stop details">
                {body}
              </Pressable>
            ) : (
              body
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md },
  rail: { width: 26, alignItems: 'center' },
  node: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  line: { width: 3, flex: 1, marginVertical: 2, borderRadius: 2 },
  dashed: { opacity: 0.5 },
});
