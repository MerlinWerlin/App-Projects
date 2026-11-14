#!/usr/bin/env node
// Hash-check an offline release plan against public bytes; never uploads or changes a release.
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { digest } from './append_artwork.mjs';
import { parseExisting } from './release_assets.mjs';
import { isPackReleaseTag, isValidFlatAssetName } from '../../src/core/packHost.ts';

export async function verifyArtworkRelease({ dir, existingDir, uploadedOnly = false, fetcher = fetch, attempts = 3, log = console.log }) {
  if (!uploadedOnly && !existingDir) throw new Error('preflight verification requires --existing-dir');
  const tags = readFileSync(join(dir, 'tags.txt'), 'utf8').trim().split(/\r?\n/).filter(Boolean), jobs = [];
  for (const tag of tags) {
    if (!isPackReleaseTag(tag)) throw new Error('invalid release tag');
    const plan = JSON.parse(readFileSync(join(dir, tag, 'plan.json'), 'utf8'));
    const existing = uploadedOnly ? null : parseExisting(JSON.parse(readFileSync(join(existingDir, `${tag}.json`), 'utf8')));
    for (const a of plan.assets) {
      if (!isValidFlatAssetName(a.name) || !/^[0-9a-f]{64}$/.test(a.sha256)) throw new Error('invalid upload plan asset');
      if (uploadedOnly ? a.upload : a.kind !== 'catalog' && existing.has(a.name)) jobs.push({ ...a, tag });
    }
  }
  let index = 0, verified = 0;
  const worker = async () => {
    while (index < jobs.length) {
      const job = jobs[index++];
      let error;
      for (let attempt = 0; attempt < attempts; attempt++) {
        try {
          const url = new URL(`https://github.com/MerlinWerlin/App-Projects/releases/download/${job.tag}/${job.name}`);
          if (job.kind === 'catalog') url.searchParams.set('verify', String(Date.now()));
          const response = await fetcher(url.href, { signal: AbortSignal.timeout(90000) });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const bytes = Buffer.from(await response.arrayBuffer());
          if (bytes.length !== job.size || digest(bytes) !== job.sha256) throw new Error('published bytes differ from the upload plan');
          error = null; break;
        } catch (e) { error = e; if (attempt + 1 < attempts) await new Promise((r) => setTimeout(r, 1000 * (attempt + 1))); }
      }
      if (error) throw new Error(`${job.tag}/${job.name}: ${error.message}; immutable files must not be overwritten`);
      verified++;
      if (verified % 50 === 0 || verified === jobs.length) log(`Verified ${verified}/${jobs.length} public release assets`);
    }
  };
  await Promise.all(Array.from({ length: Math.min(6, jobs.length) }, worker));
  return { verified };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2), value = (name) => args[args.indexOf(name) + 1];
    if (!args.includes('--dir')) throw new Error('usage: --dir <release-plan-dir> [--existing-dir <dir> | --uploaded]');
    await verifyArtworkRelease({ dir: value('--dir'), existingDir: args.includes('--existing-dir') ? value('--existing-dir') : undefined, uploadedOnly: args.includes('--uploaded') });
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
