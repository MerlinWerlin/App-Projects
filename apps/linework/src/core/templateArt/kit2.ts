// Shared drawing kit for the fb-1022b Game world and Heroes batches (game2.ts, heroes2.ts): a pixel-sprite tracer
// (grid of cells → merged outline, colour boundaries and cell grid), figure helpers (tapered limbs, smooth blobs,
// straps, masks, badges) and small decorations. Pure TS, absolute path commands only.
import { circle, f, line, mirrorX, poly, polar, rotate, type P } from './draw.ts';
import { roundPoly } from './occlude.ts';

// ---- pixel sprites ----------------------------------------------------------------------------

export type Grid = string[];
export type Pixel = { outline: string; colours: string; grid: string };

/** Trace a sprite (rows of chars, '.' empty) at cell size s with top-left (x0, y0); centred when omitted. */
export function pixel(rows: Grid, s: number, x0?: number, y0?: number): Pixel {
  const cols = Math.max(...rows.map((r) => r.length));
  const g = rows.map((r) => r.padEnd(cols, '.'));
  const R = g.length;
  const ox = x0 ?? 200 - (cols * s) / 2;
  const oy = y0 ?? 200 - (R * s) / 2;
  const at = (r: number, c: number): string => (r < 0 || r >= R || c < 0 || c >= cols ? '.' : g[r][c]);
  const filled = (r: number, c: number): boolean => at(r, c) !== '.';
  const edges = new Map<string, [number, number][]>();
  const add = (x1: number, y1: number, x2: number, y2: number) => {
    const k = `${x1},${y1}`;
    if (!edges.has(k)) edges.set(k, []);
    edges.get(k)!.push([x2, y2]);
  };
  for (let r = 0; r < R; r++)
    for (let c = 0; c < cols; c++) {
      if (!filled(r, c)) continue;
      if (!filled(r - 1, c)) add(c, r, c + 1, r);
      if (!filled(r, c + 1)) add(c + 1, r, c + 1, r + 1);
      if (!filled(r + 1, c)) add(c + 1, r + 1, c, r + 1);
      if (!filled(r, c - 1)) add(c, r + 1, c, r);
    }
  const loops: P[][] = [];
  for (;;) {
    const startKey = [...edges.keys()].find((k) => edges.get(k)!.length > 0);
    if (!startKey) break;
    const [sx, sy] = startKey.split(',').map(Number);
    const pts: P[] = [[sx, sy]];
    let [x, y] = [sx, sy];
    let dir: P = [0, 0];
    for (let guard = 0; guard < 10000; guard++) {
      const outs = edges.get(`${x},${y}`)!;
      let pick = 0;
      if (outs.length > 1) {
        const right: P = [-dir[1], dir[0]];
        const i = outs.findIndex(([nx, ny]) => nx - x === right[0] && ny - y === right[1]);
        pick = i >= 0 ? i : 0;
      }
      const [nx, ny] = outs.splice(pick, 1)[0];
      dir = [nx - x, ny - y];
      [x, y] = [nx, ny];
      if (x === sx && y === sy) break;
      pts.push([x, y]);
    }
    const n = pts.length;
    loops.push(
      pts.filter((p, i) => {
        const a = pts[(i - 1 + n) % n];
        const b = pts[(i + 1) % n];
        return (p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0]) !== 0;
      }),
    );
  }
  const toXY = (p: P): P => [ox + p[0] * s, oy + p[1] * s];
  const outline = loops.map((l) => poly(l.map(toXY))).join(' ');
  const segs = (want: (a: string, b: string) => boolean): string => {
    const out: string[] = [];
    for (let c = 1; c < cols; c++) {
      let start = -1;
      for (let r = 0; r <= R; r++) {
        const on = r < R && filled(r, c - 1) && filled(r, c) && want(at(r, c - 1), at(r, c));
        if (on && start < 0) start = r;
        if (!on && start >= 0) {
          out.push(line(ox + c * s, oy + start * s, ox + c * s, oy + r * s));
          start = -1;
        }
      }
    }
    for (let r = 1; r < R; r++) {
      let start = -1;
      for (let c = 0; c <= cols; c++) {
        const on = c < cols && filled(r - 1, c) && filled(r, c) && want(at(r - 1, c), at(r, c));
        if (on && start < 0) start = c;
        if (!on && start >= 0) {
          out.push(line(ox + start * s, oy + r * s, ox + c * s, oy + r * s));
          start = -1;
        }
      }
    }
    return out.join(' ');
  };
  return { outline, colours: segs((a, b) => a !== b), grid: segs((a, b) => a === b) };
}

