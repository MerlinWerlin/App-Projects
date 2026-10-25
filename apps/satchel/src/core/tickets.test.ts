import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Attachment, Item, Trip } from './model.ts';
import {
  addAttachment,
  attachmentKind,
  defaultRole,
  extensionOf,
  filesOf,
  isSupportedFile,
  makeAttachment,
  mimeFor,
  primaryTicket,
  appRelativePath,
  isAppFile,
  rebaseAttachment,
  rebaseTrips,
  rebaseUri,
  tripFiles,
  itemFiles,
  removeAttachment,
  replaceAttachment,
  setQrCrop,
  splitWallet,
  ticketToShow,
  walletEntries,
} from './tickets.ts';
import { toUtc } from './tz.ts';

const att = (id: string, role: Attachment['role'], extra: Partial<Attachment> = {}): Attachment => ({
  id,
  uri: `file:///docs/attachments/${id}.pdf`,
  name: `${id}.pdf`,
  mime: 'application/pdf',
  role,
  ...extra,
});

const item = (id: string, x: Partial<Item> = {}): Item => ({
  id,
  tripId: 't1',
  kind: 'flight',
  title: id,
  start: { local: '2026-11-03T09:00', tz: 'Australia/Sydney' },
  attachments: [],
  ...x,
});

const trip = (id: string, name: string, items: Item[]): Trip => ({
  id,
  name,
  startDate: '2026-11-01',
  endDate: '2026-11-20',
  homeTz: 'Australia/Sydney',
  items: items.map((i) => ({ ...i, tripId: id })),
  createdAt: '2026-10-01T00:00:00Z',
});

test('mime and kind detection uses the picker type, falling back to the extension', () => {
  assert.equal(extensionOf('Boarding Pass.PDF'), 'pdf');
  assert.equal(extensionOf('file:///a/b/c.jpeg?x=1'), 'jpeg');
  assert.equal(extensionOf('README'), '');
  assert.equal(extensionOf('.hidden'), '');
  assert.equal(mimeFor('x.pdf', 'application/octet-stream'), 'application/pdf');
  assert.equal(mimeFor('x.bin', 'IMAGE/PNG'), 'image/png');
  assert.equal(mimeFor('IMG_0001.HEIC', undefined), 'image/heic');
  assert.equal(mimeFor('notes.txt', null), 'application/octet-stream');
  assert.equal(attachmentKind('application/pdf'), 'pdf');
  assert.equal(attachmentKind('image/jpeg'), 'image');
  assert.equal(attachmentKind('', 'scan.png'), 'image');
  assert.equal(attachmentKind('text/plain', 'notes.txt'), 'other');
  assert.ok(isSupportedFile('application/pdf'));
  assert.ok(!isSupportedFile('application/zip', 'a.zip'));
});

test('default role follows the booking kind', () => {
  assert.equal(defaultRole('flight'), 'ticket');
  assert.equal(defaultRole('train'), 'ticket');
  assert.equal(defaultRole('activity'), 'ticket');
  assert.equal(defaultRole('hotel'), 'booking');
  assert.equal(defaultRole('car'), 'booking');
  assert.equal(defaultRole('note'), 'other');
});

test('makeAttachment fills a name and mime when the picker gives none', () => {
  const a = makeAttachment({ id: 'att_abcdef123456', uri: 'file:///x/attachments/p.jpg', name: '', mime: null, kind: 'train' });
  assert.equal(a.mime, 'image/jpeg');
  assert.equal(a.role, 'ticket');
  assert.match(a.name, /^photo-123456\.jpg$/);
  assert.equal('qrCropUri' in a, false);
  const b = makeAttachment({ id: 'att_1', uri: 'file:///x/q.png', name: 'Pass.pdf', mime: 'application/pdf', kind: 'hotel', qrCropUri: 'file:///x/q.png' });
  assert.equal(b.name, 'Pass.pdf');
  assert.equal(b.role, 'booking');
  assert.equal(b.qrCropUri, 'file:///x/q.png');
});

