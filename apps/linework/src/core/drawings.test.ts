import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDrawing,
  DRAWINGS_CAP,
  drawingFiles,
  fitForView,
  fromDrawingRef,
  newDrawingId,
  parseDrawings,
  removeDrawing,
  sanitizeDrawing,
  serializeDrawings,
  toDrawingRef,
  type Drawing,
} from './drawings.ts';

const DIR = 'file:///data/app/Documents/drawings/';
const d = (id: string, createdAt: number, extra: Partial<Drawing> = {}): Drawing => ({
  id,
  createdAt,
  photoUri: `${DIR}${id}-photo.jpg`,
  ...extra,
});

test('add puts the newest first and replaces the same id', () => {
  let list: Drawing[] = [];
  list = addDrawing(list, d('a', 1)).list;
  list = addDrawing(list, d('b', 2)).list;
  assert.deepEqual(list.map((x) => x.id), ['b', 'a']);
  list = addDrawing(list, d('a', 3)).list;
  assert.deepEqual(list.map((x) => x.id), ['a', 'b']);
});

test('add caps the list and reports the evicted oldest', () => {
  let list: Drawing[] = [];
  for (let i = 0; i < DRAWINGS_CAP; i++) list = addDrawing(list, d(`x${i}`, i)).list;
  assert.equal(list.length, DRAWINGS_CAP);
  const r = addDrawing(list, d('new', 10_000));
  assert.equal(r.list.length, DRAWINGS_CAP);
  assert.equal(r.list[0].id, 'new');
  assert.deepEqual(r.evicted.map((x) => x.id), ['x0']);
});

test('remove returns the removed entry, or null', () => {
  const list = [d('a', 2), d('b', 1)];
  const r = removeDrawing(list, 'a');
  assert.deepEqual(r.list.map((x) => x.id), ['b']);
  assert.equal(r.removed?.id, 'a');
  assert.equal(removeDrawing(list, 'zz').removed, null);
  assert.equal(removeDrawing(list, 'zz').list.length, 2);
});

test('drawingFiles lists the photo and the source copy', () => {
  assert.deepEqual(drawingFiles(d('a', 1)), [`${DIR}a-photo.jpg`]);
  assert.deepEqual(drawingFiles(d('a', 1, { sourceUri: `${DIR}a-source.png` })), [`${DIR}a-photo.jpg`, `${DIR}a-source.png`]);
});

test('ids are file-name safe and differ by random part', () => {
  const a = newDrawingId(1_700_000_000_000, 0.1);
  const b = newDrawingId(1_700_000_000_000, 0.9);
  assert.match(a, /^[a-z0-9]+-[a-z0-9]{6}$/);
  assert.notEqual(a, b);
  assert.ok(sanitizeDrawing({ id: a, createdAt: 1, photoUri: 'x.jpg' }));
});

test('refs: own copies are stored relative and rebuilt against a new container', () => {
  assert.equal(toDrawingRef(`${DIR}a.jpg`, DIR), 'a.jpg');
  assert.equal(toDrawingRef('file:///old/container/Documents/drawings/a.jpg', DIR), 'a.jpg');
  assert.equal(toDrawingRef('content://media/1', DIR), 'content://media/1');
  const NEW = 'file:///new/Documents/drawings';
  assert.equal(fromDrawingRef('a.jpg', NEW), 'file:///new/Documents/drawings/a.jpg');
  assert.equal(fromDrawingRef('file:///old/Documents/drawings/a.jpg', NEW), 'file:///new/Documents/drawings/a.jpg');
  assert.equal(fromDrawingRef('content://media/1', NEW), 'content://media/1');
});

test('serialize + parse round-trips', () => {
  const fit = { view: { width: 390, height: 844 }, base: { width: 351, height: 351 }, x: 4, y: -8, scale: 1.2, rotation: 0.3, mirror: true };
  const list = [
    d('b', 2, { templateId: 'cat', fit }),
    d('a', 1, { sourceUri: `${DIR}a-source.png`, photoWidth: 1080, photoHeight: 1920 }),
  ];
  const json = serializeDrawings(list, DIR);
  assert.ok(!json.includes('file://'));
  assert.deepEqual(parseDrawings(json, DIR), list);
});

test('parse drops junk, dedupes by id (newest wins) and sorts newest first', () => {
  assert.deepEqual(parseDrawings(null), []);
  assert.deepEqual(parseDrawings('not json'), []);
  assert.deepEqual(parseDrawings('{"a":1}'), []);
  const json = JSON.stringify([
    { id: 'a', createdAt: 1, photoUri: 'a.jpg' },
    null,
    5,
    { id: 'bad id/..', createdAt: 2, photoUri: 'x.jpg' },
    { id: 'c', createdAt: 'yesterday', photoUri: 'c.jpg' },
    { id: 'd', createdAt: 3, photoUri: '' },
    { id: 'a', createdAt: 9, photoUri: 'a2.jpg', extra: 'dropped', photoWidth: -1, photoHeight: 5, fit: { view: 1 } },
    { id: 'b', createdAt: 4, photoUri: 'b.jpg', templateId: 7 },
  ]);
  assert.deepEqual(parseDrawings(json), [
    { id: 'a', createdAt: 9, photoUri: 'a2.jpg' },
    { id: 'b', createdAt: 4, photoUri: 'b.jpg' },
  ]);
});

test('parse caps at 200', () => {
  const many = Array.from({ length: 250 }, (_, i) => ({ id: `i${i}`, createdAt: i, photoUri: `${i}.jpg` }));
  const out = parseDrawings(JSON.stringify(many));
  assert.equal(out.length, DRAWINGS_CAP);
  assert.equal(out[0].id, 'i249');
});

test('fitForView scales the stored fit to the viewer, or centres a square without one', () => {
  const fit = { view: { width: 400, height: 800 }, base: { width: 360, height: 200 }, x: 10, y: 20, scale: 2, rotation: 1, mirror: false };
  const same = fitForView(fit, { width: 400, height: 800 });
  assert.deepEqual(same, { base: { width: 360, height: 200 }, x: 10, y: 20, scale: 2, rotation: 1, mirror: false });
  const half = fitForView(fit, { width: 200, height: 400 });
  assert.deepEqual(half.base, { width: 180, height: 100 });
  assert.equal(half.x, 5);
  const none = fitForView(undefined, { width: 300, height: 600 });
  assert.deepEqual(none.base, { width: 270, height: 270 });
  assert.equal(none.scale, 1);
});
