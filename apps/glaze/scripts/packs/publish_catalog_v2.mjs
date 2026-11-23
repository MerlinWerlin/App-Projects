#!/usr/bin/env node
// Glaze 1.0.44: publish the new themes and catalog-v2.json, the catalogue 1.0.44+ reads
// (src/core/packCatalog.ts APP_CATALOG_FILE). Builds 1.0.37 to 1.0.43 keep reading catalog.json,
// which this script can NEVER write: it is not in any plan, and the live copy's SHA-256 is checked
// against scripts/packs/catalog-v2-lock.json before and after.
//
//   node scripts/packs/publish_catalog_v2.mjs --new dist/extraordinary-packs --base <public URL> [--out dist/catalog-v2] [--upload] [--verify]
//
// 1. Fetch the live catalog.json, check its SHA-256 against the lock.
// 2. catalog-v2.json = every live entry exactly as served (same JSON values, same order) + every new
//    theme of --new (each manifest needs minAppVersion >= 1.0.44). Refuses duplicate ids, a file the
//    app parser rejects, or one over the app's size limit. Written to --out for review.
// 3. Plan: the new themes' content-hashed files, then their manifests, then catalog-v2.json LAST.
//    Without --upload this is a dry run (prints the plan, no writes).
// 4. --upload (needs R2_* env): files that are missing are PUT with If-None-Match (a different object
//    under the same hashed name is an error), manifests likewise (immutable), then catalog-v2.json.
// 5. --verify (no secrets): over the public URL, every new manifest and every one of its images by
//    SHA-256, catalog-v2.json by SHA-256, every catalogued theme's manifest parses for 1.0.44 with
//    its thumbnail present, and the live catalog.json is still the locked one.

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { APP_CATALOG_FILE, CATALOG_MAX_BYTES, LEGACY_CATALOG_FILE, parseCatalog, parseRemoteArtManifest } from '../../src/core/packCatalog.ts';
import { compareVersions } from '../../src/core/themePack.ts';
import { cacheControlOf, configFromEnv, contentTypeOf, pool, s3 } from './publish_r2.mjs';

export const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const LOCK_FILE = join(APP_ROOT, 'scripts', 'packs', 'catalog-v2-lock.json');
export const APP_VERSION = '1.0.44';

const sha256 = (b) => createHash('sha256').update(b).digest('hex');
const md5 = (b) => createHash('md5').update(b).digest('hex');
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));

export function readLock(file = LOCK_FILE) {
  const lock = JSON.parse(readFileSync(file, 'utf8'));
  assert.equal(lock.legacyCatalog, LEGACY_CATALOG_FILE);
  assert.equal(lock.appCatalog, APP_CATALOG_FILE);
  assert.match(lock.legacyCatalogSha256, /^[0-9a-f]{64}$/);
  return lock;
}

/** Refuses any plan or key that would touch the legacy catalogue. */
export function assertNeverLegacy(keys) {
  for (const key of keys) {
    assert.notEqual(key, LEGACY_CATALOG_FILE, 'refusing to write catalog.json: builds 1.0.37 to 1.0.43 read it');
    assert.ok(key === APP_CATALOG_FILE || /^art\/[a-z0-9-]+\/v\d+\/[A-Za-z0-9._-]+$/.test(key), `unexpected object key ${key}`);
  }
}

/**
 * catalog-v2.json text from the live legacy catalogue text and the new-theme catalogue + manifests.
 * `newManifests` maps id -> parsed manifest JSON (for the minAppVersion floor).
 */
