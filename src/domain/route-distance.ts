export const ROUTE_KM_MAX = 42;
export const BASE_DISTANCES = [1, 5, 10, 21, 42] as const;

export type BaseDistance = (typeof BASE_DISTANCES)[number];
export type RouteDistance = number | 'over';

export function wheelDistances(): RouteDistance[] {
  return [...Array.from({ length: ROUTE_KM_MAX }, (_, index) => index + 1), 'over'];
}

export function distanceWheelLabel(distance: RouteDistance) {
  return distance === 'over' ? '+42' : String(distance);
}

export function distanceCaption(distance: RouteDistance) {
  if (distance === 21) {
    return 'Media maratón';
  }
  if (distance === 42) {
    return 'Maratón';
  }
  if (distance === 'over') {
    return 'Más de 42 km';
  }
  return 'km';
}

export function baseTitle(km: BaseDistance) {
  if (km === 21) {
    return 'Media maratón';
  }
  if (km === 42) {
    return 'Maratón';
  }
  return `${km} km`;
}

export function plannedDistanceText(distance: RouteDistance, finishName?: string) {
  const head =
    distance === 'over' ? 'Más de 42 km' : distance === 21 ? '21 km · media maratón' : distance === 42 ? '42 km · maratón' : `${kmText(distance)} km`;
  return finishName ? `${head} · hasta ${finishName}` : head;
}

function kmText(km: number) {
  return (Number.isInteger(km) ? String(km) : km.toFixed(1)).replace('.', ',');
}
