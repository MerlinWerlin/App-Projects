// Glaze art-fit pack builder (scripts/packs/art_fit_packs.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildFit, readFits } from './art_fit_packs.mjs';

const sha = (b) => createHash('sha256').update(b).digest('hex');
/** A minimal lossless (VP8L) WebP container of the given size: enough for webpSize(). */
function webp(w, h, salt = 0) {
  const payload = Buffer.alloc(6);
  payload[0] = 0x2f;
  payload.writeUInt32LE(((w - 1) | ((h - 1) << 14)) >>> 0, 1);
  payload[5] = salt;
  const chunk = Buffer.concat([Buffer.from('VP8L'), Buffer.from([payload.length, 0, 0, 0]), payload]);
  const body = Buffer.concat([Buffer.from('WEBP'), chunk]);
  const head = Buffer.alloc(8);
  head.write('RIFF', 0);
  head.writeUInt32LE(body.length, 4);
  return Buffer.concat([head, body]);
}
const PAL = { bg: '#FEBEAA', tile: '#DEA795', glyph: '#1C1816', accent: '#FDB8AE', text: '#1C1816' };
function base() {
  const spec = [
    ['wallpaper-2796.aaaa0000.webp', 'wallpaper', 1290, 2796],
    ['thumb.bbbb0000.webp', 'thumb', 240, 520],
    ['widget-small.cccc0000.webp', 'widget-small', 510, 510],
    ['widget-boat.dddd0000.webp', 'widget-art', 1024, 1024],
    ['widget-kite.eeee0000.webp', 'widget-art', 1024, 1024],
  ];
  const files = new Map(spec.map(([p, , w, h], i) => [p, webp(w, h, i)]));
  const assets = spec.map(([path, role, width, height]) => ({ path, role, width, height, bytes: files.get(path).length, sha256: sha(files.get(path)), mime: 'image/webp' }));
  const m = {
    format: 'glaze-remote-art-pack', version: 2, id: 'cloud-x', packVersion: 7, name: 'Cloud X', plus: false, minAppVersion: '1.0.2', palette: PAL, meta: { name: 'Cloud X' }, thumbhash: 'AbCd',
    assets, totalBytes: assets.reduce((n, a) => n + a.bytes, 0),
    widgets: [
      { id: 'boat', kind: 'art', image: 'widget-boat.dddd0000.webp', sizes: ['small', 'medium', 'large'], fit: 'fit', background: 'blur', label: 'Boat' },
      { id: 'hero-small', kind: 'art', image: 'widget-small.cccc0000.webp', sizes: ['small', 'medium', 'large'], fit: 'fit', background: 'wallpaper' },
      { id: 'kite', kind: 'art', image: 'widget-kite.eeee0000.webp', sizes: ['small'], fit: 'fit', background: 'blur', label: 'Kite' },
    ],
  };
  return { m, files };
}

test('buildFit replaces only the named art, keeps order, bumps the version and drops orphaned art', () => {
  const { m, files } = base();
  const art = { 'dove.webp': webp(1024, 1024, 40), 'seed.webp': webp(1024, 1024, 41) };
  const fit = { theme: 'cloud-x', base: { packVersion: 7 }, replace: [{ from: 'boat', id: 'white-dove', label: 'White dove', file: 'dove.webp' }, { from: 'hero-small', id: 'hero-small', file: 'seed.webp' }] };
  const { manifest, files: out } = buildFit(fit, m, files, (f) => art[f]);
  assert.equal(manifest.packVersion, 8);
  assert.deepEqual(manifest.widgets.map((w) => w.id), ['white-dove', 'hero-small', 'kite']);
  assert.equal(manifest.widgets[0].background, 'wallpaper');
  assert.equal(manifest.widgets[0].label, 'White dove');
  assert.deepEqual(manifest.widgets[0].sizes, ['small', 'medium', 'large']);
  assert.deepEqual(manifest.widgets[2], m.widgets[2], 'untouched widget unchanged');
  assert.ok(!manifest.assets.some((a) => a.path === 'widget-boat.dddd0000.webp'), 'replaced art dropped');
  assert.ok(manifest.assets.some((a) => a.path === 'widget-kite.eeee0000.webp'), 'kept art stays');
  assert.equal(manifest.assets.filter((a) => a.role === 'widget-small').length, 1);
  assert.equal(manifest.totalBytes, manifest.assets.reduce((n, a) => n + a.bytes, 0));
  for (const a of manifest.assets) assert.equal(sha(out.get(a.path)), a.sha256);
  assert.equal(m.packVersion, 7, 'base manifest not mutated');
});

