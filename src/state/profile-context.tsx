import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { displayCity } from '@/domain/cities';
import { emptyProfile, type Profile } from '@/domain/profile';

const STORAGE_KEY = 'salida.profile.v1';

type ProfileContextValue = {
  ready: boolean;
  profile: Profile;
  save: (patch: Partial<Profile>) => Promise<void>;
  reset: () => Promise<void>;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const profileRef = useRef(profile);
  profileRef.current = profile;

  useEffect(() => {
    let active = true;

    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!active || !raw) {
          return;
        }
        const stored = JSON.parse(raw) as Profile;
        setProfile({
          ...emptyProfile(),
          ...stored,
          city: displayCity(typeof stored.city === 'string' ? stored.city : ''),
          commentsOpen: stored.commentsOpen !== false,
          likesPublic: stored.likesPublic !== false,
        });
      })
      .catch(() => {
        // A broken local draft should not block the alta.
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

  const value = useMemo<ProfileContextValue>(
    () => ({
      ready,
      profile,
      async save(patch) {
        const next = { ...profileRef.current, ...patch };
        profileRef.current = next;
        setProfile(next);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      },
      async reset() {
        const next = emptyProfile();
        setProfile(next);
        await AsyncStorage.removeItem(STORAGE_KEY);
      },
    }),
    [profile, ready],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const value = useContext(ProfileContext);
  if (!value) {
    throw new Error('useProfile debe usarse dentro de ProfileProvider');
  }
  return value;
}
