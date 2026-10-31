// Brings docs/spec/EN_CATALOGUE.json and docs/spec/STRINGS_NEW.json in line with src/i18n for the groups listed in
// src/i18n/specsync.ts (T53). Offline, no dependencies; Node 22.18+ reads the .ts sources directly.
// Usage (from the app folder): node tools/i18n/sync-spec-catalogues.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { en } from '../../src/i18n/en.ts';
import { SPEC_CATALOGUES, specDrift, syncSpec } from '../../src/i18n/specsync.ts';

const root = resolve(new URL('../..', import.meta.url).pathname);
for (const rel of SPEC_CATALOGUES) {
  const file = join(root, rel);
  const text = readFileSync(file, 'utf8');
  const before = JSON.parse(text);
  const d = specDrift(before, en);
  const indent = /^\{\n( +)"/.exec(text)?.[1].length ?? 1;
  writeFileSync(file, JSON.stringify(syncSpec(before, en), null, indent) + (text.endsWith('\n') ? '\n' : ''));
  console.log(`${rel}: +${d.missing.length} added, ${d.changed.length} updated, -${d.stale.length} removed`);
}
