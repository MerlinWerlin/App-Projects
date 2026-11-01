// T127 Lost-bag kit (owner-1031 D, deepens Packing + When things go wrong). Per bag of a trip's packing list: a
// description card (type, colour, size, material, distinctive marks, bag-tag number, a photo of the outside and one
// of the contents, a contents list with rough values in their own currency) and a "My bag didn't arrive" report: the
// flight from the trip, the description, the total declared value per currency, the file reference the desk gives,
// where to deliver the bag (the stay you're in) and a dated follow-up log, shareable as plain text.
//
// Pure TypeScript, no RN imports. Stored on this phone only, one AsyncStorage key per trip + bag (lostBagKey); never
// on the Trip or the packing list and never in a .satchel trip file (guard test in lostbag.test.ts). Money is integer
// minor units of its own currency (spending.ts currencyDigits), totals never mix currencies. Words come in through a
// `w` function (the UI passes the lostbag.* catalogue), so this file holds no UI text.
import type { Item, LocalDate, Place, Trip } from './model.ts';
import { formatMoney, isCurrency, minorToText, parseAmount } from './spending.ts';
import { span, zonesReadable } from './timeline.ts';
import { localDate } from './tz.ts';

const PREFIX = 'satchel.lostbag.v1.';

/** The phone-only storage key for one bag of one trip (bag ids are local to a trip's packing list). */
export const lostBagKey = (tripId: string, bagId: string): string => `${PREFIX}${tripId}.${bagId}`;
/** True for a key written by this module. */
export const isLostBagKey = (key: string): boolean => key.startsWith(PREFIX) && key.length > PREFIX.length;
/** True for a key of this trip's bags (to clean up when the trip goes). */
export const isLostBagKeyOf = (key: string, tripId: string): boolean => !!tripId && key.startsWith(`${PREFIX}${tripId}.`);

export const BAG_TYPES = ['suitcase', 'backpack', 'duffel', 'garment', 'box', 'sports', 'other'] as const;
export type BagType = (typeof BAG_TYPES)[number];
export const BAG_SIZES = ['small', 'medium', 'large'] as const;
export type BagSize = (typeof BAG_SIZES)[number];
export const BAG_MATERIALS = ['hard', 'fabric', 'leather', 'other'] as const;
export type BagMaterial = (typeof BAG_MATERIALS)[number];
export const PHOTO_SLOTS = ['outside', 'contents'] as const;
export type PhotoSlot = (typeof PHOTO_SLOTS)[number];

export type LostBagPhoto = { uri: string; mime: string; takenAt: string };
/** One thing in the bag, with a rough value in minor units of its currency (null: no value typed). */
export type ContentRow = { id: string; label: string; value: number | null; currency: string };
export type LogEntry = { id: string; date: LocalDate; note: string };

export type LostBag = {
  type: BagType | null;
  colour: string;
  size: BagSize | null;
  material: BagMaterial | null;
  marks: string;
  /** The bag-tag number on the airline's tag or receipt. */
  tag: string;
  photos: Record<PhotoSlot, LostBagPhoto | null>;
  contents: ContentRow[];
  /** Last currency used for a value (the add form starts with it). */
  currency: string;
  /** The flight the bag was on (an item id of the trip); null = the latest landed flight. */
  flightId: string | null;
  /** The file reference the baggage desk gave. */
  reference: string;
  log: LogEntry[];
};

export const LIMITS = { short: 60, tag: 40, marks: 500, label: 80, note: 400, contents: 60, log: 60 } as const;
/** Largest value one row can hold, in minor units (anything above is a typo). */
export const MAX_VALUE = 100_000_000;

export const EMPTY_LOST_BAG: LostBag = Object.freeze({
  type: null,
  colour: '',
  size: null,
  material: null,
  marks: '',
  tag: '',
  photos: Object.freeze({ outside: null, contents: null }) as Record<PhotoSlot, LostBagPhoto | null>,
  contents: Object.freeze([]) as unknown as ContentRow[],
  currency: '',
  flightId: null,
  reference: '',
  log: Object.freeze([]) as unknown as LogEntry[],
}) as LostBag;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const oneOf = <T extends string>(list: readonly T[], v: unknown): T | null => ((list as readonly unknown[]).includes(v) ? (v as T) : null);
const isDay = (v: unknown): v is LocalDate => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;

