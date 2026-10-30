// Icon specs: the whole-set IconStyle plus per-app overrides resolve to one IconSpec per app.
// Pure TS (no React Native / Expo). Precedence for every field: override > style > app default.

import type { IconArt } from './artwork.ts';
import { isKnownGlyph } from './glyphnames.ts';
import { MONOGRAM_GLYPH, buildMonogram, monogramSurfaces, type Monogram } from './monogram.ts';

export type IconShape = 'squircle' | 'circle' | 'rounded' | 'square' | 'blob';

export type IconBackground =
  | { kind: 'solid'; colour: string }
  | { kind: 'gradient'; from: string; to: string; angle: number }
  | { kind: 'glass'; tint: string; opacity: number };

/** Style applied to the whole icon set (Icon Studio controls / a theme's icon style). */
export type IconStyle = {
  shape: IconShape;
  background: IconBackground;
  glyphColour: string;
  glyphSet: string;
  showLabel: boolean;
  glyphScale: number;
  /** Theme artwork (texture, corner stickers, frame). Absent = plain icon (Icon Studio's manual style). */
  art?: IconArt;
};

/** Minimal app input (kept local; the catalogue module supplies objects of this shape). */
export type IconApp = {
  id: string;
  name: string;
  urlScheme: string | null;
  glyph: string;
};

/** Per-app override; any field left out falls back to the style, then the app defaults. */
export type IconOverride = {
  label?: string;
  glyph?: string;
  glyphColour?: string;
  background?: IconBackground;
  shape?: IconShape;
  showLabel?: boolean;
  glyphScale?: number;
  overrideImage?: string;
  /**
   * T82: the user's own monogram letters (1–2 graphemes). Used whenever the icon shows a monogram
   * (glyph MONOGRAM_GLYPH or no shipped glyph); empty or absent = letters from the label.
   */
  monogramText?: string;
};

export type IconSpec = {
  appId: string;
  label: string;
  urlScheme: string | null;
  shape: IconShape;
  background: IconBackground;
  glyph: string;
  glyphSet: string;
  glyphColour: string;
  glyphScale: number;
  showLabel: boolean;
  overrideImage?: string;
  /** Theme artwork; an override image replaces it (the shape stays). */
  art?: IconArt;
  /**
   * T66: lettering drawn instead of the glyph when the app has no glyph we ship (custom apps,
   * MONOGRAM_GLYPH, an empty or unknown glyph name). Absent when a real glyph is drawn.
   */
  monogram?: Monogram;
};

/** True when `glyph` names no shipped glyph, so the icon should show the app's monogram. */
export function wantsMonogram(glyph: string | null | undefined): boolean {
  const g = typeof glyph === 'string' ? glyph.trim().toLowerCase() : '';
  return g === '' || g === MONOGRAM_GLYPH || !isKnownGlyph(g);
}

/**
 * Monogram for a lightweight preview (picker rows, HomeMock, the Android pin path) drawn without
 * a full resolve; undefined when the glyph is real. `custom` = the user's own letters (T82).
 */
export function previewMonogram(
  name: string,
  glyph: string,
  style: Pick<IconStyle, 'background' | 'glyphColour' | 'glyphScale' | 'art'>,
  custom?: string | null,
): Monogram | undefined {
  if (!wantsMonogram(glyph)) return undefined;
  return buildMonogram(name, style.glyphColour, backgroundColours(style.background), style.glyphScale, custom, style.art) ?? undefined;
}

/** The fields withMonogram reads; IconSpec and lighter preview specs both fit. */
export type MonogramDrawable = {
  label?: string;
  glyph: string;
  glyphColour: string;
  glyphScale: number;
  background: IconBackground;
  /** T170: theme artwork, which designs the monogram (font, plate, ring, glow). */
  art?: IconArt;
  monogram?: Monogram;
};

/**
 * T82: make a spec's monogram agree with its glyph before it is drawn anywhere (HomeMock, the
 * Android pinned-shortcut PNGs), exactly as resolveSpec does for the iOS install path:
 *  - a real glyph never carries a stale monogram;
 *  - a monogram spec without one (built by hand, or stored before T66) gets the label's letters;
 *  - a monogram already present (possibly the user's own letters) is kept as is.
 * Returns the same object when nothing changes, so it is cheap to map over every render.
 */
