// Monogram fallback (T66): an app with no glyph (a custom app, or a glyph name we don't ship)
// gets 1–2 letters from its own name instead of a generic placeholder shape. Original lettering,
// never a brand logo. Pure TS (no React Native / Expo) so Node can run and test it directly.

import type { DisplayFont, IconArt } from './artwork.ts';
import {
  bestTextOn,
  composite,
  contrastRatio,
  darken,
  ensureContrast,
  isHex,
  lighten,
  minContrast,
  normalizeHex,
  relativeLuminance,
} from './colour.ts';

/** Glyph value meaning "draw the app's monogram". New custom apps start with it. */
export const MONOGRAM_GLYPH = 'monogram';

/** Monogram lettering needs the same ≥ 3:1 as glyphs (WCAG non-text contrast). */
export const MONOGRAM_MIN_CONTRAST = 3;

export type Monogram = {
  /** 1–2 graphemes, upper-cased where the script has case. */
  text: string;
  /** Font size as a fraction of the icon edge. */
  fontScale: number;
  /**
   * Text colour, ≥ 3:1 against every colour it sits on when reachable: the icon background, or
   * the look's plate for a 'disc' / 'gradient' look (see monogramSurfaces).
   */
  colour: string;
  /** T170: the theme's monogram design (font, plate, ring, glow). Absent = plain lettering. */
  look?: MonogramLook;
};

// A "letter-like" code point: letters, digits, or a pictographic emoji.
const LETTERISH = /[\p{L}\p{N}\p{Extended_Pictographic}\p{Regional_Indicator}]/u;
// Code points that attach to the previous one (combining marks, variation selectors, ZWJ, skin tones).
const ATTACH = /[\p{M}‍︎️\u{1F3FB}-\u{1F3FF}\u{E0020}-\u{E007F}]/u;
const PICTO = /[\p{Extended_Pictographic}\p{Regional_Indicator}]/u;
// Scripts drawn as one square syllable/ideograph per grapheme (one is enough, and wider).
const WIDE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const UPPER = /\p{Lu}/u;
const DIGIT = /\p{N}/u;

/** Grapheme-ish clusters via Array.from (code points) plus attaching marks / ZWJ sequences. */
export function graphemes(s: string): string[] {
  const out: string[] = [];
  let joinNext = false;
  for (const cp of Array.from(s)) {
    if (out.length > 0 && (joinNext || ATTACH.test(cp))) {
      out[out.length - 1] += cp;
      joinNext = cp === '‍';
      continue;
    }
    // A second regional indicator pairs with the first (flag emoji).
    const last = out[out.length - 1];
    if (last !== undefined && /^\p{Regional_Indicator}$/u.test(last) && /\p{Regional_Indicator}/u.test(cp)) {
      out[out.length - 1] += cp;
      continue;
    }
    out.push(cp);
    joinNext = false;
  }
  return out;
}

/** Keep only letter-like graphemes of a word (punctuation and symbols dropped). */
function cleanWord(word: string): string[] {
  return graphemes(word).filter((g) => LETTERISH.test(Array.from(g)[0] ?? ''));
}

function upper(g: string): string {
  const u = g.toUpperCase();
  // Don't let case mapping grow a grapheme (e.g. ß -> SS).
  return Array.from(u).length === Array.from(g).length ? u : g;
}

/**
 * Monogram letters for an app name: 1–2 graphemes, '' when the name has nothing letter-like.
 * Multi-word -> first grapheme of the first two words ("Bike Club" -> "BC"); one word -> its first
 * grapheme, plus the next capital or digit run start for camel case ("myBank" -> "MB",
 * "1Password" -> "1P"). An emoji or a CJK/Kana/Hangul start stays a single grapheme.
 */
