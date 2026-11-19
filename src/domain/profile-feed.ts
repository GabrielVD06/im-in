import { formatDistance } from '@/domain/geo';
import { planSummary, type Meetup, type MeetupAudience } from '@/domain/meetup';
import { sportName, type SportId } from '@/domain/profile';

export function ownEfforts(meetups: Meetup[], username: string) {
  return meetups.filter((meetup) => meetup.hostUsername === username && hasRoute(meetup));
}

export function ownPlans(meetups: Meetup[], username: string) {
  return meetups.filter((meetup) => meetup.hostUsername === username && (meetup.audience ?? 'public') !== 'solo');
}

export function effortFacts(meetup: Meetup) {
  const distanceKm = meetup.path?.distanceKm ?? 0;
  const elapsed = elapsedOf(meetup);
  return {
    title: sportName(meetup.sportId),
    when: meetup.whenLabel,
    distance: formatDistance(distanceKm),
    time: elapsed ? clock(elapsed) : null,
    pace: paceLabel(meetup.sportId, distanceKm, elapsed),
  };
}

export function planFacts(meetup: Meetup) {
  return {
    title: sportName(meetup.sportId),
    when: meetup.whenLabel,
    place: meetup.placeName,
    audience: audienceLabel(meetup.audience),
    summary: planSummary(meetup),
  };
}

function hasRoute(meetup: Meetup) {
  return (meetup.path?.points.length ?? 0) > 1 && (meetup.path?.distanceKm ?? 0) > 0;
}

function elapsedOf(meetup: Meetup) {
  const last = meetup.path?.points[meetup.path.points.length - 1] as { elapsed?: number } | undefined;
  return last && typeof last.elapsed === 'number' && last.elapsed > 0 ? last.elapsed : null;
}

function paceLabel(sportId: SportId, distanceKm: number, elapsedMs: number | null) {
  if (distanceKm < 1 || elapsedMs === null) {
    return null;
  }
  if (sportId === 'cycle') {
    const speed = distanceKm / (elapsedMs / 3600000);
    const text = speed < 30 ? speed.toFixed(1) : String(Math.round(speed));
    return `${text.replace('.', ',')} km/h`;
  }
  return `${clock(elapsedMs / distanceKm)} / km`;
}

function audienceLabel(audience: MeetupAudience | undefined) {
  if (audience === 'private') {
    return 'Privada';
  }
  return 'Pública';
}

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
