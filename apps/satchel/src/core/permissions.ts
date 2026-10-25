// Permission states, in one place for every feature (T19). Pure: maps whatever the platform said about a
// permission to the one UI state a screen shows, and which actions that state offers. The screens render
// PermissionNotice (src/ui/PermissionNotice.tsx) from this, so location, photos, Face ID, contacts and files all
// explain a refusal in the same plain words with Open Settings and a fallback path.

export type PermissionKind = 'location' | 'photos' | 'faceid' | 'contacts' | 'files';
export const PERMISSION_KINDS: readonly PermissionKind[] = ['location', 'photos', 'faceid', 'contacts', 'files'];

/**
 * - granted: go ahead.
 * - limited: allowed, but only partly (iOS "Selected Photos", approximate location). Go ahead; Settings can widen it.
 * - ask: not decided yet, or refused but the system will ask again. Offer Try again.
 * - blocked: refused and the system won't ask again. Only the Settings app can change it.
 * - unavailable: this phone can't do it at all (no hardware, nothing enrolled, module missing in Expo Go).
 */
export type PermissionState = 'granted' | 'limited' | 'ask' | 'blocked' | 'unavailable';

/** The shape every Expo permission response shares (status is a string enum there, so accept any string). */
export type PermissionResponseLike = {
  status: 'granted' | 'denied' | 'undetermined' | string;
  granted?: boolean;
  canAskAgain?: boolean;
  accessPrivileges?: 'all' | 'limited' | 'none';
};

/** Maps a platform permission response to the UI state. null / malformed (the module is missing) is 'unavailable'. */
export function permissionState(r: PermissionResponseLike | null | undefined): PermissionState {
  if (!r || typeof r !== 'object' || typeof r.status !== 'string') return 'unavailable';
  const status = r.status === 'granted' || r.granted === true ? 'granted' : r.status;
  if (status === 'granted') {
    if (r.accessPrivileges === 'limited') return 'limited';
    // Granted with no access at all is a refusal in practice.
    if (r.accessPrivileges === 'none') return r.canAskAgain === true ? 'ask' : 'blocked';
    return 'granted';
  }
  if (status === 'undetermined') return r.canAskAgain === false ? 'blocked' : 'ask';
  if (status === 'denied') {
    // iOS never asks twice, and reports canAskAgain false; unknown is treated the same so Settings is offered.
    return r.canAskAgain === true ? 'ask' : 'blocked';
  }
  return 'unavailable';
}

/** True when the feature can go ahead now. */
export const canProceed = (s: PermissionState): boolean => s === 'granted' || s === 'limited';

export type PermissionAction = 'settings' | 'retry' | 'fallback';

/**
 * The actions a notice offers, most useful first (the first is drawn as the primary button).
 * `hasRetry` / `hasFallback`: whether the screen can actually retry or has another path.
 * Settings is offered whenever the Settings app can fix it: blocked, limited (widen access), and an unavailable
 * Face ID or location (enrol Face ID / turn Location Services on). Never for a picker that simply isn't there.
 */
export function permissionActions(kind: PermissionKind, state: PermissionState, opts: { hasRetry?: boolean; hasFallback?: boolean } = {}): PermissionAction[] {
  const out: PermissionAction[] = [];
  const fallback = !!opts.hasFallback;
  const retry = !!opts.hasRetry;
  switch (state) {
    case 'granted':
      return [];
    case 'limited':
      out.push('settings');
      break;
    case 'ask':
      // The system will ask again on retry; with nothing to retry, Settings is still a way in.
      out.push(retry ? 'retry' : 'settings');
      break;
    case 'blocked':
      out.push('settings');
      if (retry) out.push('retry');
      break;
    case 'unavailable':
      if (kind === 'faceid' || kind === 'location') out.push('settings');
      if (retry) out.push('retry');
      break;
  }
  if (fallback) out.push('fallback');
  return out;
}

/** Catalogue key for the plain reason shown in each state (src/i18n/en/permissions.ts). */
export const reasonKey = (kind: PermissionKind, state: Exclude<PermissionState, 'granted'>): string => `permissions.${kind}.${state}`;
/** Catalogue key for the short heading. */
export const titleKey = (kind: PermissionKind, state: Exclude<PermissionState, 'granted'>): string =>
  `permissions.${kind}.title.${state === 'unavailable' ? 'unavailable' : state === 'limited' ? 'limited' : 'off'}`;
/** Catalogue key for the default fallback label. */
export const fallbackKey = (kind: PermissionKind): string => `permissions.${kind}.fallback`;

/** Face ID: the vault's auth failure reasons, as a permission state. */
export type AuthFailureLike = 'cancelled' | 'not-enrolled' | 'no-hardware' | 'unavailable' | 'error';
export function authState(reason: AuthFailureLike): PermissionState {
  switch (reason) {
    case 'not-enrolled':
    case 'no-hardware':
    case 'unavailable':
      return 'unavailable';
    default:
      return 'ask';
  }
}
