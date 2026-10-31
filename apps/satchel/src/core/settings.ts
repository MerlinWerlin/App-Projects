// Settings rules (FLOWS §12): the low-battery essentials threshold stepper. Pure TS, no React Native.
// The stored value is a fraction (0.2 = a fifth of a full battery), kept to MIN_THRESHOLD..MAX_THRESHOLD by
// battery.clampThreshold; the stepper moves in whole steps of THRESHOLD_STEP.
import { clampThreshold, MAX_THRESHOLD, MIN_THRESHOLD } from './battery.ts';
import { isLanguagePref, type LanguagePref } from './languageHint.ts';
import { findEssentials, HOME_COUNTRY_KEY, normaliseHome, type EssentialsTable } from './essentials.ts';
import { DEFAULT_BED, DEFAULT_WAKE, hm } from './jetlag.ts';

export const THRESHOLD_STEP = 0.05;

/** Rounds to whole hundredths so repeated steps never drift (0.1 + 0.05 + 0.05 stays 0.2). */
const tidy = (x: number) => Math.round(x * 100) / 100;

/** The next threshold one step up (+1) or down (-1), snapped to the step grid and kept in range. */
export function stepThreshold(current: unknown, dir: 1 | -1): number {
  const base = clampThreshold(current);
  const snapped = Math.round(base / THRESHOLD_STEP) * THRESHOLD_STEP;
  return tidy(clampThreshold(tidy(snapped + dir * THRESHOLD_STEP)));
}

/** Whether the stepper can still move in each direction (buttons are disabled at the ends). */
export function thresholdLimits(current: unknown): { canLower: boolean; canRaise: boolean } {
  const v = tidy(clampThreshold(current));
  return { canLower: v > MIN_THRESHOLD, canRaise: v < MAX_THRESHOLD };
}

/**
 * A fraction as a locale percent ("20%", "20 %"). The number is supplied at runtime so the string catalogue never
 * contains a hard-coded battery figure. Falls back to a plain "20%" if Intl can't format.
 */
export function formatPercent(fraction: number, lang = 'en'): string {
  const v = tidy(clampThreshold(fraction));
  try {
    return new Intl.NumberFormat(lang, { style: 'percent', maximumFractionDigits: 0 }).format(v);
  } catch {
    return `${Math.round(v * 100)}%`;
  }
}

// ---- Appearance (FLOWS §12: System / Light / Dark, applied at once and saved on this phone) ----

export const APPEARANCES = ['system', 'light', 'dark'] as const;
export type AppearancePref = (typeof APPEARANCES)[number];

export const isAppearance = (v: unknown): v is AppearancePref => typeof v === 'string' && (APPEARANCES as readonly string[]).includes(v);

/** The colour scheme to draw: the saved choice, or the phone's own when the choice is System (or unreadable). */
export function resolveScheme(pref: unknown, system: string | null | undefined): 'light' | 'dark' {
  if (pref === 'light' || pref === 'dark') return pref;
  return system === 'dark' ? 'dark' : 'light';
}

/**
 * What to hand the system (react-native Appearance.setColorScheme) so alerts, the keyboard and other system UI
 * match the Appearance setting: 'unspecified' means follow the phone again.
 */
export function nativeScheme(pref: unknown): 'light' | 'dark' | 'unspecified' {
  return pref === 'light' || pref === 'dark' ? pref : 'unspecified';
}

// language: 'system' follows the phone (T35). languageHintSeen: the first-launch language line has had its one session.
// sleepBed / sleepWake (T68): usual sleep, 'HH:mm' on whatever clock the traveller is on; used by the jet lag plan and
// the good-time-to-call finder (awake hours run from wake to bed).
export type AppPrefs = { haptics: boolean; appearance: AppearancePref; language: LanguagePref; languageHintSeen: boolean; sleepBed: string; sleepWake: string };
export const DEFAULT_APP_PREFS: AppPrefs = {
  haptics: true,
  appearance: 'system',
  language: 'system',
  languageHintSeen: false,
  sleepBed: DEFAULT_BED,
  sleepWake: DEFAULT_WAKE,
};

// ---- Usual sleep (T68) ----

/** The bed / wake time steppers move by this many minutes. */
export const SLEEP_STEP_MIN = 30;
/** At least this much sleep and this much awake time, so the plan and the call finder always have something to work with. */
export const MIN_SLEEP_MIN = 240;
export const MIN_AWAKE_MIN = 360;

