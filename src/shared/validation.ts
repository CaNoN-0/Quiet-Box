export const RESERVED_USERNAMES = new Set([
  'admin',
  'api',
  'app',
  'auth',
  'dashboard',
  'edit',
  'help',
  'inbox',
  'legal',
  'login',
  'logout',
  'messages',
  'new',
  'page',
  'privacy',
  'profile',
  'public',
  'quietbox',
  'register',
  'report',
  'reset',
  'reset-password',
  'root',
  'security',
  'settings',
  'signin',
  'signup',
  'status',
  'support',
  'system',
  'terms',
  'u',
  'uploads',
  'user',
  'users',
]);

export const USERNAME_REGEX = /^[a-z0-9_-]{3,30}$/;
export const VALID_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

export const LIMITS = {
  DISPLAY_NAME_MAX: 80,
  PAGE_NAME_MAX: 80,
  USERNAME_MIN: 3,
  USERNAME_MAX: 30,
  DESCRIPTION_MAX: 280,
  MESSAGE_TEXT_MAX: 2000,
  ABUSE_REASON_MAX: 60,
  ABUSE_DETAILS_MAX: 1000,
  MAX_IMAGE_DIMENSIONS: 2048,
  AVATAR_MAX_DIMENSIONS: 512,
} as const;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateUsername(raw: string): { valid: boolean; normalized: string; error?: string } {
  const normalized = normalizeUsername(raw);
  if (normalized.length < LIMITS.USERNAME_MIN || normalized.length > LIMITS.USERNAME_MAX) {
    return {
      valid: false,
      normalized,
      error: `Username must be between ${LIMITS.USERNAME_MIN} and ${LIMITS.USERNAME_MAX} characters.`,
    };
  }
  if (!USERNAME_REGEX.test(normalized)) {
    return {
      valid: false,
      normalized,
      error: 'Username can only contain lowercase letters, numbers, hyphens, and underscores.',
    };
  }
  if (RESERVED_USERNAMES.has(normalized)) {
    return {
      valid: false,
      normalized,
      error: 'This username is reserved. Please pick another one.',
    };
  }
  return { valid: true, normalized };
}

export function sanitizeText(raw: unknown, maxLength: number): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/\u0000/g, '')
    .trim()
    .slice(0, maxLength);
}
