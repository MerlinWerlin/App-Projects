// Glaze 1.0.38: bundled starter packs install through the real downloader, from the app, offline.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { downloadRemoteArtPack, readLocalRemoteArt, type Transport } from './packDownloader.ts';
import { STARTER_BASE, starterCatalog, starterFor, starterInstallPlan, starterRequest, starterThumb, starterTransport, type StarterPackData } from './starterPacks.ts';

const ROOT = process.cwd();
const GENERATED = readFileSync(join(ROOT, 'src', 'generated', 'starterPacks.ts'), 'utf8').replace(/\r\n/g, '\n');
const SCREEN = Number(/STARTER_SCREEN_PX = (\d+);/.exec(GENERATED)![1]);

/** The generated starters, with each file's "module" standing for its path in assets/starter-packs. */
const paths: string[] = [];
const STARTERS: StarterPackData[] = [...GENERATED.matchAll(/entry: (\{.*\}) as CatalogPack,\n\s*manifest: (\{.*\}) as RemoteArtManifest,/g)].map((m) => {
  const entry = JSON.parse(m[1]);
  const files: Record<string, number> = {};
  for (const name of readdirSync(join(ROOT, 'assets', 'starter-packs', entry.id))) {
    paths.push(join(ROOT, 'assets', 'starter-packs', entry.id, name));
    files[name] = paths.length - 1;
  }
  return { entry, manifest: JSON.parse(m[2]), files };
});

function memoryDevice(): Transport & { files: Map<string, Uint8Array>; fetches: string[] } {
  const files = new Map<string, Uint8Array>();
  const fetches: string[] = [];
  return {
    files,
    fetches,
    async fetchRange(url) {
      fetches.push(url);
      throw new Error('the device transport must not be asked to fetch');
    },
    async writeAppend(p, c) {
      const old = files.get(p);
      files.set(p, old ? new Uint8Array([...old, ...c]) : c);
    },
    async readFile(p) {
      return files.get(p) ?? null;
    },
    async remove(p) {
      for (const k of [...files.keys()]) if (k === p || k.startsWith(`${p}/`)) files.delete(k);
    },
  };
}

test('the generated starter set: 6-10 free packs incl. Alpine Starlight, Cloud Atelier and Aurora Haven, under 25 MB, files match the code', () => {
  assert.ok(STARTERS.length >= 6 && STARTERS.length <= 10, `${STARTERS.length} starters`);
  const ids = STARTERS.map((s) => s.entry.id);
  for (const id of ['alpine-starlight', 'cloud-atelier', 'aurora-haven']) assert.ok(ids.includes(id), id);
  const bytes = paths.reduce((n, p) => n + statSync(p).size, 0);
  assert.equal(Number(/STARTER_BYTES = (\d+);/.exec(GENERATED)![1]), bytes);
  assert.ok(bytes < 25e6, `${bytes} bytes`);
  for (const s of STARTERS) {
    assert.equal(s.entry.plus, false, s.entry.id);
    assert.equal(s.manifest.packVersion, s.entry.packVersion, s.entry.id);
    assert.equal('release' in s.entry, false, 'one folder tree: no release tag');
    for (const name of Object.keys(s.files)) assert.match(GENERATED, new RegExp(`require\\('../../assets/starter-packs/${s.entry.id}/${name.replace(/\./g, '\\.')}'\\)`));
    assert.ok(starterThumb(STARTERS, s.entry.id, s.entry.packVersion) !== null, `${s.entry.id} thumb`);
  }
});

test('every bundled starter installs through downloadRemoteArtPack from the bundle: verified, no network', async () => {
  for (const s of STARTERS) {
    const device = memoryDevice();
    const reads: number[] = [];
    const t = starterTransport(STARTERS, device, async (mod) => {
      reads.push(mod);
      return new Uint8Array(readFileSync(paths[mod]));
    });
    const r = await downloadRemoteArtPack({ baseUrl: STARTER_BASE, id: s.entry.id, packVersion: s.entry.packVersion, transport: t, appVersion: '1.0.38', screenLongEdgePx: SCREEN });
    assert.equal(r.manifest.packVersion, s.entry.packVersion);
    assert.deepEqual(new Set(r.manifest.assets.map((a) => a.path)), new Set(Object.keys(s.files)), `${s.entry.id}: exactly the bundled files`);
    assert.equal(device.fetches.length, 0);
    assert.equal(reads.length, Object.keys(s.files).length);
    const local = await readLocalRemoteArt(device, s.entry.id);
    assert.equal(local?.packVersion, s.entry.packVersion);
  }
});

test('the bundle transport answers only its own starters at their bundled version', () => {
  const s = STARTERS[0];
  const v = s.entry.packVersion;
  const thumb = s.manifest.assets.find((a) => a.role === 'thumb')!.path;
  assert.equal(starterRequest(STARTERS, `${STARTER_BASE}/art/${s.entry.id}/v${v}/manifest.json`)?.kind, 'manifest');
  assert.equal(starterRequest(STARTERS, `${STARTER_BASE}/art/${s.entry.id}/v${v}/${thumb}`)?.kind, 'file');
  for (const bad of [
    `https://pub-0123.r2.dev/art/${s.entry.id}/v${v}/manifest.json`,
    `${STARTER_BASE}/art/${s.entry.id}/v${v + 1}/manifest.json`,
    `${STARTER_BASE}/art/not-a-starter/v1/manifest.json`,
    `${STARTER_BASE}/art/${s.entry.id}/v${v}/missing.webp`,
    `${STARTER_BASE}/art/${s.entry.id}/v${v}/../../catalog.json`,
    `${STARTER_BASE}/catalog.json`,
  ])
    assert.equal(starterRequest(STARTERS, bad), null, bad);
  assert.equal(starterFor(STARTERS, s.entry.id, v + 1), null, 'a newer catalogue version downloads from the host');
  assert.equal(starterThumb(STARTERS, s.entry.id, v + 1), null);
});

test('first-launch catalogue and install plan', () => {
  const cat = starterCatalog(STARTERS)!;
  assert.deepEqual(cat.packs.map((p) => p.id), STARTERS.map((s) => s.entry.id));
  assert.equal(starterCatalog([]), null);
  const [a, b, ...rest] = STARTERS.map((s) => s.entry.id);
  // On the phone already (downloaded or installed) or removed after an install: never (re)installed.
  assert.deepEqual(starterInstallPlan(STARTERS, new Set([a]), new Set([b])), rest);
});

test('the app wires the starters into the real download path, the launch queue and the thumbnails', () => {
  const packs = readFileSync(join(ROOT, 'src', 'native', 'packs.ts'), 'utf8');
  assert.match(packs, /baseUrl: starter \? STARTER_BASE : PACK_BASE,/);
  assert.match(packs, /transport: starter \? starterTransport\(STARTERS, deviceTransport, readStarterModule\) : deviceTransport,/);
  assert.match(packs, /const seed = starterCatalog\(STARTERS\);/);
  const launch = readFileSync(join(ROOT, 'src', 'store', 'launchWork.ts'), 'utf8');
  assert.match(launch, /requestDeferred\(DEFERRED_STEPS\.starterPacks\);/);
  const img = readFileSync(join(ROOT, 'src', 'ui', 'RemoteArtImage.tsx'), 'utf8');
  assert.match(img, /source=\{bundled \?\? \(uri \? \{ uri \} : undefined\)\}/);
  assert.ok(existsSync(join(ROOT, 'assets', 'starter-packs')));
});
