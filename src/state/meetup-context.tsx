import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import type { Meetup } from '@/domain/meetup';

const STORAGE_KEY = 'salida.meetups.v1';

type MeetupContextValue = {
  ready: boolean;
  meetups: Meetup[];
  add: (meetup: Meetup) => Promise<void>;
  update: (id: string, patch: Partial<Meetup>) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

const MeetupContext = createContext<MeetupContextValue | null>(null);

function isMeetup(value: unknown): value is Meetup {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const meetup = value as Meetup;
  return typeof meetup.id === 'string' && typeof meetup.latitude === 'number' && typeof meetup.longitude === 'number';
}

export function MeetupProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [meetups, setMeetups] = useState<Meetup[]>([]);
  const meetupsRef = useRef(meetups);
  meetupsRef.current = meetups;

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!active || !raw) {
          return;
        }
        const stored = JSON.parse(raw) as unknown;
        if (Array.isArray(stored)) {
          setMeetups(stored.filter(isMeetup));
        }
      })
      .catch(() => {
        // A broken local list should not block the map.
      })
      .finally(() => {
        if (active) {
          setReady(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<MeetupContextValue>(
    () => ({
      ready,
      meetups,
      async add(meetup) {
        const next = [meetup, ...meetupsRef.current];
        meetupsRef.current = next;
        setMeetups(next);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      },
      async update(id, patch) {
        const next = meetupsRef.current.map((meetup) => (meetup.id === id ? { ...meetup, ...patch } : meetup));
        meetupsRef.current = next;
        setMeetups(next);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      },
      async remove(id) {
        const next = meetupsRef.current.filter((meetup) => meetup.id !== id);
        meetupsRef.current = next;
        setMeetups(next);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      },
    }),
    [meetups, ready],
  );

  return <MeetupContext.Provider value={value}>{children}</MeetupContext.Provider>;
}

export function useMeetups() {
  const value = useContext(MeetupContext);
  if (!value) {
    throw new Error('useMeetups debe usarse dentro de MeetupProvider');
  }
  return value;
}
