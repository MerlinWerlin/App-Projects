// T160: remote catalogue fetch + remote art pack downloads against a local fixture server
// (node:http on 127.0.0.1, port 0) laid out like the R2 bucket (catalog.json, art/<id>/v<n>/...).
// No external network.
import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { AddressInfo } from 'node:net';
import {
  PackError,
  downloadRemoteArtPack,
  fetchCatalogText,
  loadRemoteArt,
  readLocalRemoteArt,
  remoteArtCacheEntry,
  removePack,
  type Transport,
} from './packDownloader.ts';
import { manifestPath, parseRemoteArtManifest } from './packCatalog.ts';
import { flatAssetName, packHostKind } from './packHost.ts';
import { cacheIndexAdd, isPackDownloaded, parseCacheIndex, EMPTY_CACHE_INDEX } from './themePack.ts';
import { decideCatalog, remoteArtThemes } from './remoteCatalog.ts';

const ID = 'deep-blue';
const palette = { bg: '#04182E', tile: '#0C2A40', glyph: '#E6FBFF', accent: '#5EE1D9', text: '#E9FAFF' };

function bytesOf(n: number, seed: number): Buffer {
  const b = Buffer.alloc(n);
  for (let i = 0; i < n; i++) b[i] = (i * 31 + seed * 17) & 0xff;
  return b;
}
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');

type FileSpec = { path: string; role: string; width: number; height: number; body: Buffer };
function packFiles(version: number): FileSpec[] {
  return [
    { path: `wallpaper-1334.${version}000aaaa.webp`, role: 'wallpaper', width: 750, height: 1334, body: bytesOf(3000, version) },
    { path: `wallpaper-2796.${version}000bbbb.webp`, role: 'wallpaper', width: 1290, height: 2796, body: bytesOf(9000, version + 1) },
    { path: `widget-small.${version}000cccc.webp`, role: 'widget-small', width: 510, height: 510, body: bytesOf(1500, version + 2) },
    { path: `thumb.${version}000dddd.webp`, role: 'thumb', width: 240, height: 520, body: bytesOf(500, version + 3) },
  ];
}
function manifestFor(version: number, files: FileSpec[], over: Record<string, unknown> = {}) {
  const assets = files.map((f) => ({ path: f.path, role: f.role, width: f.width, height: f.height, bytes: f.body.length, sha256: sha(f.body), mime: 'image/webp' }));
  return {
    format: 'glaze-remote-art-pack', version: 1, id: ID, packVersion: version, name: 'Deep Blue', plus: false, minAppVersion: '1.0.0', palette,
    meta: { name: 'Deep Blue', mood: 'calm', tags: ['ocean'], credits: 'Glaze (original art)', licence: 'original', generator: 'procedural', prompt: '' },
    thumbhash: 'AbCd', assets, totalBytes: assets.reduce((n, a) => n + a.bytes, 0), ...over,
  };
}
function catalogFor(version: number, files: FileSpec[]) {
  const m = manifestFor(version, files);
  return {
    format: 'glaze-catalog', version: 1, generatedAt: '2026-10-30T00:00:00Z',
    packs: [{ id: ID, name: 'Deep Blue', packVersion: version, plus: true, bytes: m.totalBytes, manifest: manifestPath(ID, version), thumb: `art/${ID}/v${version}/${files[3].path}`, thumbhash: 'AbCd', palette, tags: ['ocean'], mood: 'calm', addedAt: '2026-10-29' }],
  };
}

// ------------------------------------------------------------ fixture bucket

const bucket = new Map<string, Buffer>();
function publish(version: number, files = packFiles(version), manifestOver: Record<string, unknown> = {}) {
  for (const f of files) bucket.set(`art/${ID}/v${version}/${f.path}`, f.body);
  bucket.set(manifestPath(ID, version), Buffer.from(JSON.stringify(manifestFor(version, files, manifestOver))));
  bucket.set('catalog.json', Buffer.from(JSON.stringify(catalogFor(version, files))));
  return files;
}
const hooks = { cut: new Map<string, number>(), corrupt: new Map<string, number>(), down: false };
const requests: { path: string; range: string | undefined }[] = [];
let server: Server;
let base = '';

function reset() {
  hooks.cut.clear();
  hooks.corrupt.clear();
  hooks.down = false;
  requests.length = 0;
}

