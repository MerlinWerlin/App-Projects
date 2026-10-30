// T178 (owner-1031): the catalogue refetches on the first launch of a new app build, an empty or
// failed catalogue never sticks for 6 h, a 404 / offline / garbage response keeps the last good
// copy without an error for the UI, and the REAL glaze-packs-v1 catalogue + manifest parse.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PACK_BASE_URL, PACK_BASE_URLS, packBaseUrl, packEnvFrom } from '../config/packs.ts';
import { packObjectUrl } from './packHost.ts';
import { CATALOG_MAX_BYTES, parseRemoteArtManifest } from './packCatalog.ts';
import { ART_PACK_THEMES } from './artPackThemes.ts';
import { resolvePackBaseUrl } from './packDownloader.ts';
import {
  CATALOG_CLIENT_REV,
  CATALOG_REFRESH_MS,
  CATALOG_RETRY_MS,
  catalogCacheStamp,
  catalogNeedsFetch,
  catalogStatus,
  decideCatalog,
  parseCatalogCache,
  parseCatalogText,
  remoteArtThemes,
  serializeCatalogCache,
} from './remoteCatalog.ts';

const read = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const REAL_CATALOG = read('catalog-glaze-packs-v1.json');
const REAL_MANIFEST = read('manifest-alpine-starlight-v1.json');
const REAL_IDS = ['alpine-starlight', 'desert-afterglow', 'rainlight', 'firefly-grove', 'cloud-atelier', 'opal-abyss', 'rosewater-reverie', 'indigo-current', 'moonpatch', 'meadowglow'];
const EMPTY = JSON.stringify({ format: 'glaze-catalog', version: 1, generatedAt: '2026-10-30T00:00:00Z', packs: [] });
const NOW = 100 * CATALOG_REFRESH_MS;

test('real glaze-packs-v1 catalogue: 10 free packs, flat release asset URLs, all listed as themes', () => {
  assert.ok(REAL_CATALOG.length < CATALOG_MAX_BYTES);
  const cat = parseCatalogText(REAL_CATALOG);
  assert.ok(cat, 'the served catalogue parses');
  assert.equal(cat.packs.length, 10);
  assert.deepEqual([...cat.packs.map((p) => p.id)].sort(), [...REAL_IDS].sort());
  assert.ok(cat.packs.every((p) => p.plus === false), 'all 10 are free');

  const base = resolvePackBaseUrl(PACK_BASE_URL);
  assert.equal(base, 'https://github.com/MerlinWerlin/App-Projects/releases/download/glaze-packs-v1');
  const bundled = ART_PACK_THEMES.map((t) => t.id);
  assert.ok(REAL_IDS.every((id) => !bundled.includes(id)), 'no bundled art pack shadows a remote id');
  const themes = remoteArtThemes(cat, base, bundled);
  assert.equal(themes.length, 10);
  for (const t of themes) {
    assert.equal(t.plus, false);
    assert.match(t.remoteArt.thumbUrl ?? '', new RegExp(`^${base}/art__${t.id}__v1__thumb\\.[0-9a-f]{8}\\.webp$`));
    assert.ok(t.remoteArt.thumbhash.length > 0);
  }
  const alpine = cat.packs.find((p) => p.id === 'alpine-starlight')!;
  assert.equal(packObjectUrl(base!, alpine.manifest), `${base}/art__alpine-starlight__v1__manifest.json`);
  assert.equal(packObjectUrl(base!, 'catalog.json'), `${base}/catalog.json`);
});

test('real alpine-starlight manifest parses and has the files a phone needs', () => {
  const r = parseRemoteArtManifest(JSON.parse(REAL_MANIFEST), 'alpine-starlight');
  assert.ok(r.ok, r.ok ? '' : r.error);
  assert.equal(r.value.packVersion, 1);
  assert.equal(r.value.plus, false);
  assert.ok(r.value.assets.some((a) => a.role === 'wallpaper'));
  assert.ok(r.value.assets.some((a) => a.role === 'thumb'));
  // minAppVersion must not exceed the shipping app version (app.json 1.0.1).
  const appVersion = JSON.parse(readFileSync(new URL('../../app.json', import.meta.url), 'utf8')).expo.version as string;
  const v = (s: string) => s.split('.').map(Number);
  const [a, b] = [v(r.value.minAppVersion), v(appVersion)];
  assert.ok(a[0] < b[0] || (a[0] === b[0] && (a[1] < b[1] || (a[1] === b[1] && a[2] <= b[2]))), `${r.value.minAppVersion} <= ${appVersion}`);
});