/** A whole value from 0 to MAX_VALUE minor units, or null. */
export function cleanValue(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0 || v > MAX_VALUE) return null;
  return v;
}

function cleanPhoto(v: unknown): LostBagPhoto | null {
  if (!isObj(v) || typeof v.uri !== 'string' || !v.uri) return null;
  return { uri: v.uri, mime: typeof v.mime === 'string' && v.mime ? v.mime : 'image/jpeg', takenAt: typeof v.takenAt === 'string' ? v.takenAt : '' };
}

function cleanRow(v: unknown): ContentRow | null {
  if (!isObj(v) || typeof v.id !== 'string' || !v.id) return null;
  const label = str(v.label, LIMITS.label);
  if (!label) return null;
  const currency = isCurrency(v.currency) ? v.currency : '';
  const value = currency ? cleanValue(v.value) : null;
  return { id: v.id, label, value, currency };
}

/**
 * Follow-up log, normalised: rows with a real date and some words, notes trimmed and cut, ids unique (first wins),
 * oldest date first (same date keeps the order typed), at most LIMITS.log rows (the newest kept).
 */
export function normaliseLog(raw: unknown): LogEntry[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const rows: { e: LogEntry; i: number }[] = [];
  raw.forEach((v, i) => {
    if (!isObj(v) || typeof v.id !== 'string' || !v.id || seen.has(v.id) || !isDay(v.date)) return;
    const note = str(v.note, LIMITS.note).replace(/\s+/g, ' ');
    if (!note) return;
    seen.add(v.id);
    rows.push({ e: { id: v.id, date: v.date, note }, i });
  });
  rows.sort((a, b) => (a.e.date < b.e.date ? -1 : a.e.date > b.e.date ? 1 : a.i - b.i));
  return rows.slice(-LIMITS.log).map((r) => r.e);
}

/** Stored value -> LostBag. Anything missing, damaged or too long is dropped or cut, never thrown on. */
export function cleanLostBag(raw: unknown): LostBag {
  if (!isObj(raw)) return { ...EMPTY_LOST_BAG, photos: { outside: null, contents: null }, contents: [], log: [] };
  const photos = isObj(raw.photos) ? raw.photos : {};
  const seen = new Set<string>();
  const contents: ContentRow[] = [];
  for (const v of Array.isArray(raw.contents) ? raw.contents : []) {
    const r = cleanRow(v);
    if (!r || seen.has(r.id) || contents.length >= LIMITS.contents) continue;
    seen.add(r.id);
    contents.push(r);
  }
  return {
    type: oneOf(BAG_TYPES, raw.type),
    colour: str(raw.colour, LIMITS.short),
    size: oneOf(BAG_SIZES, raw.size),
    material: oneOf(BAG_MATERIALS, raw.material),
    marks: str(raw.marks, LIMITS.marks),
    tag: str(raw.tag, LIMITS.tag),
    photos: { outside: cleanPhoto(photos.outside), contents: cleanPhoto(photos.contents) },
    contents,
    currency: isCurrency(raw.currency) ? raw.currency : '',
    flightId: typeof raw.flightId === 'string' && raw.flightId ? raw.flightId : null,
    reference: str(raw.reference, LIMITS.tag),
    log: normaliseLog(raw.log),
  };
}

/** True when nothing describes the bag yet (the report and log are not part of the description). */
export function isEmptyDescription(b: LostBag): boolean {
  return !b.type && !b.colour && !b.size && !b.material && !b.marks && !b.tag && !b.photos.outside && !b.photos.contents && b.contents.length === 0;
}

/** How much of the card is filled: type, colour, size, material, marks, tag, outside photo, contents photo, contents. */
export function descriptionProgress(b: LostBag): { done: number; total: number } {
  const parts = [!!b.type, !!b.colour, !!b.size, !!b.material, !!b.marks, !!b.tag, !!b.photos.outside, !!b.photos.contents, b.contents.length > 0];
  return { done: parts.filter(Boolean).length, total: parts.length };
}

// ------------------------------------------------------------------------------------------------- edits

