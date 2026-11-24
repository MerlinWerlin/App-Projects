// Glaze 1.0.44 catalog-v2.json publisher (scripts/packs/publish_catalog_v2.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertNeverLegacy, mergeCatalogV2, planCatalogV2, readLock, readNewThemes, readOverrides, uploadPlan, verifyPublic } from './publish_catalog_v2.mjs';

const sha = (b) => createHash('sha256').update(b).digest('hex');
const PAL = { bg: '#04182E', tile: '#0C2A40', glyph: '#E6FBFF', accent: '#5EE1D9', text: '#E9FAFF' };
const entry = (id, v = 1, plus = false) => ({ id, name: id, packVersion: v, plus, bytes: 6, manifest: `art/${id}/v${v}/manifest.json`, thumb: `art/${id}/v${v}/thumb.0000abcd.webp`, thumbhash: 'AbCd', palette: PAL, tags: [], mood: '', addedAt: '2026-11-01', category: 'Nature' });
const manifest = (id, v, minAppVersion, files) => ({
  format: 'glaze-remote-art-pack', version: 1, id, packVersion: v, name: id, plus: false, minAppVersion, palette: PAL, meta: { name: id }, thumbhash: 'AbCd',
  assets: files.map(([path, role, buf]) => ({ path, role, width: 1, height: 1, bytes: buf.length, sha256: sha(buf), mime: 'image/webp' })),
  totalBytes: files.reduce((n, f) => n + f[2].length, 0),
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'glaze-cv2-'));
  const legacy = { format: 'glaze-catalog', version: 1, generatedAt: '2026-11-15T00:00:00.000Z', packs: [entry('old-one', 3), entry('old-two', 1)] };
  const legacyText = JSON.stringify(legacy, null, 1);
  const lock = { legacyCatalog: 'catalog.json', legacyCatalogSha256: sha(Buffer.from(legacyText)), legacyPackCount: 2, appCatalog: 'catalog-v2.json', newThemeMinAppVersion: '1.0.44' };
  const newDir = join(root, 'new');
  const fresh = { format: 'glaze-catalog', version: 1, generatedAt: '2026-11-23T00:00:00.000Z', packs: [entry('new-one', 1, true)] };
  const objects = new Map();
  const put = (key, buf) => { objects.set(key, buf); mkdirSync(join(newDir, key, '..'), { recursive: true }); writeFileSync(join(newDir, key), buf); };
  const wall = Buffer.from('wall'), thumb = Buffer.from('th');
  put('art/new-one/v1/wallpaper-2796.0000abcd.webp', wall);
  put('art/new-one/v1/thumb.0000abcd.webp', thumb);
  put('art/new-one/v1/manifest.json', Buffer.from(JSON.stringify(manifest('new-one', 1, '1.0.44', [['wallpaper-2796.0000abcd.webp', 'wallpaper', wall], ['thumb.0000abcd.webp', 'thumb', thumb]]))));
  writeFileSync(join(newDir, 'catalog.json'), JSON.stringify(fresh));
  // the live host: legacy catalogue + legacy manifests/thumbs
  objects.set('catalog.json', Buffer.from(legacyText));
  for (const p of legacy.packs) {
    const w = Buffer.from(`w-${p.id}`), t = Buffer.from(`t-${p.id}`);
    objects.set(p.manifest, Buffer.from(JSON.stringify(manifest(p.id, p.packVersion, '1.0.37', [['w.0000abcd.webp', 'wallpaper', w], ['thumb.0000abcd.webp', 'thumb', t]]))));
    objects.set(p.thumb, t);
  }
  return { root, legacyText, lock, newDir, objects };
}

const fakeFetch = (objects) => async (url, init = {}) => {
  const key = new URL(url).pathname.slice(1);
  const body = objects.get(key);
  return { status: body ? 200 : 404, headers: new Headers(), arrayBuffer: async () => (init.method === 'HEAD' ? new ArrayBuffer(0) : body ?? new ArrayBuffer(0)) };
};

test('the real lock pins the live catalog.json', () => {
  const lock = readLock();
  assert.equal(lock.legacyCatalogSha256, '97a7a132865f005d93b7cebad21aecec57a57d9e3bf8e50790486ec52b7ddc55');
  assert.equal(lock.legacyPackCount, 141);
});

