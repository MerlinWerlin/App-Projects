// T115 Local customs guide. Pure TypeScript (no React Native); the table (src/content/customs.json) is passed in.
//
// Per country: greetings, shoes off indoors, dress at religious sites, photography limits, gestures to avoid, public
// behaviour, alcohol / smoking in public (general terms), tap water (yes / no / varies, with a short note) and 2-4
// "good to know" lines. GENERAL GUIDANCE ONLY: written by the build from well-known public pages on the row's
// checked date, never legal advice, always shown with "verify locally". A null section means the build was not
// sure; the screen says so instead of leaving a gap. Rows with recheck: true are the least certain and are marked.
//
// Helpers: lookup (findCustoms), the screen's section order (known sections in a fixed order, unsure ones last),
// the trip's countries that have a customs row (for the switcher and the readiness / arrival links), a search over
// the covered countries, and rowProblems for the content test.
import { tripCountries } from './arrival.ts';
import { fold, urlHost } from './emergency.ts';
import type { Trip } from './model.ts';

export const CUSTOMS_CHECKED = '2026-11-01';

/** Text sections, in screen order. Water and good_to_know are special (an answer + note, and a list). */
export const SECTION_ORDER = ['greetings', 'water', 'shoes', 'dress', 'photos', 'gestures', 'public', 'alcohol', 'good_to_know'] as const;
export type SectionId = (typeof SECTION_ORDER)[number];
export const TEXT_SECTIONS = ['greetings', 'shoes', 'dress', 'photos', 'gestures', 'public', 'alcohol'] as const;
export type TextSection = (typeof TEXT_SECTIONS)[number];

export const WATER = ['yes', 'no', 'varies'] as const;
export type Water = (typeof WATER)[number];

export const GOOD_TO_KNOW = { min: 2, max: 4 } as const;

export type CustomsRow = {
  iso2: string;
  country: string;
  greetings: string | null;
  shoes: string | null;
  dress: string | null;
  photos: string | null;
  gestures: string | null;
  public: string | null;
  alcohol: string | null;
  /** Is the tap water usually drinkable? Null when not sure. */
  water: Water | null;
  water_note: string | null;
  /** 2-4 short lines, or null when not sure. */
  good_to_know: string[] | null;
  /** https pages the row was written from. */
  sources: string[];
  /** ISO YYYY-MM-DD. */
  checked: string;
  recheck: boolean;
};

export type CustomsTable = { version: number; checked?: string; rule: string; sections?: string[]; countries: CustomsRow[] };

const ISO2 = /^[A-Z]{2}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const norm = (iso2: string | null | undefined) => (typeof iso2 === 'string' ? iso2.trim().toUpperCase() : '');

export function findCustoms(table: CustomsTable, iso2: string | null | undefined): CustomsRow | null {
  const code = norm(iso2);
  if (!ISO2.test(code)) return null;
  return table.countries.find((r) => r.iso2 === code) ?? null;
}

export const hasCustoms = (table: CustomsTable, iso2: string | null | undefined): boolean => findCustoms(table, iso2) !== null;

/** The first candidate with a customs row (passed in, where the trip is, home...), or null. */
export function pickCustomsCountry(table: CustomsTable, candidates: readonly (string | null | undefined)[]): string | null {
  for (const c of candidates) {
    const row = findCustoms(table, c);
    if (row) return row.iso2;
  }
  return null;
}

// ------------------------------------------------------------------ sections

export type Section =
  | { id: TextSection; known: true; text: string }
  | { id: 'water'; known: true; water: Water; note: string | null }
  | { id: 'good_to_know'; known: true; lines: string[] }
  | { id: SectionId; known: false };

const clean = (s: unknown): string | null => (typeof s === 'string' && s.trim() ? s.trim() : null);

function sectionOf(row: CustomsRow, id: SectionId): Section {
  if (id === 'water') {
    const w = (WATER as readonly string[]).includes(row.water as string) ? (row.water as Water) : null;
    return w ? { id, known: true, water: w, note: clean(row.water_note) } : { id, known: false };
  }
  if (id === 'good_to_know') {
    const lines = Array.isArray(row.good_to_know) ? row.good_to_know.map(clean).filter((x): x is string => !!x) : [];
    return lines.length ? { id, known: true, lines: lines.slice(0, GOOD_TO_KNOW.max) } : { id, known: false };
  }
  const text = clean(row[id]);
  return text ? { id, known: true, text } : { id, known: false };
}

