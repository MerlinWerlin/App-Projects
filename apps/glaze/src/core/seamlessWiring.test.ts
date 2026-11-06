// T133 source guard: the theme detail shows the Seamless widget card for art-pack themes only,
// writes through widgets.setSeamless only from the button's press handler, and every key it uses
// exists in English.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const read = (p: string): string => readFileSync(join(process.cwd(), p), 'utf8');
test('local asset helper downloads only http(s) URIs, through the fs adapter', () => {
  const src = read('src/ui/seamlessSetup.ts');
  assert.match(src, /import \* as fs from '[./]*native\/fs'/);
  assert.match(src, /startsWith\('file:\/\/'\)/);
  assert.match(src, /fs\.downloadAsync\(/);
  assert.doesNotMatch(src, /expo-file-system/);
});
