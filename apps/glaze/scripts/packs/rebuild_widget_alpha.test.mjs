// T256 / D229-1: rebuild_widget_alpha.mjs (node:test, offline). Run: node --test "scripts/packs/*.test.mjs"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { imageStem, nextManifest, rebuild } from './rebuild_widget_alpha.mjs';
import { encodePng } from './png.mjs';

process.removeAllListeners('warning');
const { parseCatalog, parseRemoteArtManifest } = await import('../../src/core/packCatalog.ts');
const sha = (b) => createHash('sha256').update(b).digest('hex');

function png(w, h, a) {
  const rgba = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) rgba.set([200, 100, 50, a], i * 4);
  return Buffer.from(encodePng(w, h, rgba));
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'glaze-alpha-'));
  const cache = join(root, 'cache');
  const folder = join(cache, 'art/demo/v2');
  mkdirSync(folder, { recursive: true });
  const files = { wall: png(4, 8, 255), thumb: png(2, 4, 255), art: png(4, 4, 255) };
  const names = { wall: `wallpaper-2796.${sha(files.wall).slice(0, 8)}.png`, thumb: `thumb.${sha(files.thumb).slice(0, 8)}.png`, art: `widget-moon.${sha(files.art).slice(0, 8)}.png` };
  const roles = { wall: 'wallpaper', thumb: 'thumb', art: 'widget-art' };
  const assets = [];
  for (const k of ['wall', 'thumb', 'art']) {
    writeFileSync(join(folder, names[k]), files[k]);
    const dim = k === 'wall' ? [4, 8] : k === 'thumb' ? [2, 4] : [4, 4];
    assets.push({ path: names[k], role: roles[k], width: dim[0], height: dim[1], bytes: files[k].length, sha256: sha(files[k]), mime: 'image/png' });
  }
  const palette = { bg: '#000000', tile: '#111111', glyph: '#FFFFFF', accent: '#222222', text: '#FFFFFF' };
  const manifest = {
    format: 'glaze-remote-art-pack', version: 2, id: 'demo', packVersion: 2, name: 'Demo', plus: false, minAppVersion: '1.0.0', palette,
    meta: { name: 'Demo', mood: 'Test', tags: ['test'] }, thumbhash: 'AAAA', assets, totalBytes: assets.reduce((s, a) => s + a.bytes, 0),
    widgets: [{ id: 'moon', kind: 'art', image: names.art, sizes: ['small', 'medium', 'large'], fit: 'fit', background: 'blur', label: 'Moon' }],
  };
  assert.equal(parseRemoteArtManifest(manifest, 'demo').ok, true);
  writeFileSync(join(folder, 'manifest.json'), JSON.stringify(manifest));
  const catalog = { format: 'glaze-catalog', version: 1, generatedAt: 'x', packs: [
    { id: 'demo', name: 'Demo', packVersion: 2, plus: false, bytes: manifest.totalBytes, manifest: 'art/demo/v2/manifest.json', thumb: `art/demo/v2/${names.thumb}`, thumbhash: 'AAAA', palette },
  ] };
  assert.equal(parseCatalog(catalog).value.packs.length, 1);
  writeFileSync(join(cache, 'catalog.json'), JSON.stringify(catalog));
  const fix = join(root, 'fix');
  mkdirSync(join(fix, 'demo'), { recursive: true });
  writeFileSync(join(fix, 'demo', 'widget-moon.png'), png(4, 4, 128));
  return { root, cache, fix, names, manifest };
}

test('imageStem drops the content hash and extension', () => {
  assert.equal(imageStem('widget-copper-eclipse.f9863caf.webp'), 'widget-copper-eclipse');
  assert.equal(imageStem('widget-moon.png'), 'widget-moon');
});

test('nextManifest: nothing fixed -> null; fixed -> +1 version, new name, wallpaper background', () => {
  const { manifest } = fixture();
  assert.equal(nextManifest(manifest, new Map()), null);
  const bytes = Buffer.from('x');
  const r = nextManifest(manifest, new Map([['widget-moon', { bytes, ext: 'webp', mime: 'image/webp', width: 4, height: 4 }]]));
  assert.equal(r.manifest.packVersion, 3);
  assert.match(r.manifest.widgets[0].image, /^widget-moon\.[0-9a-f]{8}\.webp$/);
  assert.equal(r.manifest.widgets[0].background, 'wallpaper');
  assert.equal(manifest.widgets[0].background, 'blur', 'input untouched');
  assert.equal(r.manifest.totalBytes, r.manifest.assets.reduce((s, a) => s + a.bytes, 0));
});

test('rebuild writes a parseable v3 pack + catalog and leaves v2 alone (png encoder, offline)', () => {
  const { root, cache, fix, names } = fixture();
  const out = join(root, 'out');
  const versions = join(root, 'versions.json');
  writeFileSync(versions, JSON.stringify({ demo: { packVersion: 2, contentHash: 'old' } }));
  const r = rebuild({ cache, fix, out, encoder: 'png', versionsFile: versions, log: () => {} });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.changed, [{ id: 'demo', packVersion: 3, pieces: 1, supersedes: 'art/demo/v2' }]);
  const c = parseCatalog(JSON.parse(readFileSync(join(out, 'catalog.json'), 'utf8')));
  assert.equal(c.ok, true);
  assert.equal(c.value.packs[0].manifest, 'art/demo/v3/manifest.json');
  const m = JSON.parse(readFileSync(join(out, 'art/demo/v3/manifest.json'), 'utf8'));
  assert.equal(parseRemoteArtManifest(m, 'demo').ok, true);
  for (const a of m.assets) assert.equal(sha(readFileSync(join(out, 'art/demo/v3', a.path))), a.sha256);
  assert.ok(m.assets.some((a) => a.path === names.wall), 'unchanged assets keep their names');
  assert.equal(JSON.parse(readFileSync(versions, 'utf8')).demo.packVersion, 3);
});
