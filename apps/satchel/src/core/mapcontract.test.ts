// T153: the contract between the city-pack pipeline (tools/maps: cities.json, build.mjs, pois.mjs and the publish
// workflow ops/github/satchel-maps-publish.yml) and the app (src/core/citymaps.ts, src/core/tar.ts, the toilets /
// help readers and src/native/cityMaps.ts). build.mjs needs network, MapLibre and pmtiles, so it is never imported:
// the shapes it writes are read from its text and mirrored here, and the test fails if the text changes.
// The tar half builds a real pack with the same GNU tar flags build.mjs uses (when `tar` is on the machine) and walks
// it the way the phone does (src/native/cityMaps.ts unpack). Contract written up in docs/MAP_PACKS.md.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { POIS_FORMAT, toPois, type OverpassElement } from '../../tools/maps/pois.mjs';
import {
  CATALOG_URL,
  MAPS_BASE_URL,
  MAPS_RELEASE,
  MAX_ZOOM,
  PACK_FORMAT,
  packEntryPath,
  packMetaToSave,
  packUrl,
  parseCatalog,
  parseCity,
  parsePackMeta,
  tileCountEstimate,
  tilePathTemplate,
  type BBox,
  type CityMap,
} from './citymaps.ts';
import { parsePackHelp } from './help.ts';
import { BLOCK, makeTar, nextHeaderOffset, parseTarHeader, utf8Encode } from './tar.ts';
import { parsePackToilets } from './toilets.ts';

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');
type CityCfg = { id: string; name: string; country: string; bbox: BBox; minzoom: number; maxzoom: number };
const cfg = JSON.parse(read('../../tools/maps/cities.json')) as { release: string; attribution: string; cities: CityCfg[] };
const build = read('../../tools/maps/build.mjs');
const workflow = read('../../ops/github/satchel-maps-publish.yml');
const REPO = 'MerlinWerlin/App-Projects';

// ---- mirrors of build.mjs (kept honest by the text checks below) ----

const lon2x = (lon: number, z: number) => Math.floor(((lon + 180) / 360) * 2 ** z);
const lat2y = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
};
function tilesFor(bbox: BBox, z: number): [number, number, number][] {
  const [w, s, e, n] = bbox;
  const out: [number, number, number][] = [];
  for (let x = lon2x(w, z); x <= lon2x(e, z); x++) for (let y = lat2y(n, z); y <= lat2y(s, z); y++) out.push([z, x, y]);
  return out;
}
const META_KEYS = ['id', 'format', 'name', 'country', 'bbox', 'center', 'minzoom', 'maxzoom', 'file', 'tiles', 'pois', 'attribution', 'built'];
function pipelineMeta(city: CityCfg, tiles: number, pois: number) {
  const [w, s, e, n] = city.bbox;
  const center = [+((w + e) / 2).toFixed(5), +((s + n) / 2).toFixed(5)];
  const file = `${city.id}.tar`;
  return { id: city.id, format: POIS_FORMAT, name: city.name, country: city.country, bbox: city.bbox, center, minzoom: city.minzoom, maxzoom: city.maxzoom, file, tiles, pois, attribution: cfg.attribution, built: '2026-11-01' };
}
/** The GNU tar call in build.mjs, with its list file and folder filled in. */
const TAR_FLAGS = ['--format=ustar', '--owner=0', '--group=0', '--numeric-owner', '--no-recursion', '-cf'];

/** What src/native/cityMaps.ts unpack() does with a pack, on bytes in memory: entries it writes, and why it stops. */
function walkLikePhone(tar: Uint8Array): { written: Map<string, Uint8Array>; skipped: string[]; outcome: 'ok' | 'bad-pack' } {
  const written = new Map<string, Uint8Array>();
  const skipped: string[] = [];
  let off = 0;
  while (off + BLOCK <= tar.length) {
    const h = parseTarHeader(tar.subarray(off, off + BLOCK));
    if (h === 'end') break;
    if (typeof h === 'string') return { written, skipped, outcome: 'bad-pack' };
    if (off + BLOCK + h.size > tar.length) return { written, skipped, outcome: 'bad-pack' };
    const rel = h.type === 'file' ? packEntryPath(h.name) : null;
    if (rel) written.set(rel, tar.subarray(off + BLOCK, off + BLOCK + h.size));
    else skipped.push(h.name);
    off = nextHeaderOffset(off, h.size);
  }
  return { written, skipped, outcome: written.has('meta.json') ? 'ok' : 'bad-pack' };
}

