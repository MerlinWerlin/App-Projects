/**
 * Opening animation (night-intro, owner 23 Oct 2026: "each app its own little logo and animation on start up ...
 * maybe do a little remote being pressed").
 *
 * Pure TS, no imports: the remote face from the owner's icon (assets/brand/icon.png) as plain shape data, and the
 * press sequence as keyframe tracks on one clock. The UI (src/ui/IntroRemote.tsx) maps the shapes to react-native-svg
 * and the tracks to Animated interpolations (native driver); tools/render-intro.mjs maps the same data to SVG/CSS to
 * render the native splash image (the first frame) and preview frames. So the splash, the overlay and the previews
 * can never drift apart.
 *
 * Coordinates: one 1024 x 1024 viewBox; the remote panel sits at 40..984 with room for its soft shadow. The d-pad is
 * physical art and never mirrors in right-to-left languages.
 */

// ---------------------------------------------------------------------------------------------------------------
// Sizes

/** Points. Must equal the expo-splash-screen imageWidth in app.json (tests/intro-remote.test.ts checks). */
export const INTRO_SIZE = 200;
/** Splash and overlay background, light and dark: the near-black under the panel. */
export const INTRO_BG = '#0E0E0F';
export const VIEW = 1024;

export const PANEL = { x: 40, y: 40, w: 944, h: 944, r: 211 } as const;
export const RING = { cx: 512, cy: 390, r: 283, recess: 297 } as const;
export const OK_KEY = { r: 114, groove: 128 } as const;
export const NUB = { dist: 211, base: 74, height: 52, round: 9 } as const;
export const BUTTONS = { y: 797, xs: [251, 512, 773] as const, r: 90, socket: 101 } as const;

/** Android adaptive icon: panel charcoal behind a foreground of the remote face. */
export const ADAPTIVE_BG = '#2B2B2C';
/** Vertical centre of the face (d-pad well top to button sockets bottom), viewBox units. */
export const FACE_CENTRE_Y = (RING.cy - RING.recess + BUTTONS.y + BUTTONS.socket) / 2;
/** Face size as a share of the 108 dp adaptive canvas, so its farthest point stays inside the 66 dp safe circle. */
export const ADAPTIVE_SCALE = 0.62;

export type Dir = 'up' | 'right' | 'down' | 'left';
export const DIRS: readonly Dir[] = ['up', 'right', 'down', 'left'];
/** Clockwise angle from "up" (degrees). */
const DIR_DEG: Record<Dir, number> = { up: 0, right: 90, down: 180, left: 270 };

// ---------------------------------------------------------------------------------------------------------------
// Shape model

export type Stop = readonly [offset: number, color: string, opacity?: number];
export interface Gradient {
  id: string;
  type: 'linear' | 'radial';
  /** userSpaceOnUse coordinates (x1,y1,x2,y2 or cx,cy,r[,fx,fy]). */
  attrs: Record<string, number>;
  stops: readonly Stop[];
}
export interface Shape {
  kind: 'circle' | 'path' | 'rect' | 'ellipse';
  /** SVG attributes (fill may be `url(#id)`). */
  attrs: Record<string, number | string>;
  /** The panel and its shadow (left out of the Android adaptive foreground, where the launcher draws the panel). */
  role?: 'panel';
}
/** One animated piece: drawn in global viewBox coordinates inside `box` (x, y, w, h). */
export interface Layer {
  id: string;
  box: readonly [number, number, number, number];
  gradients: Gradient[];
  shapes: Shape[];
  /** Optional dark overlay inside the same box, faded in while pressed. */
  shade?: Shape[];
}

const fmt = (n: number) => (Math.round(n * 100) / 100).toString();

type Pt = readonly [number, number];

function rotate(p: Pt, deg: number, c: Pt = [RING.cx, RING.cy]): [number, number] {
  const a = (deg * Math.PI) / 180;
  const dx = p[0] - c[0];
  const dy = p[1] - c[1];
  return [c[0] + dx * Math.cos(a) - dy * Math.sin(a), c[1] + dx * Math.sin(a) + dy * Math.cos(a)];
}