export function monogramText(name: string | null | undefined): string {
  if (typeof name !== 'string') return '';
  const words = name
    .normalize('NFC')
    .split(/[\s\p{P}\p{S}]+/u)
    .map(cleanWord)
    .filter((w) => w.length > 0);
  // Emoji are \p{S}; if splitting removed everything, look for an emoji in the raw name.
  if (words.length === 0) {
    const picto = graphemes(name).find((g) => PICTO.test(g));
    return picto ?? '';
  }
  const first = words[0];
  const g0 = first[0];
  if (PICTO.test(g0) || WIDE.test(g0)) return g0;
  if (words.length >= 2) {
    const g1 = words[1][0];
    if (PICTO.test(g1) || WIDE.test(g1)) return upper(g0);
    return upper(g0) + upper(g1);
  }
  // Camel case / digit-letter boundary inside one word.
  if (DIGIT.test(g0)) {
    // "1Password" -> "1P", "365" -> "36"
    const next = first.find((g) => !DIGIT.test(g));
    if (next !== undefined && !PICTO.test(next) && !WIDE.test(next)) return g0 + upper(next);
    return first.length > 1 ? g0 + first[1] : g0;
  }
  for (let i = 1; i < first.length; i++) {
    const g = first[i];
    if (PICTO.test(g) || WIDE.test(g)) break;
    if (UPPER.test(g) && !UPPER.test(first[i - 1])) return upper(g0) + g;
  }
  return upper(g0);
}

/** Font size (fraction of the icon edge) for the monogram, scaled with the set's glyph size. */
export function monogramFontScale(text: string, glyphScale = 0.55): number {
  const n = graphemes(text).length;
  const gs = Number.isFinite(glyphScale) ? Math.max(0.2, Math.min(0.9, glyphScale)) : 0.55;
  const k = gs / 0.55;
  const base = n <= 1 ? (WIDE.test(text) ? 0.44 : 0.5) : 0.38;
  return Math.round(Math.max(0.18, Math.min(0.62, base * k)) * 1000) / 1000;
}

/**
 * Lettering colour: the glyph colour if it already reaches 3:1 on every background colour, else
 * the nearest shade of it that does, else black or white (whichever is better on the first one).
 * Unparseable colours fall back to the glyph colour as given.
 */
export function monogramColour(glyphColour: string, backgrounds: readonly string[]): string {
  const bgs = backgrounds.filter(isHex);
  if (!isHex(glyphColour)) return bgs.length > 0 ? bestTextOn(bgs[0]) : glyphColour;
  if (bgs.length === 0) return normalizeHex(glyphColour);
  return ensureContrast(glyphColour, bgs, MONOGRAM_MIN_CONTRAST) ?? bestTextOn(bgs[0]);
}

// ---------------------------------------------------------------- T170: theme-designed monograms

/**
 * How a theme dresses its monograms, chosen from the theme's own character (its frame and texture):
 * - `disc`      a solid badge in a theme colour (a calm plate over busy textures and lacy frames);
 * - `gradient`  a two-tone plate (ribbon frames, washes, stripes, plain themes);
 * - `ring`      a ring in the theme's accent (stitched and double frames);
 * - `glow`      a soft halo of the accent behind the letters (starfields and very dark themes).
 */
export type MonogramTreatment = 'disc' | 'gradient' | 'ring' | 'glow';
export const MONOGRAM_TREATMENTS: readonly MonogramTreatment[] = Object.freeze([
  'disc',
  'gradient',
  'ring',
  'glow',
] as MonogramTreatment[]);

export type MonogramLook = {
  /** The theme's display-type token (ThemeArt.displayFont); the renderer maps it to a font it has. */
  font: DisplayFont;
  /** Font weight for that face. */
  weight: '500' | '700' | '800';
  treatment: MonogramTreatment;
  /** Plate fill (disc / gradient start), ring stroke, or glow colour. */
  plate: string;
  /** Gradient end; equals `plate` for the other treatments. */
  plateTo: string;
  /** Hairline detail: the inner ring of a disc / gradient plate, the ring itself, or the glow core. */
  accent: string;
  /** Plate / ring / glow radius as a fraction of the icon edge. */
  radius: number;
  /** Ring or hairline width as a fraction of the icon edge. */
  stroke: number;
  /** Opacity of the glow (glow only; 1 otherwise). */
  glowOpacity: number;
};