const decode = (b: Uint8Array) => Buffer.from(b).toString('utf8');
const OVERPASS: OverpassElement[] = [
  { type: 'node', id: 1, lat: 35.0, lon: 135.76, tags: { amenity: 'toilets', wheelchair: 'yes' } },
  { type: 'way', id: 2, center: { lat: 35.01, lon: 135.77 }, tags: { amenity: 'pharmacy', name: 'Kusuri', phone: '+81 75 000 0000' } },
  { type: 'node', id: 3, lat: 35.02, lon: 135.75, tags: { amenity: 'police', name: 'Koban' } },
];

// ---- release, URLs and file names ----

test('contract: release tag, catalog URL and pack URLs match the pipeline and the publish workflow', () => {
  assert.equal(cfg.release, MAPS_RELEASE);
  assert.equal(CATALOG_URL, `https://github.com/${REPO}/releases/download/${cfg.release}/catalog.json`);
  assert.equal(MAPS_BASE_URL, `https://github.com/${REPO}/releases/download/${MAPS_RELEASE}/`);
  // the workflow's default tag, its repo and its own download check use the same URL shape
  assert.match(workflow, new RegExp(`default: '${MAPS_RELEASE}'`));
  assert.ok(workflow.includes(REPO), 'workflow installs in App-Projects');
  assert.ok(workflow.includes('https://github.com/$R/releases/download/$TAG/catalog.json'));
  assert.ok(workflow.includes('working-directory: apps/satchel/tools/maps'));
  // packs first, catalog.json last (the app only lists what the catalog names)
  assert.ok(workflow.indexOf('upload-1-packs.txt') < workflow.indexOf('--clobber catalog.json'));
  assert.ok(build.includes("writeFileSync(join(OUT, 'catalog.json')"));
  // asset names: <id>.tar next to catalog.json in the release
  assert.ok(build.includes('const file = `${city.id}.tar`;'));
  for (const c of cfg.cities) {
    const city = parseCity({ ...pipelineMeta(c, 1, 0), bytes: 1 }) as CityMap;
    assert.ok(city, c.id);
    assert.equal(packUrl(city), `${MAPS_BASE_URL}${c.id}.tar`);
  }
});

// ---- catalog.json and meta.json ----