export function mergeCatalogV2({ legacyText, lock, fresh, newManifests }) {
  const legacyBytes = Buffer.from(legacyText, 'utf8');
  assert.equal(sha256(legacyBytes), lock.legacyCatalogSha256, 'live catalog.json is not the locked one: reconcile before publishing');
  const legacy = JSON.parse(legacyText);
  assert.ok(parseCatalog(legacy).ok, 'legacy catalogue fails the app parser');
  assert.equal(legacy.packs.length, lock.legacyPackCount, 'legacy catalogue pack count changed');
  assert.ok(parseCatalog(fresh).ok, 'new-theme catalogue fails the app parser');
  assert.ok(fresh.packs.length > 0, 'no new themes');
  const ids = new Set(legacy.packs.map((p) => p.id));
  for (const p of fresh.packs) {
    assert.ok(!ids.has(p.id), `${p.id} is already in catalog.json: new themes only`);
    ids.add(p.id);
    const m = newManifests[p.id];
    assert.ok(m, `${p.id}: manifest missing`);
    assert.equal(m.id, p.id);
    assert.equal(m.packVersion, p.packVersion, `${p.id}: catalogue and manifest versions differ`);
    assert.ok(compareVersions(m.minAppVersion, lock.newThemeMinAppVersion) >= 0, `${p.id}: minAppVersion ${m.minAppVersion} is below ${lock.newThemeMinAppVersion}`);
  }
  const out = { format: legacy.format, version: legacy.version, generatedAt: fresh.generatedAt, packs: [...legacy.packs, ...fresh.packs] };
  const text = JSON.stringify(out, null, 2) + '\n';
  const parsed = parseCatalog(JSON.parse(text));
  assert.ok(parsed.ok, `catalog-v2.json fails the app parser: ${parsed.ok ? '' : parsed.error}`);
  assert.equal(parsed.value.packs.length, legacy.packs.length + fresh.packs.length, 'the app parser dropped an entry');
  assert.ok(Buffer.byteLength(text) < CATALOG_MAX_BYTES, 'catalog-v2.json is over the app size limit');
  const back = JSON.parse(text).packs;
  legacy.packs.forEach((p, i) => assert.deepEqual(back[i], p, `${p.id}: legacy entry changed`));
  return { text, catalog: out, legacyCount: legacy.packs.length, newCount: fresh.packs.length };
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    if (name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

/** The new-theme catalogue and manifests from a built folder (scripts/packs/extraordinary_themes.mjs). */
export function readNewThemes(dir) {
  const root = resolve(dir);
  const fresh = JSON.parse(readFileSync(join(root, LEGACY_CATALOG_FILE), 'utf8'));
  const newManifests = {};
  for (const p of fresh.packs) newManifests[p.id] = JSON.parse(readFileSync(join(root, p.manifest), 'utf8'));
  return { root, fresh, newManifests };
}

/** Upload plan: every new theme file, then every new manifest, then catalog-v2.json last. */
export function planCatalogV2({ root, fresh }, catalogText) {
  const entry = (key, buf, kind, file = null) => ({ key, file, body: file ? null : buf, size: buf.length, md5: md5(buf), sha256: sha256(buf), contentType: contentTypeOf(key), cacheControl: cacheControlOf(key), kind });
  const files = [];
  const manifests = [];
  const wanted = new Set(fresh.packs.map((p) => p.id));
  for (const p of walk(join(root, 'art'))) {
    const key = relative(root, p).split(sep).join('/');
    const id = key.split('/')[1];
    if (!wanted.has(id)) continue;
    const buf = readFileSync(p);
    if (key.endsWith('/manifest.json')) manifests.push(entry(key, buf, 'manifest', p));
    else files.push(entry(key, buf, 'file', p));
  }
  for (const p of fresh.packs) assert.ok(manifests.some((m) => m.key === p.manifest), `${p.id}: no manifest in the plan`);
  const plan = [...files, ...manifests, entry(APP_CATALOG_FILE, Buffer.from(catalogText, 'utf8'), 'catalog')];
  assertNeverLegacy(plan.map((p) => p.key));
  assert.equal(plan.at(-1).key, APP_CATALOG_FILE, 'catalog-v2.json must be last');
  return plan;
}

async function get(fetcher, url, { attempts = 8, backoffMs = 1200, method = 'GET' } = {}) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await fetcher(url, { method, signal: AbortSignal.timeout(90_000) });
      if (r.status !== 429 && r.status < 500) {
        if (method === 'HEAD') return { status: r.status, headers: r.headers, body: Buffer.alloc(0) };
        return { status: r.status, headers: r.headers, body: Buffer.from(await r.arrayBuffer()) };
      }
      last = new Error(`${url}: HTTP ${r.status}`);
      await r.arrayBuffer().catch(() => undefined);
    } catch (e) {
      last = e;
    }
    if (i < attempts - 1) await sleep(backoffMs * (i + 1));
  }
  throw last;
}

