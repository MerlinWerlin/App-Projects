import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { en } from '../i18n/en.ts';
import { demoTrip } from './demo.ts';
import {
  cleanStore,
  dailyTimes,
  EMPTY_MEDS,
  doseDayShift,
  gradualShift,
  nextDoseNow,
  shiftDayTimes,
  homeToLocal,
  isNight,
  jumpChangeMin,
  keepHomeRows,
  MAX_MEDS,
  medFromDraft,
  medStops,
  MEDS_KEY,
  minGapChoices,
  newMedDraft,
  nextDose,
  nextDoseForTrip,
  parseClock,
  removeMed,
  shiftLocalRows,
  upsertMed,
  type Med,
  type MedStop,
} from './medtimes.ts';
import type { Item, Trip } from './model.ts';
import { buildTripFile } from './tripfile.ts';
import { fromUtc, localTime, toUtc } from './tz.ts';

const H = 3_600_000;
const utc = (s: string) => Date.parse(s);
const fixed = (times: string[], id = 'f'): Med => ({ id, name: 'Tablet', dose: '1 tablet', mode: 'fixed', times });
const every = (h: number, firstAt: string, minGapMin?: number, id = 'e'): Med => {
  const r = medFromDraft({ ...newMedDraft(), name: 'Drops', mode: 'interval', everyHours: h, firstAt, minGapMin: minGapMin ?? h * 60 - 60 }, id);
  assert.ok(r.ok);
  return r.ok ? r.med : (null as never);
};
const stop = (tz: string, startIso: string, endIso: string, firstDate: string, lastDate: string, diffMin = 0): MedStop => ({
  tz,
  startUtc: utc(startIso),
  endUtc: utc(endIso),
  firstDate,
  lastDate,
  diffMin,
});

// ----------------------------------------------------------------------------------------------- input and storage

test('typed clock times are read leniently and checked', () => {
  assert.equal(parseClock('8'), '08:00');
  assert.equal(parseClock('830'), '08:30');
  assert.equal(parseClock(' 20:15 '), '20:15');
  assert.equal(parseClock('7.45'), '07:45');
  assert.equal(parseClock('24:00'), null);
  assert.equal(parseClock('12:60'), null);
  assert.equal(parseClock('noon'), null);
});

test('medicines are cleaned on read, validated from the form and capped', () => {
  assert.deepEqual(cleanStore(null), EMPTY_MEDS);
  assert.deepEqual(cleanStore({ meds: 'x', plans: { a: 'sideways' }, stepMin: 45 }), EMPTY_MEDS);
  const s = cleanStore({
    meds: [
      { id: 'a', name: '  Tablet ', dose: '5 mg', mode: 'fixed', times: ['20:00', '08:00', '08:00', 'bad'] },
      { id: 'b', name: 'Drops', mode: 'interval', everyHours: 8, firstAt: '06:00', minGapMin: 10 },
      { id: 'c', name: '', mode: 'fixed', times: ['08:00'] },
      { id: 'd', name: 'Odd', mode: 'interval', everyHours: 5, firstAt: '06:00' },
      { id: 'a', name: 'Dup', mode: 'fixed', times: ['09:00'] },
    ],
    plans: { t1: 'local', t2: 'home', t3: 'nope' },
    stepMin: 120,
  });
  assert.deepEqual(
    s.meds.map((m) => [m.id, m.name, m.times]),
    [
      ['a', 'Tablet', ['08:00', '20:00']],
      ['b', 'Drops', ['06:00', '14:00', '22:00']],
    ],
  );
  assert.equal(s.meds[1].minGapMin, 420, 'an unknown minimum gap falls back to 1 h shorter than the interval');
  assert.deepEqual(s.plans, { t1: 'local', t2: 'home' });
  assert.equal(s.stepMin, 120);

  assert.deepEqual(medFromDraft({ ...newMedDraft(), name: ' ' }, 'x'), { ok: false, errors: ['name', 'times'] });
  assert.deepEqual(medFromDraft({ ...newMedDraft(), name: 'A', mode: 'interval', firstAt: '25:00' }, 'x'), { ok: false, errors: ['firstAt'] });
  assert.deepEqual(minGapChoices(8), [360, 390, 420, 450, 480]);
  assert.deepEqual(minGapChoices(3), [90, 120, 150, 180]);
  assert.deepEqual(dailyTimes(every(6, '22:30')), ['04:30', '10:30', '16:30', '22:30']);

  let list: Med[] = [];
  for (let i = 0; i < MAX_MEDS; i++) list = upsertMed(list, fixed(['08:00'], `m${i}`)) ?? list;
  assert.equal(list.length, MAX_MEDS);
  assert.equal(upsertMed(list, fixed(['08:00'], 'extra')), null);
  assert.equal(upsertMed(list, { ...fixed(['09:00'], 'm0'), name: 'Renamed' })?.[0].name, 'Renamed');
  assert.equal(removeMed(list, 'm0').length, MAX_MEDS - 1);
});

