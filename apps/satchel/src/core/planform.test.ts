// T173 Add plans myself: plan types to bookings, gentle checks, editing back, and the .satchel guard for `look`.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { itemFromPlan, newPlanForm, planDays, planFormFits, planFromItem, planIssues, planTypeFromWord, readPlanLook, type PlanForm, type PlanType } from './planform.ts';
import { lookOf } from './dayview.ts';
import { buildTripFile, importTripFile, parseTripFileText } from './tripfile.ts';
import type { Trip } from './model.ts';

const T = 'Europe/Paris';
const mk = (type: PlanType, extra: Partial<PlanForm> = {}) => itemFromPlan({ ...newPlanForm('2027-03-03', T, type), title: 'X', ...extra }, 'trip')!;

test('a plan needs a title and a day; blank optional fields are simply left out', () => {
  const f = newPlanForm('2027-03-03', T, 'tour');
  assert.deepEqual(planIssues(f), ['title']);
  assert.equal(itemFromPlan(f, 'trip'), null);
  f.title = 'Louvre tour';
  const it = itemFromPlan(f, 'trip')!;
  assert.equal(it.kind, 'activity');
  assert.equal(it.look, 'tour');
  assert.equal(it.start.local, '2027-03-03T09:00');
  assert.equal(it.end, undefined);
  assert.equal(it.place, undefined);
  assert.equal(it.ref, undefined);
  assert.equal(it.notes, undefined);
  assert.equal(lookOf(it), 'tour');
  assert.deepEqual(planIssues({ ...f, day: '' }), ['day']);
});

test('each type becomes the right kind of booking', () => {
  const stay = mk('stay', { place: 'Hôtel Exemple, 1 Rue Exemple, Paris', code: 'HX1' });
  assert.equal(stay.kind, 'hotel');
  assert.equal(stay.end?.local, '2027-03-04T11:00');
  assert.equal(stay.place?.name, 'Hôtel Exemple');
  assert.equal(stay.place?.address, '1 Rue Exemple, Paris');
  assert.equal(stay.ref, 'HX1');
  assert.equal(mk('flight', { end: '11:30' }).kind, 'flight');
  const noLanding = mk('flight');
  assert.equal(noLanding.kind, 'activity');
  assert.equal(lookOf(noLanding), 'flight');
  assert.equal(lookOf(mk('food', { start: '19:00' })), 'food');
  assert.equal(lookOf(mk('transport', { end: '10:00' })), 'transfer');
  const free = mk('free');
  assert.equal(free.kind, 'note');
  assert.equal(lookOf(free), 'free');
  // An end before the start runs past midnight.
  assert.equal(mk('tour', { start: '22:00', end: '01:00' }).end?.local, '2027-03-04T01:00');
  for (const t of ['flight', 'stay', 'tour', 'food', 'transport', 'free', 'other'] as const) assert.ok(mk(t, { end: t === 'flight' ? '12:00' : '' }), t);
  assert.deepEqual(planIssues({ ...newPlanForm('2027-03-03', T, 'stay'), title: 'S', endDay: '2027-03-03' }), ['endDay']);
});

test('editing: a plan opens back in the form and saves over itself', () => {
  const f: PlanForm = { ...newPlanForm('2027-03-03', T, 'food'), title: 'Dinner', start: '19:30', end: '21:00', place: 'Chez Exemple, Paris', code: 'R12', notes: 'Window table' };
  const it = itemFromPlan(f, 'trip')!;
  assert.ok(planFormFits(it));
  assert.deepEqual(planFromItem(it), { ...f, endDay: '2027-03-03' });
  const again = itemFromPlan({ ...planFromItem(it), title: 'Late dinner' }, 'trip', it)!;
  assert.equal(again.id, it.id);
  assert.equal(again.title, 'Late dinner');
  assert.equal(again.look, 'food');
  // A booking with attachments or check-in settings opens in the full form instead.
  assert.equal(planFormFits({ ...it, look: undefined, attachments: [{ id: 'a', uri: '', name: 'x', mime: 'image/png', role: 'ticket' }] }), false);
});

test('type words, trip days, and reading a stored look', () => {
  assert.equal(planTypeFromWord('Free time'), 'free');
  assert.equal(planTypeFromWord('HOTEL'), 'stay');
  assert.equal(planTypeFromWord('banana'), undefined);
  assert.equal(readPlanLook('food'), 'food');
  assert.equal(readPlanLook('rocket'), undefined);
  assert.deepEqual(planDays({ startDate: '2027-03-30', endDate: '2027-04-02' }), ['2027-03-30', '2027-03-31', '2027-04-01', '2027-04-02']);
});

test('.satchel files keep a plan type and drop an unreadable one', () => {
  const it = mk('food', { title: 'Dinner' });
  const trip: Trip = { id: 't1', name: 'Paris', startDate: '2027-03-01', endDate: '2027-03-05', homeTz: T, items: [it, { ...it, id: 'x2', look: 'rocket' as never }], createdAt: '2027-01-01' };
  const parsed = parseTripFileText(JSON.stringify(buildTripFile(trip, {}).file));
  assert.ok(parsed.ok);
  if (!parsed.ok) return;
  let n = 0;
  const back = importTripFile(parsed.file, (p) => `${p}_${++n}`);
  assert.equal(back.trip.items[0].look, 'food');
  assert.equal(back.trip.items[1].look, undefined);
});
