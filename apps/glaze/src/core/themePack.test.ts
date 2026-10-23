import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { sha256Hex } from './bytes.ts';
import {
  EMPTY_CACHE_INDEX,
  buildPack,
  cacheEntryFor,
  cacheIndexAdd,
  cacheIndexRemove,
  compareVersions,
  decodeArtAsset,
  formatBytes,
  isPackDownloaded,
  isSafeAssetPath,
  packFileUrl,
  parseCacheIndex,
  parsePackManifest,
  planDownload,
  supportsApp,
  themeToData,
  themesFromPack,
  totalCacheBytes,
  verifyAsset,
  type PackManifest,
} from './themePack.ts';
import { AURORA_PACK_ID, NEW_PLUS_THEMES } from './themesNew.ts';

const FIXTURE = join(process.cwd(), 'src', 'core', '__fixtures__', 'packs', AURORA_PACK_ID);
const gz = (b: Uint8Array) => gzipSync(b, { level: 9 });

function fixtureManifest(): PackManifest {
  const r = parsePackManifest(readFileSync(join(FIXTURE, 'manifest.json'), 'utf8'));
  assert.ok(r.ok, r.ok ? '' : r.errors.join('\n'));
  return r.value;
}

function built(): PackManifest {
  return JSON.parse(JSON.stringify(buildPack({ id: AURORA_PACK_ID, name: 'Aurora', minAppVersion: '0.1.0', themes: NEW_PLUS_THEMES }, gz).manifest));
}

function dirBytes(dir: string): number {
  let n = 0;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    n += statSync(p).isDirectory() ? dirBytes(p) : statSync(p).size;
  }
  return n;
}

// ------------------------------------------------------------ fixture

test('the fixture pack is current (rebuild with: node ops/build-pack.ts) and small', () => {
  const m = fixtureManifest();
  assert.equal(m.id, AURORA_PACK_ID);
  assert.equal(m.themes.length, 8);
  // Theme metadata matches the source themes (minus the art, which lives in the assets).
  assert.deepEqual(
    m.themes.map(({ thumbAsset: _t, ...d }) => d),
    NEW_PLUS_THEMES.map((t) => JSON.parse(JSON.stringify(themeToData(t)))),
  );
  for (const a of m.assets) {
    const bytes = readFileSync(join(FIXTURE, a.path));
    assert.equal(bytes.length, a.bytes, a.path);
    assert.equal(sha256Hex(bytes), a.sha256, a.path);
  }
  // Every theme rebuilds exactly from the manifest + its decoded art asset.
  const themes = themesFromPack(m, (p) => readFileSync(join(FIXTURE, p)));
  assert.deepEqual(JSON.parse(JSON.stringify(themes)), JSON.parse(JSON.stringify(NEW_PLUS_THEMES)));
  assert.ok(dirBytes(FIXTURE) < 200_000, `${dirBytes(FIXTURE)} bytes`);
  // The bulk of the pack is in the assets, not the manifest.
  assert.ok(m.totalBytes > readFileSync(join(FIXTURE, 'manifest.json')).length);
});

test('art assets carry the vector layers of every motif they use and decode in pure TS', () => {
  const m = fixtureManifest();
  for (const d of m.themes) {
    const asset = decodeArtAsset(readFileSync(join(FIXTURE, d.artAsset)));
    assert.equal(asset.themeId, d.id);
    const used = new Set([...asset.art.motifs, ...asset.art.stickers.map((s) => s.motif)]);
    assert.deepEqual(Object.keys(asset.motifs).sort(), [...used].sort());
    for (const layers of Object.values(asset.motifs)) assert.ok(layers.length >= 1 && layers.every((l) => l.d.length > 0));
    assert.ok(d.thumbAsset && readFileSync(join(FIXTURE, d.thumbAsset)).subarray(1, 4).toString() === 'PNG');
  }
  assert.throws(() => decodeArtAsset(gz(Buffer.from('{"format":"nope"}'))));
});

test('buildPack refuses free themes or themes of another pack', () => {
  const free = { ...NEW_PLUS_THEMES[0], plus: false };
  assert.throws(() => buildPack({ id: AURORA_PACK_ID, name: 'X', minAppVersion: '0.1.0', themes: [free] }, gz));
  assert.throws(() => buildPack({ id: 'other-pack', name: 'X', minAppVersion: '0.1.0', themes: NEW_PLUS_THEMES }, gz));
});

