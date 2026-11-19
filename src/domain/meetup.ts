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
  whenAt?: string;
  placeName: string;
  latitude: number;
  longitude: number;
  note: string;
  hostName: string;
  hostUsername: string;
  going?: boolean;
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

const START_EARLY_MS = 5 * 60_000;
const START_LATE_MS = 10 * 60_000;

export function scheduledAt(meetup: Meetup) {
  if (meetup.whenAt) {
    const time = Date.parse(meetup.whenAt);
    if (Number.isFinite(time)) {
      return time;
    }
  }
  return scheduledFromLabel(meetup.whenLabel, meetup.createdAt);
}

export function canBeginMeetup(meetup: Meetup, now = Date.now()) {
  const at = scheduledAt(meetup);
  if (at === null) {
    return false;
  }
  return now >= at - START_EARLY_MS && now <= at + START_LATE_MS;
}

function scheduledFromLabel(label: string, createdAt: string) {
  const [dayText, timeText] = label.split('·').map((part) => part.trim());
  const created = new Date(createdAt);
  if (!dayText || !timeText || Number.isNaN(created.getTime())) {
    return null;
  }
  const day = new Date(created);
  day.setHours(0, 0, 0, 0);
  if (/^mañana$/i.test(dayText)) {
    day.setDate(day.getDate() + 1);
  } else if (!/^hoy$/i.test(dayText)) {
    return null;
  }
  const clock = parseClock(timeText);
  if (!clock) {
    return null;
  }
  day.setHours(clock.hours, clock.minutes, 0, 0);
  return day.getTime();
}

function parseClock(value: string) {
  const hour12 = value.match(/(\d{1,2}):(\d{2})\s*([ap])\.?\s*m\.?/i);
  if (hour12) {
    let hours = Number(hour12[1]);
    const minutes = Number(hour12[2]);
    const pm = hour12[3].toLowerCase() === 'p';
    if (hours === 12) {
      hours = pm ? 12 : 0;
    } else if (pm) {
      hours += 12;
    }
    if (hours > 23 || minutes > 59) {
      return null;
    }
    return { hours, minutes };
  }
  const hour24 = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!hour24) {
    return null;
  }
  const hours = Number(hour24[1]);
  const minutes = Number(hour24[2]);
  if (hours > 23 || minutes > 59) {
    return null;
  }
  return { hours, minutes };
}