// ----------------------------------------------------------------------------------------------- home -> local

test('home to local follows each date across daylight-saving changes', () => {
  // New York moves its clocks on 8 Mar 2026, London on 29 Mar: three weeks where the gap is 4 h, not 5 h.
  assert.deepEqual(homeToLocal('08:00', '2026-03-01', 'America/New_York', 'Europe/London'), { home: '08:00', local: '13:00', dayShift: 0 });
  assert.deepEqual(homeToLocal('08:00', '2026-03-10', 'America/New_York', 'Europe/London'), { home: '08:00', local: '12:00', dayShift: 0 });
  assert.deepEqual(homeToLocal('08:00', '2026-04-10', 'America/New_York', 'Europe/London'), { home: '08:00', local: '13:00', dayShift: 0 });
  // Southern hemisphere: Sydney leaves daylight saving on 5 Apr 2026.
  assert.deepEqual(homeToLocal('21:00', '2026-04-04', 'Australia/Sydney', 'Asia/Tokyo'), { home: '21:00', local: '19:00', dayShift: 0 });
  assert.deepEqual(homeToLocal('21:00', '2026-04-06', 'Australia/Sydney', 'Asia/Tokyo'), { home: '21:00', local: '20:00', dayShift: 0 });

  const rows = keepHomeRows(fixed(['08:00']), stop('Europe/London', '2026-03-01T12:00Z', '2026-03-15T12:00Z', '2026-03-01', '2026-03-15'), 'America/New_York');
  assert.equal(rows[0].local, '13:00');
  assert.ok(rows[0].later);
  assert.equal(rows[0].later?.local, '12:00');
  assert.equal(rows[0].later?.from, '2026-03-08');
  const calm = keepHomeRows(fixed(['08:00']), stop('Asia/Tokyo', '2026-11-03T12:00Z', '2026-11-10T12:00Z', '2026-11-03', '2026-11-10'), 'Europe/London');
  assert.deepEqual(calm.map((r) => [r.local, r.dayShift, r.later]), [['17:00', 0, null]]);
});

test('home to local at the +14 h and -11 h edges and across the date line', () => {
  // Kiritimati (UTC+14) and Pago Pago (UTC-11) are 25 hours apart.
  assert.deepEqual(homeToLocal('08:00', '2026-11-02', 'Pacific/Pago_Pago', 'Pacific/Kiritimati'), { home: '08:00', local: '09:00', dayShift: 1 });
  assert.deepEqual(homeToLocal('08:00', '2026-11-03', 'Pacific/Kiritimati', 'Pacific/Pago_Pago'), { home: '08:00', local: '07:00', dayShift: -1 });
  // Honolulu and Kiritimati share the clock but not the date.
  assert.deepEqual(homeToLocal('08:00', '2026-11-02', 'Pacific/Honolulu', 'Pacific/Kiritimati'), { home: '08:00', local: '08:00', dayShift: 1 });
  assert.deepEqual(homeToLocal('23:30', '2026-11-02', 'Pacific/Auckland', 'Pacific/Honolulu'), { home: '23:30', local: '00:30', dayShift: 0 });

  const trip = flightTrip('Pacific/Honolulu', 'Pacific/Kiritimati', '2026-11-02T09:00', '2026-11-03T12:00', '2026-11-10');
  const stops = medStops(trip, 'Pacific/Honolulu');
  assert.equal(stops.length, 1);
  assert.equal(stops[0].tz, 'Pacific/Kiritimati');
  assert.equal(stops[0].diffMin, 1440);
  assert.equal(jumpChangeMin(stops[0]), 0, 'same clock: switching to local time changes no gap');
  assert.equal(stops[0].firstDate, '2026-11-03');
  assert.equal(stops[0].lastDate, '2026-11-10');
});

// ----------------------------------------------------------------------------------------------- stops

function item(x: Partial<Item> & Pick<Item, 'id' | 'kind' | 'start'>): Item {
  return { tripId: 't', title: x.id, attachments: [], ...x };
}

