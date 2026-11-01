// T132 Getting around. Pure TypeScript (no React Native); the guide table (src/content/getaround.json) is passed in.
//
// Per country, checked for one main city or area: how public transport works, transit card / ticket names as the
// official operators write them, whether you can tap a contactless bank card (yes / some / null), typical hours,
// taxis, app-based rides (generic only: 'available' or null, never a brand), and airport-to-city options in general
// terms. No fares or prices. Every row lists the official https pages it was written from with a checked date;
// rows with gaps carry recheck: true and a reason. Countries the build could not source are listed in not_covered.
//
// Helpers: lookup (findGetaround), the trip's covered countries in trip order, the screen's section order (known
// first, unsure last), short summary lines for entry cards, the phrase-card hook (station / address phrases in the
// country's language), a search over covered countries, and rowProblems for the content test.
import { tripCountries } from './arrival.ts';
import { fold, urlHost } from './emergency.ts';
import type { Trip } from './model.ts';

export const GETAROUND_CHECKED = '2026-11-01';

export const CONTACTLESS = ['yes', 'some', 'no'] as const;
export type Contactless = (typeof CONTACTLESS)[number];
export const RIDES = ['available'] as const;
export type Rides = (typeof RIDES)[number];

/** Screen order. tickets is a list, contactless an answer + note, rides a flag; the rest are text. */
export const SECTION_ORDER = ['transit', 'tickets', 'contactless', 'hours', 'taxi', 'rides', 'airport'] as const;
export type SectionId = (typeof SECTION_ORDER)[number];
export const TEXT_SECTIONS = ['transit', 'hours', 'taxi', 'airport'] as const;
export type TextSection = (typeof TEXT_SECTIONS)[number];
/** Sections a row needs from its sources to be shown without a re-check marker. */
export const CORE_SECTIONS = ['transit', 'tickets', 'contactless', 'taxi', 'airport'] as const;

/** Phrase cards (src/content/phrases.json ids) the screen links for "useful words". */
export const USEFUL_PHRASES = ['station', 'address'] as const;
export type UsefulPhrase = (typeof USEFUL_PHRASES)[number];

export const MAX_TICKETS = 6;

export type GetaroundRow = {
  iso2: string;
  country: string;
  /** The main city or area the row was checked for ("Sydney"). */
  area: string;
  transit: string | null;
  tickets: string[] | null;
  contactless: Contactless | null;
  contactless_note: string | null;
  hours: string | null;
  taxi: string | null;
  rides: Rides | null;
  airport: string | null;
  sources: string[];
  /** ISO YYYY-MM-DD. */
  checked: string;
  recheck: boolean;
  recheck_reason: string | null;
};

export type NotCovered = { iso2: string; country: string; reason: string };

export type GetaroundTable = { version: number; checked?: string; rule: string; countries: GetaroundRow[]; not_covered?: NotCovered[] };

const ISO2 = /^[A-Z]{2}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const norm = (iso2: string | null | undefined) => (typeof iso2 === 'string' ? iso2.trim().toUpperCase() : '');
const clean = (s: unknown): string | null => (typeof s === 'string' && s.trim() ? s.trim() : null);

export function findGetaround(table: GetaroundTable, iso2: string | null | undefined): GetaroundRow | null {
  const code = norm(iso2);
  if (!ISO2.test(code)) return null;
  return table.countries.find((r) => r.iso2 === code) ?? null;
}

export const hasGetaround = (table: GetaroundTable, iso2: string | null | undefined): boolean => findGetaround(table, iso2) !== null;

/** The not-covered entry for a country the guide lists as not yet covered, else null. */
export function notCoveredEntry(table: GetaroundTable, iso2: string | null | undefined): NotCovered | null {
  const code = norm(iso2);
  if (!ISO2.test(code)) return null;
  return (table.not_covered ?? []).find((r) => r.iso2 === code) ?? null;
}

/** The first candidate with a row, or null. */
export function pickGetaroundCountry(table: GetaroundTable, candidates: readonly (string | null | undefined)[]): string | null {
  for (const c of candidates) {
    const row = findGetaround(table, c);
    if (row) return row.iso2;
  }
  return null;
}

/** The trip's countries (arrival.ts order: as the bookings reach them, home left out) that have a row. */
export function tripGetaroundCountries(trip: Pick<Trip, 'items'>, home: string | null, table: GetaroundTable): GetaroundRow[] {
  const out: GetaroundRow[] = [];
  for (const c of tripCountries(trip, home)) {
    const row = findGetaround(table, c.iso2);
    if (row && !out.includes(row)) out.push(row);
  }
  return out;
}

// ------------------------------------------------------------------ sections

export type Section =
  | { id: TextSection; known: true; text: string }
  | { id: 'tickets'; known: true; names: string[] }
  | { id: 'contactless'; known: true; answer: Contactless; note: string | null }
  | { id: 'rides'; known: true }
  | { id: SectionId; known: false };

const ticketsOf = (row: GetaroundRow): string[] =>
  Array.isArray(row.tickets) ? row.tickets.map(clean).filter((x): x is string => !!x).slice(0, MAX_TICKETS) : [];

