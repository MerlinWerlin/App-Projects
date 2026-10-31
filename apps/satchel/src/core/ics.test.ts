import assert from 'node:assert/strict';
import { test } from 'node:test';
import { demoTrip } from './demo.ts';
import { buildIcs, escapeText, foldLine, icsFileName, itemUid, itemsInScope, utcStamp, type IcsWords } from './ics.ts';
import type { Item, Trip } from './model.ts';

const W: IcsWords = {
  kind: (k) => k[0].toUpperCase() + k.slice(1),
  starts: (_k, at) => `Starts ${at}`,
  ends: (_k, at) => `Ends ${at}`,
  zoneTime: (time, city) => `${time} ${city} time`,
  code: (ref) => `Booking code: ${ref}`,
  notes: (n) => `Notes: ${n}`,
};
const NOW = Date.UTC(2026, 9, 31, 12, 0, 0);
const item = (x: Partial<Item> & Pick<Item, 'id' | 'start'>): Item => ({ tripId: 't', kind: 'activity', title: x.id, attachments: [], ...x });
const bare = (items: Item[], extra: Partial<Trip> = {}): Trip => ({
  id: 't',
  name: 'Test trip',
  startDate: '2026-11-03',
  endDate: '2026-11-05',
  homeTz: 'Australia/Sydney',
  items,
  createdAt: '2026-10-01T00:00:00Z',
  ...extra,
});
const octets = (s: string) => Buffer.byteLength(s, 'utf8');
/** Unfold (RFC 5545 §3.1) and split into logical lines. */
const unfold = (text: string) => text.replace(/\r\n /g, '').split('\r\n').filter(Boolean);
const events = (text: string) => text.split('BEGIN:VEVENT').slice(1).map((e) => unfold('BEGIN:VEVENT' + e.split('END:VEVENT')[0]));
const prop = (lines: string[], name: string) => lines.find((l) => l.startsWith(`${name}:`) || l.startsWith(`${name};`));

test('escaping: backslash, semicolon, comma and every kind of line break', () => {
  assert.equal(escapeText('a\\b;c,d\ne\r\nf\rg'), 'a\\\\b\\;c\\,d\\ne\\nf\\ng');
  assert.equal(escapeText('tab\tok\u0007bell'), 'tab\tokbell');
  const r = buildIcs(bare([item({ id: 'a', title: 'Dinner; drinks, then \\ home', start: { local: '2026-11-03T19:00', tz: 'Asia/Tokyo' } })]), W, { now: NOW });
  assert.equal(prop(events(r.text)[0], 'SUMMARY'), 'SUMMARY:Dinner\\; drinks\\, then \\\\ home');
});

test('folding: CRLF everywhere, no physical line over 75 octets, UTF-8 characters never split', () => {
  const long = 'Ryokan 京都 ' + 'あ'.repeat(60) + ' 🏯🏯🏯 ' + 'x'.repeat(100);
  const r = buildIcs(bare([item({ id: 'a', title: long, kind: 'hotel', start: { local: '2026-11-03T15:00', tz: 'Asia/Tokyo' } })]), W, { now: NOW });
  assert.ok(r.text.endsWith('\r\n'));
  assert.ok(!/[^\r]\n/.test(r.text), 'bare LF found');
  for (const l of r.text.split('\r\n')) {
    assert.ok(octets(l) <= 75, `line of ${octets(l)} octets: ${l}`);
    assert.ok(!l.includes('�'));
  }
  assert.equal(prop(events(r.text)[0], 'SUMMARY'), `SUMMARY:${long}`);
  // Folding unit: exactly 75 stays, 76 folds; continuation starts with one space.
  assert.equal(foldLine('a'.repeat(75)), 'a'.repeat(75));
  assert.equal(foldLine('a'.repeat(76)), `${'a'.repeat(75)}\r\n a`);
  const f = foldLine('é'.repeat(50)).split('\r\n');
  assert.equal(octets(f[0]), 74); // 37 two-byte chars; a 38th would make 76
  assert.ok(f.slice(1).every((l) => l.startsWith(' ') && octets(l) <= 75));
});

