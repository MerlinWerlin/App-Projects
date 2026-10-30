// T173 premium UI (docs/PREMIUM_UI.md): token additions (eyebrow role, Dynamic Type caps, editorial
// rhythm) and source guards for the first slice (onboarding's first screen + Themes browse): calm
// timed skeletons instead of spinners, editorial section headers, caps on text size, still one
// virtualised list.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { editorialV2, eyebrowCaseFor, fontScaleCap, fontScaleCapV2, spaceV2, typeV2 } from './designV2.ts';

const root = process.cwd();
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');
const strip = (src: string) => src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

test('every type role has a Dynamic Type cap between 1.2 and 2; titles grow less than reading text', () => {
  assert.deepEqual(Object.keys(fontScaleCapV2).sort(), Object.keys(typeV2).sort());
  for (const [k, v] of Object.entries(fontScaleCapV2)) assert.ok(v >= 1.2 && v <= 2, `${k} cap ${v}`);
  assert.ok(fontScaleCap('largeTitle') < fontScaleCap('title2'));
  assert.ok(fontScaleCap('title2') < fontScaleCap('body'));
  assert.equal(fontScaleCap('footnote'), 2);
});

test('eyebrow role sits at footnote size, semibold; upper-case and tracked only in Latin', () => {
  assert.equal(typeV2.eyebrow.fontSize, typeV2.footnote.fontSize);
  assert.equal(typeV2.eyebrow.fontWeight, '600');
  assert.deepEqual(eyebrowCaseFor('latin'), { upper: true, letterSpacing: typeV2.eyebrow.letterSpacing });
  for (const s of ['cjk', 'arabic', 'devanagari']) assert.deepEqual(eyebrowCaseFor(s), { upper: false, letterSpacing: 0 });
});

test('editorial rhythm is on the 4-pt grid and made of spacing steps', () => {
  const steps = new Set<number>(Object.values(spaceV2));
  for (const [k, v] of Object.entries(editorialV2)) {
    assert.equal(v % 4, 0, `${k} on the 4-pt grid`);
    assert.ok(steps.has(v), `${k} = ${v} is a spaceV2 step`);
  }
  assert.ok(editorialV2.sectionTop > editorialV2.sectionBottom, 'more room above a section than below its title');
});

test('Skeleton is a calm timed opacity pulse that stops under reduce motion (no spring, no sweep)', () => {
  const src = strip(read('src', 'ui', 'Skeleton.tsx'));
  assert.match(src, /useMotionReduced\(\)/);
  assert.match(src, /withRepeat\(withTiming\(/);
  assert.match(src, /opacity: o\.value/);
  assert.doesNotMatch(src, /withSpring|translateX|react-native-svg/);
  assert.match(src, /if \(reduced\) \{[\s\S]*?cancelAnimation\(o\)/);
});

test('onboarding first screen and Themes browse show no spinners', () => {
  for (const f of [['app', 'index.tsx'], ['app', '(tabs)', 'themes.tsx'], ['src', 'ui', 'ShowcaseGrid.tsx'], ['src', 'ui', 'ThemeCard.tsx'], ['src', 'ui', 'LanguageHintLine.tsx']]) {
    assert.doesNotMatch(read(...f), /ActivityIndicator/, f.join('/'));
  }
  assert.match(read('src', 'ui', 'ShowcaseGrid.tsx'), /<Skeleton\b/, 'showcase placeholders are skeletons');
});

test('Themes browse uses editorial section headers with eyebrows from i18n', () => {
  const themes = strip(read('app', '(tabs)', 'themes.tsx'));
  assert.match(themes, /<SectionHeader\b/);
  for (const k of ['starters', 'art', 'space', 'plus']) assert.match(themes, new RegExp(`t\\('themes\\.eyebrow\\.${k}'\\)`));
  const header = strip(read('src', 'ui', 'SectionHeader.tsx'));
  assert.match(header, /accessibilityRole="header"/);
  assert.match(header, /eyebrowCaseFor\(script\)/);
});

test('every Text on the Themes browse path and the first screen carries a Dynamic Type cap', () => {
  for (const f of [
    ['app', '(tabs)', 'themes.tsx'],
    ['src', 'ui', 'ThemeCard.tsx'],
    ['src', 'ui', 'ShowcaseGrid.tsx'],
    ['src', 'ui', 'SectionHeader.tsx'],
    ['src', 'ui', 'LanguageHintLine.tsx'],
  ]) {
    const src = strip(read(...f));
    const tags = [...src.matchAll(/<(Text|TextInput)\b[^>]*>/g)].map((m) => m[0]);
    assert.ok(tags.length > 0, f.join('/'));
    // A nested inline <Text> inherits its parent's cap (LanguageHintLine's "Change").
    const uncapped = tags.filter((t) => !/maxFontSizeMultiplier=/.test(t) && !/styles\.change/.test(t));
    assert.deepEqual(uncapped, [], `${f.join('/')}: Text without maxFontSizeMultiplier`);
  }
});

test('PREMIUM_UI.md has the plan, the rules and a progress table', () => {
  const p = join(root, 'docs', 'PREMIUM_UI.md');
  assert.ok(existsSync(p));
  const doc = read('docs', 'PREMIUM_UI.md');
  for (const s of ['Onboarding', 'Themes browse', 'Theme detail', 'Widgets', 'Install', 'Plus sheet', 'Settings']) assert.match(doc, new RegExp(s));
  assert.match(doc, /\| Screen \| Status \| Run \|/);
  assert.match(doc, /no spring/i);
});
