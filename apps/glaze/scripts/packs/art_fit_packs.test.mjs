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