before(async () => {
  server = createServer((req, res) => {
    const rel = decodeURIComponent((req.url ?? '/').split('?')[0]).replace(/^\/+/, '');
    requests.push({ path: rel, range: req.headers.range });
    if (hooks.down) {
      res.writeHead(503).end();
      return;
    }
    // T169: a GitHub release lives at /<owner>/<repo>/releases/download/<tag>/<flat name> and has
    // no folders: only flat names resolve; tag "no-such-release" is a release that doesn't exist.
    const gh = /^([^/]+\/[^/]+\/releases\/download\/([^/]+))\/(.*)$/.exec(rel);
    let key = rel;
    if (gh) {
      const name = gh[3];
      const hit = gh[2] === 'no-such-release' || name.includes('/') ? undefined : [...bucket.keys()].find((k) => flatAssetName(k) === name);
      key = hit ?? '\u0000missing';
    }
    let body = bucket.get(key);
    if (!body) {
      res.writeHead(404).end();
      return;
    }
    const n = hooks.corrupt.get(key) ?? 0;
    if (n > 0) {
      hooks.corrupt.set(key, n - 1);
      body = Buffer.from(body);
      body[body.length >> 1] ^= 0xff;
    }
    const m = req.headers.range ? /^bytes=(\d+)-$/.exec(req.headers.range) : null;
    const start = m ? Number(m[1]) : 0;
    const slice = body.subarray(start);
    const headers = m
      ? { 'content-length': slice.length, 'content-range': `bytes ${start}-${body.length - 1}/${body.length}` }
      : { 'content-length': body.length };
    const cut = hooks.cut.get(rel);
    res.writeHead(m ? 206 : 200, headers);
    if (cut !== undefined) {
      hooks.cut.delete(rel);
      res.write(slice.subarray(0, cut), () => setTimeout(() => res.socket?.destroy(), 30));
      return;
    }
    res.end(slice);
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => {
  server.close();
});

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
const temp = () => mkdtempSync(join(tmpdir(), 'glaze-remote-'));
const opts = (t: Transport, extra: Partial<Parameters<typeof downloadRemoteArtPack>[0]> = {}) => ({
  baseUrl: base, id: ID, packVersion: 1, transport: t, appVersion: '1.0.1', screenLongEdgePx: 1334, ...extra,
});
async function rejectsWith(p: Promise<unknown>, code: string) {
  await assert.rejects(p, (e: unknown) => e instanceof PackError && e.code === code);
}

// ------------------------------------------------------------ tests

test('catalogue fetch: good, bad (kept last good), offline (kept), disabled (no request)', async () => {
  reset();
  bucket.clear();
  publish(1);
  const t = nodeTransport(temp());
  const text = await fetchCatalogText(t, `${base}/`);
  let d = decideCatalog(null, { ok: true, text }, 1000);
  assert.equal(d.save, true);
  const themes = remoteArtThemes(d.catalog, base, []);
  assert.deepEqual(themes.map((x) => [x.id, x.plus]), [[ID, true]]);
  assert.equal(themes[0].remoteArt.thumbUrl, `${base}/art/${ID}/v1/thumb.1000dddd.webp`);
  const good = d.cache;

  bucket.set('catalog.json', Buffer.from('{"format":"glaze-catalog","version":99}'));
  d = decideCatalog(good, { ok: true, text: await fetchCatalogText(t, base) }, 2000);
  assert.equal(d.save, false);
  assert.equal(d.catalog?.packs[0].id, ID, 'bad catalogue ignored, last good one shown');

  hooks.down = true;
  await rejectsWith(fetchCatalogText(t, base), 'network');
  d = decideCatalog(good, { ok: false, error: 'network' }, 3000);
  assert.equal(d.catalog?.packs[0].id, ID);

  const before = t.calls;
  await rejectsWith(fetchCatalogText(t, ''), 'disabled');
  await rejectsWith(downloadRemoteArtPack(opts(t, { baseUrl: '' })), 'disabled');
  assert.equal(t.calls, before, 'empty base URL: no request at all');
});

test('remote art pack: downloads only this phone’s files, verifies, writes the manifest last', async () => {
  reset();
  bucket.clear();
  const files = publish(1);
  const dir = temp();
  const t = nodeTransport(dir);
  const progress: number[] = [];
  const r = await downloadRemoteArtPack(opts(t, { onProgress: (p) => progress.push(p.doneBytes) }));
  // 1334-px screen: the small wallpaper, not the 2796 one.
  assert.deepEqual(r.manifest.assets.map((a) => a.path).sort(), [files[0].path, files[2].path, files[3].path].sort());
  assert.equal(r.fetchedBytes, 3000 + 1500 + 500);
  assert.ok(!requests.some((q) => q.path.endsWith(files[1].path)), 'the big wallpaper is never fetched');
  assert.equal(requests[0].path, manifestPath(ID, 1), 'manifest first');
  assert.equal(progress[progress.length - 1], r.manifest.totalBytes);
  assert.deepEqual(readdirSync(join(dir, ID)).sort(), ['manifest.json', files[0].path, files[2].path, files[3].path].sort());
  const local = await loadRemoteArt(t, ID);
  assert.equal(local?.packVersion, 1);
  assert.ok(parseRemoteArtManifest(JSON.parse(readFileSync(join(dir, ID, 'manifest.json'), 'utf8')), ID).ok, 'device manifest is still a valid manifest');

  // Cache index entry for Settings › Storage.
  const entry = remoteArtCacheEntry(r.manifest, new Date('2026-10-30T10:00:00Z'));
  const index = parseCacheIndex(JSON.stringify(cacheIndexAdd(EMPTY_CACHE_INDEX, entry)));
  assert.equal(isPackDownloaded(index, ID), true);
  // T222: the entry also records the pack's packVersion (so a newer catalogue version updates it).
  assert.deepEqual(index.packs[0], { id: ID, name: 'Deep Blue', version: 1, packVersion: 1, bytes: 5000, themeIds: [ID], downloadedAt: '2026-10-30T10:00:00.000Z' });

  // Again: only the manifest is fetched.
  requests.length = 0;
  const again = await downloadRemoteArtPack(opts(t));
  assert.equal(again.fetchedBytes, 0);
  assert.deepEqual(requests.map((q) => q.path), [manifestPath(ID, 1)]);

  // A big screen picks the big wallpaper.
  const t2 = nodeTransport(temp());
  const big = await downloadRemoteArtPack(opts(t2, { screenLongEdgePx: 2796 }));
  assert.ok(big.manifest.assets.some((a) => a.path === files[1].path));
  assert.ok(!big.manifest.assets.some((a) => a.path === files[0].path));

  await removePack(t, ID);
  assert.equal(await readLocalRemoteArt(t, ID), null);
  rmSync(dir, { recursive: true, force: true });
});

test('remote art pack: an interrupted download resumes with a Range request', async () => {
  reset();
  bucket.clear();
  const files = publish(1);
  const dir = temp();
  const t = nodeTransport(dir);
  const key = `art/${ID}/v1/${files[0].path}`;
  hooks.cut.set(key, 1000);
  await rejectsWith(downloadRemoteArtPack(opts(t)), 'network');
  const partial = statSync(join(dir, ID, files[0].path)).size;
  assert.ok(partial > 0 && partial < 3000, `partial ${partial}`);
  assert.equal(await readLocalRemoteArt(t, ID), null, 'not marked downloaded');
  requests.length = 0;
  const r = await downloadRemoteArtPack(opts(t));
  assert.deepEqual(r.resumed, [files[0].path]);
  assert.equal(requests.find((q) => q.path === key)?.range, `bytes=${partial}-`);
  assert.ok(await loadRemoteArt(t, ID));
  rmSync(dir, { recursive: true, force: true });
});

test('remote art pack: tampering fails integrity; a tampered stored file hides the download', async () => {
  reset();
  bucket.clear();
  const files = publish(1);
  const dir = temp();
  const t = nodeTransport(dir);
  const key = `art/${ID}/v1/${files[2].path}`;
  hooks.corrupt.set(key, 1);
  const r = await downloadRemoteArtPack(opts(t));
  assert.deepEqual(r.retried, [files[2].path], 'retried once and recovered');

  hooks.corrupt.set(key, 5);
  const t2 = nodeTransport(temp());
  await rejectsWith(downloadRemoteArtPack(opts(t2)), 'integrity');
  assert.equal(await readLocalRemoteArt(t2, ID), null);

  appendFileSync(join(dir, ID, files[3].path), 'x');
  assert.equal(await loadRemoteArt(t, ID), null, 'tampered file on the phone: not usable');
  rmSync(dir, { recursive: true, force: true });
});

test('remote art pack: bad manifests, wrong version and old apps are refused before any file', async () => {
  reset();
  bucket.clear();
  publish(1);
  const t = nodeTransport(temp());
  await rejectsWith(downloadRemoteArtPack(opts(t, { packVersion: 2 })), 'network'); // not published
  publish(1, packFiles(1), { minAppVersion: '9.0.0' });
  await rejectsWith(downloadRemoteArtPack(opts(t)), 'app-version');
  publish(1, packFiles(1), { totalBytes: 1 });
  await rejectsWith(downloadRemoteArtPack(opts(t)), 'manifest');
  publish(1, packFiles(1), { id: 'someone-else' });
  await rejectsWith(downloadRemoteArtPack(opts(t)), 'manifest');
  bucket.set(manifestPath(ID, 1), Buffer.from('not json'));
  await rejectsWith(downloadRemoteArtPack(opts(t)), 'manifest');
  assert.ok(requests.every((q) => q.path === manifestPath(ID, 1) || q.path === manifestPath(ID, 2)));
  publish(1);
  await rejectsWith(downloadRemoteArtPack(opts(t, { isCancelled: () => true })), 'cancelled');
});

test('remote art pack: a new version replaces the old files', async () => {
  reset();
  bucket.clear();
  const v1 = publish(1);
  const dir = temp();
  const t = nodeTransport(dir);
  await downloadRemoteArtPack(opts(t));
  const v2 = publish(2);
  const r = await downloadRemoteArtPack(opts(t, { packVersion: 2 }));
  assert.equal(r.manifest.packVersion, 2);
  const names = readdirSync(join(dir, ID));
  assert.ok(!names.includes(v1[0].path), 'old version files removed');
  assert.ok(names.includes(v2[0].path));
  rmSync(dir, { recursive: true, force: true });
});

// ------------------------------------------------------------ T169: GitHub Release hosting

test('GitHub release host: catalogue, thumb, manifest and files are fetched by flat asset name, sha256-checked', async () => {
  reset();
  bucket.clear();
  const files = publish(1);
  const gh = `${base}/MerlinWerlin/App-Projects/releases/download/glaze-packs-v1`;
  assert.equal(packHostKind(gh), 'github-release');
  const dir = temp();
  const t = nodeTransport(dir);
  const d = decideCatalog(null, { ok: true, text: await fetchCatalogText(t, gh) }, 1000);
  assert.equal(d.catalog?.packs[0].id, ID);
  const themes = remoteArtThemes(d.catalog, gh, []);
  assert.equal(themes[0].remoteArt.thumbUrl, `${gh}/art__${ID}__v1__${files[3].path}`);
  const r = await downloadRemoteArtPack(opts(t, { baseUrl: `${gh}/` }));
  assert.equal(r.manifest.assets.length, 3);
  const paths = requests.map((q) => q.path.slice(q.path.indexOf('glaze-packs-v1/') + 'glaze-packs-v1/'.length));
  assert.deepEqual(paths.slice(0, 2), ['catalog.json', `art__${ID}__v1__manifest.json`]);
  assert.ok(paths.every((p) => !p.includes('/')), 'no folder paths on a release host');
  assert.ok(await loadRemoteArt(t, ID));

  // A corrupted asset on the release is caught by the sha256 check and fetched again.
  rmSync(dir, { recursive: true, force: true });
  const t2 = nodeTransport(temp());
  hooks.corrupt.set(`art/${ID}/v1/${files[0].path}`, 1);
  const r2 = await downloadRemoteArtPack(opts(t2, { baseUrl: gh }));
  assert.deepEqual(r2.retried, [files[0].path]);
  hooks.corrupt.set(`art/${ID}/v1/${files[0].path}`, 5);
  await rejectsWith(downloadRemoteArtPack(opts(nodeTransport(temp()), { baseUrl: gh })), 'integrity');
});

test('GitHub release not created yet (404): exactly like offline, cached or empty catalogue, never a crash', async () => {
  reset();
  bucket.clear();
  publish(1);
  const missing = `${base}/MerlinWerlin/App-Projects/releases/download/no-such-release`;
  const t = nodeTransport(temp());
  await rejectsWith(fetchCatalogText(t, missing), 'network');
  // What src/native/packs.ts refreshCatalog does with the failure: nothing cached -> nothing listed.
  let fetched: { ok: false; error: string } | null = null;
  try {
    await fetchCatalogText(t, missing);
  } catch (e) {
    fetched = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  let d = decideCatalog(null, fetched, 1000);
  assert.deepEqual([d.catalog, d.cache, d.save], [null, null, false]);
  assert.deepEqual(remoteArtThemes(d.catalog, missing, []), []);
  // With a last good copy, it stays listed.
  const good = decideCatalog(null, { ok: true, text: await fetchCatalogText(t, `${base}/MerlinWerlin/App-Projects/releases/download/glaze-packs-v1`) }, 1000).cache;
  d = decideCatalog(good, fetched, 2000);
  assert.equal(d.catalog?.packs[0].id, ID);
  assert.equal(d.save, false);
  // A pack download against the missing release fails cleanly with 'network'.
  await rejectsWith(downloadRemoteArtPack(opts(nodeTransport(temp()), { baseUrl: missing })), 'network');
});
