// Tiny translation core: t(key, vars) with {placeholder} filling, English fallback, locale matching.
import { en, type Key } from './en.ts';

export type Catalog = Partial<Record<Key, string>>;
export const SUPPORTED = ['en', 'es', 'fr', 'de', 'ja'] as const;
export type Lang = (typeof SUPPORTED)[number];
export const LANG_NAMES: Record<Lang, string> = { en: 'English', es: 'Español', fr: 'Français', de: 'Deutsch', ja: '日本語' };

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
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

export type T = (key: Key, vars?: Record<string, string | number>) => string;

export function makeT(catalog: Catalog | null): T {
  return (key, vars) => fill(catalog?.[key] ?? en[key] ?? key, vars);
}

/** Placeholder names in a string, sorted (tests compare translations against English). */
export const placeholders = (s: string) => (s.match(/\{(\w+)\}/g) ?? []).sort();
