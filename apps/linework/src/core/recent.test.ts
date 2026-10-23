import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addRecent,
  fromStoredRef,
  parseRecent,
  removeRecent,
  serializeRecent,
  toStoredRef,
  RECENT_CAP,
  type RecentItem,
} from './recent.ts';

const item = (n: number, extra: Partial<RecentItem> = {}): RecentItem => ({ uri: `file:///img/${n}.jpg`, addedAt: n, ...extra });

test('addRecent puts newest first', () => {
  let list: RecentItem[] = [];
  list = addRecent(list, item(1)).list;
  list = addRecent(list, item(2)).list;
  assert.deepEqual(list.map((r) => r.addedAt), [2, 1]);
});

test('addRecent dedupes by uri, moves to front and updates addedAt', () => {
  let list = [item(3), item(2), item(1)];
  const res = addRecent(list, { uri: item(1).uri, addedAt: 10 });
  list = res.list;
  assert.equal(list.length, 3);
  assert.equal(list[0].uri, item(1).uri);
  assert.equal(list[0].addedAt, 10);
  assert.deepEqual(res.evicted, []);
});

test('addRecent keeps previous dimensions when re-added without them', () => {
  const list = [item(1, { width: 800, height: 600 })];
  const res = addRecent(list, { uri: item(1).uri, addedAt: 5 });
  assert.deepEqual(res.list[0], { uri: item(1).uri, addedAt: 5, width: 800, height: 600 });
});

test('addRecent caps at RECENT_CAP and reports evicted items', () => {
  assert.equal(RECENT_CAP, 12);
  let list: RecentItem[] = [];
  for (let i = 1; i <= RECENT_CAP; i++) list = addRecent(list, item(i)).list;
  assert.equal(list.length, RECENT_CAP);
  const res = addRecent(list, item(13));
  assert.equal(res.list.length, RECENT_CAP);
  assert.equal(res.list[0].addedAt, 13);
  assert.deepEqual(res.evicted.map((r) => r.uri), [item(1).uri]);
});

test('addRecent does not mutate its input', () => {
  const list = [item(1)];
  addRecent(list, item(2));
  assert.deepEqual(list, [item(1)]);
});

test('removeRecent removes by uri and ignores unknown uris', () => {
  const list = [item(2), item(1)];
  assert.deepEqual(removeRecent(list, item(2).uri), [item(1)]);
  assert.deepEqual(removeRecent(list, 'nope'), list);
});

test('parseRecent handles null, garbage and non-arrays', () => {
  assert.deepEqual(parseRecent(null), []);
  assert.deepEqual(parseRecent(''), []);
  assert.deepEqual(parseRecent('{not json'), []);
  assert.deepEqual(parseRecent('{"uri":"x"}'), []);
  assert.deepEqual(parseRecent('42'), []);
  assert.deepEqual(parseRecent('null'), []);
});

test('parseRecent drops malformed entries and bad dimensions', () => {
  const json = JSON.stringify([
    { uri: 'a', addedAt: 1, width: 10, height: 20 },
    { uri: '', addedAt: 2 },
    { uri: 'b' },
    { addedAt: 3 },
    null,
    'str',
    { uri: 'c', addedAt: 4, width: -1, height: 'x' },
  ]);
  assert.deepEqual(parseRecent(json), [
    { uri: 'c', addedAt: 4 },
    { uri: 'a', addedAt: 1, width: 10, height: 20 },
  ]);
});

test('parseRecent sorts newest first, dedupes and caps', () => {
  const raw: RecentItem[] = [];
  for (let i = 1; i <= 20; i++) raw.push(item(i));
  raw.push(item(20));
  const out = parseRecent(JSON.stringify(raw));
  assert.equal(out.length, RECENT_CAP);
  assert.equal(out[0].addedAt, 20);
  assert.equal(new Set(out.map((r) => r.uri)).size, RECENT_CAP);
});

test('parseRecent round-trips addRecent output', () => {
  let list: RecentItem[] = [];
  for (let i = 1; i <= 5; i++) list = addRecent(list, item(i, { width: i * 100, height: i * 50 })).list;
  assert.deepEqual(parseRecent(JSON.stringify(list)), list);
});

