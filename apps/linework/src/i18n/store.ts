// Current-language store (pure TS, no React Native): the RN provider feeds it the phone's languages and the
// Settings override; anything (hooks, toasts, non-React helpers) can call t() and gets the current locale.
import {
  DEFAULT_LOCALE,
  localeInfo,
  resolveLocale,
  translate,
  type LocaleCode,
  type LocaleInfo,
  type Params,
} from './core.ts';
import { CATALOGS, EN, pseudoLocaleCatalog } from './catalogs.ts';
import type { MessageKey } from './en/index.ts';

/** 'system' follows the phone; 'pseudo' is the developer layout-test locale. */
export type LanguageSetting = 'system' | 'pseudo' | LocaleCode;

type State = { setting: LanguageSetting; deviceTags: readonly string[]; locale: LocaleCode; pseudo: boolean };

let state: State = { setting: 'system', deviceTags: [], locale: DEFAULT_LOCALE, pseudo: false };
const listeners = new Set<() => void>();

function compute(setting: LanguageSetting, deviceTags: readonly string[]): State {
  if (setting === 'pseudo') return { setting, deviceTags, locale: 'en', pseudo: true };
  const locale = setting === 'system' ? resolveLocale(deviceTags) : setting;
  return { setting, deviceTags, locale, pseudo: false };
}

export function configure(setting: LanguageSetting, deviceTags: readonly string[]): void {
  const next = compute(setting, deviceTags);
  const changed = next.locale !== state.locale || next.pseudo !== state.pseudo || next.setting !== state.setting;
  state = next;
  if (changed) for (const l of [...listeners]) l();
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function getLocale(): LocaleCode {
  return state.locale;
}
export function getLocaleInfo(): LocaleInfo {
  return localeInfo(state.locale);
}
export function getSetting(): LanguageSetting {
  return state.setting;
}
export function getDeviceLocale(): LocaleCode {
  return resolveLocale(state.deviceTags);
}
/** Bumps whenever the language changes (for useSyncExternalStore snapshots). */
export function snapshot(): string {
  return `${state.setting}|${state.locale}|${state.pseudo ? 1 : 0}`;
}

/** Translates `key` for the current language. Typed keys: a typo is a compile error. */
export function t(key: MessageKey, params?: Params): string {
  const catalog = state.pseudo ? pseudoLocaleCatalog() : CATALOGS[state.locale];
  return translate(state.locale, catalog, EN, key, params);
}

/** Like t() but for keys built at runtime (e.g. `templates.category.${id}`); falls back to `fallback`. */
export function tDynamic(key: string, fallback: string, params?: Params): string {
  const catalog = state.pseudo ? pseudoLocaleCatalog() : CATALOGS[state.locale];
  const out = translate(state.locale, catalog, EN, key, params);
  return out === key ? fallback : out;
}
