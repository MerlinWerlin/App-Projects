// Trip reminders (docs/REMINDERS.md): which local notifications to schedule for the coming days. Pure TS, no React
// Native, so `node --test` covers it; src/native/notifications.ts schedules what this returns.
//
// One reminder per slot, a fixed lead time before the plan (in the plan's own zone, so "leaves at 09:40" is what the
// ticket says): flights 3 h before departure, train / ferry / bus 1 h, hotel check-in 2 h before arrival and check-out
// 1 h before it ends, car pick-up 1 h, activities 30 min. Notes get none. Demo trips, past times, items with a bad
// zone or time, and anything beyond the horizon are skipped. At most MAX_REMINDERS (iOS keeps 64 pending per app).
// Lead times live in LEAD_MINUTES / CHECKOUT_LEAD_MINUTES below; opts can override them per call (tests, tuning).
import { formatTime } from './format.ts';
import type { Item, ItemKind, Stamp, Trip } from './model.ts';
import { isLocalDateTime, isValidZone, toUtc } from './tz.ts';

const MIN = 60_000;
const DAY = 24 * 60 * MIN;

/** Custom sound files, bundled by the expo-notifications plugin (app.json) from assets/sounds/. */
export const REMINDER_SOUNDS = {
  chime: 'satchel_chime.wav',
  depart: 'satchel_depart.wav',
  checkin: 'satchel_checkin.wav',
} as const;
export type ReminderSound = (typeof REMINDER_SOUNDS)[keyof typeof REMINDER_SOUNDS];

/** Kinds that get a reminder at their start, and how many minutes before. Notes have none. */
export type RemindedKind = Exclude<ItemKind, 'note'>;
export const LEAD_MINUTES: Record<RemindedKind, number> = {
  flight: 180,
  train: 60,
  ferry: 60,
  bus: 60,
  hotel: 120,
  car: 60,
  activity: 30,
};
/** Hotel check-out: this long before the stay's end time. */
export const CHECKOUT_LEAD_MINUTES = 60;

/** iOS keeps 64 pending local notifications per app; stay under it. */
export const MAX_REMINDERS = 60;
/** How far ahead to schedule. Re-planned whenever trips change and each time the app comes to the front. */
export const HORIZON_DAYS = 14;
/** Every id starts with this, so cancelling ours never touches anything else. */
export const REMINDER_ID_PREFIX = 'satchel-';

export type ReminderSlot = 'depart' | 'checkin' | 'checkout' | 'pickup' | 'start';

export type Params = Record<string, string | number>;

export type PlannedReminder = {
  /** Deterministic: satchel-<itemId>-<slot>. */
  id: string;
  /** When to fire, UTC ms. */
  at: number;
  itemId: string;
  tripId: string;
  kind: RemindedKind;
  slot: ReminderSlot;
  sound: ReminderSound;
  titleKey: string;
  titleParams: Params;
  bodyKey: string;
  bodyParams: Params;
};

export type PlanOptions = {
  horizonDays?: number;
  max?: number;
  lead?: Partial<Record<RemindedKind, number>>;
  checkoutLead?: number;
};

const TRANSPORT = new Set<ItemKind>(['flight', 'train', 'ferry', 'bus']);

export function soundFor(kind: ItemKind): ReminderSound {
  if (TRANSPORT.has(kind)) return REMINDER_SOUNDS.depart;
  if (kind === 'hotel' || kind === 'car') return REMINDER_SOUNDS.checkin;
  return REMINDER_SOUNDS.chime;
}

export const reminderId = (itemId: string, slot: ReminderSlot) => `${REMINDER_ID_PREFIX}${itemId}-${slot}`;
export const isOurReminderId = (id: unknown): boolean => typeof id === 'string' && id.startsWith(REMINDER_ID_PREFIX);

/** UTC ms of a stamp, or null when its time or zone can't be read. */
function stampMs(s: Stamp | undefined): number | null {
  if (!s || typeof s.local !== 'string' || typeof s.tz !== 'string') return null;
  if (!isLocalDateTime(s.local) || !isValidZone(s.tz)) return null;
  const ms = toUtc(s);
  return Number.isFinite(ms) ? ms : null;
}

