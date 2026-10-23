// React i18n layer (docs/I18N.md).
//
//   import { useT, t } from '../src/i18n';
//   const { t, locale, isRTL, script, formatNumber, formatDate } = useT();   // in components
//   t('settings.language.title');                       // typed keys, typed params
//   t('common.itemCount', { count: 3 });                 // plurals pick a form from `count`
//   t('tabs.themes');                                    // the plain t() works outside React too
//
// Locale = Settings override (AsyncStorage 'glaze.locale.v1') ?? first supported device language
// (expo-localization) ?? English. Switching between LTR and RTL needs an app reload; see
// setLocaleOverride() and applyDirection().
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requireOptionalNativeModule } from 'expo';
import * as Localization from 'expo-localization';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DevSettings, I18nManager } from 'react-native';
import {
  formatClock as coreFormatClock,
  formatDate as coreFormatDate,
  formatNumber as coreFormatNumber,
  isRTL as coreIsRTL,
  isSupportedLocale,
  resolveLocale,
  scriptOf,
  translate,
  type DateOptions,
  type Locale,
  type NumberOptions,
  type Params,
  type Script,
} from '../core/i18n';
import type { MessageKey, TArgs, TFunction } from './catalogue';
import { CATALOGUES } from './locales';

export type { Locale, Script } from '../core/i18n';
export type { MessageKey, Messages, LocaleMessages, Namespace, TFunction } from './catalogue';
export { LOCALE_NAMES, SHIPPING_LOCALES, SUPPORTED_LOCALES, PSEUDO_LOCALE } from '../core/i18n';

/** AsyncStorage key for the Settings › Language override ('system' or a Locale). */
export const LOCALE_KEY = 'glaze.locale.v1';

// ---------------------------------------------------------------------------
// Device locale

/** Device languages in preference order, as BCP 47 tags. Never throws. */
export function deviceLocaleTags(): string[] {
  try {
    return Localization.getLocales()
      .map((l) => l.languageTag)
      .filter((x): x is string => typeof x === 'string' && x.length > 0);
  } catch {
    return [];
  }
}