/** Polygon with rounded corners (quadratic corners of radius r), as an SVG path. */
export function roundedPolygon(points: readonly Pt[], r: number): string {
  const n = points.length;
  let d = '';
  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n]!;
    const cur = points[i]!;
    const next = points[(i + 1) % n]!;
    const toward = (a: Pt, b: Pt): [number, number] => {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const k = Math.min(r, len / 2) / len;
      return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
    };
    const a = toward(cur, prev);
    const b = toward(cur, next);
    d += `${i === 0 ? 'M' : 'L'} ${fmt(a[0])} ${fmt(a[1])} Q ${fmt(cur[0])} ${fmt(cur[1])} ${fmt(b[0])} ${fmt(b[1])} `;
  }
  return d + 'Z';
}

/** Triangle points of one arrow nub (apex outward), optionally grown by `grow` units all round. */
export function nubPoints(dir: Dir, grow = 0): [number, number][] {
  const cy = RING.cy - NUB.dist;
  const h = NUB.height + grow * 2;
  const b = NUB.base + grow * 3.4;
  const up: Pt[] = [
    [RING.cx, cy - h / 2],
    [RING.cx + b / 2, cy + h / 2],
    [RING.cx - b / 2, cy + h / 2],
  ];
  return up.map((p) => rotate(p, DIR_DEG[dir]));
}

/** Centre of a nub in viewBox units. */
export function nubCentre(dir: Dir): [number, number] {
  return rotate([RING.cx, RING.cy - NUB.dist], DIR_DEG[dir]);
}

/** Point at `dist` from the ring centre towards `dir`. */
export function towards(dir: Dir, dist: number): [number, number] {
  return rotate([RING.cx, RING.cy - dist], DIR_DEG[dir]);
}

// Spun-metal colours every 7.5 degrees (clockwise from 3 o'clock): a smooth 4-harmonic fit of the owner's icon, with
// a little more contrast so the lobes read at splash size.
export const RING_GOLD = [
  '#A07749', '#A9804F', '#BB915F', '#D2A974', '#E7C18D', '#FAD5A0', '#FFE1B1', '#FFE1B3', '#F6D9A8', '#E4C798',
  '#CFB084', '#BD9C6F', '#B08D62', '#AE885B', '#B38D5F', '#C0996A', '#D0A878', '#DDB785', '#E5C08E', '#E5C08E',
  '#DDB886', '#CFAA78', '#BF9867', '#B18859', '#A98051', '#AA8151', '#B58C5D', '#C49E6F', '#D7B685', '#EBCC9B',
  '#F8DCAC', '#FDE4B6', '#FAE2B4', '#F1D8AB', '#E4C99D', '#D7BA8D', '#CEAE80', '#CAA678', '#CCA677', '#D1AB7A',
  '#D6B281', '#DAB685', '#D7B686', '#D1AF81', '#C4A276', '#B69266', '#A78458', '#A07A4C',
] as const;
export const OK_GOLD = [
  '#947147', '#947146', '#A07B50', '#B59063', '#CBA677', '#E0BB89', '#EEC895', '#F1CC98', '#EAC492', '#DCB785',
  '#CBA677', '#BE996C', '#B79365', '#BA9568', '#C4A072', '#D5B180', '#E5C08F', '#F1CC99', '#F3CF9A', '#EDC794',
  '#DCB684', '#C7A171', '#B28C5D', '#A27E50', '#9E7A4E', '#A88356', '#BB9768', '#D5B180', '#EFCC9A', '#FFE2B2',
  '#FFECBC', '#FFE9B9', '#FDDBA9', '#E6C493', '#CCAA7B', '#B79468', '#AB875C', '#AA875B', '#B69164', '#C8A475',
  '#DDB987', '#EFCA96', '#F7D19E', '#F3CF9A', '#E5C18D', '#CDAA7A', '#B49264', '#A07D52',
] as const;

function hex(c: string): [number, number, number] {
  return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
}
function mix(a: string, b: string, t: number): string {
  const A = hex(a);
  const B = hex(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i]! - v) * t).toString(16).padStart(2, '0')).join('').toUpperCase();
}

