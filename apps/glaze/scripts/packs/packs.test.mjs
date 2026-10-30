// T159: pack build + R2 publish (node:test, offline; the publish test talks to a mock S3 server
// on 127.0.0.1 only). Run: node --test scripts/packs/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildPacks, nextVersion, pickEncoder } from './build_packs.mjs';
import { CACHE_CATALOG, CACHE_IMMUTABLE, parseEnv, planUpload, publish } from './publish_r2.mjs';
import { decodePng, encodePng, resizeRgba } from './png.mjs';
import { rgbaToThumbHash, thumbHashToApproximateAspectRatio, thumbHashToAverageRGBA } from './thumbhash.mjs';

process.removeAllListeners('warning');
const { parseCatalog, parseRemoteArtManifest } = await import('../../src/core/packCatalog.ts');

const sha = (b) => createHash('sha256').update(b).digest('hex');
const quiet = () => {};
const tmp = (p) => mkdtempSync(join(tmpdir(), `glaze-${p}-`));

function checkBuild(out, r) {
  const cat = JSON.parse(readFileSync(join(out, 'catalog.json'), 'utf8'));
  const pc = parseCatalog(cat);
  assert.equal(pc.ok, true);
  assert.deepEqual(pc.value.packs.map((p) => p.id).sort(), ['deep-sea', 'starry-night', 'sunset-dunes']);
  for (const p of pc.value.packs) {
    const m = JSON.parse(readFileSync(join(out, p.manifest), 'utf8'));
    const pm = parseRemoteArtManifest(m, p.id);
    assert.equal(pm.ok, true, pm.ok ? '' : pm.error);
    assert.equal(p.bytes, pm.value.totalBytes);
    assert.equal(p.thumbhash, pm.value.thumbhash);
    const folder = p.manifest.replace(/\/manifest\.json$/, '');
    for (const a of pm.value.assets) {
      const bytes = readFileSync(join(out, folder, a.path));
      assert.equal(bytes.length, a.bytes, a.path);
      assert.equal(sha(bytes), a.sha256, a.path);
      assert.ok(a.path.includes(`.${a.sha256.slice(0, 8)}.`), a.path);
    }
    assert.ok(pm.value.assets.some((a) => `${folder}/${a.path}` === p.thumb && a.role === 'thumb'));
    // Manifest written after every file of its folder.
    const inFolder = r.writes.filter((w) => w.startsWith(folder + '/'));
    assert.equal(inFolder[inFolder.length - 1], p.manifest);
    assert.equal(inFolder.length, pm.value.assets.length + 1);
  }
  assert.equal(r.writes[r.writes.length - 1], 'catalog.json');
  return pc.value;
}

test('build: the 3 bundled themes with the best available encoder', async () => {
  const out = tmp('packs');
  const versions = join(out, '..', `${out.split('/').pop()}-versions.json`);
  try {
    const r = await buildPacks({ outDir: out, versionsFile: versions, log: quiet, plus: new Set(['starry-night']) });
    assert.deepEqual(r.failed, []);
    const cat = checkBuild(out, r);
    assert.equal(cat.packs.find((p) => p.id === 'starry-night').plus, true);
    assert.equal(cat.packs.find((p) => p.id === 'deep-sea').plus, false);
    const enc = await pickEncoder('auto');
    if (enc.kind !== 'png') {
      const m = JSON.parse(readFileSync(join(out, cat.packs[0].manifest), 'utf8'));
      const walls = m.assets.filter((a) => a.role === 'wallpaper').map((a) => `${a.width}x${a.height}`);
      assert.deepEqual(walls, ['1290x2796', '1179x2556', '750x1334']);
      assert.ok(m.assets.every((a) => a.mime === 'image/webp'));
    }
    // Same input -> same version and same catalog timestamp; a content change bumps the version.
    const lock1 = JSON.parse(readFileSync(versions, 'utf8'));
    const gen1 = cat.generatedAt;
    const r2 = await buildPacks({ outDir: out, versionsFile: versions, log: quiet, plus: new Set(['starry-night']), now: new Date('2030-01-01') });
    assert.deepEqual(JSON.parse(readFileSync(versions, 'utf8')), lock1);
    assert.equal(r2.catalog.generatedAt, gen1);
    const r3 = await buildPacks({ outDir: out, versionsFile: versions, log: quiet, only: new Set(['deep-sea']), plus: new Set(['starry-night', 'deep-sea']) });
    assert.equal(r3.built[0].packVersion, 2);
    assert.equal(r3.catalog.packs.length, 3, '--only keeps the other packs in the catalogue');
    assert.equal(r3.catalog.packs.find((p) => p.id === 'deep-sea').manifest, 'art/deep-sea/v2/manifest.json');
  } finally {
    rmSync(out, { recursive: true, force: true });
    rmSync(versions, { force: true });
  }
});

