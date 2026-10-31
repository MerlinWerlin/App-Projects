// T101 Medicine times across time zones (owner-1031 D, deepen Emergency + Trips). Pure TypeScript for app/meds.tsx,
// the Emergency tab / trip screen entry rows and the "next dose" line on Your day.
//  - The traveller's medicines (name, dose text, and either fixed clock times or "every N hours" from a first time),
//    all on the home clock. They live only on this phone under MEDS_KEY (AsyncStorage); they are never part of a Trip
//    and so never part of a .satchel trip file (guard test in medtimes.test.ts). Nothing is shared unless the person
//    taps Share on the screen.
//  - Stops come only from the bookings' own IANA zones (like jetlag.ts), never from the phone's zone.
//  - "Keep home time": the same moment as at home, shown on the stop's clock (DST-aware per date, date line safe).
//  - "Shift to local time": fixed clock times move straight to the same clock locally; every-N-hours medicines move
//    gradually, one gap a day changed by at most the chosen step (1 or 2 h), never shorter than the medicine's own
//    minimum gap, until the doses sit on the local clock.
//  - Doses inside the usual sleep hours are flagged. All of it is general guidance, never medical advice: the screen
//    always shows the "ask your doctor or pharmacist" line.
import { isTransport, type LocalDate, type LocalDateTime, type Trip } from './model.ts';
import { DEFAULT_BED, DEFAULT_WAKE, hm, homeZone } from './jetlag.ts';
import { sortItems, span, zonesReadable } from './timeline.ts';
import { addDays, daysBetween, fromUtc, isValidZone, localDate, localTime, offsetMinutes, toUtc } from './tz.ts';

/** The one storage key for the medicine list (this phone only, never in a trip file). */
export const MEDS_KEY = 'satchel.meds.v1';
export const MAX_MEDS = 12;
export const MAX_TIMES = 8;
export const NAME_MAX = 60;
export const DOSE_MAX = 60;
/** "Every N hours" choices: divisors of a day, so the daily clock times repeat. */
export const EVERY_CHOICES = [3, 4, 6, 8, 12, 24] as const;
/** Largest change to one gap per day when shifting to local time (1 h or 2 h). */
export const STEP_CHOICES = [60, 120] as const;
export const DEFAULT_STEP = 60;
/** A zone visited for less than this (a connection) is not shown as a stop. */
export const MIN_STOP_MS = 6 * 3_600_000;
/** How many days the gradual shift is worked out for at most. */
export const MAX_SHIFT_DAYS = 30;

const MIN = 60_000;
const DAY_MS = 86_400_000;

export type MedMode = 'fixed' | 'interval';
export type MedPlan = 'home' | 'local';

/** Fixed: `times` are the home clock times. Interval: every `everyHours` from `firstAt`, gaps never below `minGapMin`. */
export type Med = {
  id: string;
  name: string;
  dose: string;
  mode: MedMode;
  times: string[];
  everyHours?: number;
  firstAt?: string;
  minGapMin?: number;
};

export type MedStore = { meds: Med[]; plans: Record<string, MedPlan>; stepMin: number };
export const EMPTY_MEDS: MedStore = { meds: [], plans: {}, stepMin: DEFAULT_STEP };

const pad = (n: number) => String(n).padStart(2, '0');
const mod = (n: number, m: number) => ((n % m) + m) % m;
const clockOf = (min: number) => `${pad(Math.floor(mod(min, 1440) / 60))}:${pad(mod(min, 1440) % 60)}`;

// ----------------------------------------------------------------------------------------------- input

/** A typed time to 'HH:mm' ("8" -> 08:00, "830" -> 08:30, "8:30", "20.15"); null when it is not a clock time. */
export function parseClock(raw: string): string | null {
  const s = raw.trim().replace(/[.h]/i, ':');
  let h: number;
  let m: number;
  let x = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (x) {
    h = Number(x[1]);
    m = Number(x[2]);
  } else if ((x = /^(\d{1,2})$/.exec(s))) {
    h = Number(x[1]);
    m = 0;
  } else if ((x = /^(\d{1,2})(\d{2})$/.exec(s))) {
    h = Number(x[1]);
    m = Number(x[2]);
  } else return null;
  return h < 24 && m < 60 ? `${pad(h)}:${pad(m)}` : null;
}

