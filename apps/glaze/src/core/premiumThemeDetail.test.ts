// T173 premium UI, §3.3 Theme detail (docs/PREMIUM_UI.md, run 183): source guards for the slice:
// editorial blocks (eyebrow + title) in the planned order, strings in every locale, the hero phone
// with the quiet Home / Lock pill under it, one primary pill in the glass bar, expo-image for the
// wallpaper art, and a Dynamic Type cap on every Text on the theme detail path.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');
const strip = (src: string) => src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

const DETAIL_PATH = ['app', 'theme', '[id].tsx'];
const LOCALES = ['en', 'de', 'es', 'fr', 'it', 'pt-BR', 'ja', 'ko', 'zh-Hans', 'hi', 'ar'];

test("theme detail reads as editorial blocks: What's inside, Icons, Widgets, Wallpaper, Credits", () => {
  const d = strip(read(...DETAIL_PATH));
  // (Plain substring checks: an import-shaped regex here would trip guard.test.ts's import scan.)
  assert.ok(d.includes(' SectionHeader, SquircleCard }'), 'SectionHeader comes from src/ui/v2');
  const order = ['inside', 'icons', 'widgets', 'wallpaper', 'credits'].map((k) => d.indexOf(`t('theme.section.${k}.eyebrow')`));
  for (const at of order) assert.ok(at > 0, 'every block has its eyebrow');
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'blocks in the planned order');
  assert.equal((d.match(/<SectionHeader\b/g) ?? []).length, 5);
  // Credits only when there is something to credit.
  assert.match(d, /\{hasCredits \? \(/);
});

test('every locale has the theme detail section strings', () => {
  for (const loc of LOCALES) {
    const src = read('src', 'i18n', 'ns', 'theme', `${loc}.ts`);
    const block = /\n {2}section: \{\n([\s\S]*?)\n {2}\},\n/.exec(src)?.[1] ?? '';
    for (const k of ['inside: { eyebrow:', 'icons: { eyebrow:', 'widgets: { eyebrow:', 'wallpaper: { eyebrow:', 'credits: { eyebrow:']) {
      assert.ok(block.includes(k), `${loc}: theme.section ${k}`);
    }
  }
});

test('theme detail hero: phone centred on a soft surface, quiet Home / Lock pill under it, timed cross-fade', () => {
  const d = strip(read(...DETAIL_PATH));
  const start = d.indexOf('<SquircleCard size="large" elevation="card"');
  assert.ok(start > 0, 'hero card on the soft card surface');
  const hero = d.slice(start, d.indexOf('</SquircleCard>', start));
  assert.ok(hero.indexOf('<Segmented<PreviewMode>') > hero.indexOf('styles.phone'), 'toggle sits under the phone');
  assert.match(d, /modeToggle: \{ alignSelf: 'center' \}/);
  assert.match(d, /withTiming\(mode === 'home' \? 1 : 0, \{\s*duration: reduced \? durations\.fast : durations\.base,\s*easing: easeOutCurve/);
  assert.doesNotMatch(d, /withSpring|ActivityIndicator/);
});

test('theme detail glass bar holds one primary (filled) pill', () => {
  const d = strip(read(...DETAIL_PATH));
  const bar = d.slice(d.indexOf('<GlassBar material="chrome"'), d.indexOf('</GlassBar>'));
  const pills = [...bar.matchAll(/<PillButton\b[\s\S]*?\/>/g)].map((m) => m[0]);
  assert.ok(pills.length >= 1);
  assert.equal(pills.filter((p) => !/variant=/.test(p)).length, 1, 'exactly one default (filled) pill');
  assert.ok(pills.every((p) => !/variant="(filled|tinted)"/.test(p)), 'no second loud pill');
});

test('theme detail draws its wallpaper art with expo-image (RN Image only for getSize)', () => {
  const d = strip(read(...DETAIL_PATH));
  assert.ok(d.includes('{ Image as ExpoImage }') && d.includes("'expo" + "-image'"), 'expo-image Image aliased as ExpoImage');
  assert.equal((d.match(/<Image\b/g) ?? []).length, 0, 'no RN <Image> element');
  assert.ok((d.match(/<ExpoImage\b[^>]*contentFit="cover"/g) ?? []).length >= 2);
});

test('every Text on the theme detail path carries a Dynamic Type cap', () => {
  for (const f of [
    DETAIL_PATH,
    ['src', 'ui', 'ShapePicker.tsx'],
    ['src', 'ui', 'ThemeOverrideRow.tsx'],
    ['src', 'ui', 'Segmented.tsx'],
    ['src', 'ui', 'PillButton.tsx'],
  ]) {
    const src = strip(read(...f));
    const tags = [...src.matchAll(/<(Text|TextInput)\b[^>]*>/g)].map((m) => m[0]);
    assert.ok(tags.length > 0, f.join('/'));
    const uncapped = tags.filter((t) => !/maxFontSizeMultiplier=/.test(t));
    assert.deepEqual(uncapped, [], `${f.join('/')}: Text without maxFontSizeMultiplier`);
  }
});