/** Sets or clears one photo; `replaced` is the old file to delete once the save worked. */
export function withPhoto(b: LostBag, slot: PhotoSlot, photo: LostBagPhoto | null): { next: LostBag; replaced: string | null } {
  const old = b.photos[slot];
  const next = { ...b, photos: { ...b.photos, [slot]: photo ? cleanPhoto(photo) : null } };
  return { next, replaced: old && old.uri !== photo?.uri ? old.uri : null };
}

/** Every photo file this bag points at (for clean-up). */
export const photoUris = (b: LostBag): string[] => PHOTO_SLOTS.map((s) => b.photos[s]?.uri ?? '').filter(Boolean);

export type RowError = 'empty' | 'value' | 'currency' | 'full';

/**
 * Adds a thing to the contents. `valueText` may be empty (no value); otherwise it must read as an amount in
 * `currency` (spending.ts parseAmount: '.' or ',' decimal mark, no more decimals than the currency has).
 */
export function addContent(b: LostBag, label: string, valueText: string, currency: string, id: string): { next: LostBag; error?: RowError } {
  const r = readRow(label, valueText, currency, id);
  if ('error' in r) return { next: b, error: r.error };
  if (b.contents.length >= LIMITS.contents) return { next: b, error: 'full' };
  return { next: { ...b, contents: [...b.contents, r.row], currency: r.row.value === null ? b.currency : r.row.currency } };
}

/** The typed words, value and currency as a row (same rules for adding and editing). */
function readRow(label: string, valueText: string, currency: string, id: string): { row: ContentRow } | { error: RowError } {
  const name = label.trim().replace(/\s+/g, ' ').slice(0, LIMITS.label);
  if (!name) return { error: 'empty' };
  const cur = currency.trim().toUpperCase();
  let value: number | null = null;
  if (valueText.trim()) {
    if (!isCurrency(cur)) return { error: 'currency' };
    value = parseAmount(valueText, cur);
    if (value === null && /^[\s0.,]+$/.test(valueText)) value = 0;
    if (value === null || cleanValue(value) === null) return { error: 'value' };
  }
  return { row: { id, label: name, value, currency: value === null ? '' : cur } };
}

/**
 * T130: changes one contents row in place (label, value, currency), keeping its id and its place in the list. Same
 * rules as addContent; an empty value clears it. A row that is no longer there leaves the kit as it was.
 */
export function editContent(b: LostBag, id: string, label: string, valueText: string, currency: string): { next: LostBag; error?: RowError } {
  const at = b.contents.findIndex((r) => r.id === id);
  if (at < 0) return { next: b };
  const r = readRow(label, valueText, currency, id);
  if ('error' in r) return { next: b, error: r.error };
  const contents = b.contents.map((x, i) => (i === at ? r.row : x));
  return { next: { ...b, contents, currency: r.row.value === null ? b.currency : r.row.currency } };
}

/** T130: the fields of the edit form for a row (value as typed text in its own currency, '' when it has none). */
export function rowDraft(r: ContentRow, fallbackCurrency: string): { label: string; value: string; currency: string } {
  return r.value === null ? { label: r.label, value: '', currency: fallbackCurrency } : { label: r.label, value: minorToText(r.value, r.currency), currency: r.currency };
}

export const removeContent = (b: LostBag, id: string): LostBag => ({ ...b, contents: b.contents.filter((r) => r.id !== id) });

const fold = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Adds packing-list rows (their labels) that aren't on the contents yet, with no value; returns how many were added.
 * Duplicates (ignoring case and spacing) are skipped; the list never grows past LIMITS.contents.
 */
export function addFromPacking(b: LostBag, labels: readonly string[], newId: () => string): { next: LostBag; added: number } {
  const have = new Set(b.contents.map((r) => fold(r.label)));
  const contents = [...b.contents];
  let added = 0;
  for (const l of labels) {
    const label = l.trim().replace(/\s+/g, ' ').slice(0, LIMITS.label);
    if (!label || have.has(fold(label)) || contents.length >= LIMITS.contents) continue;
    have.add(fold(label));
    contents.push({ id: newId(), label, value: null, currency: '' });
    added++;
  }
  return { next: added ? { ...b, contents } : b, added };
}

/** Adds a follow-up note on a date (the log stays normalised). Null when the date or note is not usable. */
export function addLogEntry(b: LostBag, date: string, note: string, id: string): LostBag | null {
  if (!isDay(date) || !note.trim()) return null;
  return { ...b, log: normaliseLog([...b.log, { id, date, note }]) };
}

