import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { checkWallTime, toUtc } from './tz.ts';
import { dayFromPicker, isLocalDate, isWallTime, pickedValue, pickerDateForDay, pickerDateForTime, timeFromPicker } from './wallpicker.ts';

// The phone's zone is process.env.TZ here; Node re-reads it whenever it changes. Each test file runs in its own
// process, so this never leaks into other suites.
const original = process.env.TZ;
afterEach(() => {
  process.env.TZ = original;
});

const PHONE_ZONES = ['UTC', 'Australia/Sydney', 'America/New_York', 'Europe/London', 'Asia/Kolkata', 'Pacific/Chatham', 'America/Santiago'];

test('format checks', () => {
  assert.ok(isLocalDate('2026-11-03'));
  assert.ok(isLocalDate('2028-02-29'));
  assert.ok(!isLocalDate('2026-02-29'));
  assert.ok(!isLocalDate('2026-13-01'));
  assert.ok(!isLocalDate('3 Nov'));
  assert.ok(isWallTime('00:00') && isWallTime('23:59'));
  assert.ok(!isWallTime('24:00') && !isWallTime('9:30') && !isWallTime('09:60'));
});

test('every day of a year round-trips through the date picker in any phone zone', () => {
  for (const tz of PHONE_ZONES) {
    process.env.TZ = tz;
    for (let i = 0; i < 366; i++) {
      const day = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
      assert.equal(dayFromPicker(pickerDateForDay(day, '2026-01-01')), day, `${tz} ${day}`);
    }
  }
});

test('every minute of the day round-trips through the time picker in any phone zone', () => {
  for (const tz of PHONE_ZONES) {
    process.env.TZ = tz;
    for (let m = 0; m < 24 * 60; m += 7) {
      const time = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
      assert.equal(timeFromPicker(pickerDateForTime(time)), time, `${tz} ${time}`);
    }
  }
});

test("a time inside the phone's own daylight-saving gap is still shown as typed", () => {
  // 02:30 does not exist in New York on 2026-03-08; the booking is in Tokyo, so it must still show 02:30.
  process.env.TZ = 'America/New_York';
  assert.equal(timeFromPicker(pickerDateForTime('02:30')), '02:30');
  process.env.TZ = 'Australia/Sydney';
  assert.equal(timeFromPicker(pickerDateForTime('02:30')), '02:30');
  assert.equal(dayFromPicker(pickerDateForDay('2026-10-04', '2026-01-01')), '2026-10-04');
});

test("the picker shows the booking's wall clock, not the phone's", () => {
  // A 09:30 Tokyo departure picked on a phone set to Sydney is stored as 09:30 Tokyo, the same instant as when
  // picked on a phone set to London.
  const instants = ['Australia/Sydney', 'Europe/London'].map((tz) => {
    process.env.TZ = tz;
    const date = pickedValue('date', 'set', pickerDateForDay('2026-11-03', '2026-01-01'));
    const time = pickedValue('time', 'set', pickerDateForTime('09:30'));
    assert.equal(date, '2026-11-03');
    assert.equal(time, '09:30');
    return toUtc({ local: `${date}T${time}`, tz: 'Asia/Tokyo' });
  });
  assert.equal(instants[0], Date.parse('2026-11-03T00:30:00Z'));
  assert.equal(instants[1], instants[0]);
});

test('the daylight-saving notes still see the picked wall time', () => {
  process.env.TZ = 'Asia/Tokyo';
  const time = pickedValue('time', 'set', pickerDateForTime('02:30'));
  const check = checkWallTime({ local: `2026-03-08T${time}`, tz: 'America/New_York' });
  assert.equal(check.kind, 'skipped');
});

test('a cancelled or neutral picker changes nothing; unset values open on the fallback', () => {
  const d = pickerDateForDay('2026-11-03', '2026-01-01');
  assert.equal(pickedValue('date', 'dismissed', d), null);
  assert.equal(pickedValue('time', 'neutralButtonPressed', d), null);
  assert.equal(pickedValue('time', 'set', undefined), null);
  assert.equal(pickedValue('time', 'set', new Date(NaN)), null);
  assert.equal(dayFromPicker(pickerDateForDay('', '2026-05-06')), '2026-05-06');
  assert.equal(dayFromPicker(pickerDateForDay('nope', 'nope')), '2000-01-01');
  assert.equal(timeFromPicker(pickerDateForTime('', '18:15')), '18:15');
  assert.equal(timeFromPicker(pickerDateForTime('25:00')), '09:00');
});

test('early years stay literal', () => {
  assert.equal(dayFromPicker(pickerDateForDay('0099-03-04', '2026-01-01')), '0099-03-04');
});
