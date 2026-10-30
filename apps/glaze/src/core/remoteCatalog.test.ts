// T160: remote catalogue logic (offline-safe choice, staleness, catalogue packs as gallery themes,
// remote detail card) and the pack base URL config. Pure; no network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PACK_BASE_URL, PACK_BASE_URLS, packBaseUrl, packEnvFrom } from '../config/packs.ts';
import { ART_PACK_THEMES } from './artPackThemes.ts';
import { isArtPackTheme } from './artPack.ts';
import { manifestPath, type RemoteArtManifest } from './packCatalog.ts';
import {
  CATALOG_REFRESH_MS,
  catalogNeedsFetch,
  decideCatalog,
  isRemoteArtTheme,
  mergeRemoteThemes,
  parseCatalogCache,
  parseCatalogText,
  remoteArtDetailView,
  remoteArtFiles,
  remoteArtThemes,
  remoteThemeById,
  serializeCatalogCache,
  withDownloadedArt,
} from './remoteCatalog.ts';

const palette = { bg: '#04182E', tile: '#0C2A40', glyph: '#E6FBFF', accent: '#5EE1D9', text: '#E9FAFF' };
const entry = (id: string, plus = false) => ({
  id,
  name: id.replace(/-/g, ' '),
  packVersion: 3,
  plus,
  bytes: 1234,
  manifest: manifestPath(id, 3),
  thumb: `art/${id}/v3/thumb.0000dddd.webp`,
  thumbhash: 'AbCd',
  palette,
  tags: ['ocean', 'nature'],
  mood: 'calm',
  addedAt: '2026-10-29',
});
const catalogText = (...packs: object[]) => JSON.stringify({ format: 'glaze-catalog', version: 1, generatedAt: '2026-10-30T00:00:00Z', packs });
const BASE = 'https://pub-0123.r2.dev';

test('config: both environments empty, production by default, staging only when asked', () => {
  assert.equal(PACK_BASE_URL, '');
  assert.deepEqual({ ...PACK_BASE_URLS }, { staging: '', production: '' });
  assert.equal(packEnvFrom(undefined), 'production');
  assert.equal(packEnvFrom('Staging '), 'staging');
  assert.equal(packEnvFrom('stage'), 'production');
  assert.equal(packBaseUrl('staging', { staging: ' https://s.example.test ', production: '' }), 'https://s.example.test');
  assert.equal(packBaseUrl('production', { staging: 'x', production: '' }), '');
});

test('catalogue text and cache parse safely', () => {
  assert.equal(parseCatalogText('{not json'), null);
  assert.equal(parseCatalogText(''), null);
  assert.equal(parseCatalogText(JSON.stringify({ format: 'other' })), null);
  assert.deepEqual(parseCatalogText(catalogText(entry('deep-blue')))?.packs.map((p) => p.id), ['deep-blue']);
  const cache = { savedAt: 1000, text: catalogText(entry('deep-blue')) };
  assert.deepEqual(parseCatalogCache(serializeCatalogCache(cache)), cache);
  assert.equal(parseCatalogCache('garbage'), null);
  assert.equal(parseCatalogCache(null), null);
  assert.equal(parseCatalogCache(serializeCatalogCache({ savedAt: 1, text: 'bad' })), null, 'a cache holding a bad catalogue is dropped');
});

test('staleness: fetch with nothing cached, after 6 h, on pull, or after a clock jump back', () => {
  const now = 10 * CATALOG_REFRESH_MS;
  assert.equal(catalogNeedsFetch(null, now), true);
  assert.equal(catalogNeedsFetch({ savedAt: now - 1000 }, now), false);
  assert.equal(catalogNeedsFetch({ savedAt: now - 1000 }, now, true), true);
  assert.equal(catalogNeedsFetch({ savedAt: now - CATALOG_REFRESH_MS }, now), true);
  assert.equal(catalogNeedsFetch({ savedAt: now + 60_000 }, now), true);
});

test('decide: good fetch replaces, bad or offline keeps the last good catalogue, never throws', () => {
  const old = { savedAt: 5, text: catalogText(entry('deep-blue')) };
  const good = decideCatalog(old, { ok: true, text: catalogText(entry('deep-blue'), entry('pink-sky', true)) }, 99);
  assert.equal(good.save, true);
  assert.equal(good.cache?.savedAt, 99);
  assert.deepEqual(good.catalog?.packs.map((p) => p.id), ['deep-blue', 'pink-sky']);

  const bad = decideCatalog(old, { ok: true, text: '<html>502</html>' }, 99);
  assert.equal(bad.save, false);
  assert.equal(bad.cache, old);
  assert.deepEqual(bad.catalog?.packs.map((p) => p.id), ['deep-blue']);
  assert.ok(bad.error);

  const offline = decideCatalog(old, { ok: false, error: 'network' }, 99);
  assert.equal(offline.save, false);
  assert.deepEqual(offline.catalog?.packs.map((p) => p.id), ['deep-blue']);
  assert.equal(offline.error, 'network');

  const none = decideCatalog(null, { ok: false, error: 'network' }, 99);
  assert.equal(none.catalog, null);
  assert.equal(decideCatalog(old, null, 99).error, null);
  assert.equal(decideCatalog(null, null, 99).catalog, null);
});

