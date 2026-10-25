import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LANGUAGE_HINT_KEY, LANGUAGE_HINT_SHOWN, decideLanguageHint } from './languageHint.ts';

test('language line: shown in the first session and the flag is written at once', () => {
  assert.deepEqual(decideLanguageHint(null, null), { show: true, write: LANGUAGE_HINT_SHOWN });
});

test('language line: never shown again in a later session', () => {
  // Simulate two launches against one storage.
  const storage = new Map<string, string>();
  const launch = () => {
    const d = decideLanguageHint(storage.get(LANGUAGE_HINT_KEY) ?? null, null);
    if (d.write) storage.set(LANGUAGE_HINT_KEY, d.write);
    return d.show;
  };
  assert.equal(launch(), true);
  assert.equal(launch(), false);
  assert.equal(launch(), false);
});

test('language line: skipped when a language was already chosen in Settings', () => {
  assert.deepEqual(decideLanguageHint(null, 'system'), { show: false, write: LANGUAGE_HINT_SHOWN });
  assert.deepEqual(decideLanguageHint(null, 'fr'), { show: false, write: LANGUAGE_HINT_SHOWN });
  assert.deepEqual(decideLanguageHint(LANGUAGE_HINT_SHOWN, null), { show: false, write: null });
});

test('language line: Themes renders it and tapping hides it and opens the picker', () => {
  const themes = readFileSync(join(process.cwd(), 'app/(tabs)/themes.tsx'), 'utf8');
  assert.match(themes, /<LanguageHintLine \/>/);
  const line = readFileSync(join(process.cwd(), 'src/ui/LanguageHintLine.tsx'), 'utf8');
  assert.match(line, /dismissLanguageHint\(\)/);
  assert.match(line, /<LanguagePickerSheet/);
  assert.match(line, /settings\.language\.hintLine/);
});
