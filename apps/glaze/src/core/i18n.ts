// i18n core (docs/I18N.md): locale resolution, script-aware layout metrics, interpolation,
// plurals, catalogue lookup with fallback, pseudo-localisation and Intl formatting helpers.
// Pure TS (no React Native imports) so Node tests it directly. The React layer lives in
// src/i18n/index.tsx; catalogues live in src/i18n/locales/*.ts.

/** Every locale the app ships, plus the `en-XA` pseudo-locale (dev only). */
export const SUPPORTED_LOCALES = Object.freeze([
  'en',
  'es',
  'fr',
  'de',
  'it',
  'pt-BR',
  'ja',
  'ko',
  'zh-Hans',
  'hi',
  'ar',
  'en-XA',
] as const);

export type Locale = (typeof SUPPORTED_LOCALES)[number];

/** The real (shipping) locales, without the pseudo-locale. */
export const SHIPPING_LOCALES: readonly Locale[] = Object.freeze(SUPPORTED_LOCALES.filter((l) => l !== 'en-XA'));

export const DEFAULT_LOCALE: Locale = 'en';
export const PSEUDO_LOCALE: Locale = 'en-XA';

/** Each language in its own name (endonym), for the Settings › Language picker. */
export const LOCALE_NAMES: Readonly<Record<Locale, string>> = Object.freeze({
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  it: 'Italiano',
  'pt-BR': 'Português (Brasil)',
  ja: '日本語',
  ko: '한국어',
  'zh-Hans': '简体中文',
  hi: 'हिन्दी',
  ar: 'العربية',
  'en-XA': 'Pseudo',
});

export function isSupportedLocale(x: unknown): x is Locale {
  return typeof x === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(x);
}

// ---------------------------------------------------------------------------
// Locale resolution

type ParsedTag = { lang: string; script: string | null; region: string | null };

/** Split a BCP 47 tag (also accepts `_` separators and any case) into language/script/region. */
export function parseTag(tag: string): ParsedTag {
  const parts = tag.trim().replace(/_/g, '-').split('-').filter(Boolean);
  const lang = (parts[0] ?? '').toLowerCase();
  let script: string | null = null;
  let region: string | null = null;
  for (const p of parts.slice(1)) {
    if (/^[A-Za-z]{4}$/.test(p) && !script) script = p[0].toUpperCase() + p.slice(1).toLowerCase();
    else if ((/^[A-Za-z]{2}$/.test(p) || /^\d{3}$/.test(p)) && !region) region = p.toUpperCase();
  }
  return { lang, script, region };
}

const TRADITIONAL_CHINESE_REGIONS = new Set(['TW', 'HK', 'MO']);

/** Map one device tag to a shipping locale, or null when we don't ship that language/script. */
export function matchLocale(tag: string): Locale | null {
  if (!tag) return null;
  const exact = SUPPORTED_LOCALES.find((l) => l.toLowerCase() === tag.trim().replace(/_/g, '-').toLowerCase());
  if (exact && exact !== PSEUDO_LOCALE) return exact;
  const { lang, script, region } = parseTag(tag);
  switch (lang) {
    case 'en':
    case 'es':
    case 'fr':
    case 'de':
    case 'it':
    case 'ja':
    case 'ko':
    case 'hi':
    case 'ar':
      return lang;
    case 'pt':
      // Only Brazilian Portuguese ships; it is the closest match for every Portuguese variant.
      return 'pt-BR';
    case 'zh':
      // Simplified Chinese only. Traditional (Hant, or TW/HK/MO without a script) is skipped so the
      // next preferred device language wins instead of forcing the wrong script.
      if (script === 'Hant') return null;
      if (!script && region && TRADITIONAL_CHINESE_REGIONS.has(region)) return null;
      return 'zh-Hans';
    default:
      return null;
  }
}

/**
 * Pick the app locale. A supported `override` (from Settings) wins, including `en-XA`;
 * otherwise the first device tag (in preference order) we ship; otherwise English.
 */
export function resolveLocale(deviceTags: readonly string[], override: string | null): Locale {
  if (override && isSupportedLocale(override)) return override;
  for (const tag of deviceTags) {
    const m = matchLocale(tag);
    if (m) return m;
  }
  return DEFAULT_LOCALE;
}

// ---------------------------------------------------------------------------
// Direction and script

const RTL_LANGS = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'yi', 'dv', 'ckb', 'sd', 'ug']);

