import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  awakeAt,
  awakeLength,
  briefCall,
  CALLHOME_KEY,
  callDay,
  callDayCacheSize,
  callLinks,
  cleanCallHome,
  clearCallDayCache,
  clearDayZones,
  dayZonesFor,
  dayHours,
  DEFAULT_HOURS,
  draftErrors,
  draftFromContact,
  EMPTY_CALLHOME,
  importable,
  joinedWindows,
  MAX_PEOPLE,
  newDraft,
  nextWindow,
  personNow,
  removePerson,
  MAX_DAY_ZONES,
  savePerson,
  setDayZone,
  stepHours,
  stripAt,
  stripTicks,
  tripCallDays,
  validHours,
  wrapsMidnight,
  type CallHomeStore,
  type CallPerson,
  type Hours,
} from './callhome.ts';
import { demoTrip } from './demo.ts';
import type { Item, Trip } from './model.ts';
import { buildTripFile } from './tripfile.ts';
import { toUtc } from './tz.ts';

const AWAKE = DEFAULT_HOURS;
const who = (tz: string, hours: Hours = AWAKE) => ({ tz, hours });
const spans = (d: ReturnType<typeof callDay>) => d.windows.map((w) => `${w.youFrom}-${w.youTo} / ${w.themFrom}-${w.themTo}`);

// ----------------------------------------------------------------------------------------------- hours

test('awake hours: plain, wrapping midnight, all day; equal ends are refused', () => {
  assert.equal(awakeAt(AWAKE, 8 * 60), true);
  assert.equal(awakeAt(AWAKE, 22 * 60), false);
  assert.equal(awakeAt(AWAKE, 7 * 60 + 59), false);
  const owl: Hours = { from: '22:00', to: '02:00' };
  assert.equal(wrapsMidnight(owl), true);
  assert.equal(awakeAt(owl, 23 * 60), true);
  assert.equal(awakeAt(owl, 119), true);
  assert.equal(awakeAt(owl, 120), false);
  assert.equal(awakeAt(owl, 21 * 60 + 59), false);
  assert.equal(awakeLength(owl), 240);
  assert.equal(awakeLength(AWAKE), 14 * 60);
  assert.equal(awakeLength({ from: '00:00', to: '24:00' }), 1440);
  assert.equal(validHours({ from: '08:00', to: '08:00' }), false);
  assert.equal(validHours({ from: '24:00', to: '08:00' }), false);
  assert.equal(validHours({ from: '8:00', to: '22:00' }), false);
  assert.equal(validHours({ from: '07:30', to: '24:00' }), true);
});

test('stepper moves an end by 30 min, wraps the day and never lets the ends meet', () => {
  assert.deepEqual(stepHours(AWAKE, 'from', 30), { from: '08:30', to: '22:00' });
  assert.deepEqual(stepHours({ from: '08:00', to: '23:30' }, 'to', 30), { from: '08:00', to: '24:00' });
  assert.deepEqual(stepHours({ from: '08:00', to: '24:00' }, 'to', 30), { from: '08:00', to: '00:30' });
  assert.deepEqual(stepHours({ from: '00:00', to: '22:00' }, 'from', -30), { from: '23:30', to: '22:00' });
  assert.deepEqual(stepHours({ from: '08:00', to: '08:30' }, 'to', -30), { from: '08:00', to: '08:30' });
});

// ----------------------------------------------------------------------------------------------- overlap windows

test('India (+5:30) and Nepal (+5:45) overlap to the minute', () => {
  const india = callDay('2026-11-10', 'Europe/London', AWAKE, who('Asia/Kolkata'));
  assert.deepEqual(spans(india), ['08:00-16:30 / 13:30-22:00']);
  const nepal = callDay('2026-11-10', 'Europe/London', AWAKE, who('Asia/Kathmandu'));
  assert.deepEqual(spans(nepal), ['08:00-16:15 / 13:45-22:00']);
});