test('calendar frame: VERSION, PRODID, CALSCALE and one VEVENT per booking', () => {
  const r = buildIcs(bare([item({ id: 'a', start: { local: '2026-11-03T09:00', tz: 'Asia/Tokyo' } })]), W, { now: NOW });
  const lines = unfold(r.text);
  assert.equal(lines[0], 'BEGIN:VCALENDAR');
  assert.equal(lines.at(-1), 'END:VCALENDAR');
  assert.ok(lines.includes('VERSION:2.0'));
  assert.ok(lines.some((l) => l.startsWith('PRODID:')));
  assert.ok(lines.includes('X-WR-CALNAME:Test trip'));
  assert.equal(r.count, 1);
  assert.equal(prop(events(r.text)[0], 'DTSTAMP'), 'DTSTAMP:20261031T120000Z');
});

test('UTC: times are the item zone wall clock, across a DST change, never the phone zone', () => {
  // Sydney leaves DST on 5 Apr 2026 (03:00 AEDT -> 02:00 AEST). 09:00 on 4 Apr is UTC+11, 09:00 on 6 Apr is UTC+10.
  const a = item({ id: 'a', start: { local: '2026-04-04T09:00', tz: 'Australia/Sydney' }, end: { local: '2026-04-04T10:30', tz: 'Australia/Sydney' } });
  const b = item({ id: 'b', start: { local: '2026-04-06T09:00', tz: 'Australia/Sydney' } });
  // New York springs forward on 8 Mar 2026: 01:30 EST (UTC-5) and 03:30 EDT (UTC-4); a stay overnight across it.
  const c = item({ id: 'c', kind: 'train', start: { local: '2026-03-08T01:30', tz: 'America/New_York' }, end: { local: '2026-03-08T03:30', tz: 'America/New_York' } });
  // Overnight flight across zones: depart Sydney 21:00 AEDT, arrive Tokyo 05:00 JST next day.
  const d = item({ id: 'd', kind: 'flight', start: { local: '2026-11-03T21:00', tz: 'Australia/Sydney' }, end: { local: '2026-11-04T05:00', tz: 'Asia/Tokyo' } });
  const ev = events(buildIcs(bare([a, b, c, d]), W, { now: NOW }).text);
  const byUid = (id: string) => ev.find((e) => prop(e, 'UID') === `UID:${itemUid(id)}`)!;
  assert.equal(prop(byUid('a'), 'DTSTART'), 'DTSTART:20260403T220000Z');
  assert.equal(prop(byUid('a'), 'DTEND'), 'DTEND:20260403T233000Z');
  assert.equal(prop(byUid('b'), 'DTSTART'), 'DTSTART:20260405T230000Z');
  assert.equal(prop(byUid('c'), 'DTSTART'), 'DTSTART:20260308T063000Z');
  assert.equal(prop(byUid('c'), 'DTEND'), 'DTEND:20260308T073000Z'); // only one real hour
  assert.equal(prop(byUid('d'), 'DTSTART'), 'DTSTART:20261103T100000Z');
  assert.equal(prop(byUid('d'), 'DTEND'), 'DTEND:20261103T200000Z');
  for (const e of ev) assert.ok(!e.some((l) => l.includes('TZID')), 'no TZID: UTC only');
  // The printed times stay in the description.
  assert.match(prop(byUid('d'), 'DESCRIPTION')!, /Starts 21:00 Sydney time\\nEnds 05:00 Tokyo time/);
  assert.equal(utcStamp(Date.UTC(2026, 0, 2, 3, 4, 5)), '20260102T030405Z');
});

test('all-day: a stay over nights uses DATE values with an exclusive check-out end; a same-day hotel stays timed', () => {
  const stay = item({ id: 'h', kind: 'hotel', title: 'Hotel', start: { local: '2026-11-03T15:00', tz: 'Asia/Tokyo' }, end: { local: '2026-11-06T11:00', tz: 'Asia/Tokyo' } });
  const dayUse = item({ id: 'u', kind: 'hotel', title: 'Day room', start: { local: '2026-11-07T10:00', tz: 'Asia/Tokyo' }, end: { local: '2026-11-07T16:00', tz: 'Asia/Tokyo' } });
  const ev = events(buildIcs(bare([stay, dayUse]), W, { now: NOW }).text);
  assert.equal(prop(ev[0], 'DTSTART'), 'DTSTART;VALUE=DATE:20261103');
  assert.equal(prop(ev[0], 'DTEND'), 'DTEND;VALUE=DATE:20261106');
  assert.ok(ev[0].includes('TRANSP:TRANSPARENT'));
  assert.match(prop(ev[0], 'DESCRIPTION')!, /Starts 15:00 Tokyo time\\nEnds 11:00 Tokyo time/);
  assert.equal(prop(ev[1], 'DTSTART'), 'DTSTART:20261107T010000Z');
});

