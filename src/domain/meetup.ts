import type { LatLng } from '@/domain/geo';
import { SPORTS, sportName, type LevelId, type SportId } from '@/domain/profile';
import { plannedDistanceText, type RouteDistance } from '@/domain/route-distance';
import { durationText, plannedPaceText } from '@/domain/route-pace';

export type MeetupAudience = 'public' | 'private' | 'solo';

export type MeetupFinish = {
  name: string;
  latitude: number;
  longitude: number;
};

export type MatchFormat = 5 | 7 | 11;

export type MeetupRoster = {
  have: number;
  need: number;
  role?: 'portero';
  format?: MatchFormat;
};

export type Meetup = {
  id: string;
  sportId: SportId;
  level: LevelId | null;
  whenLabel: string;
  placeName: string;
  latitude: number;
  longitude: number;
  note: string;
  hostName: string;
  hostUsername: string;
  createdAt: string;
  audience?: MeetupAudience;
  distanceKm?: number;
  distanceOver42?: boolean;
  targetMinutes?: number;
  finish?: MeetupFinish;
  roster?: MeetupRoster;
  path?: MeetupPath;
};

export type MeetupPath = {
  distanceKm: number;
  points: LatLng[];
  steps?: number;
};

export function isRouteSport(id: SportId) {
  return SPORTS.find((sport) => sport.id === id)?.kind === 'route';
}

function routeDistanceOf(meetup: Meetup): RouteDistance | null {
  if (meetup.distanceOver42) {
    return 'over';
  }
  if (typeof meetup.distanceKm === 'number' && meetup.distanceKm > 0) {
    return meetup.distanceKm;
  }
  return null;
}

export function courtCapacity(id: SportId, format: MatchFormat = 5) {
  if (id === 'padel') {
    return 4;
  }
  if (id === 'basketball') {
    return 10;
  }
  if (id === 'football') {
    if (format === 11) {
      return 22;
    }
    if (format === 7) {
      return 14;
    }
    return 10;
  }
  return 1;
}

function effortText(meetup: Meetup, distance: RouteDistance) {
  if (typeof meetup.targetMinutes !== 'number' || meetup.targetMinutes <= 0) {
    return '';
  }
  const duration = durationText(meetup.targetMinutes);
  const pace = plannedPaceText(meetup.sportId, distance, meetup.targetMinutes);
  return pace ? `${duration} · ${pace}` : duration;
}

export function planSummary(meetup: Meetup) {
  const distance = routeDistanceOf(meetup);
  if (distance !== null) {
    const head = plannedDistanceText(distance, meetup.finish?.name);
    const effort = effortText(meetup, distance);
    return effort ? `${head} · ${effort}` : head;
  }
  if (meetup.roster && meetup.audience !== 'solo') {
    const missing = meetup.roster.need === 0 ? 'completo' : meetup.roster.need === 1 ? 'falta 1' : `faltan ${meetup.roster.need}`;
    const role = meetup.roster.role === 'portero' && meetup.roster.need > 0 ? ' · portero' : '';
    const head = meetup.sportId === 'football' && meetup.roster.format ? `Fútbol ${meetup.roster.format}` : sportName(meetup.sportId);
    return `${head} · somos ${meetup.roster.have} · ${missing}${role}`;
  }
  return '';
}

export function isPublicMeetup(meetup: Meetup) {
  return (meetup.audience ?? 'public') === 'public';
}

export const WHEN_OPTIONS = ['Hoy · 6:00 p. m.', 'Mañana · 6:00 a. m.', 'Mañana · 6:00 p. m.', 'Sábado · 8:00 a. m.'] as const;

export function meetupPoint(meetup: Meetup): LatLng {
  return { latitude: meetup.latitude, longitude: meetup.longitude };
}
