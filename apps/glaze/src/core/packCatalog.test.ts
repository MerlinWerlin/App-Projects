import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assetsForDevice, manifestPath, parseCatalog, parseRemoteArtManifest, pickWallpaper } from './packCatalog.ts';

const H = 'a'.repeat(64);
const palette = { bg: '#04182E', tile: '#0C2A40', glyph: '#E6FBFF', accent: '#5EE1D9', text: '#E9FAFF' };

function manifest(over: Record<string, unknown> = {}) {
  const assets = [
    { path: 'wallpaper-1334.0000aaaa.webp', role: 'wallpaper', width: 750, height: 1334, bytes: 100, sha256: H, mime: 'image/webp' },
    { path: 'wallpaper-2796.0000bbbb.webp', role: 'wallpaper', width: 1290, height: 2796, bytes: 300, sha256: H, mime: 'image/webp' },
    { path: 'widget-small.0000cccc.webp', role: 'widget-small', width: 510, height: 510, bytes: 50, sha256: H, mime: 'image/webp' },
    { path: 'thumb.0000dddd.webp', role: 'thumb', width: 240, height: 520, bytes: 10, sha256: H, mime: 'image/webp' },
  ];
  return {
    format: 'glaze-remote-art-pack', version: 1, id: 'deep-sea', packVersion: 2, name: 'Deep Sea', plus: false,
    minAppVersion: '1.0.0', palette, meta: { name: 'Deep Sea', tags: [] }, thumbhash: 'AbCd', assets, totalBytes: 460, ...over,
  };
}

test('remote manifest parses and picks the right wallpaper per screen', () => {
  const r = parseRemoteArtManifest(manifest(), 'deep-sea');
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(pickWallpaper(r.value, 1334)?.width, 750);
  assert.equal(pickWallpaper(r.value, 2000)?.width, 1290);
  assert.equal(pickWallpaper(r.value, 4000)?.width, 1290);
  assert.equal(assetsForDevice(r.value, 1334).length, 3);
});

test('remote manifest rejects tampering and unsafe paths', () => {
  assert.equal(parseRemoteArtManifest(manifest(), 'other').ok, false);
  assert.equal(parseRemoteArtManifest(manifest({ totalBytes: 1 })).ok, false);
  const bad = manifest();
  (bad.assets as { path: string }[])[0].path = '../x.webp';
  assert.equal(parseRemoteArtManifest(bad).ok, false);
  const noThumb = manifest();
  noThumb.assets = (noThumb.assets as { role: string }[]).filter((a) => a.role !== 'thumb') as typeof noThumb.assets;
  noThumb.totalBytes = 450;
  assert.equal(parseRemoteArtManifest(noThumb).ok, false);
});

test('catalog keeps good packs and drops bad entries', () => {
  const good = { id: 'deep-sea', name: 'Deep Sea', packVersion: 2, plus: false, bytes: 460, manifest: manifestPath('deep-sea', 2), thumb: 'art/deep-sea/v2/thumb.0000dddd.webp', thumbhash: 'AbCd', palette, tags: ['ocean'], mood: 'calm', addedAt: '2026-10-24' };
  const r = parseCatalog({ format: 'glaze-catalog', version: 1, generatedAt: '2026-10-30T00:00:00Z', packs: [good, { ...good }, { ...good, id: 'x2', manifest: 'evil' }, { ...good, id: 'x3', thumb: 'https://evil/x.webp' }] });
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(r.value.packs.map((p) => p.id), ['deep-sea']);
  assert.equal(parseCatalog({ format: 'nope' }).ok, false);
});
