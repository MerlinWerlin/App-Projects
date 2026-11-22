#!/usr/bin/env node
// Stage the content-hashed files of brand-new themes on R2 ahead of their release.
// It can never write catalog.json or a manifest, touch a theme that is already live, or replace an
// existing object. Nothing it uploads is visible in any app until a catalogue lists it.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { configFromEnv, planUpload, pool, s3 } from './publish_r2.mjs';

const args = process.argv.slice(2);
const value = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const dir = resolve(value('--dir') ?? 'dist/extraordinary-packs');
const base = (value('--base') ?? '').replace(/\/+$/, '');
const upload = args.includes('--upload');
assert.match(base, /^https?:\/\//, '--base is required');

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function get(url) {
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(60_000) });
      if (r.status === 200) return Buffer.from(await r.arrayBuffer());
      if (attempt >= 7) throw new Error(`${url}: HTTP ${r.status}`);
    } catch (e) {
      if (attempt >= 7) throw e;
    }
    await new Promise((ok) => setTimeout(ok, 1500 * (attempt + 1)));
  }
}

const catalogue = () => get(`${base}/catalog.json?stage=${Date.now()}`);
const before = await catalogue();
const live = new Set(JSON.parse(before).packs.map((p) => p.id));
assert.ok(live.size >= 141, 'live catalogue is unexpectedly short');
const files = planUpload(dir).filter((p) => p.kind === 'file');
const themes = new Set();
for (const p of files) {
  const match = /^art\/([a-z0-9-]+)\/v1\/[A-Za-z0-9._-]+\.[0-9a-f]{8}\.(?:webp|png)$/.exec(p.key);
  assert.ok(match, `not a content-hashed theme file: ${p.key}`);
  assert.ok(!live.has(match[1]), `refusing to touch a live theme: ${match[1]}`);
  themes.add(match[1]);
}
console.log(`${upload ? 'stage' : 'dry run'}: ${files.length} files, ${themes.size} new themes, ${(files.reduce((n, p) => n + p.size, 0) / 1e6).toFixed(1)} MB; no manifests, no catalogue`);

if (upload) {
  const cfg = configFromEnv(process.env);
  let added = 0, same = 0, checked = 0;
  await pool(files, 8, async (p) => {
    const head = await s3(cfg, 'HEAD', p.key);
    if (head.status === 200) {
      assert.equal(String(head.headers.etag).replaceAll('"', ''), p.md5, `different bytes already at ${p.key}`);
      same++;
      return;
    }
    assert.equal(head.status, 404, `HEAD ${p.key}`);
    const put = await s3(cfg, 'PUT', p.key, {
      body: readFileSync(p.file),
      headers: { 'content-type': p.contentType, 'cache-control': p.cacheControl, 'content-md5': Buffer.from(p.md5, 'hex').toString('base64'), 'if-none-match': '*' },
    });
    assert.equal(put.status, 200, `PUT ${p.key}`);
    added++;
  });
  console.log(`uploaded ${added}, already present ${same}; verifying public bytes`);
  await pool(files, 3, async (p) => {
    assert.equal(sha(await get(`${base}/${p.key}`)), sha(readFileSync(p.file)), `public bytes differ: ${p.key}`);
    checked++;
  });
  console.log(`verified ${checked} public files by SHA-256`);
}
assert.equal(sha(await catalogue()), sha(before), 'live catalogue changed during staging');
console.log(`live catalogue unchanged: ${live.size} themes, sha256 ${sha(before)}`);
