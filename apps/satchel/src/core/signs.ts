// T144 Sign reader: an offline picture dictionary of the signs travellers meet (exit, push / pull, toilets, platform,
// no smoking...) in the 12 phrase languages. Pure TypeScript, fully offline; the table (src/content/signs.json) is
// passed in by the caller, as with phrases.
// - Every language carries every sign, either a line ({ text, roman?, native_check }) or an explicit null ("not
//   written yet": the model was not confident of the usual wording). Never an empty string.
// - Every line is native_check: true (model-written) until a fluent speaker confirms it; the screen says so.
// - Search by English (the sign's UI name plus extra English words in `also`), by local text typed or pasted from a
//   sign, or by the romanised reading. Both sides are folded first: full-width / half-width forms (NFKC), case,
//   accents on Latin letters, katakana to hiragana, spaces and punctuation.
// - Language order: the trip's countries first (in trip order), then the rest in the phrase-table order.
import { languageForCountry, PHRASE_LANGS, type PhraseLang, type PhraseTable } from './phrases.ts';

export const SIGN_IDS = [
  'exit',
  'entrance',
  'push',
  'pull',
  'open',
  'closed',
  'lift',
  'stairs',
  'toilets',
  'men',
  'women',
  'accessibleToilet',
  'platform',
  'departures',
  'arrivals',
  'ticketOffice',
  'lockers',
  'taxi',
  'busStop',
  'noEntry',
  'keepOut',
  'cashOnly',
  'noPhotos',
  'noSmoking',
  'danger',
  'emergencyExit',
  'wetFloor',
  'pharmacy',
  'hospital',
  'information',
] as const;
export type SignId = (typeof SIGN_IDS)[number];

export const SIGN_CATEGORIES = ['way', 'toilets', 'transport', 'rules', 'safety', 'services'] as const;
export type SignCategory = (typeof SIGN_CATEGORIES)[number];

export type SignLine = { text: string; roman?: string; native_check?: boolean };
export type SignLanguage = { code: string; latin: boolean; lines: Record<string, SignLine | null> };
export type SignEntry = { id: string; category: string; also?: string[] };
export type SignTable = { version: number; checked?: string | null; note?: string; signs: SignEntry[]; languages: SignLanguage[] };

export const isSignId = (v: unknown): v is SignId => typeof v === 'string' && (SIGN_IDS as readonly string[]).includes(v);
export const isSignCategory = (v: unknown): v is SignCategory => typeof v === 'string' && (SIGN_CATEGORIES as readonly string[]).includes(v);

/** English UI names, one per sign (the caller passes the catalogue's signs.sign.* strings). */
export type SignNames = Record<SignId, string>;

/** Not Latin script (same idea as phrases.hasNonLatin): anything past Latin Extended Additional and punctuation. */
const NON_LATIN = /[^\u0000-ɏḀ-ỿ -⁯]/u;

/**
 * Folds text for matching: NFKC (full-width letters / digits, half-width katakana), lower case, accents off Latin
 * letters (é -> e, đ -> d, ß -> ss), katakana -> hiragana, and no spaces, punctuation or symbols. Other scripts
 * keep their marks (Thai vowels, Japanese dakuten, Hangul stay as they are).
 */
export function foldSign(s: string): string {
  let out = '';
  for (const ch of s.normalize('NFKC').toLowerCase()) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp < 0x0250 || (cp >= 0x1e00 && cp <= 0x1eff)) {
      out += ch.normalize('NFD').replace(/\p{M}/gu, '').replace('đ', 'd').replace('ß', 'ss').replace('ø', 'o').replace('æ', 'ae').replace('œ', 'oe');
    } else if (cp >= 0x30a1 && cp <= 0x30f6) {
      out += String.fromCodePoint(cp - 0x60);
    } else out += ch;
  }
  return out.replace(/[\s\p{P}\p{S}]/gu, '');
}

export function findSignLanguage(table: SignTable, code: string | null | undefined): SignLanguage | null {
  if (!code) return null;
  return table.languages.find((l) => l.code === code) ?? null;
}

export function signCategory(table: SignTable, id: SignId): SignCategory {
  const c = table.signs.find((s) => s.id === id)?.category;
  return isSignCategory(c) ? c : 'way';
}

export type SignCard = {
  id: SignId;
  category: SignCategory;
  lang: PhraseLang;
  /** null: this language has no line for the sign yet. */
  text: string | null;
  /** How to read it, for non-Latin scripts only. */
  roman: string | null;
  /** Model-written, not yet confirmed by a fluent speaker. */
  needsCheck: boolean;
};

/** One sign in one language (text null when the language has an explicit null). */
export function signCard(table: SignTable, lang: PhraseLang, id: SignId): SignCard {
  const l = findSignLanguage(table, lang);
  const line = l?.lines[id] ?? null;
  const text = line && line.text.trim() ? line.text : null;
  return {
    id,
    category: signCategory(table, id),
    lang,
    text,
    roman: text && l && !l.latin ? line?.roman?.trim() || null : null,
    needsCheck: text ? line?.native_check !== false : false,
  };
}

/** Every sign in a language, in the fixed order, optionally one category only. */
export function signCards(table: SignTable, lang: PhraseLang, category?: SignCategory | null): SignCard[] {
  return SIGN_IDS.filter((id) => !category || signCategory(table, id) === category).map((id) => signCard(table, lang, id));
}

/**
 * Sign languages for these countries first (trip order, no repeats; countries without a phrase language skipped),
 * then every other language in the phrase-table order.
 */