/** True for right-to-left languages (Arabic is the only one Glaze ships). */
export function isRTL(locale: string): boolean {
  return RTL_LANGS.has(parseTag(locale).lang);
}

export type Script = 'latin' | 'cjk' | 'devanagari' | 'arabic';

export function scriptOf(locale: string): Script {
  const { lang } = parseTag(locale);
  if (lang === 'ja' || lang === 'ko' || lang === 'zh') return 'cjk';
  if (lang === 'hi' || lang === 'mr' || lang === 'ne') return 'devanagari';
  if (lang === 'ar' || lang === 'fa' || lang === 'ur') return 'arabic';
  return 'latin';
}

const LINE_HEIGHT_SCALE: Readonly<Record<Script, number>> = Object.freeze({
  latin: 1,
  cjk: 1.15,
  devanagari: 1.3,
  arabic: 1.25,
});

/** Multiplier for token line heights so tall scripts (marks above/below) never clip. */
export function lineHeightScale(script: Script): number {
  return LINE_HEIGHT_SCALE[script];
}

/** Whether the brand fonts (Unbounded/Manrope, Latin only) can draw this script. */
export function brandFontSupports(script: Script): boolean {
  return script === 'latin';
}

// ---------------------------------------------------------------------------
// Messages: interpolation and plurals

export type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';
export const PLURAL_CATEGORIES: readonly PluralCategory[] = Object.freeze(['zero', 'one', 'two', 'few', 'many', 'other']);

/** ICU-lite plural message: `other` is required, the rest are optional per language. */
export type PluralMessage = { zero?: string; one?: string; two?: string; few?: string; many?: string; other: string };

/** A catalogue leaf: a plain string or a plural message (selected by `params.count`). */
export type Message = string | PluralMessage;

export type Params = Readonly<Record<string, string | number>>;

/** A catalogue tree: nested namespaces of messages. */
export type CatalogueTree = { readonly [key: string]: Message | CatalogueTree };

/** True when `x` has the plural-message shape (only CLDR category keys, `other` a string). */
export function isPluralMessage(x: unknown): x is PluralMessage {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return false;
  const keys = Object.keys(x);
  if (keys.length === 0 || typeof (x as Record<string, unknown>).other !== 'string') return false;
  return keys.every((k) => (PLURAL_CATEGORIES as readonly string[]).includes(k) && typeof (x as Record<string, unknown>)[k] === 'string');
}

/** Replace `{name}` placeholders. Unknown placeholders are left as written so bugs stay visible. */
export function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : whole,
  );
}

/** Names of the `{placeholders}` in a template, in order of first appearance. */
export function placeholdersOf(template: string): string[] {
  const out: string[] = [];
  for (const m of template.matchAll(/\{(\w+)\}/g)) if (!out.includes(m[1])) out.push(m[1]);
  return out;
}

/**
 * CLDR cardinal plural rules for the shipping languages, used when the JS engine lacks
 * Intl.PluralRules (Hermes does not ship it). Integers and simple decimals only.
 */
export function fallbackPluralCategory(locale: string, n: number): PluralCategory {
  const { lang } = parseTag(locale);
  const abs = Math.abs(n);
  const i = Math.floor(abs);
  const isInt = i === abs;
  switch (lang) {
    case 'ja':
    case 'ko':
    case 'zh':
      return 'other';
    case 'fr':
      // fr: one for 0 and 1 (and 0.x/1.x); many for large round millions.
      if (i === 0 || i === 1) return 'one';
      if (isInt && i !== 0 && i % 1000000 === 0) return 'many';
      return 'other';
    case 'pt':
      if (i === 0 || i === 1) return 'one';
      if (isInt && i !== 0 && i % 1000000 === 0) return 'many';
      return 'other';
    case 'es':
    case 'it':
      if (abs === 1) return 'one';
      if (isInt && i !== 0 && i % 1000000 === 0) return 'many';
      return 'other';
    case 'hi':
      return i === 0 || abs === 1 ? 'one' : 'other';
    case 'ar': {
      if (!isInt) return 'other';
      if (i === 0) return 'zero';
      if (i === 1) return 'one';
      if (i === 2) return 'two';
      const m100 = i % 100;
      if (m100 >= 3 && m100 <= 10) return 'few';
      if (m100 >= 11 && m100 <= 99) return 'many';
      return 'other';
    }
    default:
      // en, de and other one/other languages.
      return abs === 1 && isInt ? 'one' : 'other';
  }
}

