// Glaze 1.0.44 (owner 23 Nov 2026: "show like 3 of the icons ... maybe one widget as well", then "yea go
// the clock"; 24 Nov: "make it a mix of ... the best art work ones that actualy suit the themes ... make
// the 3 widgets not sit down the bottom but up top ... the split 50/50 betweem clocks and art"): every
// theme card in the Themes browse reads as that theme's iPhone. The art print is the wallpaper; the top
// band holds a small widget (the theme's own Clock, or for half the themes its best Artwork piece) with
// three themed app icons (Phone, Messages, Camera) beside it, so people can judge a theme without opening
// it. Everything comes from data the app already has (palette -> icon style, the native identity registry
// -> the clock, the bundled card art), so no pack is downloaded to draw it. Pure TS (Node-tested):
// geometry, the art/clock choice and the cached clock SVG; src/ui/ThemeHomePreview.tsx draws it.

import { designedWidget, DESIGNED_SIZE } from './designedWidgets.ts';
import { designedWidgetSvg } from './designedWidgetPreview.ts';
import { hasCardArt } from './cardArtPlan.ts';
import type { IconSpec } from './iconspec.ts';
import { previewSpecs, type Theme } from './themes.ts';

/** The three apps on every card, in order (the owner's example). */
export const CARD_PREVIEW_APPS: readonly string[] = Object.freeze(['phone', 'messages', 'camera']);

/** Below this art width a card is too small for a legible preview: it shows the art alone. */
export const CARD_PREVIEW_MIN_WIDTH = 88;

/** The time every card clock shows: the classic 10:08 (hands framing the face), so lists never re-render per minute. */
export const CARD_PREVIEW_TIME = Object.freeze({ hour: 10, minute: 8 });

export type Box = { x: number; y: number; size: number };
export type CardPreviewLayout = {
  /** Small widget (square), its corner radius. */
  widget: Box;
  widgetRadius: number;
  /** The three icons: Phone and Messages beside the widget, Camera under Phone. */
  icons: Box[];
};

const r1 = (n: number) => Math.round(n * 2) / 2; // half points: crisp on 2x / 3x

/** Top of the cluster: a status-bar band, at least clear of the corner badge (8 pt inset + 22 pt pill). */
export function widgetTop(width: number): number {
  return Math.max(36, width * 0.17);
}

/**
 * Geometry of the mini Home Screen over an art print of `width` × `height`, on the iPhone's own grid:
 * four columns between side margins. 1.0.44 build 98 (owner 24 Nov: "make the 3 widgets not sit down the
 * bottom but up top"): the first page of a real Home Screen, all in the top band. The widget takes the
 * left two columns (two cells plus a gap, square); Phone and Messages fill the row beside it and Camera
 * sits under Phone, so the cluster is exactly the widget's height and the rest of the print is art.
 * Null when the print is too small (or not a real size).
 */
export function cardPreviewLayout(width: number, height: number): CardPreviewLayout | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < CARD_PREVIEW_MIN_WIDTH || height < width) return null;
  const margin = width * 0.085;
  const gap = width * 0.06;
  const cell = (width - margin * 2 - gap * 3) / 4;
  const top = widgetTop(width);
  const col = (i: number) => margin + i * (cell + gap);
  const row = (i: number) => top + i * (cell + gap);
  const side = cell * 2 + gap;
  return {
    // Catalogue art keeps its subject low and centred, so the top band is mostly background.
    widget: { x: r1(margin), y: r1(top), size: r1(side) },
    widgetRadius: r1(side * 0.22),
    icons: [
      { x: r1(col(2)), y: r1(row(0)), size: r1(cell) },
      { x: r1(col(3)), y: r1(row(0)), size: r1(cell) },
      { x: r1(col(2)), y: r1(row(1)), size: r1(cell) },
    ],
  };
}

/** What a card's widget shows: the theme's best Artwork piece (half the themes, src/core/cardArtPlan.ts) or its Clock. */
export function cardWidgetKind(themeId: string): 'art' | 'clock' {
  return hasCardArt(themeId) ? 'art' : 'clock';
}

/** Phone, Messages and Camera in this theme's default icon style (what applying it gives). */
export function cardIconSpecs(theme: Theme): IconSpec[] {
  const all = previewSpecs(theme, 8);
  return CARD_PREVIEW_APPS.map((id) => all.find((s) => s.appId === id)).filter((s): s is IconSpec => !!s);
}

const CLOCKS = new Map<string, string>();
const CLOCK_LIMIT = 400; // ~252 themes × a locale or two

/** The theme's own small Clock widget as SVG at CARD_PREVIEW_TIME, cached per theme + locale. */
export function cardClockSvg(theme: Theme, locale: string): string {
  const key = `${theme.id}|${locale}|${theme.palette.bg}`;
  const hit = CLOCKS.get(key);
  if (hit !== undefined) return hit;
  const date = new Date(2026, 0, 5, CARD_PREVIEW_TIME.hour, CARD_PREVIEW_TIME.minute);
  const svg = designedWidgetSvg(designedWidget(theme, 'clock'), 'small', { date, battery: null, locale });
  if (CLOCKS.size >= CLOCK_LIMIT) CLOCKS.delete(CLOCKS.keys().next().value as string);
  CLOCKS.set(key, svg);
  return svg;
}

export const CARD_CLOCK_VIEWBOX = DESIGNED_SIZE.small;
