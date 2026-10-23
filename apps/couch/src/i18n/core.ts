/**
 * Small typed i18n layer (owner-1016 R3). Pure TS, no React Native imports, tested in Node.
 *
 *   t('core.common.tvCount', { count: 2 })  -> "2 TVs"
 *   t('app.settings.title')                 -> "Settings"
 *
 * - Keys are typed from the English catalogue (src/i18n/catalog/en); a typo is a type error.
 * - {name} placeholders are replaced from params; unknown placeholders are left visible.
 * - Plural messages pick a CLDR category with Intl.PluralRules for the active locale ({count}).
 * - Missing translations fall back to English, never to the raw key.
 * - 'pseudo' locale: accented English, ~40% longer, in [brackets], to catch truncation and
 *   hard-coded strings in tests.
 */
import { CATALOGUES, en, type MessageKey } from './catalog';
import type { Msg, PluralForms } from './catalog/types';
import { localeInfo, type AnyLocale } from './locales';

export type { MessageKey };
export type Params = Record<string, string | number>;

let current: AnyLocale = 'en';
const subs = new Set<() => void>();

export function getLocale(): AnyLocale {
  return current;
}

export function setLocale(code: AnyLocale): void {
  if (code === current) return;
  current = code;
  for (const s of subs) s();
}

/** Subscribe to locale changes (React binding: src/i18n/react.ts). */
export function subscribeLocale(cb: () => void): () => void {
  subs.add(cb);
  return () => {
    subs.delete(cb);
  };
}

const pluralCache = new Map<string, { select(n: number): string } | null>();
function pluralRules(bcp47: string): { select(n: number): string } | null {
  if (pluralCache.has(bcp47)) return pluralCache.get(bcp47) ?? null;
  let pr: { select(n: number): string } | null = null;
  try {
    pr = typeof Intl !== 'undefined' && typeof Intl.PluralRules === 'function' ? new Intl.PluralRules(bcp47) : null;
  } catch {
    pr = null;
  }
  pluralCache.set(bcp47, pr);
  return pr;
}

/** CLDR plural category for n in a locale; falls back to English one/other without Intl. */
export function pluralCategory(n: number, locale: AnyLocale = current): keyof PluralForms {
  const pr = pluralRules(localeInfo(locale).bcp47);
  const cat = pr ? pr.select(n) : n === 1 ? 'one' : 'other';
  return cat as keyof PluralForms;
}

function pickPlural(forms: PluralForms, count: number, locale: AnyLocale): string {
  if (count === 0 && forms.zero !== undefined) return forms.zero;
  const cat = pluralCategory(count, locale);
  return forms[cat] ?? forms.other;
}

export function interpolate(text: string, params?: Params, locale: AnyLocale = current): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const v = params[name];
    if (v === undefined) return whole;
    return typeof v === 'number' ? formatNumber(v, locale) : v;
  });
}

const ACCENTS: Record<string, string> = {
  a: 'á', b: 'ƀ', c: 'ç', d: 'ð', e: 'é', f: 'ƒ', g: 'ĝ', h: 'ĥ', i: 'í', j: 'ĵ', k: 'ķ', l: 'ļ', m: 'ɱ',
  n: 'ñ', o: 'ö', p: 'þ', q: 'ǫ', r: 'ŕ', s: 'š', t: 'ţ', u: 'ü', v: 'ṽ', w: 'ŵ', x: 'ẋ', y: 'ý', z: 'ž',
  A: 'Å', B: 'Ɓ', C: 'Ç', D: 'Ð', E: 'É', F: 'Ƒ', G: 'Ĝ', H: 'Ĥ', I: 'Í', J: 'Ĵ', K: 'Ķ', L: 'Ļ', M: 'Ṁ',
  N: 'Ñ', O: 'Ö', P: 'Þ', Q: 'Ǫ', R: 'Ŕ', S: 'Š', T: 'Ţ', U: 'Ü', V: 'Ṽ', W: 'Ŵ', X: 'Ẋ', Y: 'Ý', Z: 'Ž',
};

/** Pseudo-localise: accent letters (not inside {placeholders}), pad ~40%, wrap in brackets. */
export function pseudo(text: string): string {
  let out = '';
  let depth = 0;
  for (const ch of text) {
    if (ch === '{') depth += 1;
    if (depth > 0) out += ch;
    else out += ACCENTS[ch] ?? ch;
    if (ch === '}') depth = Math.max(0, depth - 1);
  }
  const visible = text.replace(/\{\w+\}/g, '').length;
  const pad = Math.max(1, Math.ceil(visible * 0.4));
  return `[${out}${' ~'.repeat(Math.ceil(pad / 2)).slice(0, pad)}]`;
}

function rawMessage(key: MessageKey, locale: AnyLocale): Msg {
  if (locale !== 'pseudo') {
    const m = CATALOGUES[locale]?.[key];
    if (m !== undefined) return m;
  }
  return en[key] as Msg;
}

/** Translate a key for the active (or given) locale. */
export function t(key: MessageKey, params?: Params, locale: AnyLocale = current): string {
  const m = rawMessage(key, locale);
  let text: string;
  if (typeof m === 'string') text = m;
  else {
    const count = typeof params?.count === 'number' ? params.count : Number(params?.count ?? NaN);
    text = Number.isFinite(count) ? pickPlural(m, count, locale) : m.other;
  }
  if (locale === 'pseudo') text = pseudo(text);
  return interpolate(text, params, locale);
}

/** True when the key exists in the English catalogue (for dynamic keys built from data). */
export function hasKey(key: string): key is MessageKey {
  return Object.prototype.hasOwnProperty.call(en, key);
}

export function formatNumber(n: number, locale: AnyLocale = current, opts?: Intl.NumberFormatOptions): string {
  try {
    return new Intl.NumberFormat(localeInfo(locale).bcp47, opts).format(n);
  } catch {
    return String(n);
  }
}

export function formatDate(d: Date | number, locale: AnyLocale = current, opts?: Intl.DateTimeFormatOptions): string {
  const date = typeof d === 'number' ? new Date(d) : d;
  try {
    return new Intl.DateTimeFormat(localeInfo(locale).bcp47, opts ?? { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  } catch {
    return date.toISOString();
  }
}
