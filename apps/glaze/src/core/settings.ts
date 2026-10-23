// App preferences (Settings tab): parsing, defaults and sanitizing. Pure TS, unit-tested.

export type ReduceMotion = 'system' | 'on' | 'off';

export type AppSettings = {
  haptics: boolean;
  reduceMotion: ReduceMotion;
};

export const SETTINGS_KEY = 'glaze.settings.v1';

export const REDUCE_MOTION_VALUES: readonly ReduceMotion[] = Object.freeze(['system', 'on', 'off']);

export const DEFAULT_SETTINGS: AppSettings = Object.freeze({
  haptics: true,
  reduceMotion: 'system',
}) as AppSettings;

export function defaultSettings(): AppSettings {
  return { ...DEFAULT_SETTINGS };
}

/** Any malformed field falls back to its default; unknown fields are dropped. */
export function sanitizeSettings(raw: unknown): AppSettings {
  const out = defaultSettings();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  const r = raw as Record<string, unknown>;
  if (typeof r.haptics === 'boolean') out.haptics = r.haptics;
  if (typeof r.reduceMotion === 'string' && (REDUCE_MOTION_VALUES as readonly string[]).includes(r.reduceMotion)) {
    out.reduceMotion = r.reduceMotion as ReduceMotion;
  }
  return out;
}

export function parseSettings(json: string | null | undefined): AppSettings {
  if (!json) return defaultSettings();
  try {
    return sanitizeSettings(JSON.parse(json));
  } catch {
    return defaultSettings();
  }
}

export function serializeSettings(s: AppSettings): string {
  const clean = sanitizeSettings(s);
  return JSON.stringify({ haptics: clean.haptics, reduceMotion: clean.reduceMotion });
}

export function patchSettings(s: AppSettings, patch: Partial<AppSettings>): AppSettings {
  return sanitizeSettings({ ...s, ...patch });
}

/** Whether animations should be reduced, given the setting and the OS preference. */
export function shouldReduceMotion(s: AppSettings, systemReduceMotion: boolean): boolean {
  if (s.reduceMotion === 'on') return true;
  if (s.reduceMotion === 'off') return false;
  return systemReduceMotion;
}