test('Adelaide (+10:30 in summer) gives two windows a day with London, and a 25 h day when its clocks go back', () => {
  const d = callDay('2026-11-10', 'Australia/Adelaide', AWAKE, who('Europe/London'));
  assert.deepEqual(spans(d), ['08:00-08:30 / 21:30-22:00', '18:30-22:00 / 08:00-11:30']);
  // 4 Apr 2027: Adelaide clocks go back an hour (03:00 -> 02:00), London is already on summer time (+1).
  const change = callDay('2027-04-04', 'Australia/Adelaide', AWAKE, who('Europe/London'));
  assert.equal(dayHours(change), 25);
  // After the change Adelaide is +9:30 and London +1: 8 h 30 m apart. London 08:00 = Adelaide 16:30.
  // London 22:00 is Adelaide 06:30 by then, so the morning window is gone.
  assert.deepEqual(spans(change), ['16:30-22:00 / 08:00-13:30']);
});

test('DST: the gap follows each country changing on its own date', () => {
  // Both on winter time (NY -5, London 0): 5 h.
  assert.deepEqual(spans(callDay('2026-03-03', 'America/New_York', AWAKE, who('Europe/London'))), ['08:00-17:00 / 13:00-22:00']);
  // US changed on 8 Mar, UK not until 29 Mar: 4 h.
  assert.deepEqual(spans(callDay('2026-03-10', 'America/New_York', AWAKE, who('Europe/London'))), ['08:00-18:00 / 12:00-22:00']);
  // The US change day itself is 23 h long; the window is read on the new clock.
  const usDay = callDay('2026-03-08', 'America/New_York', AWAKE, who('Europe/London'));
  assert.equal(dayHours(usDay), 23);
  assert.deepEqual(spans(usDay), ['08:00-18:00 / 12:00-22:00']);
  // The UK change day: London 22:00 BST is 21:00 UTC = 17:00 in New York.
  assert.deepEqual(spans(callDay('2026-03-29', 'America/New_York', AWAKE, who('Europe/London'))), ['08:00-17:00 / 13:00-22:00']);
  // Both on summer time: 5 h again.
  assert.deepEqual(spans(callDay('2026-03-30', 'America/New_York', AWAKE, who('Europe/London'))), ['08:00-17:00 / 13:00-22:00']);
});

test('empty overlap: no window, no "both" in the strip', () => {
  const d = callDay('2026-11-10', 'Asia/Tokyo', AWAKE, who('America/New_York', { from: '09:00', to: '17:00' }));
  assert.deepEqual(d.windows, []);
  assert.ok(!d.runs.some((r) => r.state === 'both'));
  assert.equal(nextWindow([d], d.startUtc), null);
  // The strip still covers the whole day without gaps.
  assert.equal(d.runs[0].startUtc, d.startUtc);
  assert.equal(d.runs[d.runs.length - 1].endUtc, d.endUtc);
  for (let i = 1; i < d.runs.length; i++) assert.equal(d.runs[i].startUtc, d.runs[i - 1].endUtc);
});

test('windows that wrap midnight are flagged and join across days', () => {
  const owl: Hours = { from: '08:00', to: '02:00' };
  const d1 = callDay('2026-11-10', 'Asia/Tokyo', owl, who('Europe/London'));
  // London 08:00-22:00 = Tokyo 17:00-07:00 next day; the traveller is up 08:00-02:00.
  assert.deepEqual(spans(d1), ['00:00-02:00 / 15:00-17:00', '17:00-24:00 / 08:00-15:00']);
  assert.equal(d1.windows[0].fromBefore, true);
  assert.equal(d1.windows[1].intoNext, true);
  assert.equal(d1.windows[1].fromBefore, false);
  const d2 = callDay('2026-11-11', 'Asia/Tokyo', owl, who('Europe/London'));
  const joined = joinedWindows([d1, d2]);
  const evening = joined.find((s) => s.startUtc === toUtc({ local: '2026-11-10T17:00', tz: 'Asia/Tokyo' }));
  assert.ok(evening);
  assert.equal(evening.endUtc, toUtc({ local: '2026-11-11T02:00', tz: 'Asia/Tokyo' }));
  // A night-shift person whose own hours wrap midnight.
  const night = callDay('2026-11-10', 'Europe/London', AWAKE, who('Europe/London', { from: '20:00', to: '04:00' }));
  assert.deepEqual(spans(night), ['20:00-22:00 / 20:00-22:00']);
});

// ----------------------------------------------------------------------------------------------- per-day stop zone

