import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { useColorScheme } from 'react-native';

const THEME_KEY = 'salida.theme.v1';

export type ThemeChoice = 'system' | 'light' | 'dark';

export const lightColors = {
  paper: '#F4F1EC',
  ink: '#161616',
  muted: '#5C5852',
  action: '#2457D6',
  actionPressed: '#1C46B8',
  actionSoft: '#E7EEFF',
  onAction: '#FFFCF8',
  card: '#FFFCF8',
  line: 'rgba(22, 22, 22, 0.08)',
  danger: '#9B2C2C',
  placeholder: '#8A847C',
  photo: '#1C2E4A',
  onPhoto: '#F4F1EC',
} as const;

export const darkColors = {
  paper: '#111111',
  ink: '#F7F4EF',
  muted: '#A8A39B',
  action: '#6B93F5',
  actionPressed: '#5478D6',
  actionSoft: '#243044',
  onAction: '#F7F4EF',
  card: '#1C1C1C',
  line: 'rgba(247, 244, 239, 0.1)',
  danger: '#E7A0A0',
  placeholder: '#8E887F',
  photo: '#1C2E4A',
  onPhoto: '#F7F4EF',
} as const;

export type Palette = {
  paper: string;
  ink: string;
  muted: string;
  action: string;
  actionPressed: string;
  actionSoft: string;
  onAction: string;
  card: string;
  line: string;
  danger: string;
  placeholder: string;
  photo: string;
  onPhoto: string;
};

export const space = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

let themeChoice: ThemeChoice = 'system';
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useThemeChoice() {
  return useSyncExternalStore(subscribe, () => themeChoice, () => themeChoice);
}

export function setThemeChoice(next: ThemeChoice) {
  themeChoice = next;
  emit();
  AsyncStorage.setItem(THEME_KEY, next).catch(() => {
    // The choice still applies for this session if the phone cannot store it.
  });
}

export async function loadThemeChoice() {
  const stored = await AsyncStorage.getItem(THEME_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    themeChoice = stored;
    emit();
  }
}

export function useScheme(): 'light' | 'dark' {
  const choice = useThemeChoice();
  const system = useColorScheme();
  if (choice === 'dark') {
    return 'dark';
  }
  if (choice === 'light') {
    return 'light';
  }
  return system === 'dark' ? 'dark' : 'light';
}

export function useColors(): Palette {
  return useScheme() === 'dark' ? darkColors : lightColors;
}