test('add, replace, remove and crop never mutate the original item', () => {
  const base = item('i1');
  const frozen = JSON.stringify(base);
  const a1 = att('a1', 'ticket');
  const withOne = addAttachment(base, a1);
  assert.equal(withOne.attachments.length, 1);
  assert.equal(JSON.stringify(base), frozen);

  const withTwo = addAttachment(withOne, att('a2', 'other'));
  assert.deepEqual(withTwo.attachments.map((a) => a.id), ['a1', 'a2']);
  // adding the same id again replaces it in place
  const renamed = addAttachment(withTwo, { ...a1, name: 'renamed.pdf' });
  assert.deepEqual(renamed.attachments.map((a) => a.name), ['renamed.pdf', 'a2.pdf']);
  assert.equal(withTwo.attachments[0].name, 'a1.pdf');

  assert.equal(replaceAttachment(withTwo, att('zz', 'ticket')).attachments.length, 2);

  const cropped = setQrCrop(withTwo, 'a1', 'file:///docs/attachments/a1-qr.jpg');
  assert.equal(cropped.attachments[0].qrCropUri, 'file:///docs/attachments/a1-qr.jpg');
  assert.equal(withTwo.attachments[0].qrCropUri, undefined);
  const cleared = setQrCrop(cropped, 'a1', undefined);
  assert.equal('qrCropUri' in cleared.attachments[0], false);

  const removed = removeAttachment(withTwo, 'a1');
  assert.deepEqual(removed.attachments.map((a) => a.id), ['a2']);
  assert.equal(withTwo.attachments.length, 2);
});

test('filesOf lists the file and a separate crop once', () => {
  assert.deepEqual(filesOf(att('a', 'ticket')), ['file:///docs/attachments/a.pdf']);
  assert.deepEqual(filesOf(att('a', 'ticket', { qrCropUri: 'file:///q.jpg' })), ['file:///docs/attachments/a.pdf', 'file:///q.jpg']);
  const same = att('a', 'ticket');
  assert.deepEqual(filesOf({ ...same, qrCropUri: same.uri }), [same.uri]);
});

test('primary ticket prefers a QR crop, then a ticket, then a booking; other files alone are not tickets', () => {
  assert.equal(primaryTicket(item('i', { attachments: [] })), null);
  assert.equal(primaryTicket(item('i', { attachments: [att('o', 'other')] })), null);
  assert.equal(primaryTicket(item('i', { attachments: [att('b', 'booking'), att('t', 'ticket')] }))?.id, 't');
  assert.equal(primaryTicket(item('i', { attachments: [att('b', 'booking'), att('o', 'other')] }))?.id, 'b');
  assert.equal(primaryTicket(item('i', { attachments: [att('t', 'ticket'), att('o', 'other', { qrCropUri: 'file:///q' })] }))?.id, 'o');
  const it = item('i', { attachments: [att('t', 'ticket'), att('b', 'booking')] });
  assert.equal(ticketToShow(it, 'b')?.id, 'b');
  assert.equal(ticketToShow(it, 'missing')?.id, 't');
  assert.equal(ticketToShow(it)?.id, 't');
});

test('wallet lists tickets across trips by real time, with the trip name, skipping bookings without one', () => {
  // 08:00 Sydney (UTC+11 in November) is 21:00 UTC the day before, so it sorts ahead of 09:00 Tokyo (00:00 UTC)
  // even though its wall-clock date is the same.
  const tokyo = item('tokyo', { start: { local: '2026-11-05T09:00', tz: 'Asia/Tokyo' }, attachments: [att('a', 'ticket')] });
  const sydney = item('sydney', { start: { local: '2026-11-05T08:00', tz: 'Australia/Sydney' }, attachments: [att('b', 'ticket')] });
  const noTicket = item('plain', { start: { local: '2026-11-01T08:00', tz: 'UTC' } });
  const hotel = item('hotel', {
    kind: 'hotel',
    start: { local: '2026-11-10T15:00', tz: 'Asia/Tokyo' },
    end: { local: '2026-11-12T10:00', tz: 'Asia/Tokyo' },
    attachments: [att('c', 'booking')],
  });
  const list = walletEntries([trip('t1', 'Japan', [hotel, tokyo, noTicket]), trip('t2', 'Home', [sydney])]);
  assert.deepEqual(list.map((e) => e.key), ['sydney', 'tokyo', 'hotel']);
  assert.deepEqual(list.map((e) => e.tripName), ['Home', 'Japan', 'Japan']);
  assert.equal(list[2].ticket.id, 'c');
  assert.equal(list[2].end, toUtc(hotel.end!));
  // a ticket with no end time lasts zero minutes: nothing is invented
  assert.equal(list[0].end, list[0].start);
});

