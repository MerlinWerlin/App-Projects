#!/usr/bin/env node
// T256 / D229-1: re-ship remote widget art with straight alpha so it blends with every wallpaper.
//
//   python3 scripts/packs/blend-audit.py --download --fix <fix> --no-sheets      # 1. cache + blended PNGs
//   node scripts/packs/rebuild_widget_alpha.mjs --cache <cache>/production --fix <fix> --out <out>
//        [--versions scripts/packs/versions.json] [--encoder pillow|png]          # 2. new pack versions
//        [--catalog <catalog.json to start from>] [--only id,id] [--download <release base URL>]                  #    (batches: see the workflow)
//   node scripts/packs/release_assets.mjs --dir <out> --out <release> --existing assets.json   # 3. flat names
//
// For every remote pack that has at least one blended piece in <fix>/<packId>/<stem>.png, this writes
// a NEW pack version (packVersion + 1, immutable folders: nothing on the release is overwritten):
//   <out>/art/<id>/v<n+1>/<every unchanged asset, same name and bytes, copied from the cache>
//   <out>/art/<id>/v<n+1>/widget-<stem>.<sha8>.webp   (the blended piece, WebP with alpha; PNG with --encoder png)
//   <out>/art/<id>/v<n+1>/manifest.json               (widgets[].image renamed, every option background 'wallpaper')
// and <out>/catalog.json = the cached catalogue with those packs' packVersion / manifest / thumb / bytes
// moved to the new version (written LAST). Packs without fixes are left exactly as they are.
// <out>/superseded.txt lists the old version folders (art/<id>/v<n>) the new catalogue no longer points at.
// --versions updates scripts/packs/versions.json in place for the rebuilt packs. Exit 1 on any error.
// Network: none, unless --download <release base URL> is given; then files missing from the cache are fetched with curl.

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

process.removeAllListeners('warning');
const cat = await import('../../src/core/packCatalog.ts');

const sha256 = (b) => createHash('sha256').update(b).digest('hex');

const PILLOW_WEBP = `
import sys, json
from PIL import Image
for j in json.load(sys.stdin):
    im = Image.open(j['src']).convert('RGBA')
    im.save(j['dst'], 'WEBP', quality=82, method=4, alpha_quality=100)
print('ok')
`;

/** Encode blended PNGs. Returns Map src -> { bytes, ext, mime }. */
export function encodePieces(srcs, encoder, tmp) {
  const out = new Map();
  if (encoder === 'png') {
    for (const s of srcs) out.set(s, { bytes: readFileSync(s), ext: 'png', mime: 'image/png' });
    return out;
  }
  const list = srcs.map((s, i) => ({ src: s, dst: join(tmp, `p${i}.webp`) }));
  const r = spawnSync('python3', ['-I', '-c', PILLOW_WEBP], { input: JSON.stringify(list), encoding: 'utf8', maxBuffer: 1 << 20 });
  if (r.status !== 0) throw new Error(`Pillow WebP encode failed: ${r.stderr || r.stdout}`);
  for (const j of list) out.set(j.src, { bytes: readFileSync(j.dst), ext: 'webp', mime: 'image/webp' });
  return out;
}

/** Download one pack file from a release (flat name, src/core/packHost.ts flatAssetName: '/' -> '__'). */
export function fetchFlat(baseUrl, rel, dest) {
  mkdirSync(dirname(dest), { recursive: true });
  const r = spawnSync('curl', ['-fsSL', '--retry', '3', '-o', dest, `${baseUrl}/${rel.split('/').join('__')}`], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`download failed: ${rel}: ${r.stderr.trim()}`);
}

