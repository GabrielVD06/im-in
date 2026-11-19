import { distanceKm, type LatLng } from '@/domain/geo';
import type { SportId } from '@/domain/profile';

const MAX_ACCURACY_M = 25;
const VERTEX_M = 10;
const RUN_MAX_SPEED_MPS = 8;
const CYCLE_MAX_SPEED_MPS = 22;

export type TraceSample = LatLng & {
  accuracyM: number | null;
  atMs: number;
};

export type TraceDecision = 'ignore' | 'hold' | 'extend' | 'break';

export function traceSpeedCap(sportId: SportId) {
  if (sportId === 'cycle') {
    return CYCLE_MAX_SPEED_MPS;
  }
  return RUN_MAX_SPEED_MPS;
}

export function judgeTraceFix(previous: TraceSample | null, next: TraceSample, vertex: LatLng | null, maxSpeedMps: number): TraceDecision {
  if (next.accuracyM == null || !Number.isFinite(next.accuracyM) || next.accuracyM > MAX_ACCURACY_M) {
    return 'ignore';
  }
  if (!previous || !vertex) {
    return 'hold';
  }
  const meters = distanceKm(previous, next) * 1000;
  if (previous.accuracyM == null) {
    return meters < VERTEX_M ? 'hold' : 'break';
  }
  const doubt = Math.max(next.accuracyM, previous.accuracyM);
  if (meters <= doubt) {
    return 'ignore';
  }
  const seconds = Math.max(0.001, (next.atMs - previous.atMs) / 1000);
  if (meters / seconds > maxSpeedMps) {
    return 'break';
  }
  if (distanceKm(vertex, next) * 1000 < VERTEX_M) {
    return 'hold';
  }
  return 'extend';
}

export function extendSegment<T>(segments: T[][], point: T) {
  if (segments.length === 0) {
    return [[point]];
  }
  const next = segments.slice();
  next[next.length - 1] = [...next[next.length - 1], point];
  return next;
}

export function breakSegment<T>(segments: T[][], point: T) {
  const current = segments[segments.length - 1];
  const kept = current && current.length > 1 ? segments : segments.slice(0, -1);
  return [...kept, [point]];
}
