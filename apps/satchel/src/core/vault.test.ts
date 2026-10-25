import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Attachment, TravelDoc } from './model.ts';
import {
  rebaseDocs,
  addMonths,
  cleanDocs,
  docFromDraft,
  droppedFiles,
  expiryOf,
  expiryStatus,
  formatExpiry,
  isLocalDate,
  LOCKED,
  lockReducer,
  mimeFor,
  newDocDraft,
  RELOCK_AFTER_MS,
  removeDoc,
  requiresUnlock,
  sortDocs,
  tripWarnings,
  upsertDoc,
  validateDoc,
  vaultSummary,
  type LockState,
  type TripRef,
} from './vault.ts';

const TODAY = '2026-10-24';
const doc = (id: string, kind: TravelDoc['kind'], expires?: string, label = id): TravelDoc => ({ id, kind, label, expires, attachments: [] });
const att = (uri: string): Attachment => ({ id: uri, uri, name: 'x.jpg', mime: 'image/jpeg', role: 'other' });

test('isLocalDate accepts only real YYYY-MM-DD dates', () => {
  assert.ok(isLocalDate('2026-10-24'));
  assert.ok(isLocalDate('2028-02-29'));
  assert.equal(isLocalDate('2027-02-29'), false);
  assert.equal(isLocalDate('2026-13-01'), false);
  assert.equal(isLocalDate('2026-1-01'), false);
  assert.equal(isLocalDate('24/10/2026'), false);
  assert.equal(isLocalDate(''), false);
});

test('addMonths clamps to the end of shorter months and crosses years', () => {
  assert.equal(addMonths('2026-08-31', 6), '2027-02-28');
  assert.equal(addMonths('2027-08-31', 6), '2028-02-29');
  assert.equal(addMonths('2026-11-15', 6), '2027-05-15');
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
});

test('expiry status: expired, soon (<= 90 days, incl. today), ok, none', () => {
  assert.deepEqual(expiryOf(doc('a', 'passport', '2026-10-23'), TODAY), { status: 'expired', days: -1 });
  assert.deepEqual(expiryOf(doc('a', 'passport', TODAY), TODAY), { status: 'soon', days: 0 });
  assert.equal(expiryStatus(doc('a', 'visa', '2027-01-22'), TODAY), 'soon'); // 90 days
  assert.equal(expiryStatus(doc('a', 'visa', '2027-01-23'), TODAY), 'ok'); // 91 days
  assert.equal(expiryStatus(doc('a', 'licence'), TODAY), 'none');
  assert.equal(expiryStatus(doc('a', 'licence', 'garbage'), TODAY), 'none');
});

test('expiry status counts calendar days across a DST change', () => {
  // Europe and US clocks change in late Oct / early Nov; calendar days must not drift.
  assert.deepEqual(expiryOf(doc('a', 'visa', '2026-11-05'), TODAY), { status: 'soon', days: 12 });
});

const trip = (id: string, startDate: string, endDate: string, demo = false): TripRef => ({ id, name: `Trip ${id}`, startDate, endDate, demo });

test('passport 6-month reminder against each upcoming trip end date', () => {
  const trips = [trip('jp', '2026-11-03', '2026-11-11'), trip('past', '2026-01-01', '2026-01-10'), trip('fr', '2027-03-01', '2027-03-20')];
  // Valid through both trips, but < 6 months after the Japan trip ends (2027-05-11) and the France trip (2027-09-20).
  const w = tripWarnings(doc('p', 'passport', '2027-04-01'), trips, TODAY);
  assert.deepEqual(
    w.map((x) => [x.tripId, x.kind]),
    [
      ['jp', 'six-months'],
      ['fr', 'six-months'],
    ],
  );
  // Exactly 6 months after the last trip end is fine.
  assert.deepEqual(tripWarnings(doc('p', 'passport', '2027-09-20'), trips, TODAY), []);
  // One day short is not.
  assert.equal(tripWarnings(doc('p', 'passport', '2027-09-19'), trips, TODAY).length, 1);
});

test('a document that expires during or before a trip ends warns for any kind', () => {
  const trips = [trip('jp', '2026-11-03', '2026-11-11')];
  assert.deepEqual(
    tripWarnings(doc('v', 'visa', '2026-11-08'), trips, TODAY).map((x) => x.kind),
    ['during-trip'],
  );
  assert.deepEqual(
    tripWarnings(doc('p', 'passport', '2026-11-01'), trips, TODAY).map((x) => x.kind),
    ['during-trip'],
  );
  // Visas get no 6-month reminder.
  assert.deepEqual(tripWarnings(doc('v', 'visa', '2026-12-01'), trips, TODAY), []);
});

