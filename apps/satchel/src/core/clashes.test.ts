import assert from 'node:assert/strict';
import { test } from 'node:test';
import { overlapPartners, overlapTitles } from './clashes.ts';
import { demoTrip } from './demo.ts';
import type { Item } from './model.ts';

const trip = demoTrip('2026-11-03', '2026-10-24T00:00:00Z');
const byId = (id: string) => trip.items.find((i) => i.id === id)!;

test('the demo trip has no overlap markers', () => {
  assert.equal(overlapPartners(trip.items).size, 0);
  assert.equal(overlapTitles(overlapPartners(trip.items), 'demo-f1'), '');
});

test('both items in a clash are marked with each other; the items themselves are unchanged', () => {
  const clash: Item = { ...byId('demo-t1'), id: 'x-bus', kind: 'bus', title: 'Airport bus', start: { local: '2026-11-07T13:00', tz: 'Asia/Tokyo' }, end: { local: '2026-11-07T15:00', tz: 'Asia/Tokyo' } };
  const items = [...trip.items, clash];
  const before = JSON.stringify(items);
  const p = overlapPartners(items);
  assert.deepEqual(p.get('x-bus')?.map((i) => i.id), ['demo-t1']);
  assert.deepEqual(p.get('demo-t1')?.map((i) => i.id), ['x-bus']);
  assert.equal(overlapTitles(p, 'demo-t1'), 'Airport bus');
  assert.equal(p.get('demo-f1'), undefined);
  assert.equal(JSON.stringify(items), before);
});

test('an item clashing with two others lists both in time order', () => {
  const base = byId('demo-t1');
  const a: Item = { ...base, id: 'a', kind: 'activity', title: 'Tea', start: { local: '2026-11-20T10:00', tz: 'Asia/Tokyo' }, end: { local: '2026-11-20T13:00', tz: 'Asia/Tokyo' } };
  const b: Item = { ...base, id: 'b', kind: 'activity', title: 'Lunch', start: { local: '2026-11-20T12:00', tz: 'Asia/Tokyo' }, end: { local: '2026-11-20T13:30', tz: 'Asia/Tokyo' } };
  const c: Item = { ...base, id: 'c', kind: 'activity', title: 'Temple', start: { local: '2026-11-20T10:30', tz: 'Asia/Tokyo' }, end: { local: '2026-11-20T11:00', tz: 'Asia/Tokyo' } };
  const p = overlapPartners([b, a, c]);
  assert.deepEqual(p.get('a')?.map((i) => i.id), ['c', 'b']);
  assert.equal(overlapTitles(p, 'a'), 'Temple, Lunch');
  assert.deepEqual(p.get('b')?.map((i) => i.id), ['a']);
});

test('notes, missing end times and hire cars never get an overlap marker', () => {
  const base = byId('demo-t1');
  const act: Item = { ...base, id: 'act', kind: 'activity', title: 'Museum', start: { local: '2026-11-20T10:00', tz: 'Asia/Tokyo' }, end: undefined };
  const note: Item = { ...base, id: 'n', kind: 'note', title: 'Pack', start: { local: '2026-11-20T10:00', tz: 'Asia/Tokyo' }, end: { local: '2026-11-20T12:00', tz: 'Asia/Tokyo' } };
  const car: Item = { ...base, id: 'car', kind: 'car', title: 'Car', start: { local: '2026-11-20T09:00', tz: 'Asia/Tokyo' }, end: { local: '2026-11-21T09:00', tz: 'Asia/Tokyo' } };
  const tour: Item = { ...base, id: 'tour', kind: 'activity', title: 'Tour', start: { local: '2026-11-20T09:30', tz: 'Asia/Tokyo' }, end: { local: '2026-11-20T11:00', tz: 'Asia/Tokyo' } };
  assert.equal(overlapPartners([act, note, car, tour]).size, 0);
});