function flightTrip(homeTz: string, awayTz: string, depLocal: string, arrLocal: string, endDate: string): Trip {
  return {
    id: 't',
    name: 'Trip',
    startDate: depLocal.slice(0, 10),
    endDate,
    homeTz,
    createdAt: '2026-10-01T00:00:00Z',
    items: [
      item({ id: 'out', kind: 'flight', start: { local: depLocal, tz: homeTz }, end: { local: arrLocal, tz: awayTz } }),
      item({ id: 'hotel', kind: 'hotel', start: { local: `${arrLocal.slice(0, 10)}T15:00`, tz: awayTz }, end: { local: `${endDate}T10:00`, tz: awayTz } }),
    ],
  };
}

test('stops come from booking zones: connections are skipped, home is not a stop', () => {
  const trip: Trip = {
    ...flightTrip('Europe/London', 'Asia/Tokyo', '2026-11-02T21:00', '2026-11-03T18:00', '2026-11-12'),
    items: [
      item({ id: 'f1', kind: 'flight', start: { local: '2026-11-02T21:00', tz: 'Europe/London' }, end: { local: '2026-11-03T07:00', tz: 'Asia/Dubai' } }),
      item({ id: 'f2', kind: 'flight', start: { local: '2026-11-03T09:30', tz: 'Asia/Dubai' }, end: { local: '2026-11-03T23:30', tz: 'Asia/Tokyo' } }),
      item({ id: 'h1', kind: 'hotel', start: { local: '2026-11-04T00:30', tz: 'Asia/Tokyo' }, end: { local: '2026-11-08T10:00', tz: 'Asia/Tokyo' } }),
      item({ id: 'f3', kind: 'flight', start: { local: '2026-11-08T12:00', tz: 'Asia/Tokyo' }, end: { local: '2026-11-08T15:00', tz: 'Asia/Bangkok' } }),
      item({ id: 'f4', kind: 'flight', start: { local: '2026-11-12T08:00', tz: 'Asia/Bangkok' }, end: { local: '2026-11-12T15:00', tz: 'Europe/London' } }),
    ],
  };
  const stops = medStops(trip, 'Europe/London');
  assert.deepEqual(
    stops.map((s) => [s.tz, s.firstDate, s.lastDate, s.diffMin]),
    [
      ['Asia/Tokyo', '2026-11-03', '2026-11-08', 540],
      ['Asia/Bangkok', '2026-11-08', '2026-11-12', 420],
    ],
  );
  assert.deepEqual(medStops({ items: [], endDate: '2026-11-12' }, 'Europe/London'), []);
});

// ----------------------------------------------------------------------------------------------- gradual shift

function checkShift(plan: ReturnType<typeof gradualShift>, med: Med, stepMax: number) {
  const P = (med.everyHours ?? 24) * 60;
  for (const d of plan.days)
    for (const x of d.doses) {
      if (x.gapMin === null) continue;
      assert.ok(x.gapMin >= (med.minGapMin ?? 0), `gap ${x.gapMin} below the minimum ${med.minGapMin}`);
      assert.ok(Math.abs(x.gapMin - P) <= stepMax, `gap ${x.gapMin} changed by more than ${stepMax}`);
    }
  // At most one changed gap per local day.
  for (const d of plan.days) assert.ok(d.doses.filter((x) => x.changed).length <= 1, d.date);
}