export const removeLogEntry = (b: LostBag, id: string): LostBag => ({ ...b, log: b.log.filter((e) => e.id !== id) });

// ------------------------------------------------------------------------------------------------- money

export type CurrencyTotal = { currency: string; minor: number; rows: number };

/** Total declared value per currency (integer minor units), currency codes A-Z. Rows with no value are left out. */
export function valueTotals(contents: readonly ContentRow[]): CurrencyTotal[] {
  const by = new Map<string, CurrencyTotal>();
  for (const r of contents) {
    if (r.value === null || !isCurrency(r.currency) || cleanValue(r.value) === null) continue;
    const t = by.get(r.currency) ?? { currency: r.currency, minor: 0, rows: 0 };
    t.minor += r.value;
    t.rows++;
    by.set(r.currency, t);
  }
  return [...by.values()].sort((a, b) => (a.currency < b.currency ? -1 : a.currency > b.currency ? 1 : 0));
}

/** "£280.00 + €40.00" style, or '' with no values. */
export const totalsText = (totals: readonly CurrencyTotal[], lang = 'en'): string => totals.map((t) => formatMoney(t.minor, t.currency, lang)).join(' + ');

// ------------------------------------------------------------------------------------------------- the trip

/** The trip's flights in real-time order (flights with an unreadable zone are left out). */
export function flightsOf(trip: Pick<Trip, 'items'>): Item[] {
  return trip.items
    .filter((i) => i.kind === 'flight' && zonesReadable(i))
    .map((i) => ({ i, s: span(i) }))
    .sort((a, b) => a.s.start - b.s.start || (a.i.id < b.i.id ? -1 : a.i.id > b.i.id ? 1 : 0))
    .map((x) => x.i);
}

/** The flight the report is about: the chosen one if it is still on the trip, else the latest landed, else the first. */
export function reportFlight(trip: Pick<Trip, 'items'>, flightId: string | null, now: number): Item | null {
  const flights = flightsOf(trip);
  const chosen = flightId ? flights.find((f) => f.id === flightId) : undefined;
  if (chosen) return chosen;
  const landed = flights.filter((f) => span(f).end <= now);
  return landed[landed.length - 1] ?? flights[0] ?? null;
}

/** "XX 123" from carrier and number, or the title. */
export function flightName(f: Pick<Item, 'carrier' | 'number' | 'title'>): string {
  const code = [f.carrier?.trim(), f.number?.trim()].filter(Boolean).join(' ');
  return code || f.title.trim();
}

const placeName = (p: Place | undefined) => p?.name?.trim() ?? '';

/** One-line route "From → To" (empty when neither end is known). */
export function flightRoute(f: Pick<Item, 'from' | 'to'>): string {
  const a = placeName(f.from);
  const b = placeName(f.to);
  return a || b ? `${a || '?'} → ${b || '?'}` : '';
}

/** The flight's departure day on its own clock. */
export const flightDay = (f: Pick<Item, 'start'>): LocalDate => localDate(f.start.local);

/** The delivery address lines for a stay: name, address (or the local-script one), phone. */
export function stayLines(stay: Pick<Item, 'title' | 'place'> | null): string[] {
  if (!stay) return [];
  const p = stay.place;
  return [p?.name?.trim() || stay.title.trim(), p?.address?.trim() || p?.localAddress?.trim() || '', p?.phone?.trim() || ''].filter(Boolean);
}

// ------------------------------------------------------------------------------------------------- texts

/** Words: `w('desc.type')` etc. — the UI passes the lostbag.* catalogue (key without the 'lostbag.' prefix). */
export type Words = (key: string, vars?: Record<string, string | number>) => string;

export type TextOptions = { lang?: string; day?: (d: LocalDate) => string };

/**
 * The bag's description, ready to show or share: heading with the bag's name, then only the fields that are filled
 * (type, colour, size, material, marks, tag), the contents with their values and the total value per currency.
 */
