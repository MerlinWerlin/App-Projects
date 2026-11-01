// T240 / T241 (owner-1101g): the four icon looks a theme offers on its Icons step, always visible
// as one segmented selector: Themed (default: the theme's own texture behind each glyph), Tinted
// (palette colour, deep and soft), Glass (dark, palette-tinted, low frost, sits in the wallpaper)
// and Dark (near black with a coloured glyph). Each look is a plain IconStyle, so previews, the
// install profile and the Shortcuts PNGs all draw it through the same IconCanvas pipeline.
// Pure TS (no React Native / Expo).

import type { IconArt, TextureKind } from './artwork.ts';
import { TEXTURE_TINT } from './artwork.ts';
import { bestTextOn, composite, ensureContrast, isHex, minContrast, mix, normalizeHex, relativeLuminance } from './colour.ts';
import type { IconBackground, IconStyle } from './iconspec.ts';
import { hashSeed } from './shapes.ts';

export type IconLook = 'themed' | 'tinted' | 'glass' | 'dark';
export const ICON_LOOKS: readonly IconLook[] = Object.freeze(['themed', 'tinted', 'glass', 'dark'] as IconLook[]);
/** T241: textured icons are the default for every theme. */
export const DEFAULT_ICON_LOOK: IconLook = 'themed';

export function isIconLook(v: unknown): v is IconLook {
  return typeof v === 'string' && (ICON_LOOKS as readonly string[]).includes(v);
}

/** Glyph contrast every look aims for (glyph vs background and vs the textured average). */
export const LOOK_GLYPH_CONTRAST = 4.5;

/**
 * T240: glass frost. The old pane used a 0.55 white shine and a 0.5 white rim, which read as a
 * bright white tile on every wallpaper. Frost is now a faint sheen and a quiet rim.
 */
export const GLASS_FROST = Object.freeze({ shineTop: 0.14, shineMid: 0.03, edge: 0.18 });
/** Opacity of the palette tint in a glass pane (the wallpaper shows through the rest). */
export const GLASS_TINT_OPACITY = 0.45;

/** The theme fields a look reads (a full Theme fits). */
export type LookTheme = {
  id: string;
  palette: { bg: string; surface: string; accent: string; ink: string; glyph: string };
  iconStyle: IconStyle;
  wallpaper: { colours: string[]; angle?: number };
  tags?: readonly string[];
};

export type ThemedMotif = 'stars' | 'grain' | 'own';

/** Deterministic description of one app's themed icon in a theme (what IconCanvas then draws). */
export type ThemedTextureSpec = {
  motif: ThemedMotif;
  texture: TextureKind;
  /** Seed the renderer scatters the texture with (theme id + app id). */
  seed: number;
  background: IconBackground;
  /** Colour of the texture marks (stars, grain). */
  markColour: string;
  glyphColour: string;
  /** Lowest glyph contrast over the background and the textured average. */
  contrast: number;
};

const NIGHT_WORDS = ['space', 'stars', 'star', 'night', 'galaxy', 'moon', 'cosmic', 'nebula', 'celestial', 'astronomy', 'sky', 'midnight'];

function hex(v: string | undefined, fallback: string): string {
  return typeof v === 'string' && isHex(v) ? normalizeHex(v) : fallback;
}

function wallColours(t: LookTheme): string[] {
  const cols = (t.wallpaper?.colours ?? []).filter((c) => typeof c === 'string' && isHex(c)).map((c) => normalizeHex(c));
  return cols.length > 0 ? cols : [hex(t.palette.bg, '#1B181B')];
}

function averageOf(cols: readonly string[]): string {
  let acc = cols[0];
  for (let i = 1; i < cols.length; i++) acc = mix(acc, cols[i], 1 / (i + 1));
  return acc;
}