test('every-N-hours: the gradual shift never goes below the minimum gap and ends on the local clock', () => {
  const start = utc('2026-11-03T09:00Z'); // landed in Tokyo
  const end = start + 25 * 24 * H;

  // Every 8 h from 06:00, London -> Tokyo (+9 h): one hour earlier is the short way.
  const m8 = every(8, '06:00');
  const p1 = gradualShift(m8, 'Europe/London', 'Asia/Tokyo', start, end, 60);
  assert.equal(p1.shiftMin, -60);
  checkShift(p1, m8, 60);
  assert.ok(p1.reachedUtc);

  // The same medicine with a minimum gap of the full 8 h can only move later: 7 h, at most 1 h a day.
  const m8strict = every(8, '06:00', 480);
  const p2 = gradualShift(m8strict, 'Europe/London', 'Asia/Tokyo', start, end, 60);
  assert.equal(p2.shiftMin, 420);
  checkShift(p2, m8strict, 60);
  assert.equal(p2.days.flatMap((d) => d.doses).filter((x) => x.changed).length, 7);
  const after = p2.days.flatMap((d) => d.doses).filter((x) => p2.reachedUtc !== null && x.utc >= p2.reachedUtc);
  assert.ok(after.length > 3);
  for (const x of after) assert.ok(['06:00', '14:00', '22:00'].includes(localTime(x.local)), x.local);
  // Two-hour steps finish sooner, still within the limits.
  const p3 = gradualShift(m8strict, 'Europe/London', 'Asia/Tokyo', start, end, 120);
  checkShift(p3, m8strict, 120);
  assert.equal(p3.days.flatMap((d) => d.doses).filter((x) => x.changed).length, 4);

  // Once a day at 08:00, London -> Tokyo: 9 h earlier beats 15 h later. Default minimum 23 h -> 1 h a day.
  const daily = every(24, '08:00');
  const p4 = gradualShift(daily, 'Europe/London', 'Asia/Tokyo', start, end, 120);
  assert.equal(p4.shiftMin, -540);
  assert.equal(p4.stepMin, 60, 'the minimum gap (23 h) caps the 2 h step at 1 h');
  checkShift(p4, daily, 120);
  const doses4 = p4.days.flatMap((d) => d.doses);
  assert.equal(localTime(doses4[doses4.length - 1].local), '08:00');
  // A 22 h minimum lets it use 2 h steps: 2+2+2+2+1.
  const daily22 = every(24, '08:00', 1320);
  const p5 = gradualShift(daily22, 'Europe/London', 'Asia/Tokyo', start, end, 120);
  checkShift(p5, daily22, 120);
  assert.deepEqual(
    p5.days.flatMap((d) => d.doses).filter((x) => x.changed).map((x) => x.gapMin),
    [1320, 1320, 1320, 1320, 1380],
  );

  // London -> New York (-5 h): later is shorter; gaps lengthen to 25 h.
  const p6 = gradualShift(daily, 'Europe/London', 'America/New_York', utc('2026-11-03T20:00Z'), utc('2026-11-20T00:00Z'), 60);
  assert.equal(p6.shiftMin, 300);
  checkShift(p6, daily, 60);
  const doses6 = p6.days.flatMap((d) => d.doses);
  assert.equal(localTime(doses6[doses6.length - 1].local), '08:00');

  // Already on the same clock (Honolulu -> Kiritimati): nothing moves.
  const p7 = gradualShift(m8, 'Pacific/Honolulu', 'Pacific/Kiritimati', start, start + 3 * 24 * H, 60);
  assert.equal(p7.shiftMin, 0);
  assert.ok(p7.days.flatMap((d) => d.doses).every((x) => !x.changed));

  // A short stop ends before the shift does.
  const p8 = gradualShift(m8strict, 'Europe/London', 'Asia/Tokyo', start, start + 3 * 24 * H, 60);
  assert.equal(p8.reachedOn, null);
});

// ----------------------------------------------------------------------------------------------- night and next dose

test('doses in the usual sleep hours are flagged', () => {
  assert.equal(isNight('02:00'), true);
  assert.equal(isNight('23:00'), true);
  assert.equal(isNight('07:00'), false);
  assert.equal(isNight('12:00'), false);
  assert.equal(isNight('03:00', '01:00', '09:00'), true);
  assert.equal(isNight('00:30', '01:00', '09:00'), false);
  const rows = keepHomeRows(fixed(['20:00', '12:00']), stop('Asia/Tokyo', '2026-11-03T12:00Z', '2026-11-06T12:00Z', '2026-11-03', '2026-11-06'), 'Europe/London');
  assert.deepEqual(
    rows.map((r) => [r.home, r.local, r.dayShift, r.night]),
    [
      ['12:00', '21:00', 0, false],
      ['20:00', '05:00', 1, true],
    ],
  );
  assert.deepEqual(shiftLocalRows(fixed(['06:30', '23:15']), '23:00', '07:00'), [
    { local: '06:30', night: true },
    { local: '23:15', night: true },
  ]);
});

