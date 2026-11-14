import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { planReleases } from './release_assets.mjs';
import { buildPacks } from './build_packs.mjs';
import { applyArtworkCorrections, buildArtworkAdditions, checkedPath, digest, loadBaseline, readArtworkAdditions, webpSize } from './append_artwork.mjs';
import { cacheArtworkBaseline } from './cache_artwork_baseline.mjs';
import { plannedArtworkOptionIds, artworkSlotSources } from '../../src/core/artworkCoverage.ts';
import { parseWidgetOptions } from '../../src/core/widgetOptions.ts';

const WEBP = Buffer.from('UklGRlAAAABXRUJQVlA4TEMAAAAv/8P/AAfQyz53q/8BgUCyv/kERfQ/4z//+c9//vOf//znP//5z3/+85///Oc///nPf/7zn//85z//+c9//vOf//zfAA==', 'base64');
const SECOND_WEBP = Buffer.from('UklGRlAAAABXRUJQVlA4TEMAAAAv/8P/AAfQy271uf8BgUCyv/kERfQ/4z//+c9//vOf//znP//5z3/+85///Oc///nPf/7zn//85z//+c9//vOf//zfAA==', 'base64');
const save = (path, obj) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, JSON.stringify(obj, null, 2) + '\n'); };
function fixture(ids = ['artwork-example']) {
  const root = mkdtempSync(join(tmpdir(), 'glaze-append-'));
  const base = join(root, 'base'), add = join(root, 'add'), out = join(root, 'out');
  const palette = { bg: '#112233', tile: '#112233', glyph: '#FFFFFF', accent: '#AABBCC', text: '#FFFFFF' };
  const packs = [], records = [], originals = new Map();
  for (const id of ids) {
    const folder = `art/${id}/v7`, assets = [];
    for (const [i, role] of ['wallpaper', 'thumb', 'widget-art', 'widget-art', 'widget-art', 'widget-art'].entries()) {
      const bytes = Buffer.from(`original ${id} asset ${i}`), path = `asset-${i}.${digest(bytes).slice(0, 8)}.webp`;
      mkdirSync(join(base, folder), { recursive: true }); writeFileSync(join(base, folder, path), bytes);
      assets.push({ path, role, width: 1024, height: 1024, bytes: bytes.length, sha256: digest(bytes), mime: 'image/webp' });
    }
    const widgets = assets.slice(2).map((a, i) => ({ id: `piece-${i}`, kind: 'art', image: a.path, sizes: ['small', 'large'], fit: 'fit', background: 'wallpaper', label: `Piece ${i}` }));
    const m = { format: 'glaze-remote-art-pack', version: 2, id, packVersion: 7, name: id, plus: true, minAppVersion: '1.0.2', palette, meta: { name: id, tags: ['test'], mood: 'Quiet' }, thumbhash: 'AAAAAA==', assets, totalBytes: assets.reduce((n, a) => n + a.bytes, 0), widgets, retainedUnknownField: { value: 'do not drop' } };
    const manifest = `${folder}/manifest.json`; save(join(base, manifest), m); originals.set(id, m);
    const p = { id, name: id, packVersion: 7, plus: true, bytes: m.totalBytes, manifest, thumb: `${folder}/${assets[1].path}`, thumbhash: m.thumbhash, palette, tags: ['test'], mood: 'Quiet', addedAt: '2026-01-01', category: '', release: 'glaze-packs-v16' };
    packs.push(p); records.push({ id, manifest, packVersion: 7, release: p.release, sourceUrl: 'https://example.invalid/manifest', sha256: digest(readFileSync(join(base, manifest))), artwork: widgets.map((w) => w.id) });
    const image = `widget-new-piece.${digest(WEBP).slice(0, 8)}.webp`;
    save(join(add, id, 'widgets', 'widget-options.json'), [{ id: 'new-piece', kind: 'art', image, sizes: ['small', 'large'], fit: 'fit', background: 'wallpaper', label: 'New piece' }]);
    writeFileSync(join(add, id, 'widgets', image), WEBP);
  }
  save(join(base, 'catalog.json'), { format: 'glaze-catalog', version: 1, generatedAt: '2026-01-01T00:00:00.000Z', packs });
  save(join(base, 'baseline-lock.json'), { catalogUrl: 'https://github.com/MerlinWerlin/App-Projects/releases/download/glaze-packs-v5/catalog.json', catalogSha256: digest(readFileSync(join(base, 'catalog.json'))), packs: records });
  return { root, base, add, out, originals, opts: { basePacksDir: base, addArtDir: add, outDir: out, complete: true }, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test('append build preserves old bytes, metadata and slot order; increments once and repeats deterministically', async () => {
  const f = fixture();
  try {
    const r = await buildPacks(f.opts), id = 'artwork-example', old = f.originals.get(id);
    assert.equal(r.built.length, 1); assert.equal(r.built[0].release, 'glaze-packs-v18');
    const path = join(f.out, 'art', id, 'v8', 'manifest.json'), raw = readFileSync(path), m = JSON.parse(raw);
    assert.equal(m.packVersion, 8); assert.deepEqual(m.widgets.slice(0, 4), old.widgets); assert.deepEqual(m.assets.slice(0, 6), old.assets);
    for (const key of Object.keys(old).filter((k) => !['packVersion', 'assets', 'widgets', 'totalBytes'].includes(k))) assert.deepEqual(m[key], old[key]);
    for (const a of old.assets) assert.deepEqual(readFileSync(join(f.out, 'art', id, 'v8', a.path)), readFileSync(join(f.base, 'art', id, 'v7', a.path)));
    const ids = plannedArtworkOptionIds(id, parseWidgetOptions(m.widgets, m.assets).options);
    assert.deepEqual(ids, ['piece-0', 'piece-1', 'piece-2', 'piece-3', 'new-piece']);
    assert.ok(artworkSlotSources(ids).every((s) => s.source === 'artwork'));
    assert.equal(JSON.parse(readFileSync(join(f.out, 'artwork-build.json'))).complete, true);
    await buildPacks(f.opts); assert.deepEqual(readFileSync(path), raw);
    assert.equal(JSON.parse(readFileSync(join(f.base, 'art', id, 'v7', 'manifest.json'))).packVersion, 7);
  } finally { f.cleanup(); }
});

test('future release layout shards whole packs below the 1000-asset cap', async () => {
  const f = fixture(['artwork-one', 'artwork-two']);
  try {
    const r = await buildArtworkAdditions({ ...f.opts, releaseCapacity: 8 });
    assert.deepEqual(r.built.map((p) => p.release), ['glaze-packs-v18', 'glaze-packs-v19']);
    assert.equal(JSON.parse(readFileSync(join(f.out, 'artwork-build.json'))).catalogTag, 'glaze-packs-v5');
    const plans = planReleases(f.out, new Map(), { catalogTag: 'glaze-packs-v5' });
    assert.deepEqual(plans.map((p) => p.tag), ['glaze-packs-v18', 'glaze-packs-v19', 'glaze-packs-v5']);
    assert.deepEqual(plans.filter((p) => p.plan.some((a) => a.kind === 'catalog')).map((p) => p.tag), ['glaze-packs-v5']);
  } finally { f.cleanup(); }
});

test('baked-in functional images are retained as habits and replaced by additional real artwork', async () => {
  const f = fixture();
  try {
    const dir = join(f.add, 'artwork-example/widgets'), path = join(dir, 'widget-options.json');
    const list = JSON.parse(readFileSync(path)), image = `widget-second-piece.${digest(SECOND_WEBP).slice(0, 8)}.webp`;
    list.push({ ...list[0], id: 'second-piece', image, label: 'Second piece' }); save(path, list); writeFileSync(join(dir, image), SECOND_WEBP);
    const corrections = { 'artwork-example': { options: { 'piece-0': 'habits' } } };
    await buildArtworkAdditions({ ...f.opts, corrections });
    const m = JSON.parse(readFileSync(join(f.out, 'art/artwork-example/v8/manifest.json')));
    assert.deepEqual(m.widgets[0], { ...f.originals.get('artwork-example').widgets[0], kind: 'habits' });
    assert.deepEqual(m.assets.slice(0, 6), f.originals.get('artwork-example').assets);
    assert.deepEqual(plannedArtworkOptionIds(m.id, parseWidgetOptions(m.widgets, m.assets).options), ['piece-1', 'piece-2', 'piece-3', 'new-piece', 'second-piece']);
  } finally { f.cleanup(); }
});

test('partial builds retain untouched packs; --complete refuses a short pack before output writes', async () => {
  const f = fixture(['artwork-one', 'artwork-two']);
  try {
    await assert.rejects(buildPacks({ ...f.opts, only: new Set(['artwork-one']) }), /still needs artwork/);
    assert.equal(existsSync(f.out), false);
    const r = await buildPacks({ ...f.opts, complete: false, only: new Set(['artwork-one']) });
    assert.equal(r.catalog.packs[1].packVersion, 7);
    assert.deepEqual(JSON.parse(readFileSync(join(f.out, 'art/artwork-two/v7/manifest.json'))), f.originals.get('artwork-two'));
    await buildPacks(f.opts);
    assert.deepEqual(readdirSync(join(f.out, 'art/artwork-two')), ['v8'], 'later batches must remove the obsolete generated baseline folder');
    const plans = planReleases(f.out, new Map(), { catalogTag: 'glaze-packs-v5' });
    assert.equal(plans.reduce((n, p) => n + p.plan.length, 0), 17, 'only current-version assets and one catalogue enter the upload plan');
  } finally { f.cleanup(); }
});

test('corrupt catalogues, manifests and old assets are refused without replacing output', async () => {
  const f = fixture();
  try {
    const cat = join(f.base, 'catalog.json'), bytes = readFileSync(cat);
    writeFileSync(cat, Buffer.concat([bytes, Buffer.from(' ')])); assert.throws(() => loadBaseline(f.base), /catalogue hash/); writeFileSync(cat, bytes);
    const p = join(f.base, 'art/artwork-example/v7/manifest.json'), m = readFileSync(p);
    writeFileSync(p, Buffer.concat([m, Buffer.from(' ')])); assert.throws(() => loadBaseline(f.base), /manifest hash/); writeFileSync(p, m);
    mkdirSync(f.out); writeFileSync(join(f.out, 'retained.txt'), 'retain');
    writeFileSync(join(f.base, 'art/artwork-example/v7', f.originals.get('artwork-example').assets[0].path), 'bad');
    await assert.rejects(buildPacks(f.opts), /baseline asset integrity/); assert.equal(readFileSync(join(f.out, 'retained.txt'), 'utf8'), 'retain');
  } finally { f.cleanup(); }
});

test('new art contract rejects live metadata, wrong size, bad hash, duplicate ids and overfilling', () => {
  const f = fixture(), file = join(f.add, 'artwork-example/widgets/widget-options.json');
  try {
    const list = JSON.parse(readFileSync(file)), base = f.originals.get('artwork-example');
    for (const mutation of [ { kind: 'clock' }, { id: 'piece-0' }, { liveFrame: {} }, { sizes: ['small'] }, { background: 'theme' }, { image: '../escape.webp' } ]) {
      save(file, [{ ...list[0], ...mutation }]); assert.throws(() => readArtworkAdditions(f.add, base.id, base));
    }
    save(file, list);
    const path = join(dirname(file), list[0].image), bytes = readFileSync(path); writeFileSync(path, Buffer.concat([bytes, Buffer.from('bad')]));
    assert.throws(() => readArtworkAdditions(f.add, base.id, base), /hash mismatch/);
    writeFileSync(path, bytes); assert.throws(() => readArtworkAdditions(f.add, base.id, { ...base, assets: [...base.assets, { ...base.assets[0], sha256: digest(bytes) }] }), /duplicate artwork bytes/);
    save(file, [...list, list[0]]); assert.throws(() => readArtworkAdditions(f.add, base.id, base), /duplicate/);
  } finally { f.cleanup(); }
});

test('WebP dimensions and path traversal boundaries are validated', () => {
  assert.deepEqual(webpSize(WEBP), { width: 1024, height: 1024 });
  assert.throws(() => webpSize(WEBP.subarray(0, 30)), /container/);
  assert.throws(() => checkedPath(tmpdir(), '../escape'), /unsafe path/);
  assert.throws(() => checkedPath(tmpdir(), '.'), /unsafe path/);
});

test('cache verifies existing bytes and re-fetches corruption using pinned asset URLs', async () => {
  const f = fixture();
  try {
    const out = join(f.root, 'cache'), urls = [];
    const fetcher = async (url) => {
      urls.push(url); const name = url.slice(url.lastIndexOf('__') + 2);
      const bytes = readFileSync(join(f.base, 'art/artwork-example/v7', name));
      return { ok: true, arrayBuffer: async () => bytes };
    };
    const r = await cacheArtworkBaseline({ snapshotDir: f.base, outDir: out, fetcher, log: () => {} });
    assert.equal(r.downloaded, 6); assert.ok(urls.every((u) => u.includes('/glaze-packs-v16/art__artwork-example__v7__')));
    assert.equal((await cacheArtworkBaseline({ snapshotDir: f.base, outDir: out, fetcher, log: () => {} })).downloaded, 0);
    writeFileSync(join(out, 'art/artwork-example/v7', f.originals.get('artwork-example').assets[0].path), 'bad');
    assert.equal((await cacheArtworkBaseline({ snapshotDir: f.base, outDir: out, fetcher, log: () => {} })).downloaded, 1);
  } finally { f.cleanup(); }
});

test('committed baseline matches the actual consumer and retains 84 formerly omitted illustrations', () => {
  const baseline = loadBaseline(fileURLToPath(new URL('./artwork-baseline', import.meta.url)));
  assert.equal(baseline.manifests.size, 141); assert.equal(baseline.lock.additionsNeeded, 177);
  assert.deepEqual(baseline.lock.baselineCounts, { 2: 3, 3: 35, 4: 98, 5: 5 });
  const airmail = baseline.manifests.get('airmail-daydream');
  assert.ok(airmail.widgets.some((w) => w.id === 'art-20261106-paper-swallow'));
  const corrections = JSON.parse(readFileSync(new URL('./artwork-corrections.json', import.meta.url), 'utf8'));
  assert.equal(Object.keys(corrections).length, 22);
  const counts = [...baseline.manifests.values()].map((m) => {
    const corrected = applyArtworkCorrections(m, corrections);
    return plannedArtworkOptionIds(m.id, parseWidgetOptions(corrected.widgets, corrected.assets).options).length;
  });
  assert.equal(counts.filter((n) => n < 5).length, 139);
  assert.equal(counts.reduce((n, count) => n + 5 - count, 0), 199);
});
