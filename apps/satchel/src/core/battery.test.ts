import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  bannerState,
  clampThreshold,
  currentHotel,
  DEFAULT_THRESHOLD,
  dismissEpisode,
  isLow,
  NO_EPISODE,
  nextTicket,
  normaliseLevel,
  normalisePrefs,
  percent,
  setupTrip,
  stepEpisode,
  UNKNOWN_READING,
  type BatteryReading,
  type Episode,
} from './battery.ts';
import type { Attachment, Item, Trip } from './model.ts';
import { toUtc } from './tz.ts';

const r = (level: number | null, charging: boolean | null = false): BatteryReading => ({ level, charging, lowPower: null });
const TZ = 'Asia/Tokyo';
const at = (local: string) => toUtc({ local, tz: TZ });
const ticket: Attachment = { id: 'a1', uri: 'file:///docs/attachments/a1.pdf', name: 'a1.pdf', mime: 'application/pdf', role: 'ticket' };
const item = (id: string, kind: Item['kind'], start: string, end?: string, x: Partial<Item> = {}): Item => ({
  id,
  tripId: 't1',
  kind,
  title: id,
  start: { local: start, tz: TZ },
  ...(end ? { end: { local: end, tz: TZ } } : {}),
  attachments: [],
  ...x,
});
const trip = (items: Item[], x: Partial<Trip> = {}): Trip => ({
  id: 't1',
  name: 'Japan',
  startDate: '2026-11-01',
  endDate: '2026-11-10',
  homeTz: 'Australia/Sydney',
  items,
  createdAt: '2026-10-01T00:00:00Z',
  ...x,
});

test('threshold defaults to 20% and is clamped to a sensible range', () => {
  assert.equal(DEFAULT_THRESHOLD, 0.2);
  assert.equal(clampThreshold(0.15), 0.15);
  assert.equal(clampThreshold(0), 0.05);
  assert.equal(clampThreshold(0.9), 0.5);
  assert.equal(clampThreshold(Number.NaN), 0.2);
  assert.equal(clampThreshold('0.3'), 0.2);
});

test('battery level -1 (simulator) and out-of-range values are unknown, never guessed', () => {
  assert.equal(normaliseLevel(-1), null);
  assert.equal(normaliseLevel(1.2), null);
  assert.equal(normaliseLevel(Number.NaN), null);
  assert.equal(normaliseLevel(undefined), null);
  assert.equal(normaliseLevel(0.42), 0.42);
  assert.equal(normaliseLevel(0), 0);
  assert.equal(percent(0.183), 18);
  assert.equal(percent(null), null);
});

test('low means at or below the threshold and not charging', () => {
  assert.equal(isLow(r(0.2)), true);
  assert.equal(isLow(r(0.19)), true);
  assert.equal(isLow(r(0.21)), false);
  assert.equal(isLow(r(0.1, true)), false, 'charging is never low');
  assert.equal(isLow(r(0.1, null)), true, 'unknown charging state counts as not charging');
  assert.equal(isLow(r(null)), false, 'unknown level is never low');
  assert.equal(isLow(r(0.25), 0.3), true, 'custom threshold');
});

test('a low episode starts fresh, survives jitter around the threshold and ends on recovery or charging', () => {
  let e: Episode = NO_EPISODE;
  e = stepEpisode(e, r(0.5));
  assert.deepEqual(e, NO_EPISODE);
  e = stepEpisode(e, r(0.2));
  assert.deepEqual(e, { low: true, dismissed: false });
  e = dismissEpisode(e);
  assert.deepEqual(e, { low: true, dismissed: true });
  e = stepEpisode(e, r(0.21));
  assert.deepEqual(e, { low: true, dismissed: true }, '21% is jitter, not recovery: stays dismissed');
  e = stepEpisode(e, r(0.19));
  assert.equal(e.dismissed, true, 'still the same episode');
  e = stepEpisode(e, r(0.23));
  assert.deepEqual(e, NO_EPISODE, 'climbing past threshold + margin ends the episode');
  e = stepEpisode(e, r(0.18));
  assert.deepEqual(e, { low: true, dismissed: false }, 'a new drop offers again');
  e = stepEpisode(dismissEpisode(e), r(0.18, true));
  assert.deepEqual(e, NO_EPISODE, 'plugging in ends the episode');
});

test('an unknown reading keeps the episode as it is (no inference), but charging still ends it', () => {
  const low: Episode = { low: true, dismissed: true };
  assert.deepEqual(stepEpisode(low, UNKNOWN_READING), low);
  assert.deepEqual(stepEpisode(NO_EPISODE, UNKNOWN_READING), NO_EPISODE);
  assert.deepEqual(stepEpisode(low, r(null, true)), NO_EPISODE);
});

test('dismissing outside a low episode does nothing', () => {
  assert.deepEqual(dismissEpisode(NO_EPISODE), NO_EPISODE);
});

test('banner: manual switch wins, offer only in an undismissed low episode, nothing when unknown', () => {
  const off = { manual: false, threshold: 0.2 };
  const on = { manual: true, threshold: 0.2 };
  const low: Episode = { low: true, dismissed: false };
  assert.deepEqual(bannerState(off, low, r(0.17)), { kind: 'offer', percent: 17 });
  assert.deepEqual(bannerState(off, dismissEpisode(low), r(0.17)), { kind: 'none' });
  assert.deepEqual(bannerState(off, NO_EPISODE, r(0.5)), { kind: 'none' });
  assert.deepEqual(bannerState(off, low, UNKNOWN_READING), { kind: 'none' }, 'unknown level: never offer');
  assert.deepEqual(bannerState(on, NO_EPISODE, r(0.9)), { kind: 'manual' }, 'manual regardless of battery');
  assert.deepEqual(bannerState(on, NO_EPISODE, UNKNOWN_READING), { kind: 'manual' }, 'manual works without battery status');
});

