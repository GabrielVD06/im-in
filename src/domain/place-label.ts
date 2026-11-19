import { distanceKm, placeNameNear, type LatLng } from '@/domain/geo';
import { fetchJson } from '@/domain/place-http';

const REVERSE = ['https://photon.koalasec.org/reverse', 'https://photon.jacosverksted.no/reverse'];
const VENUE_KEYS = new Set(['amenity', 'shop', 'tourism', 'leisure', 'office', 'healthcare', 'historic', 'craft', 'sport']);
const SKIP_VALUES = new Set([
  'bench',
  'waste_basket',
  'toilets',
  'post_box',
  'telephone',
  'drinking_water',
  'recycling',
  'camera',
  'surveillance',
  'traffic_signals',
  'elevator',
  'entrance',
  'gate',
  'street_lamp',
  'parking',
  'parking_space',
  'parking_entrance',
  'bicycle_parking',
  'motorcycle_parking',
  'information',
  'guidepost',
  'yes',
  'house',
  'residential',
  'garage',
  'shed',
  'hut',
  'roof',
]);
const LABEL_NEAR_KM = 0.12;
const SHOW_KM = 0.35;
const SHOW_MAX = 6;

export type ReferencePlace = {
  name: string;
  point: LatLng;
};

export type PointDescription = {
  label: string;
  places: ReferencePlace[];
};

type ReverseAddress = {
  house_number?: string;
  road?: string;
  pedestrian?: string;
  residential?: string;
  footway?: string;
  neighbourhood?: string;
  suburb?: string;
  quarter?: string;
};

type ReverseRow = {
  error?: string;
  name?: string;
  category?: string;
  lat?: string;
  lon?: string;
  address?: ReverseAddress;
};

type PhotonFeature = {
  properties?: {
    name?: string;
    street?: string;
    locality?: string;
    district?: string;
    osm_key?: string;
    osm_value?: string;
  };
  geometry?: { coordinates?: number[] };
};

type Spot = {
  name: string;
  street: string;
  area: string;
  key: string;
  value: string;
  point: LatLng;
  distance: number;
};

const cache = new Map<string, PointDescription>();

function cacheKey(point: LatLng) {
  return `${point.latitude.toFixed(4)},${point.longitude.toFixed(4)}`;
}

function remember(point: LatLng, described: PointDescription) {
  if (cache.size > 200) {
    cache.clear();
  }
  cache.set(cacheKey(point), described);
}

function aborted() {
  const error = new Error('Aborted');
  error.name = 'AbortError';
  return error;
}

