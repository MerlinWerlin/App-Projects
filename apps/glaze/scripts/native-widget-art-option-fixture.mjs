// Prepare the same JS art plan and serialized index the app sends to the native bridge.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PACK_BASE_URL } from '../src/config/packs.ts';
import { parseCatalog } from '../src/core/packCatalog.ts';
import { downloadRemoteWidgetArt } from '../src/core/packDownloader.ts';
import { isReplacedArtEdition } from '../src/core/designedWidgets.ts';
import { WIDGET_ART_PICTURE_ALIASES } from '../src/core/widgetArtPictureAliases.ts';
import { withSeamlessHeroes } from '../src/core/widgetOptions.ts';
import { remoteWidgetArtOptions } from '../src/core/remoteWidgetArt.ts';
import { commitThemeArt, planThemePieces, THEME_ART_SIZES } from '../src/core/themeArtSync.ts';
import { emptyLibrary, serializeLibrary, themePieceId } from '../src/core/widgetArtLibrary.ts';

const output = process.argv[2];
assert.ok(output);
await mkdir(join(output, 'art-fixture-files'), { recursive: true });
const response = await fetch(PACK_BASE_URL + '/catalog.json?nativeArtCheck=' + Date.now(), { signal: AbortSignal.timeout(30_000) });
assert.ok(response.ok);
const catalog = parseCatalog(await response.json());
assert.ok(catalog.ok);
assert.equal(catalog.value.packs.length, 141);
const themes = [];
let next = 0;
await Promise.all(Array.from({ length: 8 }, async () => {
  for (;;) {
    const pack = catalog.value.packs[next++];
    if (!pack) return;
    const cache = new Map();
    const transport = {
      async fetchRange(url, start, signal) {
        const res = await fetch(url, { signal, headers: start ? { Range: 'bytes=' + start + '-' } : undefined });
        if (!res.ok) throw Error(url + ' HTTP ' + res.status);
        return { offset: res.status === 206 ? start : 0, chunks: (async function* () { yield Buffer.from(await res.arrayBuffer()); })() };
      },
      async readFile(key) { return cache.get(key) ?? null; },
      async remove(key) { cache.delete(key); },
      async writeAppend(key, chunk) { cache.set(key, Buffer.concat([cache.get(key) ?? Buffer.alloc(0), chunk])); },
    };
    const art = await downloadRemoteWidgetArt(transport, PACK_BASE_URL, pack, AbortSignal.timeout(55_000));
    assert.equal(art.missing, 0, pack.id + ' ' + art.lastError);
    const options = remoteWidgetArtOptions(art.manifest);
    const fingerprints = new Map(art.manifest.assets.map(a => [a.path, WIDGET_ART_PICTURE_ALIASES[a.sha256] ?? a.sha256]));
    const advertised = withSeamlessHeroes(art.manifest.widgets, art.manifest.assets)
      .filter(option => !isReplacedArtEdition(option));
    for (const size of THEME_ART_SIZES) {
      const input = new Set(advertised.filter(o => o.sizes.includes(size)).map(o => fingerprints.get(o.image)));
      const output = options.filter(o => o.sizes.includes(size)).map(o => fingerprints.get(o.image));
      assert.equal(output.length, new Set(output).size, pack.id + ': duplicate ' + size + ' choice');
      assert.deepEqual(new Set(output), input, pack.id + ': missing pack art for ' + size);
    }
    const assets = Object.fromEntries(await Promise.all(options.map(async option => {
      const asset = art.manifest.assets.find(a => a.path === option.image);
      const name = asset.sha256 + '.webp';
      await writeFile(join(output, 'art-fixture-files', name), cache.get(art.files.get(option.image)));
      return [option.id, name];
    })));
    const plan = planThemePieces({
      themeId: pack.id, themeName: pack.name, options, includeFittedSizes: true,
      cap: THEME_ART_SIZES.length * options.length, name: option => option.label ?? option.id,
    });
    const ready = plan.map(piece => piece.id);
    const library = commitThemeArt(emptyLibrary(), pack.id, plan, ready, 1000).lib;
    const expected = options.map(o => ({ id: o.id, variants: Object.fromEntries(THEME_ART_SIZES
      .filter(size => o.sizes.includes(size)).map(size => [size, themePieceId(pack.id, o.id, size)])) }));
    assert.ok(expected.every(item => Object.values(item.variants).every(id => ready.includes(id))), pack.id);
    if (pack.id === 'alpine-starlight') {
      for (const id of ['jupiter-polar', 'silver-moon', 'spiral-galaxy', 'saturn-rings', 'copper-eclipse']) {
        assert.ok(expected.some(item => item.id === id && item.variants.small), id);
      }
    }
    themes.push({ id: pack.id, index: serializeLibrary(library), assets, expected, files: Object.fromEntries(plan.map(p => [p.id, assets[p.optionId]])) });
  }
}));
themes.sort((a, b) => a.id.localeCompare(b.id));
await writeFile(join(output, 'widget-art-options.json'), JSON.stringify(themes));
console.log(themes.length + ' production manifests and SHA-verified artwork prepared for the native query');