const item = (id: string, kind: Item['kind'], start: string, startTz: string, end?: string, endTz = startTz): Item => ({
  id,
  tripId: 'trip',
  kind,
  title: id,
  start: { local: start, tz: startTz },
  end: end ? { local: end, tz: endTz } : undefined,
  attachments: [],
});

const trip: Trip = {
  id: 'trip',
  name: 'Asia',
  startDate: '2026-11-10',
  endDate: '2026-11-16',
  homeTz: 'Europe/London',
  createdAt: '2026-10-01T00:00:00Z',
  items: [
    item('out', 'flight', '2026-11-10T11:00', 'Europe/London', '2026-11-11T07:00', 'Asia/Tokyo'),
    item('tokyo', 'hotel', '2026-11-11T15:00', 'Asia/Tokyo', '2026-11-14T10:00'),
    item('hop', 'flight', '2026-11-14T10:00', 'Asia/Tokyo', '2026-11-14T14:00', 'Asia/Kathmandu'),
    item('ktm', 'hotel', '2026-11-14T15:00', 'Asia/Kathmandu', '2026-11-15T22:00'),
    item('back', 'flight', '2026-11-16T01:00', 'Asia/Kathmandu', '2026-11-16T09:00', 'Europe/London'),
  ],
};

test('each trip day uses that day’s stop zone from the bookings', () => {
  const days = tripCallDays(trip, AWAKE, who('Europe/London'));
  assert.deepEqual(
    days.map((d) => `${d.date} ${d.tz}`),
    [
      '2026-11-10 Europe/London', // in the air at 18:00: still on the clock you left
      '2026-11-11 Asia/Tokyo',
      '2026-11-12 Asia/Tokyo',
      '2026-11-13 Asia/Tokyo',
      '2026-11-14 Asia/Kathmandu',
      '2026-11-15 Asia/Kathmandu',
      '2026-11-16 Europe/London',
    ],
  );
  assert.deepEqual(spans(days[0]), ['08:00-22:00 / 08:00-22:00']);
  assert.deepEqual(spans(days[2]), ['17:00-22:00 / 08:00-13:00']);
  assert.deepEqual(spans(days[5]), ['13:45-22:00 / 08:00-16:15']);
  assert.deepEqual(tripCallDays({ ...trip, startDate: 'x' }, AWAKE, who('Europe/London')), []);
});

test('strip positions and hour marks follow the day’s real length', () => {
  const d = callDay('2026-03-08', 'America/New_York', AWAKE, who('Europe/London'));
  const ticks = stripTicks(d);
  assert.deepEqual(
    ticks.map((x) => x.label),
    ['00:00', '06:00', '12:00', '18:00'],
  );
  // 23 h day: 12:00 sits 11/23 of the way along (01:00-02:00 never happened).
  assert.ok(Math.abs(ticks[2].at - 11 / 23) < 1e-9);
  assert.equal(stripAt(d, d.startUtc - 1), 0);
  assert.equal(stripAt(d, d.endUtc + 1), 1);
});

// ----------------------------------------------------------------------------------------------- right now / next

const mum: CallPerson = { id: 'mum', name: 'Mum', tz: 'Europe/London', phone: '+447700900123', hours: AWAKE };
const sam: CallPerson = { id: 'sam', name: 'Sam', tz: 'America/New_York', phone: '', hours: { from: '09:00', to: '17:00' } };

test('right now: their clock, asleep or awake, and whether it is another day there', () => {
  const now = toUtc({ local: '2026-11-12T03:10', tz: 'Europe/London' });
  assert.deepEqual(personNow(mum, 'Asia/Tokyo', now), { time: '03:10', awake: false, dayDiff: 0 });
  const later = toUtc({ local: '2026-11-12T20:00', tz: 'Asia/Tokyo' });
  assert.deepEqual(personNow(sam, 'Asia/Tokyo', later), { time: '06:00', awake: false, dayDiff: 0 });
  const nextDay = toUtc({ local: '2026-11-13T08:00', tz: 'Asia/Tokyo' });
  assert.deepEqual(personNow(sam, 'Asia/Tokyo', nextDay), { time: '18:00', awake: false, dayDiff: -1 });
  assert.equal(personNow({ tz: 'Mars/Base', hours: AWAKE }, 'Asia/Tokyo', now), null);
});

