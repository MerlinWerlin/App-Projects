// Glaze 1.0.39 (owner TestFlight 1.0.37: Starry Night showed the same copper moon in all five Artwork
// slots): no theme the gallery shows may put the same image in two Artwork slots. Artwork n is the n-th
// planned piece, else the theme design (artworkSlotSources: no cycling). Packs must have five
// different pieces; the three original bundled themes have one each until their new art lands.
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

test('no bundled art theme the gallery lists shows the same image in two Artwork slots', () => {
  for (const id of GALLERY_STARTER_IDS) assert.deepEqual(repeats(slotImages(id, bundledOptions(id))), [], id);
});

test('themes with fewer pieces show each once and the theme design in the rest (owner 2026-11-15: keep every theme)', () => {
  for (const id of ['deep-sea', 'starry-night', 'sunset-dunes']) {
    assert.ok(GALLERY_STARTER_IDS.includes(id), `${id} stays in the gallery`);
    const images = slotImages(id, bundledOptions(id));
    assert.deepEqual(repeats(images), [], id);
    assert.ok(images.some((x) => x.startsWith('fallback:')), `${id} has fewer than ${ARTWORK_SLOTS} pieces until its new art lands`);
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

// 1.0.39 (owner TestFlight build 88: Cobalt Caravan showed SIX artworks on the theme's widgets screen, one a
// "29 October" lantern): every artwork list uses the ONE shared pure-artwork selection
// (planThemePieces' `artwork` flag: small, kind 'art', not live), the list the art sync writes to the index
// and My widget art + the Home Screen read. Never date, calendar, clock or focus pictures.
test('Cobalt Caravan: its date and clock options are never Artwork; exactly five pure pieces', () => {
  const gen = readFileSync(join(ROOT, 'src', 'generated', 'starterPacks.ts'), 'utf8');
  const m = [...gen.matchAll(/manifest: (\{.*\}) as RemoteArtManifest,/g)].map((x) => JSON.parse(x[1])).find((x) => x.id === 'cobalt-caravan');
  assert.ok(m, 'Cobalt Caravan is a bundled starter');
  const parsed = parseWidgetOptions(m.widgets ?? null, m.assets ?? []);
  const kinds = new Map(parsed.options.map((o) => [o.id, o.kind]));
  assert.equal(kinds.get('caravan-date'), 'calendar', 'the "29 October" lantern is a calendar picture');
  const planned = plannedArtworkOptionIds(m.id, parsed.options);
  assert.deepEqual(planned, ['lapis-compass', 'oasis-bird', 'sand-cat', 'hero-small', 'lapis-dune-scarab']);
  for (const id of planned) assert.equal(kinds.get(id), 'art', id);
});

test('no screen lists a theme\'s art outside the shared selection (the old all-options lists are not rendered)', () => {
  const files = ['app/theme/[id].tsx', 'app/(tabs)/widgets.tsx', 'app/(tabs)/themes.tsx', 'app/install.tsx'];
  for (const f of files) {
    const src = readFileSync(join(ROOT, f), 'utf8');
    assert.doesNotMatch(src, /<ThemeWidgetArt\b|<WidgetArtMenu\b|<DesignedThemeWidgets\b/, f);
  }
  const list = readFileSync(join(ROOT, 'src', 'ui', 'WidgetArtLibraryList.tsx'), 'utf8');
  assert.match(list, /artworkPieces\(pieces, activeThemeId, artwork\)/, 'My widget art reads the shared index list');
  const sync = readFileSync(join(ROOT, 'src', 'core', 'themeArtSync.ts'), 'utf8');
  assert.match(sync, /size === 'small' && option\.kind === 'art' && !live \? \{ artwork: true \}/);
  assert.match(sync, /next\.artwork = planned\.filter\(\(p\) => p\.artwork === true/);
});
