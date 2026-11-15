// Glaze 1.0.39 (owner TestFlight 1.0.37: Starry Night showed the same copper moon in all five Artwork
// slots): no theme the gallery shows may put the same image in two Artwork slots. Artwork n is the
// n-th planned piece, cycling (artworkSlotSources), so a theme needs five DIFFERENT pieces.
//  - bundled art themes in GALLERY_STARTER_IDS: their pieces as the art sync plans them;
//  - bundled starter packs (1.0.38, src/generated/starterPacks.ts): from their manifests;
//  - catalogue themes on R2: the snapshot scripts/packs/r2-artwork.json, written by
//    `node scripts/packs/check_r2_artwork.mjs --base <R2 URL> --all --out scripts/packs/r2-artwork.json`
//    (the R2 publish workflow runs the same check against the live host after every publish).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { HERO_REFERENCE_SIZES, HERO_SIZES } from './artPack.ts';
import { ART_PACK_LIBRARY } from './artPackLibrary.ts';
import { ARTWORK_SLOTS, artworkSlotSources, plannedArtworkOptionIds } from './artworkCoverage.ts';
import { GALLERY_STARTER_IDS } from './gallery.ts';
import { parseWidgetOptions, widgetOptionsFromV1, type WidgetOption } from './widgetOptions.ts';

const ROOT = process.cwd();

/** The images in Artwork 1-5 for a theme's options (each slot's option image, or its asset hash). */
function slotImages(themeId: string, options: readonly WidgetOption[], hashOf: (image: string) => string = (x) => x): string[] {
  const planned = plannedArtworkOptionIds(themeId, options);
  const byId = new Map(options.map((o) => [o.id, o]));
  return artworkSlotSources(planned).map((s) => (s.piece ? hashOf(byId.get(s.piece)?.image ?? `missing:${s.piece}`) : `fallback:${s.slot}`));
}

const repeats = (images: readonly string[]) => images.filter((x, i) => images.indexOf(x) !== i);

/** A bundled art theme's pieces exactly as src/store/themeWidgetArt.ts themeArt lists them (its heroes). */
function bundledOptions(id: string): WidgetOption[] {
  const data = ART_PACK_LIBRARY.find((d) => d.id === id);
  if (!data) return [];
  const assets = HERO_SIZES.filter((s) => data.heroes && s in data.heroes).map((s) => ({ path: `bundled-${s}`, role: `widget-${s}`, width: HERO_REFERENCE_SIZES[s].width, height: HERO_REFERENCE_SIZES[s].height }));
  return widgetOptionsFromV1(assets);
}

test('every bundled art theme the gallery lists fills Artwork 1-5 with five different images', () => {
  for (const id of GALLERY_STARTER_IDS) assert.deepEqual(repeats(slotImages(id, bundledOptions(id))), [], id);
});

test('the check bites: the retired original art themes would repeat a piece (why they left the gallery)', () => {
  for (const id of ['deep-sea', 'starry-night', 'sunset-dunes']) {
    assert.ok(repeats(slotImages(id, bundledOptions(id))).length > 0, `${id} has fewer than ${ARTWORK_SLOTS} pieces`);
    assert.ok(!GALLERY_STARTER_IDS.includes(id), `${id} is not in the gallery`);
  }
});

test('every bundled starter pack fills Artwork 1-5 with five different images (by SHA-256)', () => {
  const gen = readFileSync(join(ROOT, 'src', 'generated', 'starterPacks.ts'), 'utf8');
  const manifests = [...gen.matchAll(/manifest: (\{.*\}) as RemoteArtManifest,/g)].map((m) => JSON.parse(m[1]));
  assert.ok(manifests.length >= 6);
  for (const m of manifests) {
    const parsed = parseWidgetOptions(m.widgets ?? null, m.assets ?? []);
    const sha = new Map<string, string>((m.assets as { path: string; sha256: string }[]).map((a) => [a.path, a.sha256]));
    const images = slotImages(m.id, parsed.options, (image) => sha.get(image) ?? `missing:${image}`);
    assert.deepEqual(repeats(images), [], m.id);
    assert.ok(images.every((x) => !x.startsWith('missing:') && !x.startsWith('fallback:')), m.id);
  }
});

test('every catalogue theme on R2 fills Artwork 1-5 with five different pieces (snapshot)', () => {
  const snap = JSON.parse(readFileSync(join(ROOT, 'scripts', 'packs', 'r2-artwork.json'), 'utf8')) as { themes: number; perTheme: Record<string, { slots: string[] }> };
  const ids = Object.keys(snap.perTheme);
  assert.equal(ids.length, snap.themes);
  assert.ok(ids.length >= 141, `${ids.length} themes`);
  for (const id of ids) {
    const slots = snap.perTheme[id].slots;
    assert.equal(slots.length, ARTWORK_SLOTS, id);
    const options = slots.map((s) => s.split(' ')[0]);
    const hashes = slots.map((s) => s.split(' ')[1]);
    assert.deepEqual(repeats(options), [], `${id}: repeated option`);
    assert.deepEqual(repeats(hashes), [], `${id}: the same image twice`);
    assert.ok(hashes.every((h) => /^[0-9a-f]{64}$/.test(h)), id);
  }
});