// ------------------------------------------------------------ validation

test('parsePackManifest accepts a built manifest and rejects format, version and junk', () => {
  assert.ok(parsePackManifest(built()).ok);
  const bad = (m: unknown, re: RegExp) => {
    const r = parsePackManifest(m);
    assert.equal(r.ok, false);
    if (!r.ok) assert.ok(r.errors.some((e) => re.test(e)), r.errors.join('\n'));
  };
  bad('not json', /not JSON/);
  bad(null, /not an object/);
  bad({ ...built(), format: 'zip' }, /unknown format/);
  bad({ ...built(), version: 2 }, /unsupported version/);
  bad({ ...built(), version: '1' }, /unsupported version/);
  bad({ ...built(), version: 1.5 }, /unsupported version/);
  bad({ ...built(), plus: false }, /plus/);
  bad({ ...built(), id: '../x' }, /pack id/);
  bad({ ...built(), minAppVersion: 'soon' }, /minAppVersion/);
  bad({ ...built(), totalBytes: built().totalBytes + 1 }, /totalBytes/);
});

test('parsePackManifest rejects path traversal, absolute paths, duplicates and size mismatches', () => {
  for (const path of ['../evil.gz', 'art/../../evil', '/etc/passwd', 'C:/x.gz', 'art\\x.gz', 'art/./x.gz', 'art//x.gz', 'https://x.test/a', 'manifest.json', '']) {
    const m = built();
    m.assets[0] = { ...m.assets[0], path };
    const r = parsePackManifest(m);
    assert.equal(r.ok, false, path);
  }
  {
    const m = built();
    m.assets[1] = { ...m.assets[1], path: m.assets[0].path };
    const r = parsePackManifest(m);
    assert.ok(!r.ok && r.errors.some((e) => /duplicate path/.test(e)));
  }
  {
    const m = built();
    m.themes[1] = { ...m.themes[1], id: m.themes[0].id };
    const r = parsePackManifest(m);
    assert.ok(!r.ok && r.errors.some((e) => /duplicate id/.test(e)));
  }
  {
    const m = built();
    m.assets[0] = { ...m.assets[0], bytes: m.assets[0].bytes + 10 };
    assert.equal(parsePackManifest(m).ok, false, 'asset size disagrees with totalBytes');
    m.totalBytes += 10;
    assert.equal(parsePackManifest(m).ok, true, 'consistent sizes pass validation; verifyAsset catches the file');
  }
  for (const mutate of [
    (m: PackManifest) => (m.assets[0].sha256 = 'abc'),
    (m: PackManifest) => (m.assets[0].bytes = -1),
    (m: PackManifest) => (m.themes[0].artAsset = 'art/missing.json.gz'),
    (m: PackManifest) => ((m.themes[0] as unknown as Record<string, unknown>).art = NEW_PLUS_THEMES[0].art),
    (m: PackManifest) => (m.themes[0].packId = 'another'),
    (m: PackManifest) => ((m.themes[0] as unknown as Record<string, unknown>).categories = ['brand-x']),
  ]) {
    const m = built();
    mutate(m);
    m.totalBytes = m.assets.reduce((n, a) => n + (a.bytes > 0 ? a.bytes : 0), 0);
    assert.equal(parsePackManifest(m).ok, false, mutate.toString());
  }
  assert.ok(isSafeAssetPath('thumbs/a-b_c.png'));
});

test('versions and URLs', () => {
  assert.equal(compareVersions('1.2.0', '1.10'), -1);
  assert.equal(compareVersions('2', '1.9.9'), 1);
  assert.equal(compareVersions('0.1.0', '0.1'), 0);
  assert.ok(supportsApp({ minAppVersion: '0.1.0' }, '0.1.0'));
  assert.ok(!supportsApp({ minAppVersion: '1.0.0' }, '0.9.9'));
  assert.equal(packFileUrl('https://cdn.test/packs///', 'pack-a', 'art/x y.json.gz'), 'https://cdn.test/packs/pack-a/art/x%20y.json.gz');
});

// ------------------------------------------------------------ resume planning and integrity

