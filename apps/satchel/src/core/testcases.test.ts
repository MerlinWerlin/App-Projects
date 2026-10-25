// docs/spec/TEST_CASES.md (26 Oct draft) as core tests, where the existing tests did not already cover a case (T42).
// Each test name starts with its TEST_CASES id; docs/spec/TEST_COVERAGE.md maps every id to its test or status.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { clampThreshold, isLow, normaliseLevel, normalisePrefs, percent, stepEpisode, NO_EPISODE, type BatteryReading } from './battery.ts';
import { demoTrip } from './demo.ts';
import { countryForZone, displayRow, findCountry, guessCountry, type EmergencyTable } from './emergency.ts';
import { todayIn } from './format.ts';
import { ITEM_KINDS, type Item, type Trip } from './model.ts';
import { buildList, dropList, listFor, parseTemplates, putList, toggleItem, type PackStore } from './packing.ts';
import { stepThreshold } from './settings.ts';
import { groupByDay, nextUp, overlaps, sortItems } from './timeline.ts';
import { itemFromDraft, newItemDraft, parseStoredTrips, removeTrip, tripFromDraft, upsertTrip, validateItem } from './trips.ts';
import { checkWallTime, fromUtc, minutesBetween, offsetMinutes, toUtc } from './tz.ts';

const utc = (s: string) => Date.parse(s);
const at = (local: string, tz: string) => ({ local, tz });
const trip = demoTrip('2026-11-03', '2026-10-24T00:00:00Z');
const item = (x: Partial<Item> & Pick<Item, 'id' | 'kind' | 'start'>): Item => ({ tripId: trip.id, title: x.id, attachments: [], ...x });
const reading = (level: number | null): BatteryReading => ({ level, charging: false, lowPower: null });

// ---------------------------------------------------------------- trips and timeline

test('TR-004: editing one trip and deleting another removes only that trip and its packing list', () => {
  const a = tripFromDraft({ name: 'Japan', startDate: '2026-11-03', endDate: '2026-11-11', homeTz: 'Australia/Sydney' }, undefined, '2026-10-01T00:00:00Z');
  const b = tripFromDraft({ name: 'Bali', startDate: '2026-12-01', endDate: '2026-12-08', homeTz: 'Australia/Sydney' }, undefined, '2026-10-01T00:00:00Z');
  let trips = upsertTrip(upsertTrip([], a), b);
  const renamed = tripFromDraft({ name: 'Japan & Korea', startDate: a.startDate, endDate: a.endDate, homeTz: a.homeTz }, a);
  trips = removeTrip(upsertTrip(trips, renamed), b.id);
  assert.deepEqual(trips.map((t) => [t.id, t.name]), [[a.id, 'Japan & Korea']]);
  assert.equal(trips[0].createdAt, a.createdAt);
  let store: PackStore = {};
  store = putList(putList(store, { tripId: a.id, items: [] }), { tripId: b.id, items: [] });
  store = dropList(store, b.id);
  assert.deepEqual(Object.keys(store), [a.id]);
});

test('TR-005: one item of every kind saves with its kind and details', () => {
  for (const kind of ITEM_KINDS) {
    const d = { ...newItemDraft(kind, '2026-11-05', 'Asia/Tokyo'), title: `A ${kind}`, ref: 'ABC123', notes: 'n' };
    const full = kind === 'note' || kind === 'activity' ? d : { ...d, endDate: '2026-11-06', endTime: '10:00' };
    assert.deepEqual(validateItem(full), [], kind);
    const it = itemFromDraft(full, trip.id);
    assert.equal(it.kind, kind);
    assert.equal(it.title, `A ${kind}`);
    assert.deepEqual(it.start, at(`2026-11-05T${kind === 'hotel' ? '15:00' : '09:00'}`, 'Asia/Tokyo'));
    assert.equal(it.ref, kind === 'note' ? undefined : 'ABC123', `${kind}: notes have no booking reference`);
    assert.equal(it.end === undefined, kind === 'note' || kind === 'activity');
  }
});

test('TR-007: an item with no optional details saves without placeholder fields', () => {
  const it = itemFromDraft({ ...newItemDraft('flight', '2026-11-05', 'Asia/Tokyo'), title: 'Flight', endDate: '2026-11-05', endTime: '12:00' }, trip.id);
  for (const k of ['from', 'to', 'place', 'ref', 'seat', 'carrier', 'number', 'notes'] as const) assert.equal(it[k], undefined, k);
  assert.deepEqual(it.attachments, []);
});

