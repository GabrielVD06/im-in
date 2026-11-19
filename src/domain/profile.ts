export const CONSENT_VERSION = 'co-pasto-1';

export const CITY = {
  id: 'pasto',
  name: 'Pasto',
} as const;

export const SPORTS = [
  { id: 'run', name: 'Running', kind: 'route' },
  { id: 'cycle', name: 'Ciclismo', kind: 'route' },
  { id: 'padel', name: 'Pádel', kind: 'court' },
  { id: 'football', name: 'Fútbol', kind: 'court' },
  { id: 'basketball', name: 'Baloncesto', kind: 'court' },
] as const;

export const LEVELS = [
  { id: 'principiante', name: 'Principiante' },
  { id: 'intermedio', name: 'Intermedio' },
  { id: 'avanzado', name: 'Avanzado' },
] as const;

export const MAX_SPORTS = 2;

export type SportId = (typeof SPORTS)[number]['id'];
export type LevelId = (typeof LEVELS)[number]['id'];
export type ConsentId = 'account' | 'location' | 'face';

export type ConsentChoice = {
  id: ConsentId;
  accepted: boolean;
  version: string;
  at: string;
};

export type SportChoice = {
  sportId: SportId;
  level: LevelId | null;
};

export type Profile = {
  name: string;
  lastName: string;
  email: string;
  username: string;
  ageConfirmed: boolean;
  consents: ConsentChoice[];
  sports: SportChoice[];
  heightCm: number | null;
  weightKg: number | null;
  photoUri: string | null;
  bio: string;
  commentsOpen: boolean;
  likesPublic: boolean;
  city: typeof CITY.id;
  completedAt: string | null;
};

export const emptyProfile = (): Profile => ({
  name: '',
  lastName: '',
  email: '',
  username: '',
  ageConfirmed: false,
  consents: [],
  sports: [],
  heightCm: null,
  weightKg: null,
  photoUri: null,
  bio: '',
  commentsOpen: true,
  likesPublic: true,
  city: CITY.id,
  completedAt: null,
});

export function sportName(id: SportId) {
  return SPORTS.find((sport) => sport.id === id)?.name ?? id;
}

export function levelName(id: LevelId | null | undefined) {
  if (!id) {
    return '';
  }
  return LEVELS.find((level) => level.id === id)?.name ?? id;
}

export function bodyIndex(heightCm: number, weightKg: number) {
  const meters = heightCm / 100;
  if (meters <= 0) {
    return null;
  }
  return Math.round((weightKg / (meters * meters)) * 10) / 10;
}

export function formatBodyIndex(index: number) {
  return index.toFixed(1).replace('.', ',');
}

export function consentAccepted(profile: Profile, id: ConsentId) {
  return profile.consents.find((consent) => consent.id === id)?.accepted ?? false;
}

export function upsertConsent(profile: Profile, id: ConsentId, accepted: boolean): ConsentChoice[] {
  return [
    ...profile.consents.filter((consent) => consent.id !== id),
    { id, accepted, version: CONSENT_VERSION, at: new Date().toISOString() },
  ];
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[A-Za-z0-9._]{3,20}$/;

export function isValidEmail(value: string) {
  return EMAIL_PATTERN.test(value.trim());
}

export function normalizeUsername(value: string) {
  return value.trim().replace(/\s/g, '');
}

export function isValidUsername(value: string) {
  return USERNAME_PATTERN.test(value);
}
