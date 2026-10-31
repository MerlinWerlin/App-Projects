// Pure trip operations (the UI store calls these) and form validation for trips and items.
import type { Item, ItemKind, LocalDate, Trip } from './model.ts';
import { ITEM_KINDS, isTransport, newId } from './model.ts';
import { encodePos, withPos } from './position.ts';
import { addDays, isLocalDateTime, isValidZone, toUtc } from './tz.ts';

export type TripDraft = { name: string; startDate: string; endDate: string; homeTz: string };
export type TripError = 'name' | 'startDate' | 'endDate' | 'endBeforeStart' | 'homeTz';

const isDate = (s: string) => isLocalDateTime(`${s}T00:00`);

export function validateTrip(d: TripDraft): TripError[] {
  const e: TripError[] = [];
  if (!d.name.trim()) e.push('name');
  if (!isDate(d.startDate)) e.push('startDate');
  if (!isDate(d.endDate)) e.push('endDate');
  if (isDate(d.startDate) && isDate(d.endDate) && d.endDate < d.startDate) e.push('endBeforeStart');
  if (!isValidZone(d.homeTz)) e.push('homeTz');
  return e;
}

export function newTripDraft(today: LocalDate, homeTz: string): TripDraft {
  return { name: '', startDate: addDays(today, 7), endDate: addDays(today, 14), homeTz };
}

/** Form state for an item: dates and times are separate text fields. End fields may be blank. */
export type ItemDraft = {
  kind: ItemKind;
  title: string;
  startDate: string;
  startTime: string;
  startTz: string;
  endDate: string;
  endTime: string;
  endTz: string;
  fromName: string;
  toName: string;
  /** T72: map positions as "lat,lon" text, '' for none (src/core/position.ts). */
  fromPos: string;
  toPos: string;
  placePos: string;
  placeName: string;
  address: string;
  localAddress: string;
  /** The place's phone (hotel front desk, activity, hire desk), shown on the address card with a Call button. */
  placePhone: string;
  ref: string;
  seat: string;
  carrier: string;
  number: string;
  notes: string;
};

export type ItemError = 'title' | 'start' | 'startTz' | 'end' | 'endTz' | 'endBeforeStart' | 'endRequired';

/** Kinds where an end (arrival, check-out, drop-off) is expected. */
export const needsEnd = (k: ItemKind) => k !== 'note' && k !== 'activity';
export const hasEnd = (k: ItemKind) => k !== 'note';
export const hasPlace = (k: ItemKind) => k === 'hotel' || k === 'activity' || k === 'car';
/** Airline, train operator, hire company: transport and car hire (FLOWS §4). */
export const hasCarrier = (k: ItemKind) => isTransport(k) || k === 'car';
/** Flight, train, bus or ferry number; and seat. Transport only. */
export const hasNumber = (k: ItemKind) => isTransport(k);
/** Booking reference: everything except notes. */
export const hasRef = (k: ItemKind) => k !== 'note';

/** True when the form differs from where it started (the discard-changes check when leaving a form). */
export function draftChanged<T extends Record<string, string>>(initial: T, current: T): boolean {
  return Object.keys({ ...initial, ...current }).some((k) => (initial[k] ?? '') !== (current[k] ?? ''));
}

const hhmm = (s: string) => /^\d{2}:\d{2}$/.test(s);

export function validateItem(d: ItemDraft): ItemError[] {
  const e: ItemError[] = [];
  if (!d.title.trim()) e.push('title');
  const start = `${d.startDate}T${d.startTime}`;
  if (!hhmm(d.startTime) || !isLocalDateTime(start)) e.push('start');
  if (!isValidZone(d.startTz)) e.push('startTz');
  const endGiven = !!(d.endDate.trim() || d.endTime.trim());
  if (hasEnd(d.kind) && endGiven) {
    const end = `${d.endDate}T${d.endTime}`;
    if (!hhmm(d.endTime) || !isLocalDateTime(end)) e.push('end');
    if (!isValidZone(d.endTz)) e.push('endTz');
    if (!e.length && toUtc({ local: end, tz: d.endTz }) < toUtc({ local: start, tz: d.startTz })) e.push('endBeforeStart');
  } else if (needsEnd(d.kind) && !endGiven) {
    e.push('endRequired');
  }
  return e;
}

