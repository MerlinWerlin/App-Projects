// T86: the widget extension's Localizable.strings (targets/widget/<lang>.lproj) cover every
// shipping app language with the same keys and the same %@ arguments, and every key the Swift code
// looks up exists in English. No Xcode here, so this is the only check the strings get before a
// device build.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { SHIPPING_LOCALES } from './i18n.ts';

const WIDGET_DIR = join(process.cwd(), 'targets/widget');

/** Minimal .strings parser: `"key" = "value";` lines, comments skipped, \" and \\ unescaped. */
function parseStrings(src: string): Map<string, string> {
  const noComments = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const out = new Map<string, string>();
  const re = /"((?:[^"\\]|\\.)*)"\s*=\s*"((?:[^"\\]|\\.)*)"\s*;/g;
  const unescape = (s: string): string => s.replace(/\\(.)/g, '$1');
  let rest = noComments;
  for (const m of noComments.matchAll(re)) {
    const key = unescape(m[1]);
    assert.ok(!out.has(key), `duplicate key ${key}`);
    out.set(key, unescape(m[2]));
    rest = rest.replace(m[0], '');
  }
  assert.equal(rest.trim(), '', `unparsed text in .strings: ${rest.trim().slice(0, 80)}`);
  return out;
}

/** Format arguments in order of position: "%1$@ %2$@" → ['1@', '2@']; "%@ %@" → ['1@', '2@']. */
function formatArgs(s: string): string[] {
  const args: string[] = [];
  let next = 1;
  for (const m of s.matchAll(/%(?:(\d+)\$)?([@dfs])/g)) args.push(`${m[1] ?? next++}${m[2]}`);
  return args.sort();
}

const read = (lang: string): Map<string, string> => parseStrings(readFileSync(join(WIDGET_DIR, `${lang}.lproj`, 'Localizable.strings'), 'utf8'));
const en = read('en');

test('one Localizable.strings per shipping app language, and no others', () => {
  const dirs = readdirSync(WIDGET_DIR).filter((d) => d.endsWith('.lproj')).map((d) => d.replace(/\.lproj$/, '')).sort();
  assert.deepEqual(dirs, [...SHIPPING_LOCALES].sort());
  for (const lang of dirs) assert.ok(existsSync(join(WIDGET_DIR, `${lang}.lproj`, 'Localizable.strings')), lang);
});

for (const lang of SHIPPING_LOCALES) {
  test(`${lang}: same keys as English, non-empty, same format arguments`, () => {
    const cat = read(lang);
    assert.deepEqual([...cat.keys()].sort(), [...en.keys()].sort());
    for (const [key, src] of en) {
      const msg = cat.get(key) ?? '';
      assert.ok(msg.trim().length > 0, `${lang} ${key} is empty`);
      assert.deepEqual(formatArgs(msg), formatArgs(src), `${lang} ${key}: arguments differ`);
    }
  });
}

test('every String(localized:) key and default in Swift matches English', () => {
  const swift = readdirSync(WIDGET_DIR).filter((f) => f.endsWith('.swift'));
  let seen = 0;
  for (const f of swift) {
    const src = readFileSync(join(WIDGET_DIR, f), 'utf8');
    for (const m of src.matchAll(/String\(localized:\s*"([^"]+)",\s*defaultValue:\s*"((?:[^"\\]|\\.)*)"\)/g)) {
      seen++;
      const key = m[1];
      assert.ok(en.has(key), `${f}: ${key} missing from en.lproj`);
      // Swift interpolations \(x) become %@ arguments, in order.
      const english = m[2].replace(/\\\([^)]*\)/g, '%@');
      let i = 0;
      const positional = english.replace(/%@/g, () => `%${++i}$@`);
      assert.equal(en.get(key), positional, `${f}: ${key} default differs from en.lproj`);
    }
  }
  assert.ok(seen >= 27, `expected the habit widget strings, found ${seen}`);
});

test('no hard-coded English left in the habit widget views', () => {
  const src = readFileSync(join(WIDGET_DIR, 'HabitWidget.swift'), 'utf8').replace(/\/\/.*$/gm, '');
  // Only symbol-only literals (− + and "+\(n)" button faces) may stay.
  for (const m of src.matchAll(/"((?:[^"\\]|\\.)*)"/g)) {
    assert.ok(!/[A-Za-z]{2,}/.test(m[1].replace(/\\\([^)]*\)/g, '')), `hard-coded text in HabitWidget.swift: "${m[1]}"`);
  }
});

test('App Intent titles and the other widgets\' literal names have English entries', () => {
  for (const f of ['HabitIntents.swift', 'ClockWidget.swift', 'DateWidget.swift', 'PhotoWidget.swift', 'QuoteWidget.swift', 'SeamlessWidget.swift']) {
    const src = readFileSync(join(WIDGET_DIR, f), 'utf8');
    const literals = [
      ...src.matchAll(/(?:title:|LocalizedStringResource =|configurationDisplayName\(|\.description\(|Text\()\s*"((?:[^"\\]|\\.)*)"/g),
    ].map((m) => m[1]);
    for (const text of literals) {
      if (text.includes('\\(')) continue;
      assert.ok(en.has(text), `${f}: "${text}" has no Localizable.strings entry`);
    }
  }
});
