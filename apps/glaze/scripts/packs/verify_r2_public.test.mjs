// Glaze 1.0.37: verify_r2_public.mjs against a local folder-host server (offline).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CACHE_CATALOG, CACHE_IMMUTABLE, contentTypeOf } from './publish_r2.mjs';
import { publicUrl, verifyPublic } from './verify_r2_public.mjs';

function tree() {
  const dir = mkdtempSync(join(tmpdir(), 'glaze-r2-verify-'));
  mkdirSync(join(dir, 'art', 'deep-sea', 'v2'), { recursive: true });
  writeFileSync(join(dir, 'art', 'deep-sea', 'v2', 'thumb.1a2b3c4d.webp'), Buffer.from('thumb-bytes'));
  writeFileSync(join(dir, 'art', 'deep-sea', 'v2', 'manifest.json'), '{"id":"deep-sea"}\n');
  writeFileSync(join(dir, 'catalog.json'), '{"packs":[]}\n');
  writeFileSync(join(dir, 'versions.json'), '{}'); // root extras are not part of the upload
  return dir;
}

function folderServer(dir, { corrupt = null, flaky = 0 } = {}) {
  const seen = [];
  let failures = flaky;
  const server = http.createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname.slice(1));
    seen.push(`${req.method} ${req.url}`);
    if (failures > 0) {
      failures--;
      res.writeHead(429).end();
      return;
    }
    let body;
    try {
      body = readFileSync(join(dir, ...path.split('/')));
    } catch {
      res.writeHead(404).end();
      return;
    }
    if (path === corrupt) body = Buffer.concat([body.subarray(0, body.length - 1), Buffer.from('!')]);
    res.writeHead(200, { 'content-length': body.length, 'content-type': contentTypeOf(path), 'cache-control': path === 'catalog.json' ? CACHE_CATALOG : CACHE_IMMUTABLE });
    res.end(req.method === 'HEAD' ? undefined : body);
  });
  return { server, seen };
}

async function withServer(s, fn) {
  await new Promise((ok) => s.server.listen(0, '127.0.0.1', ok));
  try {
    return await fn(`http://127.0.0.1:${s.server.address().port}`);
  } finally {
    await new Promise((ok) => s.server.close(ok));
  }
}

test('publicUrl: folder layout, catalogue cache-busted', () => {
  assert.equal(publicUrl('https://pub-0123.r2.dev/', 'art/deep-sea/v2/manifest.json'), 'https://pub-0123.r2.dev/art/deep-sea/v2/manifest.json');
  assert.equal(publicUrl('https://pub-0123.r2.dev', 'catalog.json', 42), 'https://pub-0123.r2.dev/catalog.json?verify=42');
});

test('verifyPublic: every object HEAD + sha256 checked, catalogue last, retries 429', async () => {
  const dir = tree();
  const s = folderServer(dir, { flaky: 2 });
  const lines = [];
  const r = await withServer(s, (base) => verifyPublic({ dir, base, concurrency: 1, backoffMs: 1, log: (l) => lines.push(l) }));
  assert.deepEqual(r, { objects: 3, bytes: 11 + 18 + 13, manifests: 1, files: 1 });
  const gets = s.seen.filter((l) => l.startsWith('GET ')).map((l) => l.replace(/\?verify=\d+$/, ''));
  assert.deepEqual(gets, ['GET /art/deep-sea/v2/thumb.1a2b3c4d.webp', 'GET /art/deep-sea/v2/manifest.json', 'GET /catalog.json']);
  assert.ok(s.seen.some((l) => /catalog\.json\?verify=\d+$/.test(l)));
  assert.ok(!s.seen.some((l) => l.includes('versions.json')));
});

test('verifyPublic: refuses changed bytes and missing objects', async () => {
  const dir = tree();
  await assert.rejects(
    withServer(folderServer(dir, { corrupt: 'art/deep-sea/v2/manifest.json' }), (base) => verifyPublic({ dir, base, backoffMs: 1, log: () => {} })),
    /manifest\.json: public bytes differ/,
  );
  writeFileSync(join(dir, 'art', 'deep-sea', 'v2', 'extra.png'), 'x');
  const s = folderServer(mkdtempSync(join(tmpdir(), 'glaze-r2-empty-')));
  await assert.rejects(withServer(s, (base) => verifyPublic({ dir, base, backoffMs: 1, log: () => {} })), /HEAD HTTP 404/);
  await assert.rejects(verifyPublic({ dir, base: '', log: () => {} }), /--base/);
});
