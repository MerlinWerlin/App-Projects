// T222 (owner-1101e): downloaded remote art packs update when the catalogue lists a newer
// packVersion. Pure decisions (packUpdates.ts) plus the staged download + atomic swap in
// packDownloader.ts against a local fixture server (node:http on 127.0.0.1, port 0). No external network.
import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { AddressInfo } from 'node:net';
import {
  PACK_UPDATE_RETRY_MAX_MS,
  PACK_UPDATE_RETRY_MS,
  downloadedPackVersion,
  packUpdatePlan,
  packUpdateState,
  packUpdateView,
  recordUpdateFailure,
  updateBackoffMs,
  updateRetryDue,
} from './packUpdates.ts';
import { PackError, downloadRemoteArtPack, loadRemoteArt, previousDir, readLocalRemoteArt, recoverRemoteArtSwap, remoteArtCacheEntry, removePack, stagingDir, type Transport } from './packDownloader.ts';
import { manifestPath, parseCatalog, parseRemoteArtManifest } from './packCatalog.ts';
import { remoteArtFiles } from './remoteCatalog.ts';
import { cacheIndexAdd, cacheIndexSetPackVersion, parseCacheIndex, EMPTY_CACHE_INDEX } from './themePack.ts';

const FIX = join(dirname(new URL(import.meta.url).pathname), 'fixtures');
const fixture = (name: string) => JSON.parse(readFileSync(join(FIX, name), 'utf8')) as Record<string, unknown>;

// ------------------------------------------------------------ pure decisions

test('downloadedPackVersion: recorded version wins, else the manifest, else 1 (back-fill), null when not downloaded', () => {
  assert.equal(downloadedPackVersion({ packVersion: 3 }, { packVersion: 2 }), 3);
  assert.equal(downloadedPackVersion({}, { packVersion: 2 }), 2);
  assert.equal(downloadedPackVersion({ packVersion: 0 }, null), 1);
  assert.equal(downloadedPackVersion({}), 1);
  assert.equal(downloadedPackVersion(null, { packVersion: 1 }), 1);
  assert.equal(downloadedPackVersion(null, null), null);
  assert.equal(downloadedPackVersion(undefined), null);
});

test('packUpdateState: needs-update only when the catalogue is newer', () => {
  assert.equal(packUpdateState(2, 1), 'needs-update');
  assert.equal(packUpdateState(2, 2), 'up-to-date');
  assert.equal(packUpdateState(1, 2), 'up-to-date', 'a rolled-back catalogue never downgrades');
  assert.equal(packUpdateState(null, 1), 'up-to-date', 'not in the catalogue any more: keep it');
  assert.equal(packUpdateState(2, null), 'not-downloaded');
  assert.equal(packUpdateState(2, 0), 'not-downloaded');
});

test('fixtures: the v1 catalogue matches the v1 manifest; a v2 catalogue entry makes it outdated', () => {
  const cat = parseCatalog(fixture('catalog-glaze-packs-v1.json'));
  assert.ok(cat.ok);
  const m = parseRemoteArtManifest(fixture('manifest-alpine-starlight-v1.json'), 'alpine-starlight');
  assert.ok(m.ok);
  // An index entry written before T222 has no packVersion: back-filled from the manifest.
  const legacy = parseCacheIndex(JSON.stringify({ version: 1, packs: [{ id: 'alpine-starlight', name: 'Alpine Starlight', version: 1, bytes: 1, themeIds: ['alpine-starlight'], downloadedAt: '' }] }));
  assert.equal(legacy.packs[0].packVersion, undefined);
  const have = downloadedPackVersion(legacy.packs[0], m.value);
  assert.equal(have, 1);
  const v1 = cat.value.packs.find((p) => p.id === 'alpine-starlight')!;
  assert.equal(packUpdateState(v1.packVersion, have), 'up-to-date');
  const raw = fixture('catalog-glaze-packs-v1.json') as { packs: Record<string, unknown>[] };
  for (const p of raw.packs) {
    if (p.id !== 'alpine-starlight') continue;
    p.packVersion = 2;
    p.manifest = manifestPath('alpine-starlight', 2);
    p.thumb = String(p.thumb).replace('/v1/', '/v2/');
  }
  const cat2 = parseCatalog(raw);
  assert.ok(cat2.ok);
  const plan = packUpdatePlan({ catalog: cat2.value, versions: { 'alpine-starlight': have }, now: 0 });
  assert.deepEqual(plan, [{ id: 'alpine-starlight', from: 1, to: 2 }]);
});