export async function fetchLegacy(base, fetcher = fetch) {
  const r = await get(fetcher, `${base}/${LEGACY_CATALOG_FILE}?catalogV2=${Date.now()}`);
  assert.equal(r.status, 200, `live catalog.json: HTTP ${r.status}`);
  return r.body;
}

/** --upload: files, manifests, then catalog-v2.json. Never catalog.json. */
export async function uploadPlan(plan, { env = process.env, log = console.log, concurrency = 8 } = {}) {
  assertNeverLegacy(plan.map((p) => p.key));
  const cfg = configFromEnv(env);
  const counts = { uploaded: 0, present: 0 };
  const one = async (p) => {
    const head = await s3(cfg, 'HEAD', p.key);
    const etag = String(head.headers.etag ?? '').replace(/"/g, '').toLowerCase();
    if (head.status === 200 && etag === p.md5 && Number(head.headers['content-length']) === p.size) {
      counts.present++;
      return;
    }
    if (head.status === 200 && p.kind !== 'catalog') throw new Error(`${p.key} is already on R2 with different bytes; hashed files and versioned manifests are immutable`);
    if (head.status !== 200 && head.status !== 404) throw new Error(`HEAD ${p.key}: HTTP ${head.status}`);
    const body = p.body ?? readFileSync(p.file);
    const headers = { 'content-type': p.contentType, 'cache-control': p.cacheControl, 'content-md5': Buffer.from(p.md5, 'hex').toString('base64') };
    if (p.kind !== 'catalog') headers['if-none-match'] = '*';
    const put = await s3(cfg, 'PUT', p.key, { body, headers });
    if (put.status !== 200) throw new Error(`PUT ${p.key}: HTTP ${put.status}`);
    counts.uploaded++;
    log(`  put  ${p.key} (${p.size} B)`);
  };
  for (const kind of ['file', 'manifest', 'catalog']) {
    const part = plan.filter((p) => p.kind === kind);
    await pool(part, kind === 'catalog' ? 1 : concurrency, one);
    log(`${kind}: ${part.length} object(s) done`);
  }
  return counts;
}

/** --verify: everything over the public URL the app uses. */
export async function verifyPublic({ base, plan, catalog, lock, fetcher = fetch, concurrency = 3, log = console.log }) {
  const report = { newObjects: 0, newImages: 0, manifestsResolved: 0, thumbs: 0 };
  // New theme objects (files + manifests) and catalog-v2.json by SHA-256.
  await pool(plan, concurrency, async (p) => {
    const url = p.kind === 'catalog' ? `${base}/${p.key}?verify=${Date.now()}` : `${base}/${p.key}`;
    const r = await get(fetcher, url);
    assert.equal(r.status, 200, `${p.key}: HTTP ${r.status}`);
    assert.equal(sha256(r.body), p.sha256, `${p.key}: public bytes differ`);
    report.newObjects++;
  });
  // Every catalogued theme's manifest resolves and parses for 1.0.44; new manifests' images match.
  await pool(catalog.packs, concurrency, async (entry) => {
    const r = await get(fetcher, `${base}/${entry.manifest}`);
    assert.equal(r.status, 200, `${entry.id}: manifest HTTP ${r.status}`);
    const m = JSON.parse(r.body.toString('utf8'));
    const parsed = parseRemoteArtManifest(m, entry.id);
    assert.ok(parsed.ok, `${entry.id}: manifest fails the app parser`);
    assert.equal(parsed.value.packVersion, entry.packVersion, `${entry.id}: version differs from the catalogue`);
    assert.ok(compareVersions(APP_VERSION, parsed.value.minAppVersion) >= 0, `${entry.id}: needs ${parsed.value.minAppVersion}, above ${APP_VERSION}`);
    const thumb = await get(fetcher, `${base}/${entry.thumb}`, { method: 'HEAD' });
    assert.equal(thumb.status, 200, `${entry.id}: thumbnail HTTP ${thumb.status}`);
    report.thumbs++;
    report.manifestsResolved++;
    if (compareVersions(parsed.value.minAppVersion, lock.newThemeMinAppVersion) >= 0) {
      const folder = entry.manifest.slice(0, entry.manifest.lastIndexOf('/'));
      for (const a of parsed.value.assets) {
        const img = await get(fetcher, `${base}/${folder}/${a.path}`);
        assert.equal(img.status, 200, `${entry.id}/${a.path}: HTTP ${img.status}`);
        assert.equal(sha256(img.body), a.sha256, `${entry.id}/${a.path}: SHA-256 differs from the manifest`);
        report.newImages++;
      }
    }
  });
  const legacy = await fetchLegacy(base, fetcher);
  assert.equal(sha256(legacy), lock.legacyCatalogSha256, 'live catalog.json changed');
  report.legacySha256 = sha256(legacy);
  log(JSON.stringify(report));
  return report;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const args = process.argv.slice(2);
  const value = (name, dflt) => (args.includes(name) ? args[args.indexOf(name) + 1] : dflt);
  try {
    const base = String(value('--base', '')).replace(/\/+$/, '');
    assert.match(base, /^https?:\/\//, '--base <public pack URL> is required');
    const out = resolve(value('--out', join(APP_ROOT, 'dist', 'catalog-v2')));
    const lock = readLock();
    const themes = readNewThemes(value('--new', join(APP_ROOT, 'dist', 'extraordinary-packs')));
    const before = await fetchLegacy(base);
    const merged = mergeCatalogV2({ legacyText: before.toString('utf8'), lock, fresh: themes.fresh, newManifests: themes.newManifests });
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, APP_CATALOG_FILE), merged.text);
    const plan = planCatalogV2(themes, merged.text);
    const kinds = plan.reduce((k, p) => ({ ...k, [p.kind]: (k[p.kind] ?? 0) + 1 }), {});
    const summary = { legacyThemes: merged.legacyCount, newThemes: merged.newCount, catalogued: merged.catalog.packs.length, objects: plan.length, ...kinds, mb: +(plan.reduce((n, p) => n + p.size, 0) / 1e6).toFixed(1), catalogV2Sha256: sha256(Buffer.from(merged.text)), legacySha256: sha256(before), last: plan.at(-1).key };
    writeFileSync(join(out, 'plan.json'), JSON.stringify({ summary, keys: plan.map((p) => `${p.kind} ${p.key} ${p.sha256}`) }, null, 2) + '\n');
    console.log(`${args.includes('--upload') ? 'publish' : 'dry run'}: ${JSON.stringify(summary)}`);
    if (args.includes('--upload')) {
      const counts = await uploadPlan(plan);
      console.log(`uploaded ${counts.uploaded}, already present ${counts.present}`);
      const after = await fetchLegacy(base);
      assert.equal(sha256(after), lock.legacyCatalogSha256, 'live catalog.json changed during the publish');
    }
    if (args.includes('--verify')) await verifyPublic({ base, plan, catalog: merged.catalog, lock });
    console.log(`live catalog.json unchanged: sha256 ${sha256(await fetchLegacy(base))}`);
  } catch (e) {
    console.error(`error: ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  }
}