const validClock = (s: unknown): s is string => typeof s === 'string' && /^\d{2}:\d{2}$/.test(s) && parseClock(s) === s;

/** Shortest-gap choices for an every-N-hours medicine: up to 2 h shorter, in half hours, never below half the gap. */
export function minGapChoices(everyHours: number): number[] {
  const p = everyHours * 60;
  return [p - 120, p - 90, p - 60, p - 30, p].filter((g) => g >= p / 2);
}
export const defaultMinGap = (everyHours: number) => everyHours * 60 - 60;

const clampGap = (everyHours: number, g: unknown): number => {
  const choices = minGapChoices(everyHours);
  return typeof g === 'number' && choices.includes(g) ? g : defaultMinGap(everyHours);
};

const cleanTimes = (raw: unknown): string[] =>
  Array.isArray(raw) ? [...new Set(raw.filter(validClock))].sort().slice(0, MAX_TIMES) : [];

/** One stored medicine, cleaned; null when it can't be used. */
export function cleanMed(raw: unknown): Med | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const name = typeof r.name === 'string' ? r.name.trim().slice(0, NAME_MAX) : '';
  if (typeof r.id !== 'string' || !r.id || !name) return null;
  const dose = typeof r.dose === 'string' ? r.dose.trim().slice(0, DOSE_MAX) : '';
  if (r.mode === 'interval') {
    const every = Number(r.everyHours);
    if (!(EVERY_CHOICES as readonly number[]).includes(every) || !validClock(r.firstAt)) return null;
    const med: Med = { id: r.id, name, dose, mode: 'interval', times: [], everyHours: every, firstAt: r.firstAt, minGapMin: clampGap(every, r.minGapMin) };
    return { ...med, times: dailyTimes(med) };
  }
  const times = cleanTimes(r.times);
  return times.length ? { id: r.id, name, dose, mode: 'fixed', times } : null;
}

/** The stored value, cleaned on every read (unknown shapes give the empty store). */
export function cleanStore(raw: unknown): MedStore {
  if (!raw || typeof raw !== 'object') return EMPTY_MEDS;
  const r = raw as Record<string, unknown>;
  const seen = new Set<string>();
  const meds: Med[] = [];
  for (const m of Array.isArray(r.meds) ? r.meds : []) {
    const c = cleanMed(m);
    if (c && !seen.has(c.id) && meds.length < MAX_MEDS) {
      seen.add(c.id);
      meds.push(c);
    }
  }
  const plans: Record<string, MedPlan> = {};
  if (r.plans && typeof r.plans === 'object') {
    for (const [k, v] of Object.entries(r.plans as Record<string, unknown>)) if (v === 'home' || v === 'local') plans[k] = v;
  }
  const stepMin = (STEP_CHOICES as readonly number[]).includes(Number(r.stepMin)) ? Number(r.stepMin) : DEFAULT_STEP;
  return { meds, plans, stepMin };
}

export type MedDraft = { name: string; dose: string; mode: MedMode; times: string[]; everyHours: number; firstAt: string; minGapMin: number };
export type MedError = 'name' | 'times' | 'firstAt';

export const newMedDraft = (): MedDraft => ({ name: '', dose: '', mode: 'fixed', times: [], everyHours: 8, firstAt: '08:00', minGapMin: defaultMinGap(8) });

export const draftFromMed = (m: Med): MedDraft => ({
  name: m.name,
  dose: m.dose,
  mode: m.mode,
  times: m.mode === 'fixed' ? [...m.times] : [],
  everyHours: m.everyHours ?? 8,
  firstAt: m.firstAt ?? '08:00',
  minGapMin: m.minGapMin ?? defaultMinGap(m.everyHours ?? 8),
});

export function validateMed(d: MedDraft): MedError[] {
  const e: MedError[] = [];
  if (!d.name.trim()) e.push('name');
  if (d.mode === 'fixed' && !cleanTimes(d.times).length) e.push('times');
  if (d.mode === 'interval' && !validClock(d.firstAt)) e.push('firstAt');
  return e;
}