const clean = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** The words for one reminder (catalogue keys + params). Every body has a "no place" variant. */
function words(item: Item, slot: ReminderSlot, leadMin: number): Pick<PlannedReminder, 'titleKey' | 'titleParams' | 'bodyKey' | 'bodyParams'> {
  const title = clean(item.title);
  const time = formatTime(slot === 'checkout' && item.end ? item.end.local : item.start.local);
  const named = (key: string, place: string, extra: Params = {}): { bodyKey: string; bodyParams: Params } =>
    place ? { bodyKey: `${key}`, bodyParams: { place, time, ...extra } } : { bodyKey: `${key}NoPlace`, bodyParams: { time, ...extra } };
  const head: { titleKey: string; titleParams: Params } = title ? { titleKey: 'reminders.title', titleParams: { title } } : { titleKey: `reminders.${item.kind}.fallbackTitle`, titleParams: {} };
  switch (slot) {
    case 'depart':
      return { ...head, ...named(`reminders.${item.kind}.body`, clean(item.to?.name)) };
    case 'checkin':
      return { ...head, ...named('reminders.hotel.checkinBody', clean(item.place?.name) || title) };
    case 'checkout':
      return { ...head, ...named('reminders.hotel.checkoutBody', clean(item.place?.name) || title) };
    case 'pickup':
      return { ...head, ...named('reminders.car.body', clean(item.place?.name) || clean(item.from?.name)) };
    case 'start': {
      const what = title || '';
      const place = clean(item.place?.name);
      const titleOut = { titleKey: 'reminders.activity.title', titleParams: { time } };
      if (!what) return { ...titleOut, ...named('reminders.activity.bodyUntitled', place, { minutes: leadMin }) };
      return { ...titleOut, ...named('reminders.activity.body', place, { title: what, minutes: leadMin }) };
    }
  }
}

/** The slots an item gets, with the moment each one is about (before the lead time is taken off). */
function slotsFor(item: Item): { slot: ReminderSlot; base: Stamp | undefined; leadKey: 'start' | 'checkout' }[] {
  switch (item.kind) {
    case 'flight':
    case 'train':
    case 'ferry':
    case 'bus':
      return [{ slot: 'depart', base: item.start, leadKey: 'start' }];
    case 'hotel':
      return [
        { slot: 'checkin', base: item.start, leadKey: 'start' },
        ...(item.end ? [{ slot: 'checkout' as const, base: item.end, leadKey: 'checkout' as const }] : []),
      ];
    case 'car':
      return [{ slot: 'pickup', base: item.start, leadKey: 'start' }];
    case 'activity':
      return [{ slot: 'start', base: item.start, leadKey: 'start' }];
    default:
      return [];
  }
}

/**
 * The reminders to schedule now, soonest first: only times after `nowMs` and within the horizon, never for demo
 * trips or notes, at most `max`. Same input, same output (ids are stable, so re-planning replaces in place).
 */
export function planReminders(trips: readonly Trip[], nowMs: number, opts: PlanOptions = {}): PlannedReminder[] {
  const horizonEnd = nowMs + (opts.horizonDays ?? HORIZON_DAYS) * DAY;
  const max = Math.max(0, Math.min(opts.max ?? MAX_REMINDERS, MAX_REMINDERS));
  const lead = { ...LEAD_MINUTES, ...(opts.lead ?? {}) };
  const checkoutLead = opts.checkoutLead ?? CHECKOUT_LEAD_MINUTES;
  const out: PlannedReminder[] = [];
  const seen = new Set<string>();
  for (const trip of Array.isArray(trips) ? trips : []) {
    if (!trip || trip.demo || !Array.isArray(trip.items)) continue;
    for (const item of trip.items) {
      if (!item || typeof item.id !== 'string' || item.kind === 'note') continue;
      const kind = item.kind as RemindedKind;
      if (!(kind in LEAD_MINUTES)) continue;
      for (const s of slotsFor(item)) {
        const base = stampMs(s.base);
        if (base === null) continue;
        const leadMin = s.leadKey === 'checkout' ? checkoutLead : lead[kind];
        const at = base - leadMin * MIN;
        if (at <= nowMs || at > horizonEnd) continue;
        const id = reminderId(item.id, s.slot);
        if (seen.has(id)) continue;
        seen.add(id);
        out.push({ id, at, itemId: item.id, tripId: trip.id, kind, slot: s.slot, sound: soundFor(kind), ...words(item, s.slot, leadMin) });
      }
    }
  }
  out.sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return out.slice(0, max);
}

/** True when a non-demo trip has a plan that would get a reminder in the horizon (for the Itinerary tab offer). */
export const hasUpcomingReminders = (trips: readonly Trip[], nowMs: number): boolean => planReminders(trips, nowMs, { max: 1 }).length > 0;

/** Every catalogue key planReminders can return (the i18n test checks each exists). */
export const REMINDER_KEYS: readonly string[] = [
  'reminders.title',
  ...(['flight', 'train', 'ferry', 'bus', 'hotel', 'car', 'activity'] as const).map((k) => `reminders.${k}.fallbackTitle`),
  ...(['flight', 'train', 'ferry', 'bus'] as const).flatMap((k) => [`reminders.${k}.body`, `reminders.${k}.bodyNoPlace`]),
  'reminders.hotel.checkinBody',
  'reminders.hotel.checkinBodyNoPlace',
  'reminders.hotel.checkoutBody',
  'reminders.hotel.checkoutBodyNoPlace',
  'reminders.car.body',
  'reminders.car.bodyNoPlace',
  'reminders.activity.title',
  'reminders.activity.body',
  'reminders.activity.bodyNoPlace',
  'reminders.activity.bodyUntitled',
  'reminders.activity.bodyUntitledNoPlace',
];