function fold(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function cleanArea(value: string | undefined) {
  const area = (value || '').trim();
  if (!area || /^comuna\b/i.test(area)) {
    return '';
  }
  return area;
}

function roadName(address: ReverseAddress | undefined) {
  return (address?.road || address?.pedestrian || address?.residential || address?.footway || '').trim();
}

function areaName(address: ReverseAddress | undefined) {
  return cleanArea(address?.neighbourhood || address?.suburb || address?.quarter);
}

function houseNumber(address: ReverseAddress | undefined) {
  return (address?.house_number || '').trim().replace(/^#\s*/, '');
}

function isVenue(spot: Spot) {
  if (!spot.name || SKIP_VALUES.has(spot.value)) {
    return false;
  }
  if (spot.key === 'building') {
    return true;
  }
  return VENUE_KEYS.has(spot.key);
}

function compose(venue: string, street: string, area: string) {
  const parts: string[] = [];
  if (venue) {
    parts.push(venue);
  }
  if (street && fold(street) !== fold(venue)) {
    parts.push(street);
  }
  if (area && !parts.some((part) => fold(part) === fold(area))) {
    parts.push(area);
  }
  if (parts.length === 1 && !area) {
    parts.push('Pasto');
  }
  return parts.join(', ');
}

function fromSpots(spots: Spot[]): PointDescription {
  const ordered = [...spots].sort((left, right) => left.distance - right.distance);
  const streetSpot = ordered.find((spot) => spot.key === 'highway' && spot.name && spot.distance <= 0.2);
  const street = streetSpot?.name || ordered.find((spot) => spot.street)?.street || '';
  const area = cleanArea(streetSpot?.area || ordered.find((spot) => spot.area)?.area);
  const venues = ordered.filter((spot) => isVenue(spot) && spot.distance <= SHOW_KM && fold(spot.name) !== fold(street));
  const seen = new Set<string>();
  const places: ReferencePlace[] = [];
  for (const spot of venues) {
    const key = fold(spot.name);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    places.push({ name: spot.name, point: spot.point });
    if (places.length >= SHOW_MAX) {
      break;
    }
  }
  const near = venues.find((spot) => spot.distance <= LABEL_NEAR_KM);
  return { label: compose(near?.name || '', street, area), places };
}

function spotFrom(feature: PhotonFeature, origin: LatLng): Spot | null {
  const coordinates = feature.geometry?.coordinates;
  const longitude = coordinates?.[0];
  const latitude = coordinates?.[1];
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return null;
  }
  const point = { latitude, longitude };
  const properties = feature.properties;
  return {
    name: (properties?.name || '').trim(),
    street: (properties?.street || '').trim(),
    area: cleanArea(properties?.locality || properties?.district),
    key: properties?.osm_key || '',
    value: properties?.osm_value || '',
    point,
    distance: distanceKm(origin, point),
  };
}

async function photonSpots(point: LatLng, signal?: AbortSignal) {
  const query = `lat=${point.latitude}&lon=${point.longitude}&limit=40`;
  for (const host of REVERSE) {
    try {
      const body = (await fetchJson(`${host}?${query}`, signal, 6000)) as { features?: PhotonFeature[] };
      return (body.features ?? []).flatMap((feature) => {
        const spot = spotFrom(feature, point);
        return spot ? [spot] : [];
      });
    } catch (error) {
      if (signal?.aborted) {
        throw error;
      }
    }
  }
  return null;
}

async function reverseRow(point: LatLng, signal?: AbortSignal) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${point.latitude}&lon=${point.longitude}&zoom=18&addressdetails=1`;
  return (await fetchJson(url, signal)) as ReverseRow;
}

export function formatPointLabel(row: ReverseRow, _point: LatLng) {
  const road = roadName(row.address);
  const number = houseNumber(row.address);
  const area = areaName(row.address);
  const street = road && number ? `${road} #${number}` : road;
  if (street && area) {
    return `${street}, ${area}`;
  }
  if (street) {
    return `${street}, Pasto`;
  }
  if (area) {
    return `${area}, Pasto`;
  }
  return 'Punto en el mapa';
}

function fromNominatim(row: ReverseRow, point: LatLng): PointDescription {
  const street = formatPointLabel(row, point);
  const name = (row.name || '').trim();
  const latitude = Number(row.lat);
  const longitude = Number(row.lon);
  const near = Number.isFinite(latitude) && Number.isFinite(longitude) ? distanceKm(point, { latitude, longitude }) <= LABEL_NEAR_KM : false;
  const venue =
    near &&
    name &&
    row.category !== 'highway' &&
    row.category !== 'boundary' &&
    row.category !== 'place' &&
    row.category !== 'landuse' &&
    fold(name) !== fold(roadName(row.address))
      ? name
      : '';
  if (!venue || street === 'Punto en el mapa') {
    return { label: venue || street, places: [] };
  }
  return { label: `${venue}, ${street}`, places: [{ name: venue, point: { latitude, longitude } }] };
}

export async function describePoint(point: LatLng, signal?: AbortSignal): Promise<PointDescription> {
  const cached = cache.get(cacheKey(point));
  if (cached) {
    return cached;
  }
  try {
    const spots = await photonSpots(point, signal);
    if (signal?.aborted) {
      throw aborted();
    }
    if (spots && spots.length > 0) {
      const described = fromSpots(spots);
      if (described.label) {
        remember(point, described);
        return described;
      }
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw error;
    }
  }
  if (signal?.aborted) {
    throw aborted();
  }
  try {
    const row = await reverseRow(point, signal);
    if (row && !row.error) {
      const described = fromNominatim(row, point);
      if (described.label && described.label !== 'Punto en el mapa') {
        remember(point, described);
        return described;
      }
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw error;
    }
  }
  return { label: placeNameNear(point), places: [] };
}

export async function labelPoint(point: LatLng, signal?: AbortSignal) {
  const described = await describePoint(point, signal);
  return described.label;
}
