// T52 (real PC tsc, 23 Oct 2026): 410 errors, none in app/ or src/ code; all were Node built-ins
// without types in *.test.ts, ops/*.ts and app.config.ts (TypeScript 6 no longer loads @types/*
// by default). Guards for the fix: the app tsconfig leaves the Node-side files out, and
// tsconfig.node.json checks them with types ["node"].
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();
const json = (f: string) => JSON.parse(readFileSync(join(root, f), 'utf8')) as Record<string, any>;

test('T52: the app tsconfig excludes tests, ops scripts and app.config.ts', () => {
  const app = json('tsconfig.json');
  for (const ex of ['**/*.test.ts', 'ops', 'app.config.ts', 'scripts']) assert.ok(app.exclude.includes(ex), ex);
});

test('T52: Node-side files get their own tsconfig with Node types', () => {
  const node = json('tsconfig.node.json');
  assert.deepEqual(node.compilerOptions.types, ['node']);
  for (const inc of ['src/**/*.test.ts', 'ops/**/*.ts', 'app.config.ts']) assert.ok(node.include.includes(inc), inc);
  const pkg = json('package.json');
  assert.ok(pkg.devDependencies['@types/node'], '@types/node is a devDependency');
  assert.match(pkg.scripts.typecheck, /tsc -p tsconfig\.node\.json/);
});

test('T52: app.config.ts types its callback parameters (no implicit any)', () => {
  const src = readFileSync(join(root, 'app.config.ts'), 'utf8');
  assert.doesNotMatch(src, /\(f\) =>/);
  assert.match(src, /\(f: string\) =>/);
});
