// T136 Outfit planner (owner-1031 D, deepen Packing): what to wear each day of a trip, from the trip's packing-list
// clothes (plus the traveller's own extra pieces), one outfit per day with an optional evening one, a laundry-day
// marker that starts the wear counts again, and hints for pieces never worn in the plan or worn 4+ days in a row
// between washes. Pure and offline; no React Native imports.
//
// Stored on the trip as optional Trip.outfits (absent on older trips), read defensively here. Packing-list pieces are
// keyed by their folded label ('p:linen shirt'), not by the packing row id: row ids are renewed on a .satchel import and
// on Plan this trip again, labels are not, so a plan still points at its clothes after either. Own pieces carry their
// own ids, local to Trip.outfits (kept on import, like bag ids on a packing list). A plan entry whose piece has gone
// (row removed or renamed) is kept but not shown or counted, so putting the row back brings it back.
//
// The trip's days are its dates widened by any booking whose own local date falls outside them (each booking read on
// its own clock, never the phone's); "today" is read in the zone the traveller is in (journal.ts tripZoneAt).
import { tripZoneAt } from './journal.ts';
import type { LocalDate, Trip } from './model.ts';
import { addDays, daysBetween, fromUtc, isValidZone, localDate } from './tz.ts';

export const GARMENT_CATS = ['top', 'bottom', 'dress', 'layer', 'shoes', 'accessory'] as const;
export type GarmentCat = (typeof GARMENT_CATS)[number];
export const isGarmentCat = (v: unknown): v is GarmentCat => typeof v === 'string' && (GARMENT_CATS as readonly string[]).includes(v);

export const OUTFIT_SLOTS = ['day', 'evening'] as const;
export type OutfitSlot = (typeof OUTFIT_SLOTS)[number];

/** A piece the traveller added here (not on the packing list). */
export type OutfitExtra = { id: string; label: string; cat: GarmentCat };
/** One day's plan: piece keys for the daytime outfit and the optional evening one; laundry after this day. */
export type OutfitDay = { date: LocalDate; day?: string[]; evening?: string[]; laundry?: boolean };
export type TripOutfits = {
  /** Own extra pieces. */
  extras?: OutfitExtra[];
  /** The traveller's own category for a piece (by key), over the guess from its name. */
  cats?: Record<string, GarmentCat>;
  days?: OutfitDay[];
  updatedAt?: string;
};

/** A piece in the wardrobe the screen shows. */
export type Piece = { key: string; label: string; cat: GarmentCat; source: 'packing' | 'own'; qty?: number };

/** Worn this many days between washes: "pack a spare?". */
export const SPARE_AT = 4;
export const MAX_LABEL = 60;
const MAX_EXTRAS = 100;
const MAX_DAYS = 120;
const MAX_PER_SLOT = 12;
/** Longest trip the planner lists day by day. */
export const MAX_PLAN_DAYS = 90;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isDay = (v: unknown): v is LocalDate => isStr(v) && /^\d{4}-\d{2}-\d{2}$/.test(v);

// ------------------------------------------------------------------ category from a name

/**
 * Words that name a kind of garment ('skip': clothes that are never part of an outfit, such as underwear and socks).
 * Matched as whole words (a plural -s / -es also matches), after joining a few two-word names. The LAST garment word in
 * a name decides, because English puts the head noun last: "Dress shoes" are shoes, "Dress shirt" is a top.
 */
