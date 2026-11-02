// T274: more than one pack release (glaze-packs-v2+): build_packs.mjs assigns packs to releases
// (releases.json + --release), release_assets.mjs writes one upload set per tag. Offline.
// Run: node --test "scripts/packs/*.test.mjs"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildPacks, readReleases, releaseFor } from './build_packs.mjs';
import { DEFAULT_RELEASE, planRelease, planReleases, tagOrder, writeReleaseSets } from './release_assets.mjs';

process.removeAllListeners('warning');
const { parseCatalog, parseRemoteArtManifest } = await import('../../src/core/packCatalog.ts');
const { packObjectUrl, packReleaseBase } = await import('../../src/core/packHost.ts');

const sha = (b) => createHash('sha256').update(b).digest('hex');
const quiet = () => {};
const tmp = (p) => mkdtempSync(join(tmpdir(), `glaze-${p}-`));
const REPO = 'https://github.com/MerlinWerlin/App-Projects/releases/download';
const V1 = `${REPO}/glaze-packs-v1`;

test('releaseFor / readReleases / tagOrder', () => {
  assert.equal(releaseFor('a', { a: 'glaze-packs-v3' }, {}, 'glaze-packs-v2'), 'glaze-packs-v3');
  assert.equal(releaseFor('a', {}, { a: { packVersion: 1 } }, 'glaze-packs-v2'), 'glaze-packs-v1', 'built before T274: stays on v1');
  assert.equal(releaseFor('a', {}, {}, 'glaze-packs-v2'), 'glaze-packs-v2', 'new pack: --release');
  assert.equal(releaseFor('a', {}, {}), 'glaze-packs-v1');
  const dir = tmp('rel-json');
  try {
    assert.deepEqual(readReleases(join(dir, 'missing.json')), {});
    writeFileSync(join(dir, 'bad.json'), JSON.stringify({ a: 'glaze-packs-staging' }));
    assert.throws(() => readReleases(join(dir, 'bad.json')), /not a release tag/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  assert.deepEqual(tagOrder(['glaze-packs-v10', 'glaze-packs-v1', 'glaze-packs-v2', 'glaze-packs-v2']), ['glaze-packs-v2', 'glaze-packs-v10', 'glaze-packs-v1']);
  assert.deepEqual(tagOrder([]), ['glaze-packs-v1']);
});

test('build: existing packs keep their release, new packs get --release; catalogue says so only off v1', async () => {
  const out = tmp('rel-build');
  const lockDir = tmp('rel-lock');
  const versions = join(lockDir, 'versions.json');
  const releases = join(lockDir, 'releases.json');
  try {
    // deep-sea and starry-night were published before T274 (in versions.json, not in releases.json).
    await buildPacks({ outDir: out, versionsFile: versions, releasesFile: null, log: quiet, encoder: 'png', only: new Set(['deep-sea', 'starry-night']) });
    const r = await buildPacks({ outDir: out, versionsFile: versions, log: quiet, encoder: 'png', release: 'glaze-packs-v2' });
    assert.deepEqual(JSON.parse(readFileSync(releases, 'utf8')), { 'deep-sea': 'glaze-packs-v1', 'starry-night': 'glaze-packs-v1', 'sunset-dunes': 'glaze-packs-v2' });
    const raw = JSON.parse(readFileSync(join(out, 'catalog.json'), 'utf8'));
    const byId = Object.fromEntries(raw.packs.map((p) => [p.id, p]));
    assert.equal('release' in byId['deep-sea'], false);
    assert.equal('release' in byId['starry-night'], false);
    assert.equal(byId['sunset-dunes'].release, 'glaze-packs-v2');
    assert.deepEqual(r.catalog, raw);
    // A later build with a different default never moves a pack that already has a release.
    await buildPacks({ outDir: out, versionsFile: versions, log: quiet, encoder: 'png', release: 'glaze-packs-v3' });
    assert.equal(JSON.parse(readFileSync(releases, 'utf8'))['sunset-dunes'], 'glaze-packs-v2');
    // Moving a pack = editing releases.json; --only keeps the other entries' release untouched.
    writeFileSync(releases, JSON.stringify({ 'deep-sea': 'glaze-packs-v1', 'starry-night': 'glaze-packs-v3', 'sunset-dunes': 'glaze-packs-v2' }));
    await buildPacks({ outDir: out, versionsFile: versions, log: quiet, encoder: 'png', only: new Set(['starry-night']) });
    const pc = parseCatalog(JSON.parse(readFileSync(join(out, 'catalog.json'), 'utf8')));
    assert.equal(pc.ok, true);
    assert.deepEqual(Object.fromEntries(pc.value.packs.map((p) => [p.id, p.release ?? DEFAULT_RELEASE])), { 'deep-sea': 'glaze-packs-v1', 'starry-night': 'glaze-packs-v3', 'sunset-dunes': 'glaze-packs-v2' });
    await assert.rejects(buildPacks({ outDir: out, versionsFile: null, log: quiet, encoder: 'png', release: 'glaze-packs-staging' }), /not a release tag/);
  } finally {
    rmSync(out, { recursive: true, force: true });
    rmSync(lockDir, { recursive: true, force: true });
  }
});

test('release sets: one folder per tag, catalog.json only (and last) on v1, every app URL resolves on its tag', async () => {
  const dir = tmp('rel-sets');
  const out = tmp('rel-sets-out');
  const lockDir = tmp('rel-sets-lock');
  try {
    writeFileSync(join(lockDir, 'releases.json'), JSON.stringify({ 'sunset-dunes': 'glaze-packs-v2' }));
    await buildPacks({ outDir: dir, versionsFile: join(lockDir, 'versions.json'), log: quiet, encoder: 'png' });
    const logs = [];
    // v2 already holds 801 old assets: a per-tag warning.
    const existingByTag = new Map([['glaze-packs-v2', new Map(Array.from({ length: 801 }, (_, i) => [`old-${i}.png`, 1]))]]);
    const r = writeReleaseSets({ dir, outDir: out, existingByTag, log: (m) => logs.push(m) });
    assert.deepEqual(readFileSync(join(out, 'tags.txt'), 'utf8').trim().split('\n'), ['glaze-packs-v2', 'glaze-packs-v1']);
    assert.deepEqual(readdirSync(out).sort(), ['glaze-packs-v1', 'glaze-packs-v2', 'tags.txt']);
    assert.ok(logs.some((m) => /^glaze-packs-v2: warning: glaze-packs-v2 will hold 80\d of 1000/.test(m)), logs.join('\n'));
    assert.ok(!logs.some((m) => /^glaze-packs-v1: warning/.test(m)));
    const v1 = r.sets.find((s) => s.tag === 'glaze-packs-v1');
    const v2 = r.sets.find((s) => s.tag === 'glaze-packs-v2');
    const names = (s) => readdirSync(s.assetsDir).sort();
    assert.ok(names(v1).includes('catalog.json'));
    assert.ok(!names(v2).includes('catalog.json'));
    assert.ok(names(v2).length > 0 && names(v2).every((n) => n.startsWith('art__sunset-dunes__')));
    assert.ok(names(v1).every((n) => n === 'catalog.json' || !n.startsWith('art__sunset-dunes__')));
    const batch = (s, f) => readFileSync(join(s.outDir, f), 'utf8').split('\n').filter(Boolean);
    assert.deepEqual(batch(v2, 'upload-3-catalog.txt'), []);
    assert.deepEqual(batch(v1, 'upload-3-catalog.txt'), ['catalog.json']);
    assert.equal(JSON.parse(readFileSync(join(v2.outDir, 'plan.json'), 'utf8')).tag, 'glaze-packs-v2');
    // The app's view: catalog.json from v1, then every pack file from packReleaseBase(v1, release).
    const local = new Map(r.sets.map((s) => [`${REPO}/${s.tag}`, s.assetsDir]));
    const get = (url) => {
      const i = url.lastIndexOf('/');
      return readFileSync(join(local.get(url.slice(0, i)), decodeURIComponent(url.slice(i + 1))));
    };
    const pc = parseCatalog(JSON.parse(get(packObjectUrl(V1, 'catalog.json')).toString('utf8')));
    assert.equal(pc.ok, true);
    assert.equal(pc.value.packs.length, 3);
    for (const p of pc.value.packs) {
      const base = packReleaseBase(V1, p.release);
      const m = parseRemoteArtManifest(JSON.parse(get(packObjectUrl(base, p.manifest)).toString('utf8')), p.id);
      assert.equal(m.ok, true, p.id);
      const folder = p.manifest.replace(/\/manifest\.json$/, '');
      for (const a of m.value.assets) assert.equal(sha(get(packObjectUrl(base, `${folder}/${a.path}`))), a.sha256);
      assert.ok(get(packObjectUrl(base, p.thumb)).length > 0);
    }
    // --single keeps the old one-release layout (staging): everything, catalog.json last.
    const single = planRelease(dir);
    assert.equal(single.plan[single.plan.length - 1].name, 'catalog.json');
    assert.equal(single.plan.length, v1.plan.length + v2.plan.length);
    // A pack whose files are neither built nor on its release is refused, naming the tag.
    rmSync(join(dir, 'art', 'sunset-dunes'), { recursive: true, force: true });
    assert.throws(() => planReleases(dir), /neither built nor on the release glaze-packs-v2/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(out, { recursive: true, force: true });
    rmSync(lockDir, { recursive: true, force: true });
  }
});
