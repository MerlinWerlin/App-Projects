import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Oversight D5-1: expo-file-system is reached only through src/native/fs.ts,
// so an SDK bump that removes 'expo-file-system/legacy' is a one-file fix.
test('only src/native/fs.ts imports expo-file-system', () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const files: string[] = [];
  for (const top of ['app', 'src']) {
    for (const f of readdirSync(join(root, top), { recursive: true }) as string[]) {
      if (/\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f)) files.push(join(root, top, f));
    }
  }
  assert.ok(files.length > 10);
  const offenders: string[] = [];
  for (const f of files) {
    const rel = relative(root, f).split(sep).join('/');
    if (rel === 'src/native/fs.ts') continue;
    const text = readFileSync(f, 'utf8');
    if (/(from|import|require\()\s*\(?\s*['"]expo-file-system(\/[^'"]*)?['"]/.test(text)) offenders.push(rel);
  }
  assert.deepEqual(offenders, []);
});

test('src/native/fs.ts re-exports the legacy API', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const text = readFileSync(join(here, 'fs.ts'), 'utf8');
  assert.match(text, /export \* from 'expo-file-system\/legacy';/);
});
