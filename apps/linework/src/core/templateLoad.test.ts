// D110-1: the catalogue loads fast (no generation at module load) and no runtime module imports the generators.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BAKED_SETS } from './templateArt/baked/sets.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

test('importing the whole catalogue takes under 1 s', async () => {
  const t0 = performance.now();
  const { TEMPLATES } = await import('./templates.ts');
  const ms = performance.now() - t0;
  assert.ok(TEMPLATES.length > 0);
  assert.ok(ms < 1000, `catalogue import took ${Math.round(ms)} ms`);
});

test('templates.ts imports every generated set from its baked file', () => {
  const src = readFileSync(join(root, 'src/core/templates.ts'), 'utf8');
  for (const { name, file } of BAKED_SETS) {
    assert.match(src, new RegExp(`import \\{ ${name} \\} from './templateArt/baked/${file}\\.ts';`), `${name} from baked`);
    assert.doesNotMatch(src, new RegExp(`from './templateArt/${file}\\.ts'`), `${name} not from the generator`);
  }
});

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (e === 'node_modules' || e.startsWith('.')) continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e) && !/\.test\.tsx?$/.test(e)) out.push(p);
  }
  return out;
}

test('no app/ or src/ runtime module outside the generators imports occlude.ts or a generator', () => {
  const generators = new Set(BAKED_SETS.map((s) => s.file));
  const bad: string[] = [];
  for (const p of [...walk(join(root, 'app')), ...walk(join(root, 'src'))]) {
    const rel = p.slice(root.length + 1).replace(/\\/g, '/');
    // Generator modules (and their helpers) live directly in src/core/templateArt/ and may import occlude.ts.
    if (/^src\/core\/templateArt\/[^/]+\.ts$/.test(rel)) continue;
    const src = readFileSync(p, 'utf8');
    for (const m of src.matchAll(/from '([^']+)'/g)) {
      const spec = m[1];
      if (/occlude(\.ts)?$/.test(spec)) bad.push(`${rel} → ${spec}`);
      const g = /templateArt\/([A-Za-z0-9]+)\.ts$/.exec(spec);
      if (g && generators.has(g[1]) && !spec.includes('/baked/')) bad.push(`${rel} → ${spec}`);
    }
  }
  assert.deepEqual(bad, []);
});