test('trip warnings skip past trips, demo trips, expired docs and docs with no expiry', () => {
  const trips = [trip('demo', '2026-10-27', '2026-11-04', true), trip('old', '2026-09-01', '2026-09-05')];
  assert.deepEqual(tripWarnings(doc('p', 'passport', '2026-12-01'), trips, TODAY), []);
  const real = [trip('jp', '2026-11-03', '2026-11-11')];
  assert.deepEqual(tripWarnings(doc('p', 'passport', '2026-10-01'), real, TODAY), []);
  assert.deepEqual(tripWarnings(doc('p', 'passport'), real, TODAY), []);
  // A trip on now (ends later) still counts.
  assert.equal(tripWarnings(doc('p', 'passport', '2026-12-01'), [trip('now', '2026-10-20', '2026-10-30')], TODAY).length, 1);
});

test('sort: expired, then soon (earliest first), then kind order passport, visa, licence, insurance, other', () => {
  const docs = [
    doc('other', 'other'),
    doc('ins', 'insurance', '2030-01-01'),
    doc('lic', 'licence'),
    doc('soonLate', 'licence', '2027-01-10'),
    doc('pass', 'passport', '2031-05-05'),
    doc('exp', 'visa', '2026-01-01'),
    doc('soonEarly', 'insurance', '2026-11-01'),
    doc('visaB', 'visa', undefined, 'B'),
    doc('visaA', 'visa', undefined, 'A'),
  ];
  assert.deepEqual(
    sortDocs(docs, TODAY).map((d) => d.id),
    ['exp', 'soonEarly', 'soonLate', 'pass', 'visaA', 'visaB', 'lic', 'ins', 'other'],
  );
  assert.equal(docs[0].id, 'other', 'input not mutated');
});

test('summary carries counts only', () => {
  const s = vaultSummary(
    [doc('a', 'passport', '2026-01-01'), doc('b', 'visa', '2026-11-30'), doc('c', 'licence', '2030-01-01'), doc('d', 'other')],
    [trip('jp', '2026-11-03', '2026-12-11')],
    TODAY,
  );
  assert.deepEqual(s, { total: 4, expired: 1, soon: 1, tripWarnings: 1 });
  assert.deepEqual(Object.keys(s).sort(), ['expired', 'soon', 'total', 'tripWarnings']);
});

test('form validation: label required, expiry optional but must be a real date', () => {
  const d = newDocDraft();
  assert.deepEqual(validateDoc(d), ['label']);
  assert.deepEqual(validateDoc({ ...d, label: '  ' }), ['label']);
  assert.deepEqual(validateDoc({ ...d, label: 'My passport' }), []);
  assert.deepEqual(validateDoc({ ...d, label: 'My passport', expires: '2027-02-30' }), ['expires']);
  assert.deepEqual(validateDoc({ ...d, label: 'My passport', expires: 'next year' }), ['expires']);
  assert.deepEqual(validateDoc({ ...d, label: 'My passport', expires: ' 2027-02-28 ' }), []);
});

test('docFromDraft trims and drops an empty expiry; upsert / remove / droppedFiles', () => {
  const a = docFromDraft({ kind: 'visa', label: '  Japan visa ', expires: ' ', attachments: [] }, 'v1');
  assert.deepEqual(a, { id: 'v1', kind: 'visa', label: 'Japan visa', attachments: [] });
  assert.equal(docFromDraft({ kind: 'visa', label: 'x', expires: '2027-01-01', attachments: [] }, 'v1').expires, '2027-01-01');
  let list = upsertDoc([], a);
  list = upsertDoc(list, { ...a, label: 'Renamed' });
  assert.equal(list.length, 1);
  assert.equal(list[0].label, 'Renamed');
  assert.deepEqual(removeDoc(list, 'v1'), []);
  assert.deepEqual(droppedFiles([att('f1'), att('f2')], [att('f2'), att('f3')]), ['f1']);
});

test('formatExpiry shows the written calendar date with the year', () => {
  assert.equal(formatExpiry('2031-05-14', 'en-GB'), '14 May 2031');
  assert.match(formatExpiry('2031-01-01', 'en'), /2031/);
  assert.equal(formatExpiry('bad'), 'bad');
});

