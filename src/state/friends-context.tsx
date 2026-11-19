import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

const STORAGE_KEY = 'salida.friends.v1';

export type Friend = {
  id: string;
  name: string;
};

type FriendsContextValue = {
  friends: Friend[];
};

const FriendsContext = createContext<FriendsContextValue | null>(null);

function isFriend(value: unknown): value is Friend {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const friend = value as Friend;
  return typeof friend.id === 'string' && typeof friend.name === 'string' && friend.name.trim().length > 0;
}

export function FriendsProvider({ children }: { children: ReactNode }) {
  const [friends, setFriends] = useState<Friend[]>([]);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!active || !raw) {
          return;
        }
        const stored = JSON.parse(raw) as unknown;
        if (Array.isArray(stored)) {
          setFriends(stored.filter(isFriend));
        }
      })
      .catch(() => {
        // Una lista rota no inventa amigos.
      });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(() => ({ friends }), [friends]);
  return <FriendsContext.Provider value={value}>{children}</FriendsContext.Provider>;
}

export function useFriends() {
  const value = useContext(FriendsContext);
  if (!value) {
    throw new Error('useFriends debe usarse dentro de FriendsProvider');
  }
  return value;
}
