/**
 * Larger Text rules (T74, market-1018 M2). Pure TS, no React Native.
 *
 * iOS Dynamic Type runs from xSmall (about 0.82x) to AX5 (53 pt body / 17 pt = about 3.1x); Android's
 * font size setting reaches about 2x. React Native multiplies every Text's fontSize by that
 * fontScale unless the Text sets `maxFontSizeMultiplier` (cap) or `allowFontScaling={false}`.
 *
 * Rules the remote and its sheets follow:
 * - Every Text has a role, and the role caps how far it grows (ROLE_CAP, passed to RN as
 *   maxFontSizeMultiplier). Body copy grows all the way; labels on keys stop where the key would
 *   stop being a key; the d-pad OK label keeps dpadGeometry's own cap.
 * - Labels never truncate: a row of labelled keys turns into a stack (rowOrStack) and a grid drops
 *   columns (gridColumns) when the scaled labels no longer fit the width.
 * - Keys grow with their text (minKeyHeight) and never drop under the 44 pt touch target.
 * Widths are estimates (estimateTextWidth) that err on the wide side, so a layout switches to its
 * larger-text shape a little early rather than too late.
 */
import { DPAD_MAX_FONT_SCALE } from './dpadGeometry';

/** Largest iOS accessibility size (AX5), as a font scale. */
export const AX5_FONT_SCALE = 3.1;
/** Smallest iOS text size (xSmall), as a font scale. */
export const MIN_FONT_SCALE = 0.8;
/** Smallest touch target (pt), Apple HIG. */
export const MIN_HIT = 44;
/** Line height as a share of the font size for estimates (covers the taller non-Latin scripts too). */
export const LINE_RATIO = 1.3;

/**
 * What a piece of text is, which sets how far it may grow:
 * - body: notes, sheet copy, errors, status lines. Grows all the way (AX5).
 * - label: text on buttons, segmented controls and sheet options. The button grows with it.
 * - title: sheet titles and the TV name in the header.
 * - caption: small captions under an icon and the rocker caption (VOL / CH).
 * - meta: the mono log line and latency read-out.
 * - glyph: digits drawn inside a fixed round key (they must fit the 52 pt circle).
 * - dpad: the OK label; same cap as dpadGeometry (DPAD_MAX_FONT_SCALE).
 */
export type TextRole = 'body' | 'label' | 'title' | 'caption' | 'meta' | 'glyph' | 'dpad';

/** Largest font scale each role follows (RN maxFontSizeMultiplier). */
export const ROLE_CAP: Readonly<Record<TextRole, number>> = {
  body: AX5_FONT_SCALE,
  label: 2.4,
  title: 2.2,
  caption: 2,
  meta: 2,
  glyph: 1.6,
  dpad: DPAD_MAX_FONT_SCALE,
};

export const TEXT_ROLES: readonly TextRole[] = Object.keys(ROLE_CAP) as TextRole[];

/** RN maxFontSizeMultiplier for a role. */
export function roleCap(role: TextRole): number {
  return ROLE_CAP[role];
}

/** A usable font scale: NaN / 0 / negative -> 1, never below MIN_FONT_SCALE. */
export function normalizeFontScale(fontScale: number | null | undefined): number {
  if (fontScale == null || !Number.isFinite(fontScale) || fontScale <= 0) return 1;
  return Math.max(MIN_FONT_SCALE, fontScale);
}

/** The multiplier a Text of this role actually gets (what RN applies with maxFontSizeMultiplier). */
export function roleScale(fontScale: number | null | undefined, role: TextRole): number {
  return Math.min(normalizeFontScale(fontScale), ROLE_CAP[role]);
}

/** Rendered font size (pt) of a Text with base size `base`. */
export function scaledFontSize(base: number, fontScale: number | null | undefined, role: TextRole): number {
  return base * roleScale(fontScale, role);
}

/** Estimated line height (pt) of that Text. */
export function scaledLineHeight(base: number, fontScale: number | null | undefined, role: TextRole): number {
  return Math.ceil(scaledFontSize(base, fontScale, role) * LINE_RATIO);
}

