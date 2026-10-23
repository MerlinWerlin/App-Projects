// Interactive habit widgets (T73; docs/WIDGETS.md "Interactive habit widgets").
//
// Two App Group keys, each with exactly one writer, so the app and the widget extension never
// overwrite each other's taps:
//
//   glaze.habits.v1    (HABITS_KEY)     written by the APP: the trackers (habits.ts) plus an
//                                       `applied` mark saying how far into the log it has read.
//   glaze.habitLog.v1  (HABIT_LOG_KEY)  written by the WIDGET EXTENSION: an append-only list of
//                                       button taps (+150 ml, +1 h, +500 steps, a mood face).
//
// A tap in the widget (targets/widget/HabitIntents.swift) appends one event and reloads the
// timelines; the widget shows `trackers + events not yet applied`. When the app opens it reads
// both keys (src/native/widgets.ts `syncHabits`), folds the new events into the trackers with
// `syncHabitStore`, and writes glaze.habits.v1 back with the new mark. The extension drops events
// at or below the mark the next time it appends. Everything here is pure and takes `now`; the
// Swift side mirrors `habitLogEventFor`, `appendHabitLog` and `habitTodayValue` (keep in sync).

import { HABIT_DEFS, HABIT_HISTORY_DAYS, HABIT_KINDS, HABITS_VERSION, createHabit, decrementHabit, incrementHabit, isHabitKind, parseHabits, rolloverHabit, serialiseHabits, setHabitValue, WIDGET_INTENTS, type HabitKind, type HabitState, type WidgetIntent } from './habits.ts';
import { daysBetween, localDayKey, type DayKey } from './calendarMaths.ts';

export const HABIT_LOG_KEY = 'glaze.habitLog.v1';
export const HABIT_LOG_VERSION = 1;
/** Newest events kept in the log. A day of taps is a few dozen; the app folds them in on open. */
export const HABIT_LOG_MAX_EVENTS = 400;
const MS_DAY = 86_400_000;
const MAX_OFFSET_MINUTES = 14 * 60;

export type HabitLogOp = 'add' | 'set';

export type HabitLogEvent = {
  /** 1, 2, 3 … per log; the order taps happened in. */
  seq: number;
  kind: HabitKind;
  /** add: change today's value by `amount` (negative = minus button; mood: ±1 level). set: pick a value (mood face). */
  op: HabitLogOp;
  amount: number;
  /** Tap time, epoch milliseconds. */
  at: number;
  /** The device's UTC offset in minutes at tap time (east positive), so the tap lands on the local day it was made. */
  off: number;
};

export type HabitLog = {
  v: 1;
  /** Random id the extension picks when it starts a log; a new id means "start counting again". */
  logId: string;
  /** Highest seq ever handed out in this log. */
  seq: number;
  events: HabitLogEvent[];
};

/** How far into which log the app has applied events. */
export type HabitSyncMark = { logId: string; seq: number };

export type HabitsDoc = { habits: HabitState[]; applied: HabitSyncMark | null };

const round2 = (n: number): number => Math.round(n * 100) / 100;

function cleanLogId(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 && t.length <= 64 && /^[A-Za-z0-9._-]+$/.test(t) ? t : null;
}

const isSeq = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= Number.MAX_SAFE_INTEGER;

function cleanMark(v: unknown): HabitSyncMark | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const logId = cleanLogId(o.logId);
  return logId && isSeq(o.seq) ? { logId, seq: o.seq } : null;
}

// ---------------------------------------------------------------------------------- events

/** Largest single change one event may carry (the tracker's max). Mood moves one level. */
function capAmount(kind: HabitKind, op: HabitLogOp, amount: number): number | null {
  if (!Number.isFinite(amount)) return null;
  const def = HABIT_DEFS[kind];
  if (op === 'set') {
    if (def.mode === 'scale') {
      const r = Math.round(amount);
      return r < def.min ? 0 : Math.min(def.max, r);
    }
    return round2(Math.min(def.max, Math.max(0, amount)));
  }
  if (amount === 0) return null;
  if (def.mode === 'scale') return amount > 0 ? 1 : -1;
  const a = round2(Math.min(def.max, Math.abs(amount)));
  return a === 0 ? null : amount > 0 ? a : -a;
}

function cleanEvent(raw: unknown): HabitLogEvent | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (!isSeq(o.seq) || o.seq === 0 || !isHabitKind(o.kind) || (o.op !== 'add' && o.op !== 'set')) return null;
  if (typeof o.amount !== 'number' || typeof o.at !== 'number' || !Number.isFinite(o.at) || o.at < 0) return null;
  const off = typeof o.off === 'number' && Number.isFinite(o.off) && Math.abs(o.off) <= MAX_OFFSET_MINUTES ? Math.round(o.off) : 0;
  const amount = capAmount(o.kind, o.op, o.amount);
  if (amount === null) return null;
  return { seq: o.seq, kind: o.kind, op: o.op, amount, at: Math.round(o.at), off };
}

/** Local day an event belongs to. */
export function habitEventDay(e: HabitLogEvent): DayKey {
  return localDayKey(new Date(e.at), e.off);
}