test('planDownload: fetch missing, resume partial with a Range offset, keep verified, discard bad', () => {
  const m = built();
  const [a, b, c, d, e] = m.assets;
  const plan = planDownload(m, [
    { path: a.path, bytes: a.bytes, sha256: a.sha256 }, // complete
    { path: b.path, bytes: 100 }, // partial
    { path: c.path, bytes: c.bytes, sha256: '0'.repeat(64) }, // full size, wrong hash
    { path: d.path, bytes: d.bytes + 5 }, // too long
    { path: e.path, bytes: e.bytes }, // full size, unhashed
    { path: 'art/old-theme.json.gz', bytes: 10 }, // not in the manifest any more
  ]);
  assert.deepEqual(plan.complete, [a.path]);
  assert.deepEqual(plan.verify, [e.path]);
  assert.deepEqual(plan.discard.sort(), [c.path, d.path, 'art/old-theme.json.gz'].sort());
  const fetch = new Map(plan.fetch.map((f) => [f.path, f]));
  assert.equal(fetch.get(b.path)?.start, 100);
  assert.equal(fetch.get(c.path)?.start, 0);
  assert.equal(fetch.get(d.path)?.start, 0);
  assert.ok(!fetch.has(a.path) && !fetch.has(e.path));
  assert.equal(plan.fetch.length, m.assets.length - 2);
  const expected = m.assets.filter((x) => x !== a && x !== e).reduce((n, x) => n + x.bytes, 0) - 100;
  assert.equal(plan.bytesToFetch, expected);
  // Nothing on disk: everything from 0.
  const fresh = planDownload(m, []);
  assert.equal(fresh.bytesToFetch, m.totalBytes);
  assert.ok(fresh.fetch.every((f) => f.start === 0));
});

test('verifyAsset checks size then SHA-256', () => {
  const bytes = new Uint8Array([1, 2, 3, 4]);
  const asset = { path: 'a.bin', bytes: 4, sha256: sha256Hex(bytes) };
  assert.deepEqual(verifyAsset(asset, bytes), { ok: true });
  assert.deepEqual(verifyAsset(asset, bytes.subarray(0, 3)), { ok: false, reason: 'size' });
  assert.deepEqual(verifyAsset(asset, new Uint8Array([1, 2, 3, 5])), { ok: false, reason: 'hash' });
});

// ------------------------------------------------------------ cache index and sizes

test('cache index: add, replace, remove, total, sanitise', () => {
  const m = built();
  const now = new Date('2026-10-16T09:00:00Z');
  let idx = cacheIndexAdd(EMPTY_CACHE_INDEX, cacheEntryFor(m, now));
  assert.equal(idx.packs.length, 1);
  assert.equal(totalCacheBytes(idx), m.totalBytes);
  assert.ok(isPackDownloaded(idx, AURORA_PACK_ID));
  assert.ok(!isPackDownloaded(idx, undefined));
  idx = cacheIndexAdd(idx, { ...cacheEntryFor(m, now), bytes: 10 });
  assert.equal(idx.packs.length, 1, 're-download replaces');
  idx = cacheIndexAdd(idx, { id: 'b-pack', name: 'Autumn', version: 1, bytes: 5, themeIds: [], downloadedAt: '' });
  assert.deepEqual(idx.packs.map((p) => p.name), ['Aurora', 'Autumn']);
  assert.equal(totalCacheBytes(idx), 15);
  assert.deepEqual(parseCacheIndex(JSON.stringify(idx)), idx);
  idx = cacheIndexRemove(idx, AURORA_PACK_ID);
  assert.deepEqual(idx.packs.map((p) => p.id), ['b-pack']);
  assert.equal(EMPTY_CACHE_INDEX.packs.length, 0, 'the empty index is never mutated');
  assert.deepEqual(parseCacheIndex('nope'), { version: 1, packs: [] });
  assert.deepEqual(parseCacheIndex({ packs: [{ id: '../x', name: 'x', bytes: 1 }, { id: 'ok', name: 'Ok', bytes: -1 }, 7] }).packs, []);
});

test('formatBytes uses decimal units and the locale', () => {
  assert.equal(formatBytes(0, 'en'), '0 bytes');
  assert.equal(formatBytes(999, 'en'), '999 bytes');
  assert.equal(formatBytes(1500, 'en'), '1.5 kB');
  assert.equal(formatBytes(23_400, 'en'), '23 kB');
  assert.equal(formatBytes(4_200_000, 'en'), '4.2 MB');
  assert.equal(formatBytes(1_000_000_000, 'en'), '1 GB');
  assert.equal(formatBytes(1500, 'de'), '1,5 kB');
  assert.equal(formatBytes(NaN, 'en'), '0 bytes');
  assert.ok(formatBytes(2_500_000, 'fr').includes('2,5'));
});
