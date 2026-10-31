// T181 (run 191): strings from the old Themes gallery (tips banner, Plus packs shelf, empty pack
// card) were retired once the New collection replaced it. Guard that they stay out of every locale.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const dir = new URL('../i18n/ns/themes/', import.meta.url);
const RETIRED = /^\s+(hideTips|hideTipsA11y|startersEmpty|plusPacks|plusPacksBody|plusPacksEmpty|packEmpty|ctaHint)\s*:/m;

test('retired old-gallery theme strings are absent from all locales', () => {
  const files = readdirSync(dir).filter((f) => f.endsWith('.ts') && f !== 'index.ts');
  assert.ok(files.length >= 11, "expected 11 locale files");
  for (const f of files) {
    assert.doesNotMatch(readFileSync(new URL(f, dir), 'utf8'), RETIRED, f);
  }
});