test('split: upcoming soonest first (including in-progress), past most recent first', () => {
  const mk = (id: string, start: string, end?: string): Item =>
    item(id, { start: { local: start, tz: 'UTC' }, end: end ? { local: end, tz: 'UTC' } : undefined, attachments: [att(`a${id}`, 'ticket')] });
  const list = walletEntries([
    trip('t', 'T', [mk('old', '2026-11-01T10:00'), mk('older', '2026-10-01T10:00'), mk('now', '2026-11-05T08:00', '2026-11-05T12:00'), mk('soon', '2026-11-06T10:00'), mk('later', '2026-11-09T10:00')]),
  ]);
  const now = Date.UTC(2026, 10, 5, 10, 0);
  const { upcoming, past } = splitWallet(list, now);
  assert.deepEqual(upcoming.map((e) => e.key), ['now', 'soon', 'later']);
  assert.deepEqual(past.map((e) => e.key), ['old', 'older']);
  // exactly at the start of a point-in-time ticket it is still upcoming
  assert.deepEqual(splitWallet(list, Date.UTC(2026, 10, 6, 10, 0)).upcoming.map((e) => e.key), ['soon', 'later']);
  assert.deepEqual(splitWallet([], now), { upcoming: [], past: [] });
});

test('rebaseUri moves stale documents URIs onto the current container and leaves others alone', () => {
  const now = 'file:///var/mobile/Containers/Data/Application/NEW/Documents/';
  const old = 'file:///var/mobile/Containers/Data/Application/OLD/Documents/attachments/a1-pass.pdf';
  assert.equal(rebaseUri(old, now), `${now}attachments/a1-pass.pdf`);
  assert.equal(rebaseUri(`${now}attachments/x.pdf`, now), `${now}attachments/x.pdf`);
  assert.equal(rebaseUri('file:///tmp/cache/attachments/x.pdf', now), 'file:///tmp/cache/attachments/x.pdf');
  assert.equal(rebaseUri(old, null), old);
  assert.equal(rebaseUri('https://example.com/attachments/x', now), 'https://example.com/attachments/x');
});

const NEW_DIR = 'file:///var/mobile/Containers/Data/Application/NEW/Documents/';
const OLD_DIR = 'file:///var/mobile/Containers/Data/Application/OLD/Documents/';

test('rebaseUri resolves stored relative paths and Android container paths', () => {
  assert.equal(rebaseUri('attachments/a1.pdf', NEW_DIR), `${NEW_DIR}attachments/a1.pdf`);
  assert.equal(rebaseUri('vault/d1-passport.jpg', NEW_DIR), `${NEW_DIR}vault/d1-passport.jpg`);
  assert.equal(rebaseUri('other/x.pdf', NEW_DIR), 'other/x.pdf');
  const android = 'file:///data/user/0/app.satchel/files/';
  assert.equal(rebaseUri('file:///data/user/0/app.old/files/vault/d.pdf', android), `${android}vault/d.pdf`);
  assert.equal(rebaseUri(`${OLD_DIR}vault/d1.jpg`, NEW_DIR), `${NEW_DIR}vault/d1.jpg`);
});

test('appRelativePath and isAppFile only accept our own folders under the documents dir', () => {
  assert.equal(appRelativePath(`${OLD_DIR}attachments/a1.pdf`, NEW_DIR), 'attachments/a1.pdf');
  assert.equal(appRelativePath(`${NEW_DIR}vault/d.pdf`, NEW_DIR), 'vault/d.pdf');
  assert.equal(appRelativePath('file:///tmp/cache/attachments/x.pdf', NEW_DIR), null);
  assert.equal(appRelativePath(`${NEW_DIR}notes.txt`, NEW_DIR), null);
  assert.equal(appRelativePath(`${NEW_DIR}attachments/../secret`, NEW_DIR), null);
  assert.equal(appRelativePath(`${NEW_DIR}attachments/a.pdf`, null), null);
  assert.equal(isAppFile(`${OLD_DIR}attachments/a1.pdf`, NEW_DIR), true);
  assert.equal(isAppFile('https://example.com/attachments/a.pdf', NEW_DIR), false);
});

