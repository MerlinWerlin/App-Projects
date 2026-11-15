import assert from 'node:assert/strict';
import { test } from 'node:test';
import { en } from '../i18n/en.ts';
import { makeT } from '../i18n/core.ts';
import type { Item, ItemKind, Trip } from './model.ts';
import { CHECKOUT_LEAD_MINUTES, hasUpcomingReminders, HORIZON_DAYS, isOurReminderId, LEAD_MINUTES, MAX_REMINDERS, planReminders, REMINDER_KEYS, REMINDER_SOUNDS, reminderId, soundFor } from './reminders.ts';
import { toUtc } from './tz.ts';

const TZ = 'Asia/Tokyo';
const MIN = 60_000;
// 10 Nov 2026, 08:00 in Tokyo.
const NOW = toUtc({ local: '2026-11-10T08:00', tz: TZ });

let n = 0;
function item(kind: ItemKind, start: string, extra: Partial<Item> = {}): Item {
  n += 1;
  return { id: `i${n}`, tripId: 't1', kind, title: `${kind} ${n}`, start: { local: start, tz: TZ }, attachments: [], ...extra };
}
function trip(items: Item[], extra: Partial<Trip> = {}): Trip {
  return { id: 't1', name: 'Japan', startDate: '2026-11-10', endDate: '2026-11-20', homeTz: 'Australia/Sydney', items, createdAt: '2026-10-01T00:00:00Z', ...extra };
}
const t = makeT(null);
const words = (r: { titleKey: string; titleParams: Record<string, string | number>; bodyKey: string; bodyParams: Record<string, string | number> }) => ({
  title: t(r.titleKey as keyof typeof en, r.titleParams),
  body: t(r.bodyKey as keyof typeof en, r.bodyParams),
});

test('lead times: flight 3 h, train / ferry / bus 1 h, hotel 2 h, car 1 h, activity 30 min', () => {
  assert.deepEqual(LEAD_MINUTES, { flight: 180, train: 60, ferry: 60, bus: 60, hotel: 120, car: 60, activity: 30 });
  assert.equal(CHECKOUT_LEAD_MINUTES, 60);
  for (const kind of ['flight', 'train', 'ferry', 'bus', 'hotel', 'car', 'activity'] as const) {
    const it = item(kind, '2026-11-11T15:00');
    const [r] = planReminders([trip([it])], NOW);
    assert.equal(r.at, toUtc(it.start) - LEAD_MINUTES[kind] * MIN, kind);
    assert.equal(r.itemId, it.id);
    assert.equal(r.tripId, 't1');
    assert.equal(r.kind, kind);
  }
});

test('hotel: check-in 2 h before arrival and check-out 1 h before the end', () => {
  const h = item('hotel', '2026-11-11T15:00', { end: { local: '2026-11-13T11:00', tz: TZ }, place: { id: 'p', name: 'Hotel Gion' } });
  const plan = planReminders([trip([h])], NOW);
  assert.deepEqual(plan.map((r) => r.slot), ['checkin', 'checkout']);
  assert.equal(plan[0].at, toUtc({ local: '2026-11-11T13:00', tz: TZ }));
  assert.equal(plan[1].at, toUtc({ local: '2026-11-13T10:00', tz: TZ }));
  assert.equal(words(plan[0]).body, 'Check in at Hotel Gion from 15:00.');
  assert.equal(words(plan[1]).body, 'Check out of Hotel Gion by 11:00.');
  // No end: only the check-in.
  assert.deepEqual(planReminders([trip([item('hotel', '2026-11-11T15:00')])], NOW).map((r) => r.slot), ['checkin']);
});

