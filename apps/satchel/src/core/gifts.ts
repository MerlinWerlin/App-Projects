// T107 Gifts and souvenirs (owner-1031 D, deepens Packing and Spending): a per-trip gift list. Pure TypeScript.
//
// People to buy for (a name and an optional budget in the trip's home currency), each with gift ideas: what it is,
// where it was seen, a price in the local currency, a status (idea -> bought -> packed), an optional map spot (taken
// from the one-off "where am I" check or a saved place, as "lat,lon" draft text like the booking form) and an optional
// bag from the trip's packing list with a weight.
//
// Money follows spending.ts: integer minor units of the price's own currency, and a home value only where the trip
// has a saved rate (spending.ts rateFor; home itself is 1). A price in a currency with no rate stays out of every home
// figure and is listed in `missing`; nothing is guessed. A person's budget is in home currency, so the budget bar
// counts only what converts.
//
// "Bought" can, on request, add a spending entry (category shopping) for the gift's price; the gift then remembers
// that entry's id (remapped on .satchel import) so it is never offered twice. "Packed" puts the gift's weight in the
// chosen bag's tally on the packing screen (giftWeightsByBag + withGiftWeight); moving it back to bought or idea takes
// it out again. Nothing is written to the packing list itself.
//
// Stored on the trip (optional Trip.gifts) and carried in .satchel files. Stored and imported rows are read
// defensively: a malformed row is skipped and fields this build doesn't know are kept.
import type { Bag, Tally, WeightUnit } from './bags.ts';
import { bagsOf, cleanGrams, parseWeight, weightInput } from './bags.ts';
import type { Expense, LocalDate, Trip } from './model.ts';
import type { PackList } from './packing.ts';
import { validLatLon, type LatLon } from './poi.ts';
import { decodePos, encodePos } from './position.ts';
import {
  cleanCurrency,
  convertMinor,
  isCurrency,
  MAX_MINOR,
  minorToText,
  parseAmount,
  rateFor,
  readSpending,
  upsertExpense,
  type ExpenseDraft,
  type Money,
} from './spending.ts';

export const GIFT_STATUSES = ['idea', 'bought', 'packed'] as const;
export type GiftStatus = (typeof GIFT_STATUSES)[number];

export const MAX_PEOPLE = 100;
export const MAX_GIFTS = 200;
export const MAX_NAME = 60;
export const MAX_WHAT = 120;
export const MAX_WHERE = 120;

