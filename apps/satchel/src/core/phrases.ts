// T56 "Show a local" phrase cards: the bundled phrase table (src/content/phrases.json, passed in by the caller),
// lookups, a content check, and which language to open by default. Pure TypeScript, fully offline.
// Default language: the country of the trip you're on (current / next booking), else the destination of the trip
// coming up, else the language you used last, else the phone's own zone, else Japanese.
import { countryForZone, guessCountry } from './emergency.ts';
import { destinationZone, focusTrip } from './glance.ts';
import type { LocalDate, Trip } from './model.ts';

export const PHRASE_IDS = [
  'toilet',
  'hello',
  'thanks',
  'excuseMe',
  'speakEnglish',
  'howMuch',
  'doctor',
  'police',
  'allergy',
  'water',
  'bill',
  'station',
  'address',
  'lost',
  'help',
  'noThanks',
] as const;
export type PhraseId = (typeof PHRASE_IDS)[number];

export const PHRASE_LANGS = ['ja', 'zh-Hans', 'ko', 'th', 'vi', 'es', 'fr', 'de', 'it', 'pt', 'id'] as const;
export type PhraseLang = (typeof PHRASE_LANGS)[number];

/** The language opened when nothing else says which (the demo trip goes to Japan). */
export const DEFAULT_PHRASE_LANG: PhraseLang = 'ja';
/** Persisted key (src/state/persisted.ts): the language last picked on the phrase screen. */
export const PHRASE_LANG_KEY = 'satchel.phraseLang.v1';

export type PhraseLine = { text: string; roman?: string };
export type PhraseLanguage = { code: string; native: string; latin: boolean; countries: string[]; phrases: Record<string, PhraseLine> };
export type PhraseTable = { version: number; checked?: string; note?: string; phrases: { id: string; en: string }[]; languages: PhraseLanguage[] };

export const isPhraseId = (v: unknown): v is PhraseId => typeof v === 'string' && (PHRASE_IDS as readonly string[]).includes(v);
export const isPhraseLang = (v: unknown): v is PhraseLang => typeof v === 'string' && (PHRASE_LANGS as readonly string[]).includes(v);

/** First value of a route param (expo-router gives string | string[] | undefined). */
const first = (v: unknown): unknown => (Array.isArray(v) ? v[0] : v);
export const parseLangParam = (v: unknown): PhraseLang | null => {
  const s = first(v);
  return isPhraseLang(s) ? s : null;
};
export const parsePhraseParam = (v: unknown): PhraseId | null => {
  const s = first(v);
  return isPhraseId(s) ? s : null;
};

export function findLanguage(table: PhraseTable, code: string | null | undefined): PhraseLanguage | null {
  if (!code) return null;
  return table.languages.find((l) => l.code === code) ?? null;
}

/** The English source line for a phrase. */
export const phraseEnglish = (table: PhraseTable, id: PhraseId): string => table.phrases.find((p) => p.id === id)?.en ?? id;

export type PhraseCard = { id: PhraseId; lang: PhraseLang; english: string; text: string; roman: string | null; latin: boolean };

/** One card to show someone: English, the local text and (for non-Latin scripts) how to say it. Null when missing. */
export function phraseCard(table: PhraseTable, lang: PhraseLang, id: PhraseId): PhraseCard | null {
  const l = findLanguage(table, lang);
  const line = l?.phrases[id];
  if (!l || !line || !line.text.trim()) return null;
  return { id, lang, english: phraseEnglish(table, id), text: line.text, roman: l.latin ? null : line.roman?.trim() || null, latin: l.latin };
}

/** Every card for a language, in the bundled phrase order ("Where is the toilet?" first). */
export function phraseCards(table: PhraseTable, lang: PhraseLang): PhraseCard[] {
  const out: PhraseCard[] = [];
  for (const id of PHRASE_IDS) {
    const c = phraseCard(table, lang, id);
    if (c) out.push(c);
  }
  return out;
}

/** Language for a country code (ISO 3166-1 alpha-2), or null when we carry no phrases for it. */
export function languageForCountry(table: PhraseTable, iso2: string | null | undefined): PhraseLang | null {
  if (!iso2) return null;
  const code = iso2.trim().toUpperCase();
  const hit = table.languages.find((l) => l.countries.includes(code));
  return hit && isPhraseLang(hit.code) ? hit.code : null;
}