/** Small pixel sparkle: a plus of cells around (x, y). */
export function pixSpark(x: number, y: number, s: number): string {
  return poly([
    [x - s / 2, y - 1.5 * s], [x + s / 2, y - 1.5 * s], [x + s / 2, y - s / 2], [x + 1.5 * s, y - s / 2],
    [x + 1.5 * s, y + s / 2], [x + s / 2, y + s / 2], [x + s / 2, y + 1.5 * s], [x - s / 2, y + 1.5 * s],
    [x - s / 2, y + s / 2], [x - 1.5 * s, y + s / 2], [x - 1.5 * s, y - s / 2], [x - s / 2, y - s / 2],
  ]);
}

// ---- figures ----------------------------------------------------------------------------------

/** Tapered capsule from a (half-width wa) to b (half-width wb) with round ends. */
export function limb(a: P, b: P, wa: number, wb: number): string {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const dx = (b[0] - a[0]) / len;
  const dy = (b[1] - a[1]) / len;
  const nx = -dy;
  const ny = dx;
  const p = (x: number, y: number) => `${f(x)} ${f(y)}`;
  const k = 1.33;
  return (
    `M ${p(a[0] + nx * wa, a[1] + ny * wa)} L ${p(b[0] + nx * wb, b[1] + ny * wb)} ` +
    `C ${p(b[0] + nx * wb + dx * wb * k, b[1] + ny * wb + dy * wb * k)} ${p(b[0] - nx * wb + dx * wb * k, b[1] - ny * wb + dy * wb * k)} ${p(b[0] - nx * wb, b[1] - ny * wb)} ` +
    `L ${p(a[0] - nx * wa, a[1] - ny * wa)} ` +
    `C ${p(a[0] - nx * wa - dx * wa * k, a[1] - ny * wa - dy * wa * k)} ${p(a[0] + nx * wa - dx * wa * k, a[1] + ny * wa - dy * wa * k)} ${p(a[0] + nx * wa, a[1] + ny * wa)} Z`
  );
}

/** A bent limb through joints, widths per joint, as one merged layer. */
export function bent(pts: readonly P[], ws: readonly number[]): string[] {
  const out: string[] = [];
  for (let i = 0; i + 1 < pts.length; i++) out.push(limb(pts[i], pts[i + 1], ws[i], ws[i + 1]));
  return out;
}