test('TR-012: two items with a gap on the same local day sit under that day, in order, gap kept', () => {
  const am = item({ id: 'x-am', kind: 'activity', start: at('2026-11-05T09:00', 'Asia/Tokyo'), end: at('2026-11-05T10:00', 'Asia/Tokyo') });
  const pm = item({ id: 'x-pm', kind: 'activity', start: at('2026-11-05T15:00', 'Asia/Tokyo'), end: at('2026-11-05T16:30', 'Asia/Tokyo') });
  const t: Trip = { ...trip, items: [pm, am] };
  const day = groupByDay(t).find((d) => d.date === '2026-11-05')!;
  assert.deepEqual(day.items.map((i) => i.id), ['x-am', 'x-pm']);
  assert.deepEqual(overlaps(t.items), []);
  assert.equal(minutesBetween(am.end!, pm.start), 5 * 60);
});

// ---------------------------------------------------------------- time zones, DST, midnight and the date line

test('TR-015 / TR-020: a Tokyo item reads the same whatever zone the phone is in', () => {
  const tokyo = item({ id: 'x-tyo', kind: 'activity', start: at('2026-11-05T21:00', 'Asia/Tokyo') });
  const saved = process.env.TZ;
  const seen: string[] = [];
  try {
    for (const phone of ['Australia/Sydney', 'America/Los_Angeles', 'Asia/Tokyo', 'UTC']) {
      process.env.TZ = phone;
      const t = toUtc(tokyo.start);
      seen.push(`${t}|${fromUtc(t, 'Asia/Tokyo')}|${groupByDay({ ...trip, items: [tokyo] }).find((d) => d.items.length)!.date}`);
    }
  } finally {
    if (saved === undefined) delete process.env.TZ;
    else process.env.TZ = saved;
  }
  assert.deepEqual(new Set(seen), new Set([`${utc('2026-11-05T12:00:00Z')}|2026-11-05T21:00|2026-11-05`]));
});

test('TR-017: half-hour daylight saving (Lord Howe Island) gap and overlap', () => {
  // Lord Howe goes 02:00 -> 02:30 on 4 Oct 2026 and 02:00 -> 01:30 on 5 Apr 2026.
  assert.deepEqual(checkWallTime(at('2026-10-04T02:15', 'Australia/Lord_Howe')), { kind: 'skipped', usedLocal: '2026-10-04T02:45' });
  assert.deepEqual(checkWallTime(at('2026-04-05T01:45', 'Australia/Lord_Howe')), { kind: 'repeated' });
  assert.equal(toUtc(at('2026-04-05T01:45', 'Australia/Lord_Howe')), utc('2026-04-04T14:45:00Z'), 'the earlier 01:45');
  assert.equal(offsetMinutes('Australia/Lord_Howe', utc('2026-12-01T00:00:00Z')), 660);
  assert.equal(offsetMinutes('Australia/Lord_Howe', utc('2026-07-01T00:00:00Z')), 630);
});

test('TR-017: Europe (London 29 Mar gap, 25 Oct overlap) resolves like a clock', () => {
  assert.deepEqual(checkWallTime(at('2026-03-29T01:30', 'Europe/London')), { kind: 'skipped', usedLocal: '2026-03-29T02:30' });
  assert.deepEqual(checkWallTime(at('2026-10-25T01:30', 'Europe/London')), { kind: 'repeated' });
  assert.equal(toUtc(at('2026-10-25T01:30', 'Europe/London')), utc('2026-10-25T00:30:00Z'));
});

test('TR-017 (midnight): a DST change at midnight (Santiago) skips 00:xx but keeps the item on its own date', () => {
  // Chile springs forward at 24:00 on 5 Sep 2026 (00:00 -> 01:00 on the 6th) and falls back 5 Apr (00:00 -> 23:00).
  assert.deepEqual(checkWallTime(at('2026-09-06T00:30', 'America/Santiago')), { kind: 'skipped', usedLocal: '2026-09-06T01:30' });
  assert.deepEqual(checkWallTime(at('2026-04-04T23:30', 'America/Santiago')), { kind: 'repeated' });
  assert.deepEqual(checkWallTime(at('2026-04-05T00:30', 'America/Santiago')), { kind: 'normal' });
  const it = item({ id: 'x-scl', kind: 'activity', start: at('2026-09-06T00:30', 'America/Santiago') });
  const days = groupByDay({ ...trip, startDate: '2026-09-05', endDate: '2026-09-07', items: [it] });
  assert.deepEqual(days.find((d) => d.items.length)!.date, '2026-09-06');
  assert.equal(it.start.local, '2026-09-06T00:30', 'the stored time is never rewritten');
});