export function draftFromItem(i: Item): ItemDraft {
  return {
    kind: i.kind,
    title: i.title,
    startDate: i.start.local.slice(0, 10),
    startTime: i.start.local.slice(11, 16),
    startTz: i.start.tz,
    endDate: i.end?.local.slice(0, 10) ?? '',
    endTime: i.end?.local.slice(11, 16) ?? '',
    endTz: i.end?.tz ?? i.start.tz,
    fromName: i.from?.name ?? '',
    toName: i.to?.name ?? '',
    fromPos: encodePos(i.from),
    toPos: encodePos(i.to),
    placePos: encodePos(i.place),
    placeName: i.place?.name ?? '',
    address: i.place?.address ?? '',
    localAddress: i.place?.localAddress ?? '',
    placePhone: i.place?.phone ?? '',
    ref: i.ref ?? '',
    seat: i.seat ?? '',
    carrier: i.carrier ?? '',
    number: i.number ?? '',
    notes: i.notes ?? '',
  };
}

export function newItemDraft(kind: ItemKind, date: LocalDate, tz: string): ItemDraft {
  const time = kind === 'hotel' ? '15:00' : '09:00';
  const endTime = kind === 'hotel' ? '11:00' : '';
  return {
    kind,
    title: '',
    startDate: date,
    startTime: time,
    startTz: tz,
    endDate: kind === 'hotel' ? addDays(date, 1) : '',
    endTime,
    endTz: tz,
    fromName: '',
    toName: '',
    fromPos: '',
    toPos: '',
    placePos: '',
    placeName: '',
    address: '',
    localAddress: '',
    placePhone: '',
    ref: '',
    seat: '',
    carrier: '',
    number: '',
    notes: '',
  };
}

const opt = (s: string) => (s.trim() ? s.trim() : undefined);

/** Item from a valid draft (call validateItem first). Keeps the id, attachments and place ids of `prev`. */
export function itemFromDraft(d: ItemDraft, tripId: string, prev?: Item): Item {
  const endGiven = hasEnd(d.kind) && !!(d.endDate.trim() && d.endTime.trim());
  const transport = isTransport(d.kind);
  const place = hasPlace(d.kind) && (d.placeName.trim() || d.address.trim() || d.localAddress.trim() || d.placePhone.trim() || d.placePos.trim())
    ? withPos(
        {
          ...(prev?.place ?? {}),
          id: prev?.place?.id ?? newId('pl'),
          name: d.placeName.trim() || d.title.trim(),
          address: opt(d.address),
          localAddress: opt(d.localAddress),
          phone: opt(d.placePhone),
        },
        d.placePos,
      )
    : undefined;
  // T72: a journey's from / to keep what the form doesn't show (address, and the position unless it was removed).
  const end = (name: string, pos: string, old: Item['from']) =>
    transport && (name.trim() || pos.trim()) ? withPos({ ...(old ?? {}), id: old?.id ?? newId('pl'), name: name.trim() || d.title.trim() }, pos) : undefined;
  // T85: start from the previous booking so fields the form doesn't show (and any added to Item later) are kept;
  // the airport fields belong to flights only (the form sets them with withAirport, src/core/leaveby.ts).
  const { airport: _airport, ...kept } = prev ?? ({} as Partial<Item>);
  return {
    ...kept,
    ...(d.kind === 'flight' && prev?.airport !== undefined ? { airport: prev.airport } : {}),
    id: prev?.id ?? newId('it'),
    tripId,
    kind: d.kind,
    title: d.title.trim(),
    start: { local: `${d.startDate}T${d.startTime}`, tz: d.startTz },
    end: endGiven ? { local: `${d.endDate}T${d.endTime}`, tz: d.endTz } : undefined,
    from: end(d.fromName, d.fromPos, prev?.from),
    to: end(d.toName, d.toPos, prev?.to),
    place,
    // Fields that don't belong to the kind are dropped, so switching a draft from flight to hotel can't leave a
    // hidden seat or airline behind.
    ref: hasRef(d.kind) ? opt(d.ref) : undefined,
    seat: hasNumber(d.kind) ? opt(d.seat) : undefined,
    carrier: hasCarrier(d.kind) ? opt(d.carrier) : undefined,
    number: hasNumber(d.kind) ? opt(d.number) : undefined,
    notes: opt(d.notes),
    attachments: prev?.attachments ?? [],
  };
}

// ---- immutable list operations used by the store ----

export const upsertTrip = (trips: Trip[], t: Trip): Trip[] =>
  trips.some((x) => x.id === t.id) ? trips.map((x) => (x.id === t.id ? t : x)) : [...trips, t];

export const removeTrip = (trips: Trip[], id: string): Trip[] => trips.filter((t) => t.id !== id);