export const GARMENT_WORDS: Readonly<Record<GarmentCat | 'skip', readonly string[]>> = {
  top: ['top', 'shirt', 'tshirt', 'tee', 'blouse', 'polo', 'tank', 'singlet', 'camisole', 'tunic', 'kurta', 'jersey', 'rashie', 'rashguard'],
  bottom: ['bottom', 'trouser', 'pant', 'jeans', 'shorts', 'skirt', 'legging', 'chino', 'jogger', 'sarong', 'culottes', 'capris', 'trunks'],
  dress: ['dress', 'outfit', 'jumpsuit', 'playsuit', 'romper', 'suit', 'swimsuit', 'swimwear', 'bikini', 'kimono', 'sari', 'saree', 'overalls', 'dungarees', 'gown'],
  layer: ['layer', 'baselayer', 'jacket', 'coat', 'raincoat', 'parka', 'anorak', 'fleece', 'jumper', 'sweater', 'pullover', 'sweatshirt', 'hoodie', 'cardigan', 'blazer', 'gilet', 'vest', 'poncho', 'windbreaker', 'shell', 'outerwear', 'coverup', 'shawl', 'thermal', 'thermals'],
  shoes: ['shoe', 'boot', 'sandal', 'sneaker', 'trainer', 'loafer', 'heel', 'flat', 'flipflop', 'thong', 'slide', 'espadrille', 'slipper', 'footwear', 'clog', 'mule'],
  accessory: ['hat', 'cap', 'beanie', 'scarf', 'glove', 'mitten', 'belt', 'tie', 'sunglasses', 'neckwarmer', 'snood', 'buff', 'bandana', 'headband', 'jewellery', 'jewelry', 'necklace', 'earring', 'bracelet', 'watch', 'handbag', 'clutch', 'tote', 'umbrella'],
  skip: ['underwear', 'undies', 'bra', 'boxers', 'briefs', 'knickers', 'sock', 'stocking', 'tights', 'sleepwear', 'pyjamas', 'pajamas', 'pjs', 'nightwear', 'nightie', 'nightdress'],
};

/** Two-word names joined into one word before matching. */
const JOINS: readonly [RegExp, string][] = [
  [/\bt[\s-]?shirts?\b/g, 'tshirt'],
  [/\bcover[\s-]?ups?\b/g, 'coverup'],
  [/\bbase[\s-]?layers?\b/g, 'baselayer'],
  [/\bflip[\s-]?flops?\b/g, 'flipflop'],
  [/\bneck[\s-]?warmers?\b/g, 'neckwarmer'],
  [/\brash[\s-]?(vest|guard)s?\b/g, 'rashguard'],
  [/\bswim(ming)?\s?(costume|suit)s?\b/g, 'swimsuit'],
  [/\bsun[\s-]?glasses\b/g, 'sunglasses'],
  [/\bnight[\s-]?dress(es)?\b/g, 'nightdress'],
];

const WORD_CAT: ReadonlyMap<string, GarmentCat | 'skip'> = new Map(
  (Object.entries(GARMENT_WORDS) as [GarmentCat | 'skip', readonly string[]][]).flatMap(([cat, words]) => words.map((w) => [w, cat] as const)),
);

function wordCat(w: string): GarmentCat | 'skip' | null {
  for (const c of [w, w.endsWith('s') ? w.slice(0, -1) : '', w.endsWith('es') ? w.slice(0, -2) : '']) {
    if (!c) continue;
    const cat = WORD_CAT.get(c);
    if (cat) return cat;
  }
  return null;
}

/** The garment kind a name suggests (the last garment word wins), 'skip' for underwear / socks / sleepwear, or null. */
export function guessGarment(label: string): GarmentCat | 'skip' | null {
  let s = label.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
  for (const [re, to] of JOINS) s = s.replace(re, to);
  let found: GarmentCat | 'skip' | null = null;
  for (const w of s.split(/[^a-z]+/)) {
    if (!w) continue;
    const cat = wordCat(w);
    if (cat) found = cat;
  }
  return found;
}

// ------------------------------------------------------------------ reading

/** The key of a packing-list piece: its folded label (survives the row ids being renewed). */
export const packKey = (label: string) => `p:${label.trim().toLowerCase().replace(/\s+/g, ' ')}`;

const cleanLabel = (v: unknown): string => (isStr(v) ? v.trim().replace(/\s+/g, ' ').slice(0, MAX_LABEL) : '');

function cleanKeys(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const k of v) if (isStr(k) && k && !out.includes(k) && out.length < MAX_PER_SLOT) out.push(k);
  return out;
}

