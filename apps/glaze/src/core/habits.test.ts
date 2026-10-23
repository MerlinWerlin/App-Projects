import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  HABITS_KEY,
  HABIT_DEFS,
  HABIT_HISTORY_DAYS,
  HABIT_KINDS,
  WIDGET_INTENTS,
  applyHabitIntent,
  createHabit,
  decrementHabit,
  habitHistory,
  habitProgress,
  habitStreak,
  habitValueOn,
  incrementHabit,
  parseHabits,
  rolloverHabit,
  serialiseHabits,
  setHabitGoal,
  setHabitValue,
  type HabitState,
} from './habits.ts';

const at = (iso: string): Date => new Date(iso);
const D1 = at('2026-10-18T08:00:00Z');
const D1_LATE = at('2026-10-18T23:59:00Z');
const D2 = at('2026-10-19T00:01:00Z');

test('every kind has a sane definition', () => {
  assert.equal(HABITS_KEY, 'glaze.habits.v1');
  for (const k of HABIT_KINDS) {
    const d = HABIT_DEFS[k];
    assert.equal(d.kind, k);
    assert.ok(d.step > 0 && d.max > d.min);
    assert.ok(d.unitKey.startsWith('widgets.unit.'));
    assert.equal(d.defaultGoal === null, d.mode === 'scale');
  }
});

test('water: increment / decrement with clamping', () => {
  let s = createHabit('water', D1, { utcOffsetMinutes: 0 });
  assert.deepEqual([s.day, s.value, s.goal, s.step], ['2026-10-18', 0, 2000, 150]);
  assert.equal(HABIT_DEFS.water.unitKey, 'widgets.unit.ml');
  s = incrementHabit(s, D1, undefined, 0);
  s = incrementHabit(s, D1, undefined, 0);
  s = incrementHabit(s, D1, 300, 0);
  assert.equal(s.value, 600);
  s = decrementHabit(s, D1, undefined, 0);
  assert.equal(s.value, 450);
  for (let i = 0; i < 10; i++) s = decrementHabit(s, D1, undefined, 0);
  assert.equal(s.value, 0);
  s = setHabitValue(s, D1, 1_000_000, 0);
  assert.equal(s.value, HABIT_DEFS.water.max);
  s = setHabitValue(s, D1, Number.NaN, 0);
  assert.equal(s.value, 0);
});

test('functions are pure: inputs are never mutated', () => {
  const s = createHabit('water', D1, { utcOffsetMinutes: 0 });
  const snapshot = JSON.stringify(s);
  incrementHabit(s, D2, 2, 0);
  rolloverHabit(s, D2, 0);
  setHabitGoal(s, 3);
  assert.equal(JSON.stringify(s), snapshot);
});

test('rollover at local midnight files the day and starts at zero', () => {
  let s = createHabit('water', D1, { utcOffsetMinutes: 0 });
  s = incrementHabit(s, D1_LATE, 6, 0);
  assert.equal(rolloverHabit(s, D1_LATE, 0), s, 'same day: unchanged object');
  const next = rolloverHabit(s, D2, 0);
  assert.equal(next.day, '2026-10-19');
  assert.equal(next.value, 0);
  assert.deepEqual(next.history, { '2026-10-18': 6 });
  assert.equal(habitValueOn(s, D2, 0), 0);
  // Increment after midnight lands on the new day.
  const s2 = incrementHabit(s, D2, undefined, 0);
  assert.deepEqual([s2.day, s2.value, s2.history['2026-10-18']], ['2026-10-19', 150, 6]);
});

test('rollover follows the local offset, and skipped days stay empty', () => {
  // 13:30 UTC is already the next day in UTC+11.
  let s = createHabit('steps', at('2026-10-18T10:00:00Z'), { utcOffsetMinutes: 660 });
  s = incrementHabit(s, at('2026-10-18T10:00:00Z'), 4000, 660);
  assert.equal(rolloverHabit(s, at('2026-10-18T12:59:00Z'), 660).day, '2026-10-18');
  assert.equal(rolloverHabit(s, at('2026-10-18T13:00:00Z'), 660).day, '2026-10-19');
  const later = rolloverHabit(s, at('2026-10-25T03:00:00Z'), 660);
  assert.deepEqual(later.history, { '2026-10-18': 4000 });
  assert.equal(later.value, 0);
});

