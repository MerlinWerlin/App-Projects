// Glaze 1.0.44: this build reads catalog-v2.json; builds 1.0.37 to 1.0.43 keep reading catalog.json,
// which never changes again (scripts/packs/catalog-v2-lock.json). New themes need 1.0.44
// (minAppVersion) and are Plus; the ten free themes stay free.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { APP_CATALOG_FILE, CATALOG_FILE, LEGACY_CATALOG_FILE, parseCatalog } from './packCatalog.ts';
import { fetchCatalogConditional, fetchCatalogText, type Transport } from './packDownloader.ts';
import { CATALOG_CLIENT_REV, catalogCacheStamp, catalogNeedsFetch, remoteArtTheme } from './remoteCatalog.ts';
import { supportsApp } from './themePack.ts';
import { FREE_THEME_IDS, isFreeTheme } from './freeThemes.ts';

const APP = join(import.meta.dirname, '..', '..');
const BASE = 'https://pub-cffeea0b1da4434db6daadc18078e71c.r2.dev';

function recordingTransport(body = '{}'): { t: Transport; urls: string[] } {
  const urls: string[] = [];
  const t = {
    async fetchRange(url: string) {
      urls.push(url);
      return { offset: 0, chunks: (async function* () { yield new TextEncoder().encode(body); })() };
    },
    async fetchConditional(url: string) {
      urls.push(url);
      return { status: 200, text: body, etag: '"e1"' };
    },
    async writeAppend() {},
    async readFile() { return null; },
    async remove() {},
  } as unknown as Transport;
  return { t, urls };
}

test('1.0.44 reads catalog-v2.json; catalog.json stays the legacy file the builders and older builds use', async () => {
  assert.equal(APP_CATALOG_FILE, 'catalog-v2.json');
  assert.equal(LEGACY_CATALOG_FILE, 'catalog.json');
  assert.equal(CATALOG_FILE, 'catalog.json');
  const a = recordingTransport();
  await fetchCatalogText(a.t, BASE);
  assert.deepEqual(a.urls, [`${BASE}/catalog-v2.json`]);
  const b = recordingTransport();
  await fetchCatalogConditional(b.t, BASE, '"old"');
  assert.deepEqual(b.urls, [`${BASE}/catalog-v2.json`]);
});

test('the catalogue client rev changed, so a copy 1.0.43 cached (the 141-theme catalog.json) is refetched at once', () => {
  assert.notEqual(CATALOG_CLIENT_REV, 'github-catalog-20261104');
  const old = ['github-catalog-20261104', '1.0.43', '95', '', BASE].join('|');
  const now = catalogCacheStamp({ appVersion: '1.0.44', build: '96', baseUrl: BASE });
  assert.notEqual(old, now);
  const cache = { savedAt: 1_000, text: JSON.stringify({ format: 'glaze-catalog', version: 1, generatedAt: 'x', packs: [] }), stamp: old };
  assert.equal(catalogNeedsFetch(cache, 2_000, false, { stamp: now }), true);
});

test('the legacy catalogue lock pins catalog.json and the publisher can never write it', () => {
  const lock = JSON.parse(readFileSync(join(APP, 'scripts/packs/catalog-v2-lock.json'), 'utf8'));
  assert.equal(lock.legacyCatalog, 'catalog.json');
  assert.equal(lock.legacyCatalogSha256, '97a7a132865f005d93b7cebad21aecec57a57d9e3bf8e50790486ec52b7ddc55');
  assert.equal(lock.legacyPackCount, 141);
  assert.equal(lock.appCatalog, APP_CATALOG_FILE);
  const src = readFileSync(join(APP, 'scripts/packs/publish_catalog_v2.mjs'), 'utf8');
  assert.match(src, /assertNeverLegacy/);
  // The app code itself never asks for catalog.json any more.
  const downloader = readFileSync(join(APP, 'src/core/packDownloader.ts'), 'utf8');
  assert.doesNotMatch(downloader, /packObjectUrl\(base, CATALOG_FILE\)/);
});

test('minAppVersion gating: a 1.0.44 theme refuses 1.0.42 / 1.0.43 and downloads on 1.0.44+', () => {
  const m = { minAppVersion: '1.0.44' };
  for (const v of ['1.0.42', '1.0.43', '1.0.9']) assert.equal(supportsApp(m, v), false, v);
  for (const v of ['1.0.44', '1.0.45', '1.1.0']) assert.equal(supportsApp(m, v), true, v);
});

const NEW_IDS = readdirSync(join(APP, 'theme-sources'), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();

test('every new theme is Plus, the ten free themes stay free (entitlement and paywall unchanged)', () => {
  assert.equal(NEW_IDS.length, 111);
  for (const id of NEW_IDS) assert.equal(isFreeTheme(id), false, id);
  const entry = (id: string, plus: boolean) => ({ id, name: id, packVersion: 1, plus, bytes: 10, manifest: `art/${id}/v1/manifest.json`, thumb: `art/${id}/v1/thumb.0000abcd.webp`, thumbhash: 'AbCd', palette: { bg: '#04182E', tile: '#0C2A40', glyph: '#E6FBFF', accent: '#5EE1D9', text: '#E9FAFF' }, tags: [], mood: '', addedAt: '2026-11-23', category: 'Nature' });
  const c = parseCatalog({ format: 'glaze-catalog', version: 1, generatedAt: '2026-11-23', packs: [...NEW_IDS.slice(0, 3).map((id) => entry(id, true)), entry('deep-sea', false), entry('agate-apricot', false)] });
  assert.ok(c.ok);
  const themes = c.value.packs.map((p) => remoteArtTheme(p, BASE));
  for (const t of themes.slice(0, 3)) assert.equal(t.plus && t.remoteArt.plus, true, t.id);
  assert.equal(themes[3].plus, false); // deep-sea: free
  assert.equal(themes[4].plus, true); // agate-apricot: Plus through FREE_THEME_IDS, as in 1.0.42
  assert.equal(FREE_THEME_IDS.length, 10);
});
