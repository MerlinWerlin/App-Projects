import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hoursStatus, hoursStatusAt, parseDays, parseOpeningHours, parseTimes } from './openinghours.ts';

// 2026-11-02 is a Monday; 2026-11-07 a Saturday; 2026-11-08 a Sunday.
const MON = '2026-11-02';
const TUE = '2026-11-03';
const FRI = '2026-11-06';
const SAT = '2026-11-07';
const SUN = '2026-11-08';
const at = (day: string, time: string) => `${day}T${time}`;

test('weekday of the fixture dates', () => {
  assert.equal(new Date(Date.UTC(2026, 10, 2)).getUTCDay(), 1);
  assert.equal(new Date(Date.UTC(2026, 10, 8)).getUTCDay(), 0);
});

test('24/7 is always open, with no closing time', () => {
  for (const t of [at(MON, '00:00'), at(SAT, '13:37'), at(SUN, '23:59')]) assert.deepEqual(hoursStatus('24/7', t), { state: 'open' });
  assert.deepEqual(hoursStatus(' 24/7 ', at(MON, '03:00')), { state: 'open' });
  assert.deepEqual(hoursStatus('Mo-Su 00:00-24:00', at(TUE, '12:00')), { state: 'open' });
  assert.deepEqual(hoursStatus('00:00-24:00', at(SUN, '23:30')), { state: 'open' });
});

test('Mo-Fr 08:00-18:00: open inside, closed outside, with the next change', () => {
  const h = 'Mo-Fr 08:00-18:00';
  assert.deepEqual(hoursStatus(h, at(MON, '09:00')), { state: 'open', closesAt: '18:00', closesInDays: 0 });
  assert.deepEqual(hoursStatus(h, at(MON, '08:00')), { state: 'open', closesAt: '18:00', closesInDays: 0 }, 'start is inclusive');
  assert.deepEqual(hoursStatus(h, at(MON, '18:00')), { state: 'closed', opensAt: '08:00', opensInDays: 1 }, 'end is exclusive');
  assert.deepEqual(hoursStatus(h, at(MON, '07:59')), { state: 'closed', opensAt: '08:00', opensInDays: 0 });
  assert.deepEqual(hoursStatus(h, at(FRI, '19:00')), { state: 'closed', opensAt: '08:00', opensInDays: 3 }, 'Friday night: Monday');
  assert.deepEqual(hoursStatus(h, at(SAT, '12:00')), { state: 'closed', opensAt: '08:00', opensInDays: 2 });
  assert.deepEqual(hoursStatus(h, at(SUN, '23:59')), { state: 'closed', opensAt: '08:00', opensInDays: 1 }, 'wraps into next week');
});

test('two rules: weekdays and weekend hours', () => {
  const h = 'Mo-Fr 08:00-18:00; Sa,Su 10:00-16:00';
  assert.equal(hoursStatus(h, at(TUE, '17:00')).state, 'open');
  assert.deepEqual(hoursStatus(h, at(SAT, '09:00')), { state: 'closed', opensAt: '10:00', opensInDays: 0 });
  assert.deepEqual(hoursStatus(h, at(SUN, '15:00')), { state: 'open', closesAt: '16:00', closesInDays: 0 });
  assert.deepEqual(hoursStatus(h, at(FRI, '18:30')), { state: 'closed', opensAt: '10:00', opensInDays: 1 });
});

test('Mo-Su 06:00-24:00 closes at midnight, shown as 24:00', () => {
  const h = 'Mo-Su 06:00-24:00';
  assert.deepEqual(hoursStatus(h, at(MON, '23:30')), { state: 'open', closesAt: '24:00', closesInDays: 0 });
  assert.deepEqual(hoursStatus(h, at(TUE, '00:30')), { state: 'closed', opensAt: '06:00', opensInDays: 0 });
  assert.deepEqual(hoursStatus(h, at(SUN, '05:00')), { state: 'closed', opensAt: '06:00', opensInDays: 0 });
});

test('times past midnight carry into the next morning', () => {
  const h = '22:00-02:00';
  assert.deepEqual(hoursStatus(h, at(MON, '23:00')), { state: 'open', closesAt: '02:00', closesInDays: 1 });
  assert.deepEqual(hoursStatus(h, at(TUE, '01:30')), { state: 'open', closesAt: '02:00', closesInDays: 0 });
  assert.deepEqual(hoursStatus(h, at(TUE, '02:00')), { state: 'closed', opensAt: '22:00', opensInDays: 0 });
  assert.deepEqual(hoursStatus(h, at(TUE, '12:00')), { state: 'closed', opensAt: '22:00', opensInDays: 0 });
});

