import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHabit, habitValueOn, setHabitValue, type HabitState } from './habits.ts';
import { parseHabitsDoc, serialiseHabitsDoc } from './habitLog.ts';
import { HABITS_LOCAL_KEY } from './habitTap.ts';
import { HABITS_MIGRATED_KEY, hasLocalHabitValues, mergeLocalHabits, migrateLocalHabitsInStore } from './habitMigrate.ts';

const OFF = 0;
const NOW = new Date('2026-10-19T09:00:00Z');
const YESTERDAY = new Date('2026-10-18T09:00:00Z');
const make = (kind: HabitState['kind'], value: number, at: Date = NOW): HabitState => setHabitValue(createHabit(kind, at, { utcOffsetMinutes: OFF }), at, value, OFF);
const val = (list: readonly HabitState[], kind: HabitState['kind']): number => {
  const s = list.find((x) => x.kind === kind);
  return s ? habitValueOn(s, NOW, OFF) : 0;
};
const doc = (habits: HabitState[]): string => serialiseHabitsDoc({ habits, applied: null });

test('T96: the migrated flag is its own key', () => {
  assert.notEqual(HABITS_MIGRATED_KEY, HABITS_LOCAL_KEY);
  assert.match(HABITS_MIGRATED_KEY, /^glaze\./);
});

test('T96: local-only trackers are added; shared ones keep the higher value', () => {
  const merged = mergeLocalHabits([make('water', 300)], [make('water', 900), make('sleep', 7)], NOW, OFF);
  assert.equal(val(merged, 'water'), 900);
  assert.equal(val(merged, 'sleep'), 7);
  const lower = mergeLocalHabits([make('water', 1200)], [make('water', 150)], NOW, OFF);
  assert.equal(val(lower, 'water'), 1200, 'never lowers a value');
});

test("T96: mood keeps the App Group's face when both logged one, else takes the local one", () => {
  assert.equal(val(mergeLocalHabits([make('mood', 2)], [make('mood', 5)], NOW, OFF), 'mood'), 2);
  assert.equal(val(mergeLocalHabits([], [make('mood', 4)], NOW, OFF), 'mood'), 4);
  assert.equal(val(mergeLocalHabits([make('mood', 0)], [make('mood', 3)], NOW, OFF), 'mood'), 3);
});

test("T96: yesterday's local value lands in history after rollover", () => {
  const merged = mergeLocalHabits([], [make('steps', 4000, YESTERDAY)], NOW, OFF);
  const s = merged.find((x) => x.kind === 'steps');
  assert.ok(s);
  assert.equal(s.value, 0);
  assert.equal(s.history['2026-10-18'], 4000);
});

test('T96: in-store copy writes the merged doc; an empty local copy changes nothing', () => {
  const nativeRaw = doc([make('water', 300)]);
  const r = migrateLocalHabitsInStore(nativeRaw, null, doc([make('water', 600), make('sleep', 8)]), {}, NOW, OFF);
  assert.ok(r.json);
  const back = parseHabitsDoc(r.json).habits;
  assert.equal(val(back, 'water'), 600);
  assert.equal(val(back, 'sleep'), 8);
  const none = migrateLocalHabitsInStore(nativeRaw, null, null, {}, NOW, OFF);
  assert.equal(none.json, null);
  assert.equal(val(none.habits, 'water'), 300);
});

test('T96: hasLocalHabitValues ignores empty or unreadable copies', () => {
  assert.equal(hasLocalHabitValues(null), false);
  assert.equal(hasLocalHabitValues('not json'), false);
  assert.equal(hasLocalHabitValues(doc([make('water', 0)])), false);
  assert.equal(hasLocalHabitValues(doc([make('water', 150)])), true);
});
