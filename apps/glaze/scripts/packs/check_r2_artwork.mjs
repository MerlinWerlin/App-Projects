#!/usr/bin/env node
// Glaze 1.0.37: for the given themes, read the LIVE catalogue and manifests from a folder pack host
// (R2) and work out Artwork 1-5 with the app's own rule (src/core/artworkCoverage.ts). Reports each
// slot's option id, image file and SHA-256, and fails if a theme has fewer than five pieces or two
// slots share an image (same option, same file or same bytes). Read-only, no secrets.
//
//   node scripts/packs/check_r2_artwork.mjs --base https://pub-….r2.dev aurora-haven cobalt-caravan
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { packObjectUrl } from '../../src/core/packHost.ts';

const { parseWidgetOptions } = await import(new URL('../../src/core/widgetOptions.ts', import.meta.url).href);
const { plannedArtworkOptionIds } = await import(new URL('../../src/core/artworkCoverage.ts', import.meta.url).href);

const json = async (url) => {
  const r = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
};

export async function checkArtwork(base, ids) {
  const catalog = await json(`${packObjectUrl(base, 'catalog.json')}?check=${Date.now()}`);
  const out = [];
  for (const id of ids) {
    const entry = catalog.packs.find((p) => p.id === id);
    if (!entry) throw new Error(`${id}: not in the catalogue`);
    const m = await json(packObjectUrl(base, entry.manifest));
    const parsed = parseWidgetOptions(m.widgets ?? null, m.assets ?? []);
    const options = parsed.options ?? parsed;
    const artwork = plannedArtworkOptionIds(id, options);
    const byId = new Map(options.map((o) => [o.id, o]));
    const assets = new Map((m.assets ?? []).map((a) => [a.path, a]));
    const slots = artwork.map((oid) => {
      const o = byId.get(oid);
      const a = assets.get(o?.image);
      return { option: oid, image: o?.image ?? null, sha256: a?.sha256 ?? null };
    });
    const unique = (k) => new Set(slots.map((s) => s[k])).size === slots.length;
    const ok = slots.length === 5 && unique('option') && unique('image') && unique('sha256') && slots.every((s) => s.sha256);
    out.push({ id, packVersion: entry.packVersion, manifest: entry.manifest, ok, slots });
  }
  return out;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--base');
  const base = i >= 0 ? args[i + 1] : '';
  const ids = args.filter((a, j) => j !== i && j !== i + 1);
  const res = await checkArtwork(base, ids);
  console.log(JSON.stringify(res, null, 2));
  process.exit(res.every((r) => r.ok) ? 0 : 1);
}
