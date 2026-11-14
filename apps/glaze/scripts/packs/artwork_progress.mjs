#!/usr/bin/env node
// Validate source assets/provenance without downloads; print the PR's per-theme checklist.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { applyArtworkCorrections, loadBaseline, readArtworkAdditions } from './append_artwork.mjs';
import { parseWidgetOptions } from '../../src/core/widgetOptions.ts';
import { plannedArtworkOptionIds } from '../../src/core/artworkCoverage.ts';

export function artworkProgress({ appDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..'), complete = false } = {}) {
  const baseline = loadBaseline(join(appDir, 'scripts/packs/artwork-baseline'));
  const corrections = JSON.parse(readFileSync(join(appDir, 'scripts/packs/artwork-corrections.json'), 'utf8'));
  const rows = [], errors = [];
  for (const [id, original] of baseline.manifests) {
    const base = applyArtworkCorrections(original, corrections);
    const count = plannedArtworkOptionIds(id, parseWidgetOptions(base.widgets, base.assets).options).length;
    if (count === 5) continue; // genuinely complete baseline themes are retained separately
    const optionsFile = join(appDir, 'pack-artwork', id, 'widgets/widget-options.json');
    let added = [], status = 'pending';
    if (existsSync(optionsFile)) {
      try {
        const additions = readArtworkAdditions(join(appDir, 'pack-artwork'), id, base);
        const provenance = JSON.parse(readFileSync(join(appDir, 'pack-artwork', id, 'provenance.json'), 'utf8'));
        for (const asset of additions.assets) {
          const record = provenance.artworks?.find((a) => a.id === additions.options.find((o) => o.image === asset.path).id);
          if (!record || record.sha256 !== asset.sha256 || typeof record.prompt !== 'string' || !record.prompt.trim()) throw new Error('missing matching artwork hash and original prompt in provenance');
        }
        added = additions.options.map((o) => o.id); status = 'done';
      } catch (e) { status = 'invalid'; errors.push(`${id}: ${e.message}`); }
    }
    if (complete && status !== 'done') errors.push(`${id}: incomplete`);
    rows.push({ id, baseline: count, needs: 5 - count, added, status });
  }
  return { themes: rows.length, done: rows.filter((r) => r.status === 'done').length, additionsNeeded: rows.reduce((n, r) => n + r.needs, 0), additionsReady: rows.reduce((n, r) => n + r.added.length, 0), rows, errors };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const report = artworkProgress({ complete: process.argv.includes('--complete') });
    if (process.argv.includes('--markdown')) {
      console.log(`Artwork checklist: ${report.done}/${report.themes} themes; ${report.additionsReady}/${report.additionsNeeded} new pieces.\n`);
      for (const r of report.rows) console.log(`- [${r.status === 'done' ? 'x' : ' '}] \`${r.id}\` — ${r.added.length}/${r.needs} added${r.added.length ? `: ${r.added.map((id) => `\`${id}\``).join(', ')}` : ''}; ${r.status}`);
    } else console.log(JSON.stringify(report, null, 2));
    if (report.errors.length) { console.error(report.errors.join('\n')); process.exitCode = 1; }
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