test('cache index keeps and back-fills packVersion', () => {
  const idx = cacheIndexAdd(EMPTY_CACHE_INDEX, { id: 'a', name: 'A', version: 1, bytes: 10, themeIds: ['a'], downloadedAt: '' });
  assert.equal('packVersion' in idx.packs[0], false);
  const filled = cacheIndexSetPackVersion(idx, 'a', 1);
  assert.equal(filled.packs[0].packVersion, 1);
  assert.equal(cacheIndexSetPackVersion(filled, 'a', 1), filled, 'unchanged index keeps identity');
  assert.equal(cacheIndexSetPackVersion(filled, 'missing', 2), filled);
  const round = parseCacheIndex(JSON.stringify(cacheIndexSetPackVersion(filled, 'a', 2)));
  assert.equal(round.packs[0].packVersion, 2);
  assert.equal(parseCacheIndex(JSON.stringify({ packs: [{ id: 'a', name: 'A', bytes: 1, packVersion: 'x' }] })).packs[0].packVersion, undefined);
});

test('packUpdatePlan: catalogue order, skips busy, current, missing and backed-off packs', () => {
  const pk = (id: string, packVersion: number) => ({ id, packVersion }) as never;
  const catalog = { packs: [pk('a', 2), pk('b', 3), pk('c', 1), pk('d', 2), pk('e', 4)] };
  const now = 1_000_000_000;
  const plan = packUpdatePlan({
    catalog,
    versions: { a: 1, b: 1, c: 1, e: 2 },
    busy: { b: 0.4 },
    failures: { e: { at: now - 1000, attempts: 1, toVersion: 4 } },
    now,
  });
  assert.deepEqual(plan, [{ id: 'a', from: 1, to: 2 }]);
  assert.deepEqual(packUpdatePlan({ catalog: null, versions: { a: 1 }, now }), []);
  // The backoff passes; a catalogue that moved on to another version retries at once.
  assert.deepEqual(
    packUpdatePlan({ catalog, versions: { e: 2 }, failures: { e: { at: now, attempts: 1, toVersion: 4 } }, now: now + PACK_UPDATE_RETRY_MS }).map((t) => t.id),
    ['e'],
  );
  assert.deepEqual(packUpdatePlan({ catalog, versions: { e: 2 }, failures: { e: { at: now, attempts: 5, toVersion: 3 } }, now }).map((t) => t.id), ['e']);
});

test('retry backoff doubles and is capped; a clock going back retries', () => {
  assert.equal(updateBackoffMs(1), PACK_UPDATE_RETRY_MS);
  assert.equal(updateBackoffMs(2), PACK_UPDATE_RETRY_MS * 2);
  assert.equal(updateBackoffMs(99), PACK_UPDATE_RETRY_MAX_MS);
  const f1 = recordUpdateFailure(null, 100, 2);
  assert.deepEqual(f1, { at: 100, attempts: 1, toVersion: 2 });
  const f2 = recordUpdateFailure(f1, 200, 2);
  assert.equal(f2.attempts, 2);
  assert.equal(recordUpdateFailure(f2, 300, 3).attempts, 1, 'a new target version starts over');
  assert.equal(updateRetryDue(f2, 200 + PACK_UPDATE_RETRY_MS, 2), false);
  assert.equal(updateRetryDue(f2, 200 + 2 * PACK_UPDATE_RETRY_MS, 2), true);
  assert.equal(updateRetryDue(f2, 50, 2), true);
  assert.equal(updateRetryDue(null, 0, 2), true);
});

