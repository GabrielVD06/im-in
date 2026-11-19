export type LatLng = {
  latitude: number;
  longitude: number;
};

export const PASTO: LatLng = {
  latitude: 1.21461,
  longitude: -77.27829,
};

export const PLACES: { id: string; name: string; point: LatLng }[] = [
  { id: 'plaza', name: 'Plaza de Nariño', point: { latitude: 1.21461, longitude: -77.27829 } },
  { id: 'libertad', name: 'Estadio Libertad', point: { latitude: 1.198011, longitude: -77.277608 } },
  { id: 'udenar', name: 'Universidad de Nariño', point: { latitude: 1.234167, longitude: -77.285278 } },
];

export const RADII_KM = [2, 5, 10, 25] as const;

export type RadiusKm = (typeof RADII_KM)[number];

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function distanceKm(from: LatLng, to: LatLng) {
  const earth = 6371;
  const latitude = toRadians(to.latitude - from.latitude);
  const longitude = toRadians(to.longitude - from.longitude);
  const start = toRadians(from.latitude);
  const end = toRadians(to.latitude);
  const arc =
    Math.sin(latitude / 2) ** 2 + Math.cos(start) * Math.cos(end) * Math.sin(longitude / 2) ** 2;
  return 2 * earth * Math.asin(Math.sqrt(arc));
}

export function formatDistance(km: number) {
  if (km < 1) {
    return `${Math.max(50, Math.round(km * 1000 / 50) * 50)} m`;
  }
  const text = km < 10 ? km.toFixed(1) : String(Math.round(km));
  return `${text.replace('.', ',')} km`;
}

const KNOWN_PLACE_KM = 0.08;

export function placeNameNear(point: LatLng) {
  const near = PLACES.find((place) => distanceKm(place.point, point) < KNOWN_PLACE_KM);
  return near?.name ?? 'Punto en el mapa';
}
