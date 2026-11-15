// fb-1023 C (owner, 23 Oct): the Widgets tab's option rows show small pictures, not text alone.
// Source checks that the pictures are wired in, labels and accessibility stay, and no springy
// motion was added (owner fb-1022c).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const root = process.cwd();
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');
const tab = read('app', '(tabs)', 'widgets.tsx');
const art = read('src', 'ui', 'WidgetOptionArt.tsx');
const core = read('src', 'core', 'widgetOptionArt.ts');

/** The JSX the tab renders. */
// T162: the controls are the list header (`const header = (`); the grid rows are a FlatList below it.
const rendered = tab.slice(tab.indexOf('const header = ('));

// 1.0.37 (owner 2026-11-15): the size sub-tabs are gone (the tab is Small only), so no size pictures either.
test('1.0.37: the Widgets tab has no size sub-tabs', () => {
  assert.doesNotMatch(rendered, /<SizeArt|accessibilityRole="tab"/);
  assert.doesNotMatch(tab, /sizeTab: \{/);
});

// 1.0.34 (owner 2026-11-14): the theme and look chip rows are gone from the Widgets tab (they only recoloured
// these previews); the tab shows the theme in use. The size tabs keep their pictures (above).
test('1.0.34: no theme or look chips on the Widgets tab', () => {
  assert.doesNotMatch(rendered, /themes\.map|looks\.map|<SwatchArt/);
  assert.doesNotMatch(tab, /styles\.dot|styles\.chip\b/);
});

test('the pictures are decorative (hidden from screen readers), RTL safe and drawn with plain Views', () => {
  assert.match(art, /accessibilityElementsHidden: true/);
  assert.match(art, /importantForAccessibility: 'no-hide-descendants'/);
  assert.match(art, /start: r\.x/);
  assert.doesNotMatch(art, /\b(left|right)\s*:/);
  assert.doesNotMatch(art, /react-native-svg/);
  assert.doesNotMatch(core, /from '(react|expo)/);
});

test('no new springy motion on the tab or in the pictures (owner fb-1022c)', () => {
  for (const src of [tab, art]) {
    assert.doesNotMatch(src, /withSpring|springify|ZoomIn|BounceIn|LinearTransition|layout=\{|scale\s*:/);
    assert.doesNotMatch(src, /react-native-reanimated|Animated\./);
  }
});

test('no competitor or brand names in the new art', () => {
  for (const src of [art, core]) {
    assert.doesNotMatch(src, /Themify|Icon Themer|MyScreen|ScreenKit|Widgetsmith|intoLive|Loopy|Lockio/i);
  }
});
