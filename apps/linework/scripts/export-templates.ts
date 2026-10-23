// Writes assets/templates/<id>.svg from the template data in src/core/templates.ts.
// Run: node scripts/export-templates.ts   (Node ≥ 22.18 strips TypeScript types natively)
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEMPLATES, toSvgString } from '../src/core/templates.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'assets', 'templates');
mkdirSync(outDir, { recursive: true });

// Remove stale exports so the folder mirrors the catalogue exactly.
const ids = new Set(TEMPLATES.map((t) => t.id));
for (const file of readdirSync(outDir)) {
  if (file.endsWith('.svg') && !ids.has(file.slice(0, -4))) rmSync(join(outDir, file));
}

let bytes = 0;
for (const t of TEMPLATES) {
  const svg = toSvgString(t);
  writeFileSync(join(outDir, `${t.id}.svg`), svg);
  bytes += Buffer.byteLength(svg);
}
console.log(`Exported ${TEMPLATES.length} templates to assets/templates (${(bytes / 1024).toFixed(1)} KB).`);