test('friendly words, with and without a place', () => {
  const f = item('flight', '2026-11-12T09:40', { title: 'QF21 to Kyoto', to: { id: 'k', name: 'Kyoto' } });
  const fNo = item('flight', '2026-11-12T10:40', { title: '' });
  const tea = item('activity', '2026-11-12T14:00', { title: 'Tea ceremony' });
  const teaAt = item('activity', '2026-11-12T16:00', { title: 'Tea ceremony', place: { id: 'g', name: 'Gion Corner' } });
  const car = item('car', '2026-11-12T18:00', { title: 'Hire car', place: { id: 'c', name: 'Kyoto Station' } });
  const train = item('train', '2026-11-12T20:00', { title: 'Shinkansen' });
  const plan = planReminders([trip([f, fNo, tea, teaAt, car, train])], NOW);
  const by = (id: string) => words(plan.find((r) => r.itemId === id)!);
  assert.deepEqual(by(f.id), { title: 'QF21 to Kyoto', body: 'Your flight to Kyoto leaves at 09:40.' });
  assert.deepEqual(by(fNo.id), { title: 'Your flight', body: 'Your flight leaves at 10:40.' });
  assert.deepEqual(by(tea.id), { title: 'Coming up at 14:00', body: 'Tea ceremony in 30 minutes.' });
  assert.deepEqual(by(teaAt.id), { title: 'Coming up at 16:00', body: 'Tea ceremony at Gion Corner in 30 minutes.' });
  assert.deepEqual(by(car.id), { title: 'Hire car', body: 'Pick up your car at Kyoto Station at 18:00.' });
  assert.deepEqual(by(train.id), { title: 'Shinkansen', body: 'Your train leaves at 20:00.' });
});

test('skips past reminders, notes, demo trips, bad zones and bad times', () => {
  const soon = item('flight', '2026-11-10T10:00'); // reminder 07:00, already past
  const later = item('activity', '2026-11-10T08:20'); // reminder 07:50, past
  const ok = item('activity', '2026-11-10T09:00'); // reminder 08:30
  const note = item('note', '2026-11-11T09:00');
  const badZone = item('train', '2026-11-11T09:00', { start: { local: '2026-11-11T09:00', tz: 'Mars/Olympus' } });
  const badTime = item('train', '2026-11-11T09:00', { start: { local: '2026-11-31T09:00', tz: TZ } });
  const plan = planReminders([trip([soon, later, ok, note, badZone, badTime]), trip([item('flight', '2026-11-12T09:00')], { id: 'demo', demo: true })], NOW);
  assert.deepEqual(plan.map((r) => r.itemId), [ok.id]);
  assert.deepEqual(planReminders([], NOW), []);
  assert.deepEqual(planReminders(null as unknown as Trip[], NOW), []);
});

test('only the coming days: nothing past the horizon', () => {
  const near = item('activity', '2026-11-20T10:00');
  const far = item('activity', '2026-12-30T10:00');
  assert.deepEqual(planReminders([trip([near, far])], NOW).map((r) => r.itemId), [near.id]);
  assert.equal(HORIZON_DAYS, 14);
  assert.deepEqual(planReminders([trip([near, far])], NOW, { horizonDays: 60 }).map((r) => r.itemId), [near.id, far.id]);
});

test('sorted soonest first across trips and zones, capped at 60', () => {
  const a = item('activity', '2026-11-12T12:00');
  const b = { ...item('activity', '2026-11-12T12:00'), start: { local: '2026-11-12T01:00', tz: 'Europe/London' } }; // 10:00 Tokyo
  const c = item('flight', '2026-11-11T09:00');
  const plan = planReminders([trip([a]), trip([b, c], { id: 't2' })], NOW);
  assert.deepEqual(plan.map((r) => r.itemId), [c.id, b.id, a.id]);
  for (let i = 1; i < plan.length; i++) assert.ok(plan[i - 1].at <= plan[i].at);

  const many: Item[] = [];
  for (let d = 0; d < 12; d++) for (let h = 9; h < 17; h++) many.push(item('activity', `2026-11-${String(11 + d).padStart(2, '0')}T${String(h).padStart(2, '0')}:00`));
  const capped = planReminders([trip(many)], NOW, { horizonDays: 30 });
  assert.equal(MAX_REMINDERS, 60);
  assert.equal(capped.length, 60);
  assert.equal(capped[0].itemId, many[0].id, 'the soonest are kept');
  assert.ok(MAX_REMINDERS < 64, 'under the iOS pending limit');
  assert.equal(planReminders([trip(many)], NOW, { max: 500 }).length, 60, 'max never exceeds the cap');
});