test('Your day line: good now until, next window later or tomorrow, or none', () => {
  const store: CallHomeStore = { people: [sam, mum], me: AWAKE };
  const now = briefCall(trip, store, toUtc({ local: '2026-11-12T20:00', tz: 'Asia/Tokyo' }));
  assert.deepEqual(now && { id: now.person.id, kind: now.kind, at: now.at }, { id: 'mum', kind: 'now', at: '22:00' });
  const late = briefCall(trip, store, toUtc({ local: '2026-11-12T23:00', tz: 'Asia/Tokyo' }));
  assert.deepEqual(late && { id: late.person.id, kind: late.kind, at: late.at, day: late.dayOffset }, { id: 'mum', kind: 'later', at: '17:00', day: 1 });
  const morning = briefCall(trip, store, toUtc({ local: '2026-11-12T09:00', tz: 'Asia/Tokyo' }));
  assert.deepEqual(morning && { kind: morning.kind, at: morning.at, day: morning.dayOffset }, { kind: 'later', at: '17:00', day: 0 });
  const onlySam = briefCall(trip, { people: [sam], me: AWAKE }, toUtc({ local: '2026-11-12T09:00', tz: 'Asia/Tokyo' }));
  assert.deepEqual(onlySam && { id: onlySam.person.id, kind: onlySam.kind }, { id: 'sam', kind: 'none' });
  assert.equal(briefCall(trip, EMPTY_CALLHOME, Date.now()), null);
});

// ----------------------------------------------------------------------------------------------- people, links

test('people: drafts are checked, saved, updated, capped and removed', () => {
  assert.deepEqual(draftErrors(newDraft('Europe/London')), ['name']);
  assert.deepEqual(draftErrors({ name: 'Mum', tz: 'Nowhere/Here', phone: 'call me', hours: { from: '08:00', to: '08:00' } }), ['tz', 'phone', 'hours']);
  let store: CallHomeStore = { people: [], me: AWAKE };
  const r = savePerson(store, { name: '  Mum ', tz: 'Europe/London', phone: '+44 7700 900123', hours: AWAKE }, 'p1');
  assert.ok(r.ok);
  store = r.store;
  assert.deepEqual(store.people[0], { id: 'p1', name: 'Mum', tz: 'Europe/London', phone: '+447700900123', hours: AWAKE });
  const u = savePerson(store, { name: 'Mum', tz: 'Australia/Adelaide', phone: '', hours: AWAKE }, 'p1');
  assert.ok(u.ok);
  assert.equal(u.store.people.length, 1);
  assert.equal(u.store.people[0].tz, 'Australia/Adelaide');
  assert.equal(u.store.people[0].phone, '');
  let full: CallHomeStore = { people: [], me: AWAKE };
  for (let i = 0; i < MAX_PEOPLE; i++) {
    const x = savePerson(full, { name: `P${i}`, tz: 'UTC', phone: '', hours: AWAKE }, `id${i}`);
    assert.ok(x.ok);
    full = x.store;
  }
  assert.deepEqual(savePerson(full, { name: 'One more', tz: 'UTC', phone: '', hours: AWAKE }, 'extra'), { ok: false, reason: 'full' });
  assert.equal(removePerson(full, 'id0').people.length, MAX_PEOPLE - 1);
});

test('cleanCallHome survives junk and drops damaged people', () => {
  assert.deepEqual(cleanCallHome(null), { people: [], me: AWAKE });
  assert.deepEqual(cleanCallHome([1]), { people: [], me: AWAKE });
  const s = cleanCallHome({
    me: { from: '07:00', to: '01:00' },
    people: [
      { id: 'a', name: ' Mum ', tz: 'Europe/London', phone: '07700 900123', hours: { from: 'x', to: '22:00' } },
      { id: 'a', name: 'Dup', tz: 'UTC' },
      { id: 'b', name: '', tz: 'UTC' },
      { id: 'c', name: 'Bad zone', tz: 'Mars/Base' },
      { id: 'd', name: 'Bad phone', tz: 'Asia/Kolkata', phone: 'abc' },
      'junk',
    ],
  });
  assert.deepEqual(s.me, { from: '07:00', to: '01:00' });
  assert.deepEqual(
    s.people.map((p) => [p.id, p.name, p.phone, p.hours.from]),
    [
      ['a', 'Mum', '07700900123', '08:00'],
      ['d', 'Bad phone', '', '08:00'],
    ],
  );
});