export function upsertItem(trips: Trip[], item: Item): Trip[] {
  return trips.map((t) => {
    if (t.id !== item.tripId) return t;
    const items = t.items.some((i) => i.id === item.id) ? t.items.map((i) => (i.id === item.id ? item : i)) : [...t.items, item];
    // A booking outside the trip's dates stretches the trip to include it.
    const dates = [item.start.local.slice(0, 10), item.end?.local.slice(0, 10)].filter((x): x is string => !!x);
    const startDate = dates.reduce((a, b) => (b < a ? b : a), t.startDate);
    const endDate = dates.reduce((a, b) => (b > a ? b : a), t.endDate);
    return { ...t, items, startDate, endDate };
  });
}

export const removeItem = (trips: Trip[], tripId: string, itemId: string): Trip[] =>
  trips.map((t) => (t.id === tripId ? { ...t, items: t.items.filter((i) => i.id !== itemId) } : t));

export function tripFromDraft(d: TripDraft, prev?: Trip, now = new Date().toISOString()): Trip {
  return {
    // Run 90: keep every other field of the trip (journal, ideas, companions, settlements and anything added
    // later) so editing the name or dates never drops data; the fields below are the ones the edit form owns.
    ...(prev ?? {}),
    id: prev?.id ?? newId('trip'),
    name: d.name.trim(),
    startDate: d.startDate,
    endDate: d.endDate,
    homeTz: d.homeTz,
    items: prev?.items ?? [],
    ...(prev?.places ? { places: prev.places } : {}),
    demo: prev?.demo,
    createdAt: prev?.createdAt ?? now,
    // T54: editing the trip's name or dates keeps its spending.
    ...(prev?.budget ? { budget: prev.budget } : {}),
    ...(prev?.rates ? { rates: prev.rates } : {}),
    ...(prev?.ratesUpdated ? { ratesUpdated: prev.ratesUpdated } : {}),
    ...(prev?.expenses ? { expenses: prev.expenses } : {}),
    // T83: and its cover choice (trip-edit then applies the picker's value with withCover).
    ...(prev?.cover ? { cover: prev.cover } : {}),
  };
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isStamp = (x: unknown) => isObj(x) && typeof x.local === 'string' && isLocalDateTime(x.local) && typeof x.tz === 'string';

/**
 * The saved trips list, read back from storage. `null` means the saved data can't be read at all (cut short or
 * damaged): the caller must keep those bytes and never save over them as if there were no trips. Trips or items
 * with missing essentials are dropped one by one, so one bad entry can't take down the trips list. An item whose
 * saved zone this phone can't read (TR-021 load case, T43) is kept as it is: dropping it would delete it for good on
 * the next save. The timeline shows it with "Time zone not recognised — edit to fix" (timeline.ts zonesReadable).
 */
export function parseStoredTrips(raw: string | null): Trip[] | null {
  if (raw == null || raw === '') return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(data)) return null;
  const out: Trip[] = [];
  for (const t of data) {
    if (!isObj(t) || typeof t.id !== 'string' || typeof t.name !== 'string' || !isDate(String(t.startDate)) || !isDate(String(t.endDate))) continue;
    const items = (Array.isArray(t.items) ? t.items : []).filter(
      (i): i is Item => isObj(i) && typeof i.id === 'string' && (ITEM_KINDS as readonly unknown[]).includes(i.kind) && typeof i.title === 'string' && isStamp(i.start) && (i.end === undefined || isStamp(i.end)),
    );
    out.push({
      ...(t as unknown as Trip),
      homeTz: typeof t.homeTz === 'string' ? t.homeTz : 'UTC',
      items: items.map((i) => ({ ...i, tripId: t.id as string, attachments: Array.isArray(i.attachments) ? i.attachments : [] })),
    });
  }
  return out;
}

/**
 * Trips read back from the copy kept aside when the saved list couldn't be read ("Try again" on the Trips home):
 * the ones not already on the phone are added; a trip with the same id is never overwritten (what is on the phone
 * now is newer).
 */
export function mergeRecovered(current: Trip[], recovered: Trip[]): Trip[] {
  const have = new Set(current.map((t) => t.id));
  const extra = recovered.filter((t) => !have.has(t.id));
  return extra.length ? [...current, ...extra] : current;
}

/** Trips ordered for the list: active and upcoming first (soonest first), then past (most recent first). */
export function orderTrips(trips: Trip[], today: LocalDate): Trip[] {
  const live = trips.filter((t) => t.endDate >= today).sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0));
  const past = trips.filter((t) => t.endDate < today).sort((a, b) => (a.endDate > b.endDate ? -1 : a.endDate < b.endDate ? 1 : 0));
  return [...live, ...past];
}