test('catalogue packs become art-pack gallery themes; bundled ids win; disabled lists nothing', () => {
  const bundled = ART_PACK_THEMES[0].id;
  const cat = parseCatalogText(catalogText(entry('deep-blue'), entry('pink-sky', true), entry(bundled)))!;
  assert.deepEqual(remoteArtThemes(cat, null, []), [], 'no base URL: nothing remote');
  assert.deepEqual(remoteArtThemes(null, BASE, []), []);
  const list = remoteArtThemes(cat, `${BASE}/`, ART_PACK_THEMES.map((t) => t.id));
  assert.deepEqual(list.map((t) => t.id), ['deep-blue', 'pink-sky']);
  const [free, plus] = list;
  assert.ok(isArtPackTheme(free) && isRemoteArtTheme(free));
  assert.equal(free.plus, false);
  assert.equal(plus.plus, true);
  assert.equal(plus.remoteArt.plus, true);
  assert.equal(free.remoteArt.thumbUrl, `${BASE}/art/deep-blue/v3/thumb.0000dddd.webp`);
  assert.equal(free.remoteArt.thumbhash, 'AbCd');
  assert.equal(free.remoteArt.packVersion, 3);
  assert.equal(free.packId, undefined, 'not a bundled-Plus theme pack');
  assert.equal(free.iconStyle.background.kind, 'solid');
  assert.equal(free.palette.bg, palette.bg);
  assert.ok(free.categories.includes('nature') && free.categories.includes('dark'));
  assert.equal(free.addedAt, '2026-10-29');
  assert.equal(isRemoteArtTheme(ART_PACK_THEMES[0]), false);
  assert.equal(remoteThemeById(list, 'pink-sky'), plus);
  assert.equal(remoteThemeById(list, undefined), undefined);

  const merged = mergeRemoteThemes(ART_PACK_THEMES, [...list, { ...list[0], id: bundled }]);
  assert.deepEqual(merged.map((t) => t.id), [...ART_PACK_THEMES.map((t) => t.id), 'deep-blue', 'pink-sky']);
  assert.equal(mergeRemoteThemes(ART_PACK_THEMES, []), ART_PACK_THEMES, 'same list object when nothing is added');
});

test('downloaded manifest fills credits and heroes; files by role', () => {
  const [theme] = remoteArtThemes(parseCatalogText(catalogText(entry('deep-blue')))!, BASE, []);
  const H = 'b'.repeat(64);
  const m = {
    id: 'deep-blue',
    meta: { name: 'Deep Blue', mood: '', tags: [], credits: 'Glaze (original art)', licence: 'original', generator: 'procedural', prompt: '' },
    assets: [
      { path: 'wallpaper-2796.0000aaaa.webp', role: 'wallpaper', width: 1290, height: 2796, bytes: 3, sha256: H, mime: 'image/webp' },
      { path: 'widget-small.0000cccc.webp', role: 'widget-small', width: 510, height: 510, bytes: 3, sha256: H, mime: 'image/webp' },
      { path: 'thumb.0000dddd.webp', role: 'thumb', width: 240, height: 520, bytes: 3, sha256: H, mime: 'image/webp' },
    ],
  } as unknown as RemoteArtManifest;
  assert.deepEqual(remoteArtFiles(m), { wallpaper: 'wallpaper-2796.0000aaaa.webp', thumb: 'thumb.0000dddd.webp', heroes: { small: 'widget-small.0000cccc.webp' } });
  const t2 = withDownloadedArt(theme, m);
  assert.equal(t2.artPack.credits, 'Glaze (original art)');
  assert.deepEqual([...t2.artPack.heroes], ['small']);
  assert.equal(t2.remoteArt, theme.remoteArt);
  assert.equal(withDownloadedArt(theme, { ...m, id: 'other' }), theme);
});

test('remote detail card: free packs download too; Plus packs lock; progress never shows 100 early', () => {
  const v = (state: Parameters<typeof remoteArtDetailView>[0]['state'], progress = 0, error: string | null = null) => remoteArtDetailView({ state, progress, error });
  assert.equal(v('free').kind, 'download');
  assert.equal(v('not-downloaded').kind, 'download');
  assert.equal(v('locked').kind, 'locked');
  assert.equal(v('ready').kind, 'ready');
  assert.deepEqual(v('downloading', 1), { kind: 'downloading', progress: 1, percent: 99 });
  assert.deepEqual(v('error', 0, 'offline'), { kind: 'error', message: 'offline' });
  assert.deepEqual(v('disabled'), { kind: 'error', message: null });
});
