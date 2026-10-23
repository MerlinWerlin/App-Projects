// Regenerates the template-name block in src/i18n/en/templates.ts from the catalogue in src/core/templates.ts.
// Usage: node scripts/i18n-template-names.mjs   (offline, no dependencies; Node 22+ runs the .ts directly)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { TEMPLATES } = await import(join(root, 'src/core/templates.ts'));
const file = join(root, 'src/i18n/en/templates.ts');
const BEGIN = '  // Template names (generated) — BEGIN\n';
const END = '  // Template names (generated) — END\n';

const text = readFileSync(file, 'utf8');
const a = text.indexOf(BEGIN);
const b = text.indexOf(END);
if (a < 0 || b < a) {
  console.error('markers not found in', file);
  process.exit(1);
}
const lines = TEMPLATES.map((t) => `  ${JSON.stringify(`templates.name.${t.id}`).replace(/"/g, "'")}: ${quote(t.name)},\n`);
writeFileSync(file, text.slice(0, a + BEGIN.length) + lines.join('') + text.slice(b));
console.log(`wrote ${lines.length} template names`);

function quote(s) {
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}