test('rebaseAttachment moves the file and its crop, and returns the same object when nothing moved', () => {
  const a = att('a1', 'ticket', { uri: `${OLD_DIR}attachments/a1.pdf`, qrCropUri: `${OLD_DIR}attachments/a1-qr.jpg` });
  const b = rebaseAttachment(a, NEW_DIR);
  assert.equal(b.uri, `${NEW_DIR}attachments/a1.pdf`);
  assert.equal(b.qrCropUri, `${NEW_DIR}attachments/a1-qr.jpg`);
  assert.equal(a.uri, `${OLD_DIR}attachments/a1.pdf`, 'input untouched');
  assert.equal(rebaseAttachment(b, NEW_DIR), b);
  assert.equal(rebaseAttachment(a, null), a);
  const plain = rebaseAttachment(att('a2', 'ticket', { uri: `${OLD_DIR}attachments/a2.pdf` }), NEW_DIR);
  assert.equal('qrCropUri' in plain, false);
});

test('rebaseTrips rebases every booking file, keeps unchanged trips by reference and tolerates junk', () => {
  const moved = item('i1', { attachments: [att('a1', 'ticket', { uri: `${OLD_DIR}attachments/a1.pdf` })] });
  const fine = item('i2', { attachments: [att('a2', 'ticket', { uri: `${NEW_DIR}attachments/a2.pdf` })] });
  const t1 = trip('t1', 'One', [moved]);
  const t2 = trip('t2', 'Two', [fine]);
  const input = [t1, t2];
  const out = rebaseTrips(input, NEW_DIR);
  assert.notEqual(out, input);
  assert.equal(out[0].items[0].attachments[0].uri, `${NEW_DIR}attachments/a1.pdf`);
  assert.equal(out[1], t2);
  const same = rebaseTrips(out, NEW_DIR);
  assert.equal(same, out);
  assert.equal(rebaseTrips([t1], null)[0], t1);
  const junk = [{ id: 'j', items: 'x' }, { id: 'k', items: [{ id: 'z' }] }] as unknown as Trip[];
  assert.equal(rebaseTrips(junk, NEW_DIR), junk);
});

test('tripFiles lists every attachment and separate crop once', () => {
  const t = trip('t1', 'One', [
    item('i1', { attachments: [att('a1', 'ticket', { qrCropUri: 'file:///docs/attachments/a1-qr.jpg' }), att('a2', 'booking')] }),
    item('i2', { attachments: [att('a3', 'ticket', { qrCropUri: 'file:///docs/attachments/a3.pdf' })] }),
  ]);
  assert.deepEqual(tripFiles(t), [
    'file:///docs/attachments/a1.pdf',
    'file:///docs/attachments/a1-qr.jpg',
    'file:///docs/attachments/a2.pdf',
    'file:///docs/attachments/a3.pdf',
  ]);
  assert.deepEqual(tripFiles({ ...t, items: [] }), []);
});

test('itemFiles lists one booking’s attachments and separate crops once', () => {
  const i = item('i1', { attachments: [att('a1', 'ticket', { qrCropUri: 'file:///docs/attachments/a1-qr.jpg' }), att('a2', 'ticket', { qrCropUri: 'file:///docs/attachments/a2.pdf' })] });
  assert.deepEqual(itemFiles(i), ['file:///docs/attachments/a1.pdf', 'file:///docs/attachments/a1-qr.jpg', 'file:///docs/attachments/a2.pdf']);
  assert.deepEqual(itemFiles(item('i2')), []);
  assert.deepEqual(itemFiles({ ...item('i3'), attachments: undefined as unknown as Attachment[] }), []);
});
