// Pure i18n core (owner request 16 Oct, docs/OWNER_1016.md R3). No React Native imports, runs under node --test.
// Catalogues are flat maps of key → message. A message is a string with {name} placeholders, or a plural
// object keyed by Intl.PluralRules categories ({ one: '{count} photo', other: '{count} photos' }).

export type PluralForms = {
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
};
export type Message = string | PluralForms;
export type Catalog = Readonly<Record<string, Message>>;
export type Params = Readonly<Record<string, string | number>>;

export type Dir = 'ltr' | 'rtl';
/** Script families that need different line heights / font fallback. */
export type Script = 'latin' | 'cjk' | 'devanagari' | 'arabic';

export type LocaleInfo = {
  /** BCP 47 tag used for Intl and the catalogue id. */
  code: LocaleCode;
  /** Name of the language in that language (shown in the picker). */
  nativeName: string;
  /** English name (accessibility hint / docs). */
  englishName: string;
  dir: Dir;
  script: Script;
};

export type LocaleCode =
  | 'en'
  | 'es'
  | 'fr'
  | 'de'
  | 'it'
  | 'pt-BR'
  | 'ja'
  | 'ko'
  | 'zh-Hans'
  | 'hi'
  | 'ar';

export const LOCALES: readonly LocaleInfo[] = [
  { code: 'en', nativeName: 'English', englishName: 'English', dir: 'ltr', script: 'latin' },
  { code: 'es', nativeName: 'Español', englishName: 'Spanish', dir: 'ltr', script: 'latin' },
  { code: 'fr', nativeName: 'Français', englishName: 'French', dir: 'ltr', script: 'latin' },
  { code: 'de', nativeName: 'Deutsch', englishName: 'German', dir: 'ltr', script: 'latin' },
  { code: 'it', nativeName: 'Italiano', englishName: 'Italian', dir: 'ltr', script: 'latin' },
  { code: 'pt-BR', nativeName: 'Português (Brasil)', englishName: 'Portuguese (Brazil)', dir: 'ltr', script: 'latin' },
  { code: 'ja', nativeName: '日本語', englishName: 'Japanese', dir: 'ltr', script: 'cjk' },
  { code: 'ko', nativeName: '한국어', englishName: 'Korean', dir: 'ltr', script: 'cjk' },
  { code: 'zh-Hans', nativeName: '简体中文', englishName: 'Chinese (Simplified)', dir: 'ltr', script: 'cjk' },
  { code: 'hi', nativeName: 'हिन्दी', englishName: 'Hindi', dir: 'ltr', script: 'devanagari' },
  { code: 'ar', nativeName: 'العربية', englishName: 'Arabic', dir: 'rtl', script: 'arabic' },
];

export const DEFAULT_LOCALE: LocaleCode = 'en';

export function localeInfo(code: LocaleCode): LocaleInfo {
  return LOCALES.find((l) => l.code === code) ?? LOCALES[0];
}

export function isLocaleCode(v: unknown): v is LocaleCode {
  return typeof v === 'string' && LOCALES.some((l) => l.code === v);
}

/**
 * Picks the best supported locale for the phone's preferred language tags (most preferred first),
 * e.g. ['pt-PT', 'en-AU'] → 'pt-BR'; ['zh-Hant-TW'] → 'zh-Hans' (closest we ship); ['xx'] → 'en'.
 */
export function resolveLocale(tags: readonly string[]): LocaleCode {
  for (const raw of tags) {
    if (!raw) continue;
    const tag = raw.replace(/_/g, '-');
    const exact = LOCALES.find((l) => l.code.toLowerCase() === tag.toLowerCase());
    if (exact) return exact.code;
    const lang = tag.split('-')[0].toLowerCase();
    if (lang === 'pt') return 'pt-BR';
    if (lang === 'zh') return 'zh-Hans';
    const byLang = LOCALES.find((l) => l.code.split('-')[0].toLowerCase() === lang);
    if (byLang) return byLang.code;
  }
  return DEFAULT_LOCALE;
}

/** Replaces {name} placeholders. Unknown placeholders are left visible so a missing param is easy to spot. */
export function interpolate(text: string, params?: Params, locale: string = DEFAULT_LOCALE): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const v = params[name];
    if (v === undefined) return whole;
    return typeof v === 'number' ? formatNumber(v, locale) : v;
  });
}