/** The draft as a stored medicine, or the problems with it. */
export function medFromDraft(d: MedDraft, id: string): { ok: true; med: Med } | { ok: false; errors: MedError[] } {
  const errors = validateMed(d);
  if (errors.length) return { ok: false, errors };
  const med = cleanMed({ id, ...d });
  return med ? { ok: true, med } : { ok: false, errors: ['times'] };
}

/** Adds or replaces (by id); false when the list is full. */
export function upsertMed(list: readonly Med[], med: Med): Med[] | null {
  if (list.some((m) => m.id === med.id)) return list.map((m) => (m.id === med.id ? med : m));
  return list.length >= MAX_MEDS ? null : [...list, med];
}
export const removeMed = (list: readonly Med[], id: string): Med[] => list.filter((m) => m.id !== id);

// ----------------------------------------------------------------------------------------------- schedule

/** The medicine's daily times on the home clock, earliest first. */
export function dailyTimes(med: Med): string[] {
  if (med.mode === 'fixed') return [...med.times].sort();
  const first = hm(med.firstAt ?? '') ?? 0;
  const p = (med.everyHours ?? 24) * 60;
  const out: string[] = [];
  for (let k = 0; k * p < 1440; k++) out.push(clockOf(first + k * p));
  return out.sort();
}

/** Whether a clock time falls inside the usual sleep hours (bed to wake, across midnight when bed is later). */
export function isNight(clock: string, bed = DEFAULT_BED, wake = DEFAULT_WAKE): boolean {
  const m = hm(clock);
  const b = hm(bed) ?? hm(DEFAULT_BED)!;
  const w = hm(wake) ?? hm(DEFAULT_WAKE)!;
  if (m === null || b === w) return false;
  return b > w ? m >= b || m < w : m >= b && m < w;
}

export type Converted = { home: string; local: string; dayShift: number };

/** A home clock time on a home date, as the same moment on another zone's clock (dayShift: local date − home date). */
export function homeToLocal(time: string, homeDate: LocalDate, homeTz: string, localTz: string): Converted {
  const utc = toUtc({ local: `${homeDate}T${time}`, tz: homeTz });
  const local = fromUtc(utc, localTz);
  return { home: time, local: localTime(local), dayShift: daysBetween(homeDate, localDate(local)) };
}

// ----------------------------------------------------------------------------------------------- stops

export type MedStop = {
  tz: string;
  startUtc: number;
  endUtc: number;
  firstDate: LocalDate;
  lastDate: LocalDate;
  /** Stop clock minus home clock at arrival, in minutes (not folded: Kiritimati vs Honolulu is +1440). */
  diffMin: number;
};

/**
 * The zones the bookings put the traveller in, away from home, in time order: a journey lands you in its arrival
 * zone, anything else sits in its own zone. Consecutive bookings in one zone are one stop; a zone with less than
 * MIN_STOP_MS on the ground before the next journey leaves (a connection) is left out. The last stop runs to the end of the trip's last day.
 */
export function medStops(trip: Pick<Trip, 'items' | 'endDate'>, homeTz: string): MedStop[] {
  const events: { utc: number; tz: string; leave: boolean }[] = [];
  for (const i of sortItems(trip.items)) {
    if (!zonesReadable(i) || i.kind === 'note') continue;
    const s = span(i);
    const journey = !!i.end && isTransport(i.kind);
    events.push({ utc: s.start, tz: i.start.tz, leave: journey });
    if (i.end && i.kind !== 'hotel') events.push({ utc: s.end, tz: i.end.tz, leave: false });
  }
  events.sort((a, b) => a.utc - b.utc);
  // `ground`: when the stay on the ground ends (the last journey out of the zone departs), for the connection test.
  const segs: { tz: string; start: number; ground: number | null }[] = [];
  for (const e of events) {
    if (!segs.length || segs[segs.length - 1].tz !== e.tz) segs.push({ tz: e.tz, start: e.utc, ground: null });
    segs[segs.length - 1].ground = e.leave ? e.utc : null;
  }
  const out: MedStop[] = [];
  segs.forEach((s, n) => {
    const tripEnd = isValidZone(s.tz) ? toUtc({ local: `${addDays(trip.endDate, 1)}T00:00`, tz: s.tz }) : s.start;
    const end = n + 1 < segs.length ? segs[n + 1].start : Math.max(tripEnd, s.start);
    if (s.tz === homeTz || !isValidZone(s.tz) || (s.ground ?? end) - s.start < MIN_STOP_MS) return;
    out.push({
      tz: s.tz,
      startUtc: s.start,
      endUtc: end,
      firstDate: localDate(fromUtc(s.start, s.tz)),
      lastDate: localDate(fromUtc(end - MIN, s.tz)),
      diffMin: offsetMinutes(s.tz, s.start) - offsetMinutes(homeTz, s.start),
    });
  });
  return out;
}

