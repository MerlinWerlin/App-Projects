import { en, type StringKey } from './en';

export type Lang = 'en';
export const LANGS: { code: Lang; name: string }[] = [{ code: 'en', name: 'English' }];

const catalogues: Record<Lang, Partial<Record<StringKey, string>>> = { en };
let current: Lang = 'en';

/** Choose the catalogue: an explicit choice, else the phone's language if we have it, else English. */
export function setLanguage(choice: string, phone: string | null | undefined): Lang {
  const want = choice === 'system' ? (phone ?? 'en').toLowerCase().split('-')[0]! : choice;
  current = (LANGS.find((l) => l.code === want)?.code ?? 'en') as Lang;
  return current;
}

export function currentLanguage(): Lang {
  return current;
}

export function languageName(code: string): string {
  return LANGS.find((l) => l.code === code)?.name ?? 'English';
}

/** Look up a UI string and fill {placeholders}. Falls back to English, then the key. Never crashes. */
export function t(key: StringKey, vars?: Record<string, string | number>): string {
  let s: string = catalogues[current][key] ?? en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

/** Keys built from data (scene ids, themes, palettes). Missing keys fall back to the raw id. */
export function tx(key: string, vars?: Record<string, string | number>): string {
  return key in en ? t(key as StringKey, vars) : key.split('.').slice(-1)[0]!;
}

export type { StringKey };
