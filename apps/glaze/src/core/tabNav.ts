// Bottom tab bar and Widgets tab model (T70, docs/MARKET.md "Owner screenshots 18 Oct" L1).
//
// Tab order (owner-1101d #1, T198): Themes / Widgets / Icons / Wallpapers. Pets were cut (parked in
// docs/future/pets-game). Live is no longer
// a tab: the Live Photo maker is a stack screen at /live (app/live/index.tsx), opened from the
// Wallpapers tab. Settings stays a route inside the tab group (so old /settings links still open
// it) but is hidden from the bar and reached from a gear button on Themes.
//
// The Widgets tab shows, for one theme and one size sub-tab (Small / Medium / Large / Lock), the
// theme-matched widgets from widgetSets.ts (real previews, open Widget Studio) followed by the
// catalogue kinds from widgetKinds.ts that come in that size. Catalogue kinds have no in-app
// preview or Studio support yet, so they are listed honestly as "coming soon" unless the Studio
// says it can edit that kind.
//
// Copy is i18n keys only. Catalogue cards use the catalogue's own `widgets.kind.*` / `widgets.size.*`
// keys (widgetKinds.ts catalogueKindKey / catalogueSizeKey).
//
// Pure TS, no React.

import { ACCESSORY_SIZES, CATALOGUE_KINDS, CATALOGUE_KIND_SIZES, catalogueKindKey, catalogueSizeKey, type CatalogueKind, type CatalogueSize } from './widgetKinds.ts';
import { WIDGET_KINDS, widgetKindKey, widgetSizeKey, type WidgetKind, type WidgetSize } from './widgetSets.ts';

// ---------------------------------------------------------------------------------- tab bar

export const TAB_ORDER = Object.freeze(['themes', 'widgets', 'icons', 'wallpapers'] as const);
export type TabId = (typeof TAB_ORDER)[number];

/** The Live Photo maker's route (a stack screen since T186, opened from the Wallpapers tab). */
export const LIVE_MAKER_HREF = '/live';

/** Routes in app/(tabs) that stay reachable by link but have no tab bar button. */
export const HIDDEN_TAB_ROUTES = Object.freeze(['settings'] as const);

export const tabLabelKey = (id: TabId): string => `tabs.${id}`;

// ---------------------------------------------------------------------------------- widgets tab

export const WIDGET_TAB_SIZES = Object.freeze(['small', 'medium', 'large', 'lock'] as const);
export type WidgetTabSize = (typeof WIDGET_TAB_SIZES)[number];

export const widgetTabSizeKey = (size: WidgetTabSize): string =>
  size === 'lock' ? 'tabs.widgetsTab.lock' : widgetSizeKey(size);

export function isWidgetTabSize(v: unknown): v is WidgetTabSize {
  return typeof v === 'string' && (WIDGET_TAB_SIZES as readonly string[]).includes(v);
}

export type WidgetTabCard =
  | { source: 'set'; id: string; kind: WidgetKind; size: WidgetSize; studio: boolean; nameKey: string; sizeKey: string }
  | { source: 'catalogue'; id: string; kind: CatalogueKind; size: CatalogueSize; studio: boolean; nameKey: string; sizeKey: string };

/** Name key for a catalogue card (the catalogue's own `widgets.kind.*`). */
export const catalogueTabKindKey = (kind: CatalogueKind): string => catalogueKindKey(kind);

/**
 * Cards for one size sub-tab, in display order: the theme set's kinds first (home sizes only),
 * then catalogue kinds that come in that size. `studioKinds` are the kinds Widget Studio can edit
 * for the chosen theme (widgetStudio.ts `studioKinds`); a card is `studio: true` only if its kind
 * is one of them. The Lock sub-tab lists every accessory size of every catalogue kind.
 */
export function widgetTabCards(size: WidgetTabSize, studioKinds: readonly string[]): WidgetTabCard[] {
  const out: WidgetTabCard[] = [];
  const canEdit = (k: string) => studioKinds.includes(k);
  if (size !== 'lock') {
    for (const kind of WIDGET_KINDS) {
      out.push({ source: 'set', id: `set-${kind}-${size}`, kind, size, studio: canEdit(kind), nameKey: widgetKindKey(kind), sizeKey: widgetSizeKey(size) });
    }
    for (const kind of CATALOGUE_KINDS) {
      if (!CATALOGUE_KIND_SIZES[kind].includes(size)) continue;
      out.push({ source: 'catalogue', id: `cat-${kind}-${size}`, kind, size, studio: canEdit(kind), nameKey: catalogueTabKindKey(kind), sizeKey: catalogueSizeKey(size) });
    }
    return out;
  }
  for (const kind of CATALOGUE_KINDS) {
    for (const acc of ACCESSORY_SIZES) {
      if (!CATALOGUE_KIND_SIZES[kind].includes(acc)) continue;
      out.push({ source: 'catalogue', id: `cat-${kind}-${acc}`, kind, size: acc, studio: canEdit(kind), nameKey: catalogueTabKindKey(kind), sizeKey: catalogueSizeKey(acc) });
    }
  }
  return out;
}

/** Widget Studio link for a card (app/widget-studio.tsx reads theme, kind, size), or null when it can't be edited. */
export function widgetStudioHref(themeId: string, card: WidgetTabCard): string | null {
  if (!card.studio) return null;
  const q = [`theme=${encodeURIComponent(themeId)}`, `kind=${encodeURIComponent(card.kind)}`, `size=${encodeURIComponent(card.size)}`];
  return `/widget-studio?${q.join('&')}`;
}

/** Every i18n key the tab bar and Widgets tab look up (for completeness tests). */
export function tabNavI18nKeys(): string[] {
  const keys = new Set<string>();
  for (const id of TAB_ORDER) keys.add(tabLabelKey(id));
  keys.add('tabs.settings');
  keys.add('tabs.live');
  for (const s of WIDGET_TAB_SIZES) {
    keys.add(widgetTabSizeKey(s));
    for (const c of widgetTabCards(s, [])) {
      keys.add(c.nameKey);
      keys.add(c.sizeKey);
    }
  }
  for (const k of ['subtitle', 'themes', 'sizes', 'open', 'soon', 'soonA11y', 'lockNote']) keys.add(`tabs.widgetsTab.${k}`);
  keys.add('tabs.wallpapersTab.subtitle');
  return [...keys].sort();
}