test('past midnight with a day selector: Friday night runs into Saturday only', () => {
  const h = 'Fr 20:00-03:00';
  assert.equal(hoursStatus(h, at(SAT, '02:00')).state, 'open');
  assert.equal(hoursStatus(h, at(SAT, '04:00')).state, 'closed');
  assert.equal(hoursStatus(h, at(MON, '01:00')).state, 'closed', 'no carry from Sunday');
  assert.deepEqual(hoursStatus(h, at(MON, '01:00')), { state: 'closed', opensAt: '20:00', opensInDays: 4 });
  // Sunday night across the week boundary.
  assert.deepEqual(hoursStatus('Su 22:00-02:00', at(MON, '01:00')), { state: 'open', closesAt: '02:00', closesInDays: 0 });
  // Extended-hours notation.
  assert.deepEqual(hoursStatus('Mo-Su 18:00-26:00', at(TUE, '01:00')), { state: 'open', closesAt: '02:00', closesInDays: 0 });
});

test('several ranges in a day: lunch break', () => {
  const h = 'Mo-Fr 08:00-12:00,13:00-17:00';
  assert.deepEqual(hoursStatus(h, at(MON, '12:30')), { state: 'closed', opensAt: '13:00', opensInDays: 0 });
  assert.deepEqual(hoursStatus(h, at(MON, '11:00')), { state: 'open', closesAt: '12:00', closesInDays: 0 });
  assert.deepEqual(hoursStatus(h, at(MON, '16:00')), { state: 'open', closesAt: '17:00', closesInDays: 0 });
  assert.deepEqual(hoursStatus('08:00-12:00, 13:00-17:00', at(SAT, '13:30')), { state: 'open', closesAt: '17:00', closesInDays: 0 });
});

test('touching ranges merge, so closesAt is the real closing time', () => {
  assert.deepEqual(hoursStatus('08:00-12:00,12:00-20:00', at(MON, '10:00')), { state: 'open', closesAt: '20:00', closesInDays: 0 });
  assert.deepEqual(hoursStatus('Mo-Su 00:00-24:00; Su off', at(SAT, '10:00')), { state: 'open', closesAt: '24:00', closesInDays: 0 });
});

test('off / closed: alone, and overriding earlier rules for the days named', () => {
  assert.deepEqual(hoursStatus('off', at(MON, '12:00')), { state: 'closed' });
  assert.deepEqual(hoursStatus('closed', at(MON, '12:00')), { state: 'closed' });
  const h = 'Mo-Su 08:00-20:00; We off';
  assert.equal(hoursStatus(h, at('2026-11-04', '12:00')).state, 'closed');
  assert.deepEqual(hoursStatus(h, at('2026-11-04', '12:00')), { state: 'closed', opensAt: '08:00', opensInDays: 1 });
  assert.equal(hoursStatus(h, at(TUE, '12:00')).state, 'open');
  assert.equal(hoursStatus('Mo-Sa 09:00-17:00; Su closed', at(SUN, '12:00')).state, 'closed');
});

test('a later ; rule replaces earlier hours for its days', () => {
  const h = 'Mo-Su 08:00-20:00; Sa 10:00-14:00';
  assert.equal(hoursStatus(h, at(SAT, '09:00')).state, 'closed');
  assert.equal(hoursStatus(h, at(SAT, '15:00')).state, 'closed');
  assert.equal(hoursStatus(h, at(SUN, '09:00')).state, 'open');
});

test('a , rule adds to earlier ones', () => {
  const h = 'Mo-Fr 08:00-18:00, Sa 10:00-14:00';
  assert.equal(hoursStatus(h, at(SAT, '11:00')).state, 'open');
  assert.equal(hoursStatus(h, at(MON, '09:00')).state, 'open');
  assert.equal(hoursStatus(h, at(SUN, '11:00')).state, 'closed');
});

test('day lists and wrapping day ranges', () => {
  const h = 'Mo,We,Fr 09:00-17:00';
  assert.equal(hoursStatus(h, at(MON, '10:00')).state, 'open');
  assert.equal(hoursStatus(h, at(TUE, '10:00')).state, 'closed');
  assert.deepEqual(hoursStatus(h, at(TUE, '10:00')), { state: 'closed', opensAt: '09:00', opensInDays: 1 });
  assert.equal(hoursStatus('Fr-Mo 10:00-16:00', at(SUN, '11:00')).state, 'open');
  assert.equal(hoursStatus('Fr-Mo 10:00-16:00', at(TUE, '11:00')).state, 'closed');
  assert.deepEqual(parseDays('Fr-Mo'), [0, 4, 5, 6]);
  assert.deepEqual(parseDays('Mo,We,Fr'), [0, 2, 4]);
  assert.deepEqual(parseDays('Sa-Su'), [5, 6]);
  assert.equal(parseDays('Xx'), null);
  assert.equal(parseDays('Mo-'), null);
});

