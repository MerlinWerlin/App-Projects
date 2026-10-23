import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HABIT_DEFS, createHabit, parseHabits, serialiseHabits, setHabitValue } from './habits.ts';
import { parseHabitsDoc, serialiseHabitLog, serialiseHabitsDoc, type HabitLog } from './habitLog.ts';
import {
  GOAL_HABIT_KINDS,
  HABIT_GOALS_KEY,
  HABIT_GOAL_RANGES,
  allDefaultGoals,
  applyHabitGoals,
  canStepHabitGoal,
  checkHabitGoal,
  defaultHabitGoal,
  habitGoalFor,
  isGoalHabitKind,
  parseHabitGoals,
  serialiseHabitGoals,
  snapHabitGoal,
  stepHabitGoal,
  syncHabitStoreWithGoals,
  withHabitGoal,
} from './habitGoals.ts';

const NOW = new Date('2026-10-18T08:00:00Z');

test('goal trackers: water, sleep, steps (mood has no goal)', () => {
  assert.deepEqual([...GOAL_HABIT_KINDS], ['water', 'sleep', 'steps']);
  assert.ok(!isGoalHabitKind('mood'));
  assert.ok(!isGoalHabitKind('coffee'));
  assert.equal(HABIT_GOALS_KEY, 'glaze.habitGoals.v1');
});

test('defaults match the tracker defaults (2000 ml, 8 h, 8000 steps) and sit on the stepper grid', () => {
  assert.equal(defaultHabitGoal('water'), 2000);
  assert.equal(defaultHabitGoal('sleep'), 8);
  assert.equal(defaultHabitGoal('steps'), 8000);
  for (const k of GOAL_HABIT_KINDS) {
    const r = HABIT_GOAL_RANGES[k];
    assert.equal(snapHabitGoal(k, defaultHabitGoal(k)), defaultHabitGoal(k), k);
    assert.ok(r.min > 0 && r.max <= HABIT_DEFS[k].max && r.min < r.max, `${k} range inside the tracker's limits`);
  }
});

test('validation: refuses non-numbers and out-of-range, snaps in-range values to the step', () => {
  assert.deepEqual(checkHabitGoal('water', 'lots'), { ok: false, reason: 'notNumber' });
  assert.deepEqual(checkHabitGoal('water', Number.NaN), { ok: false, reason: 'notNumber' });
  assert.deepEqual(checkHabitGoal('water', Infinity), { ok: false, reason: 'notNumber' });
  assert.deepEqual(checkHabitGoal('water', 0), { ok: false, reason: 'tooLow' });
  assert.deepEqual(checkHabitGoal('water', 9000), { ok: false, reason: 'tooHigh' });
  assert.deepEqual(checkHabitGoal('water', 2100), { ok: true, goal: 2000 });
  assert.deepEqual(checkHabitGoal('water', 2130), { ok: true, goal: 2250 });
  assert.deepEqual(checkHabitGoal('sleep', 7.3), { ok: true, goal: 7.5 });
  assert.deepEqual(checkHabitGoal('sleep', 3), { ok: false, reason: 'tooLow' });
  assert.deepEqual(checkHabitGoal('steps', 10_200), { ok: true, goal: 10_000 });
});

test('stepper: one step at a time, held at both ends', () => {
  assert.equal(stepHabitGoal('water', 2000, 1), 2250);
  assert.equal(stepHabitGoal('water', 2000, -1), 1750);
  assert.equal(stepHabitGoal('sleep', 8, -1), 7.5);
  assert.equal(stepHabitGoal('steps', 8000, 1), 8500);
  const { min, max } = HABIT_GOAL_RANGES.water;
  assert.equal(stepHabitGoal('water', min, -1), min);
  assert.equal(stepHabitGoal('water', max, 1), max);
  assert.ok(!canStepHabitGoal('water', min, -1));
  assert.ok(canStepHabitGoal('water', min, 1));
  assert.ok(!canStepHabitGoal('sleep', HABIT_GOAL_RANGES.sleep.max, 1));
  // A stored value off the grid steps from its snapped value.
  assert.equal(stepHabitGoal('water', 2130, 1), 2500);
});

