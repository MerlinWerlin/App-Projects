// T149 Travelling with kids (owner-1031 D, deepens Emergency + Packing + Trips). Per trip, the children travelling
// (first name and an age band only: baby / toddler / child / teen, never a birth date), and from them:
// - an "If I am lost" card to show a local or screenshot onto a child's phone: the parent's phone (own number typed
//   here, else the first emergency-card contact), the stay booked for that date and "Please call my parent" in the
//   language of the country the trip puts you in on that date (src/content/kids.json, native_check until a fluent
//   speaker has read it; the title, name and hotel labels are the help-card lines of src/content/helpcards.json);
// - extra packing rows by age band, merged into the trip's packing list (own rows kept, nothing doubled);
// - the traveller's own kid-friendly mark on Places to go ideas (never guessed) and a filter for it;
// - car-seat / stroller and snack / sleep reminders on journeys and hire cars, by journey length;
// - a Your day "Kids" line with the next long journey.
//
// Pure TypeScript, no RN imports. Stored on this phone only, one AsyncStorage key per trip (kidsKey); never on the
// Trip, so Plan this trip again and the every-field guard are untouched. Children's names go into a .satchel file
// only when the traveller turns "Include children in trip files" on (default off; guard test in kids.test.ts).
// Words come in through a `w` function or the catalogue keys below, so this file holds no UI text.
import { countryForZone } from './emergency.ts';
import type { HelpTable } from './helpcards.ts';
import { zoneAt } from './jetlag.ts';
import type { EmergencyCard, Item, LocalDate, Trip } from './model.ts';
import { hasLabel, normaliseLabel, sortByCategory, type PackItem, type PackList } from './packing.ts';
import { isPhraseLang, languageForCountry, type PhraseLang, type PhraseTable } from './phrases.ts';
import { dialable } from './staydetails.ts';
import { span, zonesReadable } from './timeline.ts';
import { localDate, toUtc } from './tz.ts';

const PREFIX = 'satchel.kids.v1.';

/** The phone-only storage key for one trip's kids data. */
export const kidsKey = (tripId: string): string => `${PREFIX}${tripId}`;
export const isKidsKey = (key: string): boolean => key.startsWith(PREFIX) && key.length > PREFIX.length;

// ------------------------------------------------------------------------------------------------- age bands

export const AGE_BANDS = ['baby', 'toddler', 'child', 'teen'] as const;
export type AgeBand = (typeof AGE_BANDS)[number];
export const isAgeBand = (v: unknown): v is AgeBand => typeof v === 'string' && (AGE_BANDS as readonly string[]).includes(v);

/** Ages each band covers, in whole years (inclusive). */
export const BAND_YEARS: Record<AgeBand, readonly [number, number]> = { baby: [0, 0], toddler: [1, 3], child: [4, 12], teen: [13, 17] };

/** The band for an age in whole years (only to help pick; no age is stored). Null for 18+ or a non-age. */
export function bandForAge(years: number): AgeBand | null {
  if (!Number.isFinite(years) || years < 0) return null;
  const y = Math.floor(years);
  return AGE_BANDS.find((b) => y >= BAND_YEARS[b][0] && y <= BAND_YEARS[b][1]) ?? null;
}

/** Babies and toddlers ride in a car seat and usually come with a stroller. */
const needsSeat = (b: AgeBand) => b === 'baby' || b === 'toddler';

// ------------------------------------------------------------------------------------------------- the record

export type Child = { id: string; name: string; band: AgeBand };

export type KidsData = {
  children: Child[];
  /** Who the lost card says to call, and their number, as typed. Empty: the first emergency-card contact. */
  parentName: string;
  parentPhone: string;
  /** Put the children's first names and bands in .satchel files made from this trip. Default off. */
  exportNames: boolean;
  /** Ideas (ids of trip.ideas) the traveller marked kid-friendly. */
  kidFriendly: string[];
};

export const LIMITS = { name: 30, parentName: 40, phone: 40, children: 12, marks: 1000 } as const;

export const EMPTY_KIDS: KidsData = Object.freeze({
  children: Object.freeze([]) as unknown as Child[],
  parentName: '',
  parentPhone: '',
  exportNames: false,
  kidFriendly: Object.freeze([]) as unknown as string[],
}) as KidsData;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const line = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

function cleanChild(v: unknown): Child | null {
  if (!isObj(v) || typeof v.id !== 'string' || !v.id) return null;
  const name = line(v.name, LIMITS.name);
  if (!name || !isAgeBand(v.band)) return null;
  return { id: v.id, name, band: v.band };
}

