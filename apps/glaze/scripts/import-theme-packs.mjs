#!/usr/bin/env node
// T130: import theme art packs (docs/THEME_PACKS.md, "Art packs (themes-1024)").
//
//   node scripts/import-theme-packs.mjs <folder-of-packs> [--dry-run] [--replace]
//   node scripts/import-theme-packs.mjs --regenerate
//
// Validates every sub-folder of <folder-of-packs> as an art pack (src/core/artPack.ts), copies the
// valid ones into themes/<id>/ (an id that already exists is refused unless --replace), prints a
// report, then regenerates src/ui/artPackAssets.ts (literal require() map for Metro) and
// src/core/artPackLibrary.ts (palette + meta per pack) from everything in themes/.
// --dry-run validates and reports only; nothing is written. --regenerate only rebuilds the two
// generated files from themes/. Exit code 1 when any pack failed.
// Node 22.18+ runs the TypeScript core directly (type stripping), so no build step is needed.

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// The core is TypeScript in a package without "type": "module"; Node reparses it as ESM and warns
// once per file. The warning is noise here, so drop it before loading the core.
process.removeAllListeners('warning');
const { ART_ASSETS_PATH, ART_LIBRARY_PATH, ART_PACK_DIR, ART_PACK_FILES, artPackAssetsSource, artPackLibrarySource, validateArtPack } = await import(
  '../src/core/artPack.ts'
);

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const positional = args.filter((a) => !a.startsWith('--'));
const dryRun = flags.has('--dry-run');
const replace = flags.has('--replace');
const regenerateOnly = flags.has('--regenerate');
for (const f of flags) {
  if (!['--dry-run', '--replace', '--regenerate', '--help'].includes(f)) {
    console.error(`unknown option ${f}`);
    process.exit(2);
  }
}
if (flags.has('--help') || (!regenerateOnly && positional.length !== 1)) {
  console.log('usage: node scripts/import-theme-packs.mjs <folder-of-packs> [--dry-run] [--replace]\n       node scripts/import-theme-packs.mjs --regenerate');
  process.exit(flags.has('--help') ? 0 : 2);
}

const kb = (n) => `${(n / 1000).toFixed(0)} kB`;

/** Top-level regular files of a pack folder, by name. */
function readPackFiles(dir) {
  const files = {};
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isFile()) files[name] = new Uint8Array(readFileSync(p));
  }
  return files;
}

function subfolders(dir) {
  return readdirSync(dir)
    .filter((n) => !n.startsWith('.') && statSync(join(dir, n)).isDirectory())
    .sort();
}

/** Ids of the app's built-in themes (an art pack must not reuse one). */
async function builtInIds() {
  try {
    const { ALL_THEMES } = await import('../src/core/plusThemes.ts');
    const { SPACE_THEMES } = await import('../src/core/spacePack.ts');
    const { ART_PACK_THEMES } = await import('../src/core/artPackThemes.ts');
    const art = new Set(ART_PACK_THEMES.map((t) => t.id));
    return new Set([...ALL_THEMES, ...SPACE_THEMES].map((t) => t.id).filter((id) => !art.has(id)));
  } catch (e) {
    console.warn(`warning: could not load the built-in theme list (${e instanceof Error ? e.message : e}); id clashes with built-in themes are not checked`);
    return new Set();
  }
}

function printReport(id, report, extra = []) {
  const status = report.ok && extra.length === 0 ? 'OK    ' : 'FAILED';
  const size = report.pack ? ` (${kb(Object.values(report.pack.bytes).reduce((a, b) => a + b, 0))})` : '';
  console.log(`${status} ${id}${size}`);
  for (const e of [...report.errors, ...extra]) console.log(`    error:   ${e}`);
  for (const w of report.warnings) console.log(`    warning: ${w}`);
}

/** Validate everything in themes/ and rewrite the two generated files. */
function regenerate() {
  const themesDir = join(root, ART_PACK_DIR);
  const packs = [];
  let bad = 0;
  if (existsSync(themesDir)) {
    for (const id of subfolders(themesDir)) {
      const r = validateArtPack(id, readPackFiles(join(themesDir, id)), { alphaRowStep: 2 });
      if (r.ok && r.pack) packs.push(r.pack);
      else {
        bad++;
        console.log(`themes/${id} is not a valid pack and is left out of the app:`);
        printReport(id, r);
      }
    }
  }
  const lib = artPackLibrarySource(packs);
  const assets = artPackAssetsSource(packs.map((p) => p.id));
  if (dryRun) {
    console.log(`(dry run) would write ${ART_LIBRARY_PATH} and ${ART_ASSETS_PATH} with ${packs.length} pack(s)`);
  } else {
    writeFileSync(join(root, ART_LIBRARY_PATH), lib);
    writeFileSync(join(root, ART_ASSETS_PATH), assets);
    console.log(`wrote ${ART_LIBRARY_PATH} and ${ART_ASSETS_PATH}: ${packs.length} pack(s): ${packs.map((p) => p.id).join(', ') || '(none)'}`);
  }
  return bad;
}

async function main() {
  if (regenerateOnly) return regenerate() > 0 ? 1 : 0;

  const src = resolve(positional[0]);
  if (!existsSync(src) || !statSync(src).isDirectory()) {
    console.error(`not a folder: ${src}`);
    return 2;
  }
  const ids = subfolders(src);
  if (ids.length === 0) {
    console.error(`no pack folders in ${src}`);
    return 2;
  }
  const builtIn = await builtInIds();
  const themesDir = join(root, ART_PACK_DIR);
  let failed = 0;
  let imported = 0;
  let total = 0;
  console.log(`${dryRun ? 'Checking' : 'Importing'} ${ids.length} pack(s) from ${src}${dryRun ? ' (dry run: nothing is written)' : ''}\n`);
  for (const id of ids) {
    const report = validateArtPack(id, readPackFiles(join(src, id)));
    const extra = [];
    if (builtIn.has(id)) extra.push(`id "${id}" is already a built-in theme; rename the folder`);
    const dest = join(themesDir, id);
    if (report.ok && existsSync(dest) && !replace) extra.push(`themes/${id} already exists; pass --replace to overwrite it`);
    printReport(id, report, extra);
    if (!report.ok || extra.length) {
      failed++;
      continue;
    }
    total += Object.values(report.pack.bytes).reduce((a, b) => a + b, 0);
    if (dryRun) continue;
    if (existsSync(dest)) rmSync(dest, { recursive: true });
    mkdirSync(dest, { recursive: true });
    for (const f of ART_PACK_FILES) cpSync(join(src, id, f), join(dest, f));
    imported++;
  }
  console.log(`\n${ids.length - failed} valid, ${failed} failed${dryRun ? '' : `, ${imported} imported into ${ART_PACK_DIR}/`} (${kb(total)} of art)`);
  if (!dryRun) regenerate();
  return failed > 0 ? 1 : 0;
}

process.exitCode = await main();