test('next dose follows the plan and the zone the traveller is in', () => {
  const now = utc('2026-11-10T10:00Z'); // 19:00 in Tokyo
  const meds = [fixed(['08:00', '20:00'])];
  const home = nextDose(meds, { homeTz: 'Europe/London', zone: 'Asia/Tokyo', plan: 'home', stopStartUtc: null, stepMin: 60 }, now);
  assert.equal(home?.utc, utc('2026-11-10T20:00Z'));
  assert.equal(home?.local, '2026-11-11T05:00');
  const local = nextDose(meds, { homeTz: 'Europe/London', zone: 'Asia/Tokyo', plan: 'local', stopStartUtc: null, stepMin: 60 }, now);
  assert.equal(local?.local, '2026-11-10T20:00');
  assert.equal(nextDose([], { homeTz: 'Europe/London', zone: 'Asia/Tokyo', plan: 'home', stopStartUtc: null, stepMin: 60 }, now), null);

  // The earliest of several medicines wins.
  const two = nextDose([fixed(['21:00'], 'late'), fixed(['19:30'], 'soon')], { homeTz: 'Asia/Tokyo', zone: 'Asia/Tokyo', plan: 'home', stopStartUtc: null, stepMin: 60 }, now);
  assert.equal(two?.med.id, 'soon');

  // Every 8 h under "shift to local" follows the gradual plan from arrival, not the final clock.
  const m8 = every(8, '06:00', 480);
  const arrive = utc('2026-11-09T09:00Z');
  const ctx = { homeTz: 'Europe/London', zone: 'Asia/Tokyo', plan: 'local' as const, stopStartUtc: arrive, stepMin: 60 };
  const n = nextDose([m8], ctx, now);
  const plan = gradualShift(m8, 'Europe/London', 'Asia/Tokyo', arrive, now + 2 * 24 * H, 60);
  assert.equal(n?.utc, plan.days.flatMap((d) => d.doses).find((x) => x.utc >= now)?.utc);

  // From a trip: the plan saved for it and the stop it's at.
  const trip = flightTrip('Europe/London', 'Asia/Tokyo', '2026-11-08T21:00', '2026-11-09T18:00', '2026-11-15');
  const store = { meds, plans: { t: 'local' as const }, stepMin: 60 };
  assert.equal(nextDoseForTrip(store, trip, 'UTC', 'Asia/Tokyo', now)?.local, '2026-11-10T20:00');
  assert.equal(nextDoseForTrip({ ...store, plans: {} }, trip, 'UTC', 'Asia/Tokyo', now)?.local, '2026-11-11T05:00');
  assert.equal(nextDoseForTrip({ ...store, meds: [] }, trip, 'UTC', 'Asia/Tokyo', now), null);
  assert.equal(fromUtc(toUtc({ local: '2026-11-10T20:00', tz: 'Asia/Tokyo' }), 'Asia/Tokyo'), '2026-11-10T20:00');
});

// ----------------------------------------------------------------------------------------------- privacy guard

test('medicines stay on this phone: never in .satchel trip files', () => {
  assert.equal(MEDS_KEY, 'satchel.meds.v1');
  const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
  for (const p of ['src/core/tripfile.ts', 'src/ui/TripExport.tsx', 'src/ui/TripImport.tsx', 'src/core/model.ts', 'src/state/tripTransfer.ts']) {
    assert.doesNotMatch(read(p), /medtimes|MEDS_KEY|satchel\.meds|\bmeds\b|medicine/i, p);
  }
  // The key is declared once, in this module.
  const decl = read('src/core/medtimes.ts').match(/'satchel\.meds\.v1'/g) ?? [];
  assert.equal(decl.length, 1);
  // A trip file built while medicines are saved carries none of them.
  const trip = demoTrip('2026-11-02', '2026-10-01T00:00:00Z');
  const file = JSON.stringify(buildTripFile(trip, {}, { now: '2026-10-31T00:00:00Z' }).file);
  assert.doesNotMatch(file, /satchel\.meds|"meds"|medtimes|Zzqmedicine/i);
});

// ----------------------------------------------------------------------------------------------- strings

test('meds.* strings carry the cautious guidance line and make no medical claims', () => {
  const keys = Object.keys(en).filter((k) => k.startsWith('meds.'));
  assert.ok(keys.length > 40);
  const guidance = en['meds.guidance' as keyof typeof en];
  assert.match(guidance, /general guidance only/i);
  assert.match(guidance, /doctor or pharmacist/i);
  assert.match(guidance, /insulin/i);
  assert.match(guidance, /contraceptive/i);
  for (const k of keys) {
    const v = en[k as keyof typeof en] as string;
    assert.doesNotMatch(v, /\b(safe to|you should take|guaranteed|cure|recommended dose)\b/i, k);
  }
});

// ----------------------------------------------------------------------------------------------- T104