test('point-in-time items have no DTEND (RFC: DTEND must be after DTSTART)', () => {
  const n = item({ id: 'n', kind: 'note', start: { local: '2026-11-03T08:00', tz: 'Asia/Tokyo' } });
  const z = item({ id: 'z', start: { local: '2026-11-03T08:00', tz: 'Asia/Tokyo' }, end: { local: '2026-11-03T08:00', tz: 'Asia/Tokyo' } });
  for (const e of events(buildIcs(bare([n, z]), W, { now: NOW }).text)) assert.equal(prop(e, 'DTEND'), undefined);
});

test('UIDs are stable, derived from item ids, and unique', () => {
  const t = bare([item({ id: 'item_1', start: { local: '2026-11-03T09:00', tz: 'Asia/Tokyo' } }), item({ id: 'item 1', start: { local: '2026-11-03T10:00', tz: 'Asia/Tokyo' } })]);
  const a = events(buildIcs(t, W, { now: NOW }).text).map((e) => prop(e, 'UID'));
  const b = events(buildIcs(t, W, { now: NOW + 86_400_000, includeCodes: true }).text).map((e) => prop(e, 'UID'));
  assert.deepEqual(a, b);
  assert.equal(new Set(a).size, 2);
  assert.equal(itemUid('item_1'), 'item_1@satchel.trip');
  assert.notEqual(itemUid('a b'), itemUid('a_b'));
  // Same booking alone or in the whole trip: same UID, so the calendar updates instead of duplicating.
  const one = events(buildIcs(t, W, { scope: { kind: 'item', id: 'item_1' }, now: NOW }).text);
  assert.equal(one.length, 1);
  assert.equal(prop(one[0], 'UID'), a.find((u) => u === `UID:${itemUid('item_1')}`));
});

test('privacy: booking codes and notes are off by default and on only when asked; seats never', () => {
  const t = bare([
    item({ id: 'f', kind: 'flight', title: 'Flight', ref: 'DMO4KX', seat: '42K', notes: 'Door code 1234\nAsk for quiet room', carrier: 'Sky', number: 'SK 12', start: { local: '2026-11-03T09:00', tz: 'Asia/Tokyo' } }),
  ]);
  const off = unfold(buildIcs(t, W, { now: NOW }).text).join('\n');
  assert.ok(!off.includes('DMO4KX'));
  assert.ok(!off.includes('1234'));
  assert.ok(!off.includes('42K'));
  assert.ok(off.includes('Sky SK 12'));
  const on = unfold(buildIcs(t, W, { now: NOW, includeCodes: true, includeNotes: true }).text).join('\n');
  assert.ok(on.includes('Booking code: DMO4KX'));
  assert.ok(on.includes('Notes: Door code 1234\\nAsk for quiet room'));
  assert.ok(!on.includes('42K'));
  const codesOnly = unfold(buildIcs(t, W, { now: NOW, includeCodes: true }).text).join('\n');
  assert.ok(codesOnly.includes('DMO4KX') && !codesOnly.includes('1234'));
});