test('contract: build.mjs meta.json keys and catalog entry shape are what the app parses', () => {
  const m = /const meta = \{ ([^}]*) \};/.exec(build);
  assert.ok(m, 'build.mjs builds meta in one object literal');
  const keys = m[1].split(',').map((k) => k.trim().split(':')[0].trim());
  assert.deepEqual(keys, META_KEYS);
  assert.ok(build.includes('catalog.cities.push({ ...meta, bytes, sha256 });'));
  assert.ok(build.includes('const bytes = statSync(tar).size;'));
  assert.ok(build.includes("createHash('sha256').update(readFileSync(tar)).digest('hex')"));
  assert.match(build, /const catalog = \{ version: 1, release: cfg\.release, built: BUILT, attribution: cfg\.attribution, cities: \[\] \};/);
  assert.equal(POIS_FORMAT, PACK_FORMAT, 'the app reads the newest pack format the pipeline writes');

  const entries = cfg.cities.map((c) => {
    const tiles = tileCountEstimate(c.bbox, c.minzoom, c.maxzoom);
    return { ...pipelineMeta(c, tiles, 42), bytes: 40_000_000 + tiles, sha256: 'ab'.repeat(32) };
  });
  const catalog = parseCatalog({ version: 1, release: cfg.release, built: '2026-11-01', attribution: cfg.attribution, cities: entries });
  assert.ok(catalog);
  assert.deepEqual(catalog.cities.map((c) => c.id), cfg.cities.map((c) => c.id), 'every city in cities.json is listed');
  assert.equal(catalog.release, MAPS_RELEASE);
  assert.equal(catalog.attribution, cfg.attribution);
  for (const c of catalog.cities) {
    assert.equal(c.format, POIS_FORMAT);
    assert.ok(c.maxzoom <= MAX_ZOOM);
    assert.equal(c.sha256, 'ab'.repeat(32));
  }

  // meta.json inside the tar has no bytes / sha256 (they describe the tar). The T153 mismatch: parseCity alone
  // rejects it, so every download ended 'bad-pack'. parsePackMeta takes them from the catalog entry.
  for (const [i, c] of cfg.cities.entries()) {
    const meta = pipelineMeta(c, 10, 3);
    const entry: CityMap = catalog.cities[i];
    assert.equal(parseCity(meta), null, 'meta.json alone has no bytes');
    const city = parsePackMeta(meta, entry);
    assert.ok(city, c.id);
    assert.equal(city.bytes, entry.bytes);
    assert.equal(city.sha256, entry.sha256);
    assert.equal(city.tiles, 10);
    assert.equal(parsePackMeta(meta, { ...entry, id: 'elsewhere' }), null, 'a pack for another city is refused');
    // what the phone saves back reads on its own later (listInstalled)
    const saved = JSON.parse(JSON.stringify(packMetaToSave(meta, city)));
    assert.deepEqual(parseCity(saved), city);
    assert.equal(saved.built, '2026-11-01', 'pack fields are kept');
  }
  // a meta.json that does carry bytes keeps its own number
  assert.equal(parsePackMeta({ ...pipelineMeta(cfg.cities[0], 1, 0), bytes: 7 }, catalog.cities[0])?.bytes, 7);
  assert.equal(parsePackMeta(null, catalog.cities[0]), null);
});

// ---- tiles ----

test('contract: tile layout, extension, zooms and tile size agree', () => {
  assert.ok(build.includes("writeFileSync(join(dir, 'tiles', String(tz), String(x), `${y}.png`), png);"));
  assert.ok(build.includes("execFileSync('find', ['tiles', '-type', 'f', '-name', '*.png']"));
  assert.ok(build.includes("['meta.json', 'pois.json', ...list]"));
  assert.ok(build.includes('width: 256 * RATIO, height: 256 * RATIO'), '256-pt tiles');
  assert.ok(read('../native/maps.tsx').includes('<LocalTile pathTemplate={tiles.pathTemplate} tileSize={256} />'));
  assert.equal(tilePathTemplate('file:///var/mobile/Documents/maps/kyoto/'), '/var/mobile/Documents/maps/kyoto/tiles/{z}/{x}/{y}.png');
  for (const c of cfg.cities) {
    assert.ok(c.minzoom >= 0 && c.maxzoom <= MAX_ZOOM, c.id);
    let count = 0;
    for (let z = c.minzoom; z <= c.maxzoom; z++) {
      for (const [tz, x, y] of tilesFor(c.bbox, z)) {
        const p = `tiles/${tz}/${x}/${y}.png`;
        assert.equal(packEntryPath(p), p, p);
        assert.ok(utf8Encode(p).length <= 100, 'fits a plain ustar name');
        count++;
      }
    }
    // the meta.json `tiles` count is what the app's own estimate says
    assert.equal(count, tileCountEstimate(c.bbox, c.minzoom, c.maxzoom), c.id);
  }
});

// ---- a real pack through the phone's unpack walk ----

function packFiles(dir: string, city: CityCfg) {
  mkdirSync(join(dir, 'tiles'), { recursive: true });
  const tiles: string[] = [];
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
  for (let z = city.minzoom; z <= city.minzoom + 1; z++) {
    for (const [tz, x, y] of tilesFor(city.bbox, z)) {
      mkdirSync(join(dir, 'tiles', String(tz), String(x)), { recursive: true });
      writeFileSync(join(dir, 'tiles', String(tz), String(x), `${y}.png`), png);
      tiles.push(`tiles/${tz}/${x}/${y}.png`);
    }
  }
  const pois = toPois(OVERPASS, '2026-11-01');
  const meta = pipelineMeta(city, tiles.length, pois.toilets.length + pois.places.length);
  writeFileSync(join(dir, 'meta.json'), JSON.stringify(meta));
  writeFileSync(join(dir, 'pois.json'), JSON.stringify(pois));
  return { tiles: tiles.sort(), meta, pois };
}