export function descriptionText(bag: LostBag, bagName: string, w: Words, opts: TextOptions = {}): string {
  const lang = opts.lang ?? 'en';
  const lines: string[] = [w('text.descTitle', { name: bagName.trim() || w('text.bag') })];
  const field = (key: string, value: string) => {
    if (value) lines.push(`${w(key)}: ${value}`);
  };
  field('desc.type', bag.type ? w(`type.${bag.type}`) : '');
  field('desc.colour', bag.colour);
  field('desc.size', bag.size ? w(`size.${bag.size}`) : '');
  field('desc.material', bag.material ? w(`material.${bag.material}`) : '');
  field('desc.marks', bag.marks);
  field('desc.tag', bag.tag);
  if (bag.contents.length) {
    lines.push('', `${w('contents.title')}:`);
    for (const r of bag.contents) lines.push(r.value === null ? `- ${r.label}` : `- ${r.label} (${formatMoney(r.value, r.currency, lang)})`);
    const totals = valueTotals(bag.contents);
    if (totals.length) lines.push('', `${w('text.total')}: ${totalsText(totals, lang)}`);
  }
  if (lines.length === 1) lines.push(w('text.noDescription'));
  return lines.join('\n');
}

export type ReportInput = {
  bag: LostBag;
  bagName: string;
  flight: Pick<Item, 'carrier' | 'number' | 'title' | 'from' | 'to' | 'start' | 'ref'> | null;
  stay: Pick<Item, 'title' | 'place'> | null;
  /** Traveller's name or contact line (optional). */
  contact?: string;
};

/**
 * The "My bag didn't arrive" report as plain text: flight (name, route, day, booking reference), the desk's file
 * reference, the description, where to deliver the bag and the follow-up log by date. Empty parts write nothing.
 */
export function reportText(input: ReportInput, w: Words, opts: TextOptions = {}): string {
  const day = opts.day ?? ((d: LocalDate) => d);
  const { bag, flight } = input;
  const blocks: string[] = [w('text.reportTitle')];
  const head: string[] = [];
  if (flight) {
    head.push(`${w('report.flight')}: ${[flightName(flight), flightRoute(flight), day(flightDay(flight))].filter(Boolean).join(', ')}`);
    if (flight.ref?.trim()) head.push(`${w('report.booking')}: ${flight.ref.trim()}`);
  }
  if (bag.reference) head.push(`${w('report.reference')}: ${bag.reference}`);
  if (input.contact?.trim()) head.push(`${w('report.contact')}: ${input.contact.trim()}`);
  if (head.length) blocks.push(head.join('\n'));
  blocks.push(descriptionText(bag, input.bagName, w, opts));
  const stay = stayLines(input.stay);
  if (stay.length) blocks.push([`${w('report.deliver')}:`, ...stay].join('\n'));
  if (bag.log.length) blocks.push([`${w('log.title')}:`, ...bag.log.map((e) => `- ${day(e.date)}: ${e.note}`)].join('\n'));
  return `${blocks.join('\n\n')}\n`;
}

/** Every word key the texts and the screen's enum labels use (the test checks each is in the catalogue). */
export const TEXT_KEYS: readonly string[] = [
  'text.descTitle', 'text.bag', 'text.total', 'text.noDescription', 'text.reportTitle',
  'desc.type', 'desc.colour', 'desc.size', 'desc.material', 'desc.marks', 'desc.tag',
  'contents.title', 'report.flight', 'report.booking', 'report.reference', 'report.contact', 'report.deliver', 'log.title',
  ...BAG_TYPES.map((x) => `type.${x}`),
  ...BAG_SIZES.map((x) => `size.${x}`),
  ...BAG_MATERIALS.map((x) => `material.${x}`),
];

// ------------------------------------------------------------------------------------------------- choosing a bag

/**
 * Trips for the kit's bag picker: under way first, then coming up (soonest first), then ended within the last
 * `pastDays` days (most recent first). Demo trips are kept (the traveller may be trying the app).
 */
export function kitTrips<T extends Pick<Trip, 'id' | 'startDate' | 'endDate'>>(trips: readonly T[], today: LocalDate, pastDays = 60): T[] {
  const cut = new Date(Date.parse(`${today}T00:00:00Z`) - pastDays * 86_400_000).toISOString().slice(0, 10);
  const now = trips.filter((t) => t.startDate <= today && today <= t.endDate);
  const next = trips.filter((t) => t.startDate > today).sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0));
  const past = trips.filter((t) => t.endDate < today && t.endDate >= cut).sort((a, b) => (a.endDate > b.endDate ? -1 : a.endDate < b.endDate ? 1 : 0));
  return [...now, ...next, ...past];
}