const pluralRulesCache = new Map<string, { select(n: number): string }>();

function intlLocale(locale: string): string {
  return locale === PSEUDO_LOCALE ? 'en' : locale;
}

/** Plural category for `n`: Intl.PluralRules when available, CLDR fallback table otherwise. */
export function pluralCategory(locale: string, n: number): PluralCategory {
  const tag = intlLocale(locale);
  const PR = (globalThis as { Intl?: { PluralRules?: new (l: string) => { select(n: number): string } } }).Intl?.PluralRules;
  if (typeof PR === 'function') {
    try {
      let rules = pluralRulesCache.get(tag);
      if (!rules) {
        rules = new PR(tag);
        pluralRulesCache.set(tag, rules);
      }
      const c = rules.select(n);
      if ((PLURAL_CATEGORIES as readonly string[]).includes(c)) return c as PluralCategory;
    } catch {
      // fall through to the table
    }
  }
  return fallbackPluralCategory(tag, n);
}

/**
 * Choose the plural form for `count`. `zero` doubles as an explicit "none" form in any language
 * (so English can say "No icons"); a missing category falls back to `other`.
 */
export function selectPlural(msg: PluralMessage, locale: string, count: number): string {
  if (count === 0 && msg.zero !== undefined) return msg.zero;
  const cat = pluralCategory(locale, count);
  return msg[cat] ?? msg.other;
}

// ---------------------------------------------------------------------------
// Catalogue lookup

/** Look up a dotted key (`settings.language.title`) in a catalogue tree. */
export function lookup(tree: CatalogueTree | undefined, key: string): Message | undefined {
  let node: unknown = tree;
  for (const part of key.split('.')) {
    if (!node || typeof node !== 'object' || isPluralMessage(node)) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  if (typeof node === 'string' || isPluralMessage(node)) return node;
  return undefined;
}

/** Catalogues by locale; `en` is the complete source of truth. */
export type CatalogueSet = Partial<Record<Locale, CatalogueTree>> & { en: CatalogueTree };

function formatParams(params: Params | undefined, locale: string): Params | undefined {
  if (!params) return params;
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(params)) out[k] = typeof v === 'number' ? formatNumber(v, locale) : v;
  return out;
}

function render(msg: Message, locale: string, params: Params | undefined, pseudo: boolean): string {
  let template: string;
  if (typeof msg === 'string') template = msg;
  else {
    const count = params && typeof params.count === 'number' ? params.count : Number(params?.count ?? NaN);
    template = Number.isFinite(count) ? selectPlural(msg, locale, count) : msg.other;
  }
  if (pseudo) template = pseudoLocalize(template);
  return interpolate(template, formatParams(params, locale));
}

/**
 * Translate `key` for `locale`: the locale's catalogue, then English, then the key itself.
 * Plural messages pick their form from `params.count`; numeric params are formatted with Intl.
 * `en-XA` renders English through pseudoLocalize().
 */
export function translate(catalogues: CatalogueSet, locale: Locale, key: string, params?: Params): string {
  const pseudo = locale === PSEUDO_LOCALE;
  if (!pseudo && locale !== 'en') {
    const own = lookup(catalogues[locale], key);
    if (own !== undefined) return render(own, locale, params, false);
  }
  const en = lookup(catalogues.en, key);
  if (en !== undefined) return render(en, 'en', params, pseudo);
  return key;
}

// ---------------------------------------------------------------------------
// Pseudo-localisation

const ACCENTS: Readonly<Record<string, string>> = Object.freeze({
  a: 'á', b: 'ƀ', c: 'ç', d: 'ď', e: 'é', f: 'ƒ', g: 'ĝ', h: 'ĥ', i: 'í', j: 'ĵ', k: 'ķ', l: 'ļ', m: 'ɱ',
  n: 'ñ', o: 'ö', p: 'þ', q: 'ǫ', r: 'ŕ', s: 'š', t: 'ţ', u: 'ü', v: 'ṽ', w: 'ŵ', x: 'ẋ', y: 'ý', z: 'ž',
  A: 'Á', B: 'Ɓ', C: 'Ç', D: 'Ď', E: 'É', F: 'Ƒ', G: 'Ĝ', H: 'Ĥ', I: 'Í', J: 'Ĵ', K: 'Ķ', L: 'Ļ', M: 'Ṁ',
  N: 'Ñ', O: 'Ö', P: 'Þ', Q: 'Ǫ', R: 'Ŕ', S: 'Š', T: 'Ţ', U: 'Ü', V: 'Ṽ', W: 'Ŵ', X: 'Ẋ', Y: 'Ý', Z: 'Ž',
});