test('catalog-v2.json keeps every legacy entry exactly, in order, and appends the new themes', () => {
  const f = fixture();
  try {
    const themes = readNewThemes(f.newDir);
    const m = mergeCatalogV2({ legacyText: f.legacyText, lock: f.lock, ...themes });
    const out = JSON.parse(m.text);
    assert.deepEqual(out.packs.slice(0, 2), JSON.parse(f.legacyText).packs);
    assert.deepEqual(out.packs.map((p) => p.id), ['old-one', 'old-two', 'new-one']);
    assert.equal(m.legacyCount, 2);
    assert.equal(m.newCount, 1);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('merge refuses a changed live catalogue, a duplicate id and a new theme below 1.0.44', () => {
  const f = fixture();
  try {
    const themes = readNewThemes(f.newDir);
    assert.throws(() => mergeCatalogV2({ legacyText: f.legacyText + ' ', lock: f.lock, ...themes }), /not the locked one/);
    const dup = structuredClone(themes); dup.fresh.packs[0] = { ...dup.fresh.packs[0], id: 'old-one' }; dup.newManifests['old-one'] = { ...dup.newManifests['new-one'], id: 'old-one' };
    assert.throws(() => mergeCatalogV2({ legacyText: f.legacyText, lock: f.lock, ...dup }), /already in catalog\.json/);
    const low = structuredClone(themes); low.newManifests['new-one'].minAppVersion = '1.0.43';
    assert.throws(() => mergeCatalogV2({ legacyText: f.legacyText, lock: f.lock, ...low }), /below 1\.0\.44/);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('the plan is files, then manifests, then catalog-v2.json last, and never catalog.json', async () => {
  const f = fixture();
  try {
    const themes = readNewThemes(f.newDir);
    const plan = planCatalogV2(themes, mergeCatalogV2({ legacyText: f.legacyText, lock: f.lock, ...themes }).text);
    assert.deepEqual(plan.map((p) => p.kind), ['file', 'file', 'manifest', 'catalog']);
    assert.equal(plan.at(-1).key, 'catalog-v2.json');
    assert.equal(plan.at(-1).cacheControl, 'public, max-age=300');
    assert.ok(plan.every((p) => p.key !== 'catalog.json'));
    assert.throws(() => assertNeverLegacy(['art/x/v1/a.webp', 'catalog.json']), /refusing to write catalog\.json/);
    assert.throws(() => assertNeverLegacy(['../secret']), /unexpected object key/);
    await assert.rejects(uploadPlan([...plan, { ...plan[0], key: 'catalog.json' }], { env: {} }), /refusing to write catalog\.json/);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('public verify: every catalogued manifest must resolve, new images match, legacy catalogue unchanged', async () => {
  const f = fixture();
  try {
    const themes = readNewThemes(f.newDir);
    const merged = mergeCatalogV2({ legacyText: f.legacyText, lock: f.lock, ...themes });
    const plan = planCatalogV2(themes, merged.text);
    f.objects.set('catalog-v2.json', Buffer.from(merged.text));
    const quiet = () => {};
    const r = await verifyPublic({ base: 'https://packs.test', plan, catalog: merged.catalog, lock: f.lock, fetcher: fakeFetch(f.objects), log: quiet });
    assert.equal(r.manifestsResolved, 3);
    assert.equal(r.newImages, 2);
    const missing = new Map(f.objects); missing.delete('art/old-two/v1/manifest.json');
    await assert.rejects(verifyPublic({ base: 'https://packs.test', plan, catalog: merged.catalog, lock: f.lock, fetcher: fakeFetch(missing), log: quiet }), /old-two: manifest HTTP 404/);
    const changed = new Map(f.objects); changed.set('catalog.json', Buffer.from('{}'));
    await assert.rejects(verifyPublic({ base: 'https://packs.test', plan, catalog: merged.catalog, lock: f.lock, fetcher: fakeFetch(changed), log: quiet }), /live catalog\.json changed/);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('art-fit overrides swap only version/bytes/manifest/thumb of a legacy entry and join the plan', () => {
  const f = fixture();
  try {
    const themes = readNewThemes(f.newDir);
    const artDir = join(f.root, 'art-fit');
    const w = Buffer.from('w2'), t = Buffer.from('t2');
    const m = manifest('old-one', 4, '1.0.37', [['w.0000abcd.webp', 'wallpaper', w], ['thumb.0000abcd.webp', 'thumb', t]]);
    const put = (key, buf) => { mkdirSync(join(artDir, key, '..'), { recursive: true }); writeFileSync(join(artDir, key), buf); };
    put('art/old-one/v4/w.0000abcd.webp', w);
    put('art/old-one/v4/thumb.0000abcd.webp', t);
    put('art/old-one/v4/manifest.json', Buffer.from(JSON.stringify(m)));
    const o = { id: 'old-one', packVersion: 4, bytes: m.totalBytes, manifest: 'art/old-one/v4/manifest.json', thumb: 'art/old-one/v4/thumb.0000abcd.webp' };
    writeFileSync(join(artDir, 'overrides.json'), JSON.stringify([o]));
    const art = readOverrides(artDir);
    const merged = mergeCatalogV2({ legacyText: f.legacyText, lock: f.lock, ...themes, ...art });
    const out = JSON.parse(merged.text).packs;
    const legacy = JSON.parse(f.legacyText).packs;
    assert.equal(merged.overridden, 1);
    assert.deepEqual(out[0], { ...legacy[0], packVersion: 4, bytes: o.bytes, manifest: o.manifest, thumb: o.thumb });
    assert.deepEqual(out[1], legacy[1]);
    const plan = planCatalogV2(themes, merged.text, art);
    assert.ok(plan.some((p) => p.key === 'art/old-one/v4/manifest.json' && p.kind === 'manifest'));
    assert.ok(plan.some((p) => p.key === 'art/old-one/v4/w.0000abcd.webp' && p.kind === 'file'));
    assert.equal(plan.at(-1).key, 'catalog-v2.json');
    assert.ok(!plan.some((p) => p.key === 'catalog.json'));
    // a skipped version, a wrong byte count or an unknown theme is refused
    const v5 = { ...o, packVersion: 5, manifest: 'art/old-one/v5/manifest.json', thumb: 'art/old-one/v5/t.webp' };
    assert.throws(() => mergeCatalogV2({ legacyText: f.legacyText, lock: f.lock, ...themes, overrides: [v5], overrideManifests: { 'old-one': { ...m, packVersion: 5 } } }), /must be v4/);
    assert.throws(() => mergeCatalogV2({ legacyText: f.legacyText, lock: f.lock, ...themes, overrides: [{ ...o, bytes: 1 }], overrideManifests: art.overrideManifests }), /bytes differ/);
    assert.throws(() => mergeCatalogV2({ legacyText: f.legacyText, lock: f.lock, ...themes, overrides: [{ ...o, id: 'nope' }], overrideManifests: {} }), /not in catalog\.json/);
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});
