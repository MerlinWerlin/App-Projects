// T17 backup and restore: round trip (every key back, files byte-identical), newer / damaged files refused,
// Merge keeps both sides by id, Replace, transient keys left out, documents only when switched on, the reminder.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import {
  BACKUP_STATE_KEY,
  BACKUP_VERSION,
  backupFileName,
  backupParts,
  backupPreview,
  backupReminderTrip,
  buildBackup,
  cleanFilePath,
  DEFAULT_BACKUP_STATE,
  fileEntry,
  mergeStored,
  moveDocPaths,
  normaliseBackupState,
  parseBackup,
  planRestore,
  serializeBackup,
  sha256Hex,
  shouldBackUpKey,
  TRANSIENT_KEYS,
  TRANSIENT_PREFIXES,
  type BackupMeta,
} from './backup.ts';
import { bytesToBase64 } from './tar.ts';

const OLD = 'file:///var/mobile/Containers/Data/Application/OLD/Documents/';
const NEW = 'file:///var/mobile/Containers/Data/Application/NEW/Documents/';

const trip = (id: string, extra: Record<string, unknown> = {}) => ({ id, name: `Trip ${id}`, startDate: '2026-11-05', endDate: '2026-11-09', homeTz: 'Australia/Sydney', createdAt: '2026-10-01T00:00:00Z', items: [{ id: `${id}-i1`, attachments: [{ id: 'a1', uri: `${OLD}attachments/a1-pass.pdf` }] }], ...extra });

const STORE: [string, string][] = [
  ['satchel.trips.v1', JSON.stringify([trip('t1'), trip('t2')])],
  ['satchel.packing.v1', JSON.stringify({ lists: { t1: { items: [{ id: 'p1', label: 'Socks' }] } } })],
  ['satchel.emergency.v1', JSON.stringify({ contacts: [{ id: 'c1', name: 'Sam' }], medical: 'none' })],
  ['satchel.prefs.v1', JSON.stringify({ haptics: false })],
  ['satchel.stay.v1.t1-i1', JSON.stringify({ wifi: 'Hotel' })],
  ['satchel.seeded.v1', '1'],
  ['satchel.vault.v1', JSON.stringify([{ id: 'd1', kind: 'passport', file: `${OLD}vault/d1-passport.jpg` }])],
  ['satchel.weather.v1.-33.87,151.21', JSON.stringify({ fetched: 1 })],
  ['satchel.trips.v1.unreadable', 'garbage'],
  [BACKUP_STATE_KEY, JSON.stringify({ lastAt: '2026-10-01T00:00:00Z' })],
  ['other.app.key', 'x'],
];

const bytes = (n: number, seed: number) => Uint8Array.from({ length: n }, (_, i) => (i * 31 + seed * 7) & 0xff);
const FILES = [
  { path: 'attachments/a1-pass.pdf', base64: bytesToBase64(bytes(5000, 1)) },
  { path: 'attachments/empty.txt', base64: '' },
  { path: 'vault/d1-passport.jpg', base64: bytesToBase64(bytes(777, 2)) },
  { path: 'maps/sydney/0/0/0.pbf', base64: bytesToBase64(bytes(10, 3)) },
  { path: 'attachments/../escape.txt', base64: 'AAAA' },
];
const meta = (includeDocuments: boolean): BackupMeta => ({ app: '0.1.0', created: '2026-11-01T09:00:00.000Z', docDir: OLD, includeDocuments });

test('sha256Hex matches node crypto (empty, block edges, long)', () => {
  for (const n of [0, 1, 55, 56, 63, 64, 65, 119, 120, 1000, 70_001]) {
    const b = bytes(n, n);
    assert.equal(sha256Hex(b), createHash('sha256').update(b).digest('hex'), `length ${n}`);
  }
});