test('tap-to-call links and import from trusted contacts', () => {
  assert.deepEqual(callLinks('+44 7700 900123'), { call: 'tel:+447700900123', message: 'sms:+447700900123', facetime: 'facetime:+447700900123' });
  assert.equal(callLinks(''), null);
  assert.equal(callLinks('ring me'), null);
  const contacts = [
    { id: 'c1', name: 'Mum', phone: '+447700900123' },
    { id: 'c2', name: 'Jo', phone: '+15550100' },
  ];
  assert.deepEqual(
    importable(contacts, { people: [mum], me: AWAKE }).map((c) => c.id),
    ['c2'],
  );
  assert.deepEqual(draftFromContact(contacts[1], 'Europe/London'), { name: 'Jo', tz: 'Europe/London', phone: '+15550100', hours: AWAKE });
});

// ----------------------------------------------------------------------------------------------- phone-only guard

test('call home people stay on this phone: own key, never in .satchel trip files', () => {
  assert.equal(CALLHOME_KEY, 'satchel.callhome.v1');
  const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
  for (const p of ['src/core/tripfile.ts', 'src/ui/TripExport.tsx', 'src/ui/TripImport.tsx', 'src/core/model.ts', 'src/state/tripTransfer.ts']) {
    assert.doesNotMatch(read(p), /callhome|CALLHOME|satchel\.callhome/i, p);
  }
  // The key is declared once, in this module.
  assert.equal((read('src/core/callhome.ts').match(/'satchel\.callhome\.v1'/g) ?? []).length, 1);
  // A trip file built while people are saved carries none of them.
  const t = demoTrip('2026-11-02', '2026-10-01T00:00:00Z');
  const saved = savePerson(EMPTY_CALLHOME, { name: 'Zq Mum', tz: 'Asia/Kathmandu', phone: '+44 7700 900999', hours: AWAKE }, 'zq');
  assert.ok(saved.ok);
  const file = JSON.stringify(buildTripFile(t, {}, { now: '2026-10-31T00:00:00Z' }).file);
  assert.doesNotMatch(file, /satchel\.callhome|Zq Mum|447700900999|callhome/i);
});

// ----------------------------------------------------------------------------------------------- T116 day zones + cache

test('T116: a travel day can take a zone set by hand, kept with the phone-only people data', () => {
  let store: CallHomeStore = { people: [], me: AWAKE };
  // Overnight flight day: the bookings leave it on London (in the air at 18:00); the traveller sets Tokyo.
  store = setDayZone(store, 'trip', '2026-11-10', 'Asia/Tokyo');
  assert.deepEqual(dayZonesFor(store, 'trip'), { '2026-11-10': 'Asia/Tokyo' });
  const days = tripCallDays(trip, AWAKE, who('Europe/London'), dayZonesFor(store, 'trip'));
  assert.equal(days[0].tz, 'Asia/Tokyo');
  assert.equal(days[0].manual, true);
  assert.equal(days[1].tz, 'Asia/Tokyo');
  assert.equal(days[1].manual, undefined);
  assert.deepEqual(spans(days[0]), ['17:00-22:00 / 08:00-13:00']);
  // Setting the zone the bookings give anyway is not flagged as a change.
  const same = tripCallDays(trip, AWAKE, who('Europe/London'), { '2026-11-11': 'Asia/Tokyo' });
  assert.equal(same[1].manual, undefined);
  // The Your day line reads the same store.
  const p = savePerson(store, { name: 'Mum', tz: 'Europe/London', phone: '', hours: AWAKE }, 'mum');
  assert.ok(p.ok);
  const at = toUtc({ local: '2026-11-10T01:00', tz: 'Europe/London' });
  assert.deepEqual(briefCall(trip, p.store, at), { person: p.store.people[0], kind: 'later', at: '17:00', dayOffset: 0 }); // Tokyo clock
  assert.deepEqual(briefCall(trip, { ...p.store, days: undefined }, at), { person: p.store.people[0], kind: 'later', at: '08:00', dayOffset: 0 });
  // Cleared again: back to the bookings.
  store = setDayZone(store, 'trip', '2026-11-10', null);
  assert.equal(store.days, undefined);
  assert.equal(tripCallDays(trip, AWAKE, who('Europe/London'), dayZonesFor(store, 'trip'))[0].tz, 'Europe/London');
});

