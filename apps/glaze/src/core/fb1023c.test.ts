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
const rendered = tab.slice(tab.indexOf('<LargeTitleScrollView'));

test('size sub-tabs draw a SizeArt picture above the label, keeping role, label and touch size', () => {
  const sizes = rendered.slice(rendered.indexOf('WIDGET_TAB_SIZES.map'), rendered.indexOf('lockNote'));
  assert.match(sizes, /<SizeArt size=\{s\} stroke=\{on \? c\.tint : c\.inkSecondary\}/);
  assert.ok(sizes.indexOf('<SizeArt') < sizes.indexOf('<Text'), 'picture before the label');
  assert.match(sizes, /accessibilityRole="tab"/);
  assert.match(sizes, /accessibilityLabel=\{name\}/);
  assert.match(tab, /sizeTab: \{\s*flex: 1,\s*minHeight: sizeV2\.touch/);
});

test('look chips draw the look swatch next to the label', () => {
  const looks = rendered.slice(rendered.indexOf('looks.map'), rendered.indexOf('WIDGET_TAB_SIZES.map'));
  assert.match(tab, /lookSwatches[^\n]*useMemo\(\(\) => new Map\(looks\.map\(\(l\) => \[l, lookSwatch\(l, set\.tokens\)\]\)\)/);
  assert.match(looks, /<SwatchArt swatch=\{swatch\}/);
  assert.match(looks, /accessibilityLabel=\{name\}/);
  assert.ok(looks.indexOf('<SwatchArt') < looks.indexOf('<Text'));
});

test('theme chips draw a theme swatch instead of the plain dot', () => {
  const themes = rendered.slice(rendered.indexOf('themes.map'), rendered.indexOf('looks.map'));
  assert.match(themes, /<SwatchArt swatch=\{themeSwatch\(x\.palette\)\}/);
  assert.match(themes, /accessibilityLabel=\{x\.name\}/);
  assert.match(themes, /\{x\.name\}\s*<\/Text>/);
  assert.doesNotMatch(tab, /styles\.dot/);
  assert.match(tab, /chip: \{\s*minHeight: sizeV2\.touch/);
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