test('transient keys are listed and never backed up; other apps keys neither', () => {
  assert.deepEqual([...TRANSIENT_KEYS].sort(), ['satchel.backup.v1', 'satchel.trips.v1.unreadable']);
  assert.deepEqual(TRANSIENT_PREFIXES, ['satchel.weather.v1.']);
  for (const k of ['satchel.weather.v1.1,2', 'satchel.trips.v1.unreadable', BACKUP_STATE_KEY, 'other.app.key']) assert.equal(shouldBackUpKey(k, true), false, k);
  for (const k of ['satchel.trips.v1', 'satchel.weather.stop.v1', 'satchel.tempUnit.v1', 'satchel.kids.v1.t1']) assert.equal(shouldBackUpKey(k, false), true, k);
  const b = buildBackup(meta(true), STORE, FILES);
  assert.ok(!Object.keys(b.keys).some((k) => k.startsWith('satchel.weather.v1.') || k === BACKUP_STATE_KEY || k.endsWith('.unreadable')));
  assert.ok(!b.files.some((f) => f.path.startsWith('maps/')), 'city map packs stay out');
});

test('documents: vault key and vault/ files only with Include documents', () => {
  const off = buildBackup(meta(false), STORE, FILES);
  assert.equal(off.keys['satchel.vault.v1'], undefined);
  assert.deepEqual(off.files.map((f) => f.path), ['attachments/a1-pass.pdf', 'attachments/empty.txt']);
  assert.equal(off.includesDocuments, false);
  assert.equal(off.counts.documents, 0);
  const on = buildBackup(meta(true), STORE, FILES);
  assert.ok(on.keys['satchel.vault.v1']);
  assert.deepEqual(on.files.map((f) => f.path), ['attachments/a1-pass.pdf', 'attachments/empty.txt', 'vault/d1-passport.jpg']);
  assert.equal(on.counts.documents, 1);
});

test('round trip: every backed-up key back, files byte-identical, preview counts', () => {
  const b = buildBackup(meta(true), STORE, FILES);
  const text = serializeBackup(b);
  const r = parseBackup(text);
  assert.ok(r.ok);
  if (!r.ok) return;
  const expectedKeys = STORE.filter(([k]) => shouldBackUpKey(k, true));
  assert.deepEqual(Object.entries(r.backup.keys).sort(), [...expectedKeys].sort());
  for (const f of FILES.filter((x) => cleanFilePath(x.path) && !x.path.startsWith('maps/'))) {
    const got: { data: string } | undefined = r.backup.files.find((x) => x.path === f.path);
    assert.ok(got, f.path);
    assert.equal(got.data, f.base64, `${f.path} byte-identical`);
  }
  assert.deepEqual(backupPreview(r.backup), { created: '2026-11-01T09:00:00.000Z', app: '0.1.0', includesDocuments: true, trips: 2, items: 2, files: 3, documents: 1, keys: expectedKeys.length, bytes: 5000 + 777 });
  // Replace onto an empty new phone writes every key (paths moved onto the new install) and every file.
  const plan = planRestore(r.backup, {}, 'replace', NEW);
  assert.deepEqual(Object.keys(plan.set).sort(), expectedKeys.map(([k]) => k).sort());
  for (const [k, v] of expectedKeys) assert.equal(plan.set[k], moveDocPaths(v, OLD, NEW));
  assert.ok(plan.set['satchel.trips.v1'].includes(`${NEW}attachments/a1-pass.pdf`));
  assert.ok(!plan.set['satchel.trips.v1'].includes(OLD));
  assert.deepEqual(plan.remove, []);
  assert.deepEqual(plan.files.map((f) => [f.path, f.data]), r.backup.files.map((f) => [f.path, f.data]));
});

test('written in parts equals the one-piece text', () => {
  const b = buildBackup(meta(false), STORE, FILES);
  const parts = backupParts.head(meta(false), b.keys) + b.files.map((f, i) => backupParts.file(f, i)).join('') + backupParts.tail(b.keys, b.files);
  assert.equal(parts, serializeBackup(b));
  const none = buildBackup(meta(false), STORE, []);
  assert.ok(parseBackup(serializeBackup(none)).ok, 'no files still parses');
});

