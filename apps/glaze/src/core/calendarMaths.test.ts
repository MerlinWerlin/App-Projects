import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  countdownTo,
  dayOfYear,
  daysBetween,
  daysInMonth,
  daysInYear,
  dotGrid,
  handAngles,
  isDayKey,
  isLeapYear,
  localDayKey,
  localParts,
  monthGrid,
  monthProgress,
  nextLocalMidnight,
  parseDayKey,
  yearProgress,
} from './calendarMaths.ts';

const at = (iso: string): Date => new Date(iso);

test('leap years follow the Gregorian rule', () => {
  for (const y of [2024, 2028, 2000, 2400]) assert.ok(isLeapYear(y), String(y));
  for (const y of [2026, 2100, 1900, 2023]) assert.ok(!isLeapYear(y), String(y));
  assert.equal(daysInYear(2024), 366);
  assert.equal(daysInYear(2026), 365);
  assert.equal(daysInMonth(2024, 2), 29);
  assert.equal(daysInMonth(2026, 2), 28);
  assert.equal(daysInMonth(2026, 10), 31);
  assert.equal(daysInMonth(2026, 4), 30);
});

test('day of year, including leap years', () => {
  assert.equal(dayOfYear(2026, 1, 1), 1);
  assert.equal(dayOfYear(2026, 7, 22), 203);
  assert.equal(dayOfYear(2026, 12, 31), 365);
  assert.equal(dayOfYear(2024, 3, 1), 61);
  assert.equal(dayOfYear(2026, 3, 1), 60);
  assert.equal(dayOfYear(2024, 12, 31), 366);
});

test('year progress: day 203/365, leap years and the last day', () => {
  const p = yearProgress(at('2026-07-22T12:00:00Z'), 0);
  assert.deepEqual(p, { day: 203, total: 365, fraction: 203 / 365, percent: 55, remaining: 162 });
  const leap = yearProgress(at('2024-07-21T12:00:00Z'), 0);
  assert.equal(leap.day, 203);
  assert.equal(leap.total, 366);
  assert.equal(yearProgress(at('2024-12-31T23:59:00Z'), 0).percent, 100);
  assert.equal(yearProgress(at('2024-12-31T23:59:00Z'), 0).remaining, 0);
  assert.equal(yearProgress(at('2026-12-30T12:00:00Z'), 0).percent, 99);
  assert.equal(yearProgress(at('2026-01-01T00:00:00Z'), 0).day, 1);
  assert.equal(yearProgress(at('2024-02-29T12:00:00Z'), 0).day, 60);
});

test('progress follows the local day, not UTC', () => {
  // 23:30 UTC on 31 Dec is already 1 Jan in UTC+10 and still 31 Dec in UTC−5.
  const d = at('2025-12-31T23:30:00Z');
  assert.deepEqual([yearProgress(d, 600).day, yearProgress(d, 600).total], [1, 365]);
  assert.equal(yearProgress(d, -300).day, 365);
  assert.equal(localDayKey(d, 600), '2026-01-01');
  assert.equal(localDayKey(d, -300), '2025-12-31');
});

test('month progress', () => {
  assert.deepEqual(monthProgress(at('2026-10-18T09:00:00Z'), 0), { day: 18, total: 31, fraction: 18 / 31, percent: 58, remaining: 13 });
  assert.equal(monthProgress(at('2024-02-29T09:00:00Z'), 0).total, 29);
  assert.equal(monthProgress(at('2024-02-29T09:00:00Z'), 0).percent, 100);
  assert.equal(monthProgress(at('2026-02-14T09:00:00Z'), 0).total, 28);
});