function cleanDay(v: unknown): OutfitDay | null {
  if (!isObj(v) || !isDay(v.date)) return null;
  const { date, day, evening, laundry, ...rest } = v;
  const d = cleanKeys(day);
  const e = cleanKeys(evening);
  const out: OutfitDay = { ...(rest as object), date: date as LocalDate };
  if (d.length) out.day = d;
  if (e.length) out.evening = e;
  if (laundry === true) out.laundry = true;
  return out.day || out.evening || out.laundry ? out : null;
}

function cleanExtra(v: unknown): OutfitExtra | null {
  if (!isObj(v) || !isStr(v.id) || !v.id) return null;
  const label = cleanLabel(v.label);
  if (!label) return null;
  const { id, label: _l, cat, ...rest } = v;
  return { ...(rest as object), id: id as string, label, cat: isGarmentCat(cat) ? cat : 'top' };
}

/** The trip's plan, cleaned (null when it has none or it's unreadable). Unknown fields are kept. */
export function readOutfits(trip: Pick<Trip, 'outfits'>): TripOutfits | null {
  const raw: unknown = trip.outfits;
  if (!isObj(raw)) return null;
  const { extras, cats, days, updatedAt, ...rest } = raw;
  const seen = new Set<string>();
  const ex = (Array.isArray(extras) ? extras : [])
    .map(cleanExtra)
    .filter((x): x is OutfitExtra => !!x && !seen.has(x.id) && !!seen.add(x.id))
    .slice(0, MAX_EXTRAS);
  const seenDay = new Set<string>();
  const ds = (Array.isArray(days) ? days : [])
    .map(cleanDay)
    .filter((d): d is OutfitDay => !!d && !seenDay.has(d.date) && !!seenDay.add(d.date))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(0, MAX_DAYS);
  const cs: Record<string, GarmentCat> = {};
  if (isObj(cats)) for (const [k, c] of Object.entries(cats)) if (k && isGarmentCat(c)) cs[k] = c;
  return {
    ...rest,
    ...(ex.length ? { extras: ex } : {}),
    ...(Object.keys(cs).length ? { cats: cs } : {}),
    ...(ds.length ? { days: ds } : {}),
    ...(isStr(updatedAt) ? { updatedAt } : {}),
  } as TripOutfits;
}

const hasContent = (o: TripOutfits | null): o is TripOutfits => !!o && !!(o.extras?.length || o.days?.length || (o.cats && Object.keys(o.cats).length));

/** A file's `outfits` (absent on older files), cleaned like the store; undefined when there's nothing in it. */
export function readFileOutfits(raw: unknown): TripOutfits | undefined {
  const o = readOutfits({ outfits: raw as TripOutfits });
  return hasContent(o) ? o : undefined;
}

// ------------------------------------------------------------------ the wardrobe

/** A packing row as the planner reads it (the packing list's PackItem fits). */
export type PackRow = { label: string; category?: string; qty?: number; userQty?: number };

/**
 * The pieces to plan with: the packing list's clothes (a row in the 'clothes' category, or any row whose name reads as
 * a garment), minus underwear, socks and sleepwear unless the traveller gave one a category, then the own pieces.
 * One piece per name. The category is the traveller's own choice, else the guess, else top.
 */
export function wardrobe(o: TripOutfits | null, packing: readonly PackRow[] | null | undefined): Piece[] {
  const out: Piece[] = [];
  const seen = new Set<string>();
  const cats = o?.cats ?? {};
  for (const r of packing ?? []) {
    const label = cleanLabel(r?.label);
    if (!label) continue;
    const key = packKey(label);
    if (seen.has(key)) continue;
    const guess = guessGarment(label);
    const own = cats[key];
    if (!own && (guess === 'skip' || (guess === null && r.category !== 'clothes'))) continue;
    seen.add(key);
    const qty = typeof r.userQty === 'number' && r.userQty > 0 ? r.userQty : typeof r.qty === 'number' && r.qty > 0 ? r.qty : undefined;
    out.push({ key, label, cat: own ?? (guess && guess !== 'skip' ? guess : 'top'), source: 'packing', ...(qty ? { qty } : {}) });
  }
  for (const x of o?.extras ?? []) {
    if (seen.has(x.id)) continue;
    seen.add(x.id);
    out.push({ key: x.id, label: x.label, cat: cats[x.id] ?? x.cat, source: 'own' });
  }
  return out;
}