/** The stop the traveller is at by the bookings at `now`, or null (at home or between stops). */
export const stopAt = (stops: readonly MedStop[], now: number): MedStop | null => stops.find((s) => now >= s.startUtc && now < s.endUtc) ?? null;

export type HomeRow = Converted & { night: boolean; later: (Converted & { from: LocalDate; night: boolean }) | null };

/**
 * "Keep home time" for one medicine at a stop: each home time on the stop's clock, worked out on the first day
 * there. When a clock change (DST at home or there) moves it during the stop, `later` says from which home date.
 */
export function keepHomeRows(med: Med, stop: MedStop, homeTz: string, bed = DEFAULT_BED, wake = DEFAULT_WAKE): HomeRow[] {
  const first = localDate(fromUtc(stop.startUtc, homeTz));
  const last = localDate(fromUtc(stop.endUtc - MIN, homeTz));
  const days = Math.min(Math.max(0, daysBetween(first, last)), 120);
  return dailyTimes(med).map((time) => {
    const c = homeToLocal(time, first, homeTz, stop.tz);
    let later: HomeRow['later'] = null;
    for (let d = 1; d <= days && !later; d++) {
      const date = addDays(first, d);
      const x = homeToLocal(time, date, homeTz, stop.tz);
      if (x.local !== c.local || x.dayShift !== c.dayShift) later = { ...x, from: date, night: isNight(x.local, bed, wake) };
    }
    return { ...c, night: isNight(c.local, bed, wake), later };
  });
}

export type LocalRow = { local: string; night: boolean };

/** "Shift to local time" for a fixed-times medicine: the same clock times on the stop's clock. */
export const shiftLocalRows = (med: Med, bed = DEFAULT_BED, wake = DEFAULT_WAKE): LocalRow[] =>
  dailyTimes(med).map((local) => ({ local, night: isNight(local, bed, wake) }));

/** How far the first gap after arriving changes when fixed times jump straight to the local clock (folded, minutes). */
export function jumpChangeMin(stop: Pick<MedStop, 'diffMin'>): number {
  let s = stop.diffMin;
  while (s > 720) s -= 1440;
  while (s <= -720) s += 1440;
  return s;
}

// ----------------------------------------------------------------------------------------------- gradual shift

export type ShiftDose = { utc: number; local: LocalDateTime; /** minutes since the previous dose */ gapMin: number | null; changed: boolean; night: boolean };
export type ShiftDay = { date: LocalDate; doses: ShiftDose[] };
export type ShiftPlan = {
  /** Total move: + later (gaps lengthened), − earlier (gaps shortened), 0 already on the local clock. */
  shiftMin: number;
  /** The largest change to one gap actually used (the step, or less when the minimum gap allows less). */
  stepMin: number;
  days: ShiftDay[];
  /** First dose on the local clock, or null when the shift isn't finished by `endUtc`. */
  reachedUtc: number | null;
  reachedOn: LocalDate | null;
  /** T104: local clock changes during the stay (local date, minutes the clock moved: +60 spring forward). */
  clockChanges: { on: LocalDate; min: number }[];
};

/**
 * Moves an every-N-hours medicine from the home clock to the same clock times in `localTz`, starting with the first
 * home-schedule dose at or after `startUtc`. One gap per local day (the first dose of each new day) changes by at
 * most `stepMax` minutes; a shortened gap never goes below the medicine's minimum gap. It moves whichever way is
 * shorter, and later (longer gaps) on a tie or when the minimum gap leaves no room to shorten. Doses are listed up
 * to `endUtc` (and at most MAX_SHIFT_DAYS days). T104: a clock change in `localTz` during the stay (DST) is followed:
 * the target moves with the local clock and the doses move to it the same gradual way (whichever way is shorter),
 * even after the shift had already finished; `clockChanges` lists them.
 */
