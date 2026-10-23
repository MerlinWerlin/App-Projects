// Guard for the cloud strict-tsc stub harness (D74-3, T52; scripts/README.md): the config, the
// hand-written third-party stubs and the npm script stay in place, and every third-party module the
// app imports has a stub (otherwise `npm run typecheck:ui` fails with TS2307 in the cloud).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const stubsDir = join(root, 'scripts', 'tsc-stubs');

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

function thirdPartyImports(file: string): string[] {
  const src = readFileSync(file, 'utf8');
  const re = /(?:^|\n)\s*(?:import|export)\s[^;]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)/g;
  const out: string[] = [];
  for (const m of src.matchAll(re)) {
    const spec = m[1] ?? m[2] ?? m[3];
    if (/^[@a-z]/.test(spec) && !spec.startsWith('node:')) out.push(spec);
  }
  return out;
}

test('scripts/tsconfig.ui.json exists, is strict and includes the stubs', () => {
  const path = join(root, 'scripts', 'tsconfig.ui.json');
  assert.ok(existsSync(path), 'scripts/tsconfig.ui.json is missing');
  const cfg = JSON.parse(readFileSync(path, 'utf8')) as {
    compilerOptions: Record<string, unknown>;
    include: string[];
  };
  assert.equal(cfg.compilerOptions.strict, true);
  assert.equal(cfg.compilerOptions.noEmit, true);
  assert.equal(cfg.compilerOptions.jsx, 'react-jsx');
  assert.ok(cfg.include.some((p) => p.startsWith('tsc-stubs/')), 'stubs are not included');
  assert.ok(cfg.include.some((p) => p.startsWith('../app/')), 'app/ is not included');
  assert.ok(cfg.include.some((p) => p.startsWith('../src/')), 'src/ is not included');
});

test('the stubs directory holds the core library declarations', () => {
  assert.ok(existsSync(stubsDir), 'scripts/tsc-stubs is missing');
  const names = readdirSync(stubsDir).filter((n) => n.endsWith('.d.ts'));
  assert.ok(names.length >= 5, `expected several stub files, got ${names.length}`);
});

test('package.json has the typecheck:ui script', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
  assert.equal(pkg.scripts['typecheck:ui'], 'tsc -p scripts/tsconfig.ui.json');
});

test('every third-party module imported by app/ and src/ has a stub', () => {
  const declared = new Set<string>();
  for (const name of readdirSync(stubsDir)) {
    if (!name.endsWith('.d.ts')) continue;
    const src = readFileSync(join(stubsDir, name), 'utf8');
    for (const m of src.matchAll(/declare module '([^']+)'/g)) declared.add(m[1]);
  }
  const missing = new Set<string>();
  for (const file of [...walk(join(root, 'app')), ...walk(join(root, 'src'))]) {
    for (const spec of thirdPartyImports(file)) if (!declared.has(spec)) missing.add(`${spec} (${file.slice(root.length + 1)})`);
  }
  assert.deepEqual([...missing], [], 'add these modules to scripts/tsc-stubs');
});