/** Pieces in category order (tops, bottoms, dresses, layers, shoes, accessories), names A–Z within each. */
export function sortPieces(pieces: readonly Piece[]): Piece[] {
  const rank = (c: GarmentCat) => GARMENT_CATS.indexOf(c);
  return [...pieces].sort((a, b) => rank(a.cat) - rank(b.cat) || a.label.localeCompare(b.label));
}

// ------------------------------------------------------------------ the trip's days

/**
 * The days to plan: the trip's first to last date, widened by any booking whose own local start or end date falls
 * outside them (each read on its own clock). At most MAX_PLAN_DAYS; empty for unreadable dates.
 */
export function outfitDates(trip: Pick<Trip, 'startDate' | 'endDate' | 'items'>): LocalDate[] {
  if (!isDay(trip.startDate)) return [];
  let start = trip.startDate;
  let end = isDay(trip.endDate) && trip.endDate >= start ? trip.endDate : start;
  for (const it of trip.items ?? []) {
    for (const s of [it?.start, it?.end]) {
      if (!s || !isStr(s.local) || !isStr(s.tz) || !isValidZone(s.tz)) continue;
      const d = localDate(s.local);
      if (!isDay(d)) continue;
      if (d < start) start = d;
      if (d > end) end = d;
    }
  }
  const n = Math.min(daysBetween(start, end) + 1, MAX_PLAN_DAYS);
  const out: LocalDate[] = [];
  for (let i = 0; i < n; i++) out.push(addDays(start, i));
  return out;
}

/** Today where the traveller is on this trip (the zone of the last booking reached, else home). */
export function outfitToday(trip: Trip, now: number): LocalDate {
  return localDate(fromUtc(now, tripZoneAt(trip, now)));
}

export const dayPlan = (o: TripOutfits | null, date: LocalDate): OutfitDay | null => o?.days?.find((d) => d.date === date) ?? null;

/** The pieces of one slot that are still in the wardrobe, in the order they were picked. */
export function slotPieces(plan: OutfitDay | null, slot: OutfitSlot, pieces: readonly Piece[]): Piece[] {
  const byKey = new Map(pieces.map((p) => [p.key, p]));
  return (plan?.[slot] ?? []).map((k) => byKey.get(k)).filter((p): p is Piece => !!p);
}

/** A whole look: a dress, or a top with a bottom. */
export const outfitComplete = (pieces: readonly Piece[]) => pieces.some((p) => p.cat === 'dress') || (pieces.some((p) => p.cat === 'top') && pieces.some((p) => p.cat === 'bottom'));

/** Days on the trip with at least one piece planned (either slot). */
export function plannedCount(o: TripOutfits | null, dates: readonly LocalDate[], pieces: readonly Piece[]): number {
  return dates.filter((d) => {
    const p = dayPlan(o, d);
    return slotPieces(p, 'day', pieces).length + slotPieces(p, 'evening', pieces).length > 0;
  }).length;
}

// ------------------------------------------------------------------ wear counts

export type Wear = {
  /** Days the piece is worn in the plan (daytime and evening on one day count once). */
  total: number;
  /** Most days worn between two laundry days. */
  peak: number;
  /** Days worn since the last laundry day, up to and including `upTo` (all days when absent). */
  sinceWash: number;
};
export type WearHint = 'never' | 'spare' | null;

/**
 * Wear counts per piece key over the trip's days in order. A laundry day starts the counts again from the next day
 * (you wash that evening). Plan entries for days outside `dates` are ignored.
 */
