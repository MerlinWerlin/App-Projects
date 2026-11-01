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

test('home sizes: the 5 theme-set kinds first, all editable in the Studio, then catalogue kinds of that size', () => {
  for (const size of ['small', 'medium', 'large'] as const) {
    const cards = widgetTabCards(size, STUDIO);
    const set = cards.filter((c) => c.source === 'set');
    assert.deepEqual(set.map((c) => c.kind), [...WIDGET_KINDS]);
    assert.ok(set.every((c) => c.studio && c.size === size));
    assert.deepEqual(cards.slice(0, set.length), set, 'set cards come first');
    const cat = cards.filter((c) => c.source === 'catalogue');
    assert.deepEqual(cat.map((c) => c.kind), CATALOGUE_KINDS.filter((k) => CATALOGUE_KIND_SIZES[k].includes(size)));
    // The Studio edits only the theme-set kinds today: catalogue cards are honest "coming soon".
    assert.ok(cat.every((c) => !c.studio && widgetStudioHref('x', c) === null));
    // Catalogue cards use the catalogue's own keys, not tab-local copies.
    for (const c of cat) {
      assert.equal(c.nameKey, catalogueKindKey(c.kind as CatalogueKind));
      assert.equal(c.sizeKey, catalogueSizeKey(c.size as CatalogueSize));
    }
    assert.equal(new Set(cards.map((c) => c.id)).size, cards.length);
  }
});

test('Lock sub-tab lists accessory sizes only, never a fake Studio link', () => {
  const cards = widgetTabCards('lock', STUDIO);
  assert.ok(cards.length > 0);
  for (const c of cards) {
    assert.equal(c.source, 'catalogue');
    assert.ok((ACCESSORY_SIZES as readonly string[]).includes(c.size), c.id);
    assert.equal(c.sizeKey, catalogueSizeKey(c.size));
    assert.equal(c.nameKey, catalogueKindKey(c.kind as CatalogueKind));
    assert.equal(widgetStudioHref('x', c), null);
  }
  const expected = CATALOGUE_KINDS.flatMap((k) => ACCESSORY_SIZES.filter((s) => CATALOGUE_KIND_SIZES[k].includes(s)).map((s) => `cat-${k}-${s}`));
  assert.deepEqual(cards.map((c) => c.id), expected);
});

test('a catalogue kind becomes a Studio link once the Studio lists it', () => {
  const cards = widgetTabCards('small', [...STUDIO, 'countdown']);
  const cd = cards.find((c) => c.kind === 'countdown')!;
  assert.equal(widgetStudioHref('rose quartz', cd), '/widget-studio?theme=rose%20quartz&kind=countdown&size=small');
});

test('Studio links carry theme, kind and size', () => {
  const clock = widgetTabCards('medium', STUDIO).find((c) => c.kind === 'clock')!;
  assert.equal(widgetStudioHref(THEMES[0].id, clock), `/widget-studio?theme=${encodeURIComponent(THEMES[0].id)}&kind=clock&size=medium`);
});

test('tab copy keys never point at the retired tab-local catalogue names', () => {
  for (const k of tabNavI18nKeys()) assert.ok(!/^tabs\.widgetsTab\.(kind|lockSize)\./.test(k), k);
});