export type Gift = {
  id: string;
  /** What it is ("Tea towel", "Matcha"). */
  what: string;
  /** Where it was seen, as typed ("Market by the station"). */
  where?: string;
  /** Price in minor units of `currency` (both set or neither). */
  price?: number;
  currency?: string;
  status: GiftStatus;
  /** Map spot where it was seen (from the position check or a saved place). */
  lat?: number;
  lon?: number;
  /** Name of the saved place the spot was taken from, if any. */
  spotName?: string;
  /** Bag id on the trip's packing list (bags.ts; bag ids are kept on import). */
  bag?: string;
  /** Weight in grams. */
  weightG?: number;
  /** The spending entry "Bought" added for it (absent: none). */
  expenseId?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type GiftPerson = {
  id: string;
  name: string;
  /** Budget for this person in home currency (minor units). */
  budget?: Money;
  gifts: Gift[];
  createdAt?: string;
};

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isStr = (x: unknown): x is string => typeof x === 'string';
const isId = (x: unknown): x is string => isStr(x) && x !== '' && x.length <= 100;
const isMinor = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x > 0 && x <= MAX_MINOR;
export const isGiftStatus = (x: unknown): x is GiftStatus => (GIFT_STATUSES as readonly unknown[]).includes(x);
const oneLine = (s: string, max: number) => s.replace(/\s+/g, ' ').trim().slice(0, max);

// ---- reading ----

function readGift(x: unknown): Gift | null {
  if (!isObj(x) || !isId(x.id) || !isStr(x.what) || !oneLine(x.what, MAX_WHAT)) return null;
  const { where, price, currency, lat, lon, spotName, bag, weightG, expenseId, createdAt, updatedAt, ...rest } = x;
  const g = { ...rest, id: x.id, what: oneLine(x.what, MAX_WHAT), status: isGiftStatus(x.status) ? x.status : 'idea' } as Gift;
  if (isStr(where) && oneLine(where, MAX_WHERE)) g.where = oneLine(where, MAX_WHERE);
  if (isMinor(price) && isCurrency(currency)) {
    g.price = price;
    g.currency = currency;
  }
  if (validLatLon(lat, lon)) {
    g.lat = lat as number;
    g.lon = lon as number;
    if (isStr(spotName) && spotName.trim()) g.spotName = spotName;
  }
  if (isId(bag)) g.bag = bag;
  const w = cleanGrams(weightG);
  if (w !== undefined) g.weightG = w;
  if (isId(expenseId)) g.expenseId = expenseId;
  if (isStr(createdAt)) g.createdAt = createdAt;
  if (isStr(updatedAt)) g.updatedAt = updatedAt;
  return g;
}

function readPerson(x: unknown): GiftPerson | null {
  if (!isObj(x) || !isId(x.id) || !isStr(x.name) || !oneLine(x.name, MAX_NAME)) return null;
  const { budget, gifts, createdAt, ...rest } = x;
  const seen = new Set<string>();
  const list: Gift[] = [];
  for (const row of Array.isArray(gifts) ? gifts.slice(0, MAX_GIFTS) : []) {
    const g = readGift(row);
    if (!g || seen.has(g.id)) continue;
    seen.add(g.id);
    list.push(g);
  }
  const p = { ...rest, id: x.id, name: oneLine(x.name, MAX_NAME), gifts: list } as GiftPerson;
  if (isObj(budget) && isCurrency(budget.currency) && isMinor(budget.amount)) p.budget = { currency: budget.currency, amount: budget.amount };
  if (isStr(createdAt)) p.createdAt = createdAt;
  return p;
}

/** The trip's gift list, read defensively (absent on older trips; unreadable rows skipped, duplicate ids kept once). */
export function readGifts(trip: Pick<Trip, 'gifts'>): GiftPerson[] {
  const raw: unknown = (trip as { gifts?: unknown }).gifts;
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: GiftPerson[] = [];
  for (const row of raw.slice(0, MAX_PEOPLE)) {
    const p = readPerson(row);
    if (!p || seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
  }
  return out;
}

export const findPerson = (trip: Trip, personId: string): GiftPerson | undefined => readGifts(trip).find((p) => p.id === personId);
export const findGift = (trip: Trip, personId: string, giftId: string): Gift | undefined => findPerson(trip, personId)?.gifts.find((g) => g.id === giftId);
export const giftSpot = (g: Gift): LatLon | null => (validLatLon(g.lat, g.lon) ? { lat: g.lat as number, lon: g.lon as number } : null);
export const hasPrice = (g: Gift): g is Gift & { price: number; currency: string } => isMinor(g.price) && isCurrency(g.currency);

/** T108: a gift with a map spot, as a pin on the Map tab (for the trips it shows). `id` is unique across trips. */
export type GiftPin = { id: string; tripId: string; personId: string; giftId: string; lat: number; lon: number; what: string; person: string; status: GiftStatus };

/** Gifts with a map spot on these trips, as pins; a tap opens the gift (giftPinTarget). */
export function giftPins(trips: readonly Pick<Trip, 'id' | 'gifts'>[]): GiftPin[] {
  const out: GiftPin[] = [];
  for (const trip of trips) {
    for (const p of readGifts(trip)) {
      for (const g of p.gifts) {
        const at = giftSpot(g);
        if (!at) continue;
        out.push({ id: `g:${trip.id}/${p.id}/${g.id}`, tripId: trip.id, personId: p.id, giftId: g.id, lat: at.lat, lon: at.lon, what: g.what, person: p.name, status: g.status });
      }
    }
  }
  return out;
}

/** Where a tapped map pin id leads: the gift's trip, person and gift; null when it is not a gift pin we drew. */
export function giftPinTarget(pins: readonly GiftPin[], id: string): { tripId: string; personId: string; giftId: string } | null {
  if (!id.startsWith('g:')) return null;
  const pin = pins.find((x) => x.id === id);
  return pin ? { tripId: pin.tripId, personId: pin.personId, giftId: pin.giftId } : null;
}

/** Bought or packed: the gift is in hand. */
export const isGot = (g: Pick<Gift, 'status'>) => g.status === 'bought' || g.status === 'packed';

// ---- money ----

/** The home currency: the trip's budget currency (Spending), or null when none is set. */
export const homeOf = (trip: Pick<Trip, 'budget'>): string | null => readSpending({ budget: trip.budget }).budget?.currency ?? null;

/**
 * A price in `target` minor units: as is in the same currency; into home with the trip's saved rate; otherwise null
 * (no guessing). Rates are "1 foreign = x home", so only home (or the price's own currency) can be a target.
 */
export function priceIn(price: Money, target: string, home: string | null, rates: Record<string, number>): number | null {
  if (price.currency === target) return price.amount;
  if (target !== home) return null;
  const r = rateFor(price.currency, home, rates);
  return r == null ? null : convertMinor(price.amount, price.currency, r, home);
}

export type GiftSums = {
  /** Every priced gift, per currency as typed (home first, then alphabetical). */
  planned: Money[];
  /** Bought and packed gifts, per currency. */
  got: Money[];
  /** Home values of what converts; null when there is no home currency. */
  plannedHome: number | null;
  gotHome: number | null;
  /** Currencies with no saved rate (left out of the home values), alphabetical. */
  missing: string[];
};

const perCurrency = (gifts: readonly Gift[], home: string | null): Money[] => {
  const by = new Map<string, number>();
  for (const g of gifts) if (hasPrice(g)) by.set(g.currency, (by.get(g.currency) ?? 0) + g.price);
  return [...by]
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => (a.currency === home ? -1 : b.currency === home ? 1 : a.currency < b.currency ? -1 : a.currency > b.currency ? 1 : 0));
};

function sums(gifts: readonly Gift[], home: string | null, rates: Record<string, number>): GiftSums {
  const planned = perCurrency(gifts, home);
  const got = perCurrency(gifts.filter(isGot), home);
  const missing = new Set<string>();
  const toHome = (list: Money[]) => {
    if (home == null) return null;
    let n = 0;
    for (const m of list) {
      const v = priceIn(m, home, home, rates);
      if (v == null) missing.add(m.currency);
      else n += v;
    }
    return n;
  };
  const plannedHome = toHome(planned);
  const gotHome = toHome(got);
  return { planned, got, plannedHome, gotHome, missing: [...missing].sort() };
}

export type BudgetBar = {
  /** The person's budget (minor units of its currency). */
  budget: number;
  currency: string;
  /** Bought + packed, in the budget's currency (what converts). */
  spent: number;
  /** Every priced gift, in the budget's currency (what converts). */
  planned: number;
  /** budget - spent; negative when over. */
  left: number;
  /** budget - planned: what is left once every idea is bought. */
  leftPlanned: number;
  /** spent / budget, not capped. */
  fraction: number;
  over: boolean;
  /** Some prices could not be converted (no saved rate), so the figures are a floor. */
  partial: boolean;
};

export type PersonProgress = {
  total: number;
  ideas: number;
  bought: number;
  packed: number;
  /** Bought or packed. */
  got: number;
  /** got / total (0 for no gifts). */
  fraction: number;
  sums: GiftSums;
  budget: BudgetBar | null;
};

function budgetBar(p: GiftPerson, home: string | null, rates: Record<string, number>): BudgetBar | null {
  const b = p.budget;
  if (!b || !isMinor(b.amount) || !isCurrency(b.currency)) return null;
  let spent = 0;
  let planned = 0;
  let partial = false;
  for (const g of p.gifts) {
    if (!hasPrice(g)) continue;
    const v = priceIn({ currency: g.currency, amount: g.price }, b.currency, home, rates);
    if (v == null) {
      partial = true;
      continue;
    }
    planned += v;
    if (isGot(g)) spent += v;
  }
  return { budget: b.amount, currency: b.currency, spent, planned, left: b.amount - spent, leftPlanned: b.amount - planned, fraction: spent / b.amount, over: spent > b.amount, partial };
}

/** One person's progress (how many gifts got), totals per currency, home values and budget bar. */
export function personProgress(p: GiftPerson, home: string | null, rates: Record<string, number>): PersonProgress {
  const ideas = p.gifts.filter((g) => g.status === 'idea').length;
  const bought = p.gifts.filter((g) => g.status === 'bought').length;
  const packed = p.gifts.filter((g) => g.status === 'packed').length;
  const total = p.gifts.length;
  return { total, ideas, bought, packed, got: bought + packed, fraction: total ? (bought + packed) / total : 0, sums: sums(p.gifts, home, rates), budget: budgetBar(p, home, rates) };
}

export type GiftSummary = { people: number; total: number; got: number; packed: number; sums: GiftSums; home: string | null };

/** The whole list: people, gifts, how many got / packed, and totals (home values only with a saved rate). */
export function giftSummary(trip: Trip): GiftSummary {
  const people = readGifts(trip);
  const all = people.flatMap((p) => p.gifts);
  const home = homeOf(trip);
  return { people: people.length, total: all.length, got: all.filter(isGot).length, packed: all.filter((g) => g.status === 'packed').length, sums: sums(all, home, readSpending(trip).rates), home };
}

// ---- editing people ----

export type PersonDraft = { name: string; budget: string };
export type PersonError = 'name' | 'budget' | 'home';

export const newPersonDraft = (): PersonDraft => ({ name: '', budget: '' });
export const draftFromPerson = (p: GiftPerson): PersonDraft => ({ name: p.name, budget: p.budget ? minorToText(p.budget.amount, p.budget.currency) : '' });

/** A budget needs a home currency (set in Spending) and must read as an amount in it. */
export function validatePerson(d: PersonDraft, home: string | null): PersonError[] {
  const e: PersonError[] = [];
  if (!oneLine(d.name, MAX_NAME)) e.push('name');
  if (d.budget.trim()) {
    if (!home) e.push('home');
    else if (parseAmount(d.budget, home) == null) e.push('budget');
  }
  return e;
}

/** The person for a valid draft; keeps the gifts, id and any unknown fields of the one being edited. */
export function personFromDraft(d: PersonDraft, home: string | null, newId: (prefix: string) => string, prev?: GiftPerson, now = new Date().toISOString()): GiftPerson {
  const { budget: _b, ...base } = prev ?? { id: newId('gp'), name: '', gifts: [], createdAt: now };
  const out: GiftPerson = { ...base, name: oneLine(d.name, MAX_NAME) };
  const amount = home && d.budget.trim() ? parseAmount(d.budget, home) : null;
  if (home && amount != null) out.budget = { currency: home, amount };
  return out;
}

const withPeople = (trip: Trip, people: GiftPerson[]): Trip => ({ ...trip, gifts: people });

export function upsertPerson(trip: Trip, p: GiftPerson): Trip {
  const list = readGifts(trip);
  const at = list.findIndex((x) => x.id === p.id);
  if (at < 0 && list.length >= MAX_PEOPLE) return trip;
  return withPeople(trip, at >= 0 ? list.map((x, i) => (i === at ? p : x)) : [...list, p]);
}

/** Removes a person and their gifts (spending entries already added stay in Spending). */
export const removePerson = (trip: Trip, personId: string): Trip => withPeople(trip, readGifts(trip).filter((p) => p.id !== personId));

// ---- editing gifts ----

export type GiftDraft = { what: string; where: string; price: string; currency: string; pos: string; spotName: string; bag: string; weight: string };
export type GiftError = 'what' | 'price' | 'currency' | 'pos' | 'weight';

export const newGiftDraft = (currency: string): GiftDraft => ({ what: '', where: '', price: '', currency, pos: '', spotName: '', bag: '', weight: '' });

export function draftFromGift(g: Gift, unit: WeightUnit, lang = 'en'): GiftDraft {
  return {
    what: g.what,
    where: g.where ?? '',
    price: hasPrice(g) ? minorToText(g.price, g.currency) : '',
    currency: g.currency ?? '',
    pos: encodePos(g),
    spotName: g.spotName ?? '',
    bag: g.bag ?? '',
    weight: weightInput(g.weightG, unit, lang),
  };
}

export function validateGift(d: GiftDraft, unit: WeightUnit, lang = 'en'): GiftError[] {
  const e: GiftError[] = [];
  if (!oneLine(d.what, MAX_WHAT)) e.push('what');
  if (d.price.trim()) {
    const cur = cleanCurrency(d.currency);
    if (!isCurrency(cur)) e.push('currency');
    else if (parseAmount(d.price, cur) == null) e.push('price');
  }
  if (d.pos.trim() && !decodePos(d.pos)) e.push('pos');
  if (parseWeight(d.weight, unit, lang) === null) e.push('weight');
  return e;
}

/** The gift for a valid draft (validateGift first). Keeps the id, status, spending link and unknown fields of `prev`. */
export function giftFromDraft(d: GiftDraft, unit: WeightUnit, lang: string, newId: (prefix: string) => string, prev?: Gift, now = new Date().toISOString()): Gift {
  const { where: _w, price: _p, currency: _c, lat: _la, lon: _lo, spotName: _s, bag: _b, weightG: _g, ...base } = prev ?? { id: newId('gift'), what: '', status: 'idea' as GiftStatus, createdAt: now };
  const g: Gift = { ...base, what: oneLine(d.what, MAX_WHAT), ...(prev ? { updatedAt: now } : {}) };
  const where = oneLine(d.where, MAX_WHERE);
  if (where) g.where = where;
  const cur = cleanCurrency(d.currency);
  const price = d.price.trim() && isCurrency(cur) ? parseAmount(d.price, cur) : null;
  if (price != null) {
    g.price = price;
    g.currency = cur;
  }
  const at = decodePos(d.pos);
  if (at) {
    g.lat = at.lat;
    g.lon = at.lon;
    if (d.spotName.trim()) g.spotName = d.spotName.trim();
  }
  if (d.bag) g.bag = d.bag;
  // The field shows the weight rounded (0.26 lb); left as shown, the exact grams are kept.
  const same = prev?.weightG !== undefined && d.weight.trim() === weightInput(prev.weightG, unit, lang);
  const w = same ? prev?.weightG : parseWeight(d.weight, unit, lang);
  if (typeof w === 'number') g.weightG = w;
  return g;
}

function mapPerson(trip: Trip, personId: string, fn: (p: GiftPerson) => GiftPerson): Trip {
  const list = readGifts(trip);
  if (!list.some((p) => p.id === personId)) return trip;
  return withPeople(trip, list.map((p) => (p.id === personId ? fn(p) : p)));
}

export function upsertGift(trip: Trip, personId: string, g: Gift): Trip {
  return mapPerson(trip, personId, (p) => {
    const at = p.gifts.findIndex((x) => x.id === g.id);
    if (at < 0 && p.gifts.length >= MAX_GIFTS) return p;
    return { ...p, gifts: at >= 0 ? p.gifts.map((x, i) => (i === at ? g : x)) : [...p.gifts, g] };
  });
}

export const removeGift = (trip: Trip, personId: string, giftId: string): Trip => mapPerson(trip, personId, (p) => ({ ...p, gifts: p.gifts.filter((g) => g.id !== giftId) }));

/**
 * Moves a gift to a status (idea, bought or packed: any step, either way). Packed puts its weight in its bag's tally;
 * moving out of packed takes it out (the tally is worked out from the status, see giftWeightsByBag). The spending
 * entry "Bought" added stays in Spending whatever happens here, and stays linked so it is never added twice.
 */
export function setGiftStatus(trip: Trip, personId: string, giftId: string, status: GiftStatus, now = new Date().toISOString()): Trip {
  if (!isGiftStatus(status)) return trip;
  const g = findGift(trip, personId, giftId);
  if (!g || g.status === status) return trip;
  return upsertGift(trip, personId, { ...g, status, updatedAt: now });
}

/** The step a single tap moves to: idea -> bought -> packed -> idea. */
export const nextStatus = (s: GiftStatus): GiftStatus => (s === 'idea' ? 'bought' : s === 'bought' ? 'packed' : 'idea');

/** Puts the gift in a bag (null: no bag). */
export function setGiftBag(trip: Trip, personId: string, giftId: string, bagId: string | null, now = new Date().toISOString()): Trip {
  const g = findGift(trip, personId, giftId);
  if (!g || (g.bag ?? null) === bagId) return trip;
  const { bag: _b, ...rest } = g;
  return upsertGift(trip, personId, { ...rest, ...(bagId ? { bag: bagId } : {}), updatedAt: now });
}

// ---- Bought -> spending ----

/** The spending entry this gift added, while it is still in Spending. */
export function linkedExpense(trip: Trip, g: Gift): Expense | null {
  if (!g.expenseId) return null;
  return readSpending(trip).expenses.find((e) => e.id === g.expenseId) ?? null;
}

/** True when "Add to spending" makes sense: a price, and no spending entry for it yet. */
export const canAddSpending = (trip: Trip, g: Gift): boolean => hasPrice(g) && !linkedExpense(trip, g);

/**
 * The spending entry draft for a bought gift (category shopping, its price and currency, on `day`, with `note`, e.g.
 * "Gift for Sam: Tea towel" from the catalogue), or null when it has no price.
 */
export function spendingDraftFor(g: Gift, day: LocalDate, note: string): ExpenseDraft | null {
  if (!hasPrice(g)) return null;
  return { amount: minorToText(g.price, g.currency), currency: g.currency, category: 'shopping', day, note };
}

/** Adds the expense to Spending, links it to the gift and marks the gift bought (packed stays packed). */
export function addGiftSpending(trip: Trip, personId: string, giftId: string, e: Expense, now = new Date().toISOString()): Trip {
  const g = findGift(trip, personId, giftId);
  if (!g) return trip;
  const withExpense = upsertExpense(trip, e);
  return upsertGift(withExpense, personId, { ...g, expenseId: e.id, status: g.status === 'packed' ? 'packed' : 'bought', updatedAt: now });
}

// ---- bags ----

/** Bags a gift can go in: the trip's packing list bags (the three built-in bags when there is no list yet). */
export const giftBagChoices = (list: PackList | null | undefined): Bag[] => bagsOf(list ?? null);

export type GiftBagLoad = { grams: number; gifts: number };

/** Weight that packed gifts add to each bag (bag id -> grams and how many gifts), for bags the list has. */
export function giftWeightsByBag(trip: Trip, list: PackList | null | undefined): Record<string, GiftBagLoad> {
  const ids = new Set(giftBagChoices(list).map((b) => b.id));
  const out: Record<string, GiftBagLoad> = {};
  for (const p of readGifts(trip))
    for (const g of p.gifts) {
      if (g.status !== 'packed' || !g.bag || !ids.has(g.bag)) continue;
      const load = (out[g.bag] ??= { grams: 0, gifts: 0 });
      load.gifts++;
      load.grams += cleanGrams(g.weightG) ?? 0;
    }
  return out;
}

/** A bag's tally with its packed gifts' weight added (limit, over and left worked out again). */
export function withGiftWeight(t: Tally, grams: number): Tally {
  if (!(grams > 0)) return t;
  const weightG = t.weightG + grams;
  const out: Tally = { ...t, weightG, weighed: t.weighed + 1 };
  if (t.limitG !== undefined) {
    out.overG = Math.max(0, weightG - t.limitG);
    out.leftG = Math.max(0, t.limitG - weightG);
  }
  return out;
}

// ---- sharing ----

export type GiftTextWords = {
  title: string;
  person: (name: string, got: number, total: number) => string;
  status: (s: GiftStatus) => string;
  /** "seen at Market" */
  seenAt: (where: string) => string;
  money: (m: Money) => string;
  empty: string;
};

/**
 * The list as plain text for the share sheet: each person with how many gifts are got, then each gift with its
 * status and where it was seen. Prices only when `prices` is true (off by default, so a list shared with family
 * never says what anything cost). No map spots or bags.
 */
export function giftsText(trip: Trip, w: GiftTextWords, opts: { prices?: boolean } = {}): string {
  const people = readGifts(trip);
  const blocks = [w.title.trim()];
  for (const p of people) {
    const pr = personProgress(p, null, {});
    const lines = [w.person(p.name, pr.got, pr.total)];
    for (const g of p.gifts) {
      const bits = [`${isGot(g) ? '☑' : '☐'} ${g.what}`, w.status(g.status)];
      if (g.where) bits.push(w.seenAt(g.where));
      if (opts.prices === true && hasPrice(g)) bits.push(w.money({ currency: g.currency, amount: g.price }));
      lines.push(bits.join(' · '));
    }
    blocks.push(lines.join('\n'));
  }
  if (!people.length) blocks.push(w.empty);
  return `${blocks.join('\n\n')}\n`;
}

// ---- .satchel files ----

/** A file's `gifts` (absent on older files), cleaned like stored rows; undefined when there are none. */
export function readFileGifts(raw: unknown): GiftPerson[] | undefined {
  const list = readGifts({ gifts: raw as GiftPerson[] });
  return list.length ? list : undefined;
}

/** Imported people and gifts get new ids; a gift's spending link follows its expense's new id (dropped if gone). */
export function importGifts(list: readonly GiftPerson[] | undefined, newId: (prefix: string) => string, expenseIds: ReadonlyMap<string, string>): GiftPerson[] | undefined {
  if (!list || !list.length) return undefined;
  return list.map((p) => ({
    ...p,
    id: newId('gp'),
    gifts: p.gifts.map((g) => {
      const { expenseId, ...rest } = g;
      const mapped = expenseId ? expenseIds.get(expenseId) : undefined;
      return { ...rest, id: newId('gift'), ...(mapped ? { expenseId: mapped } : {}) };
    }),
  }));
}
