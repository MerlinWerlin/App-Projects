// Offline, append-only builds from the SHA-pinned catalogue actually consumed by Glaze.
// Old assets/options and all unrelated manifest fields are retained byte-for-byte/in order.
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { parseCatalog, parseRemoteArtManifest, packFolder, manifestPath } from '../../src/core/packCatalog.ts';
import { flatAssetName, isPackReleaseTag } from '../../src/core/packHost.ts';
import { parseWidgetOptions, validateWidgetOptions } from '../../src/core/widgetOptions.ts';
import { plannedArtworkOptionIds } from '../../src/core/artworkCoverage.ts';

export const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const json = (path) => JSON.parse(readFileSync(path, 'utf8'));
const save = (path, value) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, JSON.stringify(value, null, 2) + '\n'); };
const artwork = (m) => plannedArtworkOptionIds(m.id, parseWidgetOptions(m.widgets, m.assets).options);

export function applyArtworkCorrections(manifest, corrections) {
  const result = structuredClone(manifest), changes = corrections[manifest.id]?.options ?? {};
  for (const [id, kind] of Object.entries(changes)) {
    const option = result.widgets.find((w) => w.id === id);
    if (!option || option.kind !== 'art' || !['habits', 'clock', 'photo'].includes(kind)) throw new Error(`${manifest.id}/${id}: expected existing baked-in functional art`);
    option.kind = kind;
  }
  return result;
}

export function checkedPath(root, path) {
  const full = resolve(root, path);
  const rel = relative(resolve(root), full);
  if (!rel || isAbsolute(rel) || rel === '..' || rel.startsWith('..' + sep) || resolve(full) === resolve(root)) throw new Error(`unsafe path: ${path}`);
  return full;
}

