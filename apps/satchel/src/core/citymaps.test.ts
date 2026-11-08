import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  bboxContains,
  CATALOG_URL,
  cityDiskBytes,
  darkDirOf,
  darkPackEntryPath,
  darkPackMetaOk,
  darkPackUrl,
  formatSize,
  latToTileY,
  lonToTileX,
  overallProgress,
  packEntryPath,
  packUrl,
  parseCatalog,
  parseCity,
  parseDarkPack,
  pickCityFor,
  regionForCity,
  tileCountEstimate,
  tilePathForScheme,
  tilePathTemplate,
  validBBox,
  zoomsOf,
  type CityMap,
} from './citymaps.ts';

const kyoto = {
  id: 'kyoto',
  name: 'Kyoto',
  country: 'JP',
  bbox: [135.68, 34.93, 135.82, 35.07],
  center: [135.76, 35.01],
  minzoom: 10,
  maxzoom: 16,
  file: 'kyoto.tar',
  bytes: 12_345_678,
  sha256: 'A'.repeat(64),
  tiles: 1234,
  pois: 456,
};

test('a contract city entry parses', () => {
  const c = parseCity(kyoto);
  assert.ok(c);
  assert.equal(c.id, 'kyoto');
  assert.deepEqual(c.bbox, [135.68, 34.93, 135.82, 35.07]);
  assert.equal(c.sha256, 'a'.repeat(64));
  assert.equal(c.tiles, 1234);
});

test('bad bboxes are rejected', () => {
  for (const bbox of [
    [135.82, 34.93, 135.68, 35.07], // west > east
    [135.68, 35.07, 135.82, 34.93], // south > north
    [135.68, 34.93, 135.82],
    [135.68, 34.93, 135.82, 'x'],
    [-181, 0, 1, 1],
    [0, -89, 1, 1],
    [0, 0, 0, 1],
    [0, 0, Infinity, 1],
  ]) {
    assert.equal(validBBox(bbox), false, JSON.stringify(bbox));
    assert.equal(parseCity({ ...kyoto, bbox }), null);
  }
  assert.equal(parseCity({ ...kyoto, center: [10, 10] }), null, 'center outside bbox');
});

test('unsafe ids, file names and zooms are rejected', () => {
  for (const patch of [
    { id: '../etc' },
    { id: 'Kyoto' },
    { id: '' },
    { file: '../kyoto.tar' },
    { file: 'https://evil.example/x.tar' },
    { file: 'kyoto/a.tar' },
    { file: 'kyoto.zip' },
    { minzoom: 17 },
    { maxzoom: 21 },
    { minzoom: 1.5 },
    { bytes: 0 },
    { name: '' },
  ]) {
    assert.equal(parseCity({ ...kyoto, ...patch }), null, JSON.stringify(patch));
  }
});

test('catalog keeps valid cities only and drops duplicates', () => {
  const cat = parseCatalog({ version: 1, release: 'satchel-maps-v1', built: '2026-10-31', attribution: '© OSM', cities: [kyoto, { ...kyoto }, { id: 'bad' }, { ...kyoto, id: 'tokyo', name: 'Tokyo', file: 'tokyo.tar' }] });
  assert.ok(cat);
  assert.deepEqual(cat.cities.map((c) => c.id), ['kyoto', 'tokyo']);
  assert.equal(parseCatalog({ version: 2, cities: [] }), null);
  assert.equal(parseCatalog(null), null);
  assert.equal(parseCatalog({ version: 1 }), null);
  assert.equal(parseCatalog({ version: 1, cities: [] })?.attribution, '© OpenStreetMap contributors');
});

test('urls come from the release, never from the catalog', () => {
  assert.equal(CATALOG_URL, 'https://github.com/MerlinWerlin/App-Projects/releases/download/satchel-maps-v1/catalog.json');
  assert.equal(packUrl(parseCity(kyoto) as CityMap), 'https://github.com/MerlinWerlin/App-Projects/releases/download/satchel-maps-v1/kyoto.tar');
});

test('only meta.json, pois.json and tile pngs may be written', () => {
  assert.equal(packEntryPath('meta.json'), 'meta.json');
  assert.equal(packEntryPath('./pois.json'), 'pois.json');
  assert.equal(packEntryPath('tiles/16/58210/25803.png'), 'tiles/16/58210/25803.png');
  assert.equal(packEntryPath('tiles/0/0/0.png'), 'tiles/0/0/0.png');
  for (const bad of [
    '../meta.json',
    '/meta.json',
    'tiles/../../x.png',
    'tiles/10/1/2.png/../../../a',
    'tiles/10/1/2.jpg',
    'tiles/10/1/2.PNG',
    'tiles/10/1024/2.png', // x outside the z10 grid
    'tiles/21/0/0.png',
    'tiles/01/0/0.png',
    'tiles/-1/0/0.png',
    'tiles/10/1/2',
    'tiles/10/1/2.png ',
    'tiles/a/1/2.png',
    'tiles/',
    '.complete',
    'meta.json/x',
    'x/meta.json',
    'tiles\\10\\1\\2.png',
  ]) {
    assert.equal(packEntryPath(bad), null, bad);
  }
});