test('T116: day zones refuse bad input, are capped and survive a damaged store', () => {
  const s0: CallHomeStore = { people: [], me: AWAKE };
  assert.equal(setDayZone(s0, 'trip', '2026-11-10', 'Mars/Base'), s0);
  assert.equal(setDayZone(s0, 'trip', '10/11/2026', 'Asia/Tokyo'), s0);
  assert.equal(setDayZone(s0, '', '2026-11-10', 'Asia/Tokyo'), s0);
  assert.equal(setDayZone(s0, 'trip', '2026-11-10', null), s0);
  assert.deepEqual(dayZonesFor(s0, ''), {});
  let s = s0;
  for (let k = 0; k < MAX_DAY_ZONES + 5; k++) s = setDayZone(s, 'trip', `2027-${String(1 + Math.floor(k / 28)).padStart(2, '0')}-${String(1 + (k % 28)).padStart(2, '0')}`, 'Asia/Tokyo');
  assert.equal(Object.keys(dayZonesFor(s, 'trip')).length, MAX_DAY_ZONES);
  const two = setDayZone(setDayZone(s0, 'a', '2026-11-10', 'Asia/Tokyo'), 'b', '2026-11-11', 'Asia/Kolkata');
  assert.deepEqual(Object.keys(clearDayZones(two, 'a').days ?? {}), ['b']);
  assert.equal(clearDayZones(clearDayZones(two, 'a'), 'b').days, undefined);
  const cleaned = cleanCallHome({
    people: [],
    me: AWAKE,
    days: { trip: { '2026-11-10': 'Asia/Tokyo', '2026-11-11': 'Nowhere/Zone', bad: 'Asia/Tokyo', '2026-11-12': 7 }, '': { '2026-11-10': 'UTC' }, junk: 'x', none: {} },
  });
  assert.deepEqual(cleaned.days, { trip: { '2026-11-10': 'Asia/Tokyo' } });
  assert.equal(cleanCallHome({ people: [], me: AWAKE, days: [1, 2] }).days, undefined);
  // Stores saved before T116 read as before.
  assert.deepEqual(cleanCallHome({ people: [], me: AWAKE }), { people: [], me: AWAKE });
});

test('T116: per-day windows are cached by person + day inputs, and a 30-day trip computes within budget', () => {
  clearCallDayCache();
  const long: Trip = { ...trip, id: 'long', startDate: '2027-03-01', endDate: '2027-03-30', items: [] };
  const mum = who('Australia/Adelaide'); // half-hour zone, and both London and Adelaide change clocks in this month
  const t0 = performance.now();
  const cold = tripCallDays(long, AWAKE, mum);
  const coldMs = performance.now() - t0;
  assert.equal(cold.length, 30);
  assert.equal(callDayCacheSize(), 30);
  assert.ok(coldMs < 1500, `30 days cold took ${coldMs.toFixed(1)} ms`);
  const t1 = performance.now();
  const warm = tripCallDays(long, AWAKE, mum);
  const warmMs = performance.now() - t1;
  assert.ok(warmMs < 300, `30 days cached took ${warmMs.toFixed(1)} ms`);
  warm.forEach((d, k) => assert.equal(d, cold[k])); // the same day objects, not worked out again
  assert.equal(callDayCacheSize(), 30);
  // Another person, other hours or another zone for a day are separate entries.
  tripCallDays(long, AWAKE, who('Australia/Adelaide', { from: '07:00', to: '21:00' }));
  assert.equal(callDayCacheSize(), 60);
  const moved = tripCallDays(long, AWAKE, mum, { '2027-03-05': 'Asia/Tokyo' });
  assert.notEqual(moved[4], cold[4]);
  assert.equal(moved[3], cold[3]);
  assert.equal(callDayCacheSize(), 61);
  // Bounded: the cache never grows past its cap.
  for (let k = 0; k < 30; k++) tripCallDays(long, { from: `${String(5 + (k % 5)).padStart(2, '0')}:00`, to: `${String(18 + Math.floor(k / 5)).padStart(2, '0')}:00` }, mum);
  assert.ok(callDayCacheSize() <= 512);
  clearCallDayCache();
});