/** Plate radius per treatment (fraction of the icon edge). */
const LOOK_RADIUS: Readonly<Record<MonogramTreatment, number>> = { disc: 0.34, gradient: 0.35, ring: 0.33, glow: 0.4 };
const GLOW_OPACITY = 0.38;
/** A plate must stand off the icon background at least this much to read as a shape. */
const PLATE_MIN_SEPARATION = 1.35;
/** Letters on a plate aim for text contrast (4.5:1) and never go below the 3:1 floor. */
const PLATE_TEXT_CONTRAST = 4.5;

const LATINISH = /^[\p{Script=Latin}\p{N}]+$/u;

function treatmentFor(art: IconArt, bgs: readonly string[]): MonogramTreatment {
  const dark = bgs.length > 0 && bgs.every((b) => relativeLuminance(b) < 0.05);
  if (art.texture === 'starfield' || (dark && relativeLuminance(art.colours.accent) > 0.25)) return 'glow';
  if (art.frame === 'stitched' || art.frame === 'double') return 'ring';
  if (art.frame === 'scalloped' || art.frame === 'lace') return 'disc';
  if (art.texture === 'gingham' || art.texture === 'polka' || art.texture === 'speckle' || art.texture === 'linen') return 'disc';
  return 'gradient';
}

function weightFor(font: DisplayFont): MonogramLook['weight'] {
  if (font === 'script') return '500';
  if (font === 'serif' || font === 'mono') return '700';
  return '800';
}

/** Theme face for these letters: scripts the theme face may lack (CJK, Arabic, emoji…) use the system face. */
export function monogramFontFor(text: string, font: DisplayFont | undefined): DisplayFont {
  const f: DisplayFont = font ?? 'display';
  return LATINISH.test(text) ? f : 'display';
}

/** First theme colour that stands off the icon background; else the one that stands off most. */
function pickPlate(art: IconArt, bgs: readonly string[]): string {
  const c = art.colours;
  const candidates = [c.accent, c.primary, c.secondary, c.ink, c.light].filter(isHex).map(normalizeHex);
  if (bgs.length === 0) return candidates[0];
  const ok = candidates.find((x) => minContrast(x, bgs) >= PLATE_MIN_SEPARATION);
  if (ok) return ok;
  return candidates.reduce((best, x) => (minContrast(x, bgs) > minContrast(best, bgs) ? x : best));
}

/** Readable ink on `surfaces`: the best candidate nudged to 4.5:1, else 3:1, else black / white. */
function inkOn(surfaces: readonly string[], preferred: readonly string[]): string {
  const cands = preferred.filter(isHex).map(normalizeHex);
  const best =
    cands.length > 0 ? cands.reduce((a, b) => (minContrast(b, surfaces) > minContrast(a, surfaces) ? b : a)) : '#FFFFFF';
  if (surfaces.length === 0) return best;
  return (
    ensureContrast(best, surfaces, PLATE_TEXT_CONTRAST) ??
    ensureContrast(best, surfaces, MONOGRAM_MIN_CONTRAST) ??
    bestTextOn(surfaces[0])
  );
}

/**
 * The colours the letters actually sit on: the plate for 'disc' / 'gradient', the icon background
 * (and the glow composited over it for 'glow') otherwise. Contrast checks measure against these.
 */
export function monogramSurfaces(m: Pick<Monogram, 'look'>, backgrounds: readonly string[]): string[] {
  const bgs = backgrounds.filter(isHex).map(normalizeHex);
  const look = m.look;
  if (!look) return bgs;
  if (look.treatment === 'disc') return [look.plate];
  if (look.treatment === 'gradient') return [look.plate, look.plateTo];
  if (look.treatment === 'glow') return [...bgs, ...bgs.map((b) => composite(look.plate, look.glowOpacity, b))];
  return bgs;
}

export type ThemedMonogram = { look: MonogramLook; colour: string; fontScale: number };

/**
 * T170: a theme's monogram design for `text` on `backgrounds`, from the theme's artwork (colours,
 * frame, texture, display font). Deterministic; null when there is no artwork (the user's own
 * Icon Studio style keeps plain lettering) or the theme colours are unusable.
 */