test('bboxContains and pickCityFor prefer the smallest containing city', () => {
  const big = parseCity({ ...kyoto, id: 'kansai', bbox: [135, 34, 136.5, 35.5], center: [135.5, 34.7], file: 'kansai.tar' }) as CityMap;
  const small = parseCity(kyoto) as CityMap;
  assert.equal(bboxContains(small.bbox, 35.0, 135.76), true);
  assert.equal(bboxContains(small.bbox, 34.7, 135.5), false);
  assert.equal(pickCityFor(35.0, 135.76, [big, small])?.id, 'kyoto');
  assert.equal(pickCityFor(34.7, 135.5, [big, small])?.id, 'kansai');
  assert.equal(pickCityFor(51.5, -0.1, [big, small]), null);
  assert.equal(pickCityFor(35, 135.76, []), null);
});

test('regionForCity covers the bbox', () => {
  const r = regionForCity(parseCity(kyoto) as CityMap);
  assert.ok(Math.abs(r.latitude - 35.0) < 1e-9);
  assert.ok(Math.abs(r.longitude - 135.75) < 1e-9);
  assert.ok(Math.abs(r.latitudeDelta - 0.14) < 1e-9);
  assert.ok(Math.abs(r.longitudeDelta - 0.14) < 1e-9);
});

test('formatSize', () => {
  assert.equal(formatSize(512), '512 B');
  assert.equal(formatSize(850_000), '850 KB');
  assert.equal(formatSize(1_500_000), '1.5 MB');
  assert.equal(formatSize(12_345_678), '12 MB');
  assert.equal(formatSize(1_200_000_000), '1.2 GB');
  assert.equal(formatSize(-1), '');
});

test('zooms and tile counts', () => {
  assert.deepEqual(zoomsOf({ minzoom: 10, maxzoom: 13 }), [10, 11, 12, 13]);
  assert.equal(lonToTileX(-180, 1), 0);
  assert.equal(lonToTileX(180, 1), 1);
  assert.equal(latToTileY(80, 1), 0);
  assert.equal(latToTileY(-80, 1), 1);
  assert.equal(tileCountEstimate([-180, -85, 180, 85], 0, 2), 1 + 4 + 16);
  // Kyoto at z16: about 26 x 32 tiles
  const n16 = tileCountEstimate(kyoto.bbox as CityMap['bbox'], 16, 16);
  assert.ok(n16 > 500 && n16 < 1500, String(n16));
  assert.ok(tileCountEstimate(kyoto.bbox as CityMap['bbox'], 10, 16) > n16);
});

test('tile path template is a plain file path', () => {
  assert.equal(tilePathTemplate('file:///var/mobile/Documents/maps/kyoto/'), '/var/mobile/Documents/maps/kyoto/tiles/{z}/{x}/{y}.png');
  assert.equal(tilePathTemplate('file:///a%20b/maps/kyoto'), '/a b/maps/kyoto/tiles/{z}/{x}/{y}.png');
});

test('overall progress: download then unpack', () => {
  assert.equal(overallProgress('download', 0), 0);
  assert.equal(overallProgress('download', 1), 0.75);
  assert.equal(overallProgress('unpack', 0.5), 0.875);
  assert.equal(overallProgress('unpack', 2), 1);
  assert.equal(overallProgress('download', NaN), 0);
});

// ---- T166: dark tile packs ----

const darkEntry = { file: 'kyoto-dark.tar', bytes: 30_000_000, sha256: 'B'.repeat(64), tiles: 811 };

test('T166: a city with a dark pack keeps it; without one nothing changes', () => {
  const c = parseCity({ ...kyoto, dark: darkEntry });
  assert.ok(c);
  assert.deepEqual(c.dark, { file: 'kyoto-dark.tar', bytes: 30_000_000, sha256: 'b'.repeat(64), tiles: 811 });
  assert.equal(darkPackUrl(c), 'https://github.com/MerlinWerlin/App-Projects/releases/download/satchel-maps-v1/kyoto-dark.tar');
  const plain = parseCity(kyoto);
  assert.ok(plain);
  assert.equal('dark' in plain, false);
  assert.equal(darkPackUrl(plain), null);
  // optional fields stay optional
  assert.deepEqual(parseDarkPack({ file: 'kyoto-dark.tar', bytes: 5 }), { file: 'kyoto-dark.tar', bytes: 5 });
  assert.deepEqual(parseDarkPack({ ...darkEntry, sha256: 'xyz', tiles: -1 }), { file: 'kyoto-dark.tar', bytes: 30_000_000 });
});

