import type { SportId } from '@/domain/profile';
import type { RouteDistance } from '@/domain/route-distance';

export const TARGET_MIN_MINUTES = 5;
export const TARGET_MAX_MINUTES = 12 * 60;

export function clampTargetMinutes(minutes: number) {
  const rounded = Math.round(minutes);
  return Math.min(TARGET_MAX_MINUTES, Math.max(TARGET_MIN_MINUTES, rounded));
}

export function defaultTargetMinutes(sportId: SportId, distance: RouteDistance) {
  const km = distance === 'over' ? 42 : distance;
  const raw = sportId === 'cycle' ? (km / 25) * 60 : km * 6;
  return clampTargetMinutes(Math.round(raw / 5) * 5);
}

export function durationText(minutes: number) {
  const safe = clampTargetMinutes(minutes);
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  if (hours === 0) {
    return `${mins} min`;
  }
  if (mins === 0) {
    return `${hours} h`;
  }
  return `${hours} h ${String(mins).padStart(2, '0')} min`;
}

export function plannedPaceText(sportId: SportId, distance: RouteDistance, minutes: number) {
  if ((sportId !== 'run' && sportId !== 'cycle') || distance === 'over') {
    return null;
  }
  const safe = clampTargetMinutes(minutes);
  if (sportId === 'cycle') {
    return `${formatSpeed(distance / (safe / 60))} km/h`;
  }
  return `${paceClock((safe * 60_000) / distance)} / km`;
}

export function effortPaceLine(sportId: SportId, distance: RouteDistance, minutes: number) {
  const pace = plannedPaceText(sportId, distance, minutes);
  if (!pace) {
    const name = sportId === 'cycle' ? 'velocidad' : 'ritmo';
    return `En ${durationText(minutes)} la ${name} queda abierta.`;
  }
  const name = sportId === 'cycle' ? 'Velocidad media' : 'Ritmo medio';
  return `${name} ${pace}`;
}

function paceClock(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatSpeed(kmh: number) {
  const text = kmh < 30 ? kmh.toFixed(1) : String(Math.round(kmh));
  return text.replace(/\.0$/, '').replace('.', ',');
}