/** Colour of a sampled ring at angle `deg` (smooth cosine blend between samples). */
export function goldAt(samples: readonly string[], deg: number): string {
  const n = samples.length;
  const pos = ((((deg % 360) + 360) % 360) / 360) * n;
  const i = Math.floor(pos) % n;
  const f = pos - Math.floor(pos);
  const s = (1 - Math.cos(f * Math.PI)) / 2;
  return mix(samples[i]!, samples[(i + 1) % n]!, s);
}

/**
 * Conic (spun-metal) fill between radii r0..r1. SVG has no conic gradient, so the sheen is built from `count` wedges,
 * each with a linear gradient across it from the colour at its start angle to the colour at its end angle (no visible
 * facets), and a touch wider than its slot so no hairline seams show.
 */
export function conicWedges(
  prefix: string,
  cx: number,
  cy: number,
  r0: number,
  r1: number,
  samples: readonly string[],
  count = 72,
): { gradients: Gradient[]; shapes: Shape[] } {
  const gradients: Gradient[] = [];
  const shapes: Shape[] = [];
  const step = 360 / count;
  const rm = (r0 + r1) / 2;
  for (let i = 0; i < count; i++) {
    const d0 = i * step;
    const d1 = (i + 1) * step;
    const a0 = ((d0 - 0.4) * Math.PI) / 180;
    const a1 = ((d1 + 0.4) * Math.PI) / 180;
    const p = (r: number, a: number) => `${fmt(cx + r * Math.cos(a))} ${fmt(cy + r * Math.sin(a))}`;
    const d =
      r0 > 0
        ? `M ${p(r0, a0)} L ${p(r1, a0)} A ${r1} ${r1} 0 0 1 ${p(r1, a1)} L ${p(r0, a1)} A ${r0} ${r0} 0 0 0 ${p(r0, a0)} Z`
        : `M ${fmt(cx)} ${fmt(cy)} L ${p(r1, a0)} A ${r1} ${r1} 0 0 1 ${p(r1, a1)} Z`;
    const id = `${prefix}${i}`;
    const g0 = (d0 * Math.PI) / 180;
    const g1 = (d1 * Math.PI) / 180;
    gradients.push({
      id,
      type: 'linear',
      attrs: {
        x1: Number(fmt(cx + rm * Math.cos(g0))),
        y1: Number(fmt(cy + rm * Math.sin(g0))),
        x2: Number(fmt(cx + rm * Math.cos(g1))),
        y2: Number(fmt(cy + rm * Math.sin(g1))),
      },
      stops: [[0, goldAt(samples, d0)], [1, goldAt(samples, d1)]],
    });
    shapes.push({ kind: 'path', attrs: { d, fill: `url(#${id})` } });
  }
  return { gradients, shapes };
}

/** Fine concentric brushing lines between r0 and r1 (deterministic). */
export function brushLines(cx: number, cy: number, r0: number, r1: number, count: number, seed: number): Shape[] {
  let s = seed >>> 0;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const out: Shape[] = [];
  for (let i = 0; i < count; i++) {
    const r = r0 + (r1 - r0) * rnd();
    const light = rnd() > 0.5;
    out.push({
      kind: 'circle',
      attrs: {
        cx,
        cy,
        r: fmt(r),
        fill: 'none',
        stroke: light ? '#FFF6E0' : '#4A3318',
        strokeWidth: fmt(0.5 + rnd() * 1.0),
        opacity: fmt(0.035 + rnd() * 0.07),
      },
    });
  }
  return out;
}

const circle = (cx: number, cy: number, r: number, attrs: Record<string, number | string>): Shape => ({
  kind: 'circle',
  attrs: { cx, cy, r, ...attrs },
});

// ---------------------------------------------------------------------------------------------------------------
// Layers (bottom to top)

