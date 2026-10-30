// Downloader tests against a local fixture server (node:http on 127.0.0.1, port 0) serving
// src/core/__fixtures__/packs/ with Range support. No external network.
import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, normalize, sep } from 'node:path';
import type { AddressInfo } from 'node:net';
import { PACKS_DISABLED_MESSAGE, PACK_BASE_URL } from '../config/packs.ts';
import {
  PackError,
  downloadPack,
  loadPackThemes,
  packsEnabled,
  readLocalManifest,
  removePack,
  resolvePackBaseUrl,
  type Transport,
} from './packDownloader.ts';
import { parsePackManifest, type PackManifest } from './themePack.ts';
import { AURORA_PACK_ID, NEW_PLUS_THEMES } from './themesNew.ts';

const ROOT = join(process.cwd(), 'src', 'core', '__fixtures__', 'packs');
const MANIFEST: PackManifest = (() => {
  const r = parsePackManifest(readFileSync(join(ROOT, AURORA_PACK_ID, 'manifest.json'), 'utf8'));
  if (!r.ok) throw new Error(r.errors.join('; '));
  return r.value;
})();
const FIRST = MANIFEST.assets[0].path;

// ------------------------------------------------------------ fixture server

type Hooks = {
  /** Send only this many bytes of a path (once per entry), then drop the connection. */
  cut: Map<string, number>;
  /** Flip a byte in this path's body for the next N requests. */
  corrupt: Map<string, number>;
  ignoreRange: boolean;
  manifestOverride: string | null;
};
const hooks: Hooks = { cut: new Map(), corrupt: new Map(), ignoreRange: false, manifestOverride: null };
const requests: { path: string; range: string | undefined }[] = [];
let server: Server;
let base = '';

function resetHooks() {
  hooks.cut.clear();
  hooks.corrupt.clear();
  hooks.ignoreRange = false;
  hooks.manifestOverride = null;
  requests.length = 0;
}

