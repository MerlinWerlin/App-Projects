import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HABIT_DEFS, HABITS_KEY, WIDGET_INTENTS, createHabit, setHabitValue, type HabitState } from './habits.ts';
import { HABIT_LOG_KEY, parseHabitsDoc, serialiseHabitLog, serialiseHabitsDoc, syncHabitStore, type HabitLog } from './habitLog.ts';
import {
  HABITS_LOCAL_KEY,
  applyHabitTap,
  canTapHabit,
  habitTapIntent,
  habitTapStep,
  habitTodayFrom,
  logHabitTapInStore,
  logHabitTapLocal,
  nextHabitTapValue,
  readLocalHabits,
} from './habitTap.ts';

// Fixed offset (UTC) so local days are deterministic on any machine.
const OFF = 0;
const NOW = new Date('2026-10-19T09:00:00Z');
const TOMORROW = new Date('2026-10-20T09:00:00Z');

const valueOf = (states: readonly HabitState[], kind: HabitState['kind']): number => habitTodayFrom(states, kind, NOW, OFF);

test('the local key is separate from both App Group keys', () => {
  assert.equal(HABITS_LOCAL_KEY, 'glaze.habits.local.v1');
  assert.notEqual(HABITS_LOCAL_KEY, HABITS_KEY);
  assert.notEqual(HABITS_LOCAL_KEY, HABIT_LOG_KEY);
});

test('one tap is one step: water +150 ml, sleep +1 h, steps +500 (HABIT_DEFS defaults)', () => {
  assert.equal(habitTapStep([], 'water'), HABIT_DEFS.water.step);
  assert.equal(nextHabitTapValue([], 'water', NOW, OFF), 150);
  assert.equal(nextHabitTapValue([], 'sleep', NOW, OFF), 1);
  assert.equal(nextHabitTapValue([], 'steps', NOW, OFF), 500);
  const s = applyHabitTap(applyHabitTap([], 'water', NOW, undefined, OFF), 'water', NOW, undefined, OFF);
  assert.equal(valueOf(s, 'water'), 300);
});

test("a tracker's own step wins over the default", () => {
  const water = { ...createHabit('water', NOW, { utcOffsetMinutes: OFF }), step: 250 };
  assert.equal(habitTapStep([water], 'water'), 250);
  assert.equal(nextHabitTapValue([water], 'water', NOW, OFF), 250);
  assert.deepEqual(habitTapIntent([water], 'water', NOW, OFF), { intent: WIDGET_INTENTS.habitIncrement, params: { habit: 'water', by: 250 } });
});

test('half-hour sleep keeps its half when a whole hour is added', () => {
  const sleep = setHabitValue(createHabit('sleep', NOW, { utcOffsetMinutes: OFF }), NOW, 6.5, OFF);
  assert.equal(nextHabitTapValue([sleep], 'sleep', NOW, OFF), 7.5);
});

test('count trackers stop at their maximum and report that a tap would do nothing', () => {
  const full = setHabitValue(createHabit('sleep', NOW, { utcOffsetMinutes: OFF }), NOW, 24, OFF);
  assert.equal(nextHabitTapValue([full], 'sleep', NOW, OFF), 24);
  assert.equal(canTapHabit([full], 'sleep', NOW, OFF), false);
  const nearly = setHabitValue(createHabit('water', NOW, { utcOffsetMinutes: OFF }), NOW, 9950, OFF);
  assert.equal(nextHabitTapValue([nearly], 'water', NOW, OFF), 10_000);
  assert.equal(canTapHabit([nearly], 'water', NOW, OFF), true);
  assert.equal(canTapHabit([], 'water', NOW, OFF), true);
});

test('mood cycles through the faces: unset → 1 → … → 5 → 1, with a set intent', () => {
  let states: HabitState[] = [];
  const seen: number[] = [];
  for (let i = 0; i < 6; i++) {
    const intent = habitTapIntent(states, 'mood', NOW, OFF);
    assert.equal(intent.intent, WIDGET_INTENTS.habitSet);
    states = applyHabitTap(states, 'mood', NOW, undefined, OFF);
    seen.push(valueOf(states, 'mood'));
  }
  assert.deepEqual(seen, [1, 2, 3, 4, 5, 1]);
  assert.ok(canTapHabit(states, 'mood', NOW, OFF));
});

