// T169: built packs -> flat GitHub Release assets (node:test, offline). Run: node --test "scripts/packs/*.test.mjs"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildPacks } from './build_packs.mjs';
import { MAX_RELEASE_ASSETS, parseExisting, planRelease, writeReleaseAssets } from './release_assets.mjs';

process.removeAllListeners('warning');
const { parseCatalog, parseRemoteArtManifest } = await import('../../src/core/packCatalog.ts');
const { packObjectUrl } = await import('../../src/core/packHost.ts');

const sha = (b) => createHash('sha256').update(b).digest('hex');
const quiet = () => {};
const tmp = (p) => mkdtempSync(join(tmpdir(), `glaze-${p}-`));
const GH = 'https://github.com/MerlinWerlin/App-Projects/releases/download/glaze-packs-v1';

async function built() {
  const dir = tmp('rel-packs');
  await buildPacks({ outDir: dir, versionsFile: null, log: quiet, encoder: 'png' });
  return dir;
}

test('release assets: flat names, same bytes, catalog last, and every app URL resolves to a file', async () => {
  const dir = await built();
  const out = tmp('rel-out');
  try {
    const r = writeReleaseAssets({ dir, outDir: out, log: quiet });
    const names = readdirSync(r.assetsDir).sort();
    assert.ok(names.includes('catalog.json'));
    assert.ok(names.every((n) => /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(n)), 'valid GitHub asset names');
    assert.equal(names.length, r.plan.length);
    const order = readFileSync(join(out, 'upload-order.txt'), 'utf8').trim().split('\n');
    assert.equal(order[order.length - 1], 'catalog.json');
    const firstManifest = order.findIndex((n) => n.endsWith('__manifest.json'));
    assert.ok(firstManifest > 0 && order.slice(0, firstManifest).every((n) => !n.endsWith('manifest.json')));
    assert.ok(order.slice(firstManifest, -1).every((n) => n.endsWith('__manifest.json')));
    for (const e of r.plan) {
      const a = readFileSync(join(r.assetsDir, e.name));
      assert.deepEqual(a, readFileSync(join(dir, e.path)), e.name);
      assert.equal(sha(a), e.sha256);
    }
    // Walk the app's view: catalogue -> manifest -> every asset, via the app's own URL builder.
    const byUrl = (rel) => readFileSync(join(r.assetsDir, packObjectUrl(GH, rel).slice(GH.length + 1)));
    const pc = parseCatalog(JSON.parse(byUrl('catalog.json').toString('utf8')));
    assert.equal(pc.ok, true);
    assert.equal(pc.value.packs.length, 3);
    for (const p of pc.value.packs) {
      const m = parseRemoteArtManifest(JSON.parse(byUrl(p.manifest).toString('utf8')), p.id);
      assert.equal(m.ok, true);
      const folder = p.manifest.replace(/\/manifest\.json$/, '');
      for (const a of m.value.assets) assert.equal(sha(byUrl(`${folder}/${a.path}`)), a.sha256);
      assert.ok(byUrl(p.thumb).length > 0);
    }
    const batch = (f) => readFileSync(join(out, f), 'utf8').split('\n').filter(Boolean);
    assert.deepEqual([...batch('upload-1-files.txt'), ...batch('upload-2-manifests.txt'), ...batch('upload-3-catalog.txt')], order);
    assert.deepEqual(batch('upload-3-catalog.txt'), ['catalog.json']);
    const plan = JSON.parse(readFileSync(join(out, 'plan.json'), 'utf8'));
    assert.deepEqual(plan.stale, []);
    assert.equal(plan.totalAssets, r.plan.length);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(out, { recursive: true, force: true });
  }
});

test('release assets: --existing skips files already on the release, always re-sends catalog.json, guards manifests', async () => {
  const dir = await built();
  try {
    const first = planRelease(dir);
    const gh = { assets: first.plan.map((e) => ({ name: e.name, size: e.size })).concat([{ name: 'art__old-pack__v1__thumb.00000000.png', size: 5 }]) };
    const again = planRelease(dir, parseExisting(gh));
    assert.deepEqual(again.plan.filter((e) => e.upload).map((e) => e.name), ['catalog.json']);
    assert.deepEqual(again.stale, ['art__old-pack__v1__thumb.00000000.png']);
    // A manifest already published with different bytes is an error (version must be bumped).
    const m = first.plan.find((e) => e.kind === 'manifest');
    const clash = parseExisting(gh.assets.map((a) => (a.name === m.name ? { ...a, size: a.size + 1 } : a)));
    assert.throws(() => planRelease(dir, clash), /bump the pack version/);
    // Names only (no sizes): treated as present.
    assert.deepEqual(planRelease(dir, parseExisting(first.plan.map((e) => e.name))).plan.filter((e) => e.upload).length, 1);
    assert.throws(() => parseExisting({ nope: 1 }), /expected/);
    // GitHub's 1000-asset limit.
    const many = new Map(Array.from({ length: MAX_RELEASE_ASSETS }, (_, i) => [`old-${i}.png`, 1]));
    assert.throws(() => planRelease(dir, many), /GitHub allows 1000/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('release assets: refuses names GitHub would rewrite and a missing catalogue', async () => {
  const dir = await built();
  const empty = tmp('rel-empty');
  try {
    const folder = readdirSync(join(dir, 'art'))[0];
    const v = readdirSync(join(dir, 'art', folder))[0];
    writeFileSync(join(dir, 'art', folder, v, 'bad name.png'), 'x');
    assert.throws(() => planRelease(dir), /not a valid release asset name/);
    rmSync(join(dir, 'art', folder, v, 'bad name.png'));
    mkdirSync(join(dir, 'art', folder, v, 'sub'));
    writeFileSync(join(dir, 'art', folder, v, 'sub', 'x.png'), 'x');
    writeFileSync(join(dir, 'art', folder, v, 'sub__x.png'), 'x');
    assert.throws(() => planRelease(dir), /both flatten to/);
    assert.throws(() => planRelease(empty), /catalog\.json not found/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(empty, { recursive: true, force: true });
  }
});
