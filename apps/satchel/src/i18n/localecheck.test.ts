import assert from 'node:assert/strict';
import { test } from 'node:test';
import { en } from './en.ts';
import { checkDrop, chunkCatalogue, coverage, mergeDrops, readyToShip } from './localecheck.ts';

const EN = { 'a.hi': 'Hello {name}', 'a.app': 'Satchel works offline', 'a.osm': '© OpenStreetMap contributors', 'a.b': 'Bye' };

test('a drop keeps good entries and rejects unknown keys, empty text, broken placeholders and lost brand words', () => {
  const r = checkDrop(
    { 'a.hi': 'Hola {name}', 'a.app': 'La app funciona sin conexión', 'a.osm': '© colaboradores de OpenStreetMap', 'a.b': ' ', 'zz.x': 'x' },
    EN,
  );
  assert.deepEqual(r.accepted, { 'a.hi': 'Hola {name}', 'a.osm': '© colaboradores de OpenStreetMap' });
  assert.deepEqual(r.unknown, ['zz.x']);
  assert.deepEqual(r.empty, ['a.b']);
  assert.deepEqual(r.lostKeepWords, ['a.app']);
  assert.deepEqual(checkDrop({ 'a.hi': 'Hola {nombre}' }, EN).badPlaceholders, ['a.hi']);
});

test('a drop that is not an object is ignored, never thrown on', () => {
  for (const bad of [null, 'x', 3, ['a']]) assert.deepEqual(checkDrop(bad, EN).accepted, {});
});

test('chunks merge in order and coverage gates shipping', () => {
  const { catalog, rejected } = mergeDrops([{ 'a.hi': 'Hola {name}', 'a.b': 'Adiós' }, { 'a.b': 'Chao', 'q': 'x' }], EN);
  assert.deepEqual(catalog, { 'a.hi': 'Hola {name}', 'a.b': 'Chao' });
  assert.equal(rejected, 1);
  assert.equal(coverage(catalog, EN), 0.5);
  assert.equal(readyToShip(catalog, EN), false);
  assert.equal(readyToShip({ ...catalog, 'a.app': 'Satchel x', 'a.osm': 'OpenStreetMap' }, EN), true);
});

test('chunking the real catalogue covers every key exactly once', () => {
  const chunks = chunkCatalogue(en as Record<string, string>, 400);
  const keys = chunks.flatMap((c) => Object.keys(c));
  assert.equal(keys.length, Object.keys(en).length);
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(chunks.every((c) => Object.keys(c).length <= 400));
});
