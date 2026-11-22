import { useEffect } from 'react';

import { matchCity } from '@/domain/cities';
import { cityAt } from '@/domain/city-name';
import { consentAccepted } from '@/domain/profile';
import { useProfile } from '@/state/profile-context';
import { useDeviceLocation } from '@/state/use-device-location';

export function CitySync() {
  const { profile, save } = useProfile();
  const locationOn = consentAccepted(profile, 'location');
  const { point, locate } = useDeviceLocation();
  const latitude = point ? Number(point.latitude.toFixed(2)) : null;
  const longitude = point ? Number(point.longitude.toFixed(2)) : null;

  useEffect(() => {
    if (!locationOn) {
      return;
    }
    void locate();
  }, [locationOn, locate]);

  useEffect(() => {
    if (!locationOn || !profile.completedAt || !point || latitude === null || longitude === null) {
      return;
    }
    const here = point;
    let alive = true;
    cityAt(here)
      .then((found) => {
        if (!alive || !found) {
          return;
        }
        const match = matchCity(found.name, found.region);
        if (!match || match.name === profile.city) {
          return;
        }
        void save({ city: match.name });
      })
      .catch(() => {
        // Sin red, se queda la ciudad elegida en el registro.
      });
    return () => {
      alive = false;
    };
  }, [locationOn, profile.completedAt, profile.city, point, latitude, longitude, save]);

  return null;
}
