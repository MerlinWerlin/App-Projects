// Tiny translation core: t(key, vars) with {placeholder} filling, English fallback, locale matching.
import { en, type Key } from './en.ts';

export type Catalog = Partial<Record<Key, string>>;
export const SUPPORTED = ['en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'ja', 'ko', 'zh', 'hi', 'id', 'tr', 'pl'] as const;
export type Lang = (typeof SUPPORTED)[number];
export const LANG_NAMES: Record<Lang, string> = {
  en: 'English', es: 'Español', fr: 'Français', de: 'Deutsch', it: 'Italiano', pt: 'Português', nl: 'Nederlands',
  ja: '日本語', ko: '한국어', zh: '中文', hi: 'हिन्दी', id: 'Bahasa Indonesia', tr: 'Türkçe', pl: 'Polski',
};

/** Picks our language for the phone's preferred languages (BCP-47 tags), falling back to English. */
export function matchLang(tags: string[]): Lang {
  for (const t of tags) {
    const base = t.toLowerCase().split(/[-_]/)[0] as Lang;
    if ((SUPPORTED as readonly string[]).includes(base)) return base;
  }
  return 'en';
}

export function fill(s: string, vars?: Record<string, string | number>): string {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

export function makeT(catalog: Catalog | null) {
  return (key: Key, vars?: Record<string, string | number>) => fill(catalog?.[key] ?? en[key] ?? key, vars);
}

/** Placeholder names in a string, sorted (tests compare translations against English). */
export const placeholders = (s: string) => (s.match(/\{(\w+)\}/g) ?? []).sort();
