import type { Region } from '@/lib/geo';
import type { LatLng } from '@/types/transport';

export interface MapPoint extends LatLng {
  id: string;
}

export type ClusterItem<T extends MapPoint> =
  | { type: 'point'; point: T }
  | { type: 'cluster'; id: string; lat: number; lng: number; count: number; points: T[] };

/**
 * Lightweight grid clustering so crowded areas stay readable without a native clustering library.
 * When zoomed in past `minDeltaToCluster`, every point is shown individually.
 */
export function clusterPoints<T extends MapPoint>(
  points: T[],
  region: Region,
  { cellsAcross = 7, minDeltaToCluster = 0.035 }: { cellsAcross?: number; minDeltaToCluster?: number } = {},
): ClusterItem<T>[] {
  if (region.longitudeDelta <= minDeltaToCluster || points.length < 2) {
    return points.map((point) => ({ type: 'point', point }));
  }
  const cellLng = region.longitudeDelta / cellsAcross;
  const cellLat = region.latitudeDelta / cellsAcross;
  const cells = new Map<string, T[]>();
  for (const p of points) {
    const key = `${Math.floor(p.lat / cellLat)}:${Math.floor(p.lng / cellLng)}`;
    const list = cells.get(key);
    if (list) list.push(p);
    else cells.set(key, [p]);
  }
  const out: ClusterItem<T>[] = [];
  for (const [key, list] of cells) {
    if (list.length === 1) {
      out.push({ type: 'point', point: list[0]! });
    } else {
      const lat = list.reduce((s, p) => s + p.lat, 0) / list.length;
      const lng = list.reduce((s, p) => s + p.lng, 0) / list.length;
      out.push({ type: 'cluster', id: `cluster:${key}`, lat, lng, count: list.length, points: list });
    }
  }
  return out;
}
