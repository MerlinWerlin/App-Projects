// T173 premium UI (docs/PREMIUM_UI.md §3.4): the Widgets tab reads as editorial sections, one per
// widget family, instead of one long grid:
//   theme     the theme's own set (clock, date, photo, quote, battery)
//   everyday  catalogue clocks, calendars, countdowns, progress and the photo album
//   habits    catalogue habit trackers (water, mood, sleep, steps)
// Presentation only: the cards, their order and their links still come from tabNav.widgetTabCards.
// Each family is split into its own rows (gridRows), so a row never mixes two families, and the
// first row of a family carries the section header. Pure; the screen renders what this returns.
import { gridRows, WIDGET_GRID_COLUMNS } from './widgetGrid.ts';
import type { CatalogueKind } from './widgetKinds.ts';

export const WIDGET_FAMILIES = Object.freeze(['theme', 'everyday', 'habits'] as const);
export type WidgetFamily = (typeof WIDGET_FAMILIES)[number];

const HABIT_KINDS: ReadonlySet<CatalogueKind> = new Set<CatalogueKind>(['habitWater', 'habitMood', 'habitSleep', 'habitSteps']);

/** The minimal card shape this needs (tabNav's WidgetTabCard satisfies it). */
export type FamilyCard = { source: 'set' | 'catalogue'; kind: string };

export function widgetFamilyOf(card: FamilyCard): WidgetFamily {
  if (card.source === 'set') return 'theme';
  return HABIT_KINDS.has(card.kind as CatalogueKind) ? 'habits' : 'everyday';
}

/** One list item of the Widgets grid: a row of cards, and whether it opens its family's section. */
export type FamilyRow<T> = { key: string; family: WidgetFamily; first: boolean; cards: T[] };

/**
 * Rows of `columns` cards per family, families in WIDGET_FAMILIES order and cards in their given
 * order within each family. Empty families are left out (no header without cards).
 */
export function familyRows<T extends FamilyCard & { id: string }>(cards: readonly T[], columns: number = WIDGET_GRID_COLUMNS): FamilyRow<T>[] {
  const out: FamilyRow<T>[] = [];
  for (const family of WIDGET_FAMILIES) {
    const members = cards.filter((c) => widgetFamilyOf(c) === family);
    gridRows(members, columns).forEach((row, i) => {
      out.push({ key: `${family}:${row.map((c) => c.id).join('|')}`, family, first: i === 0, cards: row });
    });
  }
  return out;
}

/** i18n keys for a family's editorial header (eyebrow, title, body) under tabs.widgetsTab.families. */
export function widgetFamilyKeys(family: WidgetFamily): { eyebrow: string; title: string; body: string } {
  const base = `tabs.widgetsTab.families.${family}`;
  return { eyebrow: `${base}.eyebrow`, title: `${base}.title`, body: `${base}.body` };
}
