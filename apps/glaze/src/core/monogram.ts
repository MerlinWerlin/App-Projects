// Monogram fallback (T66): an app with no glyph (a custom app, or a glyph name we don't ship)
// gets 1–2 letters from its own name instead of a generic placeholder shape. Original lettering,
// never a brand logo. Pure TS (no React Native / Expo) so Node can run and test it directly.

import { bestTextOn, ensureContrast, isHex, normalizeHex } from './colour.ts';

/** Glyph value meaning "draw the app's monogram". New custom apps start with it. */
export const MONOGRAM_GLYPH = 'monogram';

/** Monogram lettering needs the same ≥ 3:1 as glyphs (WCAG non-text contrast). */
export const MONOGRAM_MIN_CONTRAST = 3;

export type Monogram = {
  /** 1–2 graphemes, upper-cased where the script has case. */
  text: string;
  /** Font size as a fraction of the icon edge. */
  fontScale: number;
  /** Text colour, ≥ 3:1 against every background colour when reachable. */
  colour: string;
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
): Monogram | null {
  const text = cleanMonogramText(custom) || monogramText(name);
  if (!text) return null;
  return { text, fontScale: monogramFontScale(text, glyphScale), colour: monogramColour(glyphColour, backgrounds) };
}