/**
 * The country the traveller is in or heading to, from their trips only (never location): the trip on now
 * (current / next booking), else the destination of the trip coming up next. Null when nothing maps.
 */
export function tripCountry(trips: Trip[], now: number, today: LocalDate): string | null {
  const guess = guessCountry(trips, now, today, null);
  if (guess?.from === 'trip') return guess.iso2;
  const focus = focusTrip(trips, today);
  return focus ? countryForZone(destinationZone(focus)) : null;
}

export type LangSource = 'trip' | 'last' | 'phone' | 'default';

/** Which language to open: trip country, then the last one used, then the phone's zone country, then Japanese. */
export function pickPhraseLang(
  table: PhraseTable,
  opts: { tripCountry?: string | null; lastUsed?: unknown; phoneCountry?: string | null },
): { lang: PhraseLang; from: LangSource } {
  const fromTrip = languageForCountry(table, opts.tripCountry);
  if (fromTrip) return { lang: fromTrip, from: 'trip' };
  if (isPhraseLang(opts.lastUsed) && findLanguage(table, opts.lastUsed)) return { lang: opts.lastUsed, from: 'last' };
  const fromPhone = languageForCountry(table, opts.phoneCountry);
  if (fromPhone) return { lang: fromPhone, from: 'phone' };
  return { lang: DEFAULT_PHRASE_LANG, from: 'default' };
}

/** Anything outside Latin letters (incl. Vietnamese), digits, spaces and common punctuation. */
const NON_LATIN = /[^\u0000-ɏḀ-ỿ -⁯]/u;
export const hasNonLatin = (s: string): boolean => NON_LATIN.test(s);

/** Content problems (empty list = good): every language has every phrase, non-empty, romanised when non-Latin. */
export function phraseProblems(table: PhraseTable): string[] {
  const out: string[] = [];
  const ids = table.phrases.map((p) => p.id);
  for (const id of PHRASE_IDS) if (!ids.includes(id)) out.push(`phrase ${id}: no English line`);
  for (const p of table.phrases) {
    if (!isPhraseId(p.id)) out.push(`phrase ${p.id}: unknown id`);
    if (!p.en?.trim()) out.push(`phrase ${p.id}: empty English`);
  }
  if (ids[0] !== 'toilet') out.push('the first phrase must be "toilet"');
  const codes = table.languages.map((l) => l.code);
  for (const code of PHRASE_LANGS) if (!codes.includes(code)) out.push(`language ${code}: missing`);
  const countries = new Map<string, string>();
  for (const l of table.languages) {
    if (!isPhraseLang(l.code)) out.push(`language ${l.code}: unknown code`);
    if (!l.native?.trim()) out.push(`language ${l.code}: no native name`);
    for (const c of l.countries) {
      if (!/^[A-Z]{2}$/.test(c)) out.push(`language ${l.code}: bad country ${c}`);
      const other = countries.get(c);
      if (other) out.push(`country ${c}: in both ${other} and ${l.code}`);
      countries.set(c, l.code);
    }
    for (const id of PHRASE_IDS) {
      const line = l.phrases[id];
      if (!line || !line.text?.trim()) {
        out.push(`${l.code} ${id}: missing`);
        continue;
      }
      if (l.latin && hasNonLatin(line.text)) out.push(`${l.code} ${id}: marked Latin but has other script`);
      if (!l.latin && !line.roman?.trim()) out.push(`${l.code} ${id}: no romanisation`);
      if (line.roman && hasNonLatin(line.roman)) out.push(`${l.code} ${id}: romanisation is not Latin`);
    }
    for (const id of Object.keys(l.phrases)) if (!isPhraseId(id)) out.push(`${l.code} ${id}: unknown phrase`);
  }
  return out;
}

/**
 * Base point size for the big local text on the full-screen card: shorter lines go bigger. Dynamic Type scales
 * it further (the card scrolls, so nothing is ever cut off).
 */
export function cardFontSize(text: string): number {
  const n = [...text.trim()].length;
  if (n <= 10) return 52;
  if (n <= 20) return 44;
  if (n <= 32) return 38;
  return 32;
}
