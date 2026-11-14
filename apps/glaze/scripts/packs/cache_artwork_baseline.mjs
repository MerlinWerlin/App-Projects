#!/usr/bin/env node
// Read-only public downloads. Pinned snapshot manifests and all asset SHA256/lengths are verified.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkedPath, digest, loadBaseline } from './append_artwork.mjs';
import { packObjectUrl, packReleaseBase } from '../../src/core/packHost.ts';

export async function cacheArtworkBaseline({ snapshotDir, outDir, concurrency = 6, fetcher = fetch, log = console.log }) {
  const source = resolve(snapshotDir), out = resolve(outDir);
  if (source === out) throw new Error('cache must be separate from the committed snapshot');
  const baseline = loadBaseline(source), jobs = [];
  mkdirSync(out, { recursive: true });
  for (const name of ['catalog.json', 'baseline-lock.json']) copyFileSync(join(source, name), join(out, name));
  for (const p of baseline.catalog.packs) {
    const m = baseline.manifests.get(p.id), base = packReleaseBase(baseline.lock.catalogUrl.replace(/\/catalog\.json$/, ''), p.release);
    const target = checkedPath(out, p.manifest); mkdirSync(dirname(target), { recursive: true }); copyFileSync(checkedPath(source, p.manifest), target);
    for (const a of m.assets) jobs.push({ ...a, path: `${p.manifest.replace(/manifest\.json$/, '')}${a.path}`, url: packObjectUrl(base, `${p.manifest.replace(/manifest\.json$/, '')}${a.path}`) });
  }
  let index = 0, done = 0, downloaded = 0;
  const worker = async () => {
    while (index < jobs.length) {
      const job = jobs[index++], path = checkedPath(out, job.path);
      const valid = (bytes) => bytes.length === job.bytes && digest(bytes) === job.sha256;
      if (!existsSync(path) || !valid(readFileSync(path))) {
        let error;
        for (let attempt = 0; attempt < 4; attempt++) {
          try {
            const response = await fetcher(job.url, { signal: AbortSignal.timeout(90000) });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const bytes = Buffer.from(await response.arrayBuffer());
            if (!valid(bytes)) throw new Error('asset SHA256/length mismatch');
            mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, bytes); downloaded++; error = null; break;
          } catch (e) { error = e; if (attempt < 3) await new Promise((r) => setTimeout(r, 1000 * (attempt + 1))); }
        }
        if (error) throw new Error(`${job.url}: ${error.message}`);
      }
      done++;
      if (done % 50 === 0 || done === jobs.length) log(`Verified ${done}/${jobs.length} baseline assets (${downloaded} downloaded)`);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, worker));
  return { assets: done, downloaded };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2), get = (name) => args[args.indexOf(name) + 1];
    if (!args.includes('--snapshot') || !args.includes('--out')) throw new Error('usage: --snapshot scripts/packs/artwork-baseline --out <cache>');
    await cacheArtworkBaseline({ snapshotDir: get('--snapshot'), outDir: get('--out') });
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
