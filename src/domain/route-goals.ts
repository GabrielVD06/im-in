import { formatDistance } from '@/domain/geo';
import type { Meetup } from '@/domain/meetup';
import type { SportId } from '@/domain/profile';

function clock(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${minutes}:${pad(seconds)}`;
}

export type RouteGoal = {
  id: string;
  title: string;
  detail: string;
};

const MARKS = [1, 2, 3, 5, 8, 10, 15, 21, 30, 42];
const MIN_KM = 0.2;
const PACE_KM = 1;

type Effort = {
  distanceKm: number;
  elapsedMs: number | null;
};

function efforts(meetups: Meetup[], sportId: SportId): Effort[] {
  return meetups.flatMap((meetup) => {
    const path = meetup.path;
    if (meetup.sportId !== sportId || !path || path.points.length < 2 || path.distanceKm < MIN_KM) {
      return [];
    }
    const last = path.points[path.points.length - 1] as { elapsed?: number };
    const elapsedMs = typeof last.elapsed === 'number' && last.elapsed > 0 ? last.elapsed : null;
    return [{ distanceKm: path.distanceKm, elapsedMs }];
  });
}

function markTitle(km: number) {
  if (km === 21) {
    return 'Llega a la media maratón';
  }
  if (km === 42) {
    return 'Llega al maratón';
  }
  return `Llega a ${km} km`;
}

export function routeGoals(meetups: Meetup[], sportId: SportId): RouteGoal[] {
  const done = efforts(meetups, sportId);
  if (done.length === 0) {
    return [
      {
        id: 'first',
        title: 'Completa 1 km',
        detail: 'Cuando termines, la siguiente meta sale de este recorrido.',
      },
    ];
  }
  const best = Math.max(...done.map((effort) => effort.distanceKm));
  const next = MARKS.find((mark) => mark > best + 0.05);
  const goals: RouteGoal[] = [
    next
      ? { id: 'distance', title: markTitle(next), detail: `Tu recorrido más largo es ${formatDistance(best)}.` }
      : { id: 'distance', title: `Pasa de ${formatDistance(best)}`, detail: 'Es tu recorrido más largo.' },
  ];
  const latest = done[0];
  const latestTime = latest.elapsedMs !== null ? ` en ${clock(latest.elapsedMs)}` : '';
  goals.push({
    id: 'latest',
    title: 'Supera la última',
    detail: `La última fue ${formatDistance(latest.distanceKm)}${latestTime}.`,
  });
  const paced = done.filter((effort): effort is Effort & { elapsedMs: number } => effort.distanceKm >= PACE_KM && effort.elapsedMs !== null);
  if (sportId === 'cycle' && paced.length > 0) {
    const fastest = Math.max(...paced.map((effort) => effort.distanceKm / (effort.elapsedMs / 3600000)));
    goals.push({
      id: 'pace',
      title: `Pasa de ${formatSpeed(fastest)} km/h`,
      detail: 'Es tu mejor velocidad en un recorrido de al menos 1 km.',
    });
  } else if (paced.length > 0) {
    const bestPace = Math.min(...paced.map((effort) => effort.elapsedMs / effort.distanceKm));
    goals.push({
      id: 'pace',
      title: `Baja de ${clock(bestPace)} / km`,
      detail: 'Es tu mejor ritmo en un recorrido de al menos 1 km.',
    });
  }
  return goals.slice(0, 3);
}

function formatSpeed(kmh: number) {
  const text = kmh < 30 ? kmh.toFixed(1) : String(Math.round(kmh));
  return text.replace('.', ',');
}

export function routeMark(meetups: Meetup[], sportId: SportId) {
  const done = efforts(meetups, sportId);
  const moving = sportId === 'cycle' ? 'velocidad' : 'ritmo';
  if (done.length === 0) {
    return {
      label: 'Sin recorridos',
      detail: `La distancia y la ${moving} salen cuando terminas una salida. Con eso se juntan personas parecidas.`,
    };
  }
  const best = Math.max(...done.map((effort) => effort.distanceKm));
  const timed = done.filter((effort): effort is Effort & { elapsedMs: number } => effort.distanceKm >= PACE_KM && effort.elapsedMs !== null);
  if (sportId === 'cycle') {
    const fastest = timed.reduce<number | null>((bestSpeed, effort) => {
      const speed = effort.distanceKm / (effort.elapsedMs / 3600000);
      return bestSpeed === null || speed > bestSpeed ? speed : bestSpeed;
    }, null);
    const speed = fastest === null ? null : formatSpeed(fastest);
    return {
      label: speed ? `${formatDistance(best)} · ${speed} km/h` : formatDistance(best),
      detail: 'Se compara por distancia y velocidad parecidas, y por estatura y peso cercanos.',
    };
  }
  const bestPace = timed.length > 0 ? Math.min(...timed.map((effort) => effort.elapsedMs / effort.distanceKm)) : null;
  return {
    label: bestPace !== null ? `${formatDistance(best)} · ${clock(bestPace)} / km` : formatDistance(best),
    detail: 'Se compara por distancia y ritmo parecidos, y por estatura y peso cercanos.',
  };
}
