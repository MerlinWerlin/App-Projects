// T274 (owner-1102a A2): more than one pack release (glaze-packs-v2+). A catalogue entry's optional
// `release` moves that pack's files (thumb, manifest, assets) to another tag of the SAME repo;
// catalog.json stays on glaze-packs-v1. No network: an in-memory transport keyed by full URL.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { isPackReleaseTag, packObjectUrl, packReleaseBase } from './packHost.ts';
import { CATALOG_FILE, manifestPath, packFolder, parseCatalog } from './packCatalog.ts';
import { isArtPackId, PALETTE_KEYS } from './artPack.ts';
import { downloadRemoteArtPack, fetchCatalogText, PackError, type Transport } from './packDownloader.ts';
import { remoteArtThemes } from './remoteCatalog.ts';
import { PACK_BASE_URLS } from '../config/packs.ts';

const REPO = 'https://github.com/MerlinWerlin/App-Projects/releases/download';
const V1 = `${REPO}/glaze-packs-v1`;
const V2 = `${REPO}/glaze-packs-v2`;
const STAGING = `${REPO}/glaze-packs-staging`;
const palette = { bg: '#04182E', tile: '#0C2A40', glyph: '#E6FBFF', accent: '#5EE1D9', text: '#E9FAFF' };

function entry(id: string, over: Record<string, unknown> = {}) {
  return { id, name: 'Deep Sea', packVersion: 2, plus: false, bytes: 460, manifest: manifestPath(id, 2), thumb: `art/${id}/v2/thumb.0000dddd.webp`, thumbhash: 'AbCd', palette, tags: ['ocean'], mood: 'calm', addedAt: '2026-10-24', ...over };
}
const catalogOf = (packs: unknown[]) => ({ format: 'glaze-catalog', version: 1, generatedAt: '2026-11-02T00:00:00Z', packs });

test('release tags: only glaze-packs-v<n>', () => {
  for (const ok of ['glaze-packs-v1', 'glaze-packs-v2', 'glaze-packs-v12']) assert.equal(isPackReleaseTag(ok), true, ok);
  for (const bad of ['', 'glaze-packs-staging', 'glaze-packs-v', 'glaze-packs-v2/../x', 'Glaze-packs-v2', 'glaze-packs-v2 ', 'other-v2', 2, null, undefined, {}]) {
    assert.equal(isPackReleaseTag(bad), false, String(bad));
  }
});

test('packReleaseBase: swaps only the tag of a numbered GitHub release; everything else unchanged', () => {
  assert.equal(packReleaseBase(V1, 'glaze-packs-v2'), V2);
  assert.equal(packReleaseBase(`${V1}/`, 'glaze-packs-v2'), V2);
  assert.equal(packReleaseBase(V2, 'glaze-packs-v1'), V1);
  // Missing / bad release: the base exactly as given (pre-T274 behaviour).
  for (const r of [undefined, null, '', 'glaze-packs-staging', 'https://evil/x', '../x']) assert.equal(packReleaseBase(`${V1}/`, r as string), `${V1}/`, String(r));
  // Staging stays staging; folder hosts (R2/CDN, the fixture server) serve every pack under one tree.
  assert.equal(packReleaseBase(STAGING, 'glaze-packs-v2'), STAGING);
  assert.equal(packReleaseBase('https://pub-0123.r2.dev/glaze', 'glaze-packs-v2'), 'https://pub-0123.r2.dev/glaze');
  assert.equal(packReleaseBase('http://127.0.0.1:4567', 'glaze-packs-v2'), 'http://127.0.0.1:4567');
  // Owner/repo always come from the configured base.
  assert.equal(packReleaseBase('https://github.com/o/r/releases/download/glaze-packs-v1', 'glaze-packs-v3'), 'https://github.com/o/r/releases/download/glaze-packs-v3');
  assert.equal(packReleaseBase(PACK_BASE_URLS.production, 'glaze-packs-v2'), V2);
  assert.equal(packReleaseBase(PACK_BASE_URLS.staging, 'glaze-packs-v2'), PACK_BASE_URLS.staging);
  assert.equal(packObjectUrl(packReleaseBase(V1, 'glaze-packs-v2'), manifestPath('deep-sea', 2)), `${V2}/art__deep-sea__v2__manifest.json`);
});