export function gradualShift(
  med: Med,
  homeTz: string,
  localTz: string,
  startUtc: number,
  endUtc: number,
  stepMax: number = DEFAULT_STEP,
  bed = DEFAULT_BED,
  wake = DEFAULT_WAKE,
): ShiftPlan {
  const every = med.everyHours ?? 24;
  const pMin = every * 60;
  const P = pMin * MIN;
  const firstAt = med.firstAt ?? '08:00';
  const minGap = Math.min(pMin, Math.max(pMin / 2, med.minGapMin ?? defaultMinGap(every)));
  const anchorH = toUtc({ local: `${localDate(fromUtc(startUtc, homeTz))}T${firstAt}`, tz: homeTz });
  const t0 = anchorH + Math.ceil((startUtc - anchorH) / P) * P;
  const anchorL = toUtc({ local: `${localDate(fromUtc(startUtc, localTz))}T${firstAt}`, tz: localTz });
  const raw = Math.round(mod(anchorL - t0, P) / MIN); // minutes later the local schedule sits, in [0, P)
  const earlierRoom = Math.min(stepMax, pMin - minGap);
  /** The signed move for `r` minutes later (in [0, P)): the shorter way, later on a tie or with no room to shorten. */
  const way = (r: number) => (r === 0 ? 0 : pMin - r < r && earlierRoom > 0 ? -(pMin - r) : r);
  const stepFor = (move: number) => (move < 0 ? earlierRoom : Math.max(0, stepMax));
  const shiftMin = way(raw);
  let step = stepFor(shiftMin);
  const firstStep = step;
  const stop = Math.min(endUtc, startUtc + MAX_SHIFT_DAYS * DAY_MS);

  const doses: ShiftDose[] = [];
  const clockChanges: ShiftPlan['clockChanges'] = [];
  const push = (utc: number, gap: number | null, changed: boolean) => {
    const local = fromUtc(utc, localTz);
    doses.push({ utc, local, gapMin: gap, changed, night: isNight(localTime(local), bed, wake) });
  };
  let remaining = shiftMin;
  let reachedUtc: number | null = shiftMin === 0 ? t0 : null;
  if (t0 <= stop) push(t0, null, false);
  let prev = t0;
  let offPrev = offsetMinutes(localTz, t0);
  for (let guard = 0; guard < 2000; guard++) {
    let next = prev + P;
    const off = offsetMinutes(localTz, next);
    if (off !== offPrev) {
      // The local clock moved by `moved`: the same local times now come `moved` minutes sooner (spring forward).
      const moved = off - offPrev;
      offPrev = off;
      clockChanges.push({ on: localDate(fromUtc(next, localTz)), min: moved });
      const was = remaining;
      remaining = way(mod(remaining - moved, pMin));
      step = stepFor(remaining);
      if (remaining !== 0) reachedUtc = null;
      else if (was !== 0) reachedUtc = next;
    }
    let delta = 0;
    if (remaining !== 0 && step > 0 && localDate(fromUtc(next, localTz)) !== localDate(fromUtc(prev, localTz))) {
      delta = Math.sign(remaining) * Math.min(Math.abs(remaining), step);
      next += delta * MIN;
      remaining -= delta;
      if (remaining === 0) reachedUtc = next;
    }
    if (next > stop) break;
    push(next, Math.round((next - prev) / MIN), delta !== 0);
    prev = next;
  }
  const days: ShiftDay[] = [];
  for (const d of doses) {
    const date = localDate(d.local);
    if (!days.length || days[days.length - 1].date !== date) days.push({ date, doses: [] });
    days[days.length - 1].doses.push(d);
  }
  if (reachedUtc !== null && reachedUtc > stop) reachedUtc = null;
  return {
    shiftMin,
    stepMin: shiftMin === 0 ? 0 : firstStep,
    days,
    reachedUtc,
    reachedOn: reachedUtc === null ? null : localDate(fromUtc(reachedUtc, localTz)),
    clockChanges,
  };
}

// ----------------------------------------------------------------------------------------------- next dose