/**
 * Turn a widget button's intent into a log event (without a seq yet). Count trackers add the
 * intent's `by`, else the tracker's own step (from the app's trackers), else the default step:
 * +150 ml, +1 h, +500 steps. Mood: increment/decrement move one level, `habitSet` picks a face.
 * Null for anything that isn't a habit button.
 */
export function habitLogEventFor(states: readonly HabitState[], action: WidgetIntent, now: Date, utcOffsetMinutes: number): Omit<HabitLogEvent, 'seq'> | null {
  const kind = action?.params?.habit;
  if (!isHabitKind(kind)) return null;
  const def = HABIT_DEFS[kind];
  const step = states.find((s) => s.kind === kind)?.step ?? def.step;
  const by = typeof action.params.by === 'number' && Number.isFinite(action.params.by) && action.params.by > 0 ? action.params.by : step;
  let op: HabitLogOp;
  let amount: number;
  if (action.intent === WIDGET_INTENTS.habitIncrement) [op, amount] = ['add', by];
  else if (action.intent === WIDGET_INTENTS.habitDecrement) [op, amount] = ['add', -by];
  else if (action.intent === WIDGET_INTENTS.habitSet) [op, amount] = ['set', typeof action.params.value === 'number' ? action.params.value : 0];
  else return null;
  const capped = capAmount(kind, op, amount);
  if (capped === null) return null;
  const off = Number.isFinite(utcOffsetMinutes) && Math.abs(utcOffsetMinutes) <= MAX_OFFSET_MINUTES ? Math.round(utcOffsetMinutes) : 0;
  return { kind, op, amount: capped, at: now.getTime(), off };
}

function pruneEvents(events: readonly HabitLogEvent[], logId: string, applied: HabitSyncMark | null, now: Date): HabitLogEvent[] {
  const cutoff = now.getTime() - (HABIT_HISTORY_DAYS + 1) * MS_DAY;
  const done = applied && applied.logId === logId ? applied.seq : 0;
  const kept = events.filter((e) => e.seq > done && e.at >= cutoff);
  return kept.slice(Math.max(0, kept.length - HABIT_LOG_MAX_EVENTS));
}

/**
 * The extension's write: append one event to the log (starting a log with `newLogId` when there is
 * none), dropping events the app has already applied, events older than the history window and,
 * past HABIT_LOG_MAX_EVENTS, the oldest ones. Pure; returns a new log.
 */
export function appendHabitLog(log: HabitLog | null, event: Omit<HabitLogEvent, 'seq'>, applied: HabitSyncMark | null, now: Date, newLogId: string): HabitLog {
  const base: HabitLog = log ?? { v: 1, logId: cleanLogId(newLogId) ?? 'log', seq: 0, events: [] };
  const seq = base.seq + 1;
  const full = cleanEvent({ ...event, seq });
  const events = full ? [...base.events, full] : [...base.events];
  return { v: 1, logId: base.logId, seq: full ? seq : base.seq, events: pruneEvents(events, base.logId, applied, now) };
}

/** Events the app has not applied yet, oldest first. */
export function pendingHabitEvents(log: HabitLog | null, applied: HabitSyncMark | null): HabitLogEvent[] {
  if (!log) return [];
  const done = applied && applied.logId === log.logId ? applied.seq : 0;
  return log.events.filter((e) => e.seq > done);
}

// ---------------------------------------------------------------------------------- merge

function applyOp(state: HabitState, e: HabitLogEvent, at: Date): HabitState {
  if (e.op === 'set') return setHabitValue(state, at, e.amount, e.off);
  return e.amount > 0 ? incrementHabit(state, at, e.amount, e.off) : decrementHabit(state, at, -e.amount, e.off);
}

/**
 * Apply one event to the trackers (creating the tracker on first use). Today's or a later day's
 * event changes the tracker's day the normal way (rolloverHabit); a tap from an earlier day (the
 * app was closed over midnight) goes straight into that day's history, within the history window.
 */
export function applyHabitEvent(states: readonly HabitState[], e: HabitLogEvent): HabitState[] {
  const at = new Date(e.at);
  const day = habitEventDay(e);
  const current = states.find((s) => s.kind === e.kind) ?? createHabit(e.kind, at, { utcOffsetMinutes: e.off });
  let next: HabitState;
  const age = daysBetween(day, current.day);
  if (age <= 0) {
    next = applyOp(current, e, at);
  } else if (age > HABIT_HISTORY_DAYS) {
    next = current;
  } else {
    const tmp: HabitState = { ...current, day, value: current.history[day] ?? 0, history: {} };
    const value = applyOp(tmp, e, at).value;
    const history = { ...current.history };
    if (value > 0) history[day] = value;
    else delete history[day];
    next = { ...current, history };
  }
  const out = states.filter((s) => s.kind !== e.kind);
  out.push(next);
  return out.sort((a, b) => HABIT_KINDS.indexOf(a.kind) - HABIT_KINDS.indexOf(b.kind));
}

export type HabitMergeResult = { habits: HabitState[]; applied: HabitSyncMark | null; appliedCount: number };

