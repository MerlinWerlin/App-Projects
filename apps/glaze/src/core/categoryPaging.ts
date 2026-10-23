// Theme home category paging (T57, owner request 18 Oct M4a): the row of big category bubbles,
// which category page the showcase grid shows, swiping between pages and the grid's re-flow
// transition. Pure TS (no React Native) so Node tests it; the helpers the UI thread calls carry
// the 'worklet' directive (an unused string in Node).

import { CATEGORY_IDS } from './categories.ts';
import type { PastelName } from './designV2.ts';
import type { ThemeCategoryId } from './themes.ts';

/** A page of the theme home: every theme ('all') or one category. */
export type BrowseKey = 'all' | ThemeCategoryId;

export const ALL_PAGE = 'all' as const;

/** Pastel fill behind each bubble's artwork (docs/DESIGN_V2.md §2). */
export const BUBBLE_PASTEL: Readonly<Record<BrowseKey, PastelName>> = Object.freeze({
  all: 'berry',
  minimal: 'sky',
  dark: 'lilac',
  pastel: 'berry',
  nature: 'mint',
  neon: 'lilac',
  retro: 'peach',
  anime: 'sky',
  cute: 'peach',
  luxury: 'butter',
  seasonal: 'mint',
});

/**
 * Pages in bubble order: 'all' first, then every category that has at least one theme in
 * `counts`. `keep` stays in the list even at zero (the selected page never vanishes under the
 * person's finger while a search narrows the counts).
 */
export function browsePages(counts: Readonly<Record<ThemeCategoryId, number>>, keep: BrowseKey | null = null): BrowseKey[] {
  const out: BrowseKey[] = [ALL_PAGE];
  for (const id of CATEGORY_IDS) if ((counts[id] ?? 0) > 0 || id === keep) out.push(id);
  return out;
}

/** The category a page filters by; `null` for 'all'. */
export function pageCategory(key: BrowseKey): ThemeCategoryId | null {
  return key === ALL_PAGE ? null : key;
}

/** The page for a category; 'all' for `null`. */
export function pageKey(category: ThemeCategoryId | null): BrowseKey {
  return category ?? ALL_PAGE;
}

/** Index of `key` in `pages`, or 0 (the 'all' page) when it is not there. */
export function pageIndex(pages: readonly BrowseKey[], key: BrowseKey): number {
  const i = pages.indexOf(key);
  return i < 0 ? 0 : i;
}

// ---- Bubble row geometry --------------------------------------------------------------------

export type BubbleMetrics = {
  /** Side of the square bubble tile, in points. */
  size: number;
  /** Gap between bubbles. */
  gap: number;
  /** Padding at both ends of the row. */
  inset: number;
};

/** Smallest and largest bubble side; even the smallest is well over the 48 pt touch target. */
export const BUBBLE_MIN = 88;
export const BUBBLE_MAX = 128;
/** About this many bubbles show at once, so the next one peeks in and invites a scroll. */
export const BUBBLES_VISIBLE = 3.4;

/** Bubble size for a screen width (16 pt side gutter, 12 pt gaps). */
export function bubbleMetrics(screenWidth: number, inset: number = 16, gap: number = 12): BubbleMetrics {
  const w = Number.isFinite(screenWidth) && screenWidth > 0 ? screenWidth : 375;
  const raw = (w - inset * 2 - gap * (Math.ceil(BUBBLES_VISIBLE) - 1)) / BUBBLES_VISIBLE;
  const size = Math.round(Math.min(BUBBLE_MAX, Math.max(BUBBLE_MIN, raw)));
  return { size, gap, inset };
}

/** Width of the whole row's content. */
export function rowContentWidth(count: number, m: BubbleMetrics): number {
  const n = Math.max(0, Math.floor(count));
  if (n === 0) return m.inset * 2;
  return m.inset * 2 + n * m.size + (n - 1) * m.gap;
}

/** Furthest the row can scroll. */
export function maxRowOffset(count: number, m: BubbleMetrics, viewportW: number): number {
  return Math.max(0, rowContentWidth(count, m) - Math.max(0, viewportW));
}

/**
 * Snap points for the row: bubble i's leading edge sits at the inset, clamped to the end of the
 * content, duplicates dropped. Offsets are measured from the row's start edge.
 */
export function bubbleSnapOffsets(count: number, m: BubbleMetrics, viewportW: number): number[] {
  const max = maxRowOffset(count, m, viewportW);
  const out: number[] = [];
  for (let i = 0; i < Math.max(0, Math.floor(count)); i++) {
    const o = Math.min(max, i * (m.size + m.gap));
    if (out.length === 0 || o > out[out.length - 1]) out.push(o);
  }
  if (out.length === 0) out.push(0);
  return out;
}