const OLD_DIR = 'file:///var/mobile/Containers/Data/Application/AAAA/Documents/images/';
const NEW_DIR = 'file:///var/mobile/Containers/Data/Application/BBBB/Documents/images/';

test('toStoredRef makes own copies relative to imagesDir', () => {
  assert.equal(toStoredRef(`${NEW_DIR}123-ab.jpg`, NEW_DIR), '123-ab.jpg');
  // imagesDir without trailing slash works too
  assert.equal(toStoredRef(`${NEW_DIR}123-ab.jpg`, NEW_DIR.slice(0, -1)), '123-ab.jpg');
});

test('toStoredRef migrates absolute uris from an old container path', () => {
  assert.equal(toStoredRef(`${OLD_DIR}9-zz.png`, NEW_DIR), '9-zz.png');
  assert.equal(toStoredRef('/private/var/x/Documents/images/1.jpg', NEW_DIR), '1.jpg');
});

test('toStoredRef keeps foreign uris as-is', () => {
  for (const u of [
    'content://media/external/images/media/42',
    'ph://ABC-123/L0/001',
    'file:///tmp/ImagePicker/x.jpg',
    'https://example.com/images/a.jpg',
  ]) {
    assert.equal(toStoredRef(u, NEW_DIR), u);
  }
});

test('toStoredRef leaves an already-relative name unchanged', () => {
  assert.equal(toStoredRef('123-ab.jpg', NEW_DIR), '123-ab.jpg');
});

test('fromStoredRef resolves relative names against imagesDir', () => {
  assert.equal(fromStoredRef('123-ab.jpg', NEW_DIR), `${NEW_DIR}123-ab.jpg`);
  assert.equal(fromStoredRef('123-ab.jpg', NEW_DIR.slice(0, -1)), `${NEW_DIR}123-ab.jpg`);
});

test('fromStoredRef rebuilds legacy absolute uris in the current imagesDir', () => {
  assert.equal(fromStoredRef(`${OLD_DIR}9-zz.png`, NEW_DIR), `${NEW_DIR}9-zz.png`);
  assert.equal(fromStoredRef(`${NEW_DIR}9-zz.png`, NEW_DIR), `${NEW_DIR}9-zz.png`);
});

test('fromStoredRef keeps foreign uris as-is', () => {
  for (const u of ['content://media/external/images/media/42', 'ph://ABC-123/L0/001', 'file:///tmp/x.jpg']) {
    assert.equal(fromStoredRef(u, NEW_DIR), u);
  }
});

test('serializeRecent + parseRecent survive a changed imagesDir', () => {
  const list: RecentItem[] = [
    { uri: `${OLD_DIR}2.jpg`, addedAt: 2, width: 10, height: 20 },
    { uri: 'ph://ABC/L0/001', addedAt: 1 },
  ];
  const json = serializeRecent(list, OLD_DIR);
  assert.deepEqual(
    (JSON.parse(json) as RecentItem[]).map((r) => r.uri),
    ['2.jpg', 'ph://ABC/L0/001'],
  );
  assert.deepEqual(parseRecent(json, NEW_DIR), [
    { uri: `${NEW_DIR}2.jpg`, addedAt: 2, width: 10, height: 20 },
    { uri: 'ph://ABC/L0/001', addedAt: 1 },
  ]);
});

test('parseRecent migrates legacy absolute entries and dedupes after resolving', () => {
  const json = JSON.stringify([
    { uri: `${OLD_DIR}1.jpg`, addedAt: 1 },
    { uri: '1.jpg', addedAt: 5 },
    { uri: 'content://media/external/images/media/7', addedAt: 3 },
  ]);
  assert.deepEqual(parseRecent(json, NEW_DIR), [
    { uri: `${NEW_DIR}1.jpg`, addedAt: 5 },
    { uri: 'content://media/external/images/media/7', addedAt: 3 },
  ]);
});

test('parseRecent without imagesDir leaves uris untouched', () => {
  const json = JSON.stringify([{ uri: '1.jpg', addedAt: 1 }]);
  assert.deepEqual(parseRecent(json), [{ uri: '1.jpg', addedAt: 1 }]);
});
