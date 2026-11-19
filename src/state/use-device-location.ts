import * as Location from 'expo-location';
import { useCallback, useState } from 'react';

import type { LatLng } from '@/domain/geo';
import { useGroundHeading } from '@/state/use-ground-heading';

function toPoint(position: Location.LocationObject): LatLng {
  return { latitude: position.coords.latitude, longitude: position.coords.longitude };
}

export function useDeviceLocation() {
  const heading = useGroundHeading();
  const [point, setPoint] = useState<LatLng | null>(null);
  const [status, setStatus] = useState<'idle' | 'granted' | 'denied'>('idle');

  const locate = useCallback(async () => {
    try {
      const current = await Location.getForegroundPermissionsAsync();
      let granted = current.status === 'granted';
      if (!granted) {
        const asked = await Location.requestForegroundPermissionsAsync();
        granted = asked.status === 'granted';
      }
      if (!granted) {
        setStatus('denied');
        return null;
      }
      setStatus('granted');
      await Location.enableNetworkProviderAsync().catch(() => {
        // El GPS puede seguir funcionando si el usuario cierra el aviso de red.
      });

      const last = await Location.getLastKnownPositionAsync();
      if (last) {
        const known = toPoint(last);
        setPoint(known);
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          mayShowUserSettingsDialog: true,
        })
          .then((position) => setPoint(toPoint(position)))
          .catch(() => {
            // La última posición conocida ya centró el mapa.
          });
        return known;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Low,
        mayShowUserSettingsDialog: true,
      });
      const next = toPoint(position);
      setPoint(next);
      return next;
    } catch {
      const current = await Location.getForegroundPermissionsAsync().catch(() => null);
      setStatus(current?.status === 'granted' ? 'granted' : 'denied');
      return null;
    }
  }, []);

  return { point, heading, status, locate };
}
