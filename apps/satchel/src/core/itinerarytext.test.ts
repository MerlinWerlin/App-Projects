import assert from 'node:assert/strict';
import { test } from 'node:test';
import { demoTrip } from './demo.ts';
import { formatDay, formatRange } from './format.ts';
import { daysWithPlans, itineraryText, mainZone, type ItineraryWords } from './itinerarytext.ts';
import type { Item, Trip } from './model.ts';
import { addDays } from './tz.ts';

const W: ItineraryWords = {
  kind: (k) => k[0].toUpperCase() + k.slice(1),
  dates: (range, days) => `${range} · ${days} days`,
  dayHeading: (day, city) => `${day} · ${city} time`,
  zoneTime: (time, city) => `${time} ${city} time`,
  noTime: 'Any time',
  arrives: (time) => `Arrives ${time}`,
  code: (ref) => `Booking code: ${ref}`,
  nothing: 'Nothing booked yet.',
};

const D = (d: string) => formatDay(d);
const trip = demoTrip('2026-11-03', '2026-10-24T00:00:00Z');
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

test('header, then each day with its own zone; a booking in another zone names its zone', () => {
  const text = itineraryText(trip, W);
  const lines = text.split('\n');
  assert.equal(lines[0], 'Tokyo & Kyoto (demo)');
  assert.equal(lines[1], `${formatRange('2026-11-03', '2026-11-11')} · 9 days`);
  // Day 1: the Sydney flight and the Tokyo hotel; Tokyo wins the tie as the trip's destination.
  assert.ok(text.includes(`${D('2026-11-03')} · Tokyo time\n09:30 Sydney time  Flight: Sydney → Tokyo Haneda\n   Sydney Airport T1 → Haneda Airport T3\n   Arrives 17:45\n15:00  Hotel:`), text);
  // Same-zone items carry no zone label.
  assert.ok(text.includes('07:30  Activity: Morning at the fish market\n   Tsukiji Outer Market'));
  // Overnight flight: arrival in its own zone, on its own day.
  assert.ok(text.includes('21:30  Flight: Osaka Kansai → Sydney'));
  assert.ok(text.includes(`Arrives 08:50 Sydney time, ${D('2026-11-11')}`));
  assert.ok(text.includes('2-1 Asakusa, Taito City, Tokyo'));
  assert.ok(text.endsWith('\n'));
});

test('booking codes are off by default and appear only when asked for', () => {
  const off = itineraryText(trip, W);
  for (const ref of ['DMO4KX', 'H-58213', 'JR-90314', 'GG-7781']) assert.ok(!off.includes(ref), ref);
  assert.ok(!off.includes('Booking code'));
  const on = itineraryText(trip, W, { includeCodes: true });
  for (const ref of ['DMO4KX', 'H-58213', 'JR-90314', 'GG-7781']) assert.ok(on.includes(`Booking code: ${ref}`), ref);
});

test('never includes notes, seats, attachments or anything private', () => {
  const t = bare([
    item({
      id: 'a',
      title: 'Museum',
      start: { local: '2026-11-03T10:00', tz: 'Asia/Tokyo' },
      notes: 'passport number X1234567, allergy: penicillin',
      seat: '12A',
      attachments: [{ id: 'f', uri: 'file:///secret/ticket.pdf', name: 'ticket.pdf', mime: 'application/pdf', role: 'ticket' }],
    }),
  ]);
  const text = itineraryText(t, W, { includeCodes: true });
  for (const s of ['X1234567', 'penicillin', '12A', 'ticket.pdf', 'file://']) assert.ok(!text.includes(s), s);
  assert.ok(text.includes('10:00  Activity: Museum'));
});

test('empty days are skipped; a range with nothing booked says so', () => {
  const t = bare([item({ id: 'a', title: 'Walk', start: { local: '2026-11-05T09:00', tz: 'Asia/Tokyo' } })]);
  const text = itineraryText(t, W);
  assert.ok(!text.includes(`${D('2026-11-03')}`));
  assert.ok(!text.includes(`${D('2026-11-04')}`));
  assert.ok(text.includes(`${D('2026-11-05')} · Tokyo time\n09:00  Activity: Walk`));
  assert.ok(itineraryText(bare([]), W).includes('Nothing booked yet.'));
  assert.ok(itineraryText(t, W, { scope: { kind: 'day', date: '2026-11-04' } }).includes('Nothing booked yet.'));
});

