import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { compositionLayout, isDrawableMotif, isMotifId, placeMotif, sanitizeIconArt, sanitizeWallpaperArt, stickerLayers, type MotifLayer } from './artwork.ts';
import { utf8Encode } from './bytes.ts';
import {
  clearPackMotifs,
  hasPackMotif,
  packMotifIds,
  packMotifLayers,
  packMotifsVersion,
  registerPackMotifs,
  subscribePackMotifs,
  unregisterPackMotifs,
} from './packMotifs.ts';
import { artAssetJson, buildPack, decodeArtAsset, packContentFromFiles, parsePackManifest } from './themePack.ts';
import { AURORA_PACK_ID, NEW_PLUS_THEMES } from './themesNew.ts';

const COMET: MotifLayer[] = [
  { d: 'M10 50L50 10L90 50L50 90Z', role: 'primary' },
  { d: 'M40 50L50 40L60 50L50 60Z', role: 'light', opacity: 0.8 },
];

test('registry: register, look up, replace, unregister; built-ins and junk are refused', () => {
  clearPackMotifs();
  let calls = 0;
  const off = subscribePackMotifs(() => calls++);
  const v0 = packMotifsVersion();
  const ids = registerPackMotifs(
    'pack-a',
    {
      comet: COMET,
      star: COMET, // built-in id: refused
      'Bad Id': COMET,
      empty: [],
      junk: [{ d: '', role: 'primary' }, { d: 'M0 0', role: 'nope' } as unknown as MotifLayer],
    },
    isMotifId,
  );
  assert.deepEqual(ids, ['comet']);
  assert.ok(hasPackMotif('comet'));
  assert.ok(!hasPackMotif('star'));
  assert.deepEqual(packMotifLayers('comet'), COMET);
  assert.deepEqual([...packMotifIds()], ['comet']);
  assert.ok(packMotifsVersion() > v0);
  assert.equal(calls, 1);

  // Re-registering replaces; a later pack wins a clash; unregistering restores the other.
  registerPackMotifs('pack-b', { comet: [COMET[0]] }, isMotifId);
  assert.deepEqual(packMotifLayers('comet'), [COMET[0]]);
  unregisterPackMotifs('pack-b');
  assert.deepEqual(packMotifLayers('comet'), COMET);
  unregisterPackMotifs('pack-a');
  assert.ok(!hasPackMotif('comet'));
  // Unregistering an unknown pack is quiet.
  const n = calls;
  unregisterPackMotifs('pack-none');
  assert.equal(calls, n);
  off();
});

test('layout draws a registered pack motif and skips it otherwise', () => {
  clearPackMotifs();
  const colours = NEW_PLUS_THEMES[0].art.colours;
  assert.equal(isDrawableMotif('comet'), false);
  assert.deepEqual(placeMotif('comet', colours, 50, 50, 100), []);
  const sticker = [{ motif: 'comet' as never, corner: 'tl' as const, scale: 0.3, rotation: 0 }];
  assert.deepEqual(stickerLayers(sticker, colours, 'squircle', 100), []);

  registerPackMotifs(AURORA_PACK_ID, { comet: COMET }, isMotifId);
  assert.equal(isDrawableMotif('comet'), true);
  const placed = placeMotif('comet', colours, 50, 50, 100);
  assert.equal(placed.length, 2);
  assert.equal(placed[0].fill, colours.primary);
  assert.equal(placed[1].fill, colours.light);
  assert.equal(stickerLayers(sticker, colours, 'squircle', 100).length, 2);

  const wall = { colours, motifs: ['comet' as never], composition: 'scatter' as const };
  const drawn = compositionLayout(wall, 300, 600, 7);
  assert.ok(drawn.some((p) => p.fill === colours.primary));
  clearPackMotifs();
  // Unregistered → falls back to the default sparkle, so the wallpaper never ends up empty.
  assert.ok(compositionLayout(wall, 300, 600, 7).length > 0);
  // Built-ins are unaffected by the registry.
  assert.equal(placeMotif('star', colours, 50, 50, 100).length > 0, true);
});

test('sanitizers keep pack-only motifs only when allowed', () => {
  const art = { ...NEW_PLUS_THEMES[0].art, motifs: ['comet', 'star'], stickers: [{ motif: 'comet', corner: 'tl', scale: 0.3, rotation: 0 }] };
  assert.deepEqual(sanitizeWallpaperArt(art)?.motifs, ['star']);
  assert.deepEqual(sanitizeIconArt(art)?.stickers, []);
  const allow = new Set(['comet']);
  assert.deepEqual(sanitizeWallpaperArt(art, allow)?.motifs, ['comet', 'star']);
  assert.deepEqual(sanitizeIconArt(art, allow)?.stickers.map((s) => s.motif), ['comet']);
});

test('art assets: pack-only motifs survive decode only when their layers ship in the asset', () => {
  const base = NEW_PLUS_THEMES[0];
  const asset = JSON.parse(artAssetJson(base));
  asset.art.motifs = ['comet', ...asset.art.motifs];
  asset.art.stickers = [{ motif: 'comet', corner: 'br', scale: 0.25, rotation: 0 }];
  // Without the comet's layers the id is dropped.
  const without = decodeArtAsset(gzipSync(utf8Encode(JSON.stringify(asset))));
  assert.ok(!without.art.motifs.includes('comet' as never));
  assert.equal(without.art.stickers.length, 0);
  // With them it is kept, and the layers come back.
  asset.motifs.comet = COMET;
  const withLayers = decodeArtAsset(gzipSync(utf8Encode(JSON.stringify(asset))));
  assert.equal(withLayers.art.motifs[0], 'comet');
  assert.equal(withLayers.art.stickers[0].motif, 'comet');
  assert.deepEqual(withLayers.motifs.comet, COMET);
});

test('packContentFromFiles returns the themes and only the pack-only motifs', () => {
  const pack = buildPack({ id: AURORA_PACK_ID, name: 'Aurora', minAppVersion: '0.1.0', themes: NEW_PLUS_THEMES }, (b) => gzipSync(b));
  const parsed = parsePackManifest(JSON.parse(JSON.stringify(pack.manifest)));
  assert.ok(parsed.ok);
  const files = new Map(pack.files.map((f) => [f.path, f.bytes]));
  // Swap one theme's art for one that uses a pack-only motif.
  const first = NEW_PLUS_THEMES[0];
  const asset = JSON.parse(artAssetJson(first));
  asset.art.motifs = ['comet', ...asset.art.motifs.slice(0, 2)];
  asset.motifs.comet = COMET;
  files.set(`art/${first.id}.json.gz`, gzipSync(utf8Encode(JSON.stringify(asset))));

  const content = packContentFromFiles(parsed.value, (p) => files.get(p));
  assert.equal(content.themes.length, NEW_PLUS_THEMES.length);
  assert.deepEqual(Object.keys(content.motifs), ['comet']);
  assert.equal(content.themes[0].art.motifs[0], 'comet');
  // Wallpaper art carries it too, so the renderer draws it once registered.
  assert.equal(content.themes[0].wallpaper.art?.motifs[0], 'comet');

  // A built pack round-trips a registered pack-only motif through artAssetJson.
  clearPackMotifs();
  registerPackMotifs(AURORA_PACK_ID, content.motifs, isMotifId);
  const again = JSON.parse(artAssetJson(content.themes[0]));
  assert.deepEqual(again.motifs.comet, COMET);
  clearPackMotifs();
});