function baseLayer(): Layer {
  const { cx, cy } = RING;
  const gradients: Gradient[] = [
    {
      id: 'shadow',
      type: 'radial',
      attrs: { cx: 512, cy: 540, r: 520 },
      stops: [[0.8, '#000000', 0.55], [1, '#000000', 0]],
    },
    {
      id: 'panel',
      type: 'linear',
      attrs: { x1: 120, y1: 60, x2: 900, y2: 980 },
      stops: [[0, '#3C3C3D'], [0.45, '#2B2B2C'], [1, '#1C1C1D']],
    },
    {
      id: 'panelRim',
      type: 'linear',
      attrs: { x1: 200, y1: 40, x2: 820, y2: 984 },
      stops: [[0, '#8A8A8C', 0.9], [0.5, '#3A3A3B', 0.6], [1, '#9C8466', 0.7]],
    },
    {
      id: 'panelSheen',
      type: 'radial',
      attrs: { cx: 300, cy: 200, r: 700 },
      stops: [[0, '#FFFFFF', 0.06], [1, '#FFFFFF', 0]],
    },
    {
      id: 'recess',
      type: 'radial',
      attrs: { cx, cy, r: RING.recess },
      stops: [[0.9, '#0B0B0C'], [0.97, '#151516'], [1, '#2A2A2B']],
    },
    {
      id: 'ringShade',
      type: 'radial',
      attrs: { cx, cy, r: RING.r },
      stops: [[0.45, '#3A2508', 0.3], [0.55, '#3A2508', 0], [0.92, '#3A2508', 0], [1, '#3A2508', 0.28]],
    },
    {
      id: 'ringBevel',
      type: 'linear',
      attrs: { x1: cx - RING.r, y1: cy - RING.r, x2: cx + RING.r, y2: cy + RING.r },
      stops: [[0, '#FFF4D8', 0.95], [0.5, '#C9A26C', 0.2], [1, '#5C4220', 0.9]],
    },
    {
      id: 'grooveLip',
      type: 'linear',
      attrs: { x1: cx - OK_KEY.groove, y1: cy - OK_KEY.groove, x2: cx + OK_KEY.groove, y2: cy + OK_KEY.groove },
      stops: [[0, '#4B3417', 0.9], [1, '#FFF0CC', 0.7]],
    },
    {
      id: 'btnSocket',
      type: 'linear',
      attrs: { x1: 0, y1: BUTTONS.y - BUTTONS.socket, x2: 0, y2: BUTTONS.y + BUTTONS.socket },
      stops: [[0, '#050505'], [0.55, '#141415'], [1, '#2E2E2F']],
    },
  ];
  const ring = conicWedges('rg', cx, cy, OK_KEY.groove - 2, RING.r, RING_GOLD);
  gradients.push(...ring.gradients);
  const shapes: Shape[] = [
    { kind: 'rect', role: 'panel', attrs: { x: 0, y: 0, width: VIEW, height: VIEW, fill: 'url(#shadow)' } },
    { kind: 'rect', role: 'panel', attrs: { x: PANEL.x, y: PANEL.y, width: PANEL.w, height: PANEL.h, rx: PANEL.r, fill: 'url(#panel)' } },
    { kind: 'rect', role: 'panel', attrs: { x: PANEL.x, y: PANEL.y, width: PANEL.w, height: PANEL.h, rx: PANEL.r, fill: 'url(#panelSheen)' } },
    {
      kind: 'rect',
      role: 'panel',
      attrs: {
        x: PANEL.x + 1.5,
        y: PANEL.y + 1.5,
        width: PANEL.w - 3,
        height: PANEL.h - 3,
        rx: PANEL.r - 1.5,
        fill: 'none',
        stroke: 'url(#panelRim)',
        strokeWidth: 3,
      },
    },
    // d-pad well + gold ring
    circle(cx, cy, RING.recess, { fill: 'url(#recess)' }),
    ...ring.shapes,
    ...brushLines(cx, cy, OK_KEY.groove, RING.r - 2, 120, 7),
    circle(cx, cy, RING.r, { fill: 'url(#ringShade)' }),
    circle(cx, cy, RING.r - 1.5, { fill: 'none', stroke: 'url(#ringBevel)', strokeWidth: 3 }),
    // OK key groove (the key itself is its own layer)
    circle(cx, cy, OK_KEY.groove, { fill: 'none', stroke: 'url(#grooveLip)', strokeWidth: 3 }),
    circle(cx, cy, OK_KEY.groove - 1.5, { fill: '#0A0A0B' }),
    // nub sockets (the nubs are layers)
    ...DIRS.map((d): Shape => ({ kind: 'path', attrs: { d: roundedPolygon(nubPoints(d, 4), NUB.round + 3), fill: '#1A1208', opacity: 0.8 } })),
    // bottom button sockets
    ...BUTTONS.xs.map((x) => circle(x, BUTTONS.y, BUTTONS.socket, { fill: 'url(#btnSocket)' })),
    ...BUTTONS.xs.map((x) => circle(x, BUTTONS.y, BUTTONS.r + 3, { fill: '#060606' })),
  ];
  return { id: 'base', box: [0, 0, VIEW, VIEW], gradients, shapes };
}