/** Decode the dimensions of all three WebP bitstream forms, without re-encoding the art. */
export function webpSize(b) {
  if (b.length < 20 || b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP' || b.readUInt32LE(4) + 8 !== b.length) throw new Error('invalid WebP container');
  for (let p = 12; p + 8 <= b.length;) {
    const kind = b.toString('ascii', p, p + 4), n = b.readUInt32LE(p + 4), q = p + 8;
    if (q + n > b.length) throw new Error('truncated WebP chunk');
    if (kind === 'VP8X' && n >= 10) {
      if (b[q] & 2) throw new Error('animated WebP is not plain artwork');
      return { width: b.readUIntLE(q + 4, 3) + 1, height: b.readUIntLE(q + 7, 3) + 1 };
    }
    if (kind === 'VP8L' && n >= 5 && b[q] === 0x2f) {
      const bits = b.readUInt32LE(q + 1);
      return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
    }
    if (kind === 'VP8 ' && n >= 10 && b[q + 3] === 0x9d && b[q + 4] === 1 && b[q + 5] === 0x2a) return { width: b.readUInt16LE(q + 6) & 0x3fff, height: b.readUInt16LE(q + 8) & 0x3fff };
    p = q + n + (n & 1);
  }
  throw new Error('WebP has no supported image payload');
}

export function loadBaseline(root) {
  const lock = json(join(root, 'baseline-lock.json'));
  const bytes = readFileSync(join(root, 'catalog.json'));
  if (digest(bytes) !== lock.catalogSha256) throw new Error('baseline catalogue hash mismatch');
  const raw = JSON.parse(bytes), parsed = parseCatalog(raw);
  if (!parsed.ok || parsed.value.packs.length !== raw.packs.length || raw.packs.length !== lock.packs.length) throw new Error('baseline catalogue is incomplete or invalid');
  const records = new Map(lock.packs.map((p) => [p.id, p]));
  if (records.size !== raw.packs.length) throw new Error('duplicate baseline pack');
  const manifests = new Map();
  for (const p of raw.packs) {
    const record = records.get(p.id);
    if (!record || record.manifest !== p.manifest || record.packVersion !== p.packVersion || record.release !== p.release) throw new Error(`${p.id}: baseline mapping mismatch`);
    const bytes = readFileSync(checkedPath(root, p.manifest));
    if (digest(bytes) !== record.sha256) throw new Error(`${p.id}: baseline manifest hash mismatch`);
    const m = JSON.parse(bytes), check = parseRemoteArtManifest(m, p.id);
    if (!check.ok || m.packVersion !== p.packVersion) throw new Error(`${p.id}: invalid baseline manifest`);
    const ids = artwork(m);
    if (JSON.stringify(ids) !== JSON.stringify(record.artwork)) throw new Error(`${p.id}: baseline artwork selection changed`);
    if (ids.length > 5) throw new Error(`${p.id}: baseline has more than five artwork pieces`);
    manifests.set(p.id, m);
  }
  return { lock, catalog: raw, records, manifests };
}

export function readArtworkAdditions(root, id, base) {
  const dir = checkedPath(root, `${id}/widgets`);
  const options = json(join(dir, 'widget-options.json'));
  if (!Array.isArray(options) || !options.length) throw new Error(`${id}: additions must be a nonempty widget-options.json array`);
  const ids = new Set(base.widgets.map((w) => w.id));
  const hashes = new Set(base.assets.map((a) => a.sha256));
  const files = [], assets = [];
  for (const o of options) {
    if (!o || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(o.id) || ids.has(o.id)) throw new Error(`${id}: duplicate or invalid artwork id`);
    if (o.kind !== 'art' || o.fit !== 'fit' || o.background !== 'wallpaper' || JSON.stringify(o.sizes) !== '["small","large"]' || typeof o.label !== 'string' || !o.label.trim() || o.label.length > 40) throw new Error(`${id}/${o.id}: plain artwork option contract violated`);
    const keys = ['id', 'kind', 'image', 'sizes', 'fit', 'background', 'label'];
    if (Object.keys(o).some((k) => !keys.includes(k))) throw new Error(`${id}/${o.id}: unexpected live/option metadata`);
    if (typeof o.image !== 'string' || !new RegExp(`^widget-${o.id}\\.[a-f0-9]{8}\\.webp$`).test(o.image)) throw new Error(`${id}/${o.id}: expected content-hashed WebP name`);
    const src = checkedPath(dir, o.image), bytes = readFileSync(src), sha256 = digest(bytes);
    if (!o.image.endsWith(`.${sha256.slice(0, 8)}.webp`)) throw new Error(`${id}/${o.id}: filename hash mismatch`);
    if (hashes.has(sha256)) throw new Error(`${id}/${o.id}: duplicate artwork bytes`);
    const size = webpSize(bytes);
    if (size.width !== 1024 || size.height !== 1024) throw new Error(`${id}/${o.id}: artwork must be 1024 x 1024`);
    ids.add(o.id); hashes.add(sha256);
    assets.push({ path: o.image, role: 'widget-art', ...size, bytes: bytes.length, sha256, mime: 'image/webp' });
    files.push({ src, name: o.image });
  }
  const combined = { ...base, version: 2, assets: [...base.assets, ...assets], widgets: [...base.widgets, ...options] };
  const errors = validateWidgetOptions(combined.widgets, combined.assets);
  if (errors.length) throw new Error(`${id}: ${errors.join('; ')}`);
  const before = artwork(base), after = artwork(combined);
  if (after.length !== 5 || JSON.stringify(after.slice(0, before.length)) !== JSON.stringify(before) || after.length - before.length !== options.length) throw new Error(`${id}: expected exactly five distinct pure artwork pieces, got ${after.length}`);
  return { options, assets, files, artwork: after };
}

/** Writes only under outDir. Network access and tracked release/coverage edits are deliberately absent. */
export async function buildArtworkAdditions(opts) {
  const baseDir = resolve(opts.basePacksDir), addDir = resolve(opts.addArtDir), outDir = resolve(opts.outDir);
  if ([baseDir, addDir].some((source) => outDir === source || source.startsWith(outDir + sep) || outDir.startsWith(source + sep))) throw new Error('build output must be separate from source/cache');
  const baseline = loadBaseline(baseDir);
  const corrections = opts.corrections ?? json(new URL('./artwork-corrections.json', import.meta.url));
  const candidates = readdirSync(addDir, { withFileTypes: true }).filter((d) => d.isDirectory() && existsSync(join(addDir, d.name, 'widgets', 'widget-options.json'))).map((d) => d.name).sort();
  const ids = opts.only?.size ? [...opts.only].sort() : candidates;
  const plans = new Map();
  for (const id of ids) {
    const base = baseline.manifests.get(id);
    if (!base || !candidates.includes(id)) throw new Error(`${id}: missing baseline or artwork sources`);
    plans.set(id, readArtworkAdditions(addDir, id, applyArtworkCorrections(base, corrections)));
  }
  const pending = [...baseline.manifests].filter(([id, m]) => (plans.get(id)?.artwork ?? artwork(applyArtworkCorrections(m, corrections))).length !== 5).map(([id]) => id);
  if (opts.complete && pending.length) throw new Error(`${pending[0]}: final build still needs artwork`);
  // Preflight every old byte BEFORE touching any output. Missing files require the cache command.
  for (const [id, m] of baseline.manifests) {
    for (const asset of m.assets) {
      const src = checkedPath(baseDir, `${packFolder(id, m.packVersion)}/${asset.path}`);
      const bytes = readFileSync(src);
      if (bytes.length !== asset.bytes || digest(bytes) !== asset.sha256) throw new Error(`${id}/${asset.path}: baseline asset integrity mismatch`);
    }
  }
  const firstRelease = opts.release ?? 'glaze-packs-v18';
  if (!isPackReleaseTag(firstRelease)) throw new Error('invalid target release');
  let releaseNumber = Number(firstRelease.match(/\d+$/)[0]), count = 0;
  const capacity = opts.releaseCapacity ?? 1000;
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 1000) throw new Error('release capacity must be 1..1000');
  const versions = {}, releases = {}, built = [], writes = [], coverage = {};
  const entries = baseline.catalog.packs.map((p) => {
    const base = baseline.manifests.get(p.id), plan = plans.get(p.id);
    const m = plan ? applyArtworkCorrections(base, corrections) : structuredClone(base);
    let release = p.release;
    if (plan) {
      const assetCount = base.assets.length + plan.assets.length + 1;
      if (assetCount > capacity) throw new Error(`${p.id}: pack exceeds release asset capacity`);
      if (count + assetCount > capacity) { releaseNumber++; count = 0; }
      release = `glaze-packs-v${releaseNumber}`; count += assetCount;
      m.version = 2; m.packVersion = base.packVersion + 1;
      m.widgets.push(...plan.options); m.assets.push(...plan.assets);
      m.totalBytes = m.assets.reduce((n, a) => n + a.bytes, 0);
      if ('release' in m) m.release = release;
    }
    const check = parseRemoteArtManifest(m, p.id);
    if (!check.ok) throw new Error(`${p.id}: output manifest does not parse: ${check.error}`);
    const ids = artwork(m);
    if (opts.complete && ids.length !== 5) throw new Error(`${p.id}: final build still needs ${5 - ids.length} artwork pieces`);
    coverage[p.id] = { manifest: `${release}/${flatAssetName(manifestPath(p.id, m.packVersion))}`, artwork: ids };
    versions[p.id] = { packVersion: m.packVersion, contentHash: digest(JSON.stringify(Object.fromEntries(Object.entries(m).filter(([k]) => k !== 'packVersion')))) };
    releases[p.id] = release;
    const folder = packFolder(p.id, m.packVersion), target = checkedPath(outDir, folder);
    // A theme may have been untouched in an earlier partial build. Keep just this build's
    // version, otherwise the flat release planner would also upload that obsolete folder.
    // Only generated v<number> folders strictly inside the checked output root are removed.
    const packRoot = checkedPath(outDir, `art/${p.id}`);
    if (existsSync(packRoot)) for (const version of readdirSync(packRoot)) if (/^v\d+$/.test(version)) rmSync(checkedPath(packRoot, version), { recursive: true, force: true });
    mkdirSync(target, { recursive: true });
    for (const a of base.assets) copyFileSync(checkedPath(baseDir, `${packFolder(p.id, base.packVersion)}/${a.path}`), checkedPath(target, a.path));
    for (const f of plan?.files ?? []) copyFileSync(f.src, checkedPath(target, f.name));
    if (plan) save(join(target, 'manifest.json'), m);
    else copyFileSync(checkedPath(baseDir, p.manifest), join(target, 'manifest.json'));
    writes.push(manifestPath(p.id, m.packVersion));
    if (plan) built.push({ id: p.id, packVersion: m.packVersion, release, folder, added: plan.options.map((o) => o.id), totalBytes: m.totalBytes });
    return plan ? { ...p, packVersion: m.packVersion, bytes: m.totalBytes, manifest: manifestPath(p.id, m.packVersion), thumb: `${folder}/${base.assets.find((a) => a.role === 'thumb').path}`, release } : p;
  });
  const same = !plans.size;
  const catalog = { ...baseline.catalog, packs: entries, generatedAt: same ? baseline.catalog.generatedAt : (opts.now ?? new Date('2026-11-14T00:00:00Z')).toISOString() };
  const byArtworkCount = {};
  for (const t of Object.values(coverage)) byArtworkCount[t.artwork.length] = (byArtworkCount[t.artwork.length] ?? 0) + 1;
  save(join(outDir, 'versions.json'), versions);
  save(join(outDir, 'releases.json'), releases);
  save(join(outDir, 'artwork-coverage.json'), { generated: 'scripts/packs/build_packs.mjs --base-packs --add-art', themes: entries.length, byArtworkCount, problems: [], perTheme: coverage });
  save(join(outDir, 'artwork-build.json'), { baselineCatalogSha256: baseline.lock.catalogSha256, baselineCatalogUrl: baseline.lock.catalogUrl, catalogTag: 'glaze-packs-v5', correctedFunctionalOptions: corrections, complete: pending.length === 0, pending, built });
  save(join(outDir, 'catalog.json'), catalog); // catalogue written last, never uploaded here
  opts.log?.(`Artwork build: ${built.length} themes, ${built.reduce((n, x) => n + x.added.length, 0)} additions; ${JSON.stringify(byArtworkCount)}`);
  return { catalog, built, failed: [], writes, encoder: 'existing WebP bytes (unchanged)' };
}