/**
 * Every section of the row, in SECTION_ORDER, with the ones the build was not sure about (null) moved to the end
 * (still listed, so the screen can say "Not sure - check locally" rather than hide them).
 */
export function sectionsFor(row: CustomsRow): Section[] {
  const all = SECTION_ORDER.map((id) => sectionOf(row, id));
  return [...all.filter((s) => s.known), ...all.filter((s) => !s.known)];
}

/** Source hosts for the footer ("gov.uk, japan.travel"), deduplicated, in the row's order. */
export function sourceHosts(row: Pick<CustomsRow, 'sources'>): string[] {
  const out: string[] = [];
  for (const u of row.sources ?? []) {
    const h = urlHost(u);
    if (h && !out.includes(h)) out.push(h);
  }
  return out;
}

// ------------------------------------------------------------------ countries

/** The trip's countries (arrival.ts order: as the bookings reach them, home left out) that have a customs row. */
export function tripCustomsCountries(trip: Pick<Trip, 'items'>, home: string | null, table: CustomsTable): CustomsRow[] {
  const out: CustomsRow[] = [];
  for (const c of tripCountries(trip, home)) {
    const row = findCustoms(table, c.iso2);
    if (row && !out.includes(row)) out.push(row);
  }
  return out;
}

/**
 * Covered countries matching a search, best first: exact ISO code, then name starts with the query, then a word
 * starts with it, then the name contains it. An empty query lists every country A-Z.
 */
export function searchCustoms(table: CustomsTable, query: string): CustomsRow[] {
  const q = fold(query);
  const byName = [...table.countries].sort((a, b) => (a.country < b.country ? -1 : a.country > b.country ? 1 : 0));
  if (!q) return byName;
  const rank = (r: CustomsRow): number => {
    const name = fold(r.country);
    if (q.length === 2 && r.iso2.toLowerCase() === q) return 0;
    if (name.startsWith(q)) return 1;
    if (name.split(/[\s\-'(),.]+/).some((w) => w.startsWith(q))) return 2;
    if (name.includes(q)) return 3;
    return -1;
  };
  return byName
    .map((r) => ({ r, k: rank(r) }))
    .filter((x) => x.k >= 0)
    .sort((a, b) => a.k - b.k)
    .map((x) => x.r);
}

// ------------------------------------------------------------------ checks (content test and any future import)

/** Everything wrong with a row; empty means it may be shown. */
export function rowProblems(row: CustomsRow): string[] {
  const out: string[] = [];
  const r = row as unknown as Record<string, unknown>;
  if (!ISO2.test(String(row.iso2))) out.push('iso2');
  if (!clean(row.country)) out.push('country');
  for (const id of TEXT_SECTIONS) {
    if (!(id in r)) out.push(`${id}-missing`);
    else if (r[id] !== null && !clean(r[id])) out.push(id);
  }
  if (!('water' in r)) out.push('water-missing');
  else if (row.water !== null && !(WATER as readonly string[]).includes(row.water)) out.push('water');
  if (!('water_note' in r)) out.push('water_note-missing');
  else if (row.water_note !== null && !clean(row.water_note)) out.push('water_note');
  if (!('good_to_know' in r)) out.push('good_to_know-missing');
  else if (row.good_to_know !== null) {
    const g = row.good_to_know;
    if (!Array.isArray(g) || g.length < GOOD_TO_KNOW.min || g.length > GOOD_TO_KNOW.max || !g.every((x) => !!clean(x))) out.push('good_to_know');
  }
  if (!Array.isArray(row.sources) || !row.sources.length || !row.sources.every((u) => urlHost(u) !== null)) out.push('sources');
  if (!ISO_DATE.test(String(row.checked))) out.push('checked');
  if (typeof row.recheck !== 'boolean') out.push('recheck');
  return out;
}
