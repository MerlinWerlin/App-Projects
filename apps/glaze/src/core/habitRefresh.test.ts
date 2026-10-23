import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHabit, setHabitValue } from './habits.ts';
import { habitsAfterSync } from './habitRefresh.ts';

const NOW = new Date('2026-10-19T09:00:00Z');
const cached = [setHabitValue(createHabit('water', NOW, { utcOffsetMinutes: 0 }), NOW, 600, 0)];

test('T95: a failed App Group read keeps the cached habits (no empty list)', () => {
  const r = habitsAfterSync(cached, { available: true, read: false, habits: [] });
  assert.equal(r.source, 'cache');
  assert.ok('habits' in r);
  if ('habits' in r) assert.deepEqual(r.habits, cached);
});

test('T95: a good read replaces the cache, even with an empty list', () => {
  const read = [setHabitValue(createHabit('sleep', NOW, { utcOffsetMinutes: 0 }), NOW, 7, 0)];
  const r = habitsAfterSync(cached, { available: true, read: true, habits: read });
  assert.equal(r.source, 'native');
  if ('habits' in r) assert.deepEqual(r.habits, read);
  const empty = habitsAfterSync(cached, { available: true, habits: [] });
  assert.equal(empty.source, 'native');
  if ('habits' in empty) assert.deepEqual(empty.habits, []);
});

test('T95: no App Group means the app-only trackers', () => {
  assert.deepEqual(habitsAfterSync(cached, { available: false, habits: [] }), { source: 'local' });
});

test('T95: the native adapter marks a thrown read with read: false and the store uses habitsAfterSync', () => {
  const native = readFileSync(new URL('../native/widgets.ts', import.meta.url), 'utf8');
  assert.match(native, /read: false/);
  const store = readFileSync(new URL('../store/widgetHabits.ts', import.meta.url), 'utf8');
  assert.match(store, /habitsAfterSync\(/);
  assert.doesNotMatch(store, /r\.available \? \{ available: true, habits: r\.habits \}/);
});