/** A stored value as KidsData; anything unreadable is left out, so a damaged entry can't crash a screen. */
export function cleanKids(raw: unknown): KidsData {
  if (!isObj(raw)) return EMPTY_KIDS;
  const seen = new Set<string>();
  const children: Child[] = [];
  for (const c of Array.isArray(raw.children) ? raw.children : []) {
    const ok = cleanChild(c);
    if (!ok || seen.has(ok.id) || children.length >= LIMITS.children) continue;
    seen.add(ok.id);
    children.push(ok);
  }
  const marks = Array.isArray(raw.kidFriendly) ? raw.kidFriendly.filter((x): x is string => typeof x === 'string' && !!x) : [];
  return {
    children,
    parentName: line(raw.parentName, LIMITS.parentName),
    parentPhone: line(raw.parentPhone, LIMITS.phone),
    exportNames: raw.exportNames === true,
    kidFriendly: [...new Set(marks)].slice(0, LIMITS.marks),
  };
}

export type ChildError = 'name' | 'full';
export type ChildResult = { ok: true; data: KidsData } | { ok: false; reason: ChildError };

/** Adds (or, with an existing id, updates) a child. First name only: trimmed to one short line. */
export function saveChild(data: KidsData, name: string, band: AgeBand, id: string): ChildResult {
  const clean = line(name, LIMITS.name);
  if (!clean) return { ok: false, reason: 'name' };
  const at = data.children.findIndex((c) => c.id === id);
  if (at < 0 && data.children.length >= LIMITS.children) return { ok: false, reason: 'full' };
  const child: Child = { id, name: clean, band };
  const children = at < 0 ? [...data.children, child] : data.children.map((c, i) => (i === at ? child : c));
  return { ok: true, data: { ...data, children } };
}

export const removeChild = (data: KidsData, id: string): KidsData => ({ ...data, children: data.children.filter((c) => c.id !== id) });

export function setParent(data: KidsData, name: string, phone: string): KidsData {
  return { ...data, parentName: line(name, LIMITS.parentName), parentPhone: line(phone, LIMITS.phone) };
}

export const setExportNames = (data: KidsData, on: boolean): KidsData => (data.exportNames === on ? data : { ...data, exportNames: on });

/** The bands travelling, each once, youngest first. */
export const bandsOf = (data: Pick<KidsData, 'children'>): AgeBand[] => AGE_BANDS.filter((b) => data.children.some((c) => c.band === b));

// ------------------------------------------------------------------------------------------------- kid-friendly

export const isKidFriendly = (data: Pick<KidsData, 'kidFriendly'>, ideaId: string): boolean => data.kidFriendly.includes(ideaId);

export function toggleKidFriendly(data: KidsData, ideaId: string): KidsData {
  if (!ideaId) return data;
  const on = isKidFriendly(data, ideaId);
  return { ...data, kidFriendly: on ? data.kidFriendly.filter((x) => x !== ideaId) : [...data.kidFriendly, ideaId].slice(-LIMITS.marks) };
}

/** Only the ideas the traveller marked (never a guess from a name or category). */
export function kidFriendlyOnly<T extends { id: string }>(ideas: readonly T[], data: Pick<KidsData, 'kidFriendly'>): T[] {
  const marks = new Set(data.kidFriendly);
  return ideas.filter((i) => marks.has(i.id));
}

/** How many of these ideas are marked (marks for ideas since removed are not counted). */
export const kidFriendlyCount = (ideas: readonly { id: string }[], data: Pick<KidsData, 'kidFriendly'>): number => kidFriendlyOnly(ideas, data).length;

// ------------------------------------------------------------------------------------------------- packing

/** Packing rows per band (labels are the catalogue's kids.pack.<id>). */
export const PACK_ROWS: Record<AgeBand, readonly string[]> = {
  baby: ['nappies', 'wipes', 'changeMat', 'bottles', 'babyFood', 'sling', 'babyClothes', 'blanket'],
  toddler: ['nappies', 'wipes', 'snacks', 'sippyCup', 'comfort', 'spareClothes', 'books'],
  child: ['snacks', 'waterBottle', 'activityBook', 'headphones', 'comfort', 'spareClothes'],
  teen: ['charger', 'headphones', 'waterBottle', 'idCopy'],
};
/** Rows for any child (the travelling-together basics). */
export const PACK_ALL: readonly string[] = ['kidsMeds', 'sunHat', 'plasters'];

export const PACK_SUGGESTION = 'kids:';
export const packSuggestionId = (row: string) => `${PACK_SUGGESTION}${row}`;

