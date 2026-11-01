// T119 per-trip accent: a colour set derived from the trip's cover scene, used on that trip's screens (day headers,
// the trip's group in the Wallet). Pure TS (no React Native), so Node tests it directly.
//
// The hue comes from one signature paint of the scene's palette (src/theme/tokens.ts coverPalettes, SIGNATURE below),
// so a coast trip is sea blue, an old town terracotta, a countryside trip meadow green. The
// lightness is then walked until every pair the screens draw meets WCAG AA in the current theme:
//   ink      text in the accent on paper, card, cardRaised and on `soft` (4.5:1)
//   soft     a tinted panel: theme ink and muted text on it are 4.5:1
//   strong   a fill (stripe, dot, button): onStrong text on it is 4.5:1 and it reads at 3:1 on the page and cards
//   onStrong text on `strong` (the theme's onAccent)
// src/theme/contrast.test.ts checks every scene in both themes.
import { contrast, parseColour } from './contrast.ts';
import { coverPalettes, surfaces, type Theme } from './tokens.ts';
import type { CoverPaint } from '../core/coverArt.ts';
import type { CoverId } from '../core/covers.ts';

export type TripAccent = { ink: string; soft: string; strong: string; onStrong: string };

type HSL = { h: number; s: number; l: number };

export function toHsl(hex: string): HSL {
  const [r, g, b] = parseColour(hex).rgb.map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) * 60 : max === g ? ((b - r) / d + 2) * 60 : ((r - g) / d + 4) * 60;
  return { h, s, l };
}

export function fromHsl({ h, s, l }: HSL): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const hex = (v: number) =>
    Math.round(Math.min(1, Math.max(0, v + m)) * 255)
      .toString(16)
      .padStart(2, '0')
      .toUpperCase();
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/**
 * The paint that carries each scene's character, and which version of the scene it comes from: the city's dusk violet,
 * the mountains' pines, the coast's sea, the old town's roofs, the countryside's meadow, the snow's ice, the desert's
 * dunes, the island's lagoon.
 */
export const SIGNATURE: Record<CoverId, { from: 'light' | 'dark'; paint: CoverPaint }> = {
  city: { from: 'dark', paint: 'sky1' },
  mountains: { from: 'light', paint: 'near' },
  coast: { from: 'light', paint: 'accent' },
  oldtown: { from: 'light', paint: 'accent' },
  countryside: { from: 'light', paint: 'mid' },
  snow: { from: 'light', paint: 'far' },
  desert: { from: 'light', paint: 'near' },
  island: { from: 'light', paint: 'far' },
};

/** The scene's signature hue and saturation. Unknown scenes use the city's. */
export function sceneHue(scene: CoverId): HSL {
  const sig = SIGNATURE[scene] ?? SIGNATURE.city;
  const pal = coverPalettes[sig.from][scene] ?? coverPalettes[sig.from].city;
  return toHsl(pal[sig.paint]);
}

const MARGIN = 0.1;
const passes = (fg: string, bgs: string[], min: number) => bgs.every((bg) => contrast(fg, bg) >= min + MARGIN);

/** Walk lightness from `from` in `step` until `ok` holds (or the end of the range); returns the colour. */
function walk(h: number, s: number, from: number, step: number, ok: (c: string) => boolean): string | null {
  for (let l = from; l >= 0 && l <= 1; l += step) {
    const c = fromHsl({ h, s, l });
    if (ok(c)) return c;
  }
  return null;
}

/** The accent set for a scene in a theme. Always AA: falls back to the theme's own accent set if a walk fails. */
export function tripAccent(scene: CoverId, theme: Theme): TripAccent {
  const base = sceneHue(scene);
  const s = Math.min(0.72, Math.max(0.38, base.s));
  const raised = theme.dark ? Object.values(surfaces.dark) : [theme.cardRaised];
  const pages = [theme.paper, theme.card, theme.cardRaised, ...raised];
  const onStrong = theme.onAccent;
  const fallback: TripAccent = { ink: theme.accentInk, soft: theme.accentSoft, strong: theme.accentStrong, onStrong };
  const textOnSoft = (c: string) => passes(theme.ink, [c], 4.5) && passes(theme.muted, [c], 4.5);
  const soft = theme.dark ? walk(base.h, s * 0.55, 0.16, -0.01, textOnSoft) : walk(base.h, s * 0.6, 0.92, 0.01, textOnSoft);
  if (!soft) return fallback;
  const inkOk = (c: string) => passes(c, [...pages, soft], 4.5);
  const ink = theme.dark ? walk(base.h, s, 0.62, 0.01, inkOk) : walk(base.h, s, 0.42, -0.01, inkOk);
  const strongOk = (c: string) => passes(onStrong, [c], 4.5) && passes(c, pages, 3);
  const strong = theme.dark ? walk(base.h, s, 0.6, 0.01, strongOk) : walk(base.h, s, 0.44, -0.01, strongOk);
  if (!ink || !strong) return fallback;
  return { ink, soft, strong, onStrong };
}