/** Night / space themes get a starfield; themes with their own texture keep it; the rest get grain. */
export function themedMotif(t: LookTheme): ThemedMotif {
  const words = [...(t.tags ?? []), ...t.id.toLowerCase().split(/[^a-z]+/)];
  const own = t.iconStyle.art?.texture ?? 'none';
  // Stars only read on a dark sky: pale "sky" themes get grain instead.
  const dark = relativeLuminance(averageOf(wallColours(t))) < 0.25;
  if (dark && (own === 'starfield' || words.some((w) => NIGHT_WORDS.includes(w)))) return 'stars';
  if (own !== 'none' && own !== 'speckle') return 'own';
  return 'grain';
}

function bgColours(bg: IconBackground): string[] {
  if (bg.kind === 'solid') return [bg.colour];
  if (bg.kind === 'gradient') return [bg.from, bg.to];
  return [bg.tint];
}

/** Every colour a glyph can sit on: each background colour and that colour under the texture. */
function surfaces(bg: IconBackground, mark: string | null, tint: number): string[] {
  const out = bgColours(bg);
  return mark ? [...out, ...out.map((c) => mix(c, mark, tint))] : out;
}

/** The glyph in `want` (nudged), else black / white; the background darkens/lightens if needed. */
function legible(want: string, bg: IconBackground, mark: string | null, tint: number): { bg: IconBackground; glyph: string } {
  let cur = bg;
  for (let i = 0; i < 8; i++) {
    const under = surfaces(cur, mark, tint);
    const g = ensureContrast(want, under, LOOK_GLYPH_CONTRAST);
    if (g) return { bg: cur, glyph: g };
    // Mid-tone background: push it away from the glyph a little and try again.
    const toward = relativeLuminance(want) > 0.3 ? '#000000' : '#FFFFFF';
    cur =
      cur.kind === 'gradient'
        ? { ...cur, from: mix(cur.from, toward, 0.15), to: mix(cur.to, toward, 0.15) }
        : cur.kind === 'solid'
          ? { ...cur, colour: mix(cur.colour, toward, 0.15) }
          : { ...cur, tint: mix(cur.tint, toward, 0.15) };
  }
  return { bg: cur, glyph: bestTextOn(averageOf(bgColours(cur))) };
}

function baseArt(t: LookTheme): IconArt {
  const p = t.palette;
  return (
    t.iconStyle.art ?? {
      colours: { primary: hex(p.accent, '#7A2E6B'), secondary: hex(p.surface, '#FFFFFF'), accent: hex(p.accent, '#7A2E6B'), ink: hex(p.ink, '#1E1A1D'), light: '#FFFFFF' },
      frame: 'none',
      frameRole: 'accent',
      texture: 'none',
      textureRole: 'light',
      stickers: [],
    }
  );
}

type Themed = { style: IconStyle; motif: ThemedMotif; mark: string | null; tint: number };

function themed(t: LookTheme): Themed {
  const base = t.iconStyle;
  const motif = themedMotif(t);
  const art = baseArt(t);
  const textureSeed = hashSeed(`glaze-theme:${t.id}`);
  if (motif === 'own') {
    // The theme's designed tile and texture (gingham, linen…), scattered per app.
    const mark = art.colours[art.textureRole];
    return { style: { ...base, art: { ...art, textureSeed } }, motif, mark, tint: TEXTURE_TINT[art.texture] ?? 0 };
  }
  const cols = wallColours(t);
  const accent = hex(t.palette.accent, '#7A2E6B');
  const from = mix(cols[Math.min(1, cols.length - 1)], accent, 0.12);
  const to = cols[cols.length - 1];
  const angle = typeof t.wallpaper.angle === 'number' && Number.isFinite(t.wallpaper.angle) ? t.wallpaper.angle : 160;
  const bg: IconBackground = { kind: 'gradient', from, to, angle };
  const avg = mix(from, to, 0.5);
  const texture: TextureKind = motif === 'stars' ? 'stars' : 'grain';
  // Marks: the theme's light colour when it shows on the background, else white / black with a hint of accent.
  const light = art.colours.light;
  const mark = isHex(light) && minContrast(light, [avg]) >= 2 ? normalizeHex(light) : mix(bestTextOn(avg), accent, 0.2);
  const tint = TEXTURE_TINT[texture];
  const fixed = legible(hex(base.glyphColour, '#FFFFFF'), bg, mark, tint);
  return {
    style: {
      ...base,
      background: fixed.bg,
      glyphColour: fixed.glyph,
      art: { ...art, colours: { ...art.colours, light: mark }, texture, textureRole: 'light', textureSeed },
    },
    motif,
    mark,
    tint,
  };
}