test('a tap on a new day starts from 0 and files yesterday into history', () => {
  const s = applyHabitTap([], 'water', NOW, undefined, OFF);
  const next = applyHabitTap(s, 'water', TOMORROW, undefined, OFF);
  const water = next.find((x) => x.kind === 'water');
  assert.ok(water);
  assert.equal(water.value, 150);
  assert.equal(water.history['2026-10-19'], 150);
});

test('only the tapped tracker changes; a tracker created by a tap gets the person’s goal', () => {
  const sleep = setHabitValue(createHabit('sleep', NOW, { utcOffsetMinutes: OFF }), NOW, 7, OFF);
  const out = applyHabitTap([sleep], 'steps', NOW, { steps: 10_000 }, OFF);
  assert.equal(valueOf(out, 'sleep'), 7);
  assert.equal(valueOf(out, 'steps'), 500);
  assert.equal(out.find((x) => x.kind === 'steps')?.goal, 10_000);
});

const log = (events: { seq: number; kind: HabitState['kind']; amount: number }[]): string =>
  serialiseHabitLog({
    v: 1,
    logId: 'L1',
    seq: events.length ? events[events.length - 1].seq : 0,
    events: events.map((e) => ({ ...e, op: 'add' as const, at: NOW.getTime() - 60_000, off: OFF })),
  } satisfies HabitLog);

test('store tap: folds the widget taps in first, then adds the in-app tap, and never touches the log', () => {
  const habitsRaw = serialiseHabitsDoc({ habits: [createHabit('water', NOW, { utcOffsetMinutes: OFF })], applied: null });
  const logRaw = log([
    { seq: 1, kind: 'water', amount: 150 },
    { seq: 2, kind: 'water', amount: 150 },
  ]);
  const r = logHabitTapInStore(habitsRaw, logRaw, {}, 'water', NOW, OFF);
  assert.equal(r.appliedCount, 2);
  assert.deepEqual(r.applied, { logId: 'L1', seq: 2 });
  assert.equal(valueOf(r.habits, 'water'), 450);
  assert.ok(r.json);
  const doc = parseHabitsDoc(r.json);
  assert.equal(valueOf(doc.habits, 'water'), 450);
  assert.deepEqual(doc.applied, { logId: 'L1', seq: 2 });
});

test('store tap: a widget tap logged after the read is applied once on the next sync', () => {
  const first = logHabitTapInStore(null, log([{ seq: 1, kind: 'water', amount: 150 }]), {}, 'water', NOW, OFF);
  assert.equal(valueOf(first.habits, 'water'), 300);
  // The extension appended seq 2 meanwhile; the app's next sync applies just that one.
  const later = syncHabitStore(
    first.json,
    log([
      { seq: 1, kind: 'water', amount: 150 },
      { seq: 2, kind: 'water', amount: 150 },
    ]),
    NOW,
    OFF,
  );
  assert.equal(later.appliedCount, 1);
  assert.equal(valueOf(later.habits, 'water'), 450);
});

test('store tap: goals are written with the tap; nothing to write when a full tracker is tapped', () => {
  const r = logHabitTapInStore(null, null, { water: 2500 }, 'water', NOW, OFF);
  assert.equal(r.habits.find((x) => x.kind === 'water')?.goal, 2500);
  assert.ok(r.json);
  const full = setHabitValue(createHabit('sleep', NOW, { utcOffsetMinutes: OFF }), NOW, 24, OFF);
  const raw = serialiseHabitsDoc({ habits: [full], applied: null });
  const again = logHabitTapInStore(raw, null, {}, 'sleep', NOW, OFF);
  assert.equal(again.json, null);
  assert.equal(valueOf(again.habits, 'sleep'), 24);
});

test('local (Expo Go) document: taps persist through write/read and tolerate junk', () => {
  const a = logHabitTapLocal(null, {}, 'mood', NOW, OFF);
  const b = logHabitTapLocal(a.json, {}, 'mood', NOW, OFF);
  assert.equal(valueOf(readLocalHabits(b.json, NOW, OFF), 'mood'), 2);
  assert.equal(parseHabitsDoc(b.json).applied, null);
  assert.deepEqual(readLocalHabits('not json', NOW, OFF), []);
  assert.deepEqual(readLocalHabits(null, NOW, OFF), []);
  const c = logHabitTapLocal('{"v":9}', {}, 'steps', NOW, OFF);
  assert.equal(valueOf(c.habits, 'steps'), 500);
  // Read the next day: today is back to 0.
  assert.equal(habitTodayFrom(readLocalHabits(c.json, TOMORROW, OFF), 'steps', TOMORROW, OFF), 0);
});
