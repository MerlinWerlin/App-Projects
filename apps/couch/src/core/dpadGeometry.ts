/**
 * D-pad geometry (fb-1017-ok, oversight D63-1). Pure TS, no React Native.
 *
 * Everything on the direction pad is derived from ONE size variable, the ring diameter, so the
 * centre OK key is always a true circle exactly centred in the ring with an equal gap all round,
 * never clipped, and the four arrow hit areas stay symmetric around it. Themes never change these
 * numbers (src/theme/remoteThemes.ts carries colours/texture only).
 */

/** Largest ring diameter (pt). The prototype's 260px pad. */
export const DPAD_MAX_DIAMETER = 260;
/**
 * OK key diameter as a share of the ring diameter. fb-1017b H1: the owner found the 40% key "very
 * small", so it is about 52% (was 0.40, fb-1017-ok).
 */
export const DPAD_KEY_RATIO = 0.52;
/**
 * Smallest share the key may shrink to on a tiny pad. The arrow band (ring minus key, per side)
 * must stay at least DPAD_MIN_BAND deep; below a ~184 pt diameter the key gives up width, down to
 * 50%, to keep that band. Phones never hit this (SE 1st gen gets a 252 pt pad, band 61 pt); only
 * small previews (app/themes.tsx, 132 pt) do, and those are not touch targets.
 */
export const DPAD_MIN_KEY_RATIO = 0.5;
/** Minimum depth (pt) of each arrow's band: the 44 pt touch-target minimum. */
export const DPAD_MIN_BAND = 44;
/** Inset of the lit inner-ring arcs from the pad edge, and their stroke, as shares of the diameter. */
const RING_INSET_RATIO = 5 / 260;
const RING_STROKE_RATIO = 7 / 260;
/** Inner border ("halo") of the OK key as a share of the key diameter. Drawn inside the key. */
const KEY_BORDER_RATIO = 6 / 104;
/** Dynamic Type: the OK label grows with the user's text size up to this factor, then stops. */
export const DPAD_MAX_FONT_SCALE = 1.35;

export interface DpadRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DpadGeometry {
  /** Ring (pad) diameter, an even integer. */
  diameter: number;
  ringInset: number;
  ringStroke: number;
  key: {
    /** OK key diameter, an even integer. */
    size: number;
    /** Distance from the pad's top/left edge to the key's top/left edge (same on all four sides). */
    offset: number;
    radius: number;
    border: number;
    /** Gap between the key's edge and the inner edge of the ring arcs (equal all round). */
    gap: number;
  };
  /**
   * Raised-bevel gradient stops on the OK face, as shares of the key's height from its top:
   * highlight fades out by `highlightEnd`, the bottom shade starts at `shadeStart`. The label box
   * sits between them, so it is always drawn on the plain accent colour (AA unchanged).
   */
  bevel: { highlightEnd: number; shadeStart: number };
  label: {
    fontSize: number;
    /** Equal to fontSize: no extra leading, so the glyphs sit on the key's optical centre. */
    lineHeight: number;
    /** Widest the label may be before it shrinks to fit (inside the key's border). */
    maxWidth: number;
  };
  arrows: { up: DpadRect; down: DpadRect; left: DpadRect; right: DpadRect };
  /** Arrow icon box (RemoteIcon size, pt), an even integer that fits well inside its band. */
  arrowIcon: { size: number };
}

const even = (n: number) => Math.max(2, Math.floor(n / 2) * 2);

/**
 * @param available width (pt) the pad may occupy (measured with onLayout, or estimated from the
 *   window width before the first layout).
 * @param fontScale the system text-size multiplier (PixelRatio.getFontScale()); 1 = default.
 */
export function dpadGeometry(available: number, fontScale = 1): DpadGeometry {
  const room = Number.isFinite(available) && available > 0 ? available : DPAD_MAX_DIAMETER;
  // Never wider than the space it is given (never clipped), never larger than the design size.
  const diameter = even(Math.min(DPAD_MAX_DIAMETER, room));
  // ~52%, but never leave less than DPAD_MIN_BAND per side (down to 50% on tiny pads).
  const floorShare = Math.ceil((diameter * DPAD_MIN_KEY_RATIO) / 2) * 2; // even, >= 50%
  const size = Math.max(
    floorShare,
    even(Math.min(diameter * DPAD_KEY_RATIO, Math.max(diameter * DPAD_MIN_KEY_RATIO, diameter - 2 * DPAD_MIN_BAND))),
  );
  const offset = (diameter - size) / 2; // integer: both are even
  const ringInset = Math.round(diameter * RING_INSET_RATIO);
  const ringStroke = Math.max(4, Math.round(diameter * RING_STROKE_RATIO));
  const border = Math.max(3, Math.round(size * KEY_BORDER_RATIO));
  const gap = offset - ringInset - ringStroke;

  const scale = Math.min(Math.max(fontScale || 1, 1), DPAD_MAX_FONT_SCALE);
  const inner = size - 2 * border;
  // Bold label ~20-22 pt at scale 1 on phones (key 130-134 pt), grows with the key and Dynamic Type.
  const fontSize = Math.min(Math.round(size * 0.157 * scale), Math.floor(inner * 0.36));
  const maxWidth = Math.floor(inner * 0.86);

  const arrowIcon = even(diameter * (26 / 260));
  return {
    diameter,
    ringInset,
    ringStroke,
    key: { size, offset, radius: size / 2, border, gap },
    bevel: { highlightEnd: 0.36, shadeStart: 0.64 },
    label: { fontSize, lineHeight: fontSize, maxWidth },
    arrows: {
      up: { x: offset, y: 0, w: size, h: offset },
      down: { x: offset, y: offset + size, w: size, h: offset },
      left: { x: 0, y: offset, w: offset, h: size },
      right: { x: offset + size, y: offset, w: offset, h: size },
    },
    arrowIcon: { size: arrowIcon },
  };
}

/** Width the remote card leaves for the pad on a phone of the given window width (pt). */
export function dpadAvailableWidth(windowWidth: number, gutter = 16, cardPadding = 18): number {
  return Math.max(0, windowWidth - 2 * gutter - 2 * cardPadding);
}