export type PluralRule = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';

/**
 * CLDR cardinal plural rules for the shipped languages, used when the JS engine has no Intl.PluralRules.
 * Hermes (Expo Go and release builds) lacks it: `new Intl.PluralRules()` threw "undefined cannot be used as a
 * constructor" and broke the Templates screen and photo picking (owner test 17 Oct, docs/FB_1017.md F1).
 */
export function fallbackRule(locale: string): (n: number) => PluralRule {
  const lang = locale.split('-')[0].toLowerCase();
  if (lang === 'ja' || lang === 'ko' || lang === 'zh') return () => 'other';
  if (lang === 'fr' || lang === 'pt' || lang === 'hi') return (n) => (Math.floor(Math.abs(n)) <= 1 ? 'one' : 'other');
  if (lang === 'ar') {
    return (n) => {
      if (!Number.isInteger(n)) return 'other';
      if (n === 0) return 'zero';
      if (n === 1) return 'one';
      if (n === 2) return 'two';
      const m = Math.abs(n) % 100;
      if (m >= 3 && m <= 10) return 'few';
      if (m >= 11 && m <= 99) return 'many';
      return 'other';
    };
  }
  return (n) => (n === 1 ? 'one' : 'other');
}

type PluralSelector = (n: number) => PluralRule;
type PluralRulesCtor = new (locale: string) => { select(n: number): string };

const pluralCache = new Map<string, PluralSelector>();

function makeSelector(locale: string): PluralSelector {
  const PR = (globalThis as { Intl?: { PluralRules?: unknown } }).Intl?.PluralRules;
  if (typeof PR === 'function') {
    try {
      const rules = new (PR as PluralRulesCtor)(locale);
      rules.select(1);
      return (n) => rules.select(n) as PluralRule;
    } catch {
      // fall through to the table
    }
  }
  return fallbackRule(locale);
}

export function pluralCategory(locale: string, count: number): PluralRule {
  let sel = pluralCache.get(locale);
  if (!sel) {
    sel = makeSelector(locale);
    pluralCache.set(locale, sel);
  }
  try {
    return sel(count);
  } catch {
    return fallbackRule(locale)(count);
  }
}

/** Test helper: forget cached selectors (e.g. after deleting Intl.PluralRules). */
export function clearPluralCache(): void {
  pluralCache.clear();
}

export function isPlural(m: Message | undefined): m is PluralForms {
  return typeof m === 'object' && m !== null && typeof (m as PluralForms).other === 'string';
}

/**
 * Looks up `key` in `catalog`, falling back to `fallback` (English), then to the key itself.
 * Plural messages pick the form for params.count (exact `zero` is used for 0 when present).
 */
export function translate(
  locale: string,
  catalog: Catalog,
  fallback: Catalog,
  key: string,
  params?: Params,
): string {
  const m = catalog[key] ?? fallback[key];
  if (m === undefined) return key;
  if (typeof m === 'string') return interpolate(m, params, locale);
  const count = typeof params?.count === 'number' ? params.count : 0;
  const cat = pluralCategory(locale, count);
  const text = (count === 0 && m.zero) || m[cat] || m.other;
  return interpolate(text, params, locale);
}

/** Placeholder names used in a message (all plural forms), sorted, for catalogue parity tests. */
export function placeholders(m: Message): string[] {
  const texts = typeof m === 'string' ? [m] : Object.values(m).filter((v): v is string => typeof v === 'string');
  const out = new Set<string>();
  for (const t of texts) for (const x of t.matchAll(/\{(\w+)\}/g)) out.add(x[1]);
  return [...out].sort();
}

// ---------- Intl formatting (numbers stay left-to-right; see docs/I18N.md) ----------

const LRI = '⁦';
const PDI = '⁩';

/** Wraps text in Unicode left-to-right isolates so numbers and percentages never flip inside RTL text. */
export function ltr(text: string): string {
  return LRI + text + PDI;
}

export function formatNumber(n: number, locale: string, opts?: Intl.NumberFormatOptions): string {
  try {
    return new Intl.NumberFormat(locale, opts).format(n);
  } catch {
    return String(n);
  }
}