test('clock moving back restores that day instead of losing it', () => {
  let s = createHabit('water', D1, { utcOffsetMinutes: 0 });
  s = incrementHabit(s, D1, 3, 0);
  s = incrementHabit(s, D2, 2, 0);
  const back = rolloverHabit(s, D1, 0);
  assert.deepEqual([back.day, back.value], ['2026-10-18', 3]);
  assert.deepEqual(back.history, { '2026-10-19': 2 });
  assert.equal(rolloverHabit(back, D2, 0).value, 2, 'and forward again');
});

test('sleep keeps half hours without float drift', () => {
  let s = createHabit('sleep', D1, { utcOffsetMinutes: 0 });
  assert.equal(s.step, 1, 'a widget tap adds a whole hour');
  for (let i = 0; i < 15; i++) s = incrementHabit(s, D1, 0.5, 0);
  assert.equal(s.value, 7.5);
  s = incrementHabit(s, D1, 0.1, 0);
  s = incrementHabit(s, D1, 0.2, 0);
  assert.equal(s.value, 7.8);
  assert.equal(habitProgress(s, D1, 0).done, false);
  s = incrementHabit(s, D1, 0.2, 0);
  assert.equal(habitProgress(s, D1, 0).done, true);
});

test('mood is a 1–5 scale; 0 means not logged', () => {
  let s = createHabit('mood', D1, { utcOffsetMinutes: 0 });
  assert.equal(s.goal, null);
  assert.equal(habitProgress(s, D1, 0).logged, false);
  s = incrementHabit(s, D1, undefined, 0);
  assert.equal(s.value, 1);
  for (let i = 0; i < 9; i++) s = incrementHabit(s, D1, undefined, 0);
  assert.equal(s.value, 5);
  s = setHabitValue(s, D1, 2.6, 0);
  assert.equal(s.value, 3);
  s = setHabitValue(s, D1, 9, 0);
  assert.equal(s.value, 5);
  s = setHabitValue(s, D1, 1, 0);
  s = decrementHabit(s, D1, undefined, 0);
  assert.equal(s.value, 0, 'below 1 clears');
  assert.equal(setHabitGoal(s, 4).goal, null);
  const p = habitProgress(setHabitValue(s, D1, 4, 0), D1, 0);
  assert.deepEqual([p.fraction, p.done], [0.8, true]);
});

test('goals and progress', () => {
  let s = createHabit('steps', D1, { goal: 10000, utcOffsetMinutes: 0 });
  assert.equal(s.goal, 10000);
  s = incrementHabit(s, D1, undefined, 0);
  assert.equal(s.value, 500);
  assert.equal(habitProgress(s, D1, 0).fraction, 0.05);
  s = setHabitValue(s, D1, 12000, 0);
  assert.deepEqual(habitProgress(s, D1, 0), { value: 12000, goal: 10000, fraction: 1, done: true, logged: true });
  assert.equal(setHabitGoal(s, -3).goal, 8000, 'invalid goal resets to default');
  assert.equal(setHabitGoal(s, 1e9).goal, HABIT_DEFS.steps.max);
  assert.equal(habitProgress(s, D2, 0).value, 0, 'stale day reads as 0');
});

test('streak counts met days back from today', () => {
  let s = createHabit('water', at('2026-10-14T09:00:00Z'), { goal: 2, utcOffsetMinutes: 0 });
  for (const day of ['14', '15', '16', '17']) s = setHabitValue(s, at(`2026-10-${day}T09:00:00Z`), day === '15' ? 1 : 2, 0);
  // 15th missed the goal, so the run is 16, 17.
  assert.equal(habitStreak(s, at('2026-10-18T09:00:00Z'), 0), 2);
  s = setHabitValue(s, at('2026-10-18T09:00:00Z'), 3, 0);
  assert.equal(habitStreak(s, at('2026-10-18T09:00:00Z'), 0), 3);
  assert.equal(habitStreak(s, at('2026-10-20T09:00:00Z'), 0), 0, 'a skipped day breaks it');
  const hist = habitHistory(s, at('2026-10-18T09:00:00Z'), 5, 0);
  assert.deepEqual(hist.map((h) => h.value), [2, 1, 2, 2, 3]);
  assert.equal(hist[4].day, '2026-10-18');
});

