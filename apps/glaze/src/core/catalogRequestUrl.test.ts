import { test } from 'node:test';
import assert from 'node:assert/strict';
import { catalogRequestUrl } from './remoteCatalog.ts';

const BASE = 'https://github.com/MerlinWerlin/App-Projects/releases/download/glaze-packs-v5/';

test('each GitHub catalogue fetch escapes a stale redirect without changing its asset path', () => {
  const first = catalogRequestUrl(`${BASE}catalog.json`, 1000);
  const second = catalogRequestUrl(`${BASE}catalog.json`, 2000);
  assert.notEqual(first, second);
  assert.equal(new URL(first).pathname, new URL(`${BASE}catalog.json`).pathname);
  assert.equal(new URL(first).searchParams.get('glazeCatalogRequest'), '1000');
});

test('a repeat request replaces its nonce and preserves other query fields and fragments', () => {
  const result = new URL(catalogRequestUrl(`${BASE}catalog.json?lang=en&glazeCatalogRequest=1#themes`, 2345.8));
  assert.equal(result.searchParams.get('lang'), 'en');
  assert.deepEqual(result.searchParams.getAll('glazeCatalogRequest'), ['2345']);
  assert.equal(result.hash, '#themes');
});

test('immutable manifests/art and other hosts keep their original URLs', () => {
  for (const url of [
    `${BASE}art__nebula-veil__v6__manifest.json`,
    `${BASE}art__nebula-veil__v6__thumb.abcd.webp`,
    'https://cdn.example.test/catalog.json',
    'http://127.0.0.1:8000/catalog.json',
    'https://github.com.evil.test/o/r/releases/download/t/catalog.json',
    'https://github.com/o/r/releases/download/t/catalog.json.extra',
  ]) assert.equal(catalogRequestUrl(url, 1000), url);
  for (const time of [NaN, Infinity, -1]) assert.equal(catalogRequestUrl(`${BASE}catalog.json`, time), `${BASE}catalog.json`);
});