/** 0.5 → "50%" (locale-aware, e.g. "50 %" in French), always isolated left-to-right. */
export function formatPercent(fraction: number, locale: string): string {
  return ltr(formatNumber(fraction, locale, { style: 'percent', maximumFractionDigits: 0 }));
}

export function formatDate(d: Date | number, locale: string, opts?: Intl.DateTimeFormatOptions): string {
  try {
    return new Intl.DateTimeFormat(locale, opts ?? { dateStyle: 'medium' }).format(d);
  } catch {
    return new Date(d).toDateString();
  }
}

/** Length with a unit, e.g. formatUnit(25, 'centimeter', 'de') → "25 cm". */
export function formatUnit(n: number, unit: string, locale: string): string {
  try {
    return ltr(new Intl.NumberFormat(locale, { style: 'unit', unit, unitDisplay: 'short' }).format(n));
  } catch {
    return ltr(`${n} ${unit}`);
  }
}

/** Seconds → "1:05" timer text (digits only, isolated LTR). */
export function formatDuration(totalSeconds: number, locale: string): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return ltr(`${formatNumber(m, locale)}:${formatNumber(sec, locale, { minimumIntegerDigits: 2 })}`);
}

// ---------- Pseudo-locale (accented, ~40% longer) for layout tests ----------

const ACCENTS: Record<string, string> = {
  a: 'á', b: 'ƀ', c: 'ç', d: 'ð', e: 'é', f: 'ƒ', g: 'ĝ', h: 'ĥ', i: 'í', j: 'ĵ', k: 'ķ', l: 'ļ', m: 'ɱ',
  n: 'ñ', o: 'ó', p: 'þ', q: 'ǫ', r: 'ŕ', s: 'š', t: 'ţ', u: 'ú', v: 'ṽ', w: 'ŵ', x: 'ẋ', y: 'ý', z: 'ž',
  A: 'Á', B: 'Ɓ', C: 'Ç', D: 'Ð', E: 'É', F: 'Ƒ', G: 'Ĝ', H: 'Ĥ', I: 'Í', J: 'Ĵ', K: 'Ķ', L: 'Ļ', M: 'Ṁ',
  N: 'Ñ', O: 'Ó', P: 'Þ', Q: 'Ǫ', R: 'Ŕ', S: 'Š', T: 'Ţ', U: 'Ú', V: 'Ṽ', W: 'Ŵ', X: 'Ẋ', Y: 'Ý', Z: 'Ž',
};

/** "Lock {name}" → "[Ļóçķ {name} ~~~~]" — accents letters, keeps placeholders, pads to ≥ 140% length. */
export function pseudoText(text: string): string {
  let out = '';
  let i = 0;
  while (i < text.length) {
    if (text[i] === '{') {
      const end = text.indexOf('}', i);
      if (end > i) {
        out += text.slice(i, end + 1);
        i = end + 1;
        continue;
      }
    }
    out += ACCENTS[text[i]] ?? text[i];
    i += 1;
  }
  const pad = Math.max(1, Math.ceil(text.length * 0.4));
  return `[${out} ${'~'.repeat(pad)}]`;
}

export function pseudoCatalog(source: Catalog): Catalog {
  const out: Record<string, Message> = {};
  for (const [k, m] of Object.entries(source)) {
    if (typeof m === 'string') out[k] = pseudoText(m);
    else {
      const forms: PluralForms = { other: pseudoText(m.other) };
      for (const f of ['zero', 'one', 'two', 'few', 'many'] as const) {
        const v = m[f];
        if (v) forms[f] = pseudoText(v);
      }
      out[k] = forms;
    }
  }
  return out;
}

// ---------- Script typography ----------

/** Line-height multiplier per script: CJK, Devanagari and Arabic need more room for marks and glyph height. */
export function lineHeightScale(script: Script): number {
  switch (script) {
    case 'cjk':
      return 1.15;
    case 'devanagari':
      return 1.3;
    case 'arabic':
      return 1.25;
    default:
      return 1;
  }
}

/** Latin fonts (Fraunces/Inter) lack these scripts: use the system font so glyphs and metrics match. */
export function usesSystemFont(script: Script): boolean {
  return script !== 'latin';
}
