// App preferences: parsing and defaults (pure TS).
import type { Terms } from './terms.ts';

export interface AppSettings {
  terms: Terms;
  appearance: 'system' | 'light' | 'dark';
  haptics: boolean;
  reduceMotion: boolean;
  /** Keep the screen on while a project's counter is open. */
  keepAwake: boolean;
  /** Read the new count out loud. */
  speakCount: boolean;
  /** Counter "+" button on the left (left-handed hold). */
  leftHanded: boolean;
  units: 'cm' | 'in';
  /** Shown the welcome cards. */
  onboarded: boolean;
}

export const SETTINGS_KEY = 'crochet.settings.v1';

export function defaultSettings(): AppSettings {
  return {
    terms: 'US',
    appearance: 'system',
    haptics: true,
    reduceMotion: false,
    keepAwake: true,
    speakCount: false,
    leftHanded: false,
    units: 'cm',
    onboarded: false,
  };
}

export function parseSettings(raw: string | null | undefined): AppSettings {
  const d = defaultSettings();
  if (!raw) return d;
  try {
    const x = JSON.parse(raw) as Partial<Record<keyof AppSettings, unknown>>;
    return {
      terms: x.terms === 'UK' ? 'UK' : 'US',
      appearance: x.appearance === 'light' || x.appearance === 'dark' ? x.appearance : 'system',
      haptics: typeof x.haptics === 'boolean' ? x.haptics : d.haptics,
      reduceMotion: typeof x.reduceMotion === 'boolean' ? x.reduceMotion : d.reduceMotion,
      keepAwake: typeof x.keepAwake === 'boolean' ? x.keepAwake : d.keepAwake,
      speakCount: typeof x.speakCount === 'boolean' ? x.speakCount : d.speakCount,
      leftHanded: typeof x.leftHanded === 'boolean' ? x.leftHanded : d.leftHanded,
      units: x.units === 'in' ? 'in' : 'cm',
      onboarded: x.onboarded === true,
    };
  } catch {
    return d;
  }
}

/** Default terms from the device region: UK/AU/NZ/IE/ZA crocheters mostly use UK terms. */
export function termsForRegion(region: string | null | undefined): Terms {
  return region && ['GB', 'AU', 'NZ', 'IE', 'ZA'].includes(region.toUpperCase()) ? 'UK' : 'US';
}
