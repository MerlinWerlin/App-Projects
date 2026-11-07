import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHabit, setHabitValue, type HabitState } from './habits.ts';
import { parseHabitsDoc, serialiseHabitsDoc } from './habitLog.ts';
import {
  applyHabitTap,
  applyHabitUndo,
  canUndoHabitTap,
  habitTodayFrom,
  logHabitUndoInStore,
  logHabitUndoLocal,
  previousHabitTapValue,
} from './habitTap.ts';

const OFF = 0;
const NOW = new Date('2026-10-19T09:00:00Z');
const make = (kind: HabitState['kind'], value: number): HabitState => setHabitValue(createHabit(kind, NOW, { utcOffsetMinutes: OFF }), NOW, value, OFF);
const val = (s: readonly HabitState[], k: HabitState['kind']): number => habitTodayFrom(s, k, NOW, OFF);

test('T94: undo takes one step off a count tracker and stops at 0', () => {
  assert.equal(val(applyHabitUndo([make('water', 450)], 'water', NOW, undefined, OFF), 'water'), 300);
  assert.equal(val(applyHabitUndo([make('water', 100)], 'water', NOW, undefined, OFF), 'water'), 0);
  assert.equal(val(applyHabitUndo([make('sleep', 7.5)], 'sleep', NOW, undefined, OFF), 'sleep'), 6.5);
  assert.equal(previousHabitTapValue([make('steps', 500)], 'steps', NOW, OFF), 0);
});

test('T94: nothing to undo at 0 or with no tracker', () => {
  assert.equal(canUndoHabitTap([], 'water', NOW, OFF), false);
  assert.equal(canUndoHabitTap([make('water', 0)], 'water', NOW, OFF), false);
  assert.equal(canUndoHabitTap([make('water', 150)], 'water', NOW, OFF), true);
  assert.deepEqual(applyHabitUndo([], 'water', NOW, undefined, OFF), []);
});

test('T94: mood steps back one face; Awful clears it', () => {
  assert.equal(val(applyHabitUndo([make('mood', 4)], 'mood', NOW, undefined, OFF), 'mood'), 3);
  assert.equal(val(applyHabitUndo([make('mood', 1)], 'mood', NOW, undefined, OFF), 'mood'), 0);
  assert.equal(canUndoHabitTap([make('mood', 0)], 'mood', NOW, OFF), false);
});

test('T94: tap then undo returns to the start', () => {
  const start = [make('water', 600)];
  const back = applyHabitUndo(applyHabitTap(start, 'water', NOW, undefined, OFF), 'water', NOW, undefined, OFF);
  assert.equal(val(back, 'water'), 600);
});

test('T94: store and local undo write the lowered value; nothing to undo writes nothing', () => {
  const raw = serialiseHabitsDoc({ habits: [make('water', 300)], applied: null });
  const r = logHabitUndoInStore(raw, null, {}, 'water', NOW, OFF);
  assert.ok(r.json);
  assert.equal(val(parseHabitsDoc(r.json).habits, 'water'), 150);
  const none = logHabitUndoInStore(serialiseHabitsDoc({ habits: [make('water', 0)], applied: null }), null, {}, 'water', NOW, OFF);
  assert.equal(none.json, null);
  const local = logHabitUndoLocal(raw, {}, 'water', NOW, OFF);
  assert.equal(val(local.habits, 'water'), 150);
});

test('T94: the Widgets tab log button undoes on long-press and offers a decrement action', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../../app/(tabs)/widgets.tsx', import.meta.url), 'utf8');
  assert.match(src, /onLongPress=\{\(\) => undoHabit\(k\)\}/);
  assert.match(src, /name: 'decrement'/);
  assert.match(src, /tabs\.widgetsTab\.log\.undoHint/);
});
