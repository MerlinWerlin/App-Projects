// App settings, saved on the phone. Screens subscribe with useSettings().
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { useSyncExternalStore } from 'react';
import { setLanguage } from '../i18n';

const KEY = 'hollowhue.settings.v1';

export interface Settings {
  haptics: boolean;
  /** Freehand strokes keep to the shape they start in. */
  insideLines: boolean;
  /** 'system' or a language code. */
  language: string;
  /** The first-launch language line was tapped or a session has passed. */
  langLineDone: boolean;
  launches: number;
}

let settings: Settings = { haptics: true, insideLines: true, language: 'system', langLineDone: false, launches: 0 };
const listeners = new Set<() => void>();

export function phoneLanguage(): string | null {
  try {
    return getLocales()[0]?.languageCode ?? null;
  } catch {
    return null;
  }
}

function emit() {
  for (const l of listeners) l();
}

function save() {
  AsyncStorage.setItem(KEY, JSON.stringify(settings)).catch(() => {});
}

export async function loadSettings(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) settings = { ...settings, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    // keep defaults
  }
  // The language line shows during the first session only.
  settings = { ...settings, launches: settings.launches + 1, langLineDone: settings.langLineDone || settings.launches >= 1 };
  setLanguage(settings.language, phoneLanguage());
  save();
  emit();
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => settings,
  );
}

export function updateSettings(patch: Partial<Settings>) {
  settings = { ...settings, ...patch };
  if (patch.language) setLanguage(settings.language, phoneLanguage());
  save();
  emit();
}