test('the store build resolves to production (no packEnv in app.json) and packs are enabled', () => {
  const extra = JSON.parse(readFileSync(new URL('../../app.json', import.meta.url), 'utf8')).expo.extra ?? {};
  assert.equal(packEnvFrom(extra.packEnv), 'production');
  assert.equal(packBaseUrl(packEnvFrom(extra.packEnv)), PACK_BASE_URLS.production);
  assert.ok(resolvePackBaseUrl(PACK_BASE_URLS.production));
});

test('stamp: version, build, bundle and host all count; Expo Go (missing parts) never throws', () => {
  const s = catalogCacheStamp({ appVersion: '1.0.1', build: '13', updateId: 'abc', baseUrl: `${PACK_BASE_URL}/` });
  assert.equal(s, `${CATALOG_CLIENT_REV}|1.0.1|13|abc|${PACK_BASE_URL}`);
  assert.notEqual(s, catalogCacheStamp({ appVersion: '1.0.1', build: '14', updateId: 'abc', baseUrl: PACK_BASE_URL }));
  assert.notEqual(s, catalogCacheStamp({ appVersion: '1.0.2', build: '13', updateId: 'abc', baseUrl: PACK_BASE_URL }));
  assert.notEqual(s, catalogCacheStamp({ appVersion: '1.0.1', build: '13', updateId: 'def', baseUrl: PACK_BASE_URL }));
  assert.notEqual(s, catalogCacheStamp({ appVersion: '1.0.1', build: '13', updateId: 'abc', baseUrl: PACK_BASE_URLS.staging }));
  assert.equal(catalogCacheStamp({}), `${CATALOG_CLIENT_REV}||||`);
  assert.equal(catalogCacheStamp({ appVersion: null, build: 7, updateId: undefined, baseUrl: null }), `${CATALOG_CLIENT_REV}||7||`);
});

test('first launch of a new build refetches at once; same build trusts the fresh cache', () => {
  const stamp = 'r|1.0.1|14|u2|b';
  const fresh = { savedAt: NOW - 60_000, text: REAL_CATALOG, stamp: 'r|1.0.1|13|u1|b' };
  assert.equal(catalogNeedsFetch(fresh, NOW, false, { stamp }), true, 'saved by build 13, running build 14');
  assert.equal(catalogNeedsFetch({ ...fresh, stamp }, NOW, false, { stamp }), false, 'same build, 1 min old');
  const legacy = { savedAt: NOW - 60_000, text: REAL_CATALOG };
  assert.equal(catalogNeedsFetch(legacy, NOW, false, { stamp }), true, 'cache saved by pre-T178 code has no stamp');
  assert.equal(catalogNeedsFetch(legacy, NOW), false, 'no stamp given: old behaviour');
});