function nubLayer(dir: Dir): Layer {
  const [x, y] = nubCentre(dir);
  const half = NUB.base / 2 + 6;
  const pts = nubPoints(dir);
  const top = rotate([RING.cx, RING.cy - NUB.dist - NUB.height / 2], DIR_DEG[dir]);
  const bottom = rotate([RING.cx, RING.cy - NUB.dist + NUB.height / 2], DIR_DEG[dir]);
  const id = `nub-${dir}`;
  return {
    id,
    box: [x - half, y - half, half * 2, half * 2],
    gradients: [
      // lit from the top-left like the panel; the face darkens towards the base of the arrow
      { id: `${id}-f`, type: 'linear', attrs: { x1: x - 30, y1: y - 30, x2: x + 30, y2: y + 30 }, stops: [[0, '#3A3A3B'], [0.5, '#1E1E1F'], [1, '#0C0C0D']] },
      { id: `${id}-e`, type: 'linear', attrs: { x1: top[0], y1: top[1], x2: bottom[0], y2: bottom[1] }, stops: [[0, '#6A6A6C', 0.9], [1, '#000000', 0.9]] },
    ],
    shapes: [
      { kind: 'path', attrs: { d: roundedPolygon(pts, NUB.round), fill: `url(#${id}-f)` } },
      { kind: 'path', attrs: { d: roundedPolygon(pts, NUB.round), fill: 'none', stroke: `url(#${id}-e)`, strokeWidth: 2.2 } },
    ],
    shade: [{ kind: 'path', attrs: { d: roundedPolygon(pts, NUB.round), fill: '#000000' } }],
  };
}

function okLayer(): Layer {
  const { cx, cy } = RING;
  const r = OK_KEY.r;
  const spun = conicWedges('og', cx, cy, 0, r, OK_GOLD);
  return {
    id: 'ok',
    box: [cx - r - 4, cy - r - 4, r * 2 + 8, r * 2 + 8],
    gradients: [
      { id: 'ok-dome', type: 'radial', attrs: { cx: cx - 30, cy: cy - 40, r: r * 1.5 }, stops: [[0, '#FFF6DF', 0.18], [0.6, '#FFF6DF', 0], [1, '#3A2508', 0.25]] },
      { id: 'ok-bevel', type: 'linear', attrs: { x1: cx - r, y1: cy - r, x2: cx + r, y2: cy + r }, stops: [[0, '#FFF6DC', 0.95], [0.5, '#C9A26C', 0.1], [1, '#4E3618', 0.85]] },
      { id: 'ok-pin', type: 'radial', attrs: { cx, cy, r: 26 }, stops: [[0, '#FFF8E6', 0.6], [1, '#FFF8E6', 0]] },
      ...spun.gradients,
    ],
    shapes: [
      ...spun.shapes,
      ...brushLines(cx, cy, 6, r - 2, 60, 23),
      circle(cx, cy, r, { fill: 'url(#ok-dome)' }),
      circle(cx, cy, 26, { fill: 'url(#ok-pin)' }),
      circle(cx, cy, r - 1.5, { fill: 'none', stroke: 'url(#ok-bevel)', strokeWidth: 3 }),
    ],
    shade: [circle(cx, cy, r, { fill: '#1A0F02' })],
  };
}

function buttonLayer(i: number): Layer {
  const x = BUTTONS.xs[i]!;
  const y = BUTTONS.y;
  const r = BUTTONS.r;
  const id = `btn-${i}`;
  return {
    id,
    box: [x - r - 2, y - r - 2, r * 2 + 4, r * 2 + 4],
    gradients: [
      { id: `${id}-f`, type: 'radial', attrs: { cx: x - 18, cy: y - 34, r: r * 1.35 }, stops: [[0, '#3E3E40'], [0.55, '#252526'], [1, '#141415']] },
      { id: `${id}-e`, type: 'linear', attrs: { x1: x, y1: y - r, x2: x, y2: y + r }, stops: [[0, '#7A7A7C', 0.85], [0.45, '#3A3A3B', 0.2], [1, '#000000', 0.6]] },
    ],
    shapes: [
      circle(x, y, r, { fill: `url(#${id}-f)` }),
      circle(x, y, r - 1.2, { fill: 'none', stroke: `url(#${id}-e)`, strokeWidth: 2.4 }),
    ],
    shade: [circle(x, y, r, { fill: '#000000' })],
  };
}