export function signLangOrder(phrases: PhraseTable, countries: readonly (string | null | undefined)[]): { langs: PhraseLang[]; tripLangs: PhraseLang[] } {
  const tripLangs: PhraseLang[] = [];
  for (const c of countries) {
    const l = languageForCountry(phrases, c);
    if (l && !tripLangs.includes(l)) tripLangs.push(l);
  }
  return { langs: [...tripLangs, ...PHRASE_LANGS.filter((l) => !tripLangs.includes(l))], tripLangs };
}

export type SignMatch = 'english' | 'local' | 'roman';
export type SignHit = {
  id: SignId;
  /** What matched: the English name / words, or a language's local text / reading. */
  match: SignMatch;
  /** The language whose line matched (local / roman), else null. */
  lang: PhraseLang | null;
  /** 0 exact, 1 starts with, 2 contains (lower is better). */
  score: number;
};

const scoreOf = (hay: string, q: string): number | null => {
  if (!hay || !q) return null;
  if (hay === q) return 0;
  if (hay.startsWith(q)) return 1;
  if (hay.includes(q)) return 2;
  return null;
};

/**
 * Signs matching the query, best first. English (UI name and `also` words), then every language's local text and
 * reading; languages in `langs` order are tried first, so a typed 出口 lands on the trip's language when two share it.
 * Ties keep the fixed sign order. Empty query (after folding): no hits.
 */
export function searchSigns(table: SignTable, query: string, opts: { names: SignNames; langs?: readonly PhraseLang[]; category?: SignCategory | null }): SignHit[] {
  const q = foldSign(query);
  if (!q) return [];
  const order = opts.langs?.length ? [...opts.langs, ...PHRASE_LANGS.filter((l) => !opts.langs?.includes(l))] : [...PHRASE_LANGS];
  const hits: SignHit[] = [];
  SIGN_IDS.forEach((id) => {
    if (opts.category && signCategory(table, id) !== opts.category) return;
    const found: SignHit[] = [];
    const consider = (hay: string, match: SignMatch, lang: PhraseLang | null) => {
      const s = scoreOf(foldSign(hay), q);
      if (s != null && (!found[0] || s < found[0].score)) found[0] = { id, match, lang, score: s };
    };
    consider(opts.names[id] ?? '', 'english', null);
    for (const w of table.signs.find((x) => x.id === id)?.also ?? []) consider(w, 'english', null);
    for (const lang of order) {
      const line = findSignLanguage(table, lang)?.lines[id];
      if (!line) continue;
      consider(line.text, 'local', lang);
      if (line.roman) consider(line.roman, 'roman', lang);
    }
    if (found[0]) hits.push(found[0]);
  });
  return hits.map((h, i) => ({ h, i })).sort((a, b) => a.h.score - b.h.score || a.i - b.i).map((x) => x.h);
}

/** Content problems (empty list = good). */
export function signProblems(table: SignTable): string[] {
  const out: string[] = [];
  const ids = table.signs.map((s) => s.id);
  for (const id of SIGN_IDS) if (!ids.includes(id)) out.push(`sign ${id}: missing`);
  for (const s of table.signs) {
    if (!isSignId(s.id)) out.push(`sign ${s.id}: unknown id`);
    if (!isSignCategory(s.category)) out.push(`sign ${s.id}: unknown category ${s.category}`);
    for (const w of s.also ?? []) if (!w.trim()) out.push(`sign ${s.id}: empty search word`);
  }
  const codes = table.languages.map((l) => l.code);
  for (const code of PHRASE_LANGS) if (!codes.includes(code)) out.push(`language ${code}: missing`);
  for (const l of table.languages) {
    if (!(PHRASE_LANGS as readonly string[]).includes(l.code)) out.push(`language ${l.code}: unknown code`);
    for (const id of SIGN_IDS) {
      if (!(id in l.lines)) {
        out.push(`${l.code} ${id}: missing (use null when not written)`);
        continue;
      }
      const line = l.lines[id];
      if (line === null) continue;
      if (typeof line.text !== 'string' || !line.text.trim()) out.push(`${l.code} ${id}: empty text`);
      if (line.native_check !== true) out.push(`${l.code} ${id}: not marked native_check`);
      if (l.latin && NON_LATIN.test(line.text)) out.push(`${l.code} ${id}: marked Latin but has other script`);
      if (l.latin && line.roman !== undefined) out.push(`${l.code} ${id}: Latin script needs no reading`);
      if (!l.latin && !line.roman?.trim()) out.push(`${l.code} ${id}: no romanisation`);
      if (line.roman !== undefined && (!line.roman.trim() || NON_LATIN.test(line.roman))) out.push(`${l.code} ${id}: romanisation empty or not Latin`);
    }
    for (const id of Object.keys(l.lines)) if (!isSignId(id)) out.push(`${l.code} ${id}: unknown sign`);
  }
  return out;
}

/** First value of a route param (expo-router gives string | string[] | undefined). */
const first = (v: unknown): unknown => (Array.isArray(v) ? v[0] : v);
export const parseSignParam = (v: unknown): SignId | null => {
  const s = first(v);
  return isSignId(s) ? s : null;
};

/** Point size for a sign's local text on its card: short signs go big. Dynamic Type scales it further. */
export function signFontSize(text: string): number {
  const n = [...text.trim()].length;
  if (n <= 4) return 48;
  if (n <= 10) return 40;
  if (n <= 20) return 32;
  return 26;
}