/** T241: the themed texture for one app in one theme (pure, deterministic). */
export function themedTextureSpec(t: LookTheme, appId: string): ThemedTextureSpec {
  const r = themed(t);
  const art = r.style.art as IconArt;
  const seed = ((hashSeed(appId) ^ (art.textureSeed ?? 0)) >>> 0) as number;
  return {
    motif: r.motif,
    texture: art.texture,
    seed,
    background: r.style.background,
    markColour: r.mark ?? art.colours[art.textureRole],
    glyphColour: r.style.glyphColour,
    contrast: minContrast(r.style.glyphColour, surfaces(r.style.background, r.mark, r.tint)),
  };
}

/** T240: the glass pane for a theme: dark, tinted with the palette, mostly see-through. */
export function glassBackgroundFor(t: LookTheme): IconBackground {
  const accent = hex(t.palette.accent, '#7A2E6B');
  const avg = averageOf(wallColours(t));
  const tint = mix(mix(avg, accent, 0.3), '#000000', 0.62);
  // Pale wallpapers need a little more tint so a light glyph still reads (WCAG 3:1 for graphics).
  let opacity = GLASS_TINT_OPACITY;
  while (opacity < GLASS_MAX_OPACITY && minContrast(GLASS_GLYPH, [composite(tint, opacity, avg)]) < MIN_GLASS_CONTRAST) opacity += 0.05;
  return { kind: 'glass', tint, opacity: Math.round(opacity * 100) / 100 };
}

const GLASS_GLYPH = '#FFFFFF';
/** Upper bound for the glass tint (still clearly see-through). */
export const GLASS_MAX_OPACITY = 0.75;
const MIN_GLASS_CONTRAST = 3;

/** What a glass pane looks like over the wallpaper (for contrast). */
export function glassOver(bg: IconBackground, wallpaper: string): string {
  return bg.kind === 'glass' ? composite(bg.tint, bg.opacity, wallpaper) : bgColours(bg)[0];
}

/** A theme's icon style in `look` (shape, glyph set, label and scale stay the theme's). */
export function iconStyleForLook(t: LookTheme, look: IconLook): IconStyle {
  const base = t.iconStyle;
  const accent = hex(t.palette.accent, '#7A2E6B');
  const plain = (background: IconBackground, glyphColour: string): IconStyle => {
    const out: IconStyle = { ...base, background, glyphColour };
    delete out.art;
    // Monograms keep the theme's display type.
    if (base.art?.displayFont) out.art = { ...baseArt(t), texture: 'none', stickers: [], frame: 'none' };
    return out;
  };
  if (look === 'tinted') {
    const bg: IconBackground = { kind: 'gradient', from: mix(accent, '#000000', 0.55), to: mix(accent, '#000000', 0.75), angle: 160 };
    const fixed = legible(mix(accent, '#FFFFFF', 0.55), bg, null, 0);
    return plain(fixed.bg, fixed.glyph);
  }
  if (look === 'glass') {
    const bg = glassBackgroundFor(t);
    const wall = averageOf(wallColours(t));
    const over = glassOver(bg, wall);
    const want = mix(GLASS_GLYPH, accent, 0.1);
    const under = [over, bg.kind === 'glass' ? bg.tint : over];
    const glyph = minContrast(want, under) >= MIN_GLASS_CONTRAST ? want : (ensureContrast(GLASS_GLYPH, under, MIN_GLASS_CONTRAST) ?? bestTextOn(over));
    return plain(bg, glyph);
  }
  if (look === 'dark') {
    const bg: IconBackground = { kind: 'solid', colour: mix(hex(t.palette.bg, '#000000'), '#000000', 0.82) };
    const fixed = legible(accent, bg, null, 0);
    return plain(fixed.bg, fixed.glyph);
  }
  return themed(t).style;
}