export function wearCounts(o: TripOutfits | null, dates: readonly LocalDate[], pieces: readonly Piece[], upTo?: LocalDate): Map<string, Wear> {
  const out = new Map<string, Wear>(pieces.map((p) => [p.key, { total: 0, peak: 0, sinceWash: 0 }]));
  const run = new Map<string, number>();
  for (const date of [...dates].sort()) {
    const plan = dayPlan(o, date);
    const worn = new Set([...slotPieces(plan, 'day', pieces), ...slotPieces(plan, 'evening', pieces)].map((p) => p.key));
    for (const k of worn) {
      const w = out.get(k);
      if (!w) continue;
      const r = (run.get(k) ?? 0) + 1;
      run.set(k, r);
      w.total++;
      if (r > w.peak) w.peak = r;
      if (upTo === undefined || date <= upTo) w.sinceWash = r;
    }
    if (plan?.laundry) {
      run.clear();
      if (upTo === undefined || date < upTo) for (const w of out.values()) w.sinceWash = 0;
    }
  }
  return out;
}

/**
 * The hint for a piece: 'never' when the plan has outfits but never uses it ("leave it at home?"), 'spare' when it is
 * worn SPARE_AT or more days between washes and fewer of it are packed than that ("pack a spare?").
 */
export function wearHint(w: Wear | undefined, piece: Pick<Piece, 'qty'>, planned: number): WearHint {
  if (!w) return null;
  if (w.total === 0) return planned > 0 ? 'never' : null;
  if (w.peak >= SPARE_AT && (piece.qty ?? 1) < w.peak) return 'spare';
  return null;
}

// ------------------------------------------------------------------ editing (each returns a new Trip)

type NewId = (prefix: string) => string;

const current = (trip: Trip): TripOutfits => readOutfits(trip) ?? {};

function put(trip: Trip, o: TripOutfits, now: string): Trip {
  const next: TripOutfits = { ...o, updatedAt: now };
  if (!next.extras?.length) delete next.extras;
  if (!next.days?.length) delete next.days;
  if (next.cats && !Object.keys(next.cats).length) delete next.cats;
  return { ...trip, outfits: next };
}

function withDay(o: TripOutfits, date: LocalDate, f: (d: OutfitDay) => OutfitDay): TripOutfits {
  const days = [...(o.days ?? [])];
  const i = days.findIndex((d) => d.date === date);
  const next = cleanDay(f(i >= 0 ? days[i] : { date }));
  if (i >= 0) {
    if (next) days[i] = next;
    else days.splice(i, 1);
  } else if (next) days.push(next);
  days.sort((a, b) => (a.date < b.date ? -1 : 1));
  return { ...o, days };
}

/** Puts a piece in (on: true) or takes it out of one slot of a day. */
export function setPiece(trip: Trip, date: LocalDate, slot: OutfitSlot, key: string, on: boolean, now = new Date().toISOString()): Trip {
  if (!isDay(date) || !key) return trip;
  return put(
    trip,
    withDay(current(trip), date, (d) => {
      const keys = (d[slot] ?? []).filter((k) => k !== key);
      if (on) keys.push(key);
      return { ...d, [slot]: keys };
    }),
    now,
  );
}

/** Empties one slot of a day. */
export function clearSlot(trip: Trip, date: LocalDate, slot: OutfitSlot, now = new Date().toISOString()): Trip {
  return put(trip, withDay(current(trip), date, (d) => ({ ...d, [slot]: [] })), now);
}

/** Marks a day as laundry day (counts start again the next day), or not. */
export function setLaundryDay(trip: Trip, date: LocalDate, on: boolean, now = new Date().toISOString()): Trip {
  if (!isDay(date)) return trip;
  return put(
    trip,
    withDay(current(trip), date, (d) => {
      const { laundry: _l, ...rest } = d;
      return on ? { ...rest, laundry: true } : rest;
    }),
    now,
  );
}