test('newer format refused honestly; not a backup; damaged', () => {
  const b = buildBackup(meta(false), STORE, FILES);
  const obj = JSON.parse(serializeBackup(b));
  assert.deepEqual(parseBackup(JSON.stringify({ ...obj, version: BACKUP_VERSION + 1 })), { ok: false, reason: 'newer' });
  assert.deepEqual(parseBackup(JSON.stringify({ format: 'satchel-trip', version: 1 })), { ok: false, reason: 'not-backup' });
  assert.deepEqual(parseBackup('hello'), { ok: false, reason: 'not-backup' });
  assert.deepEqual(parseBackup(serializeBackup(b).slice(0, 200)), { ok: false, reason: 'damaged' }, 'cut off');
  const flipped = { ...obj, files: obj.files.map((f: { data: string }, i: number) => (i === 0 ? { ...f, data: `${f.data[0] === 'Q' ? 'R' : 'Q'}${f.data.slice(1)}` } : f)) };
  assert.deepEqual(parseBackup(JSON.stringify(flipped)), { ok: false, reason: 'damaged' }, 'checksum');
  assert.deepEqual(parseBackup(JSON.stringify({ ...obj, files: [{ ...obj.files[0], path: '../x' }] })), { ok: false, reason: 'damaged' });
  assert.deepEqual(parseBackup(JSON.stringify({ ...obj, keys: { 'evil.key': 'x' } })), { ok: false, reason: 'damaged' });
  assert.deepEqual(parseBackup(JSON.stringify({ ...obj, created: 'nope' })), { ok: false, reason: 'damaged' });
});

test('merge keeps both sides by id; same id: newer updatedAt, else incoming', () => {
  const b = buildBackup(meta(false), STORE, FILES);
  const phoneTrips = [trip('t2', { name: 'Phone t2' }), trip('t3')];
  const current = { 'satchel.trips.v1': JSON.stringify(phoneTrips), 'satchel.prefs.v1': JSON.stringify({ haptics: true, appearance: 'dark' }), 'satchel.vault.v1': '[{"id":"mine"}]' };
  const plan = planRestore(b, current, 'merge', OLD);
  const merged = JSON.parse(plan.set['satchel.trips.v1']) as { id: string; name: string }[];
  assert.deepEqual(merged.map((x) => x.id), ['t2', 't3', 't1']);
  assert.equal(merged[0].name, 'Trip t2', 'no updatedAt: the incoming one');
  assert.deepEqual(JSON.parse(plan.set['satchel.prefs.v1']), { haptics: false, appearance: 'dark' });
  assert.equal(plan.set['satchel.vault.v1'], undefined, 'phone documents untouched by a backup without them');
  assert.deepEqual(plan.remove, []);

  const a = JSON.stringify([{ id: 'x', v: 'phone', updatedAt: '2026-11-01T10:00:00Z' }, { id: 'y', v: 'phone', updatedAt: '2026-10-01T00:00:00Z' }]);
  const c = JSON.stringify([{ id: 'x', v: 'file', updatedAt: '2026-10-30T00:00:00Z' }, { id: 'y', v: 'file', updatedAt: '2026-10-02T00:00:00Z' }]);
  assert.deepEqual(JSON.parse(mergeStored(a, c)).map((r: { v: string }) => r.v), ['phone', 'file']);
  assert.equal(mergeStored('[]', '[{"id":"z"}]'), '[{"id":"z"}]');
  assert.equal(mergeStored('not json', '"x"'), '"x"');
  assert.equal(mergeStored(undefined, '1'), '1');
});

