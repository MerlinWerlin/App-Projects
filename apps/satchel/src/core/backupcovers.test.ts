// T154: trip cover photos (covers/) travel in a .satchelbackup, and their stored paths are moved onto the new phone's
// documents folder on restore, including paths from an older container than the one the backup was made in.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildBackup, cleanFilePath, parseBackup, planRestore, rebaseCoverPhotoStore, serializeBackup, shouldBackUpFile, type BackupMeta } from './backup.ts';
import { COVER_PHOTO_KEY } from './covers2.ts';
import { bytesToBase64 } from './tar.ts';

const OLDER = 'file:///var/mobile/Containers/Data/Application/OLDER-1111/Documents/';
const OLD = 'file:///var/mobile/Containers/Data/Application/OLD-2222/Documents/';
const NEW = 'file:///var/mobile/Containers/Data/Application/NEW-3333/Documents/';

const store = (photos: Record<string, unknown>) => JSON.stringify({ v: 1, photos });
const photosOf = (text: string) => (JSON.parse(text) as { photos: Record<string, string> }).photos;

test('covers/ files are backed up with or without documents; bad cover paths are not', () => {
  assert.equal(cleanFilePath('covers/t1-abc.jpg'), 'covers/t1-abc.jpg');
  assert.equal(shouldBackUpFile('covers/t1-abc.jpg', false), true);
  assert.equal(shouldBackUpFile('covers/t1-abc.jpg', true), true);
  assert.equal(cleanFilePath('covers/../vault/x.jpg'), null);
  assert.equal(cleanFilePath('covers'), null);
  assert.equal(cleanFilePath('coverz/t1.jpg'), null);
});

test('rebaseCoverPhotoStore: same, older-container, relative and Android paths land in the new covers/', () => {
  const text = store({
    t1: `${OLD}covers/t1-a.jpg`,
    t2: `${OLDER}covers/t2-b.jpg`,
    t3: 'covers/t3-c.jpg',
    t4: 'file:///data/user/0/com.jared797.satchel/files/covers/t4-d.jpg',
    t5: `${NEW}covers/t5-e.jpg`,
  });
  assert.deepEqual(photosOf(rebaseCoverPhotoStore(text, NEW)), {
    t1: `${NEW}covers/t1-a.jpg`,
    t2: `${NEW}covers/t2-b.jpg`,
    t3: `${NEW}covers/t3-c.jpg`,
    t4: `${NEW}covers/t4-d.jpg`,
    t5: `${NEW}covers/t5-e.jpg`,
  });
});

test('rebaseCoverPhotoStore drops paths that cannot be a restored cover, and leaves other text alone', () => {
  const text = store({ ok: `${OLD}covers/ok.jpg`, tmp: 'file:///private/tmp/covers/x.jpg', esc: `${OLD}covers/../vault/p.jpg`, junk: 42, 'bad id!': `${OLD}covers/y.jpg` });
  assert.deepEqual(photosOf(rebaseCoverPhotoStore(text, NEW)), { ok: `${NEW}covers/ok.jpg` });
  assert.equal(rebaseCoverPhotoStore('not json', NEW), 'not json');
  assert.equal(rebaseCoverPhotoStore('[1,2]', NEW), '[1,2]');
  assert.equal(rebaseCoverPhotoStore(text, null), text, 'no documents folder: unchanged');
});

const meta: BackupMeta = { app: '0.1.0', created: '2026-11-01T09:00:00.000Z', docDir: OLD, includeDocuments: false };
const jpg = bytesToBase64(Uint8Array.from({ length: 300 }, (_, i) => (i * 13) & 0xff));

test('round trip: the cover file comes back and the map points at it on the new phone (Replace and Merge)', () => {
  const entries: [string, string][] = [
    ['satchel.trips.v1', JSON.stringify([{ id: 't1', name: 'Lisbon', items: [] }, { id: 't2', name: 'Kyoto', items: [] }])],
    [COVER_PHOTO_KEY, store({ t1: `${OLD}covers/t1-a.jpg`, t2: `${OLDER}covers/t2-b.jpg` })],
  ];
  const files = [
    { path: 'covers/t1-a.jpg', base64: jpg },
    { path: 'covers/t2-b.jpg', base64: jpg },
  ];
  const parsed = parseBackup(serializeBackup(buildBackup(meta, entries, files)));
  assert.ok(parsed.ok);
  if (!parsed.ok) return;
  assert.deepEqual(parsed.backup.files.map((f) => f.path), ['covers/t1-a.jpg', 'covers/t2-b.jpg']);

  const replace = planRestore(parsed.backup, {}, 'replace', NEW);
  assert.deepEqual(replace.files.map((f) => f.path), ['covers/t1-a.jpg', 'covers/t2-b.jpg']);
  assert.deepEqual(photosOf(replace.set[COVER_PHOTO_KEY]), { t1: `${NEW}covers/t1-a.jpg`, t2: `${NEW}covers/t2-b.jpg` });

  // Merge onto a phone that already has its own cover for another trip keeps it.
  const current = { [COVER_PHOTO_KEY]: store({ t9: `${NEW}covers/t9-z.jpg` }) };
  const merge = planRestore(parsed.backup, current, 'merge', NEW);
  assert.deepEqual(photosOf(merge.set[COVER_PHOTO_KEY]), { t9: `${NEW}covers/t9-z.jpg`, t1: `${NEW}covers/t1-a.jpg`, t2: `${NEW}covers/t2-b.jpg` });
});

test('a backup made before covers were included still restores (the map moves, the trip falls back to art)', () => {
  const entries: [string, string][] = [[COVER_PHOTO_KEY, store({ t1: `${OLD}covers/t1-a.jpg` })]];
  const parsed = parseBackup(serializeBackup(buildBackup(meta, entries, [])));
  assert.ok(parsed.ok);
  if (!parsed.ok) return;
  const plan = planRestore(parsed.backup, {}, 'replace', NEW);
  assert.deepEqual(plan.files, []);
  assert.deepEqual(photosOf(plan.set[COVER_PHOTO_KEY]), { t1: `${NEW}covers/t1-a.jpg` });
});