/** A stored sleep time: 'HH:mm' from 00:00 to 23:59 (24:00 is not a bed or wake time), else null. */
export function sleepClock(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const m = hm(v);
  return m === null || m >= 1440 ? null : v;
}

/** Minutes asleep from bed to wake (wrapping past midnight). */
export function sleepLength(bed: string, wake: string): number {
  const b = hm(bed) ?? 0;
  const w = hm(wake) ?? 0;
  return (((w - b) % 1440) + 1440) % 1440;
}

/** True when bed and wake leave at least MIN_SLEEP_MIN asleep and MIN_AWAKE_MIN awake. */
export const sleepOk = (bed: string, wake: string): boolean => {
  const n = sleepLength(bed, wake);
  return n >= MIN_SLEEP_MIN && 1440 - n >= MIN_AWAKE_MIN;
};

/** Stored sleep times as a valid pair, else the defaults (23:00 to 07:00). */
export function normaliseSleep(bed: unknown, wake: unknown): { sleepBed: string; sleepWake: string } {
  const b = sleepClock(bed);
  const w = sleepClock(wake);
  if (b && w && sleepOk(b, w)) return { sleepBed: b, sleepWake: w };
  return { sleepBed: DEFAULT_BED, sleepWake: DEFAULT_WAKE };
}

const clockOf = (min: number) => {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

/**
 * One step of the bed or wake time (+1 later, −1 earlier), snapped to the step grid and wrapping round midnight.
 * Returns the time unchanged when the step would leave less than MIN_SLEEP_MIN asleep or MIN_AWAKE_MIN awake.
 */
export function stepSleep(prefs: { sleepBed: string; sleepWake: string }, which: 'bed' | 'wake', dir: 1 | -1): { sleepBed: string; sleepWake: string } {
  const cur = normaliseSleep(prefs.sleepBed, prefs.sleepWake);
  const v = hm(which === 'bed' ? cur.sleepBed : cur.sleepWake) as number;
  const snapped = Math.round(v / SLEEP_STEP_MIN) * SLEEP_STEP_MIN;
  const nextMin = snapped !== v && Math.sign(snapped - v) === dir ? snapped : snapped + dir * SLEEP_STEP_MIN;
  const next = which === 'bed' ? { ...cur, sleepBed: clockOf(nextMin) } : { ...cur, sleepWake: clockOf(nextMin) };
  return sleepOk(next.sleepBed, next.sleepWake) ? next : cur;
}

/** Whether each sleep stepper can still move (the buttons are disabled at the limits). */
export function sleepLimits(prefs: { sleepBed: string; sleepWake: string }, which: 'bed' | 'wake'): { canLower: boolean; canRaise: boolean } {
  const cur = normaliseSleep(prefs.sleepBed, prefs.sleepWake);
  const key = which === 'bed' ? 'sleepBed' : 'sleepWake';
  return { canLower: stepSleep(cur, which, -1)[key] !== cur[key], canRaise: stepSleep(cur, which, 1)[key] !== cur[key] };
}

/** Stored prefs from any earlier build (or damaged storage) as a complete, valid AppPrefs. */
export function normaliseAppPrefs(raw: unknown): AppPrefs {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    haptics: typeof o.haptics === 'boolean' ? o.haptics : DEFAULT_APP_PREFS.haptics,
    appearance: isAppearance(o.appearance) ? o.appearance : DEFAULT_APP_PREFS.appearance,
    language: isLanguagePref(o.language) ? o.language : DEFAULT_APP_PREFS.language,
    languageHintSeen: o.languageHintSeen === true,
    ...normaliseSleep(o.sleepBed, o.sleepWake),
  };
}

// ---- Home country (T58): one stored value, HOME_COUNTRY_KEY, shared by Settings and the country essentials card ----

/** The same key the essentials card uses, re-exported so Settings never invents a second copy of the choice. */
export { HOME_COUNTRY_KEY };

export type HomeCountry = { iso2: string; country: string };

/** The saved home country as the table names it, or null when unset, unknown or unreadable. */
export function homeCountry(table: EssentialsTable, stored: unknown): HomeCountry | null {
  const row = findEssentials(table, normaliseHome(table, stored));
  return row ? { iso2: row.iso2, country: row.country } : null;
}

/** What to store for a pick: the table's ISO code (any case in, capitals out), or null to forget the choice. */
export function homeCountryToStore(table: EssentialsTable, pick: unknown): string | null {
  return normaliseHome(table, pick);
}