/** The rows for these bands, each once, in band order then the shared ones. Empty without children. */
export function packRowsFor(bands: readonly AgeBand[]): string[] {
  if (!bands.length) return [];
  const out: string[] = [];
  for (const b of AGE_BANDS) if (bands.includes(b)) for (const r of PACK_ROWS[b]) if (!out.includes(r)) out.push(r);
  for (const r of PACK_ALL) if (!out.includes(r)) out.push(r);
  return out;
}

/** True when the list already has this row: added before, dismissed, or an own row with the same label. */
export function hasKidsRow(list: PackList, row: string, label: string): boolean {
  const sid = packSuggestionId(row);
  if (list.items.some((i) => i.suggestionId === sid)) return true;
  if ((list.dismissed ?? []).includes(sid)) return true;
  return !!normaliseLabel(label) && hasLabel(list, label);
}

/** Rows the merge would add (for the button's count). */
export function missingKidsRows(list: PackList, bands: readonly AgeBand[], label: (row: string) => string): string[] {
  return packRowsFor(bands).filter((r) => !hasKidsRow(list, r, label(r)));
}

export type KidsMerge = { list: PackList; added: number };

/**
 * Adds the age-band rows the list doesn't have, unticked, under "For the kids". Every row already on the list (own,
 * template or suggestion, ticked or not) is kept exactly as it is, and a row is never added twice.
 */
export function mergeKidsPacking(list: PackList, bands: readonly AgeBand[], label: (row: string) => string, newId: (prefix: string) => string): KidsMerge {
  const rows = missingKidsRows(list, bands, label);
  if (!rows.length) return { list, added: 0 };
  const items: PackItem[] = [...list.items];
  let added = 0;
  for (const r of rows) {
    const text = label(r).trim().replace(/\s+/g, ' ');
    if (!normaliseLabel(text) || hasLabel({ ...list, items }, text)) continue;
    items.push({ id: newId('pack'), label: text, done: false, category: 'kids', suggestionId: packSuggestionId(r) });
    added++;
  }
  return added ? { list: { ...list, items: sortByCategory(items) }, added } : { list, added: 0 };
}

// ------------------------------------------------------------------------------------------------- journeys

export const JOURNEY_KINDS = ['flight', 'train', 'ferry', 'bus'] as const;
const isJourney = (i: Item) => (JOURNEY_KINDS as readonly string[]).includes(i.kind);

/** Under 90 minutes is short; 90 minutes to 4 hours medium; 4 hours or more long. */
export const MEDIUM_MIN = 90;
export const LONG_MIN = 240;
/** The Your day row looks at journeys of 2 hours or more. */
export const BRIEF_MIN = 120;
/** ... starting within this many hours. */
export const BRIEF_AHEAD_H = 24;

export type JourneyLength = 'short' | 'medium' | 'long';
export const journeyLength = (min: number): JourneyLength => (min >= LONG_MIN ? 'long' : min >= MEDIUM_MIN ? 'medium' : 'short');

/** Minutes from departure to arrival (real instants, across zones); null without a readable end. */
export function journeyMinutes(item: Item): number | null {
  if (!item.end || !zonesReadable(item)) return null;
  const s = span(item);
  const m = Math.round((s.end - s.start) / 60000);
  return Number.isFinite(m) && m > 0 ? m : null;
}

export const REMINDERS = ['carSeat', 'booster', 'seatCheck', 'strollerGate', 'stroller', 'snacks', 'sleep', 'play'] as const;
export type Reminder = (typeof REMINDERS)[number];

/**
 * Reminders for one booking with these bands travelling:
 *   hire car   car seat (baby / toddler), booster (child), check it is fitted (either); nothing for teens only
 *   journey    stroller (baby / toddler; gate-check it on a flight), snacks from 90 min, sleep and something to
 *              do from 4 h. A short hop gets only the stroller line.
 */
export function journeyReminders(item: Item, bands: readonly AgeBand[]): Reminder[] {
  if (!bands.length) return [];
  const out: Reminder[] = [];
  const small = bands.some(needsSeat);
  if (item.kind === 'car') {
    if (small) out.push('carSeat');
    if (bands.includes('child')) out.push('booster');
    if (small || bands.includes('child')) out.push('seatCheck');
    return out;
  }
  if (!isJourney(item)) return out;
  if (small) out.push(item.kind === 'flight' ? 'strollerGate' : 'stroller');
  const min = journeyMinutes(item);
  const len = min == null ? 'short' : journeyLength(min);
  if (len !== 'short') out.push('snacks');
  if (len === 'long') out.push('sleep', 'play');
  return out;
}

export type TripReminder = { item: Item; minutes: number | null; reminders: Reminder[] };