/** Advance width of one character in em (conservative: semibold UI fonts, wide side). */
function charEm(ch: string): number {
  const c = ch.codePointAt(0) ?? 0;
  if (ch === ' ') return 0.3;
  // CJK ideographs, kana, Hangul, full-width forms: one em each.
  if ((c >= 0x2e80 && c <= 0x9fff) || (c >= 0xac00 && c <= 0xd7af) || (c >= 0xf900 && c <= 0xfaff) || (c >= 0xff00 && c <= 0xffef)) return 1;
  // Combining marks (Devanagari matras, Arabic harakat) add little width.
  if ((c >= 0x0300 && c <= 0x036f) || (c >= 0x0900 && c <= 0x0903) || (c >= 0x093a && c <= 0x094f) || (c >= 0x064b && c <= 0x065f)) return 0.15;
  if (c >= 0x0900 && c <= 0x097f) return 0.66; // Devanagari
  if (c >= 0x0600 && c <= 0x06ff) return 0.5; // Arabic
  if (/[A-Z0-9MW]/.test(ch)) return 0.68;
  if (/[iljtf.,:;'!|]/.test(ch)) return 0.32;
  return 0.58;
}

/** Estimated width (pt) of `text` on one line at `fontSize` (pt), plus letterSpacing per character. */
export function estimateTextWidth(text: string, fontSize: number, letterSpacing = 0): number {
  let em = 0;
  let n = 0;
  for (const ch of text) {
    em += charEm(ch);
    n += 1;
  }
  return Math.ceil(em * fontSize + n * letterSpacing);
}

/** Width (pt) of the widest single word: the narrowest a wrapping label can get without breaking a word. */
export function longestWordWidth(text: string, fontSize: number, letterSpacing = 0): number {
  // CJK has no spaces but may break between any two characters: treat each as a word.
  const words = text.split(/\s+/).flatMap((w) => (/[⺀-鿿가-힯]/.test(w) ? [...w] : [w]));
  return words.reduce((m, w) => Math.max(m, estimateTextWidth(w, fontSize, letterSpacing)), 0);
}

export interface LabelSpec {
  /** Base (unscaled) font size, pt. */
  fontSize: number;
  fontScale: number | null | undefined;
  role: TextRole;
  letterSpacing?: number;
  /** Horizontal padding inside each item (per side), pt. */
  padH?: number;
  /** Fixed extra width inside each item (an icon and its gap), pt. */
  extra?: number;
}

/** Estimated outer width (pt) of one item holding `label` on a single line. */
export function itemWidth(label: string, spec: LabelSpec): number {
  const size = scaledFontSize(spec.fontSize, spec.fontScale, spec.role);
  return estimateTextWidth(label, size, spec.letterSpacing ?? 0) + 2 * (spec.padH ?? 0) + (spec.extra ?? 0);
}

/** True when items of these widths fit side by side in `available` pt with `gap` between them. */
export function fitsInRow(available: number, widths: readonly number[], gap = 0): boolean {
  if (widths.length === 0) return true;
  const total = widths.reduce((a, b) => a + b, 0) + gap * (widths.length - 1);
  return total <= available;
}

/**
 * Row or stack for a set of labelled items (segmented control, button pair, labelled key row):
 * 'row' while every label fits on one line side by side, else 'stack' (one item per line, full width).
 * `minItem` is the item's own minimum width (e.g. a 64 pt labelled key).
 */
export function rowOrStack(
  available: number,
  labels: readonly string[],
  spec: LabelSpec & { gap?: number; minItem?: number },
): 'row' | 'stack' {
  const widths = labels.map((l) => Math.max(spec.minItem ?? 0, itemWidth(l, spec)));
  return fitsInRow(available, widths, spec.gap ?? 0) ? 'row' : 'stack';
}

/**
 * How many columns a grid of labelled options gets: the most (<= preferred) whose cells still hold
 * the widest label. `wrap: true` lets a label wrap between words, so only its longest word has to
 * fit; otherwise the whole label must fit on one line. Never fewer than 1.
 */
export function gridColumns(
  available: number,
  preferred: number,
  labels: readonly string[],
  spec: LabelSpec & { gap?: number; wrap?: boolean },
): number {
  const size = scaledFontSize(spec.fontSize, spec.fontScale, spec.role);
  const ls = spec.letterSpacing ?? 0;
  const pad = 2 * (spec.padH ?? 0) + (spec.extra ?? 0);
  const need = labels.reduce(
    (m, l) => Math.max(m, (spec.wrap ? longestWordWidth(l, size, ls) : estimateTextWidth(l, size, ls)) + pad),
    0,
  );
  const gap = spec.gap ?? 0;
  for (let n = Math.max(1, Math.floor(preferred)); n > 1; n -= 1) {
    if ((available - gap * (n - 1)) / n >= need) return n;
  }
  return 1;
}

/**
 * Cell width (percent string) for a space-between grid of `columns` columns. 3 and 2 columns keep
 * the prototype's 31.5% / 48.5% cells (gap about 2.75% / 3%).
 */
export function gridCellWidth(columns: number): `${number}%` {
  if (columns <= 1) return '100%';
  if (columns === 2) return '48.5%';
  if (columns === 3) return '31.5%';
  return `${Math.floor((100 - 3 * (columns - 1)) / columns)}%`;
}

/**
 * Lines a label may use before it ellipsises: 1 at default sizes, more as the text grows, so a
 * long TV name wraps instead of being cut at larger text sizes.
 */
export function maxLines(fontScale: number | null | undefined, base = 1): number {
  const s = normalizeFontScale(fontScale);
  if (s < 1.3) return base;
  if (s < 2) return base + 1;
  return base + 2;
}

/**
 * Smallest height (pt) of a key holding `lines` lines of a label: the label plus vertical padding,
 * never less than `floor` (default MIN_HIT 44 pt) so the key stays a comfortable target. A smaller
 * floor is only for controls whose hitSlop makes up the difference (the 32 pt segmented buttons
 * with an 8 pt hitSlop are 48 pt to the finger).
 */
export function minKeyHeight(
  base: number,
  fontScale: number | null | undefined,
  role: TextRole,
  opts: { lines?: number; padV?: number; floor?: number } = {},
): number {
  const lines = Math.max(1, opts.lines ?? 1);
  const text = scaledLineHeight(base, fontScale, role) * lines;
  return Math.max(opts.floor ?? MIN_HIT, Math.ceil(text + 2 * (opts.padV ?? 8)));
}

/** Content width (pt) inside a bottom sheet (src/ui/Sheet.tsx: max 440 wide, 16 pt side padding). */
export function sheetContentWidth(windowWidth: number): number {
  return Math.max(0, Math.min(windowWidth, 440) - 32);
}

/**
 * Content width (pt) inside the remote card: window minus the 16 pt gutters and the card's 18 pt
 * padding; one-handed mode narrows the column to 86% first.
 */
export function remoteContentWidth(windowWidth: number, oneHanded = false): number {
  const column = Math.max(0, windowWidth - 32) * (oneHanded ? 0.86 : 1);
  return Math.max(0, Math.floor(column - 36));
}