export type NextDose = { med: Med; utc: number; /** wall clock in `tz` */ local: LocalDateTime; tz: string };
export type DoseContext = { homeTz: string; zone: string; plan: MedPlan; /** arrival at the current stop, when known */ stopStartUtc: number | null; stepMin: number };

/** Dose instants of one medicine around `now` under the plan (yesterday to two days ahead). */
function instants(med: Med, ctx: DoseContext, now: number): number[] {
  const atHome = ctx.plan === 'home' || ctx.zone === ctx.homeTz;
  if (!atHome && med.mode === 'interval' && ctx.stopStartUtc !== null && ctx.stopStartUtc <= now) {
    const plan = gradualShift(med, ctx.homeTz, ctx.zone, ctx.stopStartUtc, now + 2 * DAY_MS, ctx.stepMin);
    return plan.days.flatMap((d) => d.doses.map((x) => x.utc));
  }
  const tz = atHome ? ctx.homeTz : ctx.zone;
  const today = localDate(fromUtc(now, tz));
  const out: number[] = [];
  for (const date of [addDays(today, -1), today, addDays(today, 1), addDays(today, 2)])
    for (const time of dailyTimes(med)) out.push(toUtc({ local: `${date}T${time}`, tz }));
  return out;
}

/** The next dose of any medicine at or after `now` under the plan, shown on the clock of `ctx.zone`. */
export function nextDose(meds: readonly Med[], ctx: DoseContext, now: number): NextDose | null {
  let best: NextDose | null = null;
  for (const med of meds) {
    const utc = instants(med, ctx, now)
      .filter((u) => u >= now)
      .sort((a, b) => a - b)[0];
    if (utc === undefined) continue;
    if (!best || utc < best.utc) best = { med, utc, local: fromUtc(utc, ctx.zone), tz: ctx.zone };
  }
  return best;
}

/** The plan saved for a trip (Keep home time unless the traveller chose otherwise). */
export const planFor = (store: MedStore, tripId: string): MedPlan => store.plans[tripId] ?? 'home';

/** Your day's next dose for a trip that is on, in the zone the traveller is in. */
export function nextDoseForTrip(store: MedStore, trip: Trip, phoneZone: string, zone: string, now: number): NextDose | null {
  if (!store.meds.length) return null;
  const homeTz = homeZone(trip, phoneZone);
  const stop = stopAt(medStops(trip, homeTz), now);
  return nextDose(store.meds, { homeTz, zone, plan: planFor(store, trip.id), stopStartUtc: stop && stop.tz === zone ? stop.startUtc : null, stepMin: store.stepMin }, now);
}

// ----------------------------------------------------------------------------------------------- T104

/** How many days of a gradual shift the screen and the shared text list at most. */
export const SHIFT_DAYS_SHOWN = 10;

/**
 * T104: the days of a gradual shift worth listing (screen and shared text): up to the day the doses reach the local
 * clock (the whole stop when they don't), at most SHIFT_DAYS_SHOWN, each with its dose times on the local clock.
 */
export function shiftDayTimes(plan: ShiftPlan, max = SHIFT_DAYS_SHOWN): { date: LocalDate; times: string[]; doses: ShiftDose[] }[] {
  return plan.days
    .filter((d) => !plan.reachedOn || d.date <= plan.reachedOn)
    .slice(0, max)
    .map((d) => ({ date: d.date, times: d.doses.map((x) => localTime(x.local)), doses: d.doses }));
}

/**
 * T104, the Emergency tab's Medicine times row: the next dose now. During a trip that is on (`trip`, with the zone
 * the traveller is in), the trip's plan; otherwise at home on the phone's clock.
 */
export function nextDoseNow(store: MedStore, trip: Trip | null, phoneZone: string, zone: string, now: number): NextDose | null {
  if (!store.meds.length) return null;
  if (trip && zone) return nextDoseForTrip(store, trip, phoneZone, zone, now);
  return nextDose(store.meds, { homeTz: phoneZone, zone: phoneZone, plan: 'home', stopStartUtc: null, stepMin: store.stepMin }, now);
}

/** Days from today (in the dose's zone) to the dose: 0 today, 1 tomorrow. */
export const doseDayShift = (dose: NextDose, now: number): number => daysBetween(localDate(fromUtc(now, dose.tz)), localDate(dose.local));
