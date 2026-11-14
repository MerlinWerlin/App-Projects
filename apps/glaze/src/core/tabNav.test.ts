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

test('size sub-tabs: Small / Medium / Large / Lock', () => {
  assert.deepEqual([...WIDGET_TAB_SIZES], ['small', 'medium', 'large', 'lock']);
  assert.equal(widgetTabSizeKey('small'), 'widgets.size.small');
  assert.equal(widgetTabSizeKey('lock'), 'tabs.widgetsTab.lock');
  assert.ok(isWidgetTabSize('lock'));
  assert.ok(!isWidgetTabSize('standby'));
});

const STUDIO = studioKinds(generateWidgetSet(THEMES[0]));

// 1.0.34 (owner 2026-11-14): the tab lists the theme's artwork (My widget art) and the clocks only.
test('home sizes list the clocks only: the theme clock first, then the analog clock where it comes in that size', () => {
  const expected: Record<'small' | 'medium' | 'large', string[]> = {
    small: ['set-clock-small', 'cat-analogClock-small'],
    medium: ['set-clock-medium'],
    large: ['set-clock-large', 'cat-analogClock-large'],
  };
  for (const size of ['small', 'medium', 'large'] as const) {
    const cards = widgetTabCards(size, STUDIO);
    assert.deepEqual(cards.map((c) => c.id), expected[size]);
    assert.ok(cards.every((c) => (c.source === 'set' ? (WIDGET_TAB_SET_KINDS as readonly string[]) : (WIDGET_TAB_CATALOGUE_KINDS as readonly string[])).includes(c.kind)));
    const set = cards.filter((c) => c.source === 'set');
    assert.ok(set.every((c) => c.studio && c.size === size));
    for (const c of cards.filter((x) => x.source === 'catalogue')) {
      assert.equal(c.nameKey, catalogueKindKey(c.kind as CatalogueKind));
      assert.equal(c.sizeKey, catalogueSizeKey(c.size as CatalogueSize));
      assert.ok(CATALOGUE_KIND_SIZES[c.kind as CatalogueKind].includes(c.size as CatalogueSize));
    }
  }
  // Nothing decorative: no date / photo / quote / battery set cards, no habits, progress, calendars or albums.
  const all = (['small', 'medium', 'large', 'lock'] as const).flatMap((s) => widgetTabCards(s, STUDIO));
  assert.ok(all.every((c) => c.kind === 'clock' || c.kind === 'analogClock'));
  assert.ok(WIDGET_KINDS.length > WIDGET_TAB_SET_KINDS.length && CATALOGUE_KINDS.length > WIDGET_TAB_CATALOGUE_KINDS.length);
});

test('Lock sub-tab: only the analog clock, which the extension really offers on the Lock Screen', () => {
  const cards = widgetTabCards('lock', STUDIO);
  assert.deepEqual(cards.map((c) => c.id), ['cat-analogClock-accessoryCircular']);
  for (const c of cards) {
    assert.ok((ACCESSORY_SIZES as readonly string[]).includes(c.size), c.id);
    assert.equal(widgetStudioHref('x', c), null);
  }
});

test('a clock catalogue card becomes a Studio link once the Studio lists it', () => {
  const cards = widgetTabCards('small', [...STUDIO, 'analogClock']);
  const ac = cards.find((c) => c.kind === 'analogClock')!;
  assert.equal(widgetStudioHref('rose quartz', ac), '/widget-studio?theme=rose%20quartz&kind=analogClock&size=small');
});

test('Studio links carry theme, kind and size', () => {
  const clock = widgetTabCards('medium', STUDIO).find((c) => c.kind === 'clock')!;
  assert.equal(widgetStudioHref(THEMES[0].id, clock), `/widget-studio?theme=${encodeURIComponent(THEMES[0].id)}&kind=clock&size=medium`);
});

test('tab copy keys never point at the retired tab-local catalogue names', () => {
  for (const k of tabNavI18nKeys()) assert.ok(!/^tabs\.widgetsTab\.(kind|lockSize)\./.test(k), k);
});