const PSEUDO_FILLER = 'ļöŕéɱ íþšüɱ ďöļöŕ šíţ áɱéţ çöñšéçţéţüŕ áďíþíšçíñĝ éļíţ ';

/** Share of extra length pseudoLocalize adds, approximating German/French expansion. */
export const PSEUDO_EXPANSION = 0.4;

/**
 * Accent every Latin letter, pad ~40% longer and wrap in ⟦ ⟧, keeping `{placeholders}` intact,
 * so truncation, hard-coded strings and concatenation show up on screen.
 */
export function pseudoLocalize(str: string): string {
  const parts = str.split(/(\{\w+\})/);
  let visible = 0;
  const body = parts
    .map((p) => {
      if (/^\{\w+\}$/.test(p)) return p;
      visible += p.length;
      return p.replace(/[A-Za-z]/g, (ch) => ACCENTS[ch] ?? ch);
    })
    .join('');
  const padLen = Math.ceil(visible * PSEUDO_EXPANSION);
  let pad = '';
  while (pad.length < padLen) pad += PSEUDO_FILLER;
  pad = pad.slice(0, padLen).trimEnd();
  return `⟦${body}${pad ? ` ${pad}` : ''}⟧`;
}

// ---------------------------------------------------------------------------
// Numbers, dates and the Lock Screen clock

export type NumberOptions = Intl.NumberFormatOptions & {
  /** Force 0-9 digits (the Lock Screen clock, sizes in technical copy). */
  latinDigits?: boolean;
};

/** Intl.NumberFormat with a safe fallback for engines with partial Intl. */
export function formatNumber(n: number, locale: string, options?: NumberOptions): string {
  const { latinDigits, ...opts } = options ?? {};
  const o: Intl.NumberFormatOptions & { numberingSystem?: string } = { ...opts };
  if (latinDigits) o.numberingSystem = 'latn';
  try {
    return new Intl.NumberFormat(intlLocale(locale), o).format(n);
  } catch {
    return String(n);
  }
}

export type DateOptions = Intl.DateTimeFormatOptions & { latinDigits?: boolean };

/** Intl.DateTimeFormat with a safe fallback (ISO date) for engines with partial Intl. */
export function formatDate(date: Date, locale: string, options?: DateOptions): string {
  const { latinDigits, ...opts } = options ?? {};
  const o: Intl.DateTimeFormatOptions & { numberingSystem?: string } = { ...opts };
  if (latinDigits) o.numberingSystem = 'latn';
  try {
    return new Intl.DateTimeFormat(intlLocale(locale), o).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/** Locales whose default clock is 12-hour (CLDR), used when Intl can't tell us. */
const TWELVE_HOUR_LANGS = new Set(['en', 'ko', 'hi', 'ar']);

/** Whether the locale prefers a 24-hour clock. */
export function uses24HourClock(locale: string): boolean {
  try {
    const opts = new Intl.DateTimeFormat(intlLocale(locale), { hour: 'numeric' }).resolvedOptions() as {
      hourCycle?: string;
      hour12?: boolean;
    };
    if (opts.hourCycle) return opts.hourCycle === 'h23' || opts.hourCycle === 'h24';
    if (typeof opts.hour12 === 'boolean') return !opts.hour12;
  } catch {
    // fall through
  }
  return !TWELVE_HOUR_LANGS.has(parseTag(intlLocale(locale)).lang);
}

/** Unicode LEFT-TO-RIGHT ISOLATE / POP DIRECTIONAL ISOLATE. */
export const LRI = '⁦';
export const PDI = '⁩';

/**
 * Lock Screen clock text: always Latin digits and left-to-right (wrapped in LRI…PDI so it never
 * reorders inside Arabic text). 12-hour clocks show `9:41` (no AM/PM, like the real Lock Screen),
 * 24-hour clocks show `09:41`. `uses24h` (from the device, when known) beats the locale default.
 */
export function formatClock(date: Date, locale: string, uses24h?: boolean): string {
  const h24 = uses24h ?? uses24HourClock(locale);
  const hours = date.getHours();
  const hh = h24 ? String(hours).padStart(2, '0') : String(hours % 12 || 12);
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${LRI}${hh}:${mm}${PDI}`;
}
