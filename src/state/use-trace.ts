import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';

import { distanceKm, formatDistance, type LatLng } from '@/domain/geo';
import { breakSegment, extendSegment, judgeTraceFix, type TraceSample } from '@/domain/trace-fix';

export type TimedPoint = LatLng & { elapsed: number };

export type KilometerSplit = { km: number; seconds: number };

export type RaceReport = {
  distanceKm: number;
  elapsedMs: number;
  splits: KilometerSplit[];
  remainderKm: number;
  remainderMs: number;
};

export function segmentsLength(segments: LatLng[][]) {
  const total = segments.reduce((sum, segment) => sum + traceLength(segment), 0);
  return Math.round(total * 100) / 100;
}

export function segmentsLabel(segments: LatLng[][]) {
  const km = segmentsLength(segments);
  if (km < 0.05) {
    return '0 m';
  }
  return formatDistance(km);
}

export function hasTrack(segments: LatLng[][]) {
  return segments.some((segment) => segment.length > 1);
}

export function traceLength(points: LatLng[]) {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += distanceKm(points[index - 1], points[index]);
  }
  return Math.round(total * 100) / 100;
}

export function traceLabel(points: LatLng[]) {
  const km = traceLength(points);
  if (km < 0.05) {
    return '0 m';
  }
  return formatDistance(km);
}

export function formatClock(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${minutes}:${pad(seconds)}`;
}

export function raceReport(segments: TimedPoint[][], elapsedMs: number): RaceReport {
  const marks = [segments[0]?.[0]?.elapsed ?? 0];
  let covered = 0;
  let nextKm = 1;
  for (const segment of segments) {
    for (let index = 1; index < segment.length && nextKm <= 300; index += 1) {
      const step = distanceKm(segment[index - 1], segment[index]);
      if (step <= 0) {
        continue;
      }
      const origin = covered;
      while (origin + step >= nextKm - 0.0001 && nextKm <= 300) {
        const ratio = Math.min(1, Math.max(0, (nextKm - origin) / step));
        const at = segment[index - 1].elapsed + (segment[index].elapsed - segment[index - 1].elapsed) * ratio;
        marks.push(at);
        nextKm += 1;
      }
      covered += step;
    }
  }
  const splits = marks.slice(1).map((at, index) => ({
    km: index + 1,
    seconds: Math.max(0, Math.round((at - marks[index]) / 1000)),
  }));
  const fullMs = marks[marks.length - 1] ?? 0;
  return {
    distanceKm: segmentsLength(segments),
    elapsedMs,
    splits,
    remainderKm: Math.max(0, Math.round((segmentsLength(segments) - splits.length) * 100) / 100),
    remainderMs: Math.max(0, elapsedMs - fullMs),
  };
}

export function useTrace() {
  const [segments, setSegments] = useState<TimedPoint[][]>([]);
  const [live, setLive] = useState<TimedPoint | null>(null);
  const [active, setActive] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const segmentsRef = useRef(segments);
  const liveRef = useRef<TimedPoint | null>(null);
  const anchorRef = useRef<TraceSample | null>(null);
  const speedRef = useRef(8);
  const startedRef = useRef<number | null>(null);
  const pauseAccumRef = useRef(0);
  const pausedAtRef = useRef<number | null>(null);
  const elapsedRef = useRef(0);

  const movingNow = useCallback(() => {
    if (startedRef.current == null) {
      return 0;
    }
    const end = pausedAtRef.current ?? Date.now();
    return Math.max(0, end - startedRef.current - pauseAccumRef.current);
  }, []);

  const publishElapsed = useCallback(() => {
    const next = movingNow();
    elapsedRef.current = next;
    setElapsedMs(next);
    return next;
  }, [movingNow]);

  const commit = useCallback((next: TimedPoint[][]) => {
    segmentsRef.current = next;
    setSegments(next);
  }, []);

  useEffect(() => {
    if (!active) {
      return;
    }
    const timer = setInterval(publishElapsed, 1000);
    return () => clearInterval(timer);
  }, [active, publishElapsed]);

  useEffect(() => {
    if (!active) {
      return;
    }
    let alive = true;
    let subscription: Location.LocationSubscription | null = null;
    Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        distanceInterval: 1,
        timeInterval: 1000,
      },
      (position) => {
        const accuracy = position.coords.accuracy;
        const sample: TraceSample = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyM: typeof accuracy === 'number' && Number.isFinite(accuracy) ? accuracy : null,
          atMs: position.timestamp,
        };
        const current = segmentsRef.current;
        const vertex = current[current.length - 1]?.at(-1) ?? null;
        const decision = judgeTraceFix(anchorRef.current, sample, vertex, speedRef.current);
        if (decision === 'ignore') {
          return;
        }
        const timed = { latitude: sample.latitude, longitude: sample.longitude, elapsed: movingNow() };
        const seeded = anchorRef.current?.accuracyM == null;
        anchorRef.current = sample;
        liveRef.current = timed;
        setLive(timed);
        if (decision === 'break') {
          commit(breakSegment(current, timed));
          return;
        }
        if (decision === 'extend') {
          commit(extendSegment(current, timed));
          return;
        }
        if (seeded) {
          commit(current.length === 0 ? [[timed]] : [...current.slice(0, -1), [timed]]);
        }
      },
    ).then((next) => {
      if (!alive) {
        next.remove();
        return;
      }
      subscription = next;
    });
    return () => {
      alive = false;
      subscription?.remove();
    };
  }, [active, commit, movingNow]);

  const start = useCallback((origin: LatLng, maxSpeedMps: number) => {
    startedRef.current = Date.now();
    pauseAccumRef.current = 0;
    pausedAtRef.current = null;
    elapsedRef.current = 0;
    speedRef.current = maxSpeedMps;
    const first = { latitude: origin.latitude, longitude: origin.longitude, elapsed: 0 };
    anchorRef.current = { ...origin, accuracyM: null, atMs: Date.now() };
    liveRef.current = first;
    commit([[first]]);
    setLive(first);
    setElapsedMs(0);
    setPaused(false);
    setActive(true);
  }, [commit]);

  const pause = useCallback(() => {
    if (startedRef.current == null || pausedAtRef.current != null) {
      return;
    }
    pausedAtRef.current = Date.now();
    setPaused(true);
    setActive(false);
    publishElapsed();
  }, [publishElapsed]);

  const resume = useCallback(() => {
    if (pausedAtRef.current != null) {
      pauseAccumRef.current += Date.now() - pausedAtRef.current;
      pausedAtRef.current = null;
    }
    if (anchorRef.current) {
      anchorRef.current = { ...anchorRef.current, atMs: Date.now() };
    }
    setPaused(false);
    setActive(true);
    publishElapsed();
  }, [publishElapsed]);

  const end = useCallback(() => {
    if (startedRef.current != null && pausedAtRef.current == null) {
      pausedAtRef.current = Date.now();
    }
    setActive(false);
    setPaused(false);
    publishElapsed();
    return segmentsRef.current;
  }, [publishElapsed]);

  const clock = useCallback(() => elapsedRef.current, []);

  const clear = useCallback(() => {
    startedRef.current = null;
    pauseAccumRef.current = 0;
    pausedAtRef.current = null;
    elapsedRef.current = 0;
    anchorRef.current = null;
    liveRef.current = null;
    commit([]);
    setLive(null);
    setElapsedMs(0);
    setPaused(false);
    setActive(false);
  }, [commit]);

  return { segments, live, active, paused, elapsedMs, start, pause, resume, end, clock, clear };
}