/** The latest day before `date` with a daytime outfit (for "Same as <day>"), or null. */
export function previousOutfitDay(o: TripOutfits | null, date: LocalDate, pieces: readonly Piece[]): OutfitDay | null {
  const before = (o?.days ?? []).filter((d) => d.date < date && slotPieces(d, 'day', pieces).length > 0);
  return before[before.length - 1] ?? null;
}

/** Copies another day's outfits (both slots) onto `date`; its laundry mark stays as it was. */
export function copyDayOutfit(trip: Trip, from: LocalDate, date: LocalDate, now = new Date().toISOString()): Trip {
  const o = current(trip);
  const src = dayPlan(o, from);
  if (!src || from === date) return trip;
  return put(trip, withDay(o, date, (d) => ({ ...d, day: [...(src.day ?? [])], evening: [...(src.evening ?? [])] })), now);
}

/** Adds an own piece (category from the name unless given; blank names and a full list change nothing). */
export function addExtra(trip: Trip, label: string, newId: NewId, cat?: GarmentCat, now = new Date().toISOString()): Trip {
  const words = cleanLabel(label);
  const o = current(trip);
  if (!words || (o.extras?.length ?? 0) >= MAX_EXTRAS) return trip;
  const guess = guessGarment(words);
  const c: GarmentCat = cat ?? (guess && guess !== 'skip' ? guess : 'top');
  return put(trip, { ...o, extras: [...(o.extras ?? []), { id: newId('of'), label: words, cat: c }] }, now);
}

/** Removes an own piece and takes it out of every day. */
export function removeExtra(trip: Trip, id: string, now = new Date().toISOString()): Trip {
  const o = current(trip);
  if (!o.extras?.some((x) => x.id === id)) return trip;
  const days = (o.days ?? []).map((d) => cleanDay({ ...d, day: (d.day ?? []).filter((k) => k !== id), evening: (d.evening ?? []).filter((k) => k !== id) })).filter((d): d is OutfitDay => !!d);
  const cats = { ...(o.cats ?? {}) };
  delete cats[id];
  return put(trip, { ...o, extras: o.extras.filter((x) => x.id !== id), days, cats }, now);
}

/** Sets the traveller's own category for a piece. */
export function setPieceCat(trip: Trip, key: string, cat: GarmentCat, now = new Date().toISOString()): Trip {
  if (!key || !isGarmentCat(cat)) return trip;
  const o = current(trip);
  return put(trip, { ...o, cats: { ...(o.cats ?? {}), [key]: cat } }, now);
}

// ------------------------------------------------------------------ today's outfit (Your day)

export type TodayOutfit = { date: LocalDate; day: Piece[]; evening: Piece[]; laundry: boolean };

/** Today's planned outfit on this trip (null when today is not a trip day or nothing is planned for it). */
export function todayOutfit(trip: Trip, today: LocalDate, pieces: readonly Piece[]): TodayOutfit | null {
  if (!outfitDates(trip).includes(today)) return null;
  const plan = dayPlan(readOutfits(trip), today);
  const day = slotPieces(plan, 'day', pieces);
  const evening = slotPieces(plan, 'evening', pieces);
  if (!day.length && !evening.length && !plan?.laundry) return null;
  return { date: today, day, evening, laundry: plan?.laundry === true };
}

// ------------------------------------------------------------------ weather for a day

/**
 * The weather stop for a date: the stop whose dates cover it (the latest-arrived when two do), else the last stop
 * reached before it, else the first. Works on src/core/weather.ts WeatherStop or anything with the same dates.
 */
export function stopForDate<S extends { fromDate: LocalDate; toDate: LocalDate }>(stops: readonly S[], date: LocalDate): S | null {
  let covering: S | null = null;
  let before: S | null = null;
  for (const s of stops) {
    if (s.fromDate <= date && date <= s.toDate && (!covering || s.fromDate >= covering.fromDate)) covering = s;
    if (s.fromDate <= date && (!before || s.fromDate >= before.fromDate)) before = s;
  }
  return covering ?? before ?? stops[0] ?? null;
}