test('LOCATION from the place and address (departure point for journeys), GEO from coordinates', () => {
  const h = item({ id: 'h', kind: 'activity', title: 'Museum', place: { id: 'p', name: 'Mori Art Museum', address: 'Roppongi 6-10-1, Minato', lat: 35.66, lon: 139.73 }, start: { local: '2026-11-03T10:00', tz: 'Asia/Tokyo' } });
  const f = item({ id: 'f', kind: 'train', title: 'Shinkansen', from: { id: 'a', name: 'Tokyo Station' }, to: { id: 'b', name: 'Kyoto Station' }, start: { local: '2026-11-04T10:00', tz: 'Asia/Tokyo' } });
  const ev = events(buildIcs(bare([h, f]), W, { now: NOW }).text);
  assert.equal(prop(ev[0], 'LOCATION'), 'LOCATION:Mori Art Museum\\, Roppongi 6-10-1\\, Minato');
  assert.equal(prop(ev[0], 'GEO'), 'GEO:35.66;139.73');
  assert.equal(prop(ev[1], 'LOCATION'), 'LOCATION:Tokyo Station');
  assert.match(prop(ev[1], 'DESCRIPTION')!, /Tokyo Station → Kyoto Station/);
});

test('empty trip: a well-formed calendar with no events and count 0', () => {
  const r = buildIcs(bare([]), W, { now: NOW });
  assert.equal(r.count, 0);
  assert.equal(r.skipped, 0);
  assert.ok(!r.text.includes('VEVENT'));
  assert.ok(r.text.startsWith('BEGIN:VCALENDAR\r\n') && r.text.endsWith('END:VCALENDAR\r\n'));
  assert.equal(buildIcs(bare([item({ id: 'a', start: { local: '2026-11-03T09:00', tz: 'Asia/Tokyo' } })]), W, { scope: { kind: 'day', date: '2026-11-04' }, now: NOW }).count, 0);
});

test('unreadable zones are left out and counted, never guessed; date-only items are all-day', () => {
  const bad = item({ id: 'x', start: { local: '2026-11-03T09:00', tz: 'Mars/Olympus' } });
  const dateOnly = item({ id: 'd', start: { local: '2026-11-04', tz: 'Asia/Tokyo' } });
  const r = buildIcs(bare([bad, dateOnly]), W, { now: NOW });
  assert.equal(r.count, 1);
  assert.equal(r.skipped, 1);
  const e = events(r.text)[0];
  assert.equal(prop(e, 'DTSTART'), 'DTSTART;VALUE=DATE:20261104');
  assert.equal(prop(e, 'DTEND'), 'DTEND;VALUE=DATE:20261105');
});

test('scopes: a day is what its card shows (starts then, or journey still under way); item is one booking', () => {
  const night = item({ id: 'n', kind: 'train', start: { local: '2026-11-03T22:00', tz: 'Europe/Paris' }, end: { local: '2026-11-04T08:00', tz: 'Europe/Rome' } });
  const lunch = item({ id: 'l', start: { local: '2026-11-04T12:00', tz: 'Europe/Rome' } });
  const other = item({ id: 'o', start: { local: '2026-11-05T12:00', tz: 'Europe/Rome' } });
  const t = bare([night, lunch, other]);
  assert.deepEqual(itemsInScope(t, { kind: 'day', date: '2026-11-04' }).map((i) => i.id).sort(), ['l', 'n']);
  assert.deepEqual(itemsInScope(t, { kind: 'item', id: 'o' }).map((i) => i.id), ['o']);
  assert.equal(buildIcs(t, W, { now: NOW }).count, 3);
});

test('demo trip exports every booking with valid structure; file names are safe', () => {
  const trip = demoTrip('2026-11-03', '2026-10-24T00:00:00Z');
  const r = buildIcs(trip, W, { now: NOW });
  assert.equal(r.count + r.skipped, trip.items.length);
  assert.equal(r.text.split('BEGIN:VEVENT').length - 1, r.count);
  assert.equal(r.text.split('END:VEVENT').length - 1, r.count);
  for (const e of events(r.text)) {
    assert.ok(prop(e, 'UID') && prop(e, 'DTSTAMP') && prop(e, 'DTSTART') && prop(e, 'SUMMARY'));
  }
  assert.equal(icsFileName(bare([], { name: 'Japan: autumn/2026' }), { kind: 'trip' }), 'Japan autumn 2026.ics');
  assert.equal(icsFileName(bare([], { name: '' }), { kind: 'day', date: '2026-11-04' }), 'Trip 2026-11-04.ics');
  assert.equal(icsFileName(bare([item({ id: 'a', title: 'Flight?', start: { local: '2026-11-03T09:00', tz: 'Asia/Tokyo' } })]), { kind: 'item', id: 'a' }), 'Flight.ics');
});
