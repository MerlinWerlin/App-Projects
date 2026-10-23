// Seasonal and holiday collections (owner request 16 Oct 2026, R5): date-aware collections that
// surface around an event and hide afterwards, plus the meteorological season for the person's
// hemisphere. Pure date logic, no network, no time zones.
// Pure TS (no React Native / Expo) so Node can run and test it directly.
//
// DATE CONVENTION: every function takes a calendar day, either a `{ y, m, d }` (m = 1–12) or a
// JS Date, which is read with its LOCAL getFullYear/getMonth/getDate (the day on the person's
// phone). Nothing here reads UTC fields of a Date, so a phone in Sydney at 8am on 1 Dec is 1 Dec.

import type { Theme } from './themes.ts';

export type CalendarDay = { y: number; m: number; d: number };
export type DayInput = CalendarDay | Date;

export type Hemisphere = 'north' | 'south';
export type SeasonId = 'summer' | 'autumn' | 'winter' | 'spring';
export type EventId =
  | 'new-year'
  | 'lunar-new-year'
  | 'valentines'
  | 'easter'
  | 'ramadan'
  | 'eid-al-fitr'
  | 'diwali'
  | 'halloween'
  | 'christmas';
export type CollectionId = EventId | SeasonId;

export const EVENT_IDS: readonly EventId[] = Object.freeze([
  'new-year',
  'lunar-new-year',
  'valentines',
  'easter',
  'ramadan',
  'eid-al-fitr',
  'diwali',
  'halloween',
  'christmas',
]);
export const SEASON_IDS: readonly SeasonId[] = Object.freeze(['summer', 'autumn', 'winter', 'spring']);
export const COLLECTION_IDS: readonly CollectionId[] = Object.freeze([...EVENT_IDS, ...SEASON_IDS]);

// ------------------------------------------------------------ day arithmetic

/** Normalise a Date (local day) or {y,m,d} to a CalendarDay. */
export function toDay(input: DayInput): CalendarDay {
  if (input instanceof Date) return { y: input.getFullYear(), m: input.getMonth() + 1, d: input.getDate() };
  return { y: input.y, m: input.m, d: input.d };
}

/** Whole days since 1970-01-01 for a calendar day (UTC maths on plain numbers, no time zone). */
export function dayNumber(day: CalendarDay): number {
  return Math.round(Date.UTC(day.y, day.m - 1, day.d) / 86400000);
}

