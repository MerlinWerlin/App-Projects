// T50 (oversight D56-1): a pack theme that uses a pack-only motif must still render after a
// restart. The registry is in memory only, so a "restart" here is clearPackMotifs().
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { isMotifId, placeMotif, stickerLayers, type MotifLayer } from './artwork.ts';
import { utf8Encode } from './bytes.ts';
import { localPath, type Transport } from './packDownloader.ts';
import { clearPackMotifs, hasPackMotif, registerPackMotifs } from './packMotifs.ts';
import { restorePackMotifs } from './packRestore.ts';
import { defaultStudioState, parseStudioState, serializeStudioState } from './studio.ts';
import { buildPack, cacheEntryFor, cacheIndexAdd, EMPTY_CACHE_INDEX, MANIFEST_FILE } from './themePack.ts';
import type { Theme } from './themes.ts';
import { AURORA_PACK_ID, NEW_PLUS_THEMES } from './themesNew.ts';

const COMET: MotifLayer[] = [
  { d: 'M10 50L50 10L90 50L50 90Z', role: 'primary' },
  { d: 'M40 50L50 40L60 50L50 60Z', role: 'light', opacity: 0.8 },
];
const STICKER = { motif: 'comet', corner: 'tl', scale: 0.3, rotation: 0 };

/** An in-memory "phone": files keyed by their pack-relative path. */
function memoryTransport(files: Map<string, Uint8Array>): Transport {
  return {
    async fetchRange() {
      throw new Error('no network after a restart');
    },
    async writeAppend(rel, chunk) {
      files.set(rel, chunk);
    },
    async readFile(rel) {
      return files.get(rel) ?? null;
    },
    async remove(rel) {
      for (const k of [...files.keys()]) if (k === rel || k.startsWith(`${rel}/`)) files.delete(k);
    },
  };
}

/** Aurora pack whose first theme uses the pack-only "comet" motif, stored as if downloaded. */
function downloadedPack() {
  clearPackMotifs();
  registerPackMotifs(AURORA_PACK_ID, { comet: COMET }, isMotifId); // so artAssetJson ships the layers
  const first = structuredClone(NEW_PLUS_THEMES[0]) as Theme;
  (first.art as { stickers: unknown[] }).stickers = [STICKER];
  const themes = [first, ...NEW_PLUS_THEMES.slice(1)];
  const pack = buildPack({ id: AURORA_PACK_ID, name: 'Aurora', minAppVersion: '0.1.0', themes }, (b) => gzipSync(b));
  const files = new Map<string, Uint8Array>();
  for (const f of pack.files) files.set(localPath(AURORA_PACK_ID, f.path), f.bytes);
  files.set(localPath(AURORA_PACK_ID, MANIFEST_FILE), utf8Encode(JSON.stringify(pack.manifest)));
  const index = cacheIndexAdd(EMPTY_CACHE_INDEX, cacheEntryFor(pack.manifest, new Date('2026-10-16T00:00:00Z')));
  const saved = serializeStudioState({ ...defaultStudioState(), style: { ...defaultStudioState().style, art: first.art } });
  clearPackMotifs(); // ← the restart
  return { files, index, saved, first };
}

test('after a restart, restoring packs before the studio loads keeps a pack-only motif', async () => {
  const { files, index, saved, first } = downloadedPack();
  assert.equal(hasPackMotif('comet'), false);

  const r = await restorePackMotifs(memoryTransport(files), index);
  assert.deepEqual(r, { packs: [AURORA_PACK_ID], motifs: ['comet'], missing: [] });
  assert.equal(hasPackMotif('comet'), true);

  const style = parseStudioState(saved).style;
  assert.equal(style.art?.stickers[0]?.motif, 'comet');
  const colours = first.art.colours;
  assert.equal(stickerLayers(style.art!.stickers, colours, 'squircle', 100).length, 2);
  assert.equal(placeMotif('comet', colours, 50, 50, 100)[0].fill, colours.primary);
  clearPackMotifs();
});

test('without the restore the saved sticker is dropped (the cold-start bug T50 fixes)', () => {
  const { saved } = downloadedPack();
  assert.deepEqual(parseStudioState(saved).style.art?.stickers, []);
});

test('missing, tampered or failing packs are skipped and never throw', async () => {
  const { files, index } = downloadedPack();
  const ghost = { ...index.packs[0], id: 'ghost-pack', name: 'Ghost' };
  const both = cacheIndexAdd(index, ghost);
  // Tamper with every art asset of the real pack: its themes (and motifs) are hidden.
  for (const k of files.keys()) if (k.includes('/art/')) files.set(k, utf8Encode('junk'));
  const r = await restorePackMotifs(memoryTransport(files), both);
  assert.deepEqual(r.packs, []);
  assert.deepEqual(r.missing.sort(), [AURORA_PACK_ID, 'ghost-pack'].sort());
  assert.equal(hasPackMotif('comet'), false);

  const failing = await restorePackMotifs(memoryTransport(files), index, async () => {
    throw new Error('disk error');
  });
  assert.deepEqual(failing.missing, [AURORA_PACK_ID]);
  assert.deepEqual(await restorePackMotifs(memoryTransport(files), EMPTY_CACHE_INDEX), { packs: [], motifs: [], missing: [] });
});