/** The device's 12/24-hour preference when the OS reports it. */
export function deviceUses24h(): boolean | undefined {
  try {
    const v = Localization.getCalendars()[0]?.uses24hourClock;
    return typeof v === 'boolean' ? v : undefined;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Singleton (current locale for code outside React: toasts, haptics copy, native payloads)

let override: Locale | null = null;
let current: Locale = resolveLocale(deviceLocaleTags(), null);
const listeners = new Set<(l: Locale, o: Locale | null) => void>();

function setCurrent(next: Locale): void {
  current = next;
  for (const l of listeners) l(current, override);
}

/** The app's current locale. */
export function getLocale(): Locale {
  return current;
}

/** The Settings override, or null for "System default". */
export function getLocaleOverride(): Locale | null {
  return override;
}

/** Translate with the current locale. Same signature as useT().t, usable anywhere. */
export const t: TFunction = <K extends MessageKey>(key: K, ...args: TArgs<K>): string =>
  translate(CATALOGUES, current, key, args[0] as Params | undefined);

let loading: Promise<Locale | null> | null = null;

/** Read the saved override once (later calls share the promise). */
export function loadLocaleOverride(): Promise<Locale | null> {
  if (!loading) {
    loading = (async () => {
      try {
        const raw = await AsyncStorage.getItem(LOCALE_KEY);
        override = isSupportedLocale(raw) ? raw : null;
      } catch {
        override = null;
      }
      setCurrent(resolveLocale(deviceLocaleTags(), override));
      return override;
    })();
  }
  return loading;
}

// ---------------------------------------------------------------------------
// Direction

/** Outcome of a direction change: nothing to do, reloading now, or the user must restart. */
export type DirectionResult = 'unchanged' | 'reloading' | 'restart-needed';

/** Whether the native layout direction already matches `locale`. */
export function directionMatches(locale: Locale): boolean {
  return I18nManager.isRTL === coreIsRTL(locale);
}

/** Persist the native direction for `locale` (takes effect on the next JS load). */
function setNativeDirection(rtl: boolean): void {
  try {
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(rtl);
  } catch {
    // Older runtimes: nothing we can do but keep the current direction.
  }
}

type UpdatesNative = { reload?: (options?: unknown) => Promise<void> };

/**
 * Reload the JS bundle so a new direction applies. Tries expo-updates' native module (looked up
 * optionally, so builds without expo-updates and Expo Go never crash or fail to bundle), then
 * DevSettings.reload() in development. Returns false when the user has to restart by hand.
 */
export async function reloadApp(): Promise<boolean> {
  try {
    const updates =
      typeof requireOptionalNativeModule === 'function' ? requireOptionalNativeModule<UpdatesNative>('ExpoUpdates') : null;
    if (updates && typeof updates.reload === 'function') {
      await updates.reload();
      return true;
    }
  } catch {
    // Updates disabled (dev client, Expo Go): fall through.
  }
  if (__DEV__) {
    try {
      DevSettings.reload();
      return true;
    } catch {
      // fall through
    }
  }
  return false;
}

/**
 * Make the native direction match `locale`. When it changes, set I18nManager and, if `reload`,
 * reload the app; otherwise the new direction applies on the next launch.
 */
export async function applyDirection(locale: Locale, reload: boolean): Promise<DirectionResult> {
  if (directionMatches(locale)) return 'unchanged';
  setNativeDirection(coreIsRTL(locale));
  if (!reload) return 'restart-needed';
  return (await reloadApp()) ? 'reloading' : 'restart-needed';
}

/**
 * Save the Settings override (null = follow the phone) and switch the app's language at once.
 * Returns `needsRestart` when the layout direction changes; the caller then asks the user and
 * calls applyDirection(locale, true) (or tells them to reopen the app).
 */
export async function setLocaleOverride(next: Locale | null): Promise<{ locale: Locale; needsRestart: boolean }> {
  override = next;
  try {
    await AsyncStorage.setItem(LOCALE_KEY, next ?? 'system');
  } catch {
    // Storage unavailable: keep the choice for this session.
  }
  const locale = resolveLocale(deviceLocaleTags(), next);
  setCurrent(locale);
  return { locale, needsRestart: !directionMatches(locale) };
}

// ---------------------------------------------------------------------------
// React

export type I18nValue = {
  t: TFunction;
  locale: Locale;
  /** The override from Settings, or null when following the phone. */
  override: Locale | null;
  isRTL: boolean;
  script: Script;
  formatNumber: (n: number, options?: NumberOptions) => string;
  formatDate: (date: Date, options?: DateOptions) => string;
  /** Lock Screen clock: Latin digits, LTR isolates, device 12/24h preference. */
  formatClock: (date: Date) => string;
};

function makeValue(locale: Locale, chosen: Locale | null): I18nValue {
  const tt: TFunction = <K extends MessageKey>(key: K, ...args: TArgs<K>): string =>
    translate(CATALOGUES, locale, key, args[0] as Params | undefined);
  const uses24h = deviceUses24h();
  return {
    t: tt,
    locale,
    override: chosen,
    isRTL: coreIsRTL(locale),
    script: scriptOf(locale),
    formatNumber: (n, options) => coreFormatNumber(n, locale, options),
    formatDate: (date, options) => coreFormatDate(date, locale, options),
    formatClock: (date) => coreFormatClock(date, locale, uses24h),
  };
}

const I18nContext = createContext<I18nValue | null>(null);

/**
 * Wrap the app once (app/_layout.tsx). Waits for the saved override (one AsyncStorage read) so
 * the first frame is already in the right language, and lines the native direction up for the
 * next launch if it drifted (e.g. the phone's language changed while the app was closed).
 */
export function I18nProvider({ children }: { children?: ReactNode }) {
  const [state, setState] = useState<{ locale: Locale; override: Locale | null }>({ locale: current, override });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    const onChange = (l: Locale, o: Locale | null) => {
      if (alive) setState((s) => (s.locale === l && s.override === o ? s : { locale: l, override: o }));
    };
    listeners.add(onChange);
    loadLocaleOverride().then(() => {
      if (!alive) return;
      setState({ locale: current, override });
      setReady(true);
      // No reload at launch (avoids loops); the direction is corrected for the next start.
      applyDirection(current, false).catch(() => {});
    });
    return () => {
      alive = false;
      listeners.delete(onChange);
    };
  }, []);

  const value = useMemo(() => makeValue(state.locale, state.override), [state]);
  if (!ready) return null;
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** i18n for a component; re-renders when the language changes. Works without a provider too. */
export function useT(): I18nValue {
  const ctx = useContext(I18nContext);
  const [fallback] = useState(() => makeValue(current, override));
  return ctx ?? fallback;
}

/** Settings helper: choose a language; resolves with whether a restart is needed. */
export function useLocaleOverride(): {
  override: Locale | null;
  setOverride: (next: Locale | null) => Promise<{ locale: Locale; needsRestart: boolean }>;
} {
  const { override: o } = useT();
  const setOverride = useCallback((next: Locale | null) => setLocaleOverride(next), []);
  return { override: o, setOverride };
}