export function fromDayNumber(n: number): CalendarDay {
  const dt = new Date(n * 86400000);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

/** Parse 'YYYY-MM-DD'. */
export function parseDay(iso: string): CalendarDay {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`Bad date: ${iso}`);
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

export function formatDay(day: CalendarDay): string {
  return `${String(day.y).padStart(4, '0')}-${String(day.m).padStart(2, '0')}-${String(day.d).padStart(2, '0')}`;
}

// ------------------------------------------------------------ moving dates

/** Western (Gregorian) Easter Sunday: anonymous Gregorian algorithm (Meeus/Jones/Butcher). */
export function easterSunday(year: number): CalendarDay {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { y: year, m: month, d: day };
}

/** First and last years the moving-date table covers. */
export const LOOKUP_FIRST_YEAR = 2026;
export const LOOKUP_LAST_YEAR = 2031;

/** Western Easter Sunday (table; the test checks it against easterSunday()). */
export const EASTER: Readonly<Record<number, string>> = Object.freeze({
  2026: '2026-04-05',
  2027: '2027-03-28',
  2028: '2028-04-16',
  2029: '2029-04-01',
  2030: '2030-04-21',
  2031: '2031-04-13',
});

/** Lunar New Year's Day (first day of the first lunar month, China time). */
export const LUNAR_NEW_YEAR: Readonly<Record<number, string>> = Object.freeze({
  2026: '2026-02-17',
  2027: '2027-02-06',
  2028: '2028-01-26',
  2029: '2029-02-13',
  2030: '2030-02-03',
  2031: '2031-01-23',
});

/** Diwali (Lakshmi Puja day; varies by a day between regions). */
export const DIWALI: Readonly<Record<number, string>> = Object.freeze({
  2026: '2026-11-08',
  2027: '2027-10-29',
  2028: '2028-10-17',
  2029: '2029-11-05',
  2030: '2030-10-26',
  2031: '2031-11-14',
});

/**
 * Ramadan periods: approximate first day of fasting and the following Eid al-Fitr. Both depend on
 * moon sighting and can shift by a day locally. The Islamic year is ~11 days shorter than the
 * Gregorian one, so Ramadan begins twice in 2030 (January and December).
 * The last row's Eid (2032-01-14) is outside the table years but is needed to close the window.
 */
export const RAMADAN: readonly { start: string; eid: string }[] = Object.freeze([
  { start: '2026-02-18', eid: '2026-03-20' },
  { start: '2027-02-08', eid: '2027-03-10' },
  { start: '2028-01-28', eid: '2028-02-27' },
  { start: '2029-01-16', eid: '2029-02-15' },
  { start: '2030-01-06', eid: '2030-02-05' },
  { start: '2030-12-26', eid: '2031-01-25' },
  { start: '2031-12-15', eid: '2032-01-14' },
]);

// ------------------------------------------------------------ event windows

export type EventWindow = { id: EventId; start: CalendarDay; end: CalendarDay };

function makeWindow(id: EventId, start: number, end: number): EventWindow {
  return { id, start: fromDayNumber(start), end: fromDayNumber(end) };
}

function around(id: EventId, iso: string | undefined, before: number, after: number): EventWindow | null {
  if (!iso) return null;
  const n = dayNumber(parseDay(iso));
  return makeWindow(id, n - before, n + after);
}

/**
 * Every event window anchored to `year` (inclusive start and end days). New Year's window for
 * `year` runs from 27 Dec of the year before to 3 Jan. Moving events outside the lookup table are
 * left out, except Easter, which the algorithm computes for any year.
 */
export function eventWindows(year: number): EventWindow[] {
  const dn = (m: number, d: number, y: number = year) => dayNumber({ y, m, d });
  const out: (EventWindow | null)[] = [
    makeWindow('new-year', dn(12, 27, year - 1), dn(1, 3)),
    around('lunar-new-year', LUNAR_NEW_YEAR[year], 10, 15),
    makeWindow('valentines', dn(2, 1), dn(2, 15)),
    around('easter', EASTER[year] ?? formatDay(easterSunday(year)), 14, 1),
    ...RAMADAN.filter((r) => parseDay(r.start).y === year).flatMap((r) => {
      const eid = dayNumber(parseDay(r.eid));
      return [makeWindow('ramadan', dayNumber(parseDay(r.start)), eid - 2), makeWindow('eid-al-fitr', eid - 1, eid + 3)];
    }),
    around('diwali', DIWALI[year], 10, 3),
    makeWindow('halloween', dn(10, 10), dn(11, 1)),
    makeWindow('christmas', dn(12, 1), dn(12, 26)),
  ];
  return out.filter((w): w is EventWindow => w !== null);
}

/** Event windows that contain the day, ordered by when they opened (earliest first). */
export function activeEvents(input: DayInput): EventWindow[] {
  const day = toDay(input);
  const n = dayNumber(day);
  const seen = new Set<string>();
  const hits: EventWindow[] = [];
  // Windows anchored to neighbouring years can reach into this one (New Year, a December Ramadan).
  for (const y of [day.y - 1, day.y, day.y + 1]) {
    for (const w of eventWindows(y)) {
      if (n < dayNumber(w.start) || n > dayNumber(w.end)) continue;
      const key = `${w.id}:${formatDay(w.start)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      hits.push(w);
    }
  }
  return hits.sort((a, b) => dayNumber(a.start) - dayNumber(b.start));
}

// ------------------------------------------------------------ hemisphere and seasons

/**
 * ISO 3166 regions that are wholly or mostly in the southern hemisphere (temperate south where the
 * seasons matter, plus the larger southern tropics). Everything else, and unknown, is north.
 */
export const SOUTHERN_REGIONS: ReadonlySet<string> = new Set([
  'AU', 'NZ', 'ZA', 'AR', 'CL', 'UY', 'PY', 'BR', 'BO', 'PE',
  'LS', 'SZ', 'NA', 'BW', 'ZW', 'ZM', 'MZ', 'MW', 'MG', 'MU', 'RE', 'AO',
  'FJ', 'NC', 'PF', 'WS', 'TO', 'VU', 'CK', 'NF', 'FK',
]);

export function hemisphereOf(regionCode: string | null | undefined): Hemisphere {
  if (typeof regionCode !== 'string') return 'north';
  return SOUTHERN_REGIONS.has(regionCode.trim().toUpperCase()) ? 'south' : 'north';
}

/** Region from a BCP 47 tag ('en-AU' → 'AU', 'zh-Hans-CN' → 'CN', 'es-419' → null). */
export function regionFromLocaleTag(tag: string | null | undefined): string | null {
  if (typeof tag !== 'string') return null;
  for (const part of tag.replace(/_/g, '-').split('-').slice(1)) {
    if (/^[A-Za-z]{2}$/.test(part)) return part.toUpperCase();
  }
  return null;
}

/** Meteorological season: north spring Mar–May, summer Jun–Aug, autumn Sep–Nov, winter Dec–Feb; south opposite. */
export function seasonOf(input: DayInput, hemisphere: Hemisphere): SeasonId {
  const { m } = toDay(input);
  const north: SeasonId = m >= 3 && m <= 5 ? 'spring' : m >= 6 && m <= 8 ? 'summer' : m >= 9 && m <= 11 ? 'autumn' : 'winter';
  if (hemisphere === 'north') return north;
  const flip: Record<SeasonId, SeasonId> = { spring: 'autumn', summer: 'winter', autumn: 'spring', winter: 'summer' };
  return flip[north];
}

/**
 * Collections live on the day, in display order: events first (earliest-opened first), then the
 * current season for the region's hemisphere (`regionCode` null/unknown → north).
 */
export function activeCollections(input: DayInput, regionCode: string | null | undefined): CollectionId[] {
  const events = activeEvents(input).map((w) => w.id);
  const unique = [...new Set(events)];
  return [...unique, seasonOf(input, hemisphereOf(regionCode))];
}

// ------------------------------------------------------------ collection contents

/**
 * Curated theme ids per collection, best first. Theme ids not in the catalogue are skipped by
 * collectionThemes(), so this can name themes from packs that aren't installed.
 */
export const SEASONAL_COLLECTIONS: Readonly<Record<CollectionId, readonly string[]>> = Object.freeze({
  'new-year': ['celestial-night', 'candy-arcade', 'arcade-pink'],
  'lunar-new-year': ['lantern-row', 'copper-red', 'cherry-blossom'],
  valentines: ['romantic-lace', 'strawberry-dessert', 'rosehip'],
  easter: ['cloud-nine', 'cottage-garden', 'chamomile', 'pressed-violet'],
  ramadan: ['moon-phase', 'celestial-night', 'lantern-row'],
  'eid-al-fitr': ['celestial-night', 'lantern-row', 'moonflower'],
  diwali: ['marigold', 'lantern-row', 'sodium-glow'],
  halloween: ['pumpkin-patch', 'whimsy-forest', 'moonflower'],
  christmas: ['copper-red', 'eucalyptus', 'celestial-night', 'candy-arcade'],
  summer: ['seaside-shells', 'mango-stall', 'wildflower-meadow', 'strawberry-dessert'],
  autumn: ['pumpkin-patch', 'whimsy-forest', 'marigold', 'tenmoku'],
  winter: ['moon-phase', 'eucalyptus', 'noodle-steam', 'wet-asphalt'],
  spring: ['cherry-blossom', 'cottage-garden', 'pressed-violet', 'chamomile'],
});

export function isCollectionId(id: unknown): id is CollectionId {
  return typeof id === 'string' && (COLLECTION_IDS as readonly string[]).includes(id);
}

/**
 * Themes in a collection: the curated ids first (in order), then any other theme whose tags include
 * the collection id. EXTENSION POINT: new seasonal themes (e.g. src/core/themesNew.ts) join a
 * collection just by carrying its id as a tag, e.g. tags: ['christmas'].
 */
export function collectionThemes<T extends Theme>(id: CollectionId, allThemes: readonly T[]): T[] {
  const byId = new Map(allThemes.map((t) => [t.id, t] as const));
  const out: T[] = [];
  const seen = new Set<string>();
  for (const tid of SEASONAL_COLLECTIONS[id] ?? []) {
    const t = byId.get(tid);
    if (t && !seen.has(t.id)) {
      out.push(t);
      seen.add(t.id);
    }
  }
  for (const t of allThemes) {
    if (!seen.has(t.id) && (t.tags ?? []).includes(id)) {
      out.push(t);
      seen.add(t.id);
    }
  }
  return out;
}
