import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HABITS_KEY, WIDGET_INTENTS, createHabit, parseHabits, setHabitValue, type HabitState, type WidgetIntent } from './habits.ts';
import {
  HABIT_LOG_KEY,
  HABIT_LOG_MAX_EVENTS,
  appendHabitLog,
  applyHabitEvent,
  habitEventDay,
  habitLogEventFor,
  habitTodayValue,
  mergeHabitLog,
  parseHabitLog,
  parseHabitsDoc,
  pendingHabitEvents,
  serialiseHabitLog,
  serialiseHabitsDoc,
  syncHabitStore,
  type HabitLog,
  type HabitLogEvent,
} from './habitLog.ts';

const at = (iso: string): Date => new Date(iso);
const D1 = at('2026-10-18T08:00:00Z');
const D2 = at('2026-10-19T08:00:00Z');
const inc = (habit: 'water' | 'sleep' | 'steps' | 'mood', by?: number): WidgetIntent => ({ intent: WIDGET_INTENTS.habitIncrement, params: by ? { habit, by } : { habit } });
const dec = (habit: 'water' | 'sleep' | 'steps' | 'mood'): WidgetIntent => ({ intent: WIDGET_INTENTS.habitDecrement, params: { habit } });
const mood = (value: number): WidgetIntent => ({ intent: WIDGET_INTENTS.habitSet, params: { habit: 'mood', value } });

/** What the extension does on one tap (mirrors HabitIntents.swift). */
function tap(log: HabitLog | null, states: HabitState[], action: WidgetIntent, now: Date, off = 0): HabitLog {
  const e = habitLogEventFor(states, action, now, off);
  assert.ok(e, 'habit buttons always make an event');
  return appendHabitLog(log, e, null, now, 'L1');
}

test('keys are separate from the trackers key', () => {
  assert.equal(HABIT_LOG_KEY, 'glaze.habitLog.v1');
  assert.notEqual(HABIT_LOG_KEY, HABITS_KEY);
});

test('button amounts: +150 ml, +1 h, +500 steps, mood faces', () => {
  assert.deepEqual(habitLogEventFor([], inc('water'), D1, 0), { kind: 'water', op: 'add', amount: 150, at: D1.getTime(), off: 0 });
  assert.equal(habitLogEventFor([], inc('sleep'), D1, 0)?.amount, 1);
  assert.equal(habitLogEventFor([], inc('steps'), D1, 0)?.amount, 500);
  assert.equal(habitLogEventFor([], dec('water'), D1, 0)?.amount, -150);
  assert.deepEqual(habitLogEventFor([], mood(4), D1, 660), { kind: 'mood', op: 'set', amount: 4, at: D1.getTime(), off: 660 });
  assert.equal(habitLogEventFor([], inc('mood'), D1, 0)?.amount, 1, 'mood up moves one level');
  // The app's own step wins over the default, an explicit `by` over both.
  const custom = [createHabit('water', D1, { step: 250, utcOffsetMinutes: 0 })];
  assert.equal(habitLogEventFor(custom, inc('water'), D1, 0)?.amount, 250);
  assert.equal(habitLogEventFor(custom, inc('water', 330), D1, 0)?.amount, 330);
  // Caps and junk.
  assert.equal(habitLogEventFor([], inc('water', 1e9), D1, 0)?.amount, 10_000);
  assert.equal(habitLogEventFor([], mood(42), D1, 0)?.amount, 5);
  assert.equal(habitLogEventFor([], { intent: WIDGET_INTENTS.albumNext, params: {} }, D1, 0), null);
  assert.equal(habitLogEventFor([], { intent: WIDGET_INTENTS.habitIncrement, params: { habit: 'coffee' as never } }, D1, 0), null);
  assert.equal(habitLogEventFor([], inc('water'), D1, 99999)?.off, 0, 'impossible offsets fall back to UTC');
});

