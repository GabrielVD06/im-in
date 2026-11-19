import { Accelerometer, Magnetometer } from 'expo-sensors';
import { useEffect, useState } from 'react';

import { groundHeading } from '@/domain/ground-heading';

type Vec3 = { x: number; y: number; z: number };
type Stop = { remove: () => void };
type HeadingListener = (heading: number) => void;

const SAMPLE_MS = 100;
const SMOOTH = 0.35;
const PUBLISH_DEGREES = 1;

let listeners = new Set<HeadingListener>();
let stops: Stop[] = [];
let opening = false;
let generation = 0;
let gravity: Vec3 | null = null;
let magnetic: Vec3 | null = null;
let shown: number | null = null;

function angleDelta(from: number, to: number) {
  return Math.abs(((to - from + 540) % 360) - 180);
}

function mix(current: Vec3 | null, sample: Vec3): Vec3 {
  if (!current) {
    return sample;
  }
  return {
    x: current.x + (sample.x - current.x) * SMOOTH,
    y: current.y + (sample.y - current.y) * SMOOTH,
    z: current.z + (sample.z - current.z) * SMOOTH,
  };
}

function finiteVec(sample: { x: number; y: number; z: number }): Vec3 | null {
  if (!Number.isFinite(sample.x) || !Number.isFinite(sample.y) || !Number.isFinite(sample.z)) {
    return null;
  }
  return { x: sample.x, y: sample.y, z: sample.z };
}

function publish(next: number) {
  if (shown !== null && angleDelta(shown, next) < PUBLISH_DEGREES) {
    return;
  }
  shown = next;
  listeners.forEach((listener) => listener(next));
}

function read() {
  if (!gravity || !magnetic) {
    return;
  }
  const next = groundHeading(gravity, magnetic);
  if (next === null) {
    return;
  }
  publish(next);
}

function closeSensors() {
  stops.forEach((stop) => stop.remove());
  stops = [];
  gravity = null;
  magnetic = null;
}

function close() {
  generation += 1;
  opening = false;
  closeSensors();
}

async function open() {
  if (opening || stops.length > 0 || listeners.size === 0) {
    return;
  }
  opening = true;
  const generationAtStart = generation;
  try {
    const [motion, compass] = await Promise.all([Accelerometer.isAvailableAsync(), Magnetometer.isAvailableAsync()]);
    if (generation !== generationAtStart || !motion || !compass || listeners.size === 0) {
      return;
    }
    stops = [
      Accelerometer.addListener((sample) => {
        const next = finiteVec(sample);
        if (!next) {
          return;
        }
        gravity = mix(gravity, next);
        read();
      }),
      Magnetometer.addListener((sample) => {
        const next = finiteVec(sample);
        if (!next) {
          return;
        }
        magnetic = mix(magnetic, next);
        read();
      }),
    ];
    Accelerometer.setUpdateInterval(SAMPLE_MS);
    Magnetometer.setUpdateInterval(SAMPLE_MS);
    if (listeners.size === 0) {
      closeSensors();
    }
  } catch {
    if (generation === generationAtStart) {
      closeSensors();
    }
  } finally {
    if (generation === generationAtStart) {
      opening = false;
    }
  }
}

export function subscribeGroundHeading(listener: HeadingListener) {
  listeners.add(listener);
  if (shown !== null) {
    listener(shown);
  }
  void open();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      close();
    }
  };
}

export function useGroundHeading() {
  const [heading, setHeading] = useState<number | null>(shown);
  useEffect(() => subscribeGroundHeading(setHeading), []);
  return heading;
}