/** PNG dimensions from the IHDR chunk. */
export function pngSize(buf) {
  if (buf.length < 24 || buf.readUInt32BE(12) !== 0x49484452) throw new Error('not a PNG');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/** Stem the audit uses for a manifest image name: "widget-x.ab12cd34.webp" -> "widget-x". */
export const imageStem = (name) => name.replace(/\.[^.]+$/, '').split('.')[0];

/**
 * Pure step: a manifest + its fixes -> the next version's manifest and the file plan.
 * fixes: Map stem -> { bytes, ext, mime, width, height }. Returns null when nothing in the manifest is fixed.
 */
export function nextManifest(manifest, fixes) {
  const widgets = Array.isArray(manifest.widgets) ? manifest.widgets : [];
  const renamed = new Map(); // old asset path -> new asset
  for (const w of widgets) {
    const f = fixes.get(imageStem(w.image));
    if (!f || renamed.has(w.image)) continue;
    const path = `${imageStem(w.image)}.${sha256(f.bytes).slice(0, 8)}.${f.ext}`;
    renamed.set(w.image, { path, bytes: f.bytes, width: f.width, height: f.height, mime: f.mime });
  }
  if (renamed.size === 0) return null;
  const packVersion = manifest.packVersion + 1;
  const assets = manifest.assets.map((a) => {
    const n = renamed.get(a.path);
    if (!n) return { ...a };
    return { path: n.path, role: a.role, width: n.width, height: n.height, bytes: n.bytes.length, sha256: sha256(n.bytes), mime: n.mime };
  });
  const totalBytes = assets.reduce((s, a) => s + a.bytes, 0);
  const next = {
    ...manifest,
    packVersion,
    assets,
    totalBytes,
    widgets: widgets.map((w) => ({ ...w, image: renamed.get(w.image)?.path ?? w.image, background: 'wallpaper' })),
  };
  const { packVersion: _drop, ...noVersion } = next;
  return { manifest: next, renamed, contentHash: sha256(JSON.stringify(noVersion)) };
}

export function rebuild({ cache, fix, out, encoder = 'pillow', versionsFile = '', catalogFile = '', only = null, baseUrl = '', log = console.log }) {
  const catalogRaw = JSON.parse(readFileSync(catalogFile || join(cache, cat.CATALOG_FILE), 'utf8'));
  const parsed = cat.parseCatalog(catalogRaw);
  if (!parsed.ok) throw new Error(`cached catalog.json does not parse: ${parsed.error}`);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const tmp = join(out, '.tmp');
  mkdirSync(tmp, { recursive: true });
  const versions = versionsFile && existsSync(versionsFile) ? JSON.parse(readFileSync(versionsFile, 'utf8')) : null;
  const changed = [];
  const errors = [];
  const nextCatalog = { ...catalogRaw, generatedAt: new Date().toISOString(), packs: catalogRaw.packs.map((p) => ({ ...p })) };
  for (const p of nextCatalog.packs) {
    const fixDir = join(fix, p.id);
    if (!existsSync(fixDir) || (only && !only.has(p.id))) continue;
    try {
      const oldFolder = cat.packFolder(p.id, p.packVersion);
      const manifest = JSON.parse(readFileSync(join(cache, p.manifest), 'utf8'));
      const pm = cat.parseRemoteArtManifest(manifest, p.id);
      if (!pm.ok) throw new Error(`cached manifest does not parse: ${pm.error}`);
      const srcs = readdirSync(fixDir).filter((n) => n.endsWith('.png')).sort().map((n) => join(fixDir, n));
      const enc = encodePieces(srcs, encoder, tmp);
      const fixes = new Map();
      for (const s of srcs) {
        const { width, height } = pngSize(readFileSync(s));
        fixes.set(imageStem(s.split('/').pop()), { ...enc.get(s), width, height });
      }
      const r = nextManifest(manifest, fixes);
      if (!r) continue;
      const newFolder = cat.packFolder(p.id, r.manifest.packVersion);
      const dir = join(out, newFolder);
      mkdirSync(dir, { recursive: true });
      const newByPath = new Map([...r.renamed.values()].map((n) => [n.path, n]));
      for (const a of r.manifest.assets) {
        const n = newByPath.get(a.path);
        if (n) {
          writeFileSync(join(dir, a.path), n.bytes);
          continue;
        }
        const src = join(cache, oldFolder, a.path);
        if (baseUrl && (!existsSync(src) || sha256(readFileSync(src)) !== a.sha256)) fetchFlat(baseUrl, `${oldFolder}/${a.path}`, src);
        if (!existsSync(src) || sha256(readFileSync(src)) !== a.sha256) throw new Error(`${a.path} missing or changed in the cache (run blend-audit --download)`);
        copyFileSync(src, join(dir, a.path));
      }
      const check = cat.parseRemoteArtManifest(r.manifest, p.id);
      if (!check.ok) throw new Error(`new manifest does not parse: ${check.error}`);
      writeFileSync(join(dir, cat.REMOTE_ART_MANIFEST), JSON.stringify(r.manifest, null, 2) + '\n');
      const thumbName = p.thumb.slice(oldFolder.length + 1);
      p.packVersion = r.manifest.packVersion;
      p.manifest = cat.manifestPath(p.id, p.packVersion);
      p.thumb = `${newFolder}/${thumbName}`;
      p.bytes = r.manifest.totalBytes;
      if (versions) versions[p.id] = { packVersion: p.packVersion, contentHash: r.contentHash };
      changed.push({ id: p.id, packVersion: p.packVersion, pieces: r.renamed.size, supersedes: oldFolder });
      log(`${p.id}: v${p.packVersion} (${r.renamed.size} piece${r.renamed.size === 1 ? '' : 's'} with alpha)`);
    } catch (e) {
      errors.push(`${p.id}: ${e.message}`);
    }
  }
  rmSync(tmp, { recursive: true, force: true });
  const check = cat.parseCatalog(nextCatalog);
  if (!check.ok) errors.push(`new catalog does not parse: ${check.error}`);
  else if (check.value.packs.length !== parsed.value.packs.length) errors.push('new catalog lost packs');
  writeFileSync(join(out, cat.CATALOG_FILE), JSON.stringify(nextCatalog, null, 2) + '\n');
  if (versions && changed.length) {
    const sorted = Object.fromEntries(Object.keys(versions).sort().map((k) => [k, versions[k]]));
    writeFileSync(versionsFile, JSON.stringify(sorted, null, 2) + '\n');
  }
  return { changed, errors };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const a = process.argv.slice(2);
  const o = {};
  for (let i = 0; i < a.length; i += 2) o[a[i].replace(/^--/, '')] = a[i + 1];
  if (!o.cache || !o.fix || !o.out) {
    console.error('usage: rebuild_widget_alpha.mjs --cache <dir> --fix <dir> --out <dir> [--versions file] [--encoder pillow|png]');
    process.exit(2);
  }
  const only = o.only ? new Set(o.only.split(',').filter(Boolean)) : null;
  const r = rebuild({ cache: resolve(o.cache), fix: resolve(o.fix), out: resolve(o.out), encoder: o.encoder || 'pillow', versionsFile: o.versions ? resolve(o.versions) : '', catalogFile: o.catalog ? resolve(o.catalog) : '', only, baseUrl: o.download || '' });
  // Folders this build supersedes (one per line), for the workflow to prune from the release once the new catalogue is live.
  writeFileSync(join(resolve(o.out), 'superseded.txt'), r.changed.map((c) => c.supersedes).join('\n') + (r.changed.length ? '\n' : ''));
  console.log(`rebuilt ${r.changed.length} pack(s), ${r.changed.reduce((s, c) => s + c.pieces, 0)} piece(s)`);
  for (const e of r.errors) console.error('error:', e);
  process.exit(r.errors.length ? 1 : 0);
}