test('days without times mean all day; "open" too', () => {
  assert.equal(hoursStatus('Sa,Su', at(SAT, '03:00')).state, 'open');
  assert.equal(hoursStatus('Sa,Su', at(MON, '03:00')).state, 'closed');
  assert.equal(hoursStatus('Mo-Fr open', at(TUE, '23:00')).state, 'open');
});

test('tolerates loose spacing, lower case and a colon after the days', () => {
  assert.equal(hoursStatus('mo-fr 08:00-18:00', at(MON, '09:00')).state, 'open');
  assert.equal(hoursStatus('Mo - Fr 08:00 - 18:00', at(MON, '09:00')).state, 'open');
  assert.equal(hoursStatus('Mo-Fr: 08:00-18:00', at(MON, '09:00')).state, 'open');
  assert.equal(hoursStatus('Mo, We 08:00-18:00', at('2026-11-04', '09:00')).state, 'open');
  assert.equal(hoursStatus('Mo-Fr 08:00-18:00;', at(MON, '09:00')).state, 'open', 'trailing semicolon');
  assert.equal(hoursStatus('8:00-18:00', at(MON, '09:00')).state, 'open', 'one-digit hour');
});

test('anything we do not evaluate is unknown, never a guess', () => {
  const cases = [
    'sunrise-sunset',
    'Mo-Fr 08:00-sunset',
    'Mo-Fr 08:00-18:00; PH off',
    'PH 10:00-14:00',
    'SH off',
    'Jan-Mar 10:00-16:00',
    'Apr-Oct Mo-Su 08:00-20:00',
    '2026 Mo-Fr 08:00-18:00',
    'week 01-10 Mo 08:00-12:00',
    'Mo[1] 10:00-12:00',
    '10:00+',
    'Mo-Fr 08:00-18:00 "ask at the bar"',
    'Mo-Fr 08:00-18:00 || "by appointment"',
    'unknown',
    'easter off',
    'whenever the cafe is open',
    'Mo-Fr 25:00-26:00',
    'Mo-Fr 08:60-18:00',
    'Mo-Fr 0800-1800',
    'Mo-Fr 08:00',
    'Xy 08:00-18:00',
    '',
    '   ',
  ];
  for (const c of cases) assert.deepEqual(hoursStatus(c, at(MON, '12:00')), { state: 'unknown' }, c);
  assert.deepEqual(hoursStatus(undefined, at(MON, '12:00')), { state: 'unknown' });
  assert.deepEqual(hoursStatus(null, at(MON, '12:00')), { state: 'unknown' });
  assert.deepEqual(hoursStatus('24/7', 'not a time'), { state: 'unknown' });
  assert.deepEqual(hoursStatus('x'.repeat(300), at(MON, '12:00')), { state: 'unknown' });
});

test('parseTimes and parseOpeningHours shapes', () => {
  assert.deepEqual(parseTimes('08:00-12:00,13:00-17:00'), [
    [480, 720],
    [780, 1020],
  ]);
  assert.deepEqual(parseTimes('22:00-02:00'), [[1320, 1560]]);
  assert.equal(parseTimes('08:00'), null);
  assert.equal(parseTimes('24:00-02:00'), null, 'start must be inside the day');
  assert.equal(parseOpeningHours('PH off'), null);
  assert.deepEqual(parseOpeningHours('off'), []);
  assert.equal(parseOpeningHours('Mo 08:00-09:00')?.length, 1);
});

test('hoursStatusAt reads the wall clock in the place zone', () => {
  // 2026-11-02T00:30Z is 09:30 Monday in Tokyo but 19:30 Sunday in New York.
  const utc = Date.UTC(2026, 10, 2, 0, 30);
  const h = 'Mo-Fr 09:00-18:00';
  assert.deepEqual(hoursStatusAt(h, utc, 'Asia/Tokyo'), { state: 'open', closesAt: '18:00', closesInDays: 0 });
  assert.deepEqual(hoursStatusAt(h, utc, 'America/New_York'), { state: 'closed', opensAt: '09:00', opensInDays: 1 });
  assert.deepEqual(hoursStatusAt(h, utc, 'Not/AZone'), { state: 'unknown' });
  assert.deepEqual(hoursStatusAt(h, Number.NaN, 'Asia/Tokyo'), { state: 'unknown' });
});

test('a week with nothing open after now says closed without an opening time', () => {
  assert.deepEqual(hoursStatus('Mo-Su off', at(TUE, '10:00')), { state: 'closed' });
});