before(async () => {
  server = createServer((req, res) => {
    const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
    const rel = url.replace(/^\/+/, '');
    const file = normalize(join(ROOT, rel));
    const range = req.headers.range;
    requests.push({ path: rel.slice(AURORA_PACK_ID.length + 1), range });
    if (!file.startsWith(ROOT + sep) || !existsSync(file) || statSync(file).isDirectory()) {
      res.writeHead(404).end();
      return;
    }
    const assetPath = rel.slice(rel.indexOf('/') + 1);
    let body = readFileSync(file);
    if (assetPath === 'manifest.json' && hooks.manifestOverride !== null) body = Buffer.from(hooks.manifestOverride);
    const n = hooks.corrupt.get(assetPath) ?? 0;
    if (n > 0) {
      hooks.corrupt.set(assetPath, n - 1);
      body = Buffer.from(body);
      body[body.length >> 1] ^= 0xff;
    }
    let start = 0;
    const m = range && !hooks.ignoreRange ? /^bytes=(\d+)-$/.exec(range) : null;
    if (m) start = Number(m[1]);
    if (start >= body.length && body.length > 0) {
      res.writeHead(416).end();
      return;
    }
    const slice = body.subarray(start);
    const headers: Record<string, string | number> = { 'content-type': 'application/octet-stream', 'accept-ranges': 'bytes' };
    const cut = hooks.cut.get(assetPath);
    if (cut !== undefined) {
      hooks.cut.delete(assetPath);
      res.writeHead(m ? 206 : 200, { ...headers, 'content-length': slice.length, ...(m ? { 'content-range': `bytes ${start}-${body.length - 1}/${body.length}` } : {}) });
      res.write(slice.subarray(0, cut), () => setTimeout(() => res.socket?.destroy(), 30));
      return;
    }
    if (m) {
      res.writeHead(206, { ...headers, 'content-length': slice.length, 'content-range': `bytes ${start}-${body.length - 1}/${body.length}` });
    } else res.writeHead(200, { ...headers, 'content-length': body.length });
    res.end(slice);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server.close();
});

// ------------------------------------------------------------ Node transport (fetch + a temp folder)

function nodeTransport(root: string): Transport & { calls: number } {
  const p = (rel: string) => join(root, rel);
  const t = {
    calls: 0,
    async fetchRange(url: string, start: number) {
      t.calls++;
      const res = await fetch(url, start > 0 ? { headers: { Range: `bytes=${start}-` } } : {});
      if (res.status !== 200 && res.status !== 206) throw new Error(`HTTP ${res.status}`);
      const body = res.body;
      if (!body) throw new Error('no body');
      return {
        offset: res.status === 206 ? start : 0,
        chunks: (async function* () {
          for await (const c of body as unknown as AsyncIterable<Uint8Array>) yield c;
        })(),
      };
    },
    async writeAppend(rel: string, chunk: Uint8Array) {
      mkdirSync(dirname(p(rel)), { recursive: true });
      appendFileSync(p(rel), chunk);
    },
    async readFile(rel: string) {
      return existsSync(p(rel)) && statSync(p(rel)).isFile() ? new Uint8Array(readFileSync(p(rel))) : null;
    },
    async remove(rel: string) {
      rmSync(p(rel), { recursive: true, force: true });
    },
  };
  return t;
}

function tempStore() {
  return mkdtempSync(join(tmpdir(), 'glaze-packs-'));
}

const opts = (transport: Transport, extra: Partial<Parameters<typeof downloadPack>[0]> = {}) => ({
  baseUrl: base,
  packId: AURORA_PACK_ID,
  transport,
  appVersion: '0.1.0',
  ...extra,
});

async function rejectsWith(p: Promise<unknown>, code: string) {
  await assert.rejects(p, (e: unknown) => e instanceof PackError && e.code === code);
}

// ------------------------------------------------------------ tests

test('downloads, verifies and stores a pack; themes rebuild from the stored files', async () => {
  resetHooks();
  const dir = tempStore();
  const t = nodeTransport(dir);
  const progress: number[] = [];
  const r = await downloadPack(opts(t, { onProgress: (p) => progress.push(p.doneBytes) }));
  assert.equal(r.fetchedBytes, MANIFEST.totalBytes);
  assert.deepEqual(r.resumed, []);
  assert.deepEqual(r.retried, []);
  assert.equal(progress[0], 0);
  assert.equal(progress[progress.length - 1], MANIFEST.totalBytes);
  for (let i = 1; i < progress.length; i++) assert.ok(progress[i] >= progress[i - 1]);
  for (const a of MANIFEST.assets) assert.equal(statSync(join(dir, AURORA_PACK_ID, a.path)).size, a.bytes);
  assert.equal((await readLocalManifest(t, AURORA_PACK_ID))?.id, AURORA_PACK_ID);
  const themes = await loadPackThemes(t, AURORA_PACK_ID);
  assert.deepEqual(JSON.parse(JSON.stringify(themes)), JSON.parse(JSON.stringify(NEW_PLUS_THEMES)));

  // Already complete: a re-run only fetches the manifest.
  requests.length = 0;
  const again = await downloadPack(opts(t));
  assert.equal(again.fetchedBytes, 0);
  assert.deepEqual(requests.map((q) => q.path), ['manifest.json']);

  await removePack(t, AURORA_PACK_ID);
  assert.equal(await readLocalManifest(t, AURORA_PACK_ID), null);
  assert.deepEqual(await loadPackThemes(t, AURORA_PACK_ID), []);
  rmSync(dir, { recursive: true, force: true });
});

test('an interrupted download resumes with a Range request from the partial file', async () => {
  resetHooks();
  const dir = tempStore();
  const t = nodeTransport(dir);
  hooks.cut.set(FIRST, 200);
  await rejectsWith(downloadPack(opts(t)), 'network');
  const partial = statSync(join(dir, AURORA_PACK_ID, FIRST)).size;
  assert.ok(partial > 0 && partial < MANIFEST.assets[0].bytes, `partial ${partial}`);
  assert.equal(await readLocalManifest(t, AURORA_PACK_ID), null, 'not marked downloaded');

  requests.length = 0;
  const r = await downloadPack(opts(t));
  assert.deepEqual(r.resumed, [FIRST]);
  assert.deepEqual(
    requests.find((q) => q.path === FIRST),
    { path: FIRST, range: `bytes=${partial}-` },
  );
  assert.equal(r.fetchedBytes, MANIFEST.totalBytes - partial);
  assert.equal((await loadPackThemes(t, AURORA_PACK_ID)).length, 8);
  rmSync(dir, { recursive: true, force: true });
});

test('a server that ignores Range restarts the file from zero and still verifies', async () => {
  resetHooks();
  const dir = tempStore();
  const t = nodeTransport(dir);
  hooks.cut.set(FIRST, 150);
  await rejectsWith(downloadPack(opts(t)), 'network');
  hooks.ignoreRange = true;
  const r = await downloadPack(opts(t));
  assert.deepEqual(r.resumed, []);
  assert.equal((await loadPackThemes(t, AURORA_PACK_ID)).length, 8);
  rmSync(dir, { recursive: true, force: true });
});

test('a corrupted asset fails its integrity check and is retried once', async () => {
  resetHooks();
  const dir = tempStore();
  const t = nodeTransport(dir);
  const target = MANIFEST.assets[2].path;
  hooks.corrupt.set(target, 1);
  const r = await downloadPack(opts(t));
  assert.deepEqual(r.retried, [target]);
  assert.equal(requests.filter((q) => q.path === target).length, 2);
  assert.equal((await loadPackThemes(t, AURORA_PACK_ID)).length, 8);
  rmSync(dir, { recursive: true, force: true });
});

test('an asset that stays corrupt rejects with integrity and leaves no pack behind', async () => {
  resetHooks();
  const dir = tempStore();
  const t = nodeTransport(dir);
  const target = MANIFEST.assets[1].path;
  hooks.corrupt.set(target, 5);
  await rejectsWith(downloadPack(opts(t)), 'integrity');
  assert.equal(requests.filter((q) => q.path === target).length, 2, 'one try + one retry');
  assert.ok(!existsSync(join(dir, AURORA_PACK_ID, target)), 'bad file removed');
  assert.equal(await readLocalManifest(t, AURORA_PACK_ID), null);
  rmSync(dir, { recursive: true, force: true });
});

test('a tampered stored file hides only that theme', async () => {
  resetHooks();
  const dir = tempStore();
  const t = nodeTransport(dir);
  await downloadPack(opts(t));
  const d = MANIFEST.themes[0];
  appendFileSync(join(dir, AURORA_PACK_ID, d.artAsset), 'x');
  const themes = await loadPackThemes(t, AURORA_PACK_ID);
  assert.equal(themes.length, 7);
  assert.ok(!themes.some((x) => x.id === d.id));
  rmSync(dir, { recursive: true, force: true });
});

test('bad manifests and old app versions are refused before any asset is fetched', async () => {
  resetHooks();
  const dir = tempStore();
  const t = nodeTransport(dir);
  const evil = JSON.parse(JSON.stringify(MANIFEST)) as PackManifest;
  evil.assets[0].path = '../../outside.gz';
  hooks.manifestOverride = JSON.stringify(evil);
  await rejectsWith(downloadPack(opts(t)), 'manifest');
  hooks.manifestOverride = JSON.stringify({ ...MANIFEST, format: 'other' });
  await rejectsWith(downloadPack(opts(t)), 'manifest');
  hooks.manifestOverride = JSON.stringify({ ...MANIFEST, id: 'pack-other' });
  await rejectsWith(downloadPack(opts(t)), 'manifest');
  hooks.manifestOverride = JSON.stringify({ ...MANIFEST, minAppVersion: '99.0.0' });
  await rejectsWith(downloadPack(opts(t)), 'app-version');
  assert.ok(requests.every((q) => q.path === 'manifest.json'));
  hooks.manifestOverride = null;
  await rejectsWith(downloadPack(opts(t, { packId: 'pack-missing' })), 'network');
  await rejectsWith(downloadPack(opts(t, { isCancelled: () => true })), 'cancelled');
  rmSync(dir, { recursive: true, force: true });
});

test('base URL config: GitHub release in production (T169); empty = disabled, no request; https or loopback only', async () => {
  assert.equal(PACK_BASE_URL, 'https://github.com/MerlinWerlin/App-Projects/releases/download/glaze-packs-v1');
  assert.equal(PACKS_DISABLED_MESSAGE, 'Theme packs arrive with the store release');
  assert.equal(packsEnabled(PACK_BASE_URL), true);
  assert.equal(packsEnabled(''), false);
  const t = nodeTransport(tempStore());
  await rejectsWith(downloadPack(opts(t, { baseUrl: '' })), 'disabled');
  await rejectsWith(downloadPack(opts(t, { baseUrl: '   ' })), 'disabled');
  assert.equal(t.calls, 0, 'disabled packs make no network call');

  assert.equal(resolvePackBaseUrl('https://cdn.example.test/glaze-packs/'), 'https://cdn.example.test/glaze-packs');
  assert.throws(() => resolvePackBaseUrl('http://cdn.example.test/packs'), PackError);
  assert.throws(() => resolvePackBaseUrl('ftp://x'), PackError);
  assert.throws(() => resolvePackBaseUrl('file:///etc'), PackError);
  assert.equal(packsEnabled('http://cdn.example.test'), false);
  assert.equal(packsEnabled('https://cdn.example.test'), true);
  await rejectsWith(downloadPack(opts(t, { baseUrl: 'http://cdn.example.test' })), 'bad-url');
  assert.equal(t.calls, 0);

  // A trailing slash on the configured base still reaches the fixture server.
  resetHooks();
  const dir = tempStore();
  const t2 = nodeTransport(dir);
  await downloadPack(opts(t2, { baseUrl: `${base}/` }));
  assert.ok(requests.every((q) => !q.path.startsWith('/')));
  assert.equal((await loadPackThemes(t2, AURORA_PACK_ID)).length, 8);
  rmSync(dir, { recursive: true, force: true });
});
