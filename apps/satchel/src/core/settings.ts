// Settings rules (FLOWS §12): the low-battery essentials threshold stepper. Pure TS, no React Native.
// The stored value is a fraction (0.2 = a fifth of a full battery), kept to MIN_THRESHOLD..MAX_THRESHOLD by
// battery.clampThreshold; the stepper moves in whole steps of THRESHOLD_STEP.
import { clampThreshold, MAX_THRESHOLD, MIN_THRESHOLD } from './battery.ts';
import { isLanguagePref, type LanguagePref } from './languageHint.ts';

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
export type AppPrefs = { haptics: boolean; appearance: AppearancePref; language: LanguagePref; languageHintSeen: boolean };
export const DEFAULT_APP_PREFS: AppPrefs = { haptics: true, appearance: 'system', language: 'system', languageHintSeen: false };

/** Stored prefs from any earlier build (or damaged storage) as a complete, valid AppPrefs. */
export function normaliseAppPrefs(raw: unknown): AppPrefs {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    haptics: typeof o.haptics === 'boolean' ? o.haptics : DEFAULT_APP_PREFS.haptics,
    appearance: isAppearance(o.appearance) ? o.appearance : DEFAULT_APP_PREFS.appearance,
    language: isLanguagePref(o.language) ? o.language : DEFAULT_APP_PREFS.language,
    languageHintSeen: o.languageHintSeen === true,
  };
}