function checkPack(tar: Uint8Array, city: CityCfg, tiles: string[]) {
  const { written, skipped, outcome } = walkLikePhone(tar);
  assert.equal(outcome, 'ok');
  assert.deepEqual(skipped, [], 'every entry the pipeline writes is one the phone keeps');
  assert.deepEqual([...written.keys()], ['meta.json', 'pois.json', ...tiles]);
  const entry = { id: city.id, bytes: tar.length, sha256: createHash('sha256').update(tar).digest('hex') };
  const meta = parsePackMeta(JSON.parse(decode(written.get('meta.json')!)), entry);
  assert.ok(meta, 'the phone accepts the meta.json');
  assert.equal(meta.bytes, tar.length);
  assert.equal(meta.tiles, tiles.length);
  const pois = decode(written.get('pois.json')!);
  assert.equal(parsePackToilets(pois).length, 1, 'Toilets reads the toilets');
  assert.deepEqual(parsePackHelp(pois).map((p) => p.category).sort(), ['pharmacy', 'police']);
  assert.equal(written.get(tiles[0])![0], 0x89, 'tile bodies come through unchanged');
}

test('contract: a pack made with build.mjs GNU tar flags unpacks on the phone', (t) => {
  assert.ok(build.includes(`execFileSync('tar', [${TAR_FLAGS.map((f) => `'${f}'`).join(', ')}, tar, '-C', dir, '-T',`), 'build.mjs tar flags');
  try {
    execFileSync('tar', ['--version'], { stdio: 'ignore' });
  } catch {
    t.skip('no tar on this machine');
    return;
  }
  const root = mkdtempSync(join(tmpdir(), 'satchel-pack-'));
  try {
    const city = cfg.cities.find((c) => c.id === 'kyoto') ?? cfg.cities[0];
    const dir = join(root, city.id);
    const { tiles } = packFiles(dir, city);
    const list = join(root, `${city.id}.list`);
    writeFileSync(list, ['meta.json', 'pois.json', ...tiles].join('\n') + '\n');
    const tarPath = join(root, `${city.id}.tar`);
    execFileSync('tar', [...TAR_FLAGS, tarPath, '-C', dir, '-T', list]);
    checkPack(new Uint8Array(readFileSync(tarPath)), city, tiles);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('contract: the same pack from the in-repo tar writer (no tar needed), plus a stray entry is skipped', () => {
  const city = cfg.cities[0];
  const pois = toPois(OVERPASS, '2026-11-01');
  const tiles = tilesFor(city.bbox, city.minzoom).map(([z, x, y]) => `tiles/${z}/${x}/${y}.png`).sort();
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47]);
  const tar = makeTar([
    { name: 'meta.json', body: utf8Encode(JSON.stringify(pipelineMeta(city, tiles.length, 3))) },
    { name: 'pois.json', body: utf8Encode(JSON.stringify(pois)) },
    ...tiles.map((name) => ({ name, body: png })),
  ]);
  checkPack(tar, city, tiles);
  const stray = makeTar([
    { name: 'meta.json', body: utf8Encode(JSON.stringify(pipelineMeta(city, 0, 0))) },
    { name: '../evil.png', body: png },
    { name: 'tiles/10/1/1.jpg', body: png },
  ]);
  const r = walkLikePhone(stray);
  assert.equal(r.outcome, 'ok');
  assert.deepEqual(r.skipped, ['../evil.png', 'tiles/10/1/1.jpg']);
});

test('contract: src/native/cityMaps.ts installs through parsePackMeta and saves the merged meta.json', () => {
  const src = read('../native/cityMaps.ts');
  assert.ok(src.includes('meta = parsePackMeta(rawMeta, city);'));
  assert.ok(src.includes('JSON.stringify(packMetaToSave(rawMeta, meta))'));
  assert.ok(src.indexOf('packMetaToSave(rawMeta, meta)') < src.indexOf("writeAsStringAsync(`${dir}.complete`"), 'meta saved before .complete');
  assert.ok(src.includes('if (res.status === 404) failure = \'not-published\';'), 'honest being-published state');
});