/** Fold every pending event into the trackers, then roll every tracker over to `now`. */
export function mergeHabitLog(states: readonly HabitState[], applied: HabitSyncMark | null, log: HabitLog | null, now: Date, utcOffsetMinutes?: number): HabitMergeResult {
  const pending = pendingHabitEvents(log, applied);
  let habits = [...states];
  for (const e of pending) habits = applyHabitEvent(habits, e);
  habits = habits.map((s) => rolloverHabit(s, now, utcOffsetMinutes));
  const mark = log ? { logId: log.logId, seq: Math.max(log.seq, applied && applied.logId === log.logId ? applied.seq : 0) } : applied;
  return { habits, applied: mark, appliedCount: pending.length };
}

/**
 * What the widget shows for one tracker today: the app's value for today plus today's pending
 * taps. Mirrors HabitStore.todayValue in targets/widget/HabitStore.swift.
 */
export function habitTodayValue(states: readonly HabitState[], applied: HabitSyncMark | null, log: HabitLog | null, kind: HabitKind, now: Date, utcOffsetMinutes: number): number {
  const today = localDayKey(now, utcOffsetMinutes);
  const own = states.find((s) => s.kind === kind);
  let s: HabitState = own ? rolloverHabit(own, now, utcOffsetMinutes) : createHabit(kind, now, { utcOffsetMinutes });
  for (const e of pendingHabitEvents(log, applied)) {
    if (e.kind === kind && habitEventDay(e) === today) s = applyOp(s, { ...e, off: utcOffsetMinutes }, now);
  }
  return s.value;
}

// ---------------------------------------------------------------------------------- payloads

/** Tolerant parse of HABIT_LOG_KEY: bad events dropped, sorted by seq, one per seq. Never throws. */
export function parseHabitLog(input: unknown): HabitLog | null {
  let raw: unknown = input;
  if (typeof input === 'string') {
    try {
      raw = JSON.parse(input);
    } catch {
      return null;
    }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const logId = cleanLogId(o.logId);
  if (o.v !== HABIT_LOG_VERSION || !logId) return null;
  const bySeq = new Map<number, HabitLogEvent>();
  for (const item of Array.isArray(o.events) ? o.events : []) {
    const e = cleanEvent(item);
    if (e && !bySeq.has(e.seq)) bySeq.set(e.seq, e);
  }
  const events = [...bySeq.values()].sort((a, b) => a.seq - b.seq);
  const top = events.length ? events[events.length - 1].seq : 0;
  const seq = isSeq(o.seq) ? Math.max(o.seq, top) : top;
  return { v: 1, logId, seq, events: events.slice(Math.max(0, events.length - HABIT_LOG_MAX_EVENTS)) };
}

export function serialiseHabitLog(log: HabitLog): string {
  return JSON.stringify({ v: HABIT_LOG_VERSION, logId: log.logId, seq: log.seq, events: log.events.map((e) => ({ seq: e.seq, kind: e.kind, op: e.op, amount: e.amount, at: e.at, off: e.off })) });
}

/** HABITS_KEY with the app's `applied` mark. `parseHabits` (habits.ts) ignores the extra field. */
export function serialiseHabitsDoc(doc: HabitsDoc): string {
  const base = JSON.parse(serialiseHabits(doc.habits)) as Record<string, unknown>;
  return JSON.stringify(doc.applied ? { ...base, applied: { logId: doc.applied.logId, seq: doc.applied.seq } } : base);
}

export function parseHabitsDoc(input: unknown): HabitsDoc {
  let raw: unknown = input;
  if (typeof input === 'string') {
    try {
      raw = JSON.parse(input);
    } catch {
      return { habits: [], applied: null };
    }
  }
  const habits = parseHabits(raw);
  const ok = !!raw && typeof raw === 'object' && (raw as Record<string, unknown>).v === HABITS_VERSION;
  return { habits, applied: ok ? cleanMark((raw as Record<string, unknown>).applied) : null };
}

export type HabitSyncResult = HabitsDoc & {
  /** New HABITS_KEY JSON to write, or null when nothing changed. */
  json: string | null;
  appliedCount: number;
};

/**
 * The app's read-back: both raw App Group strings in, the merged trackers out, plus the JSON to
 * write back to HABITS_KEY (null when it would be identical).
 */
export function syncHabitStore(habitsRaw: string | null, logRaw: string | null, now: Date, utcOffsetMinutes?: number): HabitSyncResult {
  const doc = parseHabitsDoc(habitsRaw);
  const log = parseHabitLog(logRaw);
  const merged = mergeHabitLog(doc.habits, doc.applied, log, now, utcOffsetMinutes);
  const next: HabitsDoc = { habits: merged.habits, applied: merged.applied };
  const json = serialiseHabitsDoc(next);
  // Compare against the stored doc as this parser reads it, so a doc that only differs in
  // formatting is not rewritten. Nothing stored and nothing to store: no write either.
  const before = serialiseHabitsDoc(doc);
  return { ...next, json: json === before ? null : json, appliedCount: merged.appliedCount };
}
