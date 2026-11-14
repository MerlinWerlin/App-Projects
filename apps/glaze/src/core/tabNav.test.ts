import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { lookup, type CatalogueTree } from './i18n.ts';
import { en } from '../i18n/locales/en.ts';
import { TRANSLATIONS } from '../i18n/locales/index.ts';
import {
  HIDDEN_TAB_ROUTES,
  LIVE_MAKER_HREF,
  TAB_ORDER,
  WIDGET_TAB_SIZES,
  isWidgetTabSize,
  tabLabelKey,
  tabNavI18nKeys,
  widgetStudioHref,
  widgetTabCards,
  WIDGET_TAB_SOON_SIZES,
  WIDGET_TAB_CARD_SIZES,
  type WidgetTabCard,
  WIDGET_TAB_CATALOGUE_KINDS,
  WIDGET_TAB_SET_KINDS,
  widgetTabSizeKey,
} from './tabNav.ts';
import { ACCESSORY_SIZES, CATALOGUE_KINDS, CATALOGUE_KIND_SIZES, catalogueKindKey, catalogueSizeKey, type CatalogueKind, type CatalogueSize } from './widgetKinds.ts';
import { WIDGET_KINDS, generateWidgetSet } from './widgetSets.ts';
import { studioKinds } from './widgetStudio.ts';
import { THEMES } from './themes.ts';

const root = process.cwd();

// owner-1101 #4 (T186) moved Live into Wallpapers; owner-1101d #1 (T198) cut Pets.
test('tab order is Themes / Widgets / Icons / Wallpapers; Settings is hidden', () => {
  assert.deepEqual([...TAB_ORDER], ['themes', 'widgets', 'icons', 'wallpapers']);
  assert.ok(!(TAB_ORDER as readonly string[]).includes('pets'), 'Pets were cut (T198)');
  assert.ok(!(TAB_ORDER as readonly string[]).includes('live'), 'Live is not a tab any more');
  assert.deepEqual([...HIDDEN_TAB_ROUTES], ['settings']);
  assert.equal(tabLabelKey('wallpapers'), 'tabs.wallpapers');
});

test('every tab has a route file, and hidden routes keep theirs (old links still resolve)', () => {
  for (const id of [...TAB_ORDER, ...HIDDEN_TAB_ROUTES]) assert.ok(existsSync(join(root, 'app', '(tabs)', `${id}.tsx`)), id);
  assert.ok(existsSync(join(root, 'app', 'widget-studio.tsx')));
  assert.ok(existsSync(join(root, 'app', 'wallpaper.tsx')));
  // T186: /live (the Live Photo maker) is a stack route; no tab file for Live.
  assert.equal(LIVE_MAKER_HREF, '/live');
  assert.ok(existsSync(join(root, 'app', 'live', 'index.tsx')));
  assert.ok(!existsSync(join(root, 'app', '(tabs)', 'live.tsx')));
});

test('Wallpapers tab opens the Live Photo and collage makers', () => {
  const wallpapers = readFileSync(join(root, 'app', '(tabs)', 'wallpapers.tsx'), 'utf8');
  assert.match(wallpapers, /LIVE_MAKER_HREF/, 'Wallpapers opens the Live Photo maker');
  assert.match(wallpapers, /'\/collage'/, 'Wallpapers keeps the collage maker');
});

test('the tab layout lists the tabs in TAB_ORDER and hides Settings', () => {
  const layout = readFileSync(join(root, 'app', '(tabs)', '_layout.tsx'), 'utf8');
  const order = [...layout.matchAll(/<Tabs\.Screen\s+name="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(order.filter((n) => !(HIDDEN_TAB_ROUTES as readonly string[]).includes(n)), [...TAB_ORDER]);
  assert.match(layout, /name="settings"[^>]*href:\s*null/s);
  assert.match(layout, /<GlassBar\b/);
  const themes = readFileSync(join(root, 'app', '(tabs)', 'themes.tsx'), 'utf8');
  assert.match(themes, /router\.push\('\/settings'\)/);
});

test('tab bar and tab screen copy is in every locale', () => {
  for (const key of tabNavI18nKeys()) {
    assert.equal(typeof lookup(en as unknown as CatalogueTree, key), 'string', `en missing ${key}`);
    for (const [locale, cat] of Object.entries(TRANSLATIONS)) {
      assert.equal(typeof lookup(cat as CatalogueTree, key), 'string', `${locale} missing ${key}`);
    }
  }
});

// 1.0.35 (owner 2026-11-14: "a lock screen one is something that we'll do. This needs to go for now... under medium and
// large, just say coming soon"): Small / Medium / Large only; no size lists cards yet (Small is My widget art).
test('size sub-tabs: Small / Medium / Large (no Lock Screen tab)', () => {
  assert.deepEqual([...WIDGET_TAB_SIZES], ['small', 'medium', 'large']);
  assert.deepEqual([...WIDGET_TAB_SOON_SIZES], ['medium', 'large']);
  assert.equal(widgetTabSizeKey('small'), 'widgets.size.small');
  assert.ok(!isWidgetTabSize('lock'));
  assert.ok(!isWidgetTabSize('standby'));
});

const STUDIO = studioKinds(generateWidgetSet(THEMES[0]));

test('no size lists widget cards in 1.0.35: Small is the artwork, Medium / Large say Coming soon', () => {
  assert.deepEqual([...WIDGET_TAB_CARD_SIZES], []);
  for (const size of ['small', 'medium', 'large', 'lock'] as const) assert.deepEqual(widgetTabCards(size, STUDIO), [], size);
  // The clock rules stay for later (docs/FUTURE.md).
  assert.deepEqual([...WIDGET_TAB_SET_KINDS], ['clock']);
  assert.deepEqual([...WIDGET_TAB_CATALOGUE_KINDS], ['analogClock']);
});

test('Studio links carry theme, kind and size', () => {
  const clock: WidgetTabCard = { source: 'set', id: 'set-clock-medium', kind: 'clock', size: 'medium', studio: true, nameKey: 'k', sizeKey: 's' };
  assert.equal(widgetStudioHref(THEMES[0].id, clock), `/widget-studio?theme=${encodeURIComponent(THEMES[0].id)}&kind=clock&size=medium`);
  assert.equal(widgetStudioHref('x', { ...clock, studio: false }), null);
});

test('tab copy keys never point at the retired tab-local catalogue names', () => {
  for (const k of tabNavI18nKeys()) assert.ok(!/^tabs\.widgetsTab\.(kind|lockSize)\./.test(k), k);
});