export function themedMonogram(
  text: string,
  art: IconArt | null | undefined,
  glyphColour: string,
  backgrounds: readonly string[],
  glyphScale = 0.55,
): ThemedMonogram | null {
  if (!art || !art.colours || !text) return null;
  const c = art.colours;
  if (![c.primary, c.secondary, c.accent, c.ink, c.light].every((x) => typeof x === 'string' && isHex(x))) return null;
  const bgs = backgrounds.filter(isHex).map(normalizeHex);
  const treatment = treatmentFor(art, bgs);
  const font = monogramFontFor(text, art.displayFont);
  const radius = LOOK_RADIUS[treatment];
  let plate: string;
  let plateTo: string;
  let accent: string;
  let colour: string;
  let glowOpacity = 1;
  if (treatment === 'disc' || treatment === 'gradient') {
    plate = pickPlate(art, bgs);
    plateTo = treatment === 'gradient' ? (relativeLuminance(plate) > 0.35 ? darken(plate, 0.14) : lighten(plate, 0.14)) : plate;
    colour = inkOn([plate, plateTo], [glyphColour, c.light, c.ink, c.primary]);
    // Hairline inner ring in the theme accent when it shows on the plate, else in the letters' colour.
    const acc = normalizeHex(c.accent);
    accent = acc !== plate && contrastRatio(acc, plate) >= 1.5 ? acc : colour;
  } else if (treatment === 'ring') {
    plate = (bgs.length > 0 ? ensureContrast(c.accent, bgs, MONOGRAM_MIN_CONTRAST) : null) ?? normalizeHex(c.accent);
    plateTo = plate;
    accent = plate;
    colour = monogramColour(glyphColour, bgs);
  } else {
    plate = normalizeHex(c.accent);
    plateTo = plate;
    glowOpacity = GLOW_OPACITY;
    const surfaces = [...bgs, ...bgs.map((b) => composite(plate, glowOpacity, b))];
    colour = inkOn(surfaces, [glyphColour, c.light, c.ink]);
    accent = colour;
  }
  // Letters fit inside the plate: one grapheme up to ~1.2 r, two up to ~0.9 r.
  const n = graphemes(text).length;
  const base = monogramFontScale(text, glyphScale);
  const faceK = font === 'script' ? 1.12 : font === 'mono' && n > 1 ? 0.9 : 1;
  const cap = (n <= 1 ? 1.22 : 0.92) * radius * faceK;
  const fontScale = Math.round(Math.max(0.18, Math.min(base, cap)) * 1000) / 1000;
  return {
    look: {
      font,
      weight: weightFor(font),
      treatment,
      plate,
      plateTo,
      accent,
      radius,
      stroke: treatment === 'ring' ? 0.035 : 0.014,
      glowOpacity,
    },
    colour,
    fontScale,
  };
}

/** Most graphemes a monogram (derived or typed by the user) may have. */
export const MONOGRAM_MAX_GRAPHEMES = 2;

/**
 * T82: letters the user typed for a monogram, cleaned to at most 2 letter-like graphemes
 * (letters, digits, emoji), upper-cased where the script has case. '' when nothing usable is left,
 * which means "use the letters from the app name".
 */
export function cleanMonogramText(input: unknown): string {
  if (typeof input !== 'string') return '';
  const kept = graphemes(input.normalize('NFC'))
    .filter((g) => LETTERISH.test(Array.from(g)[0] ?? ''))
    .slice(0, MONOGRAM_MAX_GRAPHEMES);
  return kept.map(upper).join('');
}

/**
 * Full monogram for a name, or null when there is nothing to letter. `custom` (the user's own
 * letters, T82) wins over the letters derived from the name when it has anything usable.
 */
export function buildMonogram(
  name: string,
  glyphColour: string,
  backgrounds: readonly string[],
  glyphScale = 0.55,
  custom?: string | null,
  art?: IconArt | null,
): Monogram | null {
  const text = cleanMonogramText(custom) || monogramText(name);
  if (!text) return null;
  // T170: a theme with artwork designs its monograms; the user's own plain style keeps plain letters.
  const themed = themedMonogram(text, art, glyphColour, backgrounds, glyphScale);
  if (themed) return { text, fontScale: themed.fontScale, colour: themed.colour, look: themed.look };
  return { text, fontScale: monogramFontScale(text, glyphScale), colour: monogramColour(glyphColour, backgrounds) };
}