test('parseCatalog: release kept when valid, dropped (pack still listed) when not', () => {
  const r = parseCatalog(catalogOf([
    entry('a-pack'),
    entry('b-pack', { release: 'glaze-packs-v2' }),
    entry('c-pack', { release: 'glaze-packs-v1' }),
    entry('d-pack', { release: 'glaze-packs-staging' }),
    entry('e-pack', { release: 42 }),
    entry('f-pack', { release: 'https://evil.example/x' }),
    entry('g-pack', { release: '' }),
  ]));
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.deepEqual(r.value.packs.map((p) => [p.id, p.release]), [
    ['a-pack', undefined], ['b-pack', 'glaze-packs-v2'], ['c-pack', undefined], ['d-pack', undefined], ['e-pack', undefined], ['f-pack', undefined], ['g-pack', undefined],
  ]);
  // No `release` key at all when absent: a v1 entry parses to exactly what it did before T274.
  assert.equal('release' in r.value.packs[0], false);
  assert.equal('release' in r.value.packs[2], false);
});

// The catalogue parser as shipped before T274 (frozen copy of parseCatalog at 7769d3a, trimmed of
// the category helper's comments). Older builds run this: an extra `release` field must not hide
// the pack or the catalogue.
function parseCatalogPreT274(raw: unknown): { ok: boolean; ids: string[]; keys: string[][] } {
  const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
  const posInt = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x) && x > 0;
  const str = (x: unknown, max = 400): x is string => typeof x === 'string' && x.length > 0 && x.length <= max;
  const pal = (x: unknown) => {
    if (!isObj(x)) return null;
    for (const k of PALETTE_KEYS) if (typeof x[k] !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(x[k] as string)) return null;
    return x;
  };
  const safe = (p: unknown) => typeof p === 'string' && /^[a-z0-9][a-z0-9._-]{0,120}$/.test(p) && !p.includes('..') && p !== 'manifest.json';
  if (!isObj(raw) || raw.format !== 'glaze-catalog' || raw.version !== 1 || !str(raw.generatedAt, 40) || !Array.isArray(raw.packs)) return { ok: false, ids: [], keys: [] };
  const seen = new Set<string>();
  const ids: string[] = [];
  const keys: string[][] = [];
  for (const p of raw.packs) {
    if (!isObj(p) || !isArtPackId(p.id) || seen.has(p.id as string)) continue;
    const id = p.id as string;
    if (!str(p.name, 60) || !posInt(p.packVersion) || typeof p.plus !== 'boolean' || !posInt(p.bytes) || !pal(p.palette)) continue;
    if (p.manifest !== manifestPath(id, p.packVersion)) continue;
    if (typeof p.thumb !== 'string' || !p.thumb.startsWith(packFolder(id, p.packVersion) + '/') || !safe(p.thumb.slice(packFolder(id, p.packVersion).length + 1))) continue;
    if (typeof p.thumbhash !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(p.thumbhash) || p.thumbhash.length > 64) continue;
    if (p.bytes > 20_000_000) continue;
    seen.add(id);
    ids.push(id);
    // The old parser builds each pack from named fields only, so `release` never reaches it.
    keys.push(['id', 'name', 'packVersion', 'plus', 'bytes', 'manifest', 'thumb', 'thumbhash', 'palette', 'tags', 'mood', 'addedAt', 'category']);
  }
  return { ok: true, ids, keys };
}

test('old builds: a v1-era parse of entries with `release` still succeeds and lists every pack', () => {
  const raw = catalogOf([entry('a-pack'), entry('b-pack', { release: 'glaze-packs-v2' }), entry('c-pack', { release: 'not-a-tag' })]);
  const old = parseCatalogPreT274(raw);
  assert.equal(old.ok, true);
  assert.deepEqual(old.ids, ['a-pack', 'b-pack', 'c-pack']);
  assert.equal(old.keys.every((k) => !k.includes('release')), true);
  const now = parseCatalog(raw);
  assert.equal(now.ok, true);
  if (now.ok) assert.deepEqual(now.value.packs.map((p) => p.id), old.ids);
});

// ------------------------------------------------------------ URLs end to end (in-memory host)

const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const bytes = (n: number, seed: number) => Uint8Array.from({ length: n }, (_, i) => (i * 31 + seed * 17) & 0xff);

function memHost(files: Map<string, Uint8Array>) {
  const disk = new Map<string, Uint8Array>();
  const urls: string[] = [];
  const t: Transport = {
    async fetchRange(url, start) {
      urls.push(url);
      const body = files.get(url);
      if (!body) throw new PackError('network', `HTTP 404 ${url}`);
      return { offset: start, chunks: (async function* () { yield body.subarray(start); })() };
    },
    async writeAppend(rel, chunk) {
      const have = disk.get(rel) ?? new Uint8Array(0);
      const next = new Uint8Array(have.length + chunk.length);
      next.set(have);
      next.set(chunk, have.length);
      disk.set(rel, next);
    },
    async readFile(rel) {
      return disk.get(rel) ?? null;
    },
    async remove(rel) {
      for (const k of [...disk.keys()]) if (k === rel || k.startsWith(rel + '/')) disk.delete(k);
    },
  };
  return { t, urls };
}

