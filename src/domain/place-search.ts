import { PASTO, PLACES, distanceKm, type LatLng } from '@/domain/geo';
import { fetchJson } from '@/domain/place-http';

export type PlaceHit = {
  id: string;
  name: string;
  detail: string;
  point: LatLng;
};

const PHOTON = ['https://photon.koalasec.org/api', 'https://photon.jacosverksted.no/api'];
const BBOX = '-77.42,1.12,-77.16,1.34';
const VIEWBOX = '-77.36,1.30,-77.20,1.15';

type SearchAddress = {
  house_number?: string;
  road?: string;
  pedestrian?: string;
  neighbourhood?: string;
  suburb?: string;
  quarter?: string;
};

type SearchRow = {
  place_id?: number;
  osm_type?: string;
  osm_id?: number;
  lat?: string;
  lon?: string;
  name?: string;
  category?: string;
  type?: string;
  address?: SearchAddress;
};

type PhotonFeature = {
  properties?: {
    name?: string;
    street?: string;
    housenumber?: string;
    locality?: string;
    district?: string;
    city?: string;
    countrycode?: string;
    osm_key?: string;
    osm_type?: string;
    osm_id?: number;
  };
  geometry?: { coordinates?: [number, number] };
};

function fold(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function searchText(query: string) {
  return fold(query)
    .replace(/\b(cra|cr|kr|krr)\b/g, 'carrera')
    .replace(/\b(cll|cl)\b/g, 'calle')
    .replace(/\b(avda|av)\b/g, 'avenida')
    .replace(/\b(diag|dg)\b/g, 'diagonal')
    .replace(/\b(trans|tv)\b/g, 'transversal')
    .replace(/\s+/g, ' ')
    .trim();
}

function localHits(query: string): PlaceHit[] {
  const text = fold(query);
  return PLACES.filter((place) => fold(place.name).includes(text)).map((place) => ({
    id: place.id,
    name: place.name,
    detail: 'Pasto',
    point: place.point,
  }));
}

function barrioName(value: string | undefined) {
  const area = (value || '').trim();
  if (!area || /^comuna\b/i.test(area)) {
    return '';
  }
  return area;
}

function streetLine(street: string, number: string) {
  if (!street || /^\d+$/.test(street)) {
    return '';
  }
  const house = number.replace(/^#\s*/, '');
  return house ? `${street} #${house}` : street;
}

function photonHit(feature: PhotonFeature): PlaceHit | null {
  const longitude = feature.geometry?.coordinates?.[0];
  const latitude = feature.geometry?.coordinates?.[1];
  if (latitude === undefined || longitude === undefined || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  const point = { latitude, longitude };
  if (distanceKm(PASTO, point) > 30) {
    return null;
  }
  const props = feature.properties ?? {};
  if (props.countrycode && props.countrycode !== 'CO') {
    return null;
  }
  const street = (props.street || '').trim();
  const number = (props.housenumber || '').trim();
  const rawName = (props.name || '').trim();
  const highway = props.osm_key === 'highway';
  const line = streetLine(street, number);
  const title = highway ? rawName : rawName || line;
  if (!title) {
    return null;
  }
  const parts: string[] = [];
  if (!highway && line && fold(line) !== fold(title) && !fold(title).startsWith(fold(street))) {
    parts.push(line);
  }
  const barrio = barrioName(props.locality) || barrioName(props.district);
  if (barrio && fold(barrio) !== fold(title)) {
    parts.push(barrio);
  }
  const city = (props.city || 'Pasto').trim();
  if (city && fold(city) !== fold(title) && !parts.some((part) => fold(part) === fold(city))) {
    parts.push(city);
  }
  return {
    id: `osm-${props.osm_type ?? 'x'}-${props.osm_id ?? `${latitude},${longitude}`}`,
    name: title,
    detail: parts.join(', ') || 'Pasto',
    point,
  };
}

function areaName(address: SearchAddress | undefined) {
  return barrioName(address?.neighbourhood || address?.suburb || address?.quarter);
}

function nominatimHit(row: SearchRow): PlaceHit | null {
  const latitude = Number(row.lat);
  const longitude = Number(row.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  const point = { latitude, longitude };
  if (distanceKm(PASTO, point) > 30) {
    return null;
  }
  const road = (row.address?.road || row.address?.pedestrian || '').trim();
  const number = (row.address?.house_number || '').trim().replace(/^#\s*/, '');
  const name = (row.name || road).trim();
  if (!name) {
    return null;
  }
  const street = row.category === 'highway';
  const title = street && number ? `${name} #${number}` : name;
  const parts: string[] = [];
  if (!street && road && road !== title && !title.startsWith(road)) {
    parts.push(number ? `${road} #${number}` : road);
  }
  const area = areaName(row.address);
  if (area && area !== title) {
    parts.push(area);
  }
  if (!parts.includes('Pasto')) {
    parts.push('Pasto');
  }
  return {
    id: `osm-${row.osm_type ?? 'x'}-${row.osm_id ?? row.place_id ?? `${latitude},${longitude}`}`,
    name: title,
    detail: parts.join(', '),
    point,
  };
}

function unique(hits: PlaceHit[]) {
  const seen: PlaceHit[] = [];
  for (const hit of hits) {
    const repeated = seen.some((item) => fold(item.name) === fold(hit.name) && fold(item.detail) === fold(hit.detail));
    if (!repeated) {
      seen.push(hit);
    }
  }
  return seen;
}

function tier(name: string, query: string) {
  const text = fold(name);
  if (text === query) {
    return 0;
  }
  if (text.startsWith(query)) {
    return 1;
  }
  if (text.split(/[^a-z0-9]+/).some((word) => word.startsWith(query))) {
    return 2;
  }
  if (text.includes(query)) {
    return 3;
  }
  return 4;
}

function matchLength(name: string, query: string) {
  const words = fold(name).split(/[^a-z0-9]+/).filter((word) => word.startsWith(query));
  return words.sort((left, right) => right.length - left.length)[0]?.length ?? 0;
}

function rank(hits: PlaceHit[], query: string) {
  return hits
    .map((hit, index) => ({ hit, index, tier: tier(hit.name, query), match: matchLength(hit.name, query) }))
    .sort((left, right) => left.tier - right.tier || right.match - left.match || left.index - right.index)
    .map((item) => item.hit);
}

async function photonHits(text: string, bias: LatLng, signal?: AbortSignal) {
  const query = `q=${encodeURIComponent(text)}&lat=${bias.latitude}&lon=${bias.longitude}&limit=8&zoom=14&bbox=${BBOX}`;
  for (const host of PHOTON) {
    try {
      const body = (await fetchJson(`${host}?${query}`, signal, 4500)) as { features?: PhotonFeature[] };
      return (body.features ?? []).flatMap((feature) => {
        const hit = photonHit(feature);
        return hit ? [hit] : [];
      });
    } catch (error) {
      if (signal?.aborted) {
        throw error;
      }
    }
  }
  return null;
}

async function nominatimHits(text: string, signal?: AbortSignal) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=jsonv2&addressdetails=1&limit=8&countrycodes=co&viewbox=${VIEWBOX}&bounded=0`;
  const body = await fetchJson(url, signal);
  const rows = Array.isArray(body) ? (body as SearchRow[]) : [];
  return rows.flatMap((row) => {
    const hit = nominatimHit(row);
    return hit ? [hit] : [];
  });
}

export async function searchPlaces(query: string, bias: LatLng = PASTO, signal?: AbortSignal): Promise<PlaceHit[]> {
  const text = searchText(query);
  if (!text) {
    return [];
  }
  const local = localHits(text);
  try {
    const remote = (await photonHits(text, bias, signal)) ?? (await nominatimHits(text, signal));
    const away = remote.filter((hit) => !local.some((place) => distanceKm(place.point, hit.point) < 0.08));
    return unique(rank([...local, ...away], text)).slice(0, 3);
  } catch (error) {
    if (local.length > 0) {
      return local;
    }
    throw error;
  }
}