test('automatic episodes never change the manual preference', () => {
  const prefs = normalisePrefs({ manual: true, threshold: 0.2 });
  // stepEpisode / dismissEpisode only take and return episodes; the prefs object is untouched.
  stepEpisode(NO_EPISODE, r(0.9));
  assert.deepEqual(prefs, { manual: true, threshold: 0.2 });
});

test('stored prefs are normalised', () => {
  assert.deepEqual(normalisePrefs(null), { manual: false, threshold: 0.2 });
  assert.deepEqual(normalisePrefs({ manual: 'yes', threshold: 2 }), { manual: false, threshold: 0.5 });
  assert.deepEqual(normalisePrefs({ manual: true }), { manual: true, threshold: 0.2 });
});

test('next ticket: the booking happening now or next, ticket files preferred, hotels and notes excluded', () => {
  const now = at('2026-11-03T08:00');
  const past = item('past', 'flight', '2026-11-02T09:00', '2026-11-02T12:00', { attachments: [ticket] });
  const hotel = item('hotel', 'hotel', '2026-11-03T15:00', '2026-11-05T11:00', { attachments: [{ ...ticket, role: 'booking' }] });
  const note = item('note', 'note', '2026-11-03T09:00');
  const train = item('train', 'train', '2026-11-03T10:00', '2026-11-03T12:15');
  const museum = item('museum', 'activity', '2026-11-03T14:00', '2026-11-03T16:00', { attachments: [ticket] });
  const pick = nextTicket([trip([past, hotel, note, museum, train])], now);
  assert.equal(pick?.item.id, 'train', 'a transport booking without a file still counts');
  assert.equal(pick?.hasTicket, false);
  assert.equal(pick?.state, 'next');

  const trainWithFile = item('train2', 'train', '2026-11-03T10:00', '2026-11-03T12:15', { attachments: [ticket] });
  assert.equal(nextTicket([trip([train, trainWithFile])], now)?.item.id, 'train2', 'same time: the one with a file wins');

  const activityNoFile = item('walk', 'activity', '2026-11-03T09:00');
  assert.equal(nextTicket([trip([activityNoFile, museum])], now)?.item.id, 'museum', 'activities need a ticket file');
});

test('next ticket: something happening now counts as now; finished and point-in-time past items do not', () => {
  const now = at('2026-11-03T11:00');
  const train = item('train', 'train', '2026-11-03T10:00', '2026-11-03T12:15');
  assert.deepEqual(nextTicket([trip([train])], now)?.state, 'now');
  const bus = item('bus', 'bus', '2026-11-03T09:00');
  assert.equal(nextTicket([trip([bus])], now), null);
  assert.equal(nextTicket([], now), null);
});

test('hotel: the stay you are in now, else the next one; address presence reported', () => {
  const now = at('2026-11-04T20:00');
  const done = item('h0', 'hotel', '2026-11-01T15:00', '2026-11-03T11:00', { place: { id: 'p0', name: 'Old', address: '1 Road' } });
  const cur = item('h1', 'hotel', '2026-11-03T15:00', '2026-11-06T11:00', { place: { id: 'p1', name: 'Kyoto Inn', localAddress: '京都市' } });
  const later = item('h2', 'hotel', '2026-11-06T15:00', '2026-11-08T11:00');
  assert.deepEqual(
    (({ item: i, ...rest }) => ({ id: i.id, ...rest }))(currentHotel([trip([done, later, cur])], now)!),
    { id: 'h1', tripId: 't1', hasAddress: true, state: 'now' },
  );
  const before = at('2026-11-02T20:00');
  const pickNext = currentHotel([trip([cur, later])], before);
  assert.equal(pickNext?.item.id, 'h1');
  assert.equal(pickNext?.state, 'next');
  const afterAll = at('2026-11-09T12:00');
  assert.equal(currentHotel([trip([done, cur, later])], afterAll), null);
  assert.equal(currentHotel([trip([later])], at('2026-11-07T00:00'))?.hasAddress, false);
});

test('hotel: overlapping stays pick the most recent check-in', () => {
  const now = at('2026-11-04T20:00');
  const a = item('a', 'hotel', '2026-11-02T15:00', '2026-11-06T11:00');
  const b = item('b', 'hotel', '2026-11-04T15:00', '2026-11-05T11:00');
  assert.equal(currentHotel([trip([a, b])], now)?.item.id, 'b');
});

test('setup trip: the trip on now or next, never a past one', () => {
  const past = trip([], { id: 'p', startDate: '2026-09-01', endDate: '2026-09-05' });
  const soon = trip([], { id: 's', startDate: '2026-12-01', endDate: '2026-12-05' });
  const live = trip([], { id: 'l', startDate: '2026-10-20', endDate: '2026-10-30' });
  assert.equal(setupTrip([past, soon, live], '2026-10-24')?.id, 'l');
  assert.equal(setupTrip([past], '2026-10-24'), null);
});