test('TR-017: a day that contains a DST change lasts 23 or 25 hours', () => {
  const syd = (local: string) => at(local, 'Australia/Sydney');
  assert.equal(minutesBetween(syd('2026-10-03T12:00'), syd('2026-10-04T12:00')), 23 * 60);
  assert.equal(minutesBetween(syd('2026-04-04T12:00'), syd('2026-04-05T12:00')), 25 * 60);
});

test('TR-018: zones without daylight saving keep one offset all year', () => {
  const fixed: Record<string, number> = { 'Australia/Brisbane': 600, 'America/Phoenix': -420, 'Asia/Kolkata': 330, 'Asia/Tokyo': 540, 'Asia/Kathmandu': 345 };
  for (let m = 1; m <= 12; m++) {
    const t = Date.UTC(2026, m - 1, 15, 12);
    for (const [tz, off] of Object.entries(fixed)) assert.equal(offsetMinutes(tz, t), off, `${tz} month ${m}`);
  }
  // On Sydney's and New York's change days, a non-DST neighbour shows no gap and no repeat.
  assert.deepEqual(checkWallTime(at('2026-10-04T02:30', 'Australia/Brisbane')), { kind: 'normal' });
  assert.deepEqual(checkWallTime(at('2026-03-08T02:30', 'America/Phoenix')), { kind: 'normal' });
  assert.equal(minutesBetween(at('2026-10-03T12:00', 'Australia/Brisbane'), at('2026-10-04T12:00', 'Australia/Brisbane')), 24 * 60);
});

test('TR-019 (midnight): 00:00 starts its own day and 23:59 stays on the day before', () => {
  const late = item({ id: 'x-late', kind: 'activity', start: at('2026-11-05T23:59', 'Asia/Tokyo') });
  const mid = item({ id: 'x-mid', kind: 'activity', start: at('2026-11-06T00:00', 'Asia/Tokyo') });
  const days = groupByDay({ ...trip, items: [mid, late] });
  assert.deepEqual(days.find((d) => d.date === '2026-11-05')!.items.map((i) => i.id), ['x-late']);
  assert.deepEqual(days.find((d) => d.date === '2026-11-06')!.items.map((i) => i.id), ['x-mid']);
  assert.deepEqual(sortItems([mid, late]).map((i) => i.id), ['x-late', 'x-mid']);
});

test('TR-019: "today" either side of the date line can differ by two calendar dates', () => {
  const now = utc('2026-11-01T10:30:00Z');
  assert.equal(todayIn('Pacific/Kiritimati', now), '2026-11-02');
  assert.equal(todayIn('Asia/Tokyo', now), '2026-11-01');
  assert.equal(todayIn('Pacific/Pago_Pago', now), '2026-10-31');
});

test('TR-019: a zone that jumped across the date line (Samoa skipped 30 Dec 2011) moves a lost time forward a day', () => {
  assert.deepEqual(checkWallTime(at('2011-12-30T12:00', 'Pacific/Apia')), { kind: 'skipped', usedLocal: '2011-12-31T12:00' });
  assert.equal(offsetMinutes('Pacific/Apia', utc('2011-12-29T12:00:00Z')), -600);
  assert.equal(offsetMinutes('Pacific/Apia', utc('2011-12-31T12:00:00Z')), 840);
});

test('TR-021: an unknown zone is refused by the form and never turned into an invented time', () => {
  const d = { ...newItemDraft('activity', '2026-11-05', 'Mars/Olympus_Mons'), title: 'x' };
  assert.deepEqual(validateItem(d), ['startTz']);
  assert.throws(() => toUtc(at('2026-11-05T09:00', 'Mars/Olympus_Mons')), RangeError);
});

// ---------------------------------------------------------------- emergency lookup

const table = JSON.parse(readFileSync(new URL('../content/emergency_numbers.json', import.meta.url), 'utf8')) as EmergencyTable;

test('TR-055 (lookup): old zone names some phones still report find the same country', () => {
  for (const [old, now] of [
    ['Asia/Katmandu', 'Asia/Kathmandu'],
    ['Asia/Rangoon', 'Asia/Yangon'],
    ['Asia/Ulan_Bator', 'Asia/Ulaanbaatar'],
    ['Asia/Calcutta', 'Asia/Kolkata'],
    ['Europe/Kiev', 'Europe/Kyiv'],
  ]) {
    assert.ok(countryForZone(now), now);
    assert.equal(countryForZone(old), countryForZone(now), old);
  }
  assert.deepEqual(guessCountry([], Date.now(), '2026-10-25', 'Asia/Katmandu'), { iso2: 'NP', zone: 'Asia/Katmandu', from: 'phone' });
  assert.equal(countryForZone('Etc/UTC'), null, 'an alias of a zone with no country is still no country');
});

