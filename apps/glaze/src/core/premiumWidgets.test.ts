// T173 premium UI, Widgets slice (docs/PREMIUM_UI.md §3.4): family sections on the Widgets tab
// (src/core/widgetFamilies.ts), and source guards for the tab and Widget Studio: editorial headers,
// 16-pt rhythm, skeletons not spinners, no hairline cards, Dynamic Type caps, strings in every locale.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import * as tabsNs from '../i18n/ns/tabs/index.ts';
import { THEMES } from './themes.ts';
import { WIDGET_TAB_SIZES, widgetTabCards } from './tabNav.ts';
import { WIDGET_FAMILIES, familyRows, widgetFamilyKeys, widgetFamilyOf } from './widgetFamilies.ts';
import { generateWidgetSet } from './widgetSets.ts';
import { catalogueStudioKinds, studioKinds } from './widgetStudio.ts';

const root = process.cwd();
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');
const strip = (src: string) => src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

const EDITABLE = [...studioKinds(generateWidgetSet(THEMES[0])), ...catalogueStudioKinds()];

test('families: theme set, everyday catalogue kinds, habit trackers', () => {
  assert.deepEqual([...WIDGET_FAMILIES], ['theme', 'everyday', 'habits']);
  assert.equal(widgetFamilyOf({ source: 'set', kind: 'clock' }), 'theme');
  assert.equal(widgetFamilyOf({ source: 'catalogue', kind: 'analogClock' }), 'everyday');
  assert.equal(widgetFamilyOf({ source: 'catalogue', kind: 'photoAlbum' }), 'everyday');
  for (const k of ['habitWater', 'habitMood', 'habitSleep', 'habitSteps']) assert.equal(widgetFamilyOf({ source: 'catalogue', kind: k }), 'habits');
});

test('familyRows keeps every card once, in order, never mixes families in a row, one header per family', () => {
  for (const size of WIDGET_TAB_SIZES) {
    const cards = widgetTabCards(size, EDITABLE);
    const rows = familyRows(cards, 2);
    assert.deepEqual(rows.flatMap((r) => r.cards).map((c) => c.id), cards.map((c) => c.id), `${size}: same cards, same order`);
    for (const r of rows) {
      assert.ok(r.cards.length >= 1 && r.cards.length <= 2);
      assert.ok(r.cards.every((c) => widgetFamilyOf(c) === r.family), `${size}: row ${r.key} is one family`);
    }
    const firsts = rows.filter((r) => r.first).map((r) => r.family);
    assert.deepEqual(firsts, [...new Set(rows.map((r) => r.family))], `${size}: one header per family, at its first row`);
    assert.equal(new Set(rows.map((r) => r.key)).size, rows.length, `${size}: stable unique keys`);
  }
  // Home sizes open with the theme's own set; the Lock tab has no theme set.
  assert.equal(familyRows(widgetTabCards('small', EDITABLE))[0].family, 'theme');
  assert.ok(!familyRows(widgetTabCards('lock', EDITABLE)).some((r) => r.family === 'theme'));
  assert.deepEqual(familyRows([]), []);
});

test('every locale has the family headers and the Studio preview eyebrow', () => {
  const locales = Object.entries(tabsNs) as [string, { widgetsTab?: Record<string, unknown> }][];
  assert.equal(locales.length, 11);
  for (const [loc, msgs] of locales) {
    const wt = msgs.widgetsTab ?? {};
    const fam = (wt.families ?? {}) as Record<string, Record<string, string>>;
    assert.ok(wt.families, `${loc}: widgetsTab.families`);
    for (const f of WIDGET_FAMILIES) {
      const keys = widgetFamilyKeys(f);
      for (const part of ['eyebrow', 'title', 'body'] as const) {
        assert.ok(keys[part].endsWith(`families.${f}.${part}`));
        assert.ok(typeof fam[f]?.[part] === 'string' && fam[f][part].length > 0, `${loc}: families.${f}.${part}`);
      }
    }
    assert.ok(typeof wt.studioPreview === 'string' && (wt.studioPreview as string).length > 0, `${loc}: studioPreview`);
  }
});

test('Widgets tab: editorial family headers, 16-pt rhythm, skeleton waits, lifted cards, no spinners', () => {
  const tab = strip(read('app', '(tabs)', 'widgets.tsx'));
  assert.match(tab, /<SectionHeader\b/);
  assert.match(tab, /widgetFamilyKeys\(family\)/);
  assert.match(tab, /const GAP = editorialV2\.cardGap;/);
  assert.match(tab, /<Skeleton\b/);
  assert.match(tab, /const sampling = wallpaper\.probe !== null;/);
  assert.match(tab, /outline=\{false\}/);
  assert.match(tab, /tone=\{scheme === 'dark' \? 'raised' : 'surface'\}/);
  // T166's ~16 pt spacer above the first grid row stays; the first section header is flush under it.
  assert.match(tab, /gridTop: \{ height: spaceV2\.lg \}/);
  assert.match(tab, /flushTop=\{firstSection\}/);
  for (const f of [['app', '(tabs)', 'widgets.tsx'], ['app', 'widget-studio.tsx']]) {
    const src = strip(read(...f));
    assert.doesNotMatch(src, /ActivityIndicator/, f.join('/'));
    assert.doesNotMatch(src, /\bwithSpring\b|\.springify\(|\bBounceIn\b/, f.join('/'));
  }
});

test('Widget Studio: preview on a raised surface without a hairline, eyebrow heading, controls in inset groups', () => {
  const studio = strip(read('app', 'widget-studio.tsx'));
  assert.match(studio, /<SquircleCard size="large" elevation="raised" tone="raised" outline=\{false\}/);
  assert.match(studio, /t\('tabs\.widgetsTab\.studioPreview'\)/);
  assert.match(studio, /accessibilityRole="header"/);
  assert.ok((studio.match(/<InsetGroup\b/g) ?? []).length >= 6, 'controls are inset groups');
  const card = strip(read('src', 'ui', 'SquircleCard.tsx'));
  assert.match(card, /scheme === 'dark' && outline \?/);
});

test('every Text and TextInput on the Widgets tab and in Widget Studio carries a Dynamic Type cap', () => {
  for (const f of [['app', '(tabs)', 'widgets.tsx'], ['app', 'widget-studio.tsx']]) {
    const src = strip(read(...f));
    const tags = [...src.matchAll(/<(Text|TextInput)\b[\s\S]*?(?=\/?>)/g)].map((m) => m[0]);
    assert.ok(tags.length > 5, f.join('/'));
    const uncapped = tags.filter((t) => !/maxFontSizeMultiplier=/.test(t.slice(0, 200)));
    assert.deepEqual(uncapped, [], `${f.join('/')}: Text without maxFontSizeMultiplier`);
  }
});
