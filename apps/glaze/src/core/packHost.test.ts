// T169: host kinds and the flat GitHub-release asset naming (src/core/packHost.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FLAT_SEPARATOR, flatAssetName, isValidFlatAssetName, packHostKind, packObjectUrl } from './packHost.ts';
import { CATALOG_FILE, manifestPath, packFolder } from './packCatalog.ts';
import { packFileUrl } from './themePack.ts';

const GH = 'https://github.com/MerlinWerlin/App-Projects/releases/download/glaze-packs-v1';

test('host kind comes from the base URL', () => {
  assert.equal(packHostKind(GH), 'github-release');
  assert.equal(packHostKind(`${GH}/`), 'github-release');
  assert.equal(packHostKind('https://github.com/o/r/releases/download/glaze-packs-staging'), 'github-release');
  assert.equal(packHostKind('https://pub-0123.r2.dev'), 'folder');
  assert.equal(packHostKind('https://packs.example.test/glaze'), 'folder');
  assert.equal(packHostKind('https://github.com/o/r/releases'), 'folder');
  assert.equal(packHostKind('https://github.com/o/r/releases/download/t/extra'), 'folder');
});

test('flat names: "/" -> "__", deterministic, valid GitHub asset names', () => {
  assert.equal(FLAT_SEPARATOR, '__');
  assert.equal(flatAssetName(CATALOG_FILE), 'catalog.json');
  assert.equal(flatAssetName(manifestPath('deep-sea', 3)), 'art__deep-sea__v3__manifest.json');
  assert.equal(flatAssetName(`${packFolder('deep-sea', 3)}/wallpaper-2796.1a2b3c4d.webp`), 'art__deep-sea__v3__wallpaper-2796.1a2b3c4d.webp');
  assert.equal(flatAssetName('/art/x/v1/a.webp'), 'art__x__v1__a.webp');
  for (const n of ['catalog.json', 'art__deep-sea__v3__thumb.1a2b3c4d.webp', 'A-b_c.9']) assert.equal(isValidFlatAssetName(n), true, n);
  for (const n of ['', '.', '..', 'a b.webp', 'a/b', 'é.webp', '.hidden', 'a@1', 'x'.repeat(300)]) assert.equal(isValidFlatAssetName(n), false, n);
});

test('packObjectUrl: flat on a release, folders elsewhere; legacy theme packs follow too', () => {
  const rel = `${packFolder('deep-sea', 2)}/thumb.0000dddd.webp`;
  assert.equal(packObjectUrl(GH, rel), `${GH}/art__deep-sea__v2__thumb.0000dddd.webp`);
  assert.equal(packObjectUrl(`${GH}//`, CATALOG_FILE), `${GH}/catalog.json`);
  assert.equal(packObjectUrl('https://pub-0123.r2.dev/', rel), `https://pub-0123.r2.dev/${rel}`);
  assert.equal(packObjectUrl('https://cdn.example.test/p', 'pack-a/assets/a b.png'), 'https://cdn.example.test/p/pack-a/assets/a%20b.png');
  assert.equal(packFileUrl(GH, 'pack-neon', 'manifest.json'), `${GH}/pack-neon__manifest.json`);
  assert.equal(packFileUrl('https://cdn.example.test', 'pack-neon', 'art/a.png'), 'https://cdn.example.test/pack-neon/art/a.png');
});
