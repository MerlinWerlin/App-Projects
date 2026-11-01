// T123 run-100 follow-ups (offline parts): help-card photo cleanup on an unsaved dismiss, driving lines in Low-battery
// essentials, and the car due back today on Your day.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { DrivingRow, DrivingTable } from './driving.ts';
import { carDueBack, essentialsDriving, unsavedHelpPhotos } from './followups100.ts';
import type { Item, Trip } from './model.ts';
import { toUtc } from './tz.ts';

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

// ------------------------------------------------------------------ 1) help-card photo cleanup

test('unsavedHelpPhotos: every copy picked this visit goes, once each', () => {
  assert.deepEqual(unsavedHelpPhotos(['attachments/a.jpg', 'attachments/b.jpg', 'attachments/a.jpg'], []), ['attachments/a.jpg', 'attachments/b.jpg']);
  assert.deepEqual(unsavedHelpPhotos([], ['attachments/old.jpg']), []);
  assert.deepEqual(unsavedHelpPhotos(['', 'attachments/a.jpg'], [null, undefined, '']), ['attachments/a.jpg']);
});

test('unsavedHelpPhotos: the saved card photo and a photo a save is writing are never deleted', () => {
  // Editing a card with a saved photo, then replacing it twice and swiping away: only the two new copies go.
  assert.deepEqual(unsavedHelpPhotos(['attachments/n1.jpg', 'attachments/n2.jpg'], ['attachments/old.jpg']), ['attachments/n1.jpg', 'attachments/n2.jpg']);
  // A picked path that matches the saved card's (should not happen, but never delete it).
  assert.deepEqual(unsavedHelpPhotos(['attachments/old.jpg', 'attachments/n1.jpg'], ['attachments/old.jpg']), ['attachments/n1.jpg']);
  // A save in flight keeps the photo it is writing.
  assert.deepEqual(unsavedHelpPhotos(['attachments/n1.jpg', 'attachments/n2.jpg'], ['attachments/old.jpg', 'attachments/n2.jpg']), ['attachments/n1.jpg']);
});

