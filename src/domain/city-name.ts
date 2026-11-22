import type { LatLng } from '@/domain/geo';
import { fetchJson } from '@/domain/place-http';

const REVERSE = ['https://photon.koalasec.org/reverse', 'https://photon.jacosverksted.no/reverse'];
const cache = new Map<string, { name: string; region: string }>();

export type DetectedCity = {
  name: string;
  region: string;
};

function cacheKey(point: LatLng) {
  return `${point.latitude.toFixed(2)},${point.longitude.toFixed(2)}`;
}

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function cityAt(point: LatLng, signal?: AbortSignal): Promise<DetectedCity | null> {
  const key = cacheKey(point);
  const saved = cache.get(key);
  if (saved) {
    return saved;
  }
  const found = (await photonCity(point, signal)) || (await nominatimCity(point, signal));
  if (!found) {
    return null;
  }
  if (cache.size > 40) {
    cache.clear();
  }
  cache.set(key, found);
  return found;
}

async function photonCity(point: LatLng, signal?: AbortSignal): Promise<DetectedCity | null> {
  const query = `lat=${point.latitude}&lon=${point.longitude}&limit=1`;
  for (const host of REVERSE) {
    try {
      const body = (await fetchJson(`${host}?${query}`, signal, 6000)) as {
        features?: { properties?: { city?: string; state?: string } }[];
      };
      const properties = body.features?.[0]?.properties;
      const name = clean(properties?.city);
      if (name) {
        return { name, region: clean(properties?.state) };
      }
    } catch (error) {
      if (signal?.aborted) {
        throw error;
      }
    }
  }
  return null;
}

async function nominatimCity(point: LatLng, signal?: AbortSignal): Promise<DetectedCity | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${point.latitude}&lon=${point.longitude}&zoom=10&addressdetails=1`;
  try {
    const row = (await fetchJson(url, signal)) as {
      address?: { city?: string; town?: string; village?: string; municipality?: string; state?: string };
    };
    const address = row.address;
    const name = clean(address?.city || address?.town || address?.village || address?.municipality);
    if (!name) {
      return null;
    }
    return { name, region: clean(address?.state) };
  } catch (error) {
    if (signal?.aborted) {
      throw error;
    }
    return null;
  }
}