/** Distance of a nub's glint from the ring centre: on the gold just outside the arrow. */
export const GLINT_DIST = 252;

function glintLayer(dir: Dir): Layer {
  const [x, y] = towards(dir, GLINT_DIST);
  const id = `glint-${dir}`;
  const rx = 104;
  const ry = 40;
  return {
    id,
    box: [x - rx, y - rx, rx * 2, rx * 2],
    gradients: [{ id: `${id}-g`, type: 'radial', attrs: { cx: x, cy: y, r: rx }, stops: [[0, '#FFFBEF', 1], [0.3, '#FFEFC8', 0.75], [0.65, '#FFE3A8', 0.25], [1, '#FFE3A8', 0]] }],
    shapes: [
      {
        kind: 'ellipse',
        // stretched along the ring (tangent), thin across it
        attrs: { cx: x, cy: y, rx, ry, fill: `url(#${id}-g)`, transform: `rotate(${DIR_DEG[dir]} ${fmt(x)} ${fmt(y)})` },
      },
    ],
  };
}

function rippleLayer(): Layer {
  const { cx, cy, r } = RING;
  return {
    id: 'ripple',
    box: [cx - r, cy - r, r * 2, r * 2],
    gradients: [
      {
        id: 'ripple-g',
        type: 'radial',
        attrs: { cx, cy, r },
        stops: [[0, '#FFF3D6', 0], [0.74, '#FFF3D6', 0], [0.88, '#FFF3D6', 0.62], [0.95, '#FFE8B6', 0.2], [1, '#FFE8B6', 0]],
      },
    ],
    shapes: [circle(cx, cy, r, { fill: 'url(#ripple-g)' })],
  };
}

/** The light band that sweeps over the gold (moved by the UI inside a circular clip of the ring). */
export const SHEEN = { w: 260, angle: -24 } as const;

const SHEEN_H = RING.r * 2.6;

/** How far (viewBox units) the band moves from the ring centre at shift ±1: just clear of the ring either side. */
export function sheenTravel(): number {
  const a = (Math.abs(SHEEN.angle) * Math.PI) / 180;
  return RING.r + (SHEEN_H / 2) * Math.sin(a) + (SHEEN.w / 2) * Math.cos(a);
}

function sheenLayer(): Layer {
  const { cx, cy } = RING;
  const h = SHEEN_H;
  return {
    id: 'sheen',
    box: [cx - SHEEN.w / 2, cy - h / 2, SHEEN.w, h],
    gradients: [
      {
        id: 'sheen-g',
        type: 'linear',
        attrs: { x1: cx - SHEEN.w / 2, y1: 0, x2: cx + SHEEN.w / 2, y2: 0 },
        stops: [[0, '#FFF9EA', 0], [0.35, '#FFF9EA', 0.16], [0.5, '#FFFFFF', 0.36], [0.65, '#FFF9EA', 0.16], [1, '#FFF9EA', 0]],
      },
    ],
    shapes: [{ kind: 'rect', attrs: { x: cx - SHEEN.w / 2, y: cy - h / 2, width: SHEEN.w, height: h, fill: 'url(#sheen-g)' } }],
  };
}

/** Every layer, bottom to top. */
export function remoteLayers(): Layer[] {
  return [
    baseLayer(),
    ...DIRS.map(nubLayer),
    okLayer(),
    ...BUTTONS.xs.map((_, i) => buttonLayer(i)),
    ...DIRS.map(glintLayer),
    rippleLayer(),
    sheenLayer(),
  ];
}

// ---------------------------------------------------------------------------------------------------------------
// Sequence

/** The bottom button that gives the small press (the middle one). */
export const PRESSED_BUTTON = 1;