/** Journeys and hire cars not yet started (or under way), in time order, with their reminders. */
export function tripReminders(trip: Pick<Trip, 'items'>, data: Pick<KidsData, 'children'>, now: number): TripReminder[] {
  const bands = bandsOf(data);
  if (!bands.length) return [];
  return trip.items
    .filter((i) => (isJourney(i) || i.kind === 'car') && zonesReadable(i) && span(i).end > now)
    .sort((a, b) => span(a).start - span(b).start)
    .map((item) => ({ item, minutes: journeyMinutes(item), reminders: journeyReminders(item, bands) }))
    .filter((r) => r.reminders.length > 0);
}

export type KidsBrief = { item: Item; minutes: number; snack: boolean; sleep: boolean };

/**
 * Your day "Kids": the next journey of 2 h or more leaving within 24 h, with a snack reminder and a sleep one when
 * it is long (4 h+) or leaves at nap or bed time (12:00-14:59 or 19:00-05:59 on the departure clock). Null without
 * children or such a journey.
 */
export function kidsBrief(trip: Pick<Trip, 'items'>, data: Pick<KidsData, 'children'>, now: number): KidsBrief | null {
  if (!data.children.length) return null;
  let best: KidsBrief | null = null;
  let bestStart = Infinity;
  for (const item of trip.items) {
    if (!isJourney(item)) continue;
    const min = journeyMinutes(item);
    if (min == null || min < BRIEF_MIN) continue;
    const start = span(item).start;
    if (start < now || start > now + BRIEF_AHEAD_H * 3600_000 || start >= bestStart) continue;
    const hour = Number(item.start.local.slice(11, 13));
    const napOrBed = (hour >= 12 && hour < 15) || hour >= 19 || hour < 6;
    best = { item, minutes: min, snack: true, sleep: min >= LONG_MIN || napOrBed };
    bestStart = start;
  }
  return best;
}

// ------------------------------------------------------------------------------------------------- lost card

export type KidsLine = { text: string; native_check?: boolean };
export type KidsTable = { version: number; checked?: string; note?: string; sentences: { id: string; en: string }[]; languages: { code: string; lines: Record<string, KidsLine> }[] };
export const KIDS_LINE_IDS = ['callParent', 'labelParent'] as const;
export type KidsLineId = (typeof KIDS_LINE_IDS)[number];

/** The stay booked for the night of `date`: checked in on or before it and out after it (else the one checked into that day). */
export function stayOn(trip: Pick<Trip, 'items'>, date: LocalDate): Item | null {
  let pick: Item | null = null;
  for (const i of trip.items) {
    if (i.kind !== 'hotel' || !i.end || !zonesReadable(i)) continue;
    const a = localDate(i.start.local);
    const b = localDate(i.end.local);
    if (a <= date && date < b) {
      // Overlapping stays: the later check-in is where you sleep.
      if (!pick || i.start.local > pick.start.local) pick = i;
    }
  }
  return pick;
}

/** The country the trip puts you in on `date`: the stay's country, else where the bookings have you at noon. */
export function countryOn(trip: Pick<Trip, 'items' | 'homeTz'>, date: LocalDate): string | null {
  const stay = stayOn(trip, date);
  if (stay) return countryForZone(stay.start.tz);
  const noon = toUtc({ local: `${date}T12:00`, tz: trip.homeTz });
  return countryForZone(zoneAt(trip, noon));
}

/** One line of the card: local text first (what a local reads), English under it; `check` until a fluent speaker read it. */
export type CardLine = { en: string; local: string; lang: PhraseLang | null; check: boolean };
export type LostRow = { label: CardLine; value: string; dial?: string };
export type LostKidCard = {
  date: LocalDate;
  iso2: string | null;
  lang: PhraseLang | null;
  title: CardLine;
  ask: CardLine;
  rows: LostRow[];
  /** Some line on the card has not been checked by a fluent speaker yet. */
  unchecked: boolean;
  /** No phone to call: the card says so and links to where to add one. */
  noPhone: boolean;
  /** A stay is booked for that night (its row is on the card). */
  hasStay: boolean;
};

function helpLineOf(help: HelpTable, lang: PhraseLang | null, id: string): CardLine {
  const en = help.sentences.find((s) => s.id === id)?.en ?? id;
  const hit = lang ? help.languages.find((l) => l.code === lang)?.lines[id] : undefined;
  const local = hit?.text?.trim() || en;
  return { en, local, lang: hit ? lang : null, check: !!hit && hit.check === true };
}

function kidsLineOf(table: KidsTable, lang: PhraseLang | null, id: KidsLineId): CardLine {
  const en = table.sentences.find((s) => s.id === id)?.en ?? id;
  const hit = lang ? table.languages.find((l) => l.code === lang)?.lines[id] : undefined;
  const local = hit?.text?.trim() || en;
  return { en, local, lang: hit ? lang : null, check: !!hit && hit.native_check !== false };
}

