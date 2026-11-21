/**
 * The machined remote (Nov 2026 overhaul, DESIGN.md "The logo remote"): the in-app remote is drawn as the remote in
 * the owner's app icon and opening animation (src/core/introRemote.ts), at any size and in any remote theme.
 *
 * Pure TS, no React Native: shape data for react-native-svg (DPadFace.tsx) built from the same generators the
 * opening animation uses (conicWedges for spun metal, brushLines for the machining marks), so the remote, the splash
 * and the icon share one look. Themes only change colours (owner-1017): a theme with a metal d-pad (`spun`) gets the
 * spun finish, the rest a smooth one in their own colours. Geometry stays dpadGeometry's (fb-1017-ok): the OK key
 * is the same true circle, about 52% of the ring (fb-1017b H1), with the same hit areas.
 */
import { brushLines, conicWedges, OK_GOLD, RING_GOLD, type Gradient, type Shape } from '../../core/introRemote';
import { luminance, type RemoteTheme } from '../../theme/remoteThemes';
import { mixHex } from '../icons/keyFaceColors';

/** Themes whose d-pad ring is metal: spun (conic) finish with machining lines, like the icon. */
export const SPUN_THEMES: ReadonlySet<string> = new Set(['charcoal', 'aluminium']);
/** Themes whose OK key is metal (brass on Walnut and Forest as well). */
export const SPUN_OK_THEMES: ReadonlySet<string> = new Set(['charcoal', 'aluminium', 'walnut', 'forest']);

/** The icon's own gold (Charcoal & Gold): its ring and OK colours. */
const ICON_RING = '#C9A26C';
const ICON_OK = '#D2AB72';

function mean(samples: readonly string[]): number {
  return samples.reduce((s, c) => s + luminance(c), 0) / samples.length;
}

/**
 * Spun-metal colour samples for a base colour: the icon's gold samples when the base is the icon's gold, otherwise
 * the same light/dark pattern (each sample's luminance relative to the gold's mean) applied to the base, so every
 * metal theme gets the icon's lobes in its own colour. `flat` returns one colour (no sheen).
 */
export function metalSamples(base: string, which: 'ring' | 'ok', spun: boolean): string[] {
  if (!spun) return [base];
  const ref = which === 'ring' ? RING_GOLD : OK_GOLD;
  if (base.toUpperCase() === (which === 'ring' ? ICON_RING : ICON_OK)) return [...ref];
  const m = mean(ref);
  return ref.map((c) => {
    const d = luminance(c) - m;
    return d >= 0 ? mixHex(base, '#FFFFFF', Math.min(0.6, d * 1.6)) : mixHex(base, '#000000', Math.min(0.5, -d * 1.4));
  });
}

/** Radii (pt) of the pad's parts for a ring `diameter` and OK key `keySize` (both from dpadGeometry). */
export function padRadii(diameter: number, keySize: number) {
  const outer = diameter / 2;
  // The icon: well radius 297, gold ring 283 (a thin dark rim of the well shows around the gold).
  const ring = Math.round(outer * (283 / 297) * 10) / 10;
  // Black groove around the OK key: the icon's 128 vs 114 for the key.
  const key = keySize / 2;
  const groove = Math.round(key * (128 / 114) * 10) / 10;
  return { outer, ring, groove, key };
}

/** Where each arrow nub sits (pt from the centre) and its size: centred in the gold band, like the icon. */
export function nubSpec(diameter: number, keySize: number) {
  const r = padRadii(diameter, keySize);
  const band = r.ring - r.groove;
  const height = Math.max(8, Math.round(band * 0.34));
  const base = Math.round(height * (74 / 52));
  return { dist: Math.round((r.ring + r.groove) / 2), base, height };
}

type Dir = 'up' | 'right' | 'down' | 'left';
const DEG: Record<Dir, number> = { up: 0, right: 90, down: 180, left: 270 };

function rot(p: [number, number], deg: number, c: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  const dx = p[0] - c;
  const dy = p[1] - c;
  return [c + dx * Math.cos(a) - dy * Math.sin(a), c + dx * Math.sin(a) + dy * Math.cos(a)];
}

const f = (n: number) => (Math.round(n * 100) / 100).toString();

