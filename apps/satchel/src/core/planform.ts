// T173 "Add plans myself" and the copy-in itinerary format: the plan types a traveller picks (Flight, Stay, Tour,
// Food, Transport, Free time, Other), how each becomes a booking, and the simple form behind it. Pure TypeScript.
//  - The type is kept on the booking as `look` (optional; read defensively here and in .satchel files) so the Today
//    timetable shows the icon that was picked, whatever the title says.
//  - Blank optional fields are left out. A plan needs a title and a day; a stay's check-out defaults to the next
//    morning (11:00), and a flight with no landing time is kept as a timed plan with the flight icon.
import { newItemDraft, validateItem, itemFromDraft, type ItemDraft } from './trips.ts';
import type { Item, ItemKind, LocalDate, Trip } from './model.ts';
import { addDays, isLocalDateTime } from './tz.ts';

export const PLAN_TYPES = ['flight', 'stay', 'tour', 'food', 'transport', 'free', 'other'] as const;
export type PlanType = (typeof PLAN_TYPES)[number];
export const isPlanType = (x: unknown): x is PlanType => typeof x === 'string' && (PLAN_TYPES as readonly string[]).includes(x);

/** A stored `look`, or undefined when absent or unreadable (never throws, never refuses a trip). */
export const readPlanLook = (x: unknown): PlanType | undefined => (isPlanType(x) ? x : undefined);

/** Words that name a type in the copy-in format and in AI replies ("Stay", "Hotel", "Free time"...). */
const TYPE_WORDS: Record<string, PlanType> = {
  flight: 'flight',
  fly: 'flight',
  plane: 'flight',
  stay: 'stay',
  hotel: 'stay',
  'check-in': 'stay',
  'check in': 'stay',
  accommodation: 'stay',
  tour: 'tour',
  activity: 'tour',
  sightseeing: 'tour',
  food: 'food',
  restaurant: 'food',
  meal: 'food',
  breakfast: 'food',
  lunch: 'food',
  dinner: 'food',
  transport: 'transport',
  transfer: 'transport',
  train: 'transport',
  bus: 'transport',
  ferry: 'transport',
  taxi: 'transport',
  car: 'transport',
  drive: 'transport',
  free: 'free',
  'free time': 'free',
  other: 'other',
  note: 'other',
};

/** The plan type a word names, or undefined. */
export function planTypeFromWord(word: string): PlanType | undefined {
  return TYPE_WORDS[word.trim().toLowerCase().replace(/\s+/g, ' ')];
}

/** What the "Add plans myself" form holds. Times are the wall clock where the plan happens ('HH:mm'). */
export type PlanForm = {
  type: PlanType;
  day: LocalDate;
  start: string;
  end: string;
  /** Stays: the check-out day (start of the morning after by default). */
  endDay: LocalDate;
  title: string;
  /** Place name or address as typed ("Town Hall, 1 Main St"). */
  place: string;
  code: string;
  notes: string;
  tz: string;
};

export type PlanFormIssue = 'title' | 'day' | 'start' | 'end' | 'endDay';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export function newPlanForm(day: LocalDate, tz: string, type: PlanType = 'tour'): PlanForm {
  return { type, day, start: type === 'stay' ? '15:00' : '09:00', end: type === 'stay' ? '11:00' : '', endDay: addDays(day, 1), title: '', place: '', code: '', notes: '', tz };
}

/** What stops a plan being saved (shown as gentle hints next to the field, never as an error dialog). */
export function planIssues(f: PlanForm): PlanFormIssue[] {
  const out: PlanFormIssue[] = [];
  if (!f.title.trim()) out.push('title');
  if (!f.day || !isLocalDateTime(`${f.day}T00:00`)) out.push('day');
  if (!HHMM.test(f.start)) out.push('start');
  if (f.end && !HHMM.test(f.end)) out.push('end');
  if (f.type === 'stay' && (!f.endDay || f.endDay <= f.day)) out.push('endDay');
  return out;
}

const KIND: Record<PlanType, ItemKind> = { flight: 'flight', stay: 'hotel', tour: 'activity', food: 'activity', transport: 'activity', free: 'activity', other: 'activity' };

/** The booking draft for a plan (blank optional fields left out). */
export function draftFromPlan(f: PlanForm): ItemDraft {
  let kind = KIND[f.type];
  if (kind === 'flight' && !f.end) kind = 'activity';
  if (f.type === 'free' && !f.end) kind = 'note';
  if (f.type === 'other' && !f.end && !f.place.trim()) kind = 'note';
  const d = newItemDraft(kind, f.day, f.tz);
  const place = f.place.trim();
  const [name, ...rest] = place.split(/,\s*/);
  d.title = f.title.trim();
  d.startDate = f.day;
  d.startTime = f.start;
  d.startTz = f.tz;
  d.endTz = f.tz;
  if (kind === 'hotel') {
    d.endDate = f.endDay;
    d.endTime = f.end || '11:00';
  } else if (f.end && kind !== 'note') {
    d.endDate = f.end < f.start ? addDays(f.day, 1) : f.day;
    d.endTime = f.end;
  } else {
    d.endDate = '';
    d.endTime = '';
  }
  if (kind === 'flight') {
    d.fromName = place;
  } else if (place && kind !== 'note') {
    d.placeName = name.trim();
    d.address = rest.join(', ').trim();
  }
  d.ref = kind === 'note' ? '' : f.code.trim();
  d.notes = [kind === 'note' && place ? place : '', kind === 'note' && f.code.trim() ? f.code.trim() : '', f.notes.trim()].filter(Boolean).join('\n');
  return d;
}

/** The booking for a plan (keeps the id, attachments and other fields of `prev` when editing). Null if not saveable. */
export function itemFromPlan(f: PlanForm, tripId: string, prev?: Item): Item | null {
  if (planIssues(f).length) return null;
  const d = draftFromPlan(f);
  if (validateItem(d).length) return null;
  return { ...itemFromDraft(d, tripId, prev), look: f.type };
}

/** The form for an existing booking (editing from the day view). */
export function planFromItem(i: Item): PlanForm {
  const type: PlanType =
    readPlanLook(i.look) ?? (i.kind === 'hotel' ? 'stay' : i.kind === 'flight' ? 'flight' : i.kind === 'note' ? 'other' : i.kind === 'activity' ? 'tour' : 'transport');
  const place = i.kind === 'flight' ? i.from?.name ?? '' : [i.place?.name, i.place?.address].filter((s) => (s ?? '').trim()).join(', ');
  return {
    type,
    day: i.start.local.slice(0, 10),
    start: i.start.local.slice(11, 16),
    end: i.end?.local.slice(11, 16) ?? '',
    endDay: i.end?.local.slice(0, 10) ?? addDays(i.start.local.slice(0, 10), 1),
    title: i.title,
    place,
    code: i.ref ?? '',
    notes: i.notes ?? '',
    tz: i.start.tz,
  };
}

/** Bookings the simple form can edit without losing anything (made with it, or plain plans and notes). */
export const planFormFits = (i: Item): boolean =>
  !!readPlanLook(i.look) || ((i.kind === 'activity' || i.kind === 'note') && !i.attachments.length && !i.checkin && !i.access);

/** Trip days the form offers (only the trip's own dates). */
export function planDays(trip: Pick<Trip, 'startDate' | 'endDate'>): LocalDate[] {
  const out: LocalDate[] = [];
  for (let d = trip.startDate; d <= trip.endDate && out.length < 400; d = addDays(d, 1)) out.push(d);
  return out;
}