test('build: PNG fallback (no sharp, no Pillow) still meets the contract', async () => {
  const out = tmp('packs-png');
  try {
    const r = await buildPacks({ outDir: out, versionsFile: null, log: quiet, encoder: 'png' });
    const cat = checkBuild(out, r);
    const m = JSON.parse(readFileSync(join(out, cat.packs[0].manifest), 'utf8'));
    assert.ok(m.assets.every((a) => a.mime === 'image/png'));
    const thumb = m.assets.find((a) => a.role === 'thumb');
    assert.deepEqual([thumb.width, thumb.height], [240, 520]);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('nextVersion: same hash keeps, new hash bumps', () => {
  assert.equal(nextVersion(undefined, 'a'), 1);
  assert.equal(nextVersion({ packVersion: 3, contentHash: 'a' }, 'a'), 3);
  assert.equal(nextVersion({ packVersion: 3, contentHash: 'a' }, 'b'), 4);
});

test('png + thumbhash: round trip and average colour', () => {
  const w = 40, h = 80;
  const rgba = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) rgba.set([200, 40, 30, 255], i * 4);
  const png = encodePng(w, h, rgba);
  const back = decodePng(png);
  assert.deepEqual([back.width, back.height], [w, h]);
  assert.deepEqual([...back.rgba.subarray(0, 4)], [200, 40, 30, 255]);
  const small = resizeRgba(back, 20, 40);
  const hash = rgbaToThumbHash(small.width, small.height, small.rgba);
  assert.ok(hash.length >= 5 && hash.length <= 32);
  const avg = thumbHashToAverageRGBA(hash);
  assert.ok(Math.abs(avg.r - 200 / 255) < 0.05 && Math.abs(avg.g - 40 / 255) < 0.05 && Math.abs(avg.b - 30 / 255) < 0.05, JSON.stringify(avg));
  assert.ok(Math.abs(thumbHashToApproximateAspectRatio(hash) - 0.5) < 0.2);
  assert.throws(() => rgbaToThumbHash(101, 10, new Uint8Array(101 * 40)));
});

test('publish: dry-run plan order and cache headers, no env needed', async () => {
  const out = tmp('packs-plan');
  try {
    await buildPacks({ outDir: out, versionsFile: null, log: quiet, encoder: 'png' });
    const lines = [];
    const r = await publish({ dir: out, dryRun: true, env: {}, log: (l) => lines.push(l) });
    const keys = r.plan.map((p) => p.key);
    assert.equal(keys[keys.length - 1], 'catalog.json');
    const firstManifest = keys.findIndex((k) => k.endsWith('/manifest.json'));
    assert.ok(firstManifest > 0);
    assert.ok(keys.slice(0, firstManifest).every((k) => !k.endsWith('manifest.json') && k !== 'catalog.json'));
    assert.ok(keys.slice(firstManifest, -1).every((k) => k.endsWith('/manifest.json')));
    assert.equal(keys.filter((k) => k.endsWith('/manifest.json')).length, 3);
    for (const p of r.plan) {
      assert.equal(p.cacheControl, p.key === 'catalog.json' ? CACHE_CATALOG : CACHE_IMMUTABLE);
      assert.equal(p.contentType, p.key.endsWith('.json') ? 'application/json' : 'image/png');
    }
    assert.ok(lines.some((l) => l.includes('no network')));
    assert.equal(r.uploaded.length, 0);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('parseEnv: comments, quotes, export', () => {
  assert.deepEqual(parseEnv('# x\nexport R2_BUCKET="glaze-packs"\nR2_ACCOUNT_ID=abc # note\nBAD LINE\nR2_X=\'q r\''), { R2_BUCKET: 'glaze-packs', R2_ACCOUNT_ID: 'abc', R2_X: 'q r' });
});

/** Minimal S3 mock: HEAD/PUT /<bucket>/<key>, ETag = MD5, checks the SigV4 header and payload hash. */
function mockS3(bucket) {
  const store = new Map();
  const puts = [];
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      const auth = String(req.headers.authorization ?? '');
      if (!/^AWS4-HMAC-SHA256 Credential=test-key-id\/\d{8}\/auto\/s3\/aws4_request,SignedHeaders=[a-z0-9;-]+,Signature=[0-9a-f]{64}$/.test(auth)) {
        res.writeHead(403).end('bad auth');
        return;
      }
      const prefix = `/${bucket}/`;
      if (!req.url.startsWith(prefix)) return res.writeHead(404).end();
      const key = decodeURIComponent(req.url.slice(prefix.length));
      if (req.method === 'PUT') {
        if (req.headers['x-amz-content-sha256'] !== sha(body)) return res.writeHead(400).end('XAmzContentSHA256Mismatch');
        const md5 = createHash('md5').update(body).digest();
        if (req.headers['content-md5'] !== md5.toString('base64')) return res.writeHead(400).end('BadDigest');
        store.set(key, { body, type: req.headers['content-type'], cache: req.headers['cache-control'], etag: md5.toString('hex') });
        puts.push(key);
        return res.writeHead(200, { etag: `"${md5.toString('hex')}"` }).end();
      }
      if (req.method === 'HEAD') {
        const o = store.get(key);
        if (!o) return res.writeHead(404).end();
        return res.writeHead(200, { 'content-length': o.body.length, 'content-type': o.type, 'cache-control': o.cache, etag: `"${o.etag}"` }).end();
      }
      res.writeHead(405).end();
    });
  });
  return { server, store, puts };
}

test('publish: uploads in order to a mock S3, verifies, is idempotent, never logs secrets', async () => {
  const out = tmp('packs-pub');
  const mock = mockS3('glaze-packs');
  await new Promise((ok) => mock.server.listen(0, '127.0.0.1', ok));
  const env = {
    R2_ACCOUNT_ID: 'acct',
    R2_ACCESS_KEY_ID: 'test-key-id',
    R2_SECRET_ACCESS_KEY: 'super-secret-value',
    R2_BUCKET: 'glaze-packs',
    R2_ENDPOINT: `http://127.0.0.1:${mock.server.address().port}`,
  };
  const lines = [];
  const log = (l) => lines.push(l);
  try {
    await buildPacks({ outDir: out, versionsFile: null, log: quiet, encoder: 'png' });
    const plan = planUpload(out);
    const r1 = await publish({ dir: out, env, log });
    assert.deepEqual(mock.puts, plan.map((p) => p.key));
    assert.equal(r1.verified, plan.length);
    assert.equal(mock.store.get('catalog.json').cache, CACHE_CATALOG);
    assert.equal(mock.store.get(plan[0].key).cache, CACHE_IMMUTABLE);
    const r2 = await publish({ dir: out, env, log });
    assert.equal(r2.uploaded.length, 0);
    assert.equal(r2.skipped.length, plan.length);
    // A versioned manifest that changed in place is refused (immutable folders).
    const man = plan.find((p) => p.kind === 'manifest');
    writeFileSync(man.file, readFileSync(man.file, 'utf8').replace('"plus": false', '"plus": true'));
    await assert.rejects(publish({ dir: out, env, log }), /immutable/);
    assert.ok(lines.every((l) => !l.includes('super-secret-value') && !l.includes('test-key-id')));
  } finally {
    mock.server.close();
    rmSync(out, { recursive: true, force: true });
  }
});