/** A soft-cornered triangle (apex outward) as an SVG path, in pad coordinates (origin top-left, centre c). */
export function nubPath(dir: Dir, c: number, dist: number, base: number, height: number): string {
  const cy = c - dist;
  const pts: [number, number][] = [
    [c, cy - height / 2],
    [c + base / 2, cy + height / 2],
    [c - base / 2, cy + height / 2],
  ].map((p) => rot(p as [number, number], DEG[dir], c));
  const r = Math.max(1.5, height * 0.17);
  let d = '';
  for (let i = 0; i < 3; i++) {
    const prev = pts[(i + 2) % 3]!;
    const cur = pts[i]!;
    const next = pts[(i + 1) % 3]!;
    const toward = (a: [number, number], b: [number, number]) => {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const k = Math.min(r, len / 2) / len;
      return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
    };
    const a = toward(cur, prev);
    const b = toward(cur, next);
    d += `${i === 0 ? 'M' : 'L'} ${f(a[0]!)} ${f(a[1]!)} Q ${f(cur[0])} ${f(cur[1])} ${f(b[0]!)} ${f(b[1]!)} `;
  }
  return d + 'Z';
}

export interface PadModel {
  gradients: Gradient[];
  shapes: Shape[];
}

/** Colours the pad needs from a remote theme. */
export type PadTheme = Pick<RemoteTheme, 'id' | 'body' | 'ring' | 'ringInk' | 'muted' | 'keyEdge' | 'accent'>;

/** Dark well colours for the theme's body (deep on dark bodies, a soft dip on light ones). */
export function wellColors(body: string): { deep: string; mid: string; lip: string } {
  const dark = luminance(body) < 0.18;
  return dark
    ? { deep: mixHex(body, '#000000', 0.7), mid: mixHex(body, '#000000', 0.45), lip: mixHex(body, '#FFFFFF', 0.08) }
    : { deep: mixHex(body, '#000000', 0.32), mid: mixHex(body, '#000000', 0.18), lip: mixHex(body, '#FFFFFF', 0.5) };
}

/**
 * The static d-pad face (well, ring, machining, groove, nubs) for a ring `diameter` and OK key `keySize`. The OK key
 * is separate (okModel) because it moves on press. Wedge and line counts are kept modest: this renders once per size
 * and theme (memoised), never per press.
 */
export function padModel(t: PadTheme, diameter: number, keySize: number, prefix = 'p'): PadModel {
  const c = diameter / 2;
  const r = padRadii(diameter, keySize);
  const spun = SPUN_THEMES.has(t.id);
  const well = wellColors(t.body);
  const shadeInk = mixHex(t.ring, '#000000', 0.75);
  const ring = conicWedges(`${prefix}w`, c, c, r.groove - 1, r.ring, metalSamples(t.ring, 'ring', spun), spun ? 48 : 4);
  const nub = nubSpec(diameter, keySize);
  const nubInk = t.ringInk ?? t.muted;
  const gradients: Gradient[] = [
    { id: `${prefix}well`, type: 'radial', attrs: { cx: c, cy: c, r: r.outer }, stops: [[0.9, well.deep], [0.97, well.mid], [1, well.lip]] },
    { id: `${prefix}shade`, type: 'radial', attrs: { cx: c, cy: c, r: r.ring }, stops: [[0.45, shadeInk, 0.3], [0.55, shadeInk, 0], [0.92, shadeInk, 0], [1, shadeInk, 0.28]] },
    {
      id: `${prefix}bevel`,
      type: 'linear',
      attrs: { x1: c - r.ring, y1: c - r.ring, x2: c + r.ring, y2: c + r.ring },
      stops: [[0, mixHex(t.ring, '#FFFFFF', 0.75), 0.95], [0.5, t.ring, 0.2], [1, mixHex(t.ring, '#000000', 0.55), 0.9]],
    },
    {
      id: `${prefix}lip`,
      type: 'linear',
      attrs: { x1: c - r.groove, y1: c - r.groove, x2: c + r.groove, y2: c + r.groove },
      stops: [[0, mixHex(t.ring, '#000000', 0.6), 0.9], [1, mixHex(t.ring, '#FFFFFF', 0.7), 0.7]],
    },
    ...ring.gradients,
  ];
  const shapes: Shape[] = [
    { kind: 'circle', attrs: { cx: c, cy: c, r: r.outer, fill: `url(#${prefix}well)` } },
    ...ring.shapes,
    ...(spun ? brushLines(c, c, r.groove, r.ring - 1, 70, 7) : []),
    { kind: 'circle', attrs: { cx: c, cy: c, r: r.ring, fill: `url(#${prefix}shade)` } },
    { kind: 'circle', attrs: { cx: c, cy: c, r: r.ring - 0.75, fill: 'none', stroke: `url(#${prefix}bevel)`, strokeWidth: 1.5 } },
    { kind: 'circle', attrs: { cx: c, cy: c, r: r.groove, fill: 'none', stroke: `url(#${prefix}lip)`, strokeWidth: 1.5 } },
    { kind: 'circle', attrs: { cx: c, cy: c, r: r.groove - 0.75, fill: mixHex(well.deep, '#000000', 0.4) } },
    ...(['up', 'right', 'down', 'left'] as const).map(
      (d): Shape => ({ kind: 'path', attrs: { d: nubPath(d, c, nub.dist, nub.base, nub.height), fill: nubInk } }),
    ),
  ];
  return { gradients, shapes };
}