test('one day and from today', () => {
  const day = itineraryText(trip, W, { scope: { kind: 'day', date: '2026-11-07' } });
  assert.ok(day.includes(`${D('2026-11-07')}`));
  assert.ok(day.includes('Tokyo → Kyoto'));
  assert.ok(!day.includes(`${D('2026-11-03')}`));
  assert.ok(!day.includes(`${D('2026-11-08')}`));
  const from = itineraryText(trip, W, { scope: { kind: 'from', date: '2026-11-08' } });
  assert.ok(!from.includes(`${D('2026-11-07')}`));
  assert.ok(from.includes(`${D('2026-11-08')}`));
  assert.ok(from.includes('Osaka Kansai → Sydney'));
  assert.deepEqual(daysWithPlans(trip), ['2026-11-03', '2026-11-04', '2026-11-07', '2026-11-08', '2026-11-10']);
});

test('a day mostly in another zone is headed with that zone, and the odd one out is labelled', () => {
  const t = bare([
    item({ id: 'a', title: 'Breakfast', start: { local: '2026-11-04T08:00', tz: 'Asia/Seoul' } }),
    item({ id: 'b', title: 'Palace', start: { local: '2026-11-04T10:00', tz: 'Asia/Seoul' } }),
    item({ id: 'c', title: 'Call home', kind: 'note', start: { local: '2026-11-04T20:00', tz: 'Australia/Sydney' } }),
  ]);
  const day = t.items;
  assert.equal(mainZone(day, t), 'Asia/Seoul');
  const text = itineraryText(t, W);
  assert.ok(text.includes(`${D('2026-11-04')} · Seoul time\n08:00  Activity: Breakfast`));
  assert.ok(text.includes('20:00 Sydney time  Note: Call home'));
});

test('an item with no time (or a zone the phone cannot read) is kept, after the timed ones, without throwing', () => {
  const t = bare([
    item({ id: 'z', title: 'Pick up rail pass', start: { local: '2026-11-03', tz: 'Asia/Tokyo' } }),
    item({ id: 'y', title: 'Old zone', start: { local: '2026-11-03T07:00', tz: 'Mars/Olympus' } }),
    item({ id: 'x', title: 'Lunch', start: { local: '2026-11-03T12:00', tz: 'Asia/Tokyo' } }),
  ]);
  const text = itineraryText(t, W);
  const lunch = text.indexOf('12:00  Activity: Lunch');
  const old = text.indexOf('07:00 Olympus time  Activity: Old zone');
  const any = text.indexOf('Any time  Activity: Pick up rail pass');
  assert.ok(lunch > 0 && old > lunch && any > lunch, text);
});

test('a long trip lists every booked day in order', () => {
  const start = '2026-11-01';
  const items: Item[] = [];
  for (let n = 0; n < 60; n++) items.push(item({ id: `i${String(n).padStart(2, '0')}`, title: `Stop ${n + 1}`, start: { local: `${addDays(start, n)}T10:00`, tz: 'Europe/Lisbon' } }));
  const t = bare(items, { startDate: start, endDate: addDays(start, 59), homeTz: 'Europe/London' });
  const text = itineraryText(t, W);
  assert.ok(text.includes('· 60 days'));
  let at = -1;
  for (let n = 0; n < 60; n++) {
    const i = text.indexOf(`Activity: Stop ${n + 1}\n`);
    assert.ok(i > at, `Stop ${n + 1}`);
    at = i;
  }
  assert.equal((text.match(/· Lisbon time/g) ?? []).length, 60);
});

test('a hotel shows its name when it differs from the title, and the local address when there is no other', () => {
  const t = bare([
    item({ id: 'h', kind: 'hotel', title: 'Stay', start: { local: '2026-11-03T15:00', tz: 'Asia/Tokyo' }, place: { id: 'p', name: 'Inn by the river', localAddress: '京都府 1-2' } }),
  ]);
  const text = itineraryText(t, W);
  assert.ok(text.includes('15:00  Hotel: Stay\n   Inn by the river\n   京都府 1-2'));
});