test('packUpdateView: none / pending / updating / failed', () => {
  assert.deepEqual(packUpdateView({ catalogVersion: 2, downloadedVersion: 2 }), { kind: 'none' });
  assert.deepEqual(packUpdateView({ catalogVersion: 2, downloadedVersion: null, progress: 0.5 }), { kind: 'none' }, 'first download uses the Download flow');
  assert.deepEqual(packUpdateView({ catalogVersion: 2, downloadedVersion: 1 }), { kind: 'pending', toVersion: 2 });
  assert.deepEqual(packUpdateView({ catalogVersion: 2, downloadedVersion: 1, progress: 0.999 }), { kind: 'updating', percent: 99 });
  assert.deepEqual(packUpdateView({ catalogVersion: 2, downloadedVersion: 1, failure: { at: 0, attempts: 1, toVersion: 2 } }), { kind: 'failed', toVersion: 2 });
  assert.deepEqual(packUpdateView({ catalogVersion: 3, downloadedVersion: 1, failure: { at: 0, attempts: 1, toVersion: 2 } }), { kind: 'pending', toVersion: 3 });
});

// ------------------------------------------------------------ staged update against a fixture server

const ID = 'deep-blue';
const palette = { bg: '#04182E', tile: '#0C2A40', glyph: '#E6FBFF', accent: '#5EE1D9', text: '#E9FAFF' };
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
function bytesOf(n: number, seed: number): Buffer {
  const b = Buffer.alloc(n);
  for (let i = 0; i < n; i++) b[i] = (i * 29 + seed * 13) & 0xff;
  return b;
}
type FileSpec = { path: string; role: string; width: number; height: number; body: Buffer };
// Shared between v1 and v2 (same name and hash): the wallpaper and the thumb.
const WALL: FileSpec = { path: 'wallpaper-2796.aaaa0001.webp', role: 'wallpaper', width: 1290, height: 2796, body: bytesOf(4000, 1) };
const THUMB: FileSpec = { path: 'thumb.dddd0001.webp', role: 'thumb', width: 240, height: 520, body: bytesOf(400, 2) };
const V1: FileSpec[] = [
  WALL,
  { path: 'widget-small.cccc0001.webp', role: 'widget-small', width: 510, height: 510, body: bytesOf(900, 3) },
  { path: 'widget-medium.cccc0002.webp', role: 'widget-medium', width: 1092, height: 510, body: bytesOf(900, 4) },
  { path: 'widget-large.cccc0003.webp', role: 'widget-large', width: 1092, height: 1146, body: bytesOf(900, 5) },
  THUMB,
];
const V2: FileSpec[] = [
  WALL,
  THUMB,
  ...[1, 2, 3, 4, 5, 6].map((n) => ({ path: `art-${n}.eeee000${n}.webp`, role: 'widget-art', width: 1024, height: 1024, body: bytesOf(700, 10 + n) })),
];
function manifestFor(version: number, files: FileSpec[]) {
  const assets = files.map((f) => ({ path: f.path, role: f.role, width: f.width, height: f.height, bytes: f.body.length, sha256: sha(f.body), mime: 'image/webp' }));
  const m: Record<string, unknown> = {
    format: 'glaze-remote-art-pack', version: version >= 2 ? 2 : 1, id: ID, packVersion: version, name: 'Deep Blue', plus: false, minAppVersion: '1.0.0', palette,
    meta: { name: 'Deep Blue', mood: 'calm', tags: [], credits: 'Glaze', licence: 'original', generator: 'procedural', prompt: '' },
    thumbhash: 'AbCd', assets, totalBytes: assets.reduce((n, a) => n + a.bytes, 0),
  };
  if (version >= 2) {
    m.widgets = files.filter((f) => f.role === 'widget-art').map((f, i) => ({ id: `art-${i + 1}`, kind: 'art', image: f.path, sizes: ['small', 'medium', 'large'] }));
  }
  return m;
}
const bucket = new Map<string, Buffer>();
const requests: string[] = [];
const hooks = { failPaths: new Set<string>() };
function publish(version: number, files: FileSpec[]) {
  for (const f of files) bucket.set(`art/${ID}/v${version}/${f.path}`, f.body);
  bucket.set(manifestPath(ID, version), Buffer.from(JSON.stringify(manifestFor(version, files))));
}
let server: Server;
let base = '';
before(async () => {
  server = createServer((req, res) => {
    const rel = decodeURIComponent((req.url ?? '/').split('?')[0]).replace(/^\/+/, '');
    requests.push(rel);
    const body = bucket.get(rel);
    if (!body || [...hooks.failPaths].some((p) => rel.endsWith(p))) {
      res.writeHead(body ? 503 : 404).end();
      return;
    }
    res.writeHead(200, { 'content-length': body.length }).end(body);
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => {
  server.close();
});

function nodeTransport(root: string, withMove = true): Transport {
  const p = (rel: string) => join(root, rel);
  const t: Transport = {
    async fetchRange(url, start) {
      const res = await fetch(url, start > 0 ? { headers: { Range: `bytes=${start}-` } } : {});
      if (res.status !== 200 && res.status !== 206) throw new Error(`HTTP ${res.status}`);
      const buf = new Uint8Array(await res.arrayBuffer());
      return { offset: res.status === 206 ? start : 0, chunks: (async function* () { yield buf; })() };
    },
    async writeAppend(rel, chunk) {
      mkdirSync(dirname(p(rel)), { recursive: true });
      appendFileSync(p(rel), chunk);
    },
    async readFile(rel) {
      return existsSync(p(rel)) && statSync(p(rel)).isFile() ? new Uint8Array(readFileSync(p(rel))) : null;
    },
    async remove(rel) {
      rmSync(p(rel), { recursive: true, force: true });
    },
  };
  if (withMove) {
    t.move = async (from, to) => {
      if (existsSync(p(to))) throw new Error('destination exists');
      mkdirSync(dirname(p(to)), { recursive: true });
      renameSync(p(from), p(to));
    };
  }
  return t;
}
const temp = () => mkdtempSync(join(tmpdir(), 'glaze-update-'));
const opts = (t: Transport, packVersion: number, extra: Record<string, unknown> = {}) => ({
  baseUrl: base, id: ID, packVersion, transport: t, appVersion: '1.0.1', screenLongEdgePx: 2796, ...extra,
});

for (const withMove of [true, false]) {
  test(`update v1 -> v2 (${withMove ? 'rename swap' : 'copy fallback'}): shared files copied locally, v2 widget art listed, old files gone`, async () => {
    bucket.clear();
    publish(1, V1);
    publish(2, V2);
    const dir = temp();
    const t = nodeTransport(dir, withMove);
    const r1 = await downloadRemoteArtPack(opts(t, 1));
    assert.equal(r1.manifest.widgets.length, 3, 'v1: 3 pieces derived from the widget-* files');
    assert.equal(remoteArtCacheEntry(r1.manifest, new Date(0)).packVersion, 1);
    requests.length = 0;
    const r2 = await downloadRemoteArtPack(opts(t, 2));
    assert.equal(r2.manifest.packVersion, 2);
    assert.equal(r2.manifest.widgets.length, 6, 'v2: the full widget art list');
    assert.ok(!requests.some((u) => u.endsWith(WALL.path) || u.endsWith(THUMB.path)), 'unchanged files are not downloaded again');
    const m = await loadRemoteArt(t, ID);
    assert.equal(m?.packVersion, 2);
    assert.equal(remoteArtFiles(m!).heroes.small, 'art-1.eeee0001.webp');
    const names = readdirSync(join(dir, ID)).sort();
    assert.deepEqual(names, [...V2.map((f) => f.path), 'manifest.json'].sort());
    assert.ok(!existsSync(join(dir, stagingDir(ID))), 'staging folder cleaned up');
    assert.ok(!existsSync(join(dir, previousDir(ID))), 'previous copy deleted after the swap');
    rmSync(dir, { recursive: true, force: true });
  });
}

test('a failed update keeps v1 working; the retry resumes the staged files and swaps', async () => {
  bucket.clear();
  publish(1, V1);
  publish(2, V2);
  const dir = temp();
  const t = nodeTransport(dir);
  await downloadRemoteArtPack(opts(t, 1));
  hooks.failPaths.add('art-4.eeee0004.webp');
  await assert.rejects(downloadRemoteArtPack(opts(t, 2, { retries: 0 })), (e: unknown) => e instanceof PackError && e.code === 'network');
  const still = await loadRemoteArt(t, ID);
  assert.equal(still?.packVersion, 1, 'old version still on the phone and verified');
  assert.equal(still?.widgets.length, 3);
  assert.ok(existsSync(join(dir, stagingDir(ID), 'art-1.eeee0001.webp')), 'staged files kept for the retry');
  hooks.failPaths.clear();
  requests.length = 0;
  const r = await downloadRemoteArtPack(opts(t, 2));
  assert.equal(r.manifest.packVersion, 2);
  assert.ok(!requests.some((u) => u.endsWith('art-1.eeee0001.webp')), 'already staged files are not fetched again');
  assert.equal((await loadRemoteArt(t, ID))?.widgets.length, 6);
  rmSync(dir, { recursive: true, force: true });
});

test('a cancelled update keeps the old version; a staged copy of another version is discarded', async () => {
  bucket.clear();
  publish(1, V1);
  publish(2, V2);
  const v3 = V2.map((f) => (f.role === 'widget-art' ? { ...f, path: f.path.replace('eeee', 'ffff'), body: bytesOf(650, f.body[1]) } : f));
  publish(3, v3);
  const dir = temp();
  const t = nodeTransport(dir);
  await downloadRemoteArtPack(opts(t, 1));
  let n = 0;
  await assert.rejects(downloadRemoteArtPack(opts(t, 2, { isCancelled: () => ++n > 4 })), (e: unknown) => e instanceof PackError && e.code === 'cancelled');
  assert.equal((await readLocalRemoteArt(t, ID))?.packVersion, 1);
  const r = await downloadRemoteArtPack(opts(t, 3));
  assert.equal(r.manifest.packVersion, 3);
  assert.deepEqual(readdirSync(join(dir, ID)).sort(), [...v3.map((f) => f.path), 'manifest.json'].sort(), 'no v2 leftovers');
  rmSync(dir, { recursive: true, force: true });
});

test('a swap interrupted by the app being killed is undone on the next read; removePack clears staging', async () => {
  bucket.clear();
  publish(1, V1);
  publish(2, V2);
  const dir = temp();
  const t = nodeTransport(dir);
  await downloadRemoteArtPack(opts(t, 1));
  // Simulate: old copy moved aside, staged copy not moved in yet.
  await t.move!(ID, previousDir(ID));
  assert.equal(await readLocalRemoteArt(t, ID), null);
  const back = await loadRemoteArt(t, ID);
  assert.equal(back?.packVersion, 1, 'previous version restored');
  await recoverRemoteArtSwap(t, ID); // no-op now
  hooks.failPaths.add('art-6.eeee0006.webp');
  await assert.rejects(downloadRemoteArtPack(opts(t, 2, { retries: 0 })));
  hooks.failPaths.clear();
  assert.ok(existsSync(join(dir, stagingDir(ID))));
  await removePack(t, ID);
  assert.ok(!existsSync(join(dir, ID)) && !existsSync(join(dir, stagingDir(ID))) && !existsSync(join(dir, previousDir(ID))));
  rmSync(dir, { recursive: true, force: true });
});