test('mimeFor trusts the picker, else guesses from the extension', () => {
  assert.equal(mimeFor('scan.PDF'), 'application/pdf');
  assert.equal(mimeFor('IMG_1.HEIC'), 'image/heic');
  assert.equal(mimeFor('photo.jpg', 'image/png'), 'image/png');
  assert.equal(mimeFor('noext'), 'application/octet-stream');
});

test('cleanDocs repairs or drops whatever storage returned', () => {
  assert.deepEqual(cleanDocs(null), []);
  assert.deepEqual(cleanDocs({}), []);
  const out = cleanDocs([
    { id: 'a', kind: 'passport', label: 'P', expires: '2027-01-01', attachments: [att('u'), { junk: 1 }] },
    { id: 'b', kind: 'spaceship', label: 4, expires: 'soon' },
    { kind: 'visa' },
    'nope',
  ]);
  assert.equal(out.length, 2);
  assert.equal(out[0].attachments.length, 1);
  assert.deepEqual(out[1], { id: 'b', kind: 'other', label: '', attachments: [] });
});

test('lock: starts locked, unlocks, Lock and leaving the vault relock', () => {
  assert.ok(requiresUnlock(LOCKED));
  const open = lockReducer(LOCKED, { type: 'unlocked' });
  assert.equal(requiresUnlock(open), false);
  assert.equal(open.unprotected, false);
  assert.ok(requiresUnlock(lockReducer(open, { type: 'lock' })));
  assert.ok(requiresUnlock(lockReducer(open, { type: 'leave' })));
  assert.equal(lockReducer(LOCKED, { type: 'unlocked', unprotected: true }).unprotected, true);
});

test('lock: background for more than 60 s relocks; 60 s or less does not', () => {
  const open = lockReducer(LOCKED, { type: 'unlocked' });
  const away = lockReducer(open, { type: 'background', at: 1_000 });
  assert.equal(requiresUnlock(away), false, 'not locked while away (Face ID sheet etc. never sends background)');
  const quick = lockReducer(away, { type: 'active', at: 1_000 + RELOCK_AFTER_MS });
  assert.equal(requiresUnlock(quick), false);
  assert.equal(quick.backgroundAt, null);
  assert.ok(requiresUnlock(lockReducer(away, { type: 'active', at: 1_000 + RELOCK_AFTER_MS + 1 })));
  // Repeated background events keep the first time.
  const twice = lockReducer(away, { type: 'background', at: 50_000 });
  assert.ok(requiresUnlock(lockReducer(twice, { type: 'active', at: 62_000 })));
  // A clock that went backwards relocks.
  assert.ok(requiresUnlock(lockReducer(away, { type: 'active', at: 500 })));
});

test('lock: background / active while locked change nothing; active without background is a no-op', () => {
  const s: LockState = lockReducer(LOCKED, { type: 'background', at: 1 });
  assert.deepEqual(s, LOCKED);
  const open = lockReducer(LOCKED, { type: 'unlocked' });
  assert.equal(lockReducer(open, { type: 'active', at: 10 }), open);
});

test('rebaseDocs moves vault files onto the current documents folder and keeps unchanged docs by reference', () => {
  const NEW = 'file:///var/mobile/Containers/Data/Application/NEW/Documents/';
  const OLD = 'file:///var/mobile/Containers/Data/Application/OLD/Documents/';
  const file = (id: string, uri: string): Attachment => ({ id, uri, name: `${id}.jpg`, mime: 'image/jpeg', role: 'other' });
  const moved: TravelDoc = { id: 'd1', kind: 'passport', label: 'Passport', attachments: [file('f1', `${OLD}vault/f1.jpg`)] };
  const fine: TravelDoc = { id: 'd2', kind: 'visa', label: 'Visa', attachments: [file('f2', `${NEW}vault/f2.jpg`)] };
  const relative: TravelDoc = { id: 'd3', kind: 'other', label: 'Card', attachments: [file('f3', 'vault/f3.jpg')] };
  const input = [moved, fine, relative];
  const out = rebaseDocs(input, NEW);
  assert.equal(out[0].attachments[0].uri, `${NEW}vault/f1.jpg`);
  assert.equal(out[1], fine);
  assert.equal(out[2].attachments[0].uri, `${NEW}vault/f3.jpg`);
  assert.equal(moved.attachments[0].uri, `${OLD}vault/f1.jpg`, 'input untouched');
  assert.equal(rebaseDocs(out, NEW), out);
  assert.equal(rebaseDocs(input, null), input);
});