test('buildFit refuses a wrong base version or an unknown widget', () => {
  const { m, files } = base();
  const art = () => webp(1024, 1024, 9);
  assert.throws(() => buildFit({ theme: 'cloud-x', base: { packVersion: 6 }, replace: [{ from: 'boat', id: 'a', file: 'a.webp' }] }, m, files, art), /base version/);
  assert.throws(() => buildFit({ theme: 'cloud-x', base: { packVersion: 7 }, replace: [{ from: 'nope', id: 'a', file: 'a.webp' }] }, m, files, art), /no widget nope/);
});

test('every committed pack-artwork-fit/<id>/fit.json reads and names its art files', () => {
  const dir = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'pack-artwork-fit');
  if (!existsSync(dir)) return;
  const fits = readFits(dir);
  assert.equal(fits.length, readdirSync(dir).filter((d) => existsSync(join(dir, d, 'fit.json'))).length);
});

// Owner 2026-11-27: 2 medium + 2 large artworks per theme (Artwork 6-7 / 8-9).
test('buildFit replaces hero-medium / hero-large in their roles and adds medium / large art options', () => {
  const { m, files } = base();
  const add = [
    ['widget-medium.ffff0000.webp', 'widget-medium', 1092, 510],
    ['widget-large.abab0000.webp', 'widget-large', 1092, 1146],
  ];
  for (const [path, role, w, h] of add) {
    const b = webp(w, h, 30 + w);
    files.set(path, b);
    m.assets.push({ path, role, width: w, height: h, bytes: b.length, sha256: sha(b), mime: 'image/webp' });
  }
  m.widgets.push({ id: 'hero-medium', kind: 'art', image: 'widget-medium.ffff0000.webp', sizes: ['medium', 'small', 'large'], fit: 'fit', background: 'wallpaper' });
  m.widgets.push({ id: 'hero-large', kind: 'art', image: 'widget-large.abab0000.webp', sizes: ['large', 'small', 'medium'], fit: 'fit', background: 'wallpaper' });
  const art = { 'comet.webp': webp(1092, 510, 41), 'meteor.webp': webp(1092, 510, 42), 'nebula.webp': webp(1092, 1146, 43), 'pleiades.webp': webp(1092, 1146, 44) };
  const fit = {
    theme: 'cloud-x', base: { packVersion: 7 },
    replace: [{ from: 'hero-medium', id: 'comet', label: 'Comet', file: 'comet.webp' }, { from: 'hero-large', id: 'nebula', label: 'Nebula', file: 'nebula.webp' }],
    add: [{ id: 'meteor', size: 'medium', label: 'Meteor', file: 'meteor.webp' }, { id: 'pleiades', size: 'large', label: 'Pleiades', file: 'pleiades.webp' }],
  };
  const { manifest } = buildFit(fit, m, files, (f) => art[f]);
  const w = Object.fromEntries(manifest.widgets.map((x) => [x.id, x]));
  assert.deepEqual(w.comet.sizes, ['medium', 'small', 'large'], 'a replaced hero keeps its own size first');
  assert.deepEqual(w.meteor.sizes, ['medium']);
  assert.deepEqual(w.pleiades.sizes, ['large']);
  for (const id of ['comet', 'nebula', 'meteor', 'pleiades']) assert.equal(w[id].background, 'wallpaper');
  const role = (id) => manifest.assets.find((a) => a.path === w[id].image).role;
  assert.equal(role('comet'), 'widget-medium');
  assert.equal(role('nebula'), 'widget-large');
  assert.equal(role('meteor'), 'widget-art');
  assert.equal(manifest.assets.filter((a) => a.role === 'widget-medium').length, 1, 'the old hero-medium file is gone');
  assert.throws(() => buildFit({ ...fit, replace: [], add: [{ id: 'boat', size: 'medium', file: 'comet.webp' }] }, m, files, (f) => art[f]), /already a widget/);
});