test('TR-055 / TR-056 (lookup): a looked-up country always says verify locally and shows the table numbers unchanged', () => {
  for (const code of ['JP', 'AU', 'NP', 'MM', 'MN', 'GB', 'US']) {
    const row = findCountry(table, code.toLowerCase());
    assert.ok(row, code);
    const d = displayRow(row);
    assert.equal(d.verifyLocally, true, code);
    for (const l of d.lines) for (const s of l.services) assert.equal(row[s]?.trim(), l.number, `${code} ${s}`);
    if (d.source.kind === 'checked') assert.match(d.source.date, /^\d{4}-\d{2}-\d{2}$/);
  }
});

// ---------------------------------------------------------------- essentials threshold

test('TR-067: at exactly the threshold the offer shows, even with the float noise phones report', () => {
  const f20 = Math.fround(0.2); // what a 32-bit battery API hands over for 20%
  assert.ok(f20 > 0.2);
  assert.equal(normaliseLevel(f20), 0.2);
  assert.equal(percent(normaliseLevel(f20)), 20);
  assert.equal(isLow(reading(normaliseLevel(f20))), true, '20% is "at or below 20%"');
  assert.equal(isLow(reading(normaliseLevel(Math.fround(0.21)))), false);
  assert.deepEqual(stepEpisode(NO_EPISODE, reading(normaliseLevel(f20))), { low: true, dismissed: false });
  // Every 5% threshold the Settings stepper offers matches a phone reading of that same percent.
  let th = 0.05;
  for (let i = 0; i < 10; i++, th = stepThreshold(th, 1)) {
    const lvl = normaliseLevel(Math.fround(th));
    assert.equal(isLow(reading(lvl), th), true, `threshold ${th}`);
    assert.equal(isLow(reading(normaliseLevel(Math.fround(th + 0.01))), th), false, `just above ${th}`);
  }
});

test('TR-072: turning the manual switch off is stored and read back off, threshold kept', () => {
  const stored = JSON.parse(JSON.stringify(normalisePrefs({ manual: false, threshold: 0.3 })));
  assert.deepEqual(normalisePrefs(stored), { manual: false, threshold: 0.3 });
  assert.deepEqual(normalisePrefs(JSON.parse(JSON.stringify({ manual: true, threshold: 0.3 }))), { manual: true, threshold: 0.3 });
});

test('TR-073: threshold clamps to 5%..50% with both endpoints allowed', () => {
  assert.equal(clampThreshold(0.05), 0.05);
  assert.equal(clampThreshold(0.5), 0.5);
  assert.equal(clampThreshold(0.049), 0.05);
  assert.equal(clampThreshold(0.501), 0.5);
  assert.equal(clampThreshold(-1), 0.05);
  assert.equal(stepThreshold(0.05, -1), 0.05);
  assert.equal(stepThreshold(0.5, 1), 0.5);
  assert.equal(isLow(reading(0.05), 0.01), true, 'a stored 1% acts as 5%');
  assert.equal(isLow(reading(0.5), 0.9), true, 'a stored 90% acts as 50%');
  assert.equal(isLow(reading(0.51), 0.9), false);
});

// ---------------------------------------------------------------- packing

test('TR-075: a list from a template keeps its ticks through a save and reload', () => {
  const data = parseTemplates(JSON.parse(readFileSync(new URL('../content/packing_templates.json', import.meta.url), 'utf8')));
  const t = data.templates[0];
  const list = buildList('trip-1', [t], { nights: 4 });
  assert.equal(list.items.length, t.items.length);
  const first = list.items[0].id;
  const ticked = toggleItem(list, first);
  let reloaded = listFor(JSON.parse(JSON.stringify(putList({}, ticked))), 'trip-1')!;
  assert.equal(reloaded.items.find((i) => i.id === first)?.done, true);
  assert.equal(reloaded.items.filter((i) => i.done).length, 1);
  reloaded = listFor(JSON.parse(JSON.stringify(putList({}, toggleItem(reloaded, first)))), 'trip-1')!;
  assert.equal(reloaded.items.some((i) => i.done), false);
  assert.equal(reloaded.template, t.id);
});
