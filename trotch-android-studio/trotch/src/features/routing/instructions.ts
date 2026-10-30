import type { Journey, Leg, NetworkIndex, RideLeg } from './types';
import { formatDistance, formatDuration, formatFareQuote, MODE_ARTICLE, VERIFICATION_LABEL } from './format';

export type StepKind = 'start' | 'walk' | 'board' | 'ride' | 'alight' | 'transfer' | 'arrive';

export interface InstructionStep {
  key: string;
  kind: StepKind;
  title: string;
  details: string[];
  legIndex: number | null;
  /** Stop the step refers to, so the UI can link to stop details. */
  stopId: string | null;
  /** Data-quality warning to display alongside the step. */
  warning: string | null;
}

function stopName(index: NetworkIndex, id: string): string {
  return index.stopsById.get(id)?.name ?? 'the stop';
}

function rideWarning(leg: RideLeg): string | null {
  if (leg.routeIsDemo) return 'DEMO route — not real-world verified';
  if (leg.routeVerification !== 'verified') return `${VERIFICATION_LABEL[leg.routeVerification]} route information`;
  return null;
}

/**
 * Turn journey legs into a chronological, plain-language timeline.
 * Every sentence is derived from the leg data; nothing is invented.
 */
export function buildInstructions(journey: Journey, index: NetworkIndex): InstructionStep[] {
  const steps: InstructionStep[] = [];
  const { legs } = journey;
  steps.push({
    key: 'start',
    kind: 'start',
    title: `Start at ${journey.origin.label}`,
    details: [],
    legIndex: null,
    stopId: null,
    warning: null,
  });

  const nextRideAfter = (i: number): RideLeg | null => {
    for (let k = i + 1; k < legs.length; k++) {
      const l = legs[k]!;
      if (l.kind === 'ride') return l;
    }
    return null;
  };
  const prevRideBefore = (i: number): RideLeg | null => {
    for (let k = i - 1; k >= 0; k--) {
      const l = legs[k]!;
      if (l.kind === 'ride') return l;
    }
    return null;
  };

  legs.forEach((leg: Leg, i) => {
    if (leg.kind === 'walk') {
      const nextRide = nextRideAfter(i);
      const isTransfer = prevRideBefore(i) !== null && nextRide !== null;
      const target = leg.toStopId ? stopName(index, leg.toStopId) : leg.to.label;
      const hint = leg.toStopId ? index.stopsById.get(leg.toStopId)?.landmarkHint : null;
      const title = isTransfer
        ? `Walk to ${target} to change vehicles`
        : leg.toStopId
          ? `Walk to the boarding point at ${target}`
          : `Walk to ${target}`;
      steps.push({
        key: `walk-${i}`,
        kind: isTransfer ? 'transfer' : 'walk',
        title,
        details: [
          `About ${formatDistance(leg.distanceM)} · ${formatDuration(leg.duration)} on foot (estimated from distance)`,
          ...(hint ? [hint] : []),
        ],
        legIndex: i,
        stopId: leg.toStopId,
        warning: null,
      });
      return;
    }

    const board = index.stopsById.get(leg.boardStopId);
    const isTransfer = prevRideBefore(i) !== null && legs[i - 1]?.kind === 'ride';
    const boardDetails: string[] = [];
    if (board?.landmarkHint) boardDetails.push(board.landmarkHint);
    boardDetails.push(
      `Look for ${MODE_ARTICLE[leg.mode]} going to ${leg.headsign}${leg.routeCode ? ` (route ${leg.routeCode})` : ''}.`,
    );
    if (leg.callOut) boardDetails.push(`The mate usually calls out “${leg.callOut}”.`);
    if (leg.waitMin !== null) boardDetails.push(`Typical wait: about ${leg.waitMin} min.`);
    else if (leg.mode === 'trotro' || leg.mode === 'shared_taxi')
      boardDetails.push('Vehicles usually leave when full, so waiting time varies.');
    boardDetails.push(
      `Fare: ${formatFareQuote(leg.fare)}${leg.fare && leg.fare.verification !== 'verified' ? ` (${VERIFICATION_LABEL[leg.fare.verification].toLowerCase()})` : ''}${leg.fare?.basis === 'route_flat' ? ' — whole-route fare; shorter trips may cost less' : ''}`,
    );
    steps.push({
      key: `board-${i}`,
      kind: isTransfer ? 'transfer' : 'board',
      title: `${isTransfer ? 'Change to' : 'Board'} ${MODE_ARTICLE[leg.mode]} to ${leg.headsign} at ${stopName(index, leg.boardStopId)}`,
      details: boardDetails,
      legIndex: i,
      stopId: leg.boardStopId,
      warning: rideWarning(leg),
    });

    const stopsCount = leg.alightIndex - leg.boardIndex;
    const passing = leg.intermediateStopIds.map((id) => stopName(index, id));
    const passingText =
      passing.length === 0
        ? 'No stops in between.'
        : passing.length <= 3
          ? `You'll pass ${passing.join(', ')}.`
          : `You'll pass ${passing.slice(0, 3).join(', ')} and ${passing.length - 3} more.`;
    steps.push({
      key: `ride-${i}`,
      kind: 'ride',
      title: `Ride ${stopsCount} stop${stopsCount === 1 ? '' : 's'} towards ${leg.headsign}`,
      details: [
        `${formatDuration(leg.inVehicle)} in the vehicle${leg.inVehicle.quality === 'estimated' ? ' (estimated from distance)' : ''}.`,
        passingText,
      ],
      legIndex: i,
      stopId: null,
      warning: null,
    });

    const alight = stopName(index, leg.alightStopId);
    steps.push({
      key: `alight-${i}`,
      kind: 'alight',
      title: `Get off at ${alight}`,
      details: [
        `Tell the mate or driver before you arrive that you're getting down at ${alight}.`,
        ...(index.stopsById.get(leg.alightStopId)?.landmarkHint ? [index.stopsById.get(leg.alightStopId)!.landmarkHint!] : []),
      ],
      legIndex: i,
      stopId: leg.alightStopId,
      warning: null,
    });
  });

  steps.push({
    key: 'arrive',
    kind: 'arrive',
    title: `Arrive at ${journey.destination.label}`,
    details: [],
    legIndex: null,
    stopId: null,
    warning: null,
  });
  return steps;
}
