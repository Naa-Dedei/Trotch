import Ionicons from '@expo/vector-icons/Ionicons';
import { Component, forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import MapView, { Marker, Polyline, UrlTile, type Region as RNRegion } from 'react-native-maps';
import { AppText } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { clusterPoints, type MapPoint } from '@/features/map/cluster';
import { env } from '@/lib/env';
import { ACCRA_REGION, regionForPoints, type Region } from '@/lib/geo';
import type { LatLng, StopKind } from '@/types/transport';

export interface MapStop extends MapPoint {
  name: string;
  kind: StopKind;
  color?: string;
  selected?: boolean;
}

export interface MapOverlay {
  id: string;
  coordinates: LatLng[];
  color: string;
  dashed?: boolean;
  width?: number;
  /** De-emphasised overlays are drawn thinner and translucent. */
  muted?: boolean;
}

export interface TransitMapHandle {
  fitTo: (points: LatLng[]) => void;
  recenter: (point: LatLng) => void;
}

interface Props {
  stops?: MapStop[];
  overlays?: MapOverlay[];
  origin?: LatLng | null;
  destination?: LatLng | null;
  /** Points to fit automatically when they change (e.g. the selected journey). */
  fitPoints?: LatLng[];
  onStopPress?: (stopId: string) => void;
  showsUserLocation?: boolean;
  style?: StyleProp<ViewStyle>;
  interactive?: boolean;
  testID?: string;
  onRegionChange?: (r: Region) => void;
}

const toRN = (p: LatLng) => ({ latitude: p.lat, longitude: p.lng });

/** Catches native/map errors so a map failure never takes down the screen. */
class MapErrorBoundary extends Component<{ children: ReactNode; style?: StyleProp<ViewStyle> }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: unknown) {
    if (__DEV__) console.warn('[trotch] map failed to render', error);
  }
  override render() {
    if (this.state.failed) return <MapUnavailable style={this.props.style} />;
    return this.props.children;
  }
}

export function MapUnavailable({ style, message }: { style?: StyleProp<ViewStyle>; message?: string }) {
  return (
    <View style={[styles.fallback, style]} accessibilityRole="summary">
      <Ionicons name="map-outline" size={28} color={colors.textMuted} />
      <AppText muted style={{ textAlign: 'center' }}>
        {message ?? 'The map is unavailable right now. Your journey steps below still work.'}
      </AppText>
    </View>
  );
}

