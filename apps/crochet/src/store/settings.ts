// Settings persisted on-device. In-memory cache so haptic() etc. read synchronously.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import { useSyncExternalStore } from 'react';
import { applyLanguage } from '../i18n';
import { SETTINGS_KEY, defaultSettings, parseSettings, termsForRegion, type AppSettings } from '../core/settings';

export type { AppSettings };

let cache: AppSettings = (() => {
  const d = defaultSettings();
  try {
    d.terms = termsForRegion(Localization.getLocales()[0]?.regionCode);
    d.units = Localization.getLocales()[0]?.measurementSystem === 'us' ? 'in' : 'cm';
  } catch {
    // keep defaults
  }
  return d;
})();
let loaded = false;
/** True only during the session in which the first-launch language line is shown. */
let languageHintThisSession = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export async function loadSettings(): Promise<AppSettings> {
  if (loaded) return cache;
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (raw) cache = parseSettings(raw);
  } catch {
    // storage unavailable: defaults for this session
  }
  applyLanguage(cache.language);
  if (!cache.languageHintSeen) {
    // Show the language line for this one session only; it is never shown on a later launch.
    languageHintThisSession = true;
    cache = { ...cache, languageHintSeen: true };
    AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(cache)).catch(() => {});
  }
  loaded = true;
  emit();
  return cache;
}

export function getSettings(): AppSettings {
  return cache;
}

export function setSettings(patch: Partial<AppSettings>): void {
  cache = { ...cache, ...patch };
  if (patch.language !== undefined) applyLanguage(cache.language);
  emit();
  AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(cache)).catch(() => {});
}

export function showLanguageHint(): boolean {
  return languageHintThisSession;
}

export function dismissLanguageHint(): void {
  if (!languageHintThisSession) return;
  languageHintThisSession = false;
  emit();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useSettings(): AppSettings {
  return useSyncExternalStore(subscribe, getSettings, getSettings);
}

/** Whether the first-launch language line should be on screen right now. */
export function useLanguageHint(): boolean {
  return useSyncExternalStore(subscribe, showLanguageHint, showLanguageHint);
}
