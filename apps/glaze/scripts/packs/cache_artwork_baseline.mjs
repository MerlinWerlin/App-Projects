#!/usr/bin/env node
// Read-only public downloads. Pinned snapshot manifests and all asset SHA256/lengths are verified.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { checkedPath, digest, loadBaseline } from './append_artwork.mjs';
import { packObjectUrl, packReleaseBase } from '../../src/core/packHost.ts';

export async function cacheArtworkBaseline({ snapshotDir, outDir, concurrency = 6, fetcher = fetch, log = console.log,
  localArtDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../pack-artwork'),
  wait = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  const source = resolve(snapshotDir), out = resolve(outDir);
  if (source === out) throw new Error('cache must be separate from the committed snapshot');
  const baseline = loadBaseline(source), jobs = [];
  const mirrorFile = join(source, 'asset-mirrors.json');
  const mirrors = existsSync(mirrorFile) ? JSON.parse(readFileSync(mirrorFile, 'utf8')).bySha256 : {};
  mkdirSync(out, { recursive: true });
  for (const name of ['catalog.json', 'baseline-lock.json']) copyFileSync(join(source, name), join(out, name));
  for (const p of baseline.catalog.packs) {
    const m = baseline.manifests.get(p.id), base = packReleaseBase(baseline.lock.catalogUrl.replace(/\/catalog\.json$/, ''), p.release);
    const target = checkedPath(out, p.manifest); mkdirSync(dirname(target), { recursive: true }); copyFileSync(checkedPath(source, p.manifest), target);
    for (const a of m.assets) {
      const mirror = mirrors[a.sha256];
      if (mirror && !/^https:\/\/github\.com\/MerlinWerlin\/App-Projects\/releases\/download\/glaze-packs-v\d+\/[^/?#]+$/.test(mirror)) throw new Error('invalid pinned asset mirror');
      jobs.push({ ...a, path: `${p.manifest.replace(/manifest\.json$/, '')}${a.path}`,
        local: localArtDir ? checkedPath(localArtDir, `${p.id}/widgets/${a.path}`) : null, mirror,
        url: packObjectUrl(base, `${p.manifest.replace(/manifest\.json$/, '')}${a.path}`) });
    }
  }
  let index = 0, done = 0, downloaded = 0;
  const worker = async () => {
    while (index < jobs.length) {
      const job = jobs[index++], path = checkedPath(out, job.path);
      const valid = (bytes) => bytes.length === job.bytes && digest(bytes) === job.sha256;
      // Reuse retained add-art bytes only when they match the authoritative R2 hash/length.
      if ((!existsSync(path) || !valid(readFileSync(path))) && job.local && existsSync(job.local) && valid(readFileSync(job.local))) {
        mkdirSync(dirname(path), { recursive: true }); copyFileSync(job.local, path);
      }
      if (!existsSync(path) || !valid(readFileSync(path))) {
        let error;
        // R2.dev throttles bulk CI reads. Original release mirrors contain identical immutable
        // bytes; every response still must match the CURRENT R2 snapshot's SHA256 and length.
        for (const url of [...new Set([job.mirror, job.url].filter(Boolean))]) {
          for (let attempt = 0; attempt < 4; attempt++) {
            let delay = 1000 * (attempt + 1);
            try {
              const response = await fetcher(url, { signal: AbortSignal.timeout(90000) });
              if (response.status === 429) {
                const retry = response.headers?.get('retry-after');
                const seconds = Number(retry);
                const requested = retry ? (Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retry) - Date.now()) : 0;
                delay = Math.max(15000 * 2 ** attempt, Number.isFinite(requested) ? requested : 0);
              }
              if (!response.ok) throw new Error(`HTTP ${response.status}`);
              const bytes = Buffer.from(await response.arrayBuffer());
              if (!valid(bytes)) throw new Error('asset SHA256/length mismatch');
              mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, bytes); downloaded++; error = null; break;
            } catch (e) { error = e; if (attempt < 3) await wait(delay); }
          }
          if (!error) break;
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