const InnerMap = forwardRef<TransitMapHandle, Props>(function InnerMap(
  { stops = [], overlays = [], origin, destination, fitPoints, onStopPress, showsUserLocation, style, interactive = true, testID, onRegionChange },
  ref,
) {
  const mapRef = useRef<MapView>(null);
  const [ready, setReady] = useState(false);
  const [slow, setSlow] = useState(false);
  const initial = useMemo<Region>(() => (fitPoints && regionForPoints(fitPoints)) || ACCRA_REGION, [fitPoints]);
  const [region, setRegion] = useState<Region>(initial);

  const fitTo = useCallback((points: LatLng[]) => {
    if (!mapRef.current || points.length === 0) return;
    if (points.length === 1) {
      mapRef.current.animateToRegion({ ...toRN(points[0]!), latitudeDelta: 0.012, longitudeDelta: 0.012 }, 350);
      return;
    }
    mapRef.current.fitToCoordinates(points.map(toRN), {
      edgePadding: { top: 60, right: 50, bottom: 60, left: 50 },
      animated: true,
    });
  }, []);

  useImperativeHandle(ref, () => ({
    fitTo,
    recenter: (p) => mapRef.current?.animateToRegion({ ...toRN(p), latitudeDelta: 0.02, longitudeDelta: 0.02 }, 350),
  }), [fitTo]);

  // Auto-fit whenever the set of points changes (selected journey switched).
  const fitKey = fitPoints?.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join('|') ?? '';
  useEffect(() => {
    if (ready && fitPoints && fitPoints.length) fitTo(fitPoints);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, fitKey]);

  // If the native map never reports ready (e.g. missing Google Maps key on Android), say so.
  useEffect(() => {
    const t = setTimeout(() => !ready && setSlow(true), 10_000);
    return () => clearTimeout(t);
  }, [ready]);

  const clustered = useMemo(() => clusterPoints(stops, region), [stops, region]);
  const customTiles = !!env.mapTileUrl;

  return (
    <View style={[styles.container, style]} testID={testID}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={initial}
        onMapReady={() => {
          setReady(true);
          setSlow(false);
        }}
        onRegionChangeComplete={(r: RNRegion) => {
          setRegion(r);
          onRegionChange?.(r);
        }}
        showsUserLocation={!!showsUserLocation}
        showsMyLocationButton={false}
        toolbarEnabled={false}
        showsPointsOfInterests={false}
        rotateEnabled={false}
        pitchEnabled={false}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        mapType={customTiles && Platform.OS === 'android' ? 'none' : 'standard'}
        accessibilityLabel="Map"
      >
        {customTiles ? <UrlTile urlTemplate={env.mapTileUrl!} maximumZ={19} shouldReplaceMapContent tileSize={256} /> : null}

        {overlays.map((o) => (
          <Polyline
            key={o.id}
            coordinates={o.coordinates.map(toRN)}
            strokeColor={o.muted ? `${o.color}66` : o.color}
            strokeWidth={o.width ?? (o.muted ? 3 : 5)}
            lineDashPattern={o.dashed ? [6, 6] : undefined}
            lineCap="round"
            lineJoin="round"
            zIndex={o.muted ? 1 : 2}
          />
        ))}

        {clustered.map((item) =>
          item.type === 'cluster' ? (
            <Marker
              key={item.id}
              coordinate={toRN(item)}
              onPress={() => fitTo(item.points)}
              tracksViewChanges={false}
              accessibilityLabel={`${item.count} stops. Tap to zoom in`}
            >
              <View style={styles.cluster}>
                <AppText variant="label" color="#fff">
                  {item.count}
                </AppText>
              </View>
            </Marker>
          ) : (
            <Marker
              key={item.point.id}
              coordinate={toRN(item.point)}
              onPress={() => onStopPress?.(item.point.id)}
              tracksViewChanges={false}
              accessibilityLabel={`${item.point.name}, ${item.point.kind} stop`}
              zIndex={item.point.selected ? 5 : 3}
            >
              <View
                style={[
                  styles.stopDot,
                  item.point.kind === 'terminal' && styles.terminal,
                  { borderColor: item.point.color ?? colors.primaryDark },
                  item.point.selected && styles.selected,
                ]}
              >
                {item.point.kind === 'terminal' ? <Ionicons name="business" size={10} color={colors.primaryDark} /> : null}
              </View>
            </Marker>
          ),
        )}

        {origin ? (
          <Marker coordinate={toRN(origin)} tracksViewChanges={false} accessibilityLabel="Start" zIndex={10}>
            <View style={styles.origin} />
          </Marker>
        ) : null}
        {destination ? (
          <Marker coordinate={toRN(destination)} tracksViewChanges={false} accessibilityLabel="Destination" zIndex={10}>
            <Ionicons name="location" size={34} color={colors.destination} />
          </Marker>
        ) : null}
      </MapView>

      {customTiles && env.mapTileAttribution ? (
        <View style={styles.attribution} pointerEvents="none">
          <AppText variant="label" muted>
            {env.mapTileAttribution}
          </AppText>
        </View>
      ) : null}

      {slow ? (
        <View style={styles.slow} pointerEvents="none">
          <AppText variant="caption" color={colors.warning}>
            Map tiles are slow to load. Check your connection or the map configuration.
          </AppText>
        </View>
      ) : null}
    </View>
  );
});

export const TransitMap = forwardRef<TransitMapHandle, Props>(function TransitMap(props, ref) {
  return (
    <MapErrorBoundary style={props.style}>
      <InnerMap {...props} ref={ref} />
    </MapErrorBoundary>
  );
});

export function MapFab({ icon, label, onPress, style }: { icon: 'locate' | 'scan-outline' | 'list'; label: string; onPress: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.fab, pressed && { opacity: 0.8 }, style]}>
      <Ionicons name={icon} size={22} color={colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden', borderRadius: radius.lg, backgroundColor: '#E8ECE7', minHeight: 160 },
  fallback: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: '#ECEFEA', minHeight: 160 },
  stopDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#fff', borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  terminal: { width: 20, height: 20, borderRadius: 5, borderWidth: 2.5 },
  selected: { transform: [{ scale: 1.35 }], backgroundColor: '#FFF4D6' },
  cluster: { minWidth: 30, height: 30, borderRadius: 15, paddingHorizontal: 6, backgroundColor: colors.primaryDark, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  origin: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.origin, borderWidth: 3, borderColor: '#fff' },
  attribution: { position: 'absolute', bottom: 4, left: 6, backgroundColor: 'rgba(255,255,255,0.8)', paddingHorizontal: 4, borderRadius: 4 },
  slow: { position: 'absolute', top: 8, left: 8, right: 8, backgroundColor: colors.warningSoft, padding: spacing.sm, borderRadius: radius.sm },
  fab: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
});