/** One beat of the sequence (ms from the first frame). */
export interface Beat {
  id: string;
  at: number;
  ms: number;
}

const PRESS = { down: 100, hold: 30, up: 150 } as const;
const OK_PRESS = { down: 130, hold: 50, up: 220 } as const;

/**
 * The press sequence: a still first frame (the native splash hands over and fades), the four arrows in turn
 * (up, right, down, left) each with a glint on the ring at that side, OK with a light ripple across the ring,
 * a bottom button, then a sheen across the gold.
 */
export const BEATS: readonly Beat[] = [
  { id: 'nub-up', at: 180, ms: PRESS.down + PRESS.hold + PRESS.up },
  { id: 'nub-right', at: 340, ms: PRESS.down + PRESS.hold + PRESS.up },
  { id: 'nub-down', at: 500, ms: PRESS.down + PRESS.hold + PRESS.up },
  { id: 'nub-left', at: 660, ms: PRESS.down + PRESS.hold + PRESS.up },
  { id: 'ok', at: 920, ms: OK_PRESS.down + OK_PRESS.hold + OK_PRESS.up },
  { id: 'ripple', at: 1020, ms: 540 },
  { id: `btn-${PRESSED_BUTTON}`, at: 1260, ms: PRESS.down + PRESS.hold + PRESS.up },
  { id: 'sheen', at: 1340, ms: 520 },
];

/** Timings (ms). seq = one full pass; the overlay fades over fadeOut once the app is ready, never later than maxWait. */
export const INTRO_MS = {
  seq: 1900,
  /** expo-splash-screen fade (setOptions) while the first frame holds still. */
  splashFade: 180,
  fadeOut: 350,
  maxWait: 3000,
  /** Light haptic tick at the bottom of the OK press. */
  haptic: 920 + OK_PRESS.down,
} as const;

export type Prop = 'scale' | 'opacity' | 'shade' | 'shift';
export type Ease = 'inOut' | 'out' | 'linear';
/** [time ms, value, easing into this key]. */
export type Key = readonly [number, number, Ease?];
export interface Track {
  layer: string;
  prop: Prop;
  keys: readonly Key[];
}

function press(at: number, p: { down: number; hold: number; up: number }, rest: number, deep: number): Key[] {
  return [
    [0, rest],
    [at, rest],
    [at + p.down, deep, 'inOut'],
    [at + p.down + p.hold, deep],
    [at + p.down + p.hold + p.up, rest, 'inOut'],
    [INTRO_MS.seq, rest],
  ];
}

function beat(id: string): Beat {
  const b = BEATS.find((x) => x.id === id);
  if (!b) throw new Error(`no beat ${id}`);
  return b;
}

/** Every animated value on the one clock (0..INTRO_MS.seq). Layers without a track stay at rest. */
export function introTracks(): Track[] {
  const out: Track[] = [];
  for (const d of DIRS) {
    const { at } = beat(`nub-${d}`);
    out.push({ layer: `nub-${d}`, prop: 'scale', keys: press(at, PRESS, 1, 0.86) });
    out.push({ layer: `nub-${d}`, prop: 'shade', keys: press(at, PRESS, 0, 0.5) });
    out.push({
      layer: `glint-${d}`,
      prop: 'opacity',
      keys: [[0, 0], [at, 0], [at + PRESS.down + 10, 1, 'inOut'], [at + PRESS.down + 60, 1], [at + 360, 0, 'inOut'], [INTRO_MS.seq, 0]],
    });
  }
  const ok = beat('ok');
  out.push({ layer: 'ok', prop: 'scale', keys: press(ok.at, OK_PRESS, 1, 0.96) });
  out.push({ layer: 'ok', prop: 'shade', keys: press(ok.at, OK_PRESS, 0, 0.3) });
  const rp = beat('ripple');
  out.push({
    layer: 'ripple',
    prop: 'scale',
    keys: [[0, OK_KEY.r / RING.r], [rp.at, OK_KEY.r / RING.r], [rp.at + rp.ms, 1, 'out'], [INTRO_MS.seq, 1]],
  });
  out.push({
    layer: 'ripple',
    prop: 'opacity',
    keys: [[0, 0], [rp.at, 0], [rp.at + 90, 1, 'inOut'], [rp.at + rp.ms, 0, 'inOut'], [INTRO_MS.seq, 0]],
  });
  const bt = beat(`btn-${PRESSED_BUTTON}`);
  out.push({ layer: `btn-${PRESSED_BUTTON}`, prop: 'scale', keys: press(bt.at, PRESS, 1, 0.95) });
  out.push({ layer: `btn-${PRESSED_BUTTON}`, prop: 'shade', keys: press(bt.at, PRESS, 0, 0.35) });
  const sh = beat('sheen');
  // shift: -1 = band fully left of the ring, +1 = fully right (the UI scales it by the ring diameter)
  out.push({ layer: 'sheen', prop: 'shift', keys: [[0, -1], [sh.at, -1], [sh.at + sh.ms, 1, 'inOut'], [INTRO_MS.seq, 1]] });
  out.push({
    layer: 'sheen',
    prop: 'opacity',
    keys: [[0, 0], [sh.at, 0], [sh.at + 80, 1, 'inOut'], [sh.at + sh.ms - 80, 1], [sh.at + sh.ms, 0, 'inOut'], [INTRO_MS.seq, 0]],
  });
  return out;
}

