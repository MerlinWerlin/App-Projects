// Wall-clock values <-> the Date a system date/time picker shows (T24).
//
// The system pickers always display a Date in the PHONE's time zone. A booking's times belong to the booking's own
// IANA zone (model.ts Stamp), so Satchel never converts through an instant here: it hands the picker a Date whose
// phone-local fields equal the booking's wall-clock fields and reads the fields back the same way. The picker then
// shows "09:30" for a 09:30 Tokyo departure whether the phone is set to Sydney, London or Tokyo, and the zone
// read-back and daylight-saving notes (tz.ts checkWallTime) still work on the wall time exactly as typed.
//
// Two traps are handled:
//  - the phone's own daylight-saving gap: 02:30 does not exist on a spring-forward night in the phone's zone, so
//    a Date built for that night would read back as 03:30. Times are built on reference days with no change in
//    any common zone (mid-January, mid-July), and checked.
//  - dates are built at midday, which no zone skips.
import type { LocalDate } from './model.ts';

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{2}):(\d{2})$/;
const pad = (n: number) => String(n).padStart(2, '0');

/** True for a real calendar date written YYYY-MM-DD. */
export function isLocalDate(s: string): boolean {
  const m = DATE_RE.exec(s);
  if (!m) return false;
  const [y, mo, d] = m.slice(1).map(Number);
  const back = new Date(0);
  back.setUTCFullYear(y, mo - 1, d);
  return back.getUTCFullYear() === y && back.getUTCMonth() === mo - 1 && back.getUTCDate() === d;
}

/** True for a 24-hour HH:MM time. */
export function isWallTime(s: string): boolean {
  const m = TIME_RE.exec(s);
  return !!m && Number(m[1]) < 24 && Number(m[2]) < 60;
}

/** The Date to give a date picker so it shows `date` (or `fallback` when `date` is not a real date yet). */
export function pickerDateForDay(date: string, fallback: LocalDate): Date {
  const use = isLocalDate(date) ? date : isLocalDate(fallback) ? fallback : '2000-01-01';
  const [y, mo, d] = use.split('-').map(Number);
  const out = new Date(2000, 0, 1, 12, 0, 0, 0);
  // setFullYear keeps years 0-99 literal (the Date constructor would read them as 19xx).
  out.setFullYear(y, mo - 1, d);
  return out;
}

/** The calendar date a date picker returned, as YYYY-MM-DD. */
export function dayFromPicker(picked: Date): LocalDate {
  return `${String(picked.getFullYear()).padStart(4, '0')}-${pad(picked.getMonth() + 1)}-${pad(picked.getDate())}`;
}

// Mid-January and mid-July: no zone in the tz database changes its clocks on these days in 2001.
const REFERENCE_DAYS: Array<[number, number, number]> = [
  [2001, 0, 15],
  [2001, 6, 15],
  [2001, 3, 15],
  [2001, 9, 15],
];

/** The Date to give a time picker so it shows `time` (or `fallback` when `time` is not HH:MM yet). */
export function pickerDateForTime(time: string, fallback = '09:00'): Date {
  const use = isWallTime(time) ? time : isWallTime(fallback) ? fallback : '09:00';
  const [h, mi] = use.split(':').map(Number);
  let last = new Date(2001, 0, 15, h, mi, 0, 0);
  for (const [y, mo, d] of REFERENCE_DAYS) {
    last = new Date(y, mo, d, h, mi, 0, 0);
    if (last.getHours() === h && last.getMinutes() === mi) return last;
  }
  return last;
}

/** The wall time a time picker returned, as HH:MM (seconds dropped). */
export function timeFromPicker(picked: Date): string {
  return `${pad(picked.getHours())}:${pad(picked.getMinutes())}`;
}

/**
 * The outcome of a picker event (the library's onChange). Only 'set' with a date changes the value; 'dismissed'
 * and the Android neutral button leave it alone (FLOWS: a cancelled picker keeps what was entered).
 */
export function pickedValue(mode: 'date' | 'time', type: 'set' | 'dismissed' | 'neutralButtonPressed', picked: Date | undefined): string | null {
  if (type !== 'set' || !picked || Number.isNaN(picked.getTime())) return null;
  return mode === 'date' ? dayFromPicker(picked) : timeFromPicker(picked);
}
