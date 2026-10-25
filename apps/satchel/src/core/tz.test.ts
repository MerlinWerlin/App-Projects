import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addDays, dateRange, dayShift, daysBetween, fromUtc, isLocalDateTime, isValidZone, minutesBetween, offsetMinutes, toUtc, zoneDiffMinutes } from './tz.ts';

const utc = (s: string) => Date.parse(s);

test('wall time in a zone maps to the right UTC instant', () => {
  assert.equal(toUtc({ local: '2026-11-10T21:00', tz: 'Asia/Tokyo' }), utc('2026-11-10T12:00:00Z'));
  assert.equal(toUtc({ local: '2026-11-03T09:30', tz: 'Australia/Sydney' }), utc('2026-11-02T22:30:00Z'));
  assert.equal(toUtc({ local: '2026-01-15T08:00', tz: 'America/New_York' }), utc('2026-01-15T13:00:00Z'));
  assert.equal(toUtc({ local: '2026-06-01T12:00', tz: 'Asia/Kolkata' }), utc('2026-06-01T06:30:00Z'));
  assert.equal(toUtc({ local: '2026-06-01T12:00', tz: 'Asia/Kathmandu' }), utc('2026-06-01T06:15:00Z'));
});

test('round-trips through fromUtc', () => {
  for (const tz of ['Australia/Sydney', 'Asia/Tokyo', 'Europe/London', 'America/Los_Angeles', 'Pacific/Chatham', 'UTC']) {
    for (const local of ['2026-01-01T00:00', '2026-04-05T12:00', '2026-07-15T23:59', '2026-10-25T08:15']) {
      assert.equal(fromUtc(toUtc({ local, tz }), tz), local, `${tz} ${local}`);
    }
  }
});

test('DST spring-forward gap moves forward like a clock (Sydney 4 Oct 2026, 02:00 -> 03:00)', () => {
  const t = toUtc({ local: '2026-10-04T02:30', tz: 'Australia/Sydney' });
  assert.equal(fromUtc(t, 'Australia/Sydney'), '2026-10-04T03:30');
  assert.equal(offsetMinutes('Australia/Sydney', t), 660);
});

test('DST fall-back overlap takes the earlier time (Sydney 5 Apr 2026, 03:00 -> 02:00)', () => {
  const t = toUtc({ local: '2026-04-05T02:30', tz: 'Australia/Sydney' });
  assert.equal(t, utc('2026-04-04T15:30:00Z'));
  assert.equal(offsetMinutes('Australia/Sydney', t), 660);
});

test('DST in the northern hemisphere (New York 8 Mar 2026 gap, 1 Nov 2026 overlap)', () => {
  assert.equal(fromUtc(toUtc({ local: '2026-03-08T02:15', tz: 'America/New_York' }), 'America/New_York'), '2026-03-08T03:15');
  assert.equal(toUtc({ local: '2026-11-01T01:30', tz: 'America/New_York' }), utc('2026-11-01T05:30:00Z'));
});

test('flight duration across zones and DST', () => {
  // Sydney 09:30 -> Tokyo 17:45 on 3 Nov (AEDT +11, JST +9): 10h15m
  assert.equal(minutesBetween({ local: '2026-11-03T09:30', tz: 'Australia/Sydney' }, { local: '2026-11-03T17:45', tz: 'Asia/Tokyo' }), 615);
});

test('cross-dateline: arrive "before" you leave, and a +1 / -1 day shift', () => {
  // Tokyo 21:00 -> Honolulu 09:25 same date: 7h25m in the air
  const dep = { local: '2026-11-10T21:00', tz: 'Asia/Tokyo' };
  const arr = { local: '2026-11-10T09:25', tz: 'Pacific/Honolulu' };
  assert.equal(minutesBetween(dep, arr), 445);
  assert.equal(dayShift(dep, arr), 0);
  // Auckland 19:00 on 12 Nov -> Los Angeles 10:30 on 12 Nov (NZDT +13, PST -8): 12h30m
  assert.equal(minutesBetween({ local: '2026-11-12T19:00', tz: 'Pacific/Auckland' }, { local: '2026-11-12T10:30', tz: 'America/Los_Angeles' }), 750);
  // Los Angeles 22:40 on 1 Dec -> Sydney 06:40 on 3 Dec: day shift +2, 13h
  const la = { local: '2026-12-01T22:40', tz: 'America/Los_Angeles' };
  const syd = { local: '2026-12-03T06:40', tz: 'Australia/Sydney' };
  assert.equal(dayShift(la, syd), 2);
  assert.equal(minutesBetween(la, syd), 780);
  // Apia (UTC+13) to Pago Pago (UTC-11): 30 min flight, arrive the previous day
  const apia = { local: '2026-07-02T08:00', tz: 'Pacific/Apia' };
  const pago = { local: '2026-07-01T08:30', tz: 'Pacific/Pago_Pago' };
  assert.equal(minutesBetween(apia, pago), 30);
  assert.equal(dayShift(apia, pago), -1);
});

test('dates', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(daysBetween('2026-11-03', '2026-11-12'), 9);
  assert.deepEqual(dateRange('2026-11-30', '2026-12-02'), ['2026-11-30', '2026-12-01', '2026-12-02']);
  assert.ok(isLocalDateTime('2026-11-03T09:30'));
  assert.ok(!isLocalDateTime('2026-02-30T09:30'));
  assert.ok(!isLocalDateTime('2026-11-03 09:30'));
  assert.ok(isValidZone('Asia/Tokyo'));
  assert.ok(!isValidZone('Mars/Olympus_Mons'));
  assert.equal(zoneDiffMinutes('Asia/Tokyo', 'Australia/Sydney', utc('2026-11-03T00:00:00Z')), -120);
});