test('T166: a bad dark object is dropped, never the city', () => {
  for (const dark of [
    null,
    'kyoto-dark.tar',
    [darkEntry],
    { ...darkEntry, file: 'kyoto.tar' }, // not a -dark.tar
    { ...darkEntry, file: '../kyoto-dark.tar' },
    { ...darkEntry, file: 'https://evil.example/kyoto-dark.tar' },
    { ...darkEntry, file: 'dark/kyoto-dark.tar' },
    { ...darkEntry, file: 'Kyoto-dark.tar' },
    { ...darkEntry, file: 'kyoto-dark.tar.gz' },
    { ...darkEntry, bytes: 0 },
    { ...darkEntry, bytes: 5 * 1024 ** 3 },
    { ...darkEntry, bytes: 1.5 },
    { ...darkEntry, bytes: '30000000' },
    { file: 'kyoto-dark.tar' },
  ]) {
    const c = parseCity({ ...kyoto, dark });
    assert.ok(c, JSON.stringify(dark));
    assert.equal(c.dark, undefined, JSON.stringify(dark));
  }
  const cat = parseCatalog({ version: 1, cities: [{ ...kyoto, dark: { file: '../x-dark.tar', bytes: 1 } }] });
  assert.deepEqual(cat?.cities.map((c) => [c.id, c.dark]), [['kyoto', undefined]]);
});

test('T166: a dark pack writes only its meta.json and tiles; pois.json and anything unsafe are skipped', () => {
  assert.equal(darkPackEntryPath('meta.json'), 'meta.json');
  assert.equal(darkPackEntryPath('./tiles/16/58210/25803.png'), 'tiles/16/58210/25803.png');
  for (const bad of ['pois.json', '../tiles/1/0/0.png', 'tiles/21/0/0.png', 'dark/tiles/1/0/0.png', '.complete', 'tiles/10/1/2.jpg']) {
    assert.equal(darkPackEntryPath(bad), null, bad);
  }
  assert.equal(darkPackMetaOk({ id: 'kyoto', flavor: 'dark' }, 'kyoto'), true);
  assert.equal(darkPackMetaOk({ id: 'kyoto' }, 'kyoto'), false, 'a light meta.json is not a dark pack');
  assert.equal(darkPackMetaOk({ id: 'tokyo', flavor: 'dark' }, 'kyoto'), false);
  assert.equal(darkPackMetaOk(null, 'kyoto'), false);
});

test('T166: dark tiles sit in the city folder; dark mode uses them only when installed', () => {
  assert.equal(darkDirOf('file:///docs/maps/kyoto/'), 'file:///docs/maps/kyoto/dark/');
  assert.equal(darkDirOf('file:///docs/maps/kyoto'), 'file:///docs/maps/kyoto/dark/');
  assert.equal(tilePathTemplate(darkDirOf('file:///docs/maps/kyoto/')), '/docs/maps/kyoto/dark/tiles/{z}/{x}/{y}.png');
  const both = { pathTemplate: '/m/kyoto/tiles/{z}/{x}/{y}.png', darkPathTemplate: '/m/kyoto/dark/tiles/{z}/{x}/{y}.png' };
  assert.equal(tilePathForScheme(both, true), both.darkPathTemplate);
  assert.equal(tilePathForScheme(both, false), both.pathTemplate);
  assert.equal(tilePathForScheme({ pathTemplate: both.pathTemplate }, true), both.pathTemplate);
  assert.equal(tilePathForScheme({ pathTemplate: both.pathTemplate, darkPathTemplate: null }, true), both.pathTemplate);
});

test('T167: cityDiskBytes adds the dark tiles only when they are installed', () => {
  const c = { bytes: 16_000_000, dark: { file: 'sydney-dark.tar', bytes: 15_000_000 } };
  assert.equal(cityDiskBytes(c, false), 16_000_000);
  assert.equal(cityDiskBytes(c, true), 31_000_000);
  assert.equal(cityDiskBytes({ bytes: 16_000_000 }, true), 16_000_000);
  assert.equal(formatSize(cityDiskBytes(c, true)), '31 MB');
});
