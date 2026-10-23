// fb-1023 C (owner, 23 Oct): small pictures for the Widgets tab's option rows, so choosing a size,
// a look or a theme is visual and not text alone. Pure geometry and colours only; the drawing is
// src/ui/WidgetOptionArt.tsx (plain Views, theme tokens, no motion).
//
//   size tabs   tiny rounded rectangles in each size's real aspect, all on one scale, so Small,
//               Medium and Large also read as small / wide / big next to each other; Lock shows a
//               clock line over a round and a wide Lock Screen widget.
//   look chips  a swatch: the theme wallpaper (two bands) with a pane on it, solved the same way
//               the real widgets are (pairGlassText for clear / tinted, glowPalette for glow).
//   theme chips the same swatch in the theme's own look, from its palette.
//
// Pure TS (no React Native / Expo), Node-testable, deterministic.

import type { WidgetTabSize } from './tabNav.ts';
import { CATALOGUE_SIZE_POINTS } from './widgetKinds.ts';
import { GLOW_HALO_OPACITY, glowPalette, pairGlassText, type WidgetLook } from './widgetLook.ts';
import { isHex, normalizeHex } from './colour.ts';

/** The box every size picture is drawn in (points). */
export const SIZE_ART_BOX = Object.freeze({ width: 36, height: 24 });
/** The box every look / theme swatch is drawn in (points). */
export const SWATCH_BOX = Object.freeze({ width: 34, height: 24 });

/** One rounded rectangle; x is measured from the leading edge (drawn with `start`, so RTL mirrors). */
export type ArtRect = { x: number; y: number; width: number; height: number; radius: number; role: 'widget' | 'line' };

const r1 = (n: number): number => Math.round(n * 10) / 10;

/** Home Screen sizes share one scale: the largest (Large) just fits the box. */
const HOME_SCALE = Math.min(
  SIZE_ART_BOX.width / CATALOGUE_SIZE_POINTS.large.width,
  SIZE_ART_BOX.height / CATALOGUE_SIZE_POINTS.large.height,
);

/** Corner radius of a widget picture: about iOS's 22 pt on a 170 pt widget, at least 2. */
const cornerFor = (w: number, h: number): number => r1(Math.max(2, Math.min(w, h) * 0.2));

function centred(width: number, height: number): ArtRect {
  const w = r1(width);
  const h = r1(height);
  return { x: r1((SIZE_ART_BOX.width - w) / 2), y: r1((SIZE_ART_BOX.height - h) / 2), width: w, height: h, radius: cornerFor(w, h), role: 'widget' };
}

/** Lock Screen picture: a clock line, then a round and a wide accessory widget side by side. */
function lockArt(): ArtRect[] {
  const circ = CATALOGUE_SIZE_POINTS.accessoryCircular;
  const rect = CATALOGUE_SIZE_POINTS.accessoryRectangular;
  const gapPt = 16;
  const scale = (SIZE_ART_BOX.width - 4) / (circ.width + gapPt + rect.width);
  const cw = r1(circ.width * scale);
  const rw = r1(rect.width * scale);
  const rh = r1(rect.height * scale);
  const gap = r1(gapPt * scale);
  const x0 = r1((SIZE_ART_BOX.width - (cw + gap + rw)) / 2);
  const lineH = 3;
  const lineW = r1(SIZE_ART_BOX.width * 0.45);
  const rowY = r1(SIZE_ART_BOX.height - 3 - cw);
  return [
    { x: r1((SIZE_ART_BOX.width - lineW) / 2), y: r1(Math.max(1, rowY - 4 - lineH)), width: lineW, height: lineH, radius: 1.5, role: 'line' },
    { x: x0, y: rowY, width: cw, height: cw, radius: r1(cw / 2), role: 'widget' },
    { x: r1(x0 + cw + gap), y: r1(rowY + (cw - rh) / 2), width: rw, height: rh, radius: r1(rh / 2), role: 'widget' },
  ];
}

/** The picture on a size sub-tab: rounded rectangles inside SIZE_ART_BOX. */
export function sizeArt(size: WidgetTabSize): ArtRect[] {
  if (size === 'lock') return lockArt();
  const pts = CATALOGUE_SIZE_POINTS[size];
  return [centred(pts.width * HOME_SCALE, pts.height * HOME_SCALE)];
}

/** What a look / theme swatch draws: a two-band wallpaper, a pane on it and a short text mark. */
export type Swatch = {
  /** Wallpaper behind the pane, top band then bottom band. */
  backdrop: [string, string];
  pane: string;
  /** 0–1; below 1 the wallpaper shows through (clear / tinted glass). */
  paneOpacity: number;
  /** Light edge drawn round see-through panes (glass); null for opaque ones. */
  edge: string | null;
  /** Text / glyph colour on the pane. */
  mark: string;
  /** Soft halo behind the mark (glow look), as an opacity; 0 = none. */
  halo: number;
};

export type SwatchTokens = {
  bg: readonly string[];
  surface: string;
  accent: string;
  /** Wallpaper colours (WidgetTokens.wallpaper); empty = unknown, then the theme background is used. */
  wallpaper: readonly string[];
};

const hex = (v: string | undefined, fallback: string): string => (v && isHex(v) ? normalizeHex(v) : fallback);

function backdropOf(tokens: SwatchTokens): [string, string] {
  const src = [...tokens.wallpaper, ...tokens.bg].filter((c) => typeof c === 'string' && isHex(c)).map((c) => normalizeHex(c));
  const a = src[0] ?? '#808080';
  return [a, src[1] ?? a];
}

/** Edge of a glass pane: white, faint (it only frames the pane, like the real glass rim). */
export const GLASS_EDGE = '#FFFFFF';

/** The swatch for one look, solved the same way the widgets on the tab are. Never throws. */
export function lookSwatch(look: WidgetLook, tokens: SwatchTokens): Swatch {
  const backdrop = backdropOf(tokens);
  const accent = hex(tokens.accent, '#7A2E6B');
  if (look === 'clear' || look === 'tinted') {
    const pair = pairGlassText({ wallpaper: tokens.wallpaper.length ? tokens.wallpaper : backdrop, look, tint: accent });
    return { backdrop, pane: pair.tint, paneOpacity: pair.opacity, edge: pair.opacity < 1 ? GLASS_EDGE : null, mark: pair.colour, halo: 0 };
  }
  if (look === 'glow') {
    const g = glowPalette(accent);
    return { backdrop, pane: g.base[0], paneOpacity: 1, edge: null, mark: g.neon, halo: GLOW_HALO_OPACITY };
  }
  return { backdrop, pane: hex(tokens.surface, '#FFFFFF'), paneOpacity: 1, edge: null, mark: accent, halo: 0 };
}

/** A theme chip's swatch: the theme's own look from its palette. */
export function themeSwatch(palette: { bg: string; surface: string; accent: string }): Swatch {
  return lookSwatch('theme', { bg: [palette.bg], surface: palette.surface, accent: palette.accent, wallpaper: [] });
}