/** The OK key's face (spun or smooth accent, dome light, bevel) for a key of `size` pt. */
export function okModel(t: Pick<RemoteTheme, 'id' | 'accent'>, size: number, prefix = 'k'): PadModel {
  const c = size / 2;
  const r = c;
  const spun = SPUN_OK_THEMES.has(t.id);
  const face = conicWedges(`${prefix}o`, c, c, 0, r, metalSamples(t.accent, 'ok', spun), spun ? 48 : 4);
  const gradients: Gradient[] = [
    { id: `${prefix}dome`, type: 'radial', attrs: { cx: c - r * 0.26, cy: c - r * 0.35, r: r * 1.5 }, stops: [[0, '#FFF6DF', 0.2], [0.6, '#FFF6DF', 0], [1, '#000000', 0.22]] },
    {
      id: `${prefix}bevel`,
      type: 'linear',
      attrs: { x1: 0, y1: 0, x2: size, y2: size },
      stops: [[0, mixHex(t.accent, '#FFFFFF', 0.8), 0.95], [0.5, t.accent, 0.1], [1, mixHex(t.accent, '#000000', 0.6), 0.85]],
    },
    ...face.gradients,
  ];
  const shapes: Shape[] = [
    ...face.shapes,
    ...(spun ? brushLines(c, c, 3, r - 1, 40, 23) : []),
    { kind: 'circle', attrs: { cx: c, cy: c, r, fill: `url(#${prefix}dome)` } },
    { kind: 'circle', attrs: { cx: c, cy: c, r: r - 0.75, fill: 'none', stroke: `url(#${prefix}bevel)`, strokeWidth: 1.5 } },
  ];
  return { gradients, shapes };
}

/** Domed key-cap colours (lit from the top left like the icon's buttons) and its socket, from the theme's key. */
export function capColors(t: Pick<RemoteTheme, 'key' | 'keyEdge' | 'body'>) {
  const dark = luminance(t.key) < 0.4;
  return {
    hi: mixHex(t.key, '#FFFFFF', dark ? 0.12 : 0.6),
    mid: t.key,
    lo: mixHex(t.key, t.keyEdge, dark ? 0.45 : 0.2),
    rimTop: mixHex(t.key, '#FFFFFF', dark ? 0.35 : 0.8),
    rimBottom: mixHex(t.key, '#000000', dark ? 0.6 : 0.15),
    socket: wellColors(t.body).deep,
    socketLip: wellColors(t.body).lip,
  };
}

/** How far (degrees) the d-pad rocks toward a pressed arrow, like a real rocker pad. 0 under Reduce Motion. */
export const PAD_TILT_DEG = 5;
/** Perspective for the tilt (pt): a shallow, physical rock rather than a card flip. */
export const PAD_PERSPECTIVE = 700;

/** Rotation for a pressed side: the pressed edge goes into the remote. */
export function tiltFor(dir: Dir | null): { rotateX: number; rotateY: number } {
  if (dir === 'up') return { rotateX: PAD_TILT_DEG, rotateY: 0 };
  if (dir === 'down') return { rotateX: -PAD_TILT_DEG, rotateY: 0 };
  if (dir === 'right') return { rotateX: 0, rotateY: PAD_TILT_DEG };
  if (dir === 'left') return { rotateX: 0, rotateY: -PAD_TILT_DEG };
  return { rotateX: 0, rotateY: 0 };
}