/** Rest value of a property (the first frame and the native splash). */
export function restValue(prop: Prop): number {
  return prop === 'scale' ? 1 : prop === 'shift' ? -1 : 0;
}

function ease(kind: Ease | undefined, x: number): number {
  switch (kind) {
    case 'out':
      return 1 - Math.pow(1 - x, 3);
    case 'linear':
      return x;
    default:
      // ease in/out (sine): calm, no overshoot
      return (1 - Math.cos(Math.PI * x)) / 2;
  }
}

/** Value of a track at time t (ms), clamped to its first/last key. */
export function valueAt(track: Track, t: number): number {
  const k = track.keys;
  if (t <= k[0]![0]) return k[0]![1];
  for (let i = 1; i < k.length; i++) {
    const [t1, v1, e] = k[i]!;
    const [t0, v0] = k[i - 1]!;
    if (t <= t1) {
      if (t1 === t0) return v1;
      return v0 + (v1 - v0) * ease(e, (t - t0) / (t1 - t0));
    }
  }
  return k[k.length - 1]![1];
}

/**
 * Track as Animated interpolation ranges (strictly increasing input), with each eased segment sampled `steps` times
 * so the native driver plays the same curve as valueAt().
 */
export function interpolation(track: Track, steps = 8): { inputRange: number[]; outputRange: number[] } {
  const inputRange: number[] = [];
  const outputRange: number[] = [];
  const push = (t: number, v: number) => {
    if (inputRange.length && t <= inputRange[inputRange.length - 1]!) return;
    inputRange.push(t);
    outputRange.push(Math.round(v * 10000) / 10000);
  };
  const k = track.keys;
  push(k[0]![0], k[0]![1]);
  for (let i = 1; i < k.length; i++) {
    const [t0, v0] = k[i - 1]!;
    const [t1, v1] = k[i]!;
    if (v0 === v1 || t1 - t0 < 2) {
      push(t1, v1);
      continue;
    }
    for (let s = 1; s <= steps; s++) {
      const t = t0 + ((t1 - t0) * s) / steps;
      push(t, valueAt(track, t));
    }
  }
  return { inputRange, outputRange };
}

/** All animated values at time t: `${layer}.${prop}` → value. */
export function frameAt(t: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const tr of introTracks()) out[`${tr.layer}.${tr.prop}`] = valueAt(tr, t);
  return out;
}

/** Fonts are loaded (or failed: system fonts) and the catalogues are in, or the cap has passed anyway. */
export function startupReady(fontsDone: boolean, i18nDone: boolean, elapsedMs: number): boolean {
  return (fontsDone && i18nDone) || elapsedMs >= INTRO_MS.maxWait;
}

/**
 * The overlay starts fading (and the app mounts underneath) once one full pass has played and the app is ready,
 * or at the hard cap so a slow device is never stuck behind the intro.
 */
export function introCanFade(sequenceDone: boolean, ready: boolean, elapsedMs: number): boolean {
  return (sequenceDone && ready) || elapsedMs >= INTRO_MS.maxWait;
}