test('helpcard-edit cleans up on unmount through unsavedHelpPhotos, keeping the saved photo', () => {
  const src = read('app/helpcard-edit.tsx');
  assert.match(src, /unsavedHelpPhotos\(/);
  assert.match(src, /useEffect\(/);
  assert.match(src, /savedPhoto\.current/);
});

// ------------------------------------------------------------------ 2) essentials driving

const row = (o: Partial<DrivingRow>): DrivingRow => ({
  iso2: 'JP',
  country: 'Japan',
  side: 'left',
  speed: 'kmh',
  idp: 'often',
  seatbelts: null,
  phone: null,
  fuel: null,
  tolls: null,
  note: null,
  sources: ['https://www.gov.uk/foreign-travel-advice/japan'],
  checked: '2026-11-01',
  recheck: false,
  ...o,
});
const TABLE: DrivingTable = {
  version: 1,
  rule: 'verify locally',
  countries: [row({}), row({ iso2: 'GB', country: 'United Kingdom', speed: 'mph' }), row({ iso2: 'FR', country: 'France', side: 'right' })],
};

const item = (id: string, kind: Item['kind'], start: [string, string], end?: [string, string]): Item => ({
  id,
  tripId: 't',
  kind,
  title: id,
  start: { local: start[0], tz: start[1] },
  ...(end ? { end: { local: end[0], tz: end[1] } } : {}),
  attachments: [],
});
const trip = (id: string, startDate: string, endDate: string, items: Item[], homeTz = 'Europe/London'): Trip => ({
  id,
  name: id,
  startDate,
  endDate,
  homeTz,
  items: items.map((i) => ({ ...i, tripId: id })),
  createdAt: '2026-10-01T00:00:00Z',
});

test('essentialsDriving: the trip on now with a car abroad gives its side and unit', () => {
  const japan = trip('jp', '2026-11-01', '2026-11-08', [item('c1', 'car', ['2026-11-02T09:00', 'Asia/Tokyo'], ['2026-11-05T10:00', 'Asia/Tokyo'])]);
  const r = essentialsDriving([japan], '2026-11-03', TABLE, () => 'GB');
  assert.equal(r?.tripId, 'jp');
  assert.deepEqual(
    r?.banners.map((b) => [b.iso2, b.side, b.speed]),
    [['JP', 'left', 'kmh']],
  );
});

test('essentialsDriving: the next trip when none is on; nothing without a car, at home, or uncovered', () => {
  const france = trip('fr', '2026-12-01', '2026-12-05', [item('c2', 'car', ['2026-12-01T09:00', 'Europe/Paris'], ['2026-12-04T09:00', 'Europe/Paris'])]);
  assert.equal(essentialsDriving([france], '2026-11-03', TABLE)?.banners[0].side, 'right');
  // The trip on now has no car: its lines are what the screen is about, so no driving section (not the later trip's).
  const now = trip('now', '2026-11-01', '2026-11-08', [item('f', 'flight', ['2026-11-01T09:00', 'Europe/London'], ['2026-11-01T20:00', 'Asia/Tokyo'])]);
  assert.equal(essentialsDriving([now, france], '2026-11-03', TABLE), null);
  // A car at home is left out.
  const home = trip('uk', '2026-11-01', '2026-11-04', [item('c3', 'car', ['2026-11-01T09:00', 'Europe/London'], ['2026-11-03T09:00', 'Europe/London'])]);
  assert.equal(essentialsDriving([home], '2026-11-02', TABLE, () => 'GB'), null);
  // A country the guide doesn't cover.
  const nz = trip('nz', '2026-11-01', '2026-11-04', [item('c4', 'car', ['2026-11-01T09:00', 'Pacific/Auckland'], ['2026-11-03T09:00', 'Pacific/Auckland'])]);
  assert.equal(essentialsDriving([nz], '2026-11-02', TABLE), null);
  assert.equal(essentialsDriving([], '2026-11-02', TABLE), null);
});

test('essentials screen shows the driving section and opens the guide', () => {
  assert.match(read('app/essentials.tsx'), /EssentialsDriving/);
  const ui = read('src/ui/followups100.tsx');
  assert.match(ui, /essentialsDriving\(/);
  assert.match(ui, /pathname: '\/driving\/\[iso2\]'/);
});

// ------------------------------------------------------------------ 3) car due back today

test('carDueBack: the car whose drop-off is today where you are and not yet passed', () => {
  const t = trip('jp', '2026-11-01', '2026-11-08', [
    item('c1', 'car', ['2026-11-02T09:00', 'Asia/Tokyo'], ['2026-11-05T10:00', 'Asia/Tokyo']),
    item('h', 'hotel', ['2026-11-02T15:00', 'Asia/Tokyo'], ['2026-11-05T11:00', 'Asia/Tokyo']),
  ]);
  const morning = toUtc({ local: '2026-11-05T07:00', tz: 'Asia/Tokyo' });
  assert.equal(carDueBack(t, 'Asia/Tokyo', '2026-11-05', morning)?.id, 'c1');
  // The day before, and after the drop-off time: nothing.
  assert.equal(carDueBack(t, 'Asia/Tokyo', '2026-11-04', toUtc({ local: '2026-11-04T07:00', tz: 'Asia/Tokyo' })), null);
  assert.equal(carDueBack(t, 'Asia/Tokyo', '2026-11-05', toUtc({ local: '2026-11-05T10:01', tz: 'Asia/Tokyo' })), null);
  // A car with no drop-off has nothing to return by.
  const open = trip('o', '2026-11-01', '2026-11-08', [item('c2', 'car', ['2026-11-05T09:00', 'Asia/Tokyo'])]);
  assert.equal(carDueBack(open, 'Asia/Tokyo', '2026-11-05', morning), null);
});

test('carDueBack: earliest of two; the day is read in your zone by real instants', () => {
  const t = trip('two', '2026-11-01', '2026-11-08', [
    item('late', 'car', ['2026-11-02T09:00', 'Europe/Paris'], ['2026-11-05T18:00', 'Europe/Paris']),
    item('early', 'car', ['2026-11-03T09:00', 'Europe/Paris'], ['2026-11-05T09:00', 'Europe/Paris']),
  ]);
  const at = toUtc({ local: '2026-11-05T07:00', tz: 'Europe/Paris' });
  assert.equal(carDueBack(t, 'Europe/Paris', '2026-11-05', at)?.id, 'early');
  // 00:30 Paris on the 6th is still the 5th in London (23:30): due back "today" for someone reading London's day.
  const edge = trip('edge', '2026-11-01', '2026-11-08', [item('c', 'car', ['2026-11-02T09:00', 'Europe/Paris'], ['2026-11-06T00:30', 'Europe/Paris'])]);
  assert.equal(carDueBack(edge, 'Europe/London', '2026-11-05', at)?.id, 'c');
  assert.equal(carDueBack(edge, 'Europe/Paris', '2026-11-05', at), null);
});

test('Your day card shows the rental leave-by row and it opens the checklist', () => {
  assert.match(read('src/ui/DayBriefCard.tsx'), /RentalBriefRow/);
  const ui = read('src/ui/followups100.tsx');
  assert.match(ui, /returnPlan\(/);
  assert.match(ui, /driving\.return\.leaveBy/);
  assert.match(ui, /pathname: '\/rental\/\[itemId\]'/);
});
