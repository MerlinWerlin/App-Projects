// React Native side of i18n: reads the phone's languages (expo-localization, with an Intl fallback so a missing
// native module never crashes), keeps the Settings override, and exposes useT() which re-renders on change.
import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatDate, formatDuration, formatNumber, formatPercent, isLocaleCode, type Params } from './core.ts';
import {
  configure,
  getDeviceLocale,
  getLocale,
  getLocaleInfo,
  getSetting,
  snapshot,
  subscribe,
  t,
  tDynamic,
  type LanguageSetting,
} from './store.ts';
import type { MessageKey } from './en/index.ts';

export { t, tDynamic, getLocale, getLocaleInfo, type LanguageSetting };

export const LANGUAGE_KEY = 'linework.language.v1';

function deviceTags(): string[] {
  try {
    // Required lazily so Node tests and an Expo Go without the module both keep working.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const loc = require('expo-localization') as { getLocales?: () => { languageTag: string }[] };
    const tags = loc.getLocales?.().map((l) => l.languageTag).filter(Boolean) ?? [];
    if (tags.length) return tags;
  } catch {
    // fall through
  }
  try {
    return [Intl.DateTimeFormat().resolvedOptions().locale];
  } catch {
    return ['en'];
  }
}

function parseSetting(v: string | null): LanguageSetting {
  if (v === 'pseudo' || v === 'system') return v;
  return isLocaleCode(v) ? v : 'system';
}

/** Loads the saved language and the phone's languages. Call once at startup (root layout). */
export async function initI18n(): Promise<void> {
  let saved: string | null = null;
  try {
    saved = await AsyncStorage.getItem(LANGUAGE_KEY);
  } catch {
    // default to the phone language
  }
  configure(parseSetting(saved), deviceTags());
}

export async function setLanguage(setting: LanguageSetting): Promise<void> {
  configure(setting, deviceTags());
  try {
    await AsyncStorage.setItem(LANGUAGE_KEY, setting);
  } catch {
    // keeps working for this session
  }
}

/** Re-reads the phone's languages when the app comes back to the foreground (user changed it in iOS Settings). */
export function useDeviceLanguageWatcher(): void {
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') configure(getSetting(), deviceTags());
    });
    return () => sub.remove();
  }, []);
}

export type I18n = {
  t: (key: MessageKey, params?: Params) => string;
  tDynamic: (key: string, fallback: string, params?: Params) => string;
  locale: ReturnType<typeof getLocale>;
  info: ReturnType<typeof getLocaleInfo>;
  setting: LanguageSetting;
  deviceLocale: ReturnType<typeof getDeviceLocale>;
  num: (n: number, opts?: Intl.NumberFormatOptions) => string;
  percent: (fraction: number) => string;
  date: (d: Date | number, opts?: Intl.DateTimeFormatOptions) => string;
  duration: (seconds: number) => string;
};

/** Hook for screens: returns t() plus locale-aware formatters; re-renders when the language changes. */
export function useT(): I18n {
  useSyncExternalStore(subscribe, snapshot, snapshot);
  const locale = getLocale();
  return {
    t,
    tDynamic,
    locale,
    info: getLocaleInfo(),
    setting: getSetting(),
    deviceLocale: getDeviceLocale(),
    num: (n, opts) => formatNumber(n, locale, opts),
    percent: (f) => formatPercent(f, locale),
    date: (d, opts) => formatDate(d, locale, opts),
    duration: (s) => formatDuration(s, locale),
  };
}