export type LostInput = {
  trip: Pick<Trip, 'items' | 'homeTz'>;
  date: LocalDate;
  child: Child;
  data: Pick<KidsData, 'parentName' | 'parentPhone'>;
  card?: Pick<EmergencyCard, 'contacts'> | null;
  phrases: PhraseTable;
  help: HelpTable;
  table: KidsTable;
};

/** Who to call: the number typed here, else the first emergency-card contact with a number. */
export function parentToCall(data: Pick<KidsData, 'parentName' | 'parentPhone'>, card?: Pick<EmergencyCard, 'contacts'> | null): { name: string; phone: string } | null {
  if (dialable(data.parentPhone)) return { name: data.parentName, phone: data.parentPhone };
  const c = (card?.contacts ?? []).find((x) => x && typeof x.phone === 'string' && dialable(x.phone));
  return c ? { name: line(c.name, LIMITS.parentName), phone: line(c.phone, LIMITS.phone) } : null;
}

/** The "If I am lost" card for one child on one date, in the language of that date's country (English when we carry none). */
export function lostKidCard(input: LostInput): LostKidCard {
  const { trip, date, child, help, table } = input;
  const iso2 = countryOn(trip, date);
  const found = languageForCountry(input.phrases, iso2);
  const lang = found && isPhraseLang(found) ? found : null;
  const title = helpLineOf(help, lang, 'lostTitle');
  const ask = kidsLineOf(table, lang, 'callParent');
  const rows: LostRow[] = [{ label: helpLineOf(help, lang, 'labelName'), value: child.name }];
  const parent = parentToCall(input.data, input.card);
  if (parent) {
    const d = dialable(parent.phone);
    const value = [parent.name, parent.phone].filter(Boolean).join('\n');
    rows.push(d ? { label: kidsLineOf(table, lang, 'labelParent'), value, dial: d } : { label: kidsLineOf(table, lang, 'labelParent'), value });
  }
  const stay = stayOn(trip, date);
  if (stay) {
    const p = stay.place;
    const name = p?.name?.trim() || stay.title.trim();
    const local = p?.localAddress?.trim() ?? '';
    const addr = p?.address?.trim() ?? '';
    const value = [name, local, addr !== local ? addr : '', p?.phone?.trim() ?? ''].filter(Boolean).join('\n');
    rows.push({ label: helpLineOf(help, lang, 'labelHotel'), value });
  }
  const unchecked = [title, ask, ...rows.map((r) => r.label)].some((l) => l.check);
  return { date, iso2, lang, title, ask, rows, unchecked, noPhone: !parent, hasStay: !!stay };
}

/** The card as plain text (Share), local lines first. */
export function lostCardText(card: LostKidCard): string {
  const both = (l: CardLine) => (l.local === l.en ? l.en : `${l.local}\n${l.en}`);
  return [both(card.title), ...card.rows.map((r) => `${both(r.label)}\n${r.value}`), both(card.ask)].join('\n\n');
}

// ------------------------------------------------------------------------------------------------- trip files

/** What a .satchel file carries about the children: first names and bands, only when the traveller turned it on. */
export type FileKids = { children: { name: string; band: AgeBand }[] };

/** The block for a trip file, or undefined (the default: names stay on this phone). */
export function kidsForFile(data: KidsData | null | undefined): FileKids | undefined {
  if (!data || data.exportNames !== true || !data.children.length) return undefined;
  return { children: data.children.map((c) => ({ name: c.name, band: c.band })) };
}

/** A file's kids block, cleaned; undefined when absent or unreadable (never refuses the file). */
export function readFileKids(raw: unknown): FileKids | undefined {
  if (!isObj(raw) || !Array.isArray(raw.children)) return undefined;
  const children = raw.children
    .map((c) => (isObj(c) && isAgeBand(c.band) && line(c.name, LIMITS.name) ? { name: line(c.name, LIMITS.name), band: c.band } : null))
    .filter((c): c is { name: string; band: AgeBand } => c !== null)
    .slice(0, LIMITS.children);
  return children.length ? { children } : undefined;
}

/** The imported trip's kids data: new ids, and the export switch back off on this phone. */
export function importKids(file: FileKids | undefined, newId: (prefix: string) => string): KidsData | null {
  if (!file?.children.length) return null;
  return { ...EMPTY_KIDS, children: file.children.map((c) => ({ id: newId('kid'), name: c.name, band: c.band })), kidFriendly: [] };
}
