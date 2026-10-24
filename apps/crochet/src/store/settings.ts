// Settings persisted on-device. In-memory cache so haptic() etc. read synchronously.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import { useSyncExternalStore } from 'react';
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
  loaded = true;
  emit();
  return cache;
}

export function getSettings(): AppSettings {
  return cache;
}

export function setSettings(patch: Partial<AppSettings>): void {
  cache = { ...cache, ...patch };
  emit();
  AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(cache)).catch(() => {});
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