test('buildAll chains stages: a later stage builds on the version the earlier one made', async () => {
  const { mkdtempSync, writeFileSync, mkdirSync, readFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { buildAll } = await import('./art_fit_packs.mjs');
  const root = mkdtempSync(join(tmpdir(), 'artfit-'));
  const { m, files } = base();
  const mBytes = Buffer.from(JSON.stringify(m));
  const remote = new Map([[`art/cloud-x/v7/manifest.json`, mBytes], ...[...files].map(([p, b]) => [`art/cloud-x/v7/${p}`, b])]);
  const stage = (name, fit, artFiles) => {
    const d = join(root, name, 'cloud-x');
    mkdirSync(d, { recursive: true });
    writeFileSync(join(d, 'fit.json'), JSON.stringify(fit));
    for (const [f, b] of Object.entries(artFiles)) writeFileSync(join(d, f), b);
    return join(root, name);
  };
  const s1 = stage('one', { theme: 'cloud-x', base: { packVersion: 7, manifestSha256: sha(mBytes) }, replace: [{ from: 'boat', id: 'seed', file: 'seed.webp' }] }, { 'seed.webp': webp(1024, 1024, 50) });
  // Stage two's base manifest is stage one's output, fetched from "R2" after publishing it.
  const fetcher = async (url) => {
    const rel = url.replace(/^https:\/\/x\//, '').replace(/\?.*$/, '');
    if (rel === 'catalog-v2.json') return new Response(JSON.stringify({ packs: [{ id: 'cloud-x', manifest: 'art/cloud-x/v8/manifest.json' }] }), { status: 200 });
    const b = remote.get(rel);
    return b ? new Response(b, { status: 200 }) : new Response('', { status: 404 });
  };
  const out1 = join(root, 'out1');
  mkdirSync(out1);
  await buildAll({ base: 'https://x', fitDirs: [s1], outDir: out1, cacheDir: join(root, 'c1'), fetcher, log: () => {} });
  for (const p of readdirSync(join(out1, 'art', 'cloud-x', 'v8'))) remote.set(`art/cloud-x/v8/${p}`, readFileSync(join(out1, 'art', 'cloud-x', 'v8', p)));
  const v8 = remote.get('art/cloud-x/v8/manifest.json');
  const s2 = stage('two', { theme: 'cloud-x', base: { packVersion: 8, manifestSha256: sha(v8) }, add: [{ id: 'comet', size: 'medium', file: 'comet.webp' }] }, { 'comet.webp': webp(1092, 510, 51) });
  const out2 = join(root, 'out2');
  mkdirSync(out2);
  const over = await buildAll({ base: 'https://x', fitDirs: [s1, s2], outDir: out2, cacheDir: join(root, 'c2'), fetcher, log: () => {} });
  assert.deepEqual(over.map((o) => [o.id, o.packVersion]), [['cloud-x', 9]], 'the last stage wins');
  assert.ok(existsSync(join(out2, 'art', 'cloud-x', 'v8', 'manifest.json')) && existsSync(join(out2, 'art', 'cloud-x', 'v9', 'manifest.json')));
  // A stage that skips a version is refused.
  const bad = stage('bad', { theme: 'cloud-x', base: { packVersion: 7, manifestSha256: sha(mBytes) }, add: [{ id: 'x', size: 'large', file: 'x.webp' }] }, { 'x.webp': webp(1092, 1146, 52) });
  await assert.rejects(buildAll({ base: 'https://x', fitDirs: [s1, bad], outDir: out2, cacheDir: join(root, 'c3'), fetcher, log: () => {} }), /previous stage/);
});