test('widget taps show up before the app ever opens', () => {
  let log: HabitLog | null = null;
  for (let i = 0; i < 3; i++) log = tap(log, [], inc('water'), D1);
  log = tap(log, [], dec('water'), D1);
  log = tap(log, [], inc('sleep'), D1);
  log = tap(log, [], mood(2), D1);
  log = tap(log, [], mood(5), D1);
  assert.equal(log.seq, 7);
  assert.deepEqual(log.events.map((e) => e.seq), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(habitTodayValue([], null, log, 'water', D1, 0), 300);
  assert.equal(habitTodayValue([], null, log, 'sleep', D1, 0), 1);
  assert.equal(habitTodayValue([], null, log, 'mood', D1, 0), 5, 'last face wins');
  assert.equal(habitTodayValue([], null, log, 'steps', D1, 0), 0);
  assert.equal(habitTodayValue([], null, log, 'water', D2, 0), 0, 'a new day starts at zero');
});

test('the app folds taps in, writes a mark, and the extension then drops them', () => {
  let log: HabitLog | null = null;
  log = tap(log, [], inc('water'), D1);
  log = tap(log, [], inc('water'), D1);
  const app = [setHabitValue(createHabit('water', D1, { utcOffsetMinutes: 0 }), D1, 500, 0)];
  const merged = mergeHabitLog(app, null, log, D1, 0);
  assert.equal(merged.appliedCount, 2);
  assert.deepEqual(merged.applied, { logId: 'L1', seq: 2 });
  assert.equal(merged.habits[0].value, 800, 'widget taps add to what the app had');
  // Display after the merge: no double counting.
  assert.equal(habitTodayValue(merged.habits, merged.applied, log, 'water', D1, 0), 800);
  // Merging again is a no-op.
  const again = mergeHabitLog(merged.habits, merged.applied, log, D1, 0);
  assert.equal(again.appliedCount, 0);
  assert.equal(again.habits[0].value, 800);
  // Next tap prunes what the app applied.
  const e = habitLogEventFor(merged.habits, inc('water'), D1, 0)!;
  const next = appendHabitLog(log, e, merged.applied, D1, 'ignored');
  assert.deepEqual(next.events.map((x) => x.seq), [3]);
  assert.equal(next.logId, 'L1');
  assert.equal(habitTodayValue(merged.habits, merged.applied, next, 'water', D1, 0), 950);
});

test('a fresh log id (extension data reset) is applied from the start', () => {
  const log = tap(null, [], inc('steps'), D1);
  const merged = mergeHabitLog([], { logId: 'OLD', seq: 99 }, log, D1, 0);
  assert.equal(merged.appliedCount, 1);
  assert.deepEqual(merged.applied, { logId: 'L1', seq: 1 });
  assert.equal(merged.habits[0].value, 500);
});

test('day rollover: taps from before midnight land on their own day', () => {
  // UTC+11: 12:30Z on the 18th is 23:30 local; 13:30Z is 00:30 on the 19th.
  const late = at('2026-10-18T12:30:00Z');
  const early = at('2026-10-18T13:30:00Z');
  let log = tap(null, [], inc('water'), late, 660);
  log = tap(log, [], inc('water'), early, 660);
  assert.equal(habitEventDay(log.events[0]), '2026-10-18');
  assert.equal(habitEventDay(log.events[1]), '2026-10-19');
  assert.equal(habitTodayValue([], null, log, 'water', early, 660), 150);
  // The app opens on the 21st.
  const merged = mergeHabitLog([], null, log, at('2026-10-21T01:00:00Z'), 660);
  const water = merged.habits[0];
  assert.deepEqual([water.day, water.value], ['2026-10-21', 0]);
  assert.deepEqual(water.history, { '2026-10-18': 150, '2026-10-19': 150 });
});

test('late taps for an earlier day go into history without disturbing today', () => {
  let water = createHabit('water', D2, { utcOffsetMinutes: 0 });
  water = setHabitValue(water, D2, 600, 0);
  water = { ...water, history: { '2026-10-18': 300 } };
  const e: HabitLogEvent = { seq: 1, kind: 'water', op: 'add', amount: 150, at: D1.getTime(), off: 0 };
  const [after] = applyHabitEvent([water], e);
  assert.equal(after.value, 600);
  assert.deepEqual(after.history, { '2026-10-18': 450 });
  const minus: HabitLogEvent = { ...e, seq: 2, amount: -1000 };
  assert.deepEqual(applyHabitEvent([after], minus)[0].history, {}, 'a day taken back to 0 is not stored');
  const ancient: HabitLogEvent = { ...e, seq: 3, at: at('2024-01-01T08:00:00Z').getTime() };
  assert.deepEqual(applyHabitEvent([water], ancient)[0], water, 'outside the history window: ignored');
});

test('caps: values stay in range and the log stays bounded', () => {
  let log: HabitLog | null = null;
  for (let i = 0; i < 100; i++) log = tap(log, [], inc('water'), D1);
  assert.equal(habitTodayValue([], null, log, 'water', D1, 0), 10_000, 'water caps at 10 l');
  for (let i = 0; i < 400; i++) log = tap(log, [], dec('sleep'), D1);
  assert.equal(habitTodayValue([], null, log, 'sleep', D1, 0), 0);
  assert.equal(log!.events.length, HABIT_LOG_MAX_EVENTS);
  assert.equal(log!.seq, 500);
  assert.equal(log!.events[0].seq, 101, 'oldest dropped first');
  // Events older than the history window are dropped on the next append.
  const old = tap(null, [], inc('water'), at('2025-01-01T08:00:00Z'));
  assert.deepEqual(tap(old, [], inc('water'), D1).events.map((e) => e.seq), [2]);
});

test('log parse is tolerant and round-trips', () => {
  let log = tap(null, [], inc('water'), D1, 600);
  log = tap(log, [], mood(3), D1, 600);
  const json = serialiseHabitLog(log);
  assert.deepEqual(parseHabitLog(json), log);
  assert.equal(serialiseHabitLog(parseHabitLog(json)!), json);

  assert.equal(parseHabitLog('nope'), null);
  assert.equal(parseHabitLog({ v: 2, logId: 'a', events: [] }), null);
  assert.equal(parseHabitLog({ v: 1, logId: '../etc', events: [] }), null);
  const junk = parseHabitLog({
    v: 1,
    logId: 'abc',
    seq: 1,
    events: [
      { seq: 5, kind: 'water', op: 'add', amount: 150, at: D1.getTime(), off: 0 },
      { seq: 5, kind: 'water', op: 'add', amount: 999, at: D1.getTime(), off: 0 },
      { seq: 2, kind: 'mood', op: 'set', amount: 9, at: D1.getTime(), off: 5000 },
      { seq: 3, kind: 'coffee', op: 'add', amount: 1, at: D1.getTime(), off: 0 },
      { seq: 4, kind: 'water', op: 'add', amount: 0, at: D1.getTime(), off: 0 },
      { seq: 6, kind: 'water', op: 'boom', amount: 1, at: D1.getTime(), off: 0 },
      { seq: 0, kind: 'water', op: 'add', amount: 1, at: D1.getTime(), off: 0 },
      { seq: 7, kind: 'steps', op: 'add', amount: Number.NaN, at: D1.getTime(), off: 0 },
      'x',
    ],
  })!;
  assert.deepEqual(junk.events.map((e) => [e.seq, e.amount, e.off]), [[2, 5, 0], [5, 150, 0]]);
  assert.equal(junk.seq, 5, 'seq never below the newest event');
  assert.deepEqual(pendingHabitEvents(junk, { logId: 'abc', seq: 2 }).map((e) => e.seq), [5]);
});

test('habits doc carries the mark; the old parser still reads it', () => {
  const water = setHabitValue(createHabit('water', D1, { utcOffsetMinutes: 0 }), D1, 300, 0);
  const json = serialiseHabitsDoc({ habits: [water], applied: { logId: 'L1', seq: 4 } });
  assert.deepEqual(parseHabitsDoc(json), { habits: [water], applied: { logId: 'L1', seq: 4 } });
  assert.deepEqual(parseHabits(json), [water]);
  assert.deepEqual(parseHabitsDoc('{bad'), { habits: [], applied: null });
  assert.deepEqual(parseHabitsDoc({ v: 1, habits: [], applied: { logId: 'x', seq: -1 } }).applied, null);
});

test('syncHabitStore: read both keys, write back only when something changed', () => {
  const none = syncHabitStore(null, null, D1, 0);
  assert.deepEqual([none.habits, none.applied, none.json], [[], null, null]);

  let log = tap(null, [], inc('water'), D1);
  log = tap(log, [], mood(4), D1);
  const first = syncHabitStore(null, serialiseHabitLog(log), D1, 0);
  assert.equal(first.appliedCount, 2);
  assert.ok(first.json);
  assert.deepEqual(first.habits.map((s) => [s.kind, s.value]), [['water', 150], ['mood', 4]]);
  const second = syncHabitStore(first.json, serialiseHabitLog(log), D1, 0);
  assert.equal(second.json, null, 'nothing new');
  assert.deepEqual(second.habits, first.habits);
  // Next day: rollover alone is worth a write.
  const nextDay = syncHabitStore(first.json, serialiseHabitLog(log), D2, 0);
  assert.ok(nextDay.json);
  assert.equal(nextDay.habits[0].value, 0);
  assert.equal(nextDay.habits[0].history['2026-10-18'], 150);
  // Garbage in either key never throws.
  assert.deepEqual(syncHabitStore('garbage', '{"v":1', D1, 0).habits, []);
});

test('no clock reads in the log core', () => {
  const src = readFileSync(new URL('./habitLog.ts', import.meta.url), 'utf8');
  assert.ok(!/Date\.now\(|new Date\(\)/.test(src));
});