function publishPack(files: Map<string, Uint8Array>, base: string, id: string) {
  const wall = bytes(900, 1);
  const thumb = bytes(200, 2);
  const assets = [
    { path: 'wallpaper-1334.1000aaaa.webp', role: 'wallpaper', width: 750, height: 1334, bytes: wall.length, sha256: sha(wall), mime: 'image/webp' },
    { path: 'thumb.1000dddd.webp', role: 'thumb', width: 240, height: 520, bytes: thumb.length, sha256: sha(thumb), mime: 'image/webp' },
  ];
  const manifest = {
    format: 'glaze-remote-art-pack', version: 1, id, packVersion: 1, name: 'Deep Sea', plus: false, minAppVersion: '1.0.0', palette,
    meta: { name: 'Deep Sea', mood: 'calm', tags: [], credits: '', licence: 'original', generator: '', prompt: '' },
    thumbhash: 'AbCd', assets, totalBytes: wall.length + thumb.length,
  };
  const folder = packFolder(id, 1);
  files.set(packObjectUrl(base, manifestPath(id, 1)), new TextEncoder().encode(JSON.stringify(manifest)));
  files.set(packObjectUrl(base, `${folder}/${assets[0].path}`), wall);
  files.set(packObjectUrl(base, `${folder}/${assets[1].path}`), thumb);
  return { bytes: manifest.totalBytes, thumb: `${folder}/${assets[1].path}` };
}

test('a glaze-packs-v2 pack: catalogue from v1, thumb + manifest + every asset from v2', async () => {
  const files = new Map<string, Uint8Array>();
  const one = publishPack(files, V1, 'old-pack');
  const two = publishPack(files, V2, 'new-pack');
  const cat = catalogOf([
    entry('old-pack', { packVersion: 1, manifest: manifestPath('old-pack', 1), bytes: one.bytes, thumb: one.thumb }),
    entry('new-pack', { packVersion: 1, manifest: manifestPath('new-pack', 1), bytes: two.bytes, thumb: two.thumb, release: 'glaze-packs-v2' }),
  ]);
  files.set(packObjectUrl(V1, CATALOG_FILE), new TextEncoder().encode(JSON.stringify(cat)));
  const { t, urls } = memHost(files);

  const text = await fetchCatalogText(t, V1);
  assert.deepEqual(urls, [`${V1}/catalog.json`]);
  const parsed = parseCatalog(JSON.parse(text));
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const themes = remoteArtThemes(parsed.value, V1, []);
  assert.equal(themes[0].remoteArt.thumbUrl, `${V1}/art__old-pack__v1__thumb.1000dddd.webp`);
  assert.equal(themes[1].remoteArt.thumbUrl, `${V2}/art__new-pack__v1__thumb.1000dddd.webp`);
  assert.equal(themes[1].remoteArt.release, 'glaze-packs-v2');
  assert.equal('release' in themes[0].remoteArt, false);

  urls.length = 0;
  const entryNew = parsed.value.packs[1];
  const r = await downloadRemoteArtPack({ baseUrl: V1, id: 'new-pack', packVersion: 1, release: entryNew.release, transport: t, appVersion: '1.0.0', screenLongEdgePx: 1334 });
  assert.equal(r.manifest.assets.length, 2);
  assert.ok(urls.length >= 3);
  assert.equal(urls.every((u) => u.startsWith(`${V2}/art__new-pack__v1__`)), true, urls.join('\n'));

  // Missing release: current behaviour exactly (everything from the configured base).
  urls.length = 0;
  await downloadRemoteArtPack({ baseUrl: V1, id: 'old-pack', packVersion: 1, transport: t, appVersion: '1.0.0', screenLongEdgePx: 1334 });
  assert.equal(urls.every((u) => u.startsWith(`${V1}/art__old-pack__v1__`)), true, urls.join('\n'));

  // What an older build does with the v2 entry (it ignores `release`): the v1 release 404s, so
  // the download fails as a network error (no crash, no bad file kept).
  urls.length = 0;
  await assert.rejects(
    downloadRemoteArtPack({ baseUrl: V1, id: 'new-pack', packVersion: 1, transport: memHost(files).t, appVersion: '1.0.0', screenLongEdgePx: 1334 }),
    (e: unknown) => e instanceof PackError,
  );
});
