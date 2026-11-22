import cities from '@/domain/colombia-cities.json';

import { CITY } from '@/domain/profile';

export type ColombianCity = {
  name: string;
  department: string;
};

export const COLOMBIAN_CITIES = cities as ColombianCity[];

export function foldCity(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export function matchCity(name: string, region = '') {
  const wanted = foldCity(name);
  if (!wanted) {
    return null;
  }
  const hits = COLOMBIAN_CITIES.filter((city) => foldCity(city.name) === wanted);
  if (hits.length === 0) {
    return null;
  }
  if (hits.length === 1 || !region.trim()) {
    return hits[0];
  }
  const area = foldCity(region);
  return hits.find((city) => area.includes(foldCity(city.department)) || foldCity(city.department).includes(area)) ?? hits[0];
}

export function searchCities(query: string) {
  const wanted = foldCity(query);
  if (wanted.length < 1) {
    return [];
  }
  return COLOMBIAN_CITIES.filter((city) => foldCity(`${city.name} ${city.department}`).includes(wanted))
    .sort((left, right) => {
      const leftName = foldCity(left.name);
      const rightName = foldCity(right.name);
      const leftRank = leftName.startsWith(wanted) ? 0 : leftName.includes(wanted) ? 1 : 2;
      const rightRank = rightName.startsWith(wanted) ? 0 : rightName.includes(wanted) ? 1 : 2;
      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }
      return leftName.localeCompare(rightName, 'es');
    })
    .slice(0, 40);
}

export function displayCity(city: string | null | undefined) {
  const match = matchCity(city ?? '');
  if (match) {
    return match.name;
  }
  const trimmed = (city ?? '').trim();
  if (trimmed && foldCity(trimmed) !== foldCity(CITY.name)) {
    return trimmed;
  }
  return CITY.name;
}
