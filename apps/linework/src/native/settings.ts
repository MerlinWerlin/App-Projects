// User settings (PLAN §3 /settings), stored locally in AsyncStorage. T08 builds the Settings screen on this.
import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_SETTINGS, sanitizeSettings as sanitize, type Settings } from '../core/settingsParse.ts';

export { DEFAULT_SETTINGS, sanitizeSettings, type GridDefault, type Settings } from '../core/settingsParse.ts';

export const SETTINGS_KEY = 'linework.settings.v1';

export async function loadSettings(): Promise<Settings> {
  try {
    const text = await AsyncStorage.getItem(SETTINGS_KEY);
    return text ? sanitize(JSON.parse(text)) : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** Saves the full settings object (merged over the defaults) and returns what was stored. */
export async function saveSettings(next: Partial<Settings>): Promise<Settings> {
  const merged = sanitize({ ...(await loadSettings()), ...next });
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
  } catch {
    // ignore: settings fall back to defaults next launch
  }
  return merged;
}
