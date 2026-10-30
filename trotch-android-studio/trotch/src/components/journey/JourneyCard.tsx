import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';
import { AppText, Badge, Card, Row } from '@/components/ui';
import { colors, modeStyle, radius, spacing } from '@/constants/theme';
import { formatDistance, formatDuration, formatFareSummary, MODE_LABEL } from '@/features/routing/format';
import type { Journey, JourneyTag } from '@/features/routing/types';

const TAG_LABEL: Record<JourneyTag, string> = {
  recommended: 'Recommended',
  fastest: 'Fastest',
  lowest_fare: 'Lowest fare',
  fewest_transfers: 'Fewest transfers',
};

export function LegStrip({ journey }: { journey: Journey }) {
  return (
    <Row gap={4} style={{ flexWrap: 'wrap' }}>
      {journey.legs.map((leg, i) => {
        const style = leg.kind === 'walk' ? modeStyle.walk : modeStyle[leg.mode];
        const label = leg.kind === 'walk' ? formatDistance(leg.distanceM) : leg.headsign;
        return (
          <Row key={i} gap={4}>
            {i > 0 ? <Ionicons name="chevron-forward" size={12} color={colors.textMuted} /> : null}
            <View
              style={[styles.leg, { backgroundColor: leg.kind === 'walk' ? '#EEF0ED' : `${style.color}22` }]}
              accessible
              accessibilityLabel={leg.kind === 'walk' ? `Walk ${label}` : `${MODE_LABEL[leg.mode]} to ${label}`}
            >
              <Ionicons name={style.icon} size={14} color={style.color} />
              <AppText variant="caption" style={{ fontWeight: '600' }} numberOfLines={1}>
                {label}
              </AppText>
            </View>
          </Row>
        );
      })}
    </Row>
  );
}

export function JourneyCard({
  journey,
  selected,
  onPress,
  testID,
}: {
  journey: Journey;
  selected?: boolean;
  onPress?: () => void;
  testID?: string;
}) {
  const fare = formatFareSummary(journey.fare);
  const transfersText = journey.transfers === 0 ? 'No transfers' : `${journey.transfers} transfer${journey.transfers > 1 ? 's' : ''}`;
  return (
    <Card
      testID={testID}
      onPress={onPress}
      accessibilityLabel={`Journey ${formatDuration(journey.duration)}, ${fare.headline}, ${transfersText}`}
      style={[selected && { borderColor: colors.primary, borderWidth: 2 }]}
    >
      {journey.tags.length ? (
        <Row gap={spacing.xs} style={{ flexWrap: 'wrap' }}>
          {journey.tags.map((t) => (
            <Badge key={t} label={TAG_LABEL[t]} fg={colors.primaryDark} bg={colors.primarySoft} />
          ))}
        </Row>
      ) : null}
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <AppText variant="title">{formatDuration(journey.duration)}</AppText>
          <AppText variant="caption" muted>
            {transfersText} · {formatDistance(journey.walkingMeters)} walking
          </AppText>
        </View>
        <View style={{ alignItems: 'flex-end', maxWidth: '50%' }}>
          <AppText variant="heading">{fare.headline}</AppText>
          {fare.note ? (
            <AppText variant="caption" muted style={{ textAlign: 'right' }}>
              {fare.note}
            </AppText>
          ) : null}
        </View>
      </Row>
      <LegStrip journey={journey} />
      {journey.hasDemoData ? (
        <Row gap={spacing.xs}>
          <Ionicons name="flask" size={14} color={colors.warning} />
          <AppText variant="caption" color={colors.warning}>
            Uses DEMO data — not real-world verified
          </AppText>
        </Row>
      ) : journey.hasUnverifiedData ? (
        <Row gap={spacing.xs}>
          <Ionicons name="help-circle" size={14} color={colors.warning} />
          <AppText variant="caption" color={colors.warning}>
            Includes unverified information
          </AppText>
        </Row>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  leg: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.sm, maxWidth: 170 },
});
