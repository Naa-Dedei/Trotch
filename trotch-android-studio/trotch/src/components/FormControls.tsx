import { Switch, View } from 'react-native';
import { AppText, Chip, Row } from '@/components/ui';
import { colors, spacing, verificationStyle } from '@/constants/theme';
import { VERIFICATION_LABEL } from '@/features/routing/format';
import type { VerificationStatus } from '@/types/transport';

export function ToggleRow({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <View style={{ flex: 1 }}>
        <AppText variant="bodyStrong">{label}</AppText>
        {hint ? (
          <AppText variant="caption" muted>
            {hint}
          </AppText>
        ) : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary, false: colors.borderStrong }} accessibilityLabel={label} />
    </Row>
  );
}

export function ChoiceRow<T extends string>({
  label,
  options,
  value,
  onChange,
  labels,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  labels?: Partial<Record<T, string>>;
}) {
  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="label" muted>
        {label.toUpperCase()}
      </AppText>
      <Row style={{ flexWrap: 'wrap' }}>
        {options.map((o) => (
          <Chip key={o} label={labels?.[o] ?? o.replace(/_/g, ' ')} selected={o === value} onPress={() => onChange(o)} />
        ))}
      </Row>
    </View>
  );
}

export const VERIFICATION_OPTIONS = ['verified', 'community_reported', 'unverified', 'outdated', 'inactive'] as const satisfies readonly VerificationStatus[];

export function VerificationChoice({ value, onChange }: { value: VerificationStatus; onChange: (v: VerificationStatus) => void }) {
  return (
    <View style={{ gap: spacing.xs }}>
      <ChoiceRow label="Verification" options={VERIFICATION_OPTIONS} value={value} onChange={onChange} labels={VERIFICATION_LABEL} />
      <AppText variant="caption" color={verificationStyle[value].fg}>
        {value === 'verified'
          ? 'Only mark as verified after a person has checked it on the ground or with an operator.'
          : value === 'community_reported'
            ? 'Reported by users but not yet confirmed by the Trotch team.'
            : value === 'inactive'
              ? 'Hidden from journey planning.'
              : value === 'outdated'
                ? 'Shown with a warning; still used for planning.'
                : 'Shown with an “unverified” label.'}
      </AppText>
    </View>
  );
}