/**
 * Where to scroll the row so the selected bubble is in view with the one before it peeking in,
 * landing on a snap point.
 */
export function revealOffset(index: number, count: number, m: BubbleMetrics, viewportW: number): number {
  const n = Math.max(0, Math.floor(count));
  if (n === 0) return 0;
  const i = Math.min(n - 1, Math.max(0, Math.floor(index) - 1));
  return Math.min(maxRowOffset(n, m, viewportW), i * (m.size + m.gap));
}

// ---- Selected bubble look ------------------------------------------------------------------
// fb-1022c (owner 22 Oct evening): no bounce. The selected bubble keeps its size; only its tint
// ring and glow fade in (BUBBLE_FADE_MS ease-out), the same with or without Reduce Motion.

/** Colour/opacity fade for a bubble's selected state, in ms (ease-out, no spring). */
export const BUBBLE_FADE_MS = 150;
/** Glow halo opacity when fully selected. */
export const BUBBLE_GLOW_OPACITY = 0.55;

export type BubbleLook = { tint: number; glow: number };

/**
 * A bubble's look at selection progress `p` (0 rest … 1 selected): tint ring opacity and glow
 * opacity only. Never a scale.
 */
export function bubbleLook(p: number): BubbleLook {
  'worklet';
  const q = Number.isFinite(p) ? Math.min(1, Math.max(0, p)) : 0;
  return { tint: q, glow: BUBBLE_GLOW_OPACITY * q };
}

// ---- Swiping the showcase grid -------------------------------------------------------------

/** A drag commits once it covers this share of the grid width… */
export const SWIPE_DISTANCE_RATIO = 0.18;
/** …or flicks at least this fast (pt/s) over at least SWIPE_MIN_FLICK_PT. */
export const SWIPE_VELOCITY = 500;
export const SWIPE_MIN_FLICK_PT = 16;

/**
 * Page step for a finished horizontal drag: +1 next page, -1 previous, 0 stay. In left-to-right
 * layouts dragging left goes forward; in right-to-left layouts dragging right does, matching the
 * bubble row's reading order.
 */
export function swipeStep(dx: number, vx: number, width: number, rtl: boolean): -1 | 0 | 1 {
  if (!Number.isFinite(dx)) return 0;
  const v = Number.isFinite(vx) ? vx : 0;
  const w = Number.isFinite(width) && width > 0 ? width : 375;
  const far = Math.abs(dx) >= w * SWIPE_DISTANCE_RATIO;
  const flick = Math.abs(v) >= SWIPE_VELOCITY && Math.abs(dx) >= SWIPE_MIN_FLICK_PT && Math.sign(v) === Math.sign(dx);
  if (!far && !flick) return 0;
  const forward = rtl ? dx > 0 : dx < 0;
  return forward ? 1 : -1;
}

/** Page index after a step, clamped to the pages (no wrap-around). */
export function pageAfterStep(index: number, count: number, step: -1 | 0 | 1): number {
  const n = Math.max(0, Math.floor(count));
  if (n === 0) return 0;
  const i = Math.min(n - 1, Math.max(0, Math.floor(index)));
  return Math.min(n - 1, Math.max(0, i + step));
}

// ---- Grid re-flow transition ---------------------------------------------------------------
// fb-1022c: a category change is a calm cross-fade (opacity only, no slide, no spring, no
// stagger, no layout animation), the same with or without Reduce Motion.

/** Grid cross-fade on a page change, in ms (ease-out). */
export const GRID_FADE_MS = 180;
/** Opacity the new page starts from (it fades up to 1). */
export const GRID_FADE_FROM = 0;

export type PageTransition = { kind: 'none' } | { kind: 'fade'; fromOpacity: number; durationMs: number };

/** How the showcase grid enters when the page changes from `from` to `to`: a short fade, or nothing. */
export function pageTransition(from: number, to: number): PageTransition {
  if (!Number.isFinite(from) || !Number.isFinite(to) || from === to) return { kind: 'none' };
  return { kind: 'fade', fromOpacity: GRID_FADE_FROM, durationMs: GRID_FADE_MS };
}

/** Grid columns for a screen width: two big preview cards, one on very narrow screens. */
export function showcaseColumns(screenWidth: number): number {
  return Number.isFinite(screenWidth) && screenWidth >= 340 ? 2 : 1;
}

/** Card width for `columns` columns between 16 pt gutters with `gap` between cards. */
export function showcaseCardWidth(screenWidth: number, columns: number, gutter: number = 16, gap: number = 12): number {
  const cols = Math.max(1, Math.floor(columns));
  const w = Number.isFinite(screenWidth) && screenWidth > 0 ? screenWidth : 375;
  return Math.max(120, Math.floor((w - gutter * 2 - gap * (cols - 1)) / cols));
}