function sectionOf(row: GetaroundRow, id: SectionId): Section {
  if (id === 'tickets') {
    const names = ticketsOf(row);
    return names.length ? { id, known: true, names } : { id, known: false };
  }
  if (id === 'contactless') {
    const a = (CONTACTLESS as readonly string[]).includes(row.contactless as string) ? (row.contactless as Contactless) : null;
    return a ? { id, known: true, answer: a, note: clean(row.contactless_note) } : { id, known: false };
  }
  if (id === 'rides') return row.rides === 'available' ? { id, known: true } : { id, known: false };
  const text = clean(row[id]);
  return text ? { id, known: true, text } : { id, known: false };
}

/** Every section in SECTION_ORDER, the ones not on the pages read (null) moved to the end and still listed. */
export function sectionsFor(row: GetaroundRow): Section[] {
  const all = SECTION_ORDER.map((id) => sectionOf(row, id));
  return [...all.filter((s) => s.known), ...all.filter((s) => !s.known)];
}

// ------------------------------------------------------------------ summary lines

/**
 * Up to `max` short lines for an entry card, in a fixed order: the card / ticket names, the contactless answer, and
 * whether app-based rides are available. The screen turns each into words from the catalogue.
 */
export type SummaryLine = { id: 'tickets'; names: string[] } | { id: 'contactless'; answer: Contactless } | { id: 'rides' };

export function summaryLines(row: GetaroundRow, max = 2): SummaryLine[] {
  const out: SummaryLine[] = [];
  const names = ticketsOf(row).slice(0, 3);
  if (names.length) out.push({ id: 'tickets', names });
  const s = sectionOf(row, 'contactless');
  if (s.known && 'answer' in s) out.push({ id: 'contactless', answer: s.answer });
  if (row.rides === 'available') out.push({ id: 'rides' });
  return out.slice(0, Math.max(0, max));
}

/** Source hosts for the footer ("tfl.gov.uk, visitlondon.com"), deduplicated, in the row's order. */
export function sourceHosts(row: Pick<GetaroundRow, 'sources'>): string[] {
  const out: string[] = [];
  for (const u of row.sources ?? []) {
    const h = urlHost(u);
    if (h && !out.includes(h)) out.push(h);
  }
  return out;
}

// ------------------------------------------------------------------ search

/** Covered countries matching a search, best first (ISO code, name start, word start, contains); empty = A-Z. */
export function searchGetaround(table: GetaroundTable, query: string): GetaroundRow[] {
  const q = fold(query);
  const byName = [...table.countries].sort((a, b) => (a.country < b.country ? -1 : a.country > b.country ? 1 : 0));
  if (!q) return byName;
  const rank = (r: GetaroundRow): number => {
    const name = fold(r.country);
    if (q.length === 2 && r.iso2.toLowerCase() === q) return 0;
    if (name.startsWith(q)) return 1;
    if (name.split(/[\s\-'(),.]+/).some((w) => w.startsWith(q))) return 2;
    if (name.includes(q) || fold(r.area).includes(q)) return 3;
    return -1;
  };
  return byName
    .map((r) => ({ r, k: rank(r) }))
    .filter((x) => x.k >= 0)
    .sort((a, b) => a.k - b.k)
    .map((x) => x.r);
}

// ------------------------------------------------------------------ checks (content test)

/** Everything wrong with a row; empty means it may be shown. */
export function rowProblems(row: GetaroundRow): string[] {
  const out: string[] = [];
  const r = row as unknown as Record<string, unknown>;
  if (!ISO2.test(String(row.iso2))) out.push('iso2');
  if (!clean(row.country)) out.push('country');
  if (!clean(row.area)) out.push('area');
  for (const id of [...TEXT_SECTIONS, 'contactless_note', 'recheck_reason'] as const) {
    if (!(id in r)) out.push(`${id}-missing`);
    else if (r[id] !== null && !clean(r[id])) out.push(id);
  }
  if (!('tickets' in r)) out.push('tickets-missing');
  else if (row.tickets !== null && (!Array.isArray(row.tickets) || !row.tickets.length || row.tickets.length > MAX_TICKETS || !row.tickets.every((x) => !!clean(x)))) out.push('tickets');
  if (!('contactless' in r)) out.push('contactless-missing');
  else if (row.contactless !== null && !(CONTACTLESS as readonly string[]).includes(row.contactless)) out.push('contactless');
  if (row.contactless === null && row.contactless_note !== null) out.push('contactless_note-without-answer');
  if (!('rides' in r)) out.push('rides-missing');
  else if (row.rides !== null && !(RIDES as readonly string[]).includes(row.rides)) out.push('rides');
  if (!Array.isArray(row.sources) || !row.sources.length || !row.sources.every((u) => /^https:\/\//.test(u) && urlHost(u) !== null)) out.push('sources');
  if (!ISO_DATE.test(String(row.checked))) out.push('checked');
  if (typeof row.recheck !== 'boolean') out.push('recheck');
  else if (row.recheck && !clean(row.recheck_reason)) out.push('recheck_reason');
  else if (!row.recheck && row.recheck_reason !== null) out.push('recheck_reason-without-recheck');
  // A row missing a core section (hours and rides are often not published) must be marked for a re-check.
  if (!row.recheck && sectionsFor(row).some((s) => !s.known && (CORE_SECTIONS as readonly string[]).includes(s.id))) out.push('gaps-without-recheck');
  return out;
}
