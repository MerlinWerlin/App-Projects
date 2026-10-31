// T176 premium UI, Icons tab slice (docs/PREMIUM_UI.md §3.8): source guards for app/(tabs)/icons.tsx.
// Editorial SectionHeaders for Your apps / Add apps / Style (strings in every locale), editorial
// group titles on the inset groups, the 16-pt card rhythm, cards lifted by surface (no hairline) in
// dark mode, a skeleton (never a spinner) while the studio loads, Dynamic Type caps on every Text /
// TextInput, no spring, still one virtualised list (T166), and still free (no Plus import).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');
const strip = (src: string) => src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

const LOCALES = ['en', 'de', 'es', 'fr', 'it', 'pt-BR', 'ja', 'ko', 'zh-Hans', 'hi', 'ar'];
const TAB = ['app', '(tabs)', 'icons.tsx'];
const SECTION_KEYS = ['previewEyebrow', 'appsEyebrow', 'appsBody', 'addEyebrow', 'addBody', 'styleEyebrow', 'styleBody'];

test('Icons tab: editorial SectionHeaders for Your apps, Add apps and Style, in that order', () => {
  const tab = strip(read(...TAB));
  assert.doesNotMatch(tab, /\bSectionTitle\b/, 'the old bare title3 heading is gone');
  const headers = [...tab.matchAll(/<SectionHeader\b[\s\S]*?\/>/g)].map((m) => m[0]);
  assert.equal(headers.length, 3);
  const want = [
    ['icons.sections.appsEyebrow', 'icons.yourApps', 'icons.sections.appsBody'],
    ['icons.sections.addEyebrow', 'icons.addApps', 'icons.sections.addBody'],
    ['icons.sections.styleEyebrow', 'icons.styleTitle', 'icons.sections.styleBody'],
  ];
  headers.forEach((h, i) => {
    const [eyebrow, title, body] = want[i];
    assert.ok(h.includes(`eyebrow={t('${eyebrow}')}`), `${title}: eyebrow`);
    assert.ok(h.includes(`title={t('${title}')}`), `${title}: title`);
    assert.ok(h.includes(`body={t('${body}')}`), `${title}: body`);
    assert.match(h, /style=\{styles\.sectionHeader\}/);
  });
  // The preview card carries a quiet eyebrow, read as a heading.
  assert.match(tab, /accessibilityRole="header"[\s\S]{0,400}t\('icons\.sections\.previewEyebrow'\)/);
});

test('Icons tab: inset groups use editorial group titles, not the small grey header', () => {
  const tab = strip(read(...TAB));
  assert.doesNotMatch(tab, /<InsetGroup\b[^>]*\bheader=/);
  for (const k of ['customTitle', 'shape', 'background', 'symbolColour', 'symbolSize']) {
    assert.match(tab, new RegExp(`<InsetGroup title=\\{t\\('icons\\.${k}'\\)\\}`), k);
  }
});

test('Icons tab: 16-pt card rhythm and the editorial 32 / 12 pt section spacing from tokens', () => {
  const tab = strip(read(...TAB));
  assert.match(tab, /listHeader: \{ gap: editorialV2\.cardGap, paddingBottom: editorialV2\.cardGap \}/);
  assert.match(tab, /listFooter: \{ gap: editorialV2\.cardGap, paddingTop: editorialV2\.cardGap \}/);
  assert.match(tab, /paddingTop: editorialV2\.sectionTop - editorialV2\.cardGap,/);
  assert.match(tab, /marginBottom: editorialV2\.sectionBottom - editorialV2\.cardGap,/);
});

test('Icons tab: cards lift by surface in dark mode, never by a hairline', () => {
  const tab = strip(read(...TAB));
  assert.match(tab, /const cardTone = scheme === 'dark' \? 'raised' : 'surface';/);
  const cards = [...tab.matchAll(/<SquircleCard\b[^>]*>/g)].map((m) => m[0]);
  assert.ok(cards.length >= 4, 'loading, preview, warning and empty cards');
  for (const card of cards) assert.match(card, /outline=\{false\}/, card);
  for (const card of cards.filter((c) => !/tone="butter"/.test(c))) assert.match(card, /tone=\{cardTone\}/, card);
  assert.match(tab, /backgroundColor: active \? c\.tint : chipSurface/);
});

test('Icons tab: a skeleton of the screen while loading, no spinners, no spring', () => {
  const tab = strip(read(...TAB));
  const loading = tab.slice(tab.indexOf('if (!state) {'), tab.indexOf('const style = state.style;'));
  assert.match(loading, /<Skeleton\b/);
  assert.match(loading, /<IconGridSkeleton\b/);
  assert.match(loading, /<SquircleCard\b/, 'in the preview card shape');
  assert.doesNotMatch(tab, /ActivityIndicator/);
  assert.doesNotMatch(tab, /\bwithSpring\b|\.springify\(|\bBounceIn\b|Easing\.bounce|Easing\.elastic|damping:/);
});

test('every Text and TextInput on the Icons tab (and its tip / title bar) carries a Dynamic Type cap', () => {
  for (const f of [TAB, ['src', 'ui', 'ContextTip.tsx'], ['src', 'ui', 'LargeTitleHeader.tsx']]) {
    const src = strip(read(...f));
    const tags = [...src.matchAll(/<(Text|TextInput)\b[\s\S]*?(?=\/?>)/g)].map((m) => m[0]);
    assert.ok(tags.length > 0, f.join('/'));
    const uncapped = tags.filter((t) => !/maxFontSizeMultiplier=/.test(t));
    assert.deepEqual(uncapped, [], `${f.join('/')}: Text without maxFontSizeMultiplier`);
  }
  assert.ok((strip(read(...TAB)).match(/<(?:Text|TextInput)\b/g) ?? []).length >= 15);
});

test('Icons tab: still one virtualised list, and make-your-own icons stay free', () => {
  const tab = strip(read(...TAB));
  assert.match(tab, /<Animated\.FlatList\b/);
  assert.match(tab, /\{\.\.\.LIST_WINDOW\}/);
  assert.doesNotMatch(tab, /src\/plus\b|\.\.\/plus\//, 'no Plus import on the Icons tab');
  assert.doesNotMatch(tab, /<Plus\w*\b/);
});

test('every locale has the Icons tab section strings', () => {
  for (const loc of LOCALES) {
    const src = read('src', 'i18n', 'ns', 'icons', `${loc}.ts`);
    const at = src.indexOf('  sections: {');
    assert.ok(at >= 0, `${loc}: icons.sections`);
    const body = src.slice(at, src.indexOf('\n  },', at));
    for (const k of SECTION_KEYS) {
      const line = body.split('\n').find((l) => l.startsWith(`    ${k}: `));
      assert.ok(line, `${loc}: icons.sections.${k}`);
      assert.match(line, /: (['"]).+\1,$/, `${loc}: ${k} is a non-empty string`);
    }
  }
});