test('sound per kind: departures, check-ins, chime for plans', () => {
  assert.deepEqual(REMINDER_SOUNDS, { chime: 'satchel_chime.wav', depart: 'satchel_depart.wav', checkin: 'satchel_checkin.wav' });
  for (const k of ['flight', 'train', 'ferry', 'bus'] as const) assert.equal(soundFor(k), 'satchel_depart.wav');
  assert.equal(soundFor('hotel'), 'satchel_checkin.wav');
  assert.equal(soundFor('car'), 'satchel_checkin.wav');
  assert.equal(soundFor('activity'), 'satchel_chime.wav');
  const plan = planReminders([trip([item('ferry', '2026-11-11T09:00'), item('car', '2026-11-11T12:00'), item('activity', '2026-11-11T15:00')])], NOW);
  assert.deepEqual(plan.map((r) => r.sound), ['satchel_depart.wav', 'satchel_checkin.wav', 'satchel_chime.wav']);
});

test('ids are deterministic satchel-<itemId>-<slot>, unique, and recognised as ours', () => {
  const h = item('hotel', '2026-11-11T15:00', { id: 'stay1', end: { local: '2026-11-12T11:00', tz: TZ } });
  const f = item('flight', '2026-11-12T15:00', { id: 'fl1' });
  const once = planReminders([trip([h, f])], NOW);
  assert.deepEqual(once.map((r) => r.id), ['satchel-stay1-checkin', 'satchel-stay1-checkout', 'satchel-fl1-depart']);
  assert.deepEqual(planReminders([trip([h, f])], NOW), once, 'same input, same plan');
  assert.equal(reminderId('x', 'start'), 'satchel-x-start');
  assert.ok(isOurReminderId('satchel-x-start'));
  assert.ok(!isOurReminderId('other-app-thing'));
  assert.ok(!isOurReminderId(undefined));
  // A duplicated item id is only scheduled once.
  assert.equal(planReminders([trip([f, { ...f }])], NOW).length, 1);
});

test('hasUpcomingReminders: real trips with plans ahead only', () => {
  assert.equal(hasUpcomingReminders([trip([item('activity', '2026-11-11T10:00')])], NOW), true);
  assert.equal(hasUpcomingReminders([trip([item('activity', '2026-11-11T10:00')], { demo: true })], NOW), false);
  assert.equal(hasUpcomingReminders([trip([item('note', '2026-11-11T10:00')])], NOW), false);
});

test('every key the planner can use exists in English, with matching placeholders', () => {
  const cat = en as Record<string, string>;
  for (const k of REMINDER_KEYS) assert.equal(typeof cat[k], 'string', k);
  // Every key the plan returns for a broad sample is listed.
  const all = planReminders(
    [
      trip([
        item('flight', '2026-11-11T09:00', { to: { id: 'a', name: 'A' } }),
        item('bus', '2026-11-11T10:00', { title: '' }),
        item('hotel', '2026-11-11T15:00', { title: '', end: { local: '2026-11-12T10:00', tz: TZ } }),
        item('car', '2026-11-11T17:00', { title: '' }),
        item('activity', '2026-11-11T19:00', { title: '' }),
        item('activity', '2026-11-11T20:00', { title: '', place: { id: 'p', name: 'P' } }),
      ]),
    ],
    NOW,
  );
  for (const r of all) {
    assert.ok(REMINDER_KEYS.includes(r.titleKey), r.titleKey);
    assert.ok(REMINDER_KEYS.includes(r.bodyKey), r.bodyKey);
    const filled = words(r);
    assert.doesNotMatch(filled.title + filled.body, /[{}]/, `${r.id}: every placeholder filled`);
  }
});

test('reminder UI strings exist and the UI never hard-codes them', async () => {
  const { readFileSync } = await import('node:fs');
  const cat = en as Record<string, string>;
  const files = ['../ui/RemindersSection.tsx', '../ui/RemindersOffer.tsx', '../native/notifications.ts'];
  for (const f of files) {
    const src = readFileSync(new URL(f, import.meta.url), 'utf8');
    for (const m of src.matchAll(/t\('(reminders\.[A-Za-z.]+)'/g)) assert.equal(typeof cat[m[1]], 'string', `${f}: ${m[1]}`);
  }
  for (const [k, v] of Object.entries(cat)) if (k.startsWith('reminders.')) assert.ok(v.trim().length > 0, k);
});
