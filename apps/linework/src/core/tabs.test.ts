// T81: bottom tab bar definition and its wiring in the router files.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STACK_ROUTES, TABS, TAB_BAR_HEIGHT, keyboardEvents, sceneBottomPad, tabFor } from './tabs.ts';
import { CATALOGS } from '../i18n/catalogs.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');

test('four tabs in order: Trace (Home), Templates, My drawings, Settings', () => {
  assert.deepEqual(
    TABS.map((t) => t.route),
    ['index', 'templates', 'drawings', 'settings'],
  );
  assert.deepEqual(
    TABS.map((t) => t.icon),
    ['edit-3', 'grid', 'image', 'settings'],
  );
  assert.equal(tabFor('templates')?.label, 'common.nav.templates');
  assert.equal(tabFor('trace'), undefined);
  assert.ok(TAB_BAR_HEIGHT >= 44);
});

test('every tab label is in every catalogue', () => {
  for (const [code, cat] of Object.entries(CATALOGS)) {
    for (const t of TABS) {
      const m = cat[t.label];
      assert.ok(typeof m === 'string' && m.trim().length > 0, `${code} ${t.label}`);
    }
  }
});

test('tab screens live in app/(tabs) and are registered in the tab layout', () => {
  const layout = read('app', '(tabs)', '_layout.tsx');
  assert.match(layout, /from 'expo-router'/);
  assert.match(layout, /<Tabs\b/);
  assert.match(layout, /TabBarV2/);
  for (const t of TABS) {
    assert.ok(existsSync(join(root, 'app', '(tabs)', `${t.route}.tsx`)), `app/(tabs)/${t.route}.tsx`);
    assert.ok(!existsSync(join(root, 'app', `${t.route}.tsx`)), `app/${t.route}.tsx should have moved into (tabs)`);
    assert.match(layout, new RegExp(`<Tabs\\.Screen name="${t.route}"`), `${t.route} registered`);
  }
});

test('full-screen routes stay on the root Stack over the tab group', () => {
  const rootLayout = read('app', '_layout.tsx');
  assert.match(rootLayout, /<Stack\.Screen name="\(tabs\)" options=\{\{[^}]*headerShown: false/);
  for (const r of STACK_ROUTES) {
    assert.ok(existsSync(join(root, 'app', `${r}.tsx`)), `app/${r}.tsx`);
    assert.match(rootLayout, new RegExp(`<Stack\\.Screen\\s+name="${r}"`), `${r} on the root Stack`);
    assert.equal(tabFor(r), undefined);
  }
  for (const t of TABS) assert.doesNotMatch(rootLayout, new RegExp(`<Stack\\.Screen name="${t.route}"`));
});

test('tab bar: tab role, selected state, label, 44 pt targets, haptics, no physical left/right', () => {
  const src = read('src', 'ui', 'v2', 'TabBarV2.tsx');
  assert.match(src, /accessibilityRole="tab"/);
  assert.match(src, /accessibilityRole="tablist"/);
  assert.match(src, /accessibilityState=\{\{ selected: focused \}\}/);
  assert.match(src, /accessibilityLabel=\{label\}/);
  assert.match(src, /sizeV2\.touch/);
  assert.match(src, /haptic="select"/);
  assert.match(src, /insets\.bottom/);
  assert.match(src, /canPreventDefault: true/);
  assert.doesNotMatch(src, /\b(left|right|marginLeft|marginRight|paddingLeft|paddingRight)\s*:/);
  assert.doesNotMatch(src, /row-reverse/);
});

test('T92: tab screens do not pad for the bottom safe area twice', () => {
  assert.equal(sceneBottomPad(34, true, 32), 32);
  assert.equal(sceneBottomPad(34, false, 32), 66);
  assert.equal(sceneBottomPad(-5, false, 8), 8);
  for (const r of ['index', 'settings'] as const) {
    assert.match(read('app', '(tabs)', `${r}.tsx`), /<ScreenV2\b[^>]*\binTabs\b/, `${r} passes inTabs`);
  }
  assert.match(read('app', '(tabs)', 'templates.tsx'), /sceneBottomPad\(insets\.bottom, true,/);
  assert.match(read('src', 'ui', 'v2', 'ScreenV2.tsx'), /sceneBottomPad\(/);
});

test('T92: the tab bar hides while the keyboard is open; Templates is a tab root (no back chevron)', () => {
  assert.deepEqual(keyboardEvents('ios'), { show: 'keyboardWillShow', hide: 'keyboardWillHide' });
  assert.deepEqual(keyboardEvents('android'), { show: 'keyboardDidShow', hide: 'keyboardDidHide' });
  const bar = read('src', 'ui', 'v2', 'TabBarV2.tsx');
  assert.match(bar, /Keyboard\.addListener\(/);
  assert.match(bar, /keyboardEvents\(Platform\.OS\)/);
  const templates = read('app', '(tabs)', 'templates.tsx');
  assert.doesNotMatch(templates, /onBack=/);
  assert.doesNotMatch(templates, /goBack/);
});