test('day keys parse only real days; arithmetic crosses months, years and leap days', () => {
  assert.ok(isDayKey('2024-02-29'));
  for (const bad of ['2026-02-29', '2026-13-01', '2026-1-01', 'x', '', '2026-00-10', '2026-04-31', 20261018]) assert.ok(!isDayKey(bad), String(bad));
  assert.deepEqual(parseDayKey('2026-10-18'), { year: 2026, month: 10, day: 18 });
  assert.equal(addDays('2024-02-28', 1), '2024-02-29');
  assert.equal(addDays('2026-02-28', 1), '2026-03-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
  assert.equal(daysBetween('2026-01-01', '2027-01-01'), 365);
  assert.equal(daysBetween('2024-01-01', '2025-01-01'), 366);
  assert.equal(daysBetween('2026-10-18', '2026-10-01'), -17);
  assert.throws(() => addDays('nope', 1));
});

test('countdown counts local calendar days', () => {
  const now = at('2026-10-18T22:00:00Z');
  assert.deepEqual(countdownTo('2026-12-25', now, 0), { days: 68, state: 'upcoming' });
  assert.deepEqual(countdownTo('2026-12-25', now, 600), { days: 67, state: 'upcoming' }); // already 19 Oct locally
  assert.deepEqual(countdownTo('2026-10-18', now, 0), { days: 0, state: 'today' });
  assert.deepEqual(countdownTo('2026-10-01', now, 0), { days: -17, state: 'past' });
  assert.deepEqual(countdownTo('2028-02-29', at('2028-02-28T12:00:00Z'), 0), { days: 1, state: 'upcoming' });
  assert.equal(countdownTo('2026-02-30', now, 0), null);
});

test('month grid pads to whole weeks for both week starts', () => {
  // 1 Oct 2026 is a Thursday.
  const mon = monthGrid(2026, 10, 1);
  assert.deepEqual(mon[0], [0, 0, 0, 1, 2, 3, 4]);
  assert.equal(mon.flat().filter(Boolean).length, 31);
  const sun = monthGrid(2026, 10, 0);
  assert.deepEqual(sun[0], [0, 0, 0, 0, 1, 2, 3]);
  for (const w of [...mon, ...sun]) assert.equal(w.length, 7);
  assert.equal(monthGrid(2024, 2).flat().filter(Boolean).length, 29);
  // Feb 2027 starts on a Monday and fills exactly 4 weeks.
  assert.equal(monthGrid(2027, 2, 1).length, 4);
});

test('hand angles', () => {
  assert.deepEqual(handAngles(at('2026-10-18T03:00:00Z'), 0), { hour: 90, minute: 0, second: 0 });
  const a = handAngles(at('2026-10-18T09:41:30Z'), 0);
  assert.equal(a.minute, 41 * 6 + 3);
  assert.equal(a.hour, 9 * 30 + 41 * 0.5 + 0.25);
  assert.equal(a.second, 180);
  assert.equal(handAngles(at('2026-10-18T12:00:00Z'), 0).hour, 0);
  assert.equal(handAngles(at('2026-10-18T09:00:00Z'), 60).hour, 300);
});

test('next local midnight', () => {
  assert.equal(nextLocalMidnight(at('2026-10-18T09:41:00Z'), 0).toISOString(), '2026-10-19T00:00:00.000Z');
  assert.equal(nextLocalMidnight(at('2026-10-18T09:41:00Z'), 600).toISOString(), '2026-10-18T14:00:00.000Z');
  assert.equal(nextLocalMidnight(at('2024-02-28T23:59:59Z'), 0).toISOString(), '2024-02-29T00:00:00.000Z');
  // Without an offset the device calendar is used: the result is local midnight, after `now`.
  const now = at('2026-10-18T09:41:00Z');
  const m = nextLocalMidnight(now);
  assert.ok(m.getTime() > now.getTime());
  assert.deepEqual([m.getHours(), m.getMinutes()], [0, 0]);
  assert.equal(localParts(m).day !== localParts(now).day || localParts(m).month !== localParts(now).month, true);
});

test('dot grid fits every dot and favours big dots', () => {
  for (const [n, a] of [[365, 1], [366, 2.5], [31, 1], [31, 4], [1, 1], [12, 0.5]] as const) {
    const g = dotGrid(n, a);
    assert.ok(g.columns * g.rows >= n, `${n}@${a}`);
    assert.ok((g.columns - 1) * g.rows < n || g.columns * (g.rows - 1) < n, 'no spare line');
  }
  assert.deepEqual(dotGrid(31, 1), { columns: 6, rows: 6 });
  assert.equal(dotGrid(0, 1).columns, 1);
});
