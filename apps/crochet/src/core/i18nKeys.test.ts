// Every t('literal.key') used in the app exists in the English catalogue, and templated keys resolve for
// their known values.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { en } from '../i18n/en.ts';

function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(f) && !f.endsWith('.test.ts')) out.push(p);
  }
  return out;
}

const root = join(import.meta.dirname, '..', '..');
const files = [...walk(join(root, 'app')), ...walk(join(root, 'src'))];

test('all literal translation keys exist', () => {
  const missing: string[] = [];
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g)) {
      if (!(m[1] in en)) missing.push(`${f.replace(root, '')}: ${m[1]}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('templated keys resolve', () => {
  const need = [
    ...['active', 'planned', 'finished', 'frogged'].map((s) => `status.${s}`),
    ...['active', 'planned', 'finished', 'all'].map((s) => `projects.filter.${s}`),
    ...['ball', 'evenly', 'convert', 'gauge', 'yarn', 'price', 'glossary', 'hooks', 'weights', 'sizes'].flatMap((k) => [`tool.${k}.title`, `tool.${k}.blurb`]),
    ...['make', 'ref'].map((g) => `tools.group.${g}`),
    ...['Blanket', 'Hat', 'Scarf'].map((g) => `tool.sizes.${g}`),
    ...['granny', 'textured', 'mesh'].map((s) => `tool.yarn.st.${s}`),
    ...['stash', 'price', 'support'].flatMap((k) => [`plus.perk.${k}`, `plus.perk.${k}.body`]),
    ...['projects', 'counters', 'patterns', 'pdf', 'tools', 'backup'].map((k) => `plus.free.${k}`),
  ];
  assert.deepEqual(need.filter((k) => !(k in en)), []);
});