test('an empty catalogue or a failed attempt never sticks for 6 h; backoff 2 min; pull always fetches', () => {
  const stamp = 's';
  const empty = { savedAt: NOW - 60_000, text: EMPTY, stamp };
  assert.equal(catalogNeedsFetch(empty, NOW, false, { stamp }), false, 'empty but only 1 min old');
  assert.equal(catalogNeedsFetch({ ...empty, savedAt: NOW - CATALOG_RETRY_MS }, NOW, false, { stamp }), true, 'empty, 2 min old');
  // A 404 / offline saves nothing, so the next launch (no cache) fetches.
  assert.equal(catalogNeedsFetch(null, NOW, false, { stamp, lastAttemptAt: 0 }), true);
  // Within one session: a focus 30 s after the failed attempt waits, 2 min after retries.
  assert.equal(catalogNeedsFetch(null, NOW, false, { stamp, lastAttemptAt: NOW - 30_000 }), false);
  assert.equal(catalogNeedsFetch(null, NOW, false, { stamp, lastAttemptAt: NOW - CATALOG_RETRY_MS }), true);
  assert.equal(catalogNeedsFetch(null, NOW, false, { stamp, lastAttemptAt: NOW + 5_000 }), true, 'clock moved back: no backoff');
  assert.equal(catalogNeedsFetch(null, NOW, true, { stamp, lastAttemptAt: NOW - 1 }), true, 'pull to refresh ignores the backoff');
  assert.equal(catalogNeedsFetch({ savedAt: NOW - 1, text: REAL_CATALOG, stamp }, NOW, true, { stamp }), true);
  // A full catalogue still waits 6 h.
  assert.equal(catalogNeedsFetch({ savedAt: NOW - CATALOG_REFRESH_MS + 1, text: REAL_CATALOG, stamp }, NOW, false, { stamp }), false);
  assert.equal(catalogNeedsFetch({ savedAt: NOW - CATALOG_REFRESH_MS, text: REAL_CATALOG, stamp }, NOW, false, { stamp }), true);
});

test('404 / offline / garbage keep the last good cache; a good fetch saves under the running stamp', () => {
  const good = { savedAt: 5, text: REAL_CATALOG, stamp: 'old' };
  for (const fetched of [{ ok: false as const, error: 'HTTP 404' }, { ok: false as const, error: 'Network request failed' }, { ok: true as const, text: '<html>Not Found</html>' }, { ok: true as const, text: '' }]) {
    const d = decideCatalog(good, fetched, 99, 'new');
    assert.equal(d.save, false);
    assert.equal(d.cache, good);
    assert.equal(d.catalog?.packs.length, 10);
  }
  const first404 = decideCatalog(null, { ok: false, error: 'HTTP 404' }, 99, 'new');
  assert.equal(first404.catalog, null);
  assert.equal(first404.save, false, 'a failure is never cached');
  const ok = decideCatalog(null, { ok: true, text: REAL_CATALOG }, 99, 'new');
  assert.equal(ok.save, true);
  assert.deepEqual(ok.cache, { savedAt: 99, text: REAL_CATALOG, stamp: 'new' });
  assert.deepEqual(parseCatalogCache(serializeCatalogCache(ok.cache!)), ok.cache, 'stamp round-trips');
  assert.deepEqual(decideCatalog(null, { ok: true, text: REAL_CATALOG }, 99).cache, { savedAt: 99, text: REAL_CATALOG }, 'no stamp: old shape');
  assert.equal(parseCatalogCache(JSON.stringify({ savedAt: 1, text: REAL_CATALOG, stamp: 42 }))?.stamp, undefined);
});

test('status: skeletons only on the first load; offline / 404 is "unavailable", never an error', () => {
  const cat = parseCatalogText(REAL_CATALOG);
  const empty = parseCatalogText(EMPTY);
  assert.equal(catalogStatus({ enabled: false, catalog: cat, refreshing: true, attempted: true }), 'disabled');
  assert.equal(catalogStatus({ enabled: true, catalog: null, refreshing: false, attempted: false }), 'loading');
  assert.equal(catalogStatus({ enabled: true, catalog: null, refreshing: true, attempted: false }), 'loading');
  assert.equal(catalogStatus({ enabled: true, catalog: null, refreshing: true, attempted: true }), 'loading', 'retrying after a failure');
  assert.equal(catalogStatus({ enabled: true, catalog: null, refreshing: false, attempted: true }), 'unavailable');
  assert.equal(catalogStatus({ enabled: true, catalog: cat, refreshing: true, attempted: false }), 'ready', 'cached copy shows while refreshing');
  assert.equal(catalogStatus({ enabled: true, catalog: cat, refreshing: false, attempted: true }), 'ready');
  assert.equal(catalogStatus({ enabled: true, catalog: empty, refreshing: true, attempted: true }), 'loading');
  assert.equal(catalogStatus({ enabled: true, catalog: empty, refreshing: false, attempted: true }), 'empty');
});
