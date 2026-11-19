import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

const MAP_KEY = 'salida.map.v1';
const BEARING_KEY = 'salida.map.bearing.v1';

export type MapStyleId = 'positron' | 'bright' | 'dark' | 'fiord';
export type MapBearing = 'north' | 'heading';

export const MAP_STYLES: { id: MapStyleId; label: string; detail: string; url: string }[] = [
  { id: 'positron', label: 'Positron', detail: 'Gris y despejado', url: 'https://tiles.openfreemap.org/styles/positron' },
  { id: 'bright', label: 'Bright', detail: 'Calles con más color', url: 'https://tiles.openfreemap.org/styles/bright' },
  { id: 'dark', label: 'Dark', detail: 'Oscuro', url: 'https://tiles.openfreemap.org/styles/dark' },
  { id: 'fiord', label: 'Fiord', detail: 'Oscuro azulado', url: 'https://tiles.openfreemap.org/styles/fiord' },
];

let mapStyle: MapStyleId = 'positron';
let mapBearing: MapBearing = 'north';
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useMapStyle() {
  return useSyncExternalStore(subscribe, () => mapStyle, () => mapStyle);
}

export function useMapBearing() {
  return useSyncExternalStore(subscribe, () => mapBearing, () => mapBearing);
}

export function mapStyleUrl(id: MapStyleId) {
  return MAP_STYLES.find((style) => style.id === id)?.url ?? MAP_STYLES[0].url;
}

export function setMapStyle(next: MapStyleId) {
  mapStyle = next;
  emit();
  AsyncStorage.setItem(MAP_KEY, next).catch(() => {
    // The choice still applies for this session if the phone cannot store it.
  });
}

export function setMapBearing(next: MapBearing) {
  mapBearing = next;
  emit();
  AsyncStorage.setItem(BEARING_KEY, next).catch(() => {
    // The choice still applies for this session if the phone cannot store it.
  });
}

export async function loadMapStyle() {
  const stored = await AsyncStorage.getItem(MAP_KEY);
  if (stored === 'positron' || stored === 'bright' || stored === 'dark' || stored === 'fiord') {
    mapStyle = stored;
    emit();
  }
}

export async function loadMapBearing() {
  const stored = await AsyncStorage.getItem(BEARING_KEY);
  if (stored === 'north' || stored === 'heading') {
    mapBearing = stored;
    emit();
  }
}