test('T104: the gradual shift follows a clock change during the stay', () => {
  // London (BST) -> New York (EDT) on 20 Oct 2026: 5 h later, 1 h a day. New York falls back on 1 Nov.
  const daily = every(24, '08:00');
  const p = gradualShift(daily, 'Europe/London', 'America/New_York', utc('2026-10-20T20:00Z'), utc('2026-11-12T00:00Z'), 60);
  assert.equal(p.shiftMin, 300);
  checkShift(p, daily, 60);
  assert.deepEqual(p.clockChanges, [{ on: '2026-11-01', min: -60 }]);
  const doses = p.days.flatMap((d) => d.doses);
  // Before the change the doses had reached 08:00 EDT; the first dose after it waits an extra hour (a 25 h gap) to
  // stay on 08:00 EST, instead of drifting to 07:00.
  assert.ok(doses.some((x) => x.local.startsWith('2026-10-31') && localTime(x.local) === '08:00'));
  const nov1 = doses.find((x) => x.local.startsWith('2026-11-01'))!;
  assert.equal(localTime(nov1.local), '08:00');
  assert.equal(nov1.gapMin, 1500);
  assert.ok(nov1.changed);
  assert.equal(localTime(doses[doses.length - 1].local), '08:00');
  assert.equal(p.reachedOn, '2026-11-01', 'reached again on the day the clocks change');
  // A spring-forward change mid-shift (Sydney, 4 Oct 2026): the target moves an hour earlier and is still reached.
  const m8 = every(8, '06:00', 480);
  const s = gradualShift(m8, 'Europe/London', 'Australia/Sydney', utc('2026-10-01T00:00Z'), utc('2026-10-25T00:00Z'), 60);
  checkShift(s, m8, 60);
  assert.deepEqual(s.clockChanges.map((c) => c.min), [60]);
  const after = s.days.flatMap((d) => d.doses).filter((x) => s.reachedUtc !== null && x.utc >= s.reachedUtc);
  assert.ok(after.length > 3);
  for (const x of after) assert.ok(['06:00', '14:00', '22:00'].includes(localTime(x.local)), x.local);
  // No change during the stay: none listed.
  assert.deepEqual(gradualShift(daily, 'Europe/London', 'Asia/Tokyo', utc('2026-11-03T09:00Z'), utc('2026-11-20T00:00Z'), 60).clockChanges, []);
});

test('T104: each day of the shift is listed for the shared text, up to the day it reaches local time', () => {
  const daily = every(24, '08:00');
  const p = gradualShift(daily, 'Europe/London', 'America/New_York', utc('2026-11-03T20:00Z'), utc('2026-11-20T00:00Z'), 60);
  const rows = shiftDayTimes(p);
  assert.equal(rows[rows.length - 1].date, p.reachedOn);
  assert.equal(rows[rows.length - 1].times[0], '08:00');
  assert.deepEqual(rows[0].times, [localTime(p.days[0].doses[0].local)]);
  assert.ok(rows.every((r) => r.times.length === r.doses.length));
  assert.equal(shiftDayTimes(p, 2).length, 2);
  // Not reached within the stop: the whole stop (capped).
  const short = gradualShift(every(8, '06:00', 480), 'Europe/London', 'Asia/Tokyo', utc('2026-11-03T09:00Z'), utc('2026-11-06T09:00Z'), 60);
  assert.equal(short.reachedOn, null);
  assert.equal(shiftDayTimes(short).length, short.days.length);
});

test('T104: next dose for the Emergency row, at home or on a trip', () => {
  const store = { meds: [fixed(['08:00', '20:00'])], plans: {}, stepMin: 60 };
  const now = utc('2026-11-03T21:00Z'); // 21:00 in London
  const home = nextDoseNow(store, null, 'Europe/London', '', now)!;
  assert.equal(home.local, '2026-11-04T08:00');
  assert.equal(home.tz, 'Europe/London');
  assert.equal(doseDayShift(home, now), 1);
  const morning = nextDoseNow(store, null, 'Europe/London', '', utc('2026-11-03T07:00Z'))!;
  assert.equal(doseDayShift(morning, utc('2026-11-03T07:00Z')), 0);
  assert.equal(nextDoseNow({ ...store, meds: [] }, null, 'Europe/London', '', now), null);
  // On a trip in Tokyo, keeping home time: 08:00 London is 17:00 Tokyo.
  const trip = flightTrip('Europe/London', 'Asia/Tokyo', '2026-11-01T10:00', '2026-11-02T07:00', '2026-11-12');
  const away = nextDoseNow(store, trip, 'Europe/London', 'Asia/Tokyo', now)!;
  assert.equal(away.tz, 'Asia/Tokyo');
  assert.equal(localTime(away.local), '17:00');
});