export function withMonogram<T extends MonogramDrawable>(spec: T): T {
  if (!wantsMonogram(spec.glyph)) {
    if (spec.monogram === undefined) return spec;
    const copy = { ...spec };
    delete copy.monogram;
    return copy;
  }
  if (spec.monogram && spec.monogram.text.length > 0) return spec;
  const m = previewMonogram(spec.label ?? '', spec.glyph, spec);
  if (!m) {
    if (spec.monogram === undefined) return spec;
    const copy = { ...spec };
    delete copy.monogram;
    return copy;
  }
  return { ...spec, monogram: m };
}

export type InstallMethod = 'profile' | 'shortcuts';

function nonEmpty(s: string | undefined): s is string {
  return typeof s === 'string' && s.trim().length > 0;
}

export function resolveSpec(app: IconApp, style: IconStyle, override?: IconOverride): IconSpec {
  const o: IconOverride = override ?? {};
  const spec: IconSpec = {
    appId: app.id,
    label: nonEmpty(o.label) ? o.label.trim() : app.name,
    urlScheme: app.urlScheme && app.urlScheme.trim() ? app.urlScheme.trim() : null,
    shape: o.shape ?? style.shape,
    background: o.background ?? style.background,
    glyph: nonEmpty(o.glyph) ? o.glyph : app.glyph,
    glyphSet: style.glyphSet,
    glyphColour: nonEmpty(o.glyphColour) ? o.glyphColour : style.glyphColour,
    glyphScale: typeof o.glyphScale === 'number' && Number.isFinite(o.glyphScale) ? o.glyphScale : style.glyphScale,
    showLabel: typeof o.showLabel === 'boolean' ? o.showLabel : style.showLabel,
  };
  if (nonEmpty(o.overrideImage)) spec.overrideImage = o.overrideImage;
  if (style.art) spec.art = style.art;
  if (wantsMonogram(spec.glyph)) {
    const m = buildMonogram(
      spec.label,
      spec.glyphColour,
      backgroundColours(spec.background),
      spec.glyphScale,
      o.monogramText,
      style.art,
    );
    if (m) spec.monogram = m;
  }
  return spec;
}

/** Theme/style -> per-app specs, in the order of `apps`. */
export function resolveSpecs(
  apps: IconApp[],
  style: IconStyle,
  overrides: Record<string, IconOverride> = {},
): IconSpec[] {
  return apps.map((app) => resolveSpec(app, style, Object.prototype.hasOwnProperty.call(overrides, app.id) ? overrides[app.id] : undefined));
}

/** Apps with a URL scheme can go in the bulk web clip profile; the rest use Shortcuts. */
export function installMethodFor(spec: { urlScheme: string | null }): InstallMethod {
  return spec.urlScheme && spec.urlScheme.trim() ? 'profile' : 'shortcuts';
}

// ---- contrast (WCAG ≥ 3:1 between glyph and background) ----

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function luminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio of two hex colours, or null if either is not a hex colour. */
export function contrastRatio(a: string, b: string): number | null {
  const ra = parseHex(a);
  const rb = parseHex(b);
  if (!ra || !rb) return null;
  const la = luminance(ra);
  const lb = luminance(rb);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function backgroundColours(bg: IconBackground): string[] {
  if (bg.kind === 'solid') return [bg.colour];
  if (bg.kind === 'gradient') return [bg.from, bg.to];
  return [bg.tint];
}

/** Lowest glyph/background contrast across the background's colours (null if unknown). */
export function specContrast(spec: IconSpec): number | null {
  let min: number | null = null;
  // T82: a monogram is drawn in its own (contrast-corrected) colour, so measure that.
  const lettered = !spec.overrideImage && spec.monogram ? spec.monogram : null;
  const fg = lettered ? lettered.colour : spec.glyphColour;
  // T170: a themed monogram's letters sit on its plate (or glow), so measure against that.
  const under = lettered?.look ? monogramSurfaces(lettered, backgroundColours(spec.background)) : backgroundColours(spec.background);
  for (const c of under) {
    const r = contrastRatio(fg, c);
    if (r === null) return null;
    min = min === null ? r : Math.min(min, r);
  }
  return min;
}

export const MIN_GLYPH_CONTRAST = 3;

/** App ids whose glyph contrast is below 3:1 (photo overrides are skipped). */
export function contrastWarnings(specs: IconSpec[], min: number = MIN_GLYPH_CONTRAST): string[] {
  const out: string[] = [];
  for (const s of specs) {
    if (s.overrideImage) continue;
    const r = specContrast(s);
    if (r !== null && r < min) out.push(s.appId);
  }
  return out;
}