test('history is capped', () => {
  let s = createHabit('water', at('2025-01-01T09:00:00Z'), { utcOffsetMinutes: 0 });
  s = setHabitValue(s, at('2025-01-01T09:00:00Z'), 4, 0);
  const far = rolloverHabit(s, at('2026-10-18T09:00:00Z'), 0);
  assert.deepEqual(far.history, {});
  const near = rolloverHabit(s, at('2025-12-31T09:00:00Z'), 0);
  assert.deepEqual(near.history, { '2025-01-01': 4 });
  assert.ok(HABIT_HISTORY_DAYS >= 366);
});

test('widget intents drive the trackers', () => {
  let list: HabitState[] = [];
  list = applyHabitIntent(list, { intent: WIDGET_INTENTS.habitIncrement, params: { habit: 'water' } }, D1, 0);
  list = applyHabitIntent(list, { intent: WIDGET_INTENTS.habitIncrement, params: { habit: 'water' } }, D1, 0);
  list = applyHabitIntent(list, { intent: WIDGET_INTENTS.habitSet, params: { habit: 'mood', value: 4 } }, D1, 0);
  list = applyHabitIntent(list, { intent: WIDGET_INTENTS.habitDecrement, params: { habit: 'water' } }, D1, 0);
  assert.deepEqual(list.map((s) => [s.kind, s.value]), [['water', 150], ['mood', 4]]);
  const same = applyHabitIntent(list, { intent: WIDGET_INTENTS.albumNext, params: {} }, D1, 0);
  assert.deepEqual(same, list);
  const bad = applyHabitIntent(list, { intent: WIDGET_INTENTS.habitIncrement, params: { habit: 'coffee' as never } }, D1, 0);
  assert.deepEqual(bad, list);
});

test('payload round-trips and parsing is tolerant', () => {
  let water = createHabit('water', at('2026-10-16T09:00:00Z'), { utcOffsetMinutes: 0 });
  water = setHabitValue(water, at('2026-10-16T09:00:00Z'), 5, 0);
  water = setHabitValue(water, at('2026-10-18T09:00:00Z'), 2, 0);
  const sleep = setHabitValue(createHabit('sleep', D1, { utcOffsetMinutes: 0 }), D1, 7.5, 0);
  const json = serialiseHabits([sleep, water]);
  const back = parseHabits(json);
  assert.deepEqual(back, [water, sleep]);
  assert.equal(serialiseHabits(back), json);

  assert.deepEqual(parseHabits('not json'), []);
  assert.deepEqual(parseHabits({ v: 2, habits: [] }), []);
  assert.deepEqual(parseHabits(null), []);
  const junk = parseHabits({
    v: 1,
    habits: [
      { kind: 'coffee', day: '2026-10-18' },
      { kind: 'water', day: '2026-02-30' },
      { kind: 'water', day: '2026-10-18', value: -5, goal: 'lots', step: 0, history: { '2026-10-17': 99999, '2026-10-18': 3, '2026-10-21': 1, nope: 2, '2026-10-10': 'x' } },
      { kind: 'water', day: '2026-10-18', value: 3 },
      { kind: 'mood', day: '2026-10-18', value: 7, goal: 5 },
    ],
  });
  assert.equal(junk.length, 2);
  assert.deepEqual(junk[0], { v: 1, kind: 'water', goal: 2000, step: 150, day: '2026-10-18', value: 0, history: { '2026-10-17': 10000 } });
  assert.deepEqual([junk[1].kind, junk[1].value, junk[1].goal], ['mood', 5, null]);
});

test('no clock reads inside the habit and calendar core', () => {
  for (const f of ['habits.ts', 'calendarMaths.ts', 'widgetKinds.ts']) {
    const src = readFileSync(new URL(`./${f}`, import.meta.url), 'utf8');
    assert.ok(!/Date\.now\(|new Date\(\)/.test(src), f);
  }
});