test('replace: phone keys missing from the backup go, but documents, caches and the backup record stay', () => {
  const b = buildBackup(meta(false), STORE, FILES);
  const current = { 'satchel.trips.v1': '[]', 'satchel.lostbag.v1.t9': '{}', 'satchel.vault.v1': '[{"id":"mine"}]', 'satchel.weather.v1.1,2': '{}', [BACKUP_STATE_KEY]: '{}' };
  const plan = planRestore(b, current, 'replace', OLD);
  assert.deepEqual(plan.remove, ['satchel.lostbag.v1.t9']);
  assert.equal(JSON.parse(plan.set['satchel.trips.v1']).length, 2);
  const withDocs = planRestore(buildBackup(meta(true), STORE, FILES), current, 'replace', OLD);
  assert.ok(withDocs.set['satchel.vault.v1'].includes('d1'));
});

test('file paths: only attachments/ and vault/, never ..', () => {
  assert.equal(cleanFilePath('attachments/a.pdf'), 'attachments/a.pdf');
  for (const p of ['a.pdf', '/attachments/a.pdf', 'attachments/../x', 'maps/x', 'attachments//x', 'attachments\\x', 7]) assert.equal(cleanFilePath(p), null, String(p));
  assert.equal(fileEntry('attachments/a', '***'), null);
  assert.equal(fileEntry('attachments/a', 'AAEC')?.size, 3);
});

test('state, file name and reminder', () => {
  assert.deepEqual(normaliseBackupState(null), DEFAULT_BACKUP_STATE);
  assert.deepEqual(normaliseBackupState({ lastAt: 'x', includeDocuments: 'yes', dismissed: ['t1', 3] }), { includeDocuments: false, dismissed: ['t1'] });
  assert.equal(backupFileName('2026-11-01T09:00:00Z'), 'Satchel backup 2026-11-01.satchelbackup');
  const now = Date.parse('2026-11-01T09:00:00Z');
  const trips = [
    { id: 'demo', startDate: '2026-11-03', demo: true },
    { id: 'far', startDate: '2026-11-20' },
    { id: 'soon', startDate: '2026-11-08' },
    { id: 'past', startDate: '2026-10-20' },
  ];
  const s = DEFAULT_BACKUP_STATE;
  assert.equal(backupReminderTrip(trips, s, '2026-11-01', now)?.id, 'soon');
  assert.equal(backupReminderTrip(trips, { ...s, lastAt: '2026-10-15T00:00:00Z' }, '2026-11-01', now), null, 'backed up 17 days ago');
  assert.equal(backupReminderTrip(trips, { ...s, lastAt: '2026-09-15T00:00:00Z' }, '2026-11-01', now)?.id, 'soon', '47 days ago');
  assert.equal(backupReminderTrip(trips, { ...s, dismissed: ['soon'] }, '2026-11-01', now), null, 'dismissed for that trip');
  assert.equal(backupReminderTrip(trips, s, '2026-11-09', now), null, 'nothing starting within 7 days');
});

test('T28: an attachment\'s in-app QR crop rectangle comes back from a backup (Replace and Merge)', () => {
  const crop = { x: 0.3, y: 0.45, w: 0.4, h: 0.2 };
  const trips = JSON.stringify([
    { id: 't1', name: 'Kyoto', startDate: '2027-04-01', items: [{ id: 'i1', tripId: 't1', attachments: [{ id: 'a1', uri: `${OLD}attachments/a1-shot.png`, name: 'shot.png', mime: 'image/png', role: 'ticket', qrCrop: crop }] }] },
  ]);
  const r = parseBackup(serializeBackup(buildBackup(meta(false), [['satchel.trips.v1', trips]], [{ path: 'attachments/a1-shot.png', base64: 'QUJD' }])));
  assert.ok(r.ok);
  if (!r.ok) return;
  for (const mode of ['replace', 'merge'] as const) {
    const back = JSON.parse(planRestore(r.backup, {}, mode, NEW).set['satchel.trips.v1']);
    assert.deepEqual(back[0].items[0].attachments[0].qrCrop, crop, mode);
    assert.equal(back[0].items[0].attachments[0].uri, `${NEW}attachments/a1-shot.png`);
  }
});
