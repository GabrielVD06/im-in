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

export type AgeBand = 'blocked' | 'teen' | 'adult';

export type Profile = {
  name: string;
  lastName: string;
  email: string;
  username: string;
  ageConfirmed: boolean;
  birthDate: string | null;
  guardianAccepted: boolean;
  consents: ConsentChoice[];
  sports: SportChoice[];
  heightCm: number | null;
  weightKg: number | null;
  photoUri: string | null;
  bio: string;
  commentsOpen: boolean;
  likesPublic: boolean;
  city: string;
  completedAt: string | null;
};

export const emptyProfile = (): Profile => ({
  name: '',
  lastName: '',
  email: '',
  username: '',
  ageConfirmed: false,
  birthDate: null,
  guardianAccepted: false,
  consents: [],
  sports: [],
  heightCm: null,
  weightKg: null,
  photoUri: null,
  bio: '',
  commentsOpen: true,
  likesPublic: true,
  city: '',
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

export function parseBirthDate(value: string | null | undefined) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  if (!match) {
    return null;
  }
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (date.getFullYear() !== Number(match[1]) || date.getMonth() !== Number(match[2]) - 1 || date.getDate() !== Number(match[3])) {
    return null;
  }
  return date;
}

export function birthDateKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function yearsOld(birth: Date, now = new Date()) {
  let years = now.getFullYear() - birth.getFullYear();
  const month = now.getMonth() - birth.getMonth();
  if (month < 0 || (month === 0 && now.getDate() < birth.getDate())) {
    years -= 1;
  }
  return years;
}

export function ageBand(birthDate: string | null | undefined, now = new Date()): AgeBand | null {
  const birth = parseBirthDate(birthDate);
  if (!birth || birth.getTime() > now.getTime()) {
    return null;
  }
  const years = yearsOld(birth, now);
  if (years < 13) {
    return 'blocked';
  }
  if (years < 18) {
    return 'teen';
  }
  return 'adult';
}

export function isAdultAccount(profile: Pick<Profile, 'birthDate'>) {
  const band = ageBand(profile.birthDate);
  return band === null || band === 'adult';
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