test('withHabitGoal stores only changed goals; null or the default resets', () => {
  let g = withHabitGoal({}, 'water', 2500);
  assert.deepEqual(g, { water: 2500 });
  g = withHabitGoal(g, 'sleep', 7);
  assert.deepEqual(g, { water: 2500, sleep: 7 });
  assert.deepEqual(withHabitGoal(g, 'water', 2000), { sleep: 7 }, 'the default is not stored');
  assert.deepEqual(withHabitGoal(g, 'sleep', null), { water: 2500 });
  assert.deepEqual(withHabitGoal(g, 'water', -5), g, 'invalid goals leave the map alone');
  assert.deepEqual(g, { water: 2500, sleep: 7 }, 'the input is not mutated');
  assert.equal(habitGoalFor(g, 'water'), 2500);
  assert.equal(habitGoalFor(g, 'steps'), 8000);
  assert.equal(habitGoalFor(null, 'sleep'), 8);
  assert.equal(habitGoalFor({ water: 99_999 }, 'water'), 2000, 'out-of-range stored goals fall back');
  assert.ok(allDefaultGoals({}));
  assert.ok(!allDefaultGoals(g));
});

test('payload round-trips and parses tolerantly', () => {
  const g = { water: 2500, steps: 12_000 };
  assert.deepEqual(parseHabitGoals(serialiseHabitGoals(g)), g);
  assert.deepEqual(parseHabitGoals(null), {});
  assert.deepEqual(parseHabitGoals('not json'), {});
  assert.deepEqual(parseHabitGoals({ v: 2, goals: { water: 2500 } }), {});
  assert.deepEqual(parseHabitGoals({ v: 1, goals: [] }), {});
  assert.deepEqual(
    parseHabitGoals({ v: 1, goals: { water: 2600, mood: 3, coffee: 4, sleep: 'x', steps: 1e9 } }),
    { water: 2500 },
    'mood, unknown kinds, strings and out-of-range goals dropped; values snapped',
  );
  assert.deepEqual(JSON.parse(serialiseHabitGoals({ water: 2000.4 } as never)), { v: 1, goals: { water: 2000 } });
});

test('applyHabitGoals sets every count tracker and creates trackers only for custom goals', () => {
  const water = setHabitValue(createHabit('water', NOW, { utcOffsetMinutes: 0 }), NOW, 600, 0);
  const mood = createHabit('mood', NOW, { utcOffsetMinutes: 0 });
  const sleepOld = createHabit('sleep', NOW, { goal: 9, utcOffsetMinutes: 0 });
  const out = applyHabitGoals([water, mood, sleepOld], { water: 2500, steps: 10_000 }, NOW, 0);
  assert.deepEqual(out.map((s) => s.kind), ['water', 'mood', 'sleep', 'steps']);
  assert.equal(out[0].goal, 2500);
  assert.equal(out[0].value, 600, 'values are untouched');
  assert.equal(out[1].goal, null, 'mood keeps no goal');
  assert.equal(out[2].goal, 8, 'a tracker without a custom goal gets the default');
  assert.equal(out[3].goal, 10_000);
  assert.equal(out[3].value, 0);
  assert.equal(applyHabitGoals([], {}, NOW, 0).length, 0, 'no goals, no trackers: nothing created');
});

test('syncHabitStoreWithGoals folds in taps, writes the goals, and skips identical writes', () => {
  const log: HabitLog = {
    v: 1,
    logId: 'L1',
    seq: 2,
    events: [
      { seq: 1, kind: 'water', op: 'add', amount: 150, at: NOW.getTime(), off: 0 },
      { seq: 2, kind: 'water', op: 'add', amount: 150, at: NOW.getTime() + 1000, off: 0 },
    ],
  };
  const r = syncHabitStoreWithGoals(null, serialiseHabitLog(log), { water: 3000 }, NOW, 0);
  assert.equal(r.appliedCount, 2);
  assert.ok(r.json);
  const doc = parseHabitsDoc(r.json);
  assert.equal(doc.habits[0].kind, 'water');
  assert.equal(doc.habits[0].value, 300);
  assert.equal(doc.habits[0].goal, 3000, 'the widget extension reads this goal');
  assert.deepEqual(doc.applied, { logId: 'L1', seq: 2 });

  // Same goals again over the written doc: nothing to write.
  const again = syncHabitStoreWithGoals(r.json, serialiseHabitLog(log), { water: 3000 }, NOW, 0);
  assert.equal(again.json, null);
  assert.equal(again.appliedCount, 0);

  // Reset to the default: the stored tracker goes back to 2000 ml.
  const reset = syncHabitStoreWithGoals(r.json, serialiseHabitLog(log), {}, NOW, 0);
  assert.ok(reset.json);
  assert.equal(parseHabitsDoc(reset.json).habits[0].goal, 2000);
});

test('syncHabitStoreWithGoals: nothing stored and no custom goals means no write', () => {
  assert.equal(syncHabitStoreWithGoals(null, null, {}, NOW, 0).json, null);
  const stored = serialiseHabitsDoc({ habits: parseHabits(serialiseHabits([createHabit('steps', NOW, { utcOffsetMinutes: 0 })])), applied: null });
  assert.equal(syncHabitStoreWithGoals(stored, null, {}, NOW, 0).json, null);
});
