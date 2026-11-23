// Glaze 1.0.44 (owner 23 Nov 2026: "show like 3 of the icons ... maybe one widget as well", then "yea go
// the clock"): every theme card in the Themes browse reads as that theme's iPhone. The art print is the
// wallpaper; the theme's own small Clock widget sits in the 2×2 widget slot and three themed app icons
// (Phone, Messages, Camera) sit in a dock along the bottom, so people can judge a theme without opening
// it. Everything comes from data the gallery already has (palette → icon style, the native identity
// registry → the clock), so no pack is downloaded to draw it. Pure TS (Node-tested): geometry and the
// cached clock SVG; src/ui/ThemeHomePreview.tsx draws it.

import { designedWidget, DESIGNED_SIZE } from './designedWidgets.ts';
import { designedWidgetSvg } from './designedWidgetPreview.ts';
import type { IconSpec } from './iconspec.ts';
import { previewSpecs, type Theme } from './themes.ts';

/** The three apps on every card, in dock order (the owner's example). */
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
  /** Dock rectangle and corner radius. */
  dock: { x: number; y: number; w: number; h: number; radius: number };
  /** The three icons, left to right. */
  icons: Box[];
};

const r1 = (n: number) => Math.round(n * 2) / 2; // half points: crisp on 2x / 3x

/**
 * Geometry of the mini Home Screen over an art print of `width` × `height`, on the iPhone's own grid:
 * four columns between side margins, the widget two cells (plus one gap) square, a dock one cell tall
 * plus padding. Null when the print is too small (or not a real size).
 */
export function cardPreviewLayout(width: number, height: number): CardPreviewLayout | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < CARD_PREVIEW_MIN_WIDTH || height < width) return null;
  const margin = width * 0.085;
  const gap = width * 0.06;
  const cell = (width - margin * 2 - gap * 3) / 4;
  const dockInset = width * 0.04;
  const dockPad = Math.max(3, width * 0.035);
  const dockH = cell + dockPad * 2;
  const dockY = height - dockInset - dockH;
  const iconGap = gap * 1.15;
  const rowW = cell * 3 + iconGap * 2;
  const iconsX = (width - rowW) / 2;
  const icons = [0, 1, 2].map((i) => ({ x: r1(iconsX + i * (cell + iconGap)), y: r1(dockY + dockPad), size: r1(cell) }));
  const side = cell * 2 + gap;
  return {
    widget: { x: r1(margin), y: r1(dockY - gap * 1.3 - side), size: r1(side) },
    widgetRadius: r1(side * 0.22),
    dock: { x: r1(dockInset), y: r1(dockY), w: r1(width - dockInset * 2), h: r1(dockH), radius: r1(dockH * 0.42) },
    icons,
  };
}

/** The dock's glass over this theme's art: lighter over dark art, a touch denser over light art. */
export function dockFill(luminance: number): { fill: string; edge: string } {
  return luminance < 0.45
    ? { fill: 'rgba(255,255,255,0.24)', edge: 'rgba(255,255,255,0.32)' }
    : { fill: 'rgba(255,255,255,0.42)', edge: 'rgba(255,255,255,0.55)' };
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
