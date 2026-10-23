import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DAYS_CAP,
  EMPTY_PROGRESS,
  MAX_SESSION_MS,
  currentStreak,
  dayKey,
  parseProgress,
  previousDay,
  recordSession,
  sanitizeProgress,
  summary,
  type Progress,
} from './progress.ts';

const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const withDays = (days: string[]): Progress => ({ sessions: days.length, tracedMs: 0, days });

test('dayKey uses local time and zero-pads', () => {
  assert.equal(dayKey(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
  assert.equal(dayKey(new Date(2026, 9, 18, 0, 1)), '2026-10-18');
});

test('previousDay crosses months, years and leap days; rejects bad keys', () => {
  assert.equal(previousDay('2026-03-01'), '2026-02-28');
  assert.equal(previousDay('2024-03-01'), '2024-02-29');
  assert.equal(previousDay('2026-01-01'), '2025-12-31');
  assert.equal(previousDay('2026-02-31'), null);
  assert.equal(previousDay('yesterday'), null);
});

test('recordSession ignores sessions under 20 s', () => {
  const s = recordSession(EMPTY_PROGRESS, at(2026, 10, 18), at(2026, 10, 18) + 19_999, at(2026, 10, 19));
  assert.equal(s, EMPTY_PROGRESS);
});

test('recordSession counts a session, its time and its day', () => {
  const start = at(2026, 10, 18, 9);
  const s = recordSession(EMPTY_PROGRESS, start, start + 5 * 60_000, start + 5 * 60_000);
  assert.deepEqual(s, { sessions: 1, tracedMs: 5 * 60_000, days: ['2026-10-18'] });
  const again = recordSession(s, start + 6 * 60_000, start + 7 * 60_000, start + 7 * 60_000);
  assert.deepEqual(again.days, ['2026-10-18']);
  assert.equal(again.sessions, 2);
});

test('recordSession caps one session at 3 h and clamps the end to now', () => {
  const start = at(2026, 10, 18, 8);
  const long = recordSession(EMPTY_PROGRESS, start, start + 10 * 3600_000, start + 10 * 3600_000);
  assert.equal(long.tracedMs, MAX_SESSION_MS);
  const future = recordSession(EMPTY_PROGRESS, start, start + 3600_000, start + 60_000);
  assert.equal(future.tracedMs, 60_000);
  assert.equal(recordSession(EMPTY_PROGRESS, start, start - 60_000, start), EMPTY_PROGRESS);
  assert.equal(recordSession(EMPTY_PROGRESS, Number.NaN, start, start), EMPTY_PROGRESS);
});

test('recordSession files the day by the session end', () => {
  const start = at(2026, 10, 17, 23, 50);
  const s = recordSession(EMPTY_PROGRESS, start, start + 20 * 60_000, start + 20 * 60_000);
  assert.deepEqual(s.days, ['2026-10-18']);
});

test('currentStreak counts back from today, or from yesterday', () => {
  const p = withDays(['2026-10-14', '2026-10-16', '2026-10-17', '2026-10-18']);
  assert.equal(currentStreak(p, '2026-10-18'), 3);
  assert.equal(currentStreak(p, '2026-10-19'), 3);
  assert.equal(currentStreak(p, '2026-10-20'), 0);
  assert.equal(currentStreak(withDays([]), '2026-10-18'), 0);
  assert.equal(currentStreak(withDays(['2025-12-31', '2026-01-01']), '2026-01-01'), 2);
});

test('summary gives trace sessions (not drawings), whole minutes and streak', () => {
  const p: Progress = { sessions: 3, tracedMs: 42 * 60_000 + 59_000, days: ['2026-10-17', '2026-10-18'] };
  assert.deepEqual(summary(p, '2026-10-18'), { sessions: 3, minutes: 42, streak: 2 });
});

test('days stay unique, sorted and capped', () => {
  let p: Progress = EMPTY_PROGRESS;
  for (let i = 0; i < DAYS_CAP + 30; i++) {
    const start = at(2025, 1, 1 + i, 10);
    p = recordSession(p, start, start + 60_000, start + 60_000);
  }
  assert.equal(p.days.length, DAYS_CAP);
  assert.equal(p.sessions, DAYS_CAP + 30);
  assert.deepEqual([...p.days].sort(), p.days);
  assert.equal(p.days[p.days.length - 1], dayKey(new Date(at(2025, 1, 1 + DAYS_CAP + 29))));
});

test('sanitize / parse tolerate any stored shape', () => {
  assert.deepEqual(parseProgress(null), EMPTY_PROGRESS);
  assert.deepEqual(parseProgress('not json'), EMPTY_PROGRESS);
  assert.deepEqual(parseProgress('[1,2]'), EMPTY_PROGRESS);
  assert.deepEqual(sanitizeProgress('x'), EMPTY_PROGRESS);
  assert.deepEqual(
    sanitizeProgress({ sessions: 2.7, tracedMs: -5, days: ['2026-10-18', 4, 'bad', '2026-10-17', '2026-10-18', '2026-02-30'] }),
    { sessions: 2, tracedMs: 0, days: ['2026-10-17', '2026-10-18'] },
  );
  assert.deepEqual(sanitizeProgress({ sessions: Infinity, tracedMs: '5', days: 'nope' }), EMPTY_PROGRESS);
  const p: Progress = { sessions: 4, tracedMs: 99_000, days: ['2026-10-18'] };
  assert.deepEqual(parseProgress(JSON.stringify(p)), p);
});