/** Smooth closed blob through points (Catmull-Rom → cubic Bézier). */
export function blob(pts: readonly P[], tension = 1): string {
  const n = pts.length;
  const p = (q: P) => `${f(q[0])} ${f(q[1])}`;
  let d = `M ${p(pts[0])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1: P = [p1[0] + ((p2[0] - p0[0]) / 6) * tension, p1[1] + ((p2[1] - p0[1]) / 6) * tension];
    const c2: P = [p2[0] - ((p3[0] - p1[0]) / 6) * tension, p2[1] - ((p3[1] - p1[1]) / 6) * tension];
    d += ` C ${p(c1)} ${p(c2)} ${p(p2)}`;
  }
  return `${d} Z`;
}

/** Smooth open curve through points. */
export function curve(pts: readonly P[]): string {
  const p = (q: P) => `${f(q[0])} ${f(q[1])}`;
  let d = `M ${p(pts[0])}`;
  for (let i = 0; i + 1 < pts.length; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    d += ` C ${p([p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6])} ${p([p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6])} ${p(p2)}`;
  }
  return d;
}

/** Domino mask across the eyes centred on (cx, cy), half-width w. */
export function domino(cx: number, cy: number, w: number): string {
  const p = (x: number, y: number) => `${f(cx + x * w)} ${f(cy + y * w)}`;
  return (
    `M ${p(0, -0.12)} C ${p(-0.25, -0.38)} ${p(-0.75, -0.4)} ${p(-1.05, -0.2)} ` +
    `C ${p(-1.0, 0.1)} ${p(-0.75, 0.38)} ${p(-0.45, 0.32)} C ${p(-0.2, 0.28)} ${p(-0.12, 0.1)} ${p(0, 0.08)} ` +
    `C ${p(0.12, 0.1)} ${p(0.2, 0.28)} ${p(0.45, 0.32)} C ${p(0.75, 0.38)} ${p(1.0, 0.1)} ${p(1.05, -0.2)} ` +
    `C ${p(0.75, -0.4)} ${p(0.25, -0.38)} ${p(0, -0.12)} Z`
  );
}

/** Almond eye opening. */
export function almond(cx: number, cy: number, w: number, h: number, tilt = 0): string {
  const d = `M ${f(cx - w)} ${f(cy)} Q ${f(cx)} ${f(cy - h * 2)} ${f(cx + w)} ${f(cy)} Q ${f(cx)} ${f(cy + h * 2)} ${f(cx - w)} ${f(cy)} Z`;
  return tilt ? rotate(d, tilt, cx, cy) : d;
}

/** Rounded star. */
export function softStar(cx: number, cy: number, outer: number, inner: number, n: number, r: number, rot = 0): string {
  const pts: P[] = [];
  for (let i = 0; i < n * 2; i++) pts.push(polar(cx, cy, i % 2 === 0 ? outer : inner, rot + (180 * i) / n));
  return roundPoly(pts, r);
}

/** Zig-zag lightning bolt, top at (x, y), height h. */
export function bolt(x: number, y: number, h: number): string {
  const s = h / 100;
  const q = (px: number, py: number): P => [x + px * s, y + py * s];
  return roundPoly([q(14, 0), q(-22, 52), q(2, 52), q(-12, 100), q(28, 38), q(4, 38), q(24, 0)], 1.5 * s);
}

/** Rounded-top shield centred on cx, top y, width w, height h. */
export function shield(cx: number, y: number, w: number, h: number): string {
  const p = (px: number, py: number) => `${f(cx + px * w)} ${f(y + py * h)}`;
  return (
    `M ${p(-0.5, 0.04)} Q ${p(-0.25, 0.08)} ${p(0, 0)} Q ${p(0.25, 0.08)} ${p(0.5, 0.04)} ` +
    `C ${p(0.52, 0.45)} ${p(0.38, 0.78)} ${p(0, 1)} C ${p(-0.38, 0.78)} ${p(-0.52, 0.45)} ${p(-0.5, 0.04)} Z`
  );
}

/** Two-crest wave emblem inside a box centred at (cx, cy), width w. */
export function waveMark(cx: number, cy: number, w: number): string {
  const s = w / 100;
  const q = (x: number, y: number): string => `${f(cx + x * s)} ${f(cy + y * s)}`;
  return (
    `M ${q(-50, 20)} C ${q(-40, -10)} ${q(-18, -30)} ${q(4, -24)} C ${q(-10, -14)} ${q(-12, 4)} ${q(2, 8)} ` +
    `C ${q(14, 10)} ${q(20, -6)} ${q(30, -10)} C ${q(40, -14)} ${q(48, -6)} ${q(50, 2)} ` +
    `C ${q(42, -2)} ${q(36, 4)} ${q(34, 12)} C ${q(28, 24)} ${q(10, 30)} ${q(-6, 26)} C ${q(-22, 24)} ${q(-36, 22)} ${q(-50, 20)} Z`
  );
}

/** Acorn emblem centred at (cx, cy), height h. */
export function acornMark(cx: number, cy: number, h: number): string[] {
  const s = h / 100;
  const q = (x: number, y: number): P => [cx + x * s, cy + y * s];
  const cap = blob([q(-40, -6), q(-36, -30), q(0, -42), q(36, -30), q(40, -6), q(0, -2)], 0.9);
  const nut = blob([q(-32, -6), q(32, -6), q(28, 24), q(0, 50), q(-28, 24)], 0.9);
  const stem = `M ${f(q(0, -40)[0])} ${f(q(0, -40)[1])} Q ${f(q(4, -54)[0])} ${f(q(4, -54)[1])} ${f(q(14, -56)[0])} ${f(q(14, -56)[1])}`;
  return [cap, nut, stem];
}

/** Gear outline with n teeth. */
export function gear(cx: number, cy: number, r: number, n: number, depth: number): string {
  const pts: P[] = [];
  for (let i = 0; i < n; i++) {
    const a = (360 * i) / n;
    const w = 360 / n / 4;
    pts.push(polar(cx, cy, r - depth, a - 2 * w), polar(cx, cy, r, a - w), polar(cx, cy, r, a + w), polar(cx, cy, r - depth, a + 2 * w));
  }
  return roundPoly(pts, 2);
}

/** Four-point sparkle. */
export function sparkle(x: number, y: number, r: number): string {
  const k = r * 0.22;
  return (
    `M ${f(x)} ${f(y - r)} Q ${f(x + k)} ${f(y - k)} ${f(x + r)} ${f(y)} Q ${f(x + k)} ${f(y + k)} ${f(x)} ${f(y + r)} ` +
    `Q ${f(x - k)} ${f(y + k)} ${f(x - r)} ${f(y)} Q ${f(x - k)} ${f(y - k)} ${f(x)} ${f(y - r)} Z`
  );
}

export const smile = (x: number, y: number, w: number, depth = 0.5): string =>
  `M ${f(x - w)} ${f(y)} Q ${f(x)} ${f(y + w * depth * 2)} ${f(x + w)} ${f(y)}`;
export const dot = (x: number, y: number, r = 3.2): string => circle(x, y, r);
export const m200 = (d: string): string => mirrorX(d, 200);
export const lines = (segs: readonly (readonly [number, number, number, number])[]): string => segs.map((s) => line(...s)).join(' ');

/** Puffy cloud of width w centred at (cx, cy). */
export function cloud(cx: number, cy: number, w: number): string[] {
  const s = w / 200;
  return [
    `M ${f(cx - 100 * s + 22 * s)} ${f(cy - 10 * s)} L ${f(cx + 100 * s - 22 * s)} ${f(cy - 10 * s)} A ${f(22 * s)} ${f(22 * s)} 0 0 1 ${f(cx + 100 * s - 22 * s)} ${f(cy + 34 * s)} L ${f(cx - 100 * s + 22 * s)} ${f(cy + 34 * s)} A ${f(22 * s)} ${f(22 * s)} 0 0 1 ${f(cx - 100 * s + 22 * s)} ${f(cy - 10 * s)} Z`,
    circle(cx - 50 * s, cy - 8 * s, 34 * s),
    circle(cx + 5 * s, cy - 26 * s, 44 * s),
    circle(cx + 58 * s, cy - 4 * s, 30 * s),
  ];
}

/**
 * Pip, the pencil-sprite mascot (docs/CAST.md), standing, centred on cx with feet (pencil tip) at footY, height h.
 * On-model: hexagonal pencil body, rounded eraser cap, sharpened point for feet, two dot eyes, small smile,
 * a single leaf sprouting from the cap. Returns front-to-back layers plus face/detail strokes.
 */
export function pip(cx: number, footY: number, h: number): { layers: string[]; face: string[]; detail: string[] } {
  const s = h / 200;
  const q = (x: number, y: number): P => [cx + x * s, footY - 200 * s + y * s];
  const qq = (x: number, y: number) => `${f(q(x, y)[0])} ${f(q(x, y)[1])}`;
  const cap = `M ${qq(-30, 40)} L ${qq(-30, 22)} Q ${qq(-30, 6)} ${qq(-14, 6)} L ${qq(14, 6)} Q ${qq(30, 6)} ${qq(30, 22)} L ${qq(30, 40)} Z`;
  const band = poly([q(-32, 40), q(32, 40), q(32, 54), q(-32, 54)]);
  const body = poly([q(-30, 54), q(30, 54), q(30, 150), q(-30, 150)]);
  const cone = `M ${qq(-30, 150)} L ${qq(30, 150)} L ${qq(4, 196)} Q ${qq(0, 200)} ${qq(-4, 196)} Z`;
  const leaf = `M ${qq(4, 8)} Q ${qq(6, -10)} ${qq(16, -18)} Q ${qq(36, -24)} ${qq(44, -14)} Q ${qq(34, 2)} ${qq(14, 0)} Q ${qq(8, 2)} ${qq(4, 8)} Z`;
  const face = [circle(...q(-10, 86), 5.5 * s), circle(...q(10, 86), 5.5 * s), `M ${qq(-9, 102)} Q ${qq(0, 110)} ${qq(9, 102)}`];
  const detail = [
    `M ${qq(-21, 54)} L ${qq(-21, 150)} M ${qq(21, 54)} L ${qq(21, 150)}`,
    `M ${qq(-30, 150)} Q ${qq(-20, 158)} ${qq(-10, 150)} Q ${qq(0, 158)} ${qq(10, 150)} Q ${qq(20, 158)} ${qq(30, 150)}`,
    `M ${qq(-8, 184)} L ${qq(8, 184)}`,
    `M ${qq(10, 2)} Q ${qq(24, -10)} ${qq(38, -14)}`,
  ];
  return { layers: [leaf, band, cap, cone, body], face, detail };
}
