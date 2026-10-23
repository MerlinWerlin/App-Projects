// patterns2 template batch (fb-1023c, 23 Oct 2026): original frames, borders, labels, tiles, quilt blocks, lace,
// paisley and tattoo-style frames for 'Frames & patterns', plus original hand-drawn lettering for 'Lettering'.
// Everything is drawn here from our own geometry: the script words use our own monoline letter skeletons (a smooth
// curve through hand-placed points per letter) and the bubble words use our own capital skeletons inflated into
// rounded outlines (union of capsules, occlude.ts). No font is traced and no logo or brand is used. Overlaps use
// occlude.ts so lines behind a shape are hidden. See docs/TEMPLATES.md.
import type { Template, TemplateCategory, TemplateLevel } from '../templates.ts';
import { circle, ellipse, f, line, petal, polar, rrect, star, type P } from './draw.ts';
import { clip, outline, region, samplePath, union, type Layer, type Region } from './occlude.ts';
import { limb } from './kit2.ts';

const VB = '0 0 400 400';

type Art = { p: string[]; d: string[] };

// ---- helpers --------------------------------------------------------------------------------------------------

const rad = (deg: number) => (deg * Math.PI) / 180;

const pl = (pts: readonly P[], closed = false): string =>
  pts.map((p, i) => `${i ? 'L' : 'M'} ${f(p[0])} ${f(p[1])}`).join(' ') + (closed ? ' Z' : '');

/** Dense points of a Catmull-Rom curve through pts. */
function curvePts(pts: readonly P[], closed = false, per = 12): P[] {
  const n = pts.length;
  const at = (i: number): P => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  const out: P[] = [];
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    for (let k = 0; k < per; k++) {
      const t = k / per;
      const t2 = t * t;
      const t3 = t2 * t;
      const c = (a: number, b: number, cc: number, d: number) =>
        0.5 * (2 * b + (-a + cc) * t + (2 * a - 5 * b + 4 * cc - d) * t2 + (-a + 3 * b - 3 * cc + d) * t3);
      out.push([c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  if (!closed) out.push(pts[n - 1]);
  return out;
}

/** Smooth closed or open curve through points (Catmull-Rom as cubic Béziers). */
function smooth(pts: readonly P[], closed = true): string {
  const n = pts.length;
  const at = (i: number): P => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  let d = `M ${f(pts[0][0])} ${f(pts[0][1])}`;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    d += ` C ${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return closed ? `${d} Z` : d;
}

/** Heart centred on (cx, cy), s = overall width. */
function heart(cx: number, cy: number, s: number): string {
  const p = (x: number, y: number) => `${f(cx + x * s)} ${f(cy + y * s)}`;
  return (
    `M ${p(0, -0.24)} C ${p(-0.08, -0.52)} ${p(-0.5, -0.56)} ${p(-0.5, -0.16)} C ${p(-0.5, 0.14)} ${p(-0.2, 0.34)} ${p(0, 0.55)} ` +
    `C ${p(0.2, 0.34)} ${p(0.5, 0.14)} ${p(0.5, -0.16)} C ${p(0.5, -0.56)} ${p(0.08, -0.52)} ${p(0, -0.24)} Z`
  );
}

/** Points of a path offset by d (positive = to the left of travel in screen coordinates). */
function offset(pts: readonly P[], d: number, closed: boolean): P[] {
  const n = pts.length;
  return pts.map((p, i) => {
    const a = closed ? pts[(i - 1 + n) % n] : pts[Math.max(0, i - 1)];
    const b = closed ? pts[(i + 1) % n] : pts[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    return [p[0] - (dy / len) * d, p[1] + (dx / len) * d] as P;
  });
}

/** Parallel hatch lines at angle deg with the given spacing, kept where inside(x, y). */
function hatch(inside: (x: number, y: number) => boolean, box: readonly [number, number, number, number], deg: number, gap: number): string {
  const [x0, y0, x1, y1] = box;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const R = Math.hypot(x1 - x0, y1 - y0) / 2;
  const ux = Math.cos(rad(deg));
  const uy = Math.sin(rad(deg));
  const out: string[] = [];
  for (let o = -R + gap / 2; o <= R; o += gap) {
    let start: P | null = null;
    let last: P | null = null;
    const flush = () => {
      if (start && last && Math.hypot(last[0] - start[0], last[1] - start[1]) > 3) out.push(line(start[0], start[1], last[0], last[1]));
      start = last = null;
    };
    for (let t = -R; t <= R + 0.01; t += 1) {
      const x = cx + ux * t - uy * o;
      const y = cy + uy * t + ux * o;
      if (x >= x0 && x <= x1 && y >= y0 && y <= y1 && inside(x, y)) {
        if (!start) start = [x, y];
        last = [x, y];
      } else flush();
    }
    flush();
  }
  return out.join(' ');
}

/** A layered item: a closed silhouette (hides what is behind it) and its own lines. '' = lines only. */
type Item = { sil: Layer; p?: string[]; d?: string[] };

/** Draw items front to back: each item's outline and lines are clipped by every item in front of it. */
function layered(items: readonly Item[]): Art {
  const regs: Region[] = [];
  const p: string[] = [];
  const d: string[] = [];
  const cut = (s: string) => (regs.length && s ? clip(s, regs) : s);
  for (const it of items) {
    for (const s of [it.sil === '' ? '' : outline(it.sil), ...(it.p ?? [])]) {
      const c = cut(s);
      if (c) p.push(c);
    }
    for (const s of it.d ?? []) {
      const c = cut(s);
      if (c) d.push(c);
    }
    if (it.sil !== '') regs.push(region(it.sil));
  }
  return { p, d };
}

/** Group a list of short strokes into n path strings. */
function chunks(list: readonly string[], n: number): string[] {
  const out: string[] = [];
  const size = Math.max(1, Math.ceil(list.length / n));
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size).join(' '));
  return out;
}

/** Dashed (stitch) line along a polyline: dashes of length dash with gap gap. */
function dashed(pts: readonly P[], dash = 7, gap = 6, closed = false): string {
  const ring = closed ? [...pts, pts[0]] : [...pts];
  const out: string[] = [];
  let on = true;
  let left = dash;
  let cur: P[] = [ring[0]];
  for (let i = 1; i < ring.length; i++) {
    let a = ring[i - 1];
    const b = ring[i];
    let seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
    while (seg > left) {
      const t = left / seg;
      const m: P = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      if (on) {
        cur.push(m);
        out.push(pl(cur));
      }
      cur = [m];
      on = !on;
      seg -= left;
      a = m;
      left = on ? dash : gap;
    }
    left -= seg;
    if (on) cur.push(b);
    else cur = [b];
  }
  if (on && cur.length > 1) out.push(pl(cur));
  return out.join(' ');
}

/** Points on an ellipse (deg 0 = up, clockwise), from a0 to a1. */
function arcPts(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, step = 4): P[] {
  const out: P[] = [];
  const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / step));
  for (let i = 0; i <= n; i++) {
    const a = rad(a0 + ((a1 - a0) * i) / n);
    out.push([cx + rx * Math.sin(a), cy - ry * Math.cos(a)]);
  }
  return out;
}

/** Rectangle corners as a point list (for dashed / offset work). */
const rectPts = (x0: number, y0: number, x1: number, y1: number): P[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

/** A rope (twisted cord) along a centreline: band outline for hiding, edge lines and twist strokes. */
function rope(pts: readonly P[], w: number, closed = false): { sil: string; edges: string; twists: string[] } {
  const L = offset(pts, w, closed);
  const R = offset(pts, -w, closed);
  const sil = closed ? `${pl(L, true)} ${pl(R, true)}` : pl([...L, ...[...R].reverse()], true);
  const edges = sil;
  const cum: number[] = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = cum[cum.length - 1];
  const idx = (s: number) => {
    let i = cum.findIndex((c) => c >= s);
    if (i < 0) i = pts.length - 1;
    return i;
  };
  const step = w * 1.25;
  const twists: string[] = [];
  for (let s = step * 0.6; s < total - w * 1.4; s += step) {
    const a = L[idx(s)];
    const b = R[idx(s + w * 1.3)];
    const m = pts[idx(s + w * 0.65)];
    const t = pts[idx(s + w * 0.3)];
    twists.push(`M ${f(a[0])} ${f(a[1])} Q ${f(m[0] + (t[0] - m[0]) * 0.9)} ${f(m[1] + (t[1] - m[1]) * 0.9)} ${f(b[0])} ${f(b[1])}`);
  }
  return { sil, edges, twists };
}

/** Ribbon banner along centreline yc(x) with swallow-tail ends tucked behind (layered items, front to back). */
function banner(x0: number, x1: number, yc: (x: number) => number, h: number, tail = 40, drop = 0.5): Item[] {
  const top: P[] = [];
  const bot: P[] = [];
  for (let x = x0; x <= x1 + 0.01; x += (x1 - x0) / 48) {
    top.push([x, yc(x) - h / 2]);
    bot.push([x, yc(x) + h / 2]);
  }
  const main = pl([...top, ...[...bot].reverse()], true);
  const items: Item[] = [{ sil: main }];
  const fx = Math.min(22, (x1 - x0) * 0.08);
  for (const side of [-1, 1]) {
    const xe = side < 0 ? x0 : x1;
    const yb = yc(xe) + h / 2;
    const tt = yb - h * (1 - drop);
    const tb = tt + h;
    const xi = xe - side * fx;
    const xo = xe + side * tail;
    const fold = pl([[xe, yb], [xi, yb], [xi, tb]] as P[], true);
    const tailShape = pl([[xi, tt], [xo, tt], [xo - side * h * 0.32, (tt + tb) / 2], [xo, tb], [xi, tb]] as P[], true);
    items.push({ sil: fold, d: [line(xe, yb, xi, tb)] });
    items.push({ sil: tailShape });
  }
  return [items[0], items[1], items[3], items[2], items[4]];
}

/** Small four-point sparkle. */
function sparkle(x: number, y: number, r: number): string {
  const k = r * 0.2;
  return (
    `M ${f(x)} ${f(y - r)} Q ${f(x + k)} ${f(y - k)} ${f(x + r)} ${f(y)} Q ${f(x + k)} ${f(y + k)} ${f(x)} ${f(y + r)} ` +
    `Q ${f(x - k)} ${f(y + k)} ${f(x - r)} ${f(y)} Q ${f(x - k)} ${f(y - k)} ${f(x)} ${f(y - r)} Z`
  );
}

/** Open spiral curl from (cx, cy) outwards: turns, start radius r0, end radius r1, start angle a0, dir ±1. */
function curl(cx: number, cy: number, r0: number, r1: number, turns: number, a0 = 0, dir = 1): P[] {
  const out: P[] = [];
  const n = Math.ceil(turns * 36);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push(polar(cx, cy, r0 + (r1 - r0) * t, a0 + dir * t * turns * 360));
  }
  return out;
}

/** Mirror points across x = axis. */
const mx = (pts: readonly P[], axis = 200): P[] => pts.map(([x, y]) => [2 * axis - x, y] as P);

/** Transform points: scale s about origin, rotate deg (clockwise), translate (tx, ty). */
const xf = (pts: readonly P[], s: number, deg: number, tx: number, ty: number): P[] => {
  const c = Math.cos(rad(deg));
  const sn = Math.sin(rad(deg));
  return pts.map(([x, y]) => [tx + s * (x * c - y * sn), ty + s * (x * sn + y * c)] as P);
};

/** Ramer–Douglas–Peucker over a point run. */
function rdp(pts: P[], tol: number): P[] {
  if (pts.length < 3) return pts;
  const keep = new Array<boolean>(pts.length).fill(false);
  keep[0] = keep[pts.length - 1] = true;
  const st: [number, number][] = [[0, pts.length - 1]];
  while (st.length) {
    const [a, b] = st.pop()!;
    let best = -1;
    let bestD = tol;
    for (let k = a + 1; k < b; k++) {
      const dd = segDist(pts[a], pts[b], pts[k][0], pts[k][1]);
      if (dd > bestD) {
        bestD = dd;
        best = k;
      }
    }
    if (best >= 0) {
      keep[best] = true;
      st.push([a, best], [best, b]);
    }
  }
  return pts.filter((_, k) => keep[k]);
}

/** Thin out straight-line runs (subpaths made only of M/L, optional Z) so the baked data stays small. */
function slim(d: string, tol = 0.45): string {
  return d
    .split(/(?=M)/)
    .map((sub) => sub.trim())
    .filter(Boolean)
    .map((sub) => {
      if (!/^M[-\d. L]*Z?$/.test(sub)) return sub;
      const closed = sub.endsWith('Z');
      const nums = (sub.match(/-?\d*\.?\d+/g) ?? []).map(Number);
      const pts: P[] = [];
      for (let k = 0; k + 1 < nums.length; k += 2) pts.push([nums[k], nums[k + 1]]);
      if (pts.length < 4) return sub;
      return pl(rdp(pts, tol), closed);
    })
    .join(' ');
}

const tpl = (id: string, name: string, category: TemplateCategory, level: TemplateLevel, tags: string[], a: Art, sw = 4, dw = 2): Template => ({
  id,
  name,
  category,
  level,
  tags,
  viewBox: VB,
  strokeWidth: sw,
  detailWidth: dw,
  paths: a.p.filter(Boolean).map((d) => slim(d)),
  ...(a.d.filter(Boolean).length ? { detail: a.d.filter(Boolean).map((d) => slim(d)) } : {}),
});

// ==== LETTERING KIT =============================================================================================

// Script letters: monoline handwriting skeletons in x-height units (y up, baseline 0, x-height 1, ascender ~1.85,
// descender ~-0.85). Each word is one continuous smooth curve through its letters' points; dots and crossbars are
// separate strokes. Shapes drawn for this app.
type ScriptGlyph = { w: number; pts: P[]; extra?: (x: number) => P[][] };
const SCRIPT: Record<string, ScriptGlyph> = {
  a: { w: 1.05, pts: [[0.8, 0.82], [0.5, 1.0], [0.16, 0.78], [0.06, 0.36], [0.3, 0.02], [0.62, 0.24], [0.82, 0.96], [0.76, 0.34], [0.86, 0.02], [1.05, 0.12]] },
  b: { w: 1.0, pts: [[0.08, 0.25], [0.42, 1.25], [0.42, 1.8], [0.22, 1.72], [0.14, 0.95], [0.14, 0.12], [0.44, 0.02], [0.74, 0.36], [0.6, 0.74], [0.4, 0.56], [0.7, 0.62], [1.0, 0.72]] },
  c: { w: 0.95, pts: [[0.3, 0.84], [0.56, 1.0], [0.74, 0.88], [0.6, 0.97], [0.3, 0.86], [0.1, 0.42], [0.34, 0.0], [0.7, 0.08], [0.95, 0.24]] },
  d: { w: 1.08, pts: [[0.8, 0.82], [0.5, 1.0], [0.16, 0.78], [0.06, 0.36], [0.3, 0.02], [0.62, 0.24], [0.8, 0.9], [0.92, 1.85], [0.82, 0.8], [0.84, 0.04], [1.08, 0.14]] },
  e: { w: 0.95, pts: [[0.1, 0.26], [0.52, 0.48], [0.68, 0.8], [0.48, 0.98], [0.2, 0.76], [0.12, 0.3], [0.4, 0.0], [0.74, 0.1], [0.95, 0.24]] },
  g: { w: 1.0, pts: [[0.8, 0.82], [0.5, 1.0], [0.16, 0.78], [0.06, 0.36], [0.3, 0.02], [0.62, 0.24], [0.82, 0.96], [0.78, 0.0], [0.68, -0.62], [0.44, -0.84], [0.28, -0.6], [0.58, -0.24], [1.0, 0.1]] },
  h: { w: 1.05, pts: [[0.08, 0.25], [0.42, 1.25], [0.42, 1.8], [0.22, 1.72], [0.14, 0.95], [0.12, 0.0], [0.22, 0.56], [0.5, 0.96], [0.74, 0.74], [0.74, 0.18], [0.85, 0.0], [1.05, 0.14]] },
  i: { w: 0.6, pts: [[0.16, 0.2], [0.34, 0.96], [0.3, 0.24], [0.4, 0.0], [0.6, 0.14]], extra: (x) => [[[x + 0.36, 1.38], [x + 0.4, 1.42]]] },
  k: { w: 0.98, pts: [[0.08, 0.25], [0.42, 1.25], [0.42, 1.8], [0.22, 1.72], [0.14, 0.95], [0.12, 0.0], [0.24, 0.58], [0.56, 0.96], [0.68, 0.78], [0.42, 0.52], [0.2, 0.48], [0.52, 0.4], [0.68, 0.04], [0.98, 0.14]] },
  l: { w: 0.62, pts: [[0.08, 0.25], [0.42, 1.25], [0.42, 1.8], [0.22, 1.72], [0.14, 0.95], [0.18, 0.12], [0.42, 0.0], [0.62, 0.14]] },
  m: { w: 1.32, pts: [[0.1, 0.6], [0.2, 0.96], [0.16, 0.0], [0.24, 0.6], [0.44, 0.96], [0.6, 0.72], [0.58, 0.0], [0.66, 0.6], [0.86, 0.96], [1.02, 0.72], [1.02, 0.16], [1.12, 0.0], [1.32, 0.14]] },
  n: { w: 1.0, pts: [[0.1, 0.6], [0.2, 0.96], [0.16, 0.0], [0.26, 0.6], [0.5, 0.96], [0.72, 0.72], [0.72, 0.16], [0.82, 0.0], [1.0, 0.14]] },
  o: { w: 1.05, pts: [[0.5, 1.0], [0.3, 0.8], [0.26, 0.36], [0.48, 0.0], [0.8, 0.28], [0.78, 0.82], [0.56, 0.98], [0.8, 0.86], [1.05, 0.82]] },
  p: { w: 0.98, pts: [[0.1, 0.6], [0.26, 0.96], [0.24, 0.0], [0.2, -0.86], [0.24, -0.1], [0.32, 0.6], [0.6, 0.96], [0.8, 0.6], [0.62, 0.04], [0.32, 0.14], [0.62, 0.08], [0.98, 0.18]] },
  r: { w: 0.92, pts: [[0.12, 0.4], [0.32, 0.96], [0.46, 0.8], [0.64, 0.86], [0.6, 0.4], [0.62, 0.1], [0.76, 0.0], [0.92, 0.14]] },
  s: { w: 0.86, pts: [[0.1, 0.3], [0.44, 1.0], [0.64, 0.54], [0.6, 0.12], [0.36, 0.02], [0.2, 0.16], [0.54, 0.05], [0.86, 0.16]] },
  t: { w: 0.74, pts: [[0.1, 0.3], [0.4, 1.5], [0.32, 0.6], [0.35, 0.06], [0.58, 0.0], [0.74, 0.14]], extra: (x) => [[[x + 0.08, 1.0], [x + 0.66, 1.02]]] },
  u: { w: 1.0, pts: [[0.1, 0.5], [0.2, 0.96], [0.15, 0.2], [0.35, 0.0], [0.64, 0.3], [0.76, 0.96], [0.7, 0.2], [0.8, 0.0], [1.0, 0.14]] },
  v: { w: 0.96, pts: [[0.1, 0.6], [0.24, 0.96], [0.34, 0.5], [0.5, 0.0], [0.68, 0.6], [0.76, 0.96], [0.7, 0.8], [0.96, 0.82]] },
  w: { w: 1.26, pts: [[0.1, 0.6], [0.22, 0.96], [0.25, 0.3], [0.4, 0.0], [0.56, 0.5], [0.62, 0.76], [0.68, 0.3], [0.85, 0.0], [1.0, 0.5], [1.05, 0.96], [1.0, 0.8], [1.26, 0.82]] },
  y: { w: 0.96, pts: [[0.1, 0.5], [0.2, 0.96], [0.15, 0.24], [0.35, 0.0], [0.64, 0.3], [0.76, 0.96], [0.72, 0.0], [0.62, -0.62], [0.4, -0.84], [0.25, -0.6], [0.55, -0.24], [0.96, 0.1]] },
};

/** Lay out a script word: returns stroke strings and the drawn width. x-height h, baseline y, slant. */
function scriptWord(word: string, x0: number, base: number, h: number, slant = 0.22): { strokes: string[]; width: number } {
  const toXY = (x: number, y: number): P => [x0 + (x + y * slant) * h, base - y * h];
  const strokes: string[] = [];
  let cur: P[] = [];
  let pen = 0;
  const flush = () => {
    if (cur.length > 1) strokes.push(smooth(cur.map(([x, y]) => toXY(x, y)), false));
    cur = [];
  };
  for (const ch of word) {
    if (ch === ' ') {
      flush();
      pen += 0.6;
      continue;
    }
    const g = SCRIPT[ch];
    if (!g) throw new Error(`no script glyph ${ch}`);
    if (!cur.length) cur.push([pen + g.pts[0][0] - 0.12, Math.max(0, g.pts[0][1] - 0.25)]);
    for (const [x, y] of g.pts) cur.push([pen + x, y]);
    for (const e of g.extra?.(pen) ?? []) strokes.push(pl(e.map(([x, y]) => toXY(x, y))));
    pen += g.w;
  }
  flush();
  return { strokes, width: pen * h };
}

/** Script word centred on cx (approximate, ignoring slant overhang). */
function scriptCentered(word: string, cx: number, base: number, h: number, slant = 0.22): string[] {
  const w = scriptWord(word, 0, base, h, slant).width;
  return scriptWord(word, cx - w / 2 - 0.3 * h * slant, base, h, slant).strokes;
}

// Bubble capitals: stroke skeletons in cap-height units (y up, 0..1), inflated into a rounded outline.
type Stroke = P[];
const arcU = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, step = 15): Stroke => {
  const out: P[] = [];
  const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / step));
  for (let i = 0; i <= n; i++) {
    const a = rad(a0 + ((a1 - a0) * i) / n);
    out.push([cx + rx * Math.sin(a), cy + ry * Math.cos(a)]);
  }
  return out;
};
const BUBBLE: Record<string, { w: number; s: Stroke[] }> = {
  A: { w: 0.95, s: [[[0.12, 0], [0.475, 1], [0.83, 0]], [[0.3, 0.36], [0.65, 0.36]]] },
  B: { w: 0.82, s: [[[0.18, 0], [0.18, 1]], [[0.18, 1], [0.48, 1], ...arcU(0.48, 0.76, 0.24, 0.24, 0, 180).slice(1), [0.18, 0.52]], [[0.18, 0.52], [0.52, 0.52], ...arcU(0.52, 0.26, 0.26, 0.26, 0, 180).slice(1), [0.18, 0]]] },
  C: { w: 0.9, s: [arcU(0.5, 0.5, 0.38, 0.5, 40, -220)] },
  D: { w: 0.88, s: [[[0.18, 0], [0.18, 1], [0.38, 1], ...arcU(0.38, 0.5, 0.38, 0.5, 0, 180).slice(1), [0.18, 0]]] },
  E: { w: 0.78, s: [[[0.68, 1], [0.18, 1], [0.18, 0], [0.68, 0]], [[0.18, 0.5], [0.58, 0.5]]] },
  G: { w: 0.95, s: [[...arcU(0.5, 0.5, 0.38, 0.5, 40, -235), [0.88, 0.45], [0.6, 0.45]]] },
  H: { w: 0.9, s: [[[0.16, 0], [0.16, 1]], [[0.74, 0], [0.74, 1]], [[0.16, 0.5], [0.74, 0.5]]] },
  I: { w: 0.42, s: [[[0.21, 0], [0.21, 1]]] },
  J: { w: 0.78, s: [[[0.6, 1], [0.6, 0.32], ...arcU(0.38, 0.32, 0.22, 0.3, 90, 270).slice(1)]] },
  M: { w: 1.08, s: [[[0.14, 0], [0.14, 1], [0.54, 0.38], [0.94, 1], [0.94, 0]]] },
  N: { w: 0.92, s: [[[0.16, 0], [0.16, 1], [0.76, 0], [0.76, 1]]] },
  O: { w: 1.0, s: [arcU(0.5, 0.5, 0.36, 0.5, 0, 360)] },
  P: { w: 0.8, s: [[[0.18, 0], [0.18, 1], [0.46, 1], ...arcU(0.46, 0.74, 0.26, 0.26, 0, 180).slice(1), [0.18, 0.48]]] },
  R: { w: 0.86, s: [[[0.18, 0], [0.18, 1], [0.46, 1], ...arcU(0.46, 0.74, 0.26, 0.26, 0, 180).slice(1), [0.18, 0.48]], [[0.42, 0.48], [0.74, 0]]] },
  K: { w: 0.86, s: [[[0.18, 0], [0.18, 1]], [[0.74, 1], [0.24, 0.44]], [[0.4, 0.58], [0.76, 0]]] },
  L: { w: 0.74, s: [[[0.18, 1], [0.18, 0], [0.66, 0]]] },
  T: { w: 0.82, s: [[[0.08, 1], [0.74, 1]], [[0.41, 1], [0.41, 0]]] },
  U: { w: 0.9, s: [[[0.16, 1], [0.16, 0.36], ...arcU(0.45, 0.36, 0.29, 0.36, 270, 90).slice(1), [0.74, 1]]] },
  V: { w: 0.94, s: [[[0.1, 1], [0.47, 0], [0.84, 1]]] },
  Y: { w: 0.9, s: [[[0.1, 1], [0.45, 0.48], [0.8, 1]], [[0.45, 0.48], [0.45, 0]]] },
};

/** S skeleton drawn explicitly (the arc trick above is fiddly): a smooth curve through hand-placed points. */
BUBBLE.S = { w: 0.82, s: [curvePts([[0.74, 0.86], [0.5, 1.0], [0.2, 0.88], [0.2, 0.62], [0.5, 0.5], [0.66, 0.4], [0.66, 0.12], [0.38, 0.0], [0.1, 0.14]], false, 5)] };

/** One letter's inflated outline (merged capsules). */
function bubbleLetter(ch: string, x0: number, base: number, H: number, hw: number): { sil: string[]; skel: P[][] } {
  const g = BUBBLE[ch];
  if (!g) throw new Error(`no bubble glyph ${ch}`);
  const caps: string[] = [];
  const skel: P[][] = [];
  for (const s of g.s) {
    const pts = s.map(([x, y]) => [x0 + x * H, base - y * H] as P);
    skel.push(pts);
    for (let i = 0; i + 1 < pts.length; i++) {
      if (Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]) < 0.5) continue;
      caps.push(limb(pts[i], pts[i + 1], hw, hw));
    }
  }
  return { sil: caps, skel };
}

/** Bubble word: per letter merged outlines, laid out centred on cx. Returns sils (for layering) and outlines. */
function bubbleWord(word: string, cx: number, base: number, H0: number, gap = 0.1, hwk = 0.15, maxW = 330): { sils: string[][]; outlines: string[]; skel: P[][] } {
  const units = [...word].reduce((n, ch) => n + (ch === ' ' ? 0.4 : BUBBLE[ch].w + gap), -gap);
  const H = Math.min(H0, maxW / (units + 2 * hwk));
  const hw = H * hwk;
  const width = units * H;
  let x = cx - width / 2;
  const sils: string[][] = [];
  const outlines: string[] = [];
  const skel: P[][] = [];
  for (const ch of word) {
    if (ch === ' ') {
      x += 0.4 * H;
      continue;
    }
    const b = bubbleLetter(ch, x, base, H, hw);
    sils.push(b.sil);
    outlines.push(union(b.sil));
    skel.push(...b.skel);
    x += (BUBBLE[ch].w + gap) * H;
  }
  return { sils, outlines, skel };
}

/** Distance from (x, y) to segment ab. */
function segDist(a: P, b: P, x: number, y: number): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l2));
  return Math.hypot(a[0] + dx * t - x, a[1] + dy * t - y);
}

/** Drop shadow for bubble letters: the letters shifted by (dx, dy), only where they show outside the letters,
 * with hatch lines filling the visible shadow. */
function bubbleShadow(word: string, cx: number, base: number, H0: number, dx: number, dy: number, gap = 0.1, hwk = 0.15, maxW = 330): { p: string[]; d: string[] } {
  const units = [...word].reduce((n, ch) => n + (ch === ' ' ? 0.4 : BUBBLE[ch].w + gap), -gap);
  const H = Math.min(H0, maxW / (units + 2 * hwk));
  const front = bubbleWord(word, cx, base, H, gap, hwk, maxW);
  const back = bubbleWord(word, cx + dx, base + dy, H, gap, hwk, maxW);
  const frontRegs = front.sils.map((s) => region(s));
  const p = back.outlines.map((o) => clip(o, frontRegs)).filter(Boolean);
  const hw = H * hwk;
  const near = (sk: P[][], x: number, y: number) => sk.some((pts) => pts.some((a, i) => i + 1 < pts.length && segDist(a, pts[i + 1], x, y) < hw));
  const inF = (x: number, y: number) => near(front.skel, x, y);
  const inB = (x: number, y: number) => near(back.skel, x, y);
  const xs = back.skel.flat().map((q) => q[0]);
  const ys = back.skel.flat().map((q) => q[1]);
  const pad = H * hwk + 2;
  const box: [number, number, number, number] = [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad];
  const hat = hatch((x, y) => inB(x, y) && !inF(x, y), box, -45, 5);
  return { p, d: hat ? [hat] : [] };
}

// ==== PATTERNS: beginner ========================================================================================

function archFrame(): Art {
  const arch = (x0: number, x1: number, top: number, bot: number): string => {
    const r = (x1 - x0) / 2;
    const cx = (x0 + x1) / 2;
    const cy = top + r;
    return `M ${f(x0)} ${f(bot)} L ${f(x0)} ${f(cy)} A ${f(r)} ${f(r)} 0 0 1 ${f(x1)} ${f(cy)} L ${f(x1)} ${f(bot)} Z`;
  };
  const p = [arch(92, 308, 44, 336), arch(112, 288, 64, 316)];
  // keystone
  p.push(pl([[186, 40], [214, 40], [208, 76], [192, 76]], true));
  // plinth
  p.push(rrect(76, 336, 248, 22, 4));
  // spring-line blocks and rosettes
  p.push(pl([[84, 150], [120, 150], [120, 168], [84, 168]], true), pl([[280, 150], [316, 150], [316, 168], [280, 168]], true));
  const d = [circle(200, 360 - 13, 4), line(112, 300, 288, 300)];
  return { p, d };
}

function scallopFrame(): Art {
  const n = 18;
  const R = 160;
  const pts: P[] = [];
  for (let i = 0; i < n; i++) {
    const a0 = (360 / n) * i;
    for (let k = 0; k <= 12; k++) {
      const a = a0 + (360 / n) * (k / 12);
      const bump = Math.sin((Math.PI * k) / 12) * 14;
      pts.push(polar(200, 200, R - 10 + bump, a));
    }
  }
  const p = [pl(pts, true), circle(200, 200, 128), circle(200, 200, 116)];
  const dots: string[] = [];
  for (let i = 0; i < n; i++) {
    const [x, y] = polar(200, 200, 146, (360 / n) * (i + 0.5));
    dots.push(circle(x, y, 3.5));
  }
  return { p, d: [dots.join(' ')] };
}

function notchedFrame(): Art {
  const notched = (x0: number, y0: number, x1: number, y1: number, r: number): string =>
    `M ${f(x0 + r)} ${f(y0)} L ${f(x1 - r)} ${f(y0)} A ${f(r)} ${f(r)} 0 0 0 ${f(x1)} ${f(y0 + r)} L ${f(x1)} ${f(y1 - r)} ` +
    `A ${f(r)} ${f(r)} 0 0 0 ${f(x1 - r)} ${f(y1)} L ${f(x0 + r)} ${f(y1)} A ${f(r)} ${f(r)} 0 0 0 ${f(x0)} ${f(y1 - r)} ` +
    `L ${f(x0)} ${f(y0 + r)} A ${f(r)} ${f(r)} 0 0 0 ${f(x0 + r)} ${f(y0)} Z`;
  const p = [notched(40, 70, 360, 330, 34), notched(58, 88, 342, 312, 26)];
  const dia = (x: number, y: number, s: number) => pl([[x, y - s], [x + s, y], [x, y + s], [x - s, y]], true);
  p.push(dia(200, 70, 12), dia(200, 330, 12), dia(40, 200, 12), dia(360, 200, 12));
  return { p, d: [] };
}

function waveBorders(): Art {
  const p: string[] = [];
  const d: string[] = [];
  // band 1: running scroll (breaking waves) between two lines
  const y1 = 60;
  p.push(line(30, y1 - 32, 370, y1 - 32), line(30, y1 + 32, 370, y1 + 32));
  // draw each wave as its own curl stroke + crest
  for (let x = 40; x < 300; x += 64) {
    const crest: P[] = [[x, y1 + 24], [x + 22, y1 + 14], [x + 42, y1 - 10], [x + 56, y1 - 6], [x + 52, y1 + 6], [x + 42, y1 + 4], [x + 44, y1 - 2]];
    p.push(smooth([...crest], false));
    p.push(smooth([[x + 64, y1 + 24], [x + 50, y1 + 22], [x + 42, y1 + 4]], false));
  }
  // band 2: double sine wave
  const y2 = 170;
  for (const [amp, ph] of [[18, 0], [18, Math.PI]] as const) {
    const pts: P[] = [];
    for (let x = 30; x <= 370; x += 4) pts.push([x, y2 + amp * Math.sin(((x - 30) / 340) * Math.PI * 8 + ph)]);
    p.push(pl(pts));
  }
  d.push(dashed([[30, y2 - 34], [370, y2 - 34]], 10, 6), dashed([[30, y2 + 34], [370, y2 + 34]], 10, 6));
  // band 3: scallops with inner arcs
  const y3 = 270;
  p.push(line(30, y3 - 24, 370, y3 - 24));
  const sc: P[] = [];
  for (let x = 30; x < 370; x += 34) for (let a = -90; a <= 90; a += 10) sc.push([x + 17 + 17 * Math.sin(rad(a)), y3 - 6 + 24 * Math.cos(rad(a))]);
  p.push(pl(sc));
  const inner: string[] = [];
  for (let x = 30; x < 370; x += 34) inner.push(pl(arcPts(x + 17, y3 - 6, 9, 13, 100, 260)));
  d.push(inner.join(' '));
  // band 4: zig-zag
  const y4 = 350;
  const zz: P[] = [];
  for (let x = 30, k = 0; x <= 370; x += 17, k++) zz.push([x, y4 + (k % 2 ? -14 : 14)]);
  p.push(pl(zz));
  return { p, d };
}

function luggageTag(): Art {
  const tag = pl([[110, 120], [150, 70], [330, 70], [330, 330], [150, 330], [110, 280]], true);
  const p = [tag, circle(140, 200, 14), circle(140, 200, 24)];
  // string loop through the hole
  p.push(smooth([[132, 190], [100, 160], [60, 110], [40, 60], [70, 40], [96, 70], [120, 140], [146, 194]], false));
  const d = [
    dashed([[124, 128], [158, 86], [316, 86], [316, 314], [158, 314], [124, 272]], 8, 6, true),
    `${line(190, 150, 300, 150)} ${line(190, 200, 300, 200)} ${line(190, 250, 300, 250)}`,
  ];
  return { p, d };
}

function ticketLabel(): Art {
  const [x0, y0, x1, y1] = [40, 110, 360, 290];
  const r = 18;
  const my = (y0 + y1) / 2;
  const t =
    `M ${x0} ${y0} L ${x1} ${y0} L ${x1} ${my - r} A ${r} ${r} 0 0 0 ${x1} ${my + r} L ${x1} ${y1} L ${x0} ${y1} ` +
    `L ${x0} ${my + r} A ${r} ${r} 0 0 0 ${x0} ${my - r} Z`;
  const p = [t, rrect(64, 130, 200, 140, 10)];
  const holes: string[] = [];
  for (let y = y0 + 12; y <= y1 - 10; y += 16) holes.push(circle(288, y, 2.5));
  p.push(star(326, my, 22, 9, 5));
  return { p, d: [holes.join(' '), `${line(84, 180, 244, 180)} ${line(84, 220, 244, 220)}`] };
}

function quiltGrid(x0: number, y0: number, s: number, n: number): string {
  const out: string[] = [];
  for (let i = 1; i < n; i++) out.push(line(x0 + (s * i) / n, y0, x0 + (s * i) / n, y0 + s), line(x0, y0 + (s * i) / n, x0 + s, y0 + (s * i) / n));
  return out.join(' ');
}

function pinwheelQuilt(): Art {
  const [x0, y0, s] = [60, 60, 280];
  const c = s / 4;
  const p = [pl(rectPts(x0, y0, x0 + s, y0 + s), true), pl(rectPts(x0 - 14, y0 - 14, x0 + s + 14, y0 + s + 14), true)];
  // 4×4 grid with half-square triangles that turn as a pinwheel in each quadrant
  const seg: string[] = [quiltGrid(x0, y0, s, 4)];
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) {
      const x = x0 + i * c;
      const y = y0 + j * c;
      const quad = (i < 2 ? 0 : 1) + (j < 2 ? 0 : 2);
      const diagA = (i + j) % 2 === (quad === 0 || quad === 3 ? 0 : 1);
      seg.push(diagA ? line(x, y, x + c, y + c) : line(x + c, y, x, y + c));
    }
  p.push(seg.join(' '));
  const d = [dashed(rectPts(x0 + 6, y0 + 6, x0 + s - 6, y0 + s - 6), 6, 6, true)];
  return { p, d };
}

function sawtoothStar(): Art {
  const [x0, y0, s] = [56, 56, 288];
  const c = s / 4;
  const p = [pl(rectPts(x0, y0, x0 + s, y0 + s), true), pl(rectPts(x0 + c, y0 + c, x0 + 3 * c, y0 + 3 * c), true)];
  const seg: string[] = [];
  // outer ring of cells: corners plain, sides as flying-geese pairs
  seg.push(line(x0 + c, y0, x0 + c, y0 + s), line(x0 + 3 * c, y0, x0 + 3 * c, y0 + s), line(x0, y0 + c, x0 + s, y0 + c), line(x0, y0 + 3 * c, x0 + s, y0 + 3 * c));
  // flying geese: top, bottom, left, right
  const m = x0 + 2 * c;
  seg.push(pl([[x0 + c, y0], [x0 + c * 1.5, y0 + c], [m, y0], [x0 + c * 2.5, y0 + c], [x0 + 3 * c, y0]]));
  seg.push(pl([[x0 + c, y0 + s], [x0 + c * 1.5, y0 + 3 * c], [m, y0 + s], [x0 + c * 2.5, y0 + 3 * c], [x0 + 3 * c, y0 + s]]));
  seg.push(pl([[x0, y0 + c], [x0 + c, y0 + c * 1.5], [x0, m], [x0 + c, y0 + c * 2.5], [x0, y0 + 3 * c]]));
  seg.push(pl([[x0 + s, y0 + c], [x0 + 3 * c, y0 + c * 1.5], [x0 + s, m], [x0 + 3 * c, y0 + c * 2.5], [x0 + s, y0 + 3 * c]]));
  p.push(seg.join(' '));
  const d = [pl(rectPts(x0 + c + 16, y0 + c + 16, x0 + 3 * c - 16, y0 + 3 * c - 16), true), dashed(rectPts(x0 + 6, y0 + 6, x0 + s - 6, y0 + s - 6), 6, 6, true)];
  return { p, d };
}

function logCabin(): Art {
  const p: string[] = [];
  const [cx, cy] = [200, 200];
  p.push(pl(rectPts(cx - 30, cy - 30, cx + 30, cy + 30), true));
  // logs spiral outwards, each round adds four strips
  let [l, t, r, b] = [cx - 30, cy - 30, cx + 30, cy + 30];
  const w = 26;
  const seg: string[] = [];
  for (let k = 0; k < 4; k++) {
    // right strip, bottom strip, left strip, top strip (log cabin order)
    r += w;
    seg.push(pl([[r - w, t], [r, t], [r, b], [r - w, b]]));
    b += w;
    seg.push(pl([[r, b - w], [r, b], [l, b], [l, b - w]]));
    l -= w;
    seg.push(pl([[l + w, b], [l, b], [l, t], [l + w, t]]));
    t -= w;
    seg.push(pl([[l, t + w], [l, t], [r, t], [r, t + w]]));
  }
  p.push(seg.join(' '));
  p.push(pl(rectPts(l - 10, t - 10, r + 10, b + 10), true));
  return { p, d: [dashed(rectPts(cx - 20, cy - 20, cx + 20, cy + 20), 5, 5, true)] };
}

function horseshoeFrame(): Art {
  // horseshoe opening upwards: outer and inner U curves with heel blocks
  const shoe = (rx: number, ry: number): P[] => {
    const out: P[] = [];
    for (let a = -122; a <= 122; a += 4) out.push([200 + rx * Math.sin(rad(a)), 196 + ry * Math.cos(rad(a))]);
    return out;
  };
  const outer = shoe(130, 130);
  const inner = shoe(84, 84).reverse();
  const sil = pl([...outer, ...inner], true);
  const holes: string[] = [];
  for (const a of [-100, -76, -52, -28, 28, 52, 76, 100]) {
    const x = 200 + 107 * Math.sin(rad(a));
    const y = 196 + 107 * Math.cos(rad(a));
    holes.push(rrect(x - 4, y - 6, 8, 12, 3));
  }
  const groove = pl(shoe(107, 107));
  const items: Item[] = [
    ...banner(96, 304, (x) => 318 - 8 * Math.sin(((x - 96) / 208) * Math.PI), 44, 36),
    { sil, p: [holes.join(' ')], d: [groove] },
  ];
  const a = layered(items);
  a.d.push(`${sparkle(200, 196, 18)} ${sparkle(160, 222, 9)} ${sparkle(240, 222, 9)}`);
  return a;
}

function stitchedHeart(): Art {
  const p = [heart(200, 215, 300), heart(200, 213, 240)];
  // stitches between the two hearts: sample the mid heart
  const mid = heart(200, 214, 270);
  const ptsMid = samplePts(mid);
  const d = [dashed(ptsMid, 8, 7, true), `${heart(200, 205, 40)}`];
  return { p, d };
}

/** Sampled points of a single closed path. */
const samplePts = (d: string): P[] => samplePath(d, 2)[0].pts;

function bracketLabels(): Art {
  const p: string[] = [];
  // 1: bracket label: concave corners and pointed ends
  const bracket = (y: number, w: number, h: number, r: number): string => {
    const x0 = 200 - w / 2;
    const x1 = 200 + w / 2;
    const t = y - h / 2;
    const b = y + h / 2;
    return (
      `M ${f(x0 + r)} ${f(t)} L ${f(x1 - r)} ${f(t)} A ${f(r)} ${f(r)} 0 0 0 ${f(x1)} ${f(t + r)} Q ${f(x1 + r * 0.2)} ${f(y)} ${f(x1 + r)} ${f(y)} ` +
      `Q ${f(x1 + r * 0.2)} ${f(y)} ${f(x1)} ${f(b - r)} A ${f(r)} ${f(r)} 0 0 0 ${f(x1 - r)} ${f(b)} L ${f(x0 + r)} ${f(b)} ` +
      `A ${f(r)} ${f(r)} 0 0 0 ${f(x0)} ${f(b - r)} Q ${f(x0 - r * 0.2)} ${f(y)} ${f(x0 - r)} ${f(y)} Q ${f(x0 - r * 0.2)} ${f(y)} ${f(x0)} ${f(t + r)} ` +
      `A ${f(r)} ${f(r)} 0 0 0 ${f(x0 + r)} ${f(t)} Z`
    );
  };
  p.push(bracket(84, 250, 80, 18), bracket(84, 220, 56, 12));
  // 2: rectangle with notched ends
  p.push(pl([[60, 166], [340, 166], [318, 202], [340, 238], [60, 238], [82, 202]], true));
  // 3: oval label with rim
  p.push(ellipse(200, 316, 130, 50), ellipse(200, 316, 116, 38));
  const d = [pl([[86, 176], [314, 176], [296, 202], [314, 228], [86, 228], [104, 202]], true)];
  return { p, d };
}

// ==== PATTERNS: intermediate ====================================================================================

function greekKeyFrame(): Art {
  const p: string[] = [];
  const [o0, o1, band] = [36, 364, 44];
  p.push(pl(rectPts(o0, o0, o1, o1), true), pl(rectPts(o0 + band, o0 + band, o1 - band, o1 - band), true));
  // hooks attached to the inner line of the band, running clockwise; u along, v across (0 = outer edge)
  const key: string[] = [];
  const unit = 36;
  const side = (start: P, dir: P, inward: P, len: number) => {
    const at = (u: number, v: number): P => [start[0] + dir[0] * u + inward[0] * v, start[1] + dir[1] * u + inward[1] * v];
    const n = Math.floor(len / unit);
    const off = (len - n * unit) / 2;
    for (let i = 0; i < n; i++) {
      const u = off + i * unit;
      const s = band;
      key.push(pl([at(u + 4, s), at(u + 4, s * 0.18), at(u + 30, s * 0.18), at(u + 30, s * 0.72), at(u + 14, s * 0.72), at(u + 14, s * 0.42), at(u + 22, s * 0.42)]));
    }
  };
  const L = o1 - o0 - 2 * band;
  side([o0 + band, o0], [1, 0], [0, 1], L);
  side([o1, o0 + band], [0, 1], [-1, 0], L);
  side([o1 - band, o1], [-1, 0], [0, -1], L);
  side([o0, o1 - band], [0, -1], [1, 0], L);
  p.push(...chunks(key, 4));
  // corner squares with a square spiral
  const corners: string[] = [];
  for (const [cx, cy] of [[o0, o0], [o1 - band, o0], [o1 - band, o1 - band], [o0, o1 - band]] as const) {
    corners.push(pl(rectPts(cx, cy, cx + band, cy + band), true));
    corners.push(pl(rectPts(cx + 12, cy + 12, cx + band - 12, cy + band - 12), true));
  }
  const d = [corners.join(' '), pl(rectPts(o0 + band + 12, o0 + band + 12, o1 - band - 12, o1 - band - 12), true)];
  return { p, d };
}

function chainBorders(): Art {
  const items: Item[] = [];
  for (const y of [90, 200, 310]) {
    const linkW = 60;
    const step = 44;
    // side-on links (narrow bars) in front, face-on links behind
    const bars: Item[] = [];
    const faces: Item[] = [];
    for (let k = 0, x = 30; x + linkW <= 376; x += step, k++) {
      if (k % 2 === 0) faces.push({ sil: rrect(x, y - 24, linkW, 48, 24), p: [rrect(x + 12, y - 12, linkW - 24, 24, 12)] });
      else bars.push({ sil: rrect(x, y - 7, linkW, 14, 7), d: [line(x + 12, y, x + linkW - 12, y)] });
    }
    // hole of each face link shows what's behind: make the bars visible through holes by drawing bars first
    items.push(...bars, ...faces);
  }
  const a = layered(items);
  a.d.push(dashed([[24, 145], [376, 145]], 4, 8), dashed([[24, 255], [376, 255]], 4, 8));
  return a;
}

function beadedOval(): Art {
  const p = [ellipse(200, 214, 120, 150), ellipse(200, 214, 96, 126)];
  const beads: string[] = [];
  for (let a = 0; a < 360; a += 10) {
    const x = 200 + 108 * Math.sin(rad(a));
    const y = 214 - 138 * Math.cos(rad(a));
    if (Math.abs(a) < 20 || a > 340) continue;
    beads.push(circle(x, y, 4.5));
  }
  // bow at the top
  const bow: Item[] = [
    { sil: rrect(188, 62, 24, 22, 6) },
    { sil: smooth([[190, 72], [160, 46], [128, 50], [130, 82], [160, 96], [190, 76]]) , d: [smooth([[186, 72], [158, 58], [140, 66]], false)] },
    { sil: smooth([[210, 72], [240, 46], [272, 50], [270, 82], [240, 96], [210, 76]]), d: [smooth([[214, 72], [242, 58], [260, 66]], false)] },
    { sil: pl([[192, 82], [170, 130], [182, 126], [190, 140], [204, 84]], true) },
    { sil: pl([[208, 82], [230, 130], [218, 126], [210, 140], [196, 84]], true) },
  ];
  // sprig at the bottom
  const leaves: string[] = [];
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) leaves.push(petal(200 + s * (12 + i * 22), 366 - i * 4, s * (70 + i * 8), 26, 7));
  const art = layered([...bow, { sil: '', p: [p[0], p[1]], d: [beads.join(' ')] }]);
  art.p.push(leaves.join(' '), circle(200, 364, 7));
  return art;
}

function cornerFlourishes(): Art {
  const p: string[] = [];
  const d: string[] = [];
  const one = (sx: number, sy: number): void => {
    const T = (pts: P[]): P[] => pts.map(([x, y]) => [sx < 0 ? 400 - x : x, sy < 0 ? 400 - y : y] as P);
    // one sweep round the corner with an inward curl at each end
    const start = curl(178, 58, 3, 13, 1, 360, -1);
    const end = curl(58, 178, 13, 3, 1, 270, -1);
    const sweep = curvePts([[178, 45], [140, 42], [100, 46], [72, 58], [56, 74], [46, 100], [42, 140], [45, 178]], false, 8);
    p.push(pl(T([...start, ...sweep.slice(1, -1), ...end])));
    // inner parallel line
    d.push(smooth(T([[150, 58], [104, 60], [80, 70], [68, 82], [60, 104], [58, 150]]), false));
    // corner spiral and leaf pair on the diagonal
    p.push(pl(T(curl(92, 92, 3, 18, 1.3, 315, 1))));
    d.push(petal(...T([[74, 74]])[0], sx > 0 ? (sy > 0 ? 315 : 225) : sy > 0 ? 45 : 135, 26, 7));
    const lp = (x: number, y: number, deg: number) => petal(...T([[x, y]])[0], deg, 24, 6);
    const ang = (deg: number) => (sx > 0 ? (sy > 0 ? deg : 180 - deg) : sy > 0 ? -deg : 180 + deg);
    d.push(lp(124, 58, ang(150)), lp(58, 124, ang(120)));
    d.push(circle(...T([[30, 30]])[0], 4));
  };
  one(1, 1);
  one(-1, 1);
  one(1, -1);
  one(-1, -1);
  return { p, d };
}

function vineFrame(): Art {
  const p: string[] = [];
  const d: string[] = [];
  const [x0, y0, x1, y1] = [34, 34, 366, 366];
  p.push(pl(rectPts(x0, y0, x1, y1), true), pl(rectPts(x0 + 52, y0 + 52, x1 - 52, y1 - 52), true));
  // the vine: a wave running round the band centre line
  const cpath: P[] = [];
  const m = 26;
  const ring = rectPts(x0 + m, y0 + m, x1 - m, y1 - m);
  for (let s = 0; s < 4; s++) {
    const a = ring[s];
    const b = ring[(s + 1) % 4];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const ux = (b[0] - a[0]) / len;
    const uy = (b[1] - a[1]) / len;
    for (let t = 0; t < len; t += 3) {
      const amp = 9 * Math.sin((t / len) * Math.PI * 6) * Math.min(1, t / 30, (len - t) / 30);
      cpath.push([a[0] + ux * t - uy * amp, a[1] + uy * t + ux * amp]);
    }
  }
  p.push(pl(cpath, true));
  const leaves: string[] = [];
  const veins: string[] = [];
  for (let i = 10; i < cpath.length; i += 18) {
    const [x, y] = cpath[i];
    const [nx, ny] = cpath[Math.min(cpath.length - 1, i + 1)];
    const dir = (Math.atan2(nx - x, -(ny - y)) * 180) / Math.PI;
    const side = (Math.floor(i / 18) % 2 ? 1 : -1) * 55;
    leaves.push(petal(x, y, dir + side, 20, 6));
    const tip = polar(x, y, 16, dir + side);
    veins.push(line(x, y, tip[0], tip[1]));
  }
  p.push(...chunks(leaves, 3));
  d.push(...chunks(veins, 2));
  // corner blossoms
  for (const [cx, cy] of ring) {
    const fl: string[] = [];
    for (let k = 0; k < 5; k++) fl.push(petal(cx, cy, k * 72, 18, 7));
    p.push(`${fl.join(' ')} ${circle(cx, cy, 4)}`);
  }
  return { p, d };
}

function decoSunburst(): Art {
  const p: string[] = [];
  const d: string[] = [];
  // stepped frame
  const step = (k: number): P[] => [
    [40 + k, 60 + k], [80 + k, 60 + k], [80 + k, 40 + k], [320 - k, 40 + k], [320 - k, 60 + k], [360 - k, 60 + k],
    [360 - k, 360 - k], [40 + k, 360 - k],
  ];
  p.push(pl(step(0), true), pl(step(12), true));
  // fan from the bottom centre
  const [cx, cy] = [200, 348];
  p.push(pl(arcPts(cx, cy, 150, 150, -90, 90, 3)), pl(arcPts(cx, cy, 104, 104, -90, 90, 3)), pl(arcPts(cx, cy, 44, 44, -90, 90, 3)));
  const rays: string[] = [];
  for (let a = -90 + 15; a < 90; a += 15) {
    const a0 = polar(cx, cy, 44, a);
    const a1 = polar(cx, cy, 150, a);
    rays.push(line(a0[0], a0[1], a1[0], a1[1]));
  }
  p.push(rays.join(' '));
  // stepped crest within each fan blade: small arcs
  const crests: string[] = [];
  for (let a = -90; a < 90; a += 15) crests.push(pl(arcPts(cx, cy, 128, 128, a + 3, a + 12, 3)));
  d.push(crests.join(' '));
  for (let r = 60; r < 100; r += 14) d.push(pl(arcPts(cx, cy, r, r, -88, 88, 3)));
  // rays above the fan
  const outer: string[] = [];
  for (let a = -75; a <= 75; a += 15) {
    const q0 = polar(cx, cy, 166, a);
    const q1 = polar(cx, cy, a % 30 === 0 ? 236 : 206, a);
    outer.push(line(q0[0], q0[1], q1[0], q1[1]));
  }
  d.push(clip(outer.join(' '), [region(pl(step(12), true))], 'inside'));
  return { p, d };
}

function moroccanTile(): Art {
  const p: string[] = [];
  const d: string[] = [];
  const box: [number, number, number, number] = [40, 40, 360, 360];
  p.push(rrect(28, 28, 344, 344, 18));
  const frameReg = region(pl(rectPts(...box), true));
  // ogee lantern lattice
  const lantern = (cx: number, cy: number, s: number): P[] => {
    // one quarter (top point to right point), mirrored into the other three
    const q: P[] = [];
    const base: P[] = [[0, -1], [0.22, -0.72], [0.62, -0.58], [0.55, -0.2], [0.5, 0]];
    const half = curvePts(base, false, 3);
    for (const [x, y] of half) q.push([cx + x * s, cy + y * s]);
    for (const [x, y] of [...half].reverse().slice(1)) q.push([cx + x * s, cy - y * s]);
    for (const [x, y] of half.slice(1)) q.push([cx - x * s, cy - y * s]);
    for (const [x, y] of [...half].reverse().slice(1, -1)) q.push([cx - x * s, cy + y * s]);
    return q;
  };
  const shapes: string[] = [];
  const inner: string[] = [];
  for (let j = 0; j <= 4; j++)
    for (let i = 0; i <= 4; i++) {
      const cx = 40 + i * 80;
      const cy = 40 + j * 80;
      shapes.push(pl(lantern(cx, cy, 40), true));
      inner.push(pl(lantern(cx, cy, 28), true));
      if (i < 4 && j < 4) inner.push(star(cx + 40, cy + 40, 9, 4, 4));
    }
  p.push(...chunks(shapes, 3).map((s) => clip(s, [frameReg], 'inside')));
  d.push(...chunks(inner, 3).map((s) => clip(s, [frameReg], 'inside')));
  p.push(pl(rectPts(...box), true));
  return { p, d };
}

function paisleyPts(s: number, deg: number, tx: number, ty: number): P[] {
  const base: P[] = [[0, 0.62], [-0.42, 0.46], [-0.58, 0.06], [-0.46, -0.36], [-0.14, -0.66], [0.24, -0.86], [0.44, -0.8], [0.3, -0.62], [0.32, -0.34], [0.5, 0.0], [0.42, 0.4]];
  return xf(curvePts(base, true, 10), s, deg, tx, ty);
}

function paisleyMotif(): Art {
  const p: string[] = [];
  const d: string[] = [];
  const outer = paisleyPts(226, 12, 196, 220);
  p.push(pl(outer, true));
  const toward = (pts: P[], k: number, c: P): P[] => pts.map(([x, y]) => [c[0] + (x - c[0]) * k, c[1] + (y - c[1]) * k] as P);
  const c: P = [190, 242];
  p.push(pl(toward(outer, 0.8, c), true));
  d.push(pl(toward(outer, 0.62, c), true));
  // scalloped trim outside
  const trim: string[] = [];
  for (let i = 0; i < outer.length; i += 5) {
    const a = outer[i];
    const b = outer[(i + 1) % outer.length];
    const dir = (Math.atan2(b[0] - a[0], -(b[1] - a[1])) * 180) / Math.PI;
    trim.push(petal(a[0], a[1], dir - 90, 14, 5));
  }
  p.push(...chunks(trim, 2));
  // flower in the belly
  const fl: string[] = [];
  for (let k = 0; k < 8; k++) fl.push(petal(188, 258, k * 45, 26, 7));
  p.push(`${fl.join(' ')} ${circle(188, 258, 6)}`);
  // teardrop dots along the inner band
  const ring = toward(outer, 0.71, c);
  const dots: string[] = [];
  for (let i = 0; i < ring.length; i += 6) dots.push(circle(ring[i][0], ring[i][1], 3));
  d.push(dots.join(' '));
  return { p, d };
}

function scrollBanner(): Art {
  // a parchment scroll: a wavy band between two rolled ends
  const yc = (x: number) => 200 + 14 * Math.sin(((x - 90) / 220) * Math.PI * 2);
  const top: P[] = [];
  const bot: P[] = [];
  for (let x = 90; x <= 310; x += 5) {
    top.push([x, yc(x) - 50]);
    bot.push([x, yc(x) + 50]);
  }
  const band = pl([...top, ...[...bot].reverse()], true);
  const roll = (cx: number, cy: number): Item => ({
    sil: rrect(cx - 22, cy - 74, 44, 148, 18),
    p: [ellipse(cx, cy - 62, 18, 8), pl(curl(cx, cy - 62, 1.5, 7, 1.6, 0, 1).map(([x, y]) => [x, cy - 62 + (y - (cy - 62)) * 0.45] as P))],
    d: [line(cx - 12, cy - 40, cx - 12, cy + 50), smooth([[cx - 22, cy + 56], [cx, cy + 62], [cx + 22, cy + 56]], false)],
  });
  const items: Item[] = [
    roll(74, yc(90)),
    roll(326, yc(310)),
    { sil: band, d: [smooth([[110, yc(110) - 18], [200, yc(200) - 18], [290, yc(290) - 18]], false), smooth([[110, yc(110) + 18], [200, yc(200) + 18], [290, yc(290) + 18]], false)] },
  ];
  return layered(items);
}

function anchorShape(cx: number, top: number, h: number): { sil: string[]; d: string[] } {
  const s = h / 240;
  const P2 = (x: number, y: number): P => [cx + x * s, top + y * s];
  const sil: string[] = [];
  sil.push(circle(cx, top + 18 * s, 18 * s));
  sil.push(rrect(cx - 62 * s, top + 52 * s, 124 * s, 18 * s, 9 * s));
  sil.push(pl([P2(-10, 30), P2(10, 30), P2(10, 214), P2(-10, 214)], true));
  // arms: a thick arc
  const outerA = arcPts(cx, top + 120 * s, 96 * s, 104 * s, -118, 118, 4).reverse();
  const innerA = arcPts(cx, top + 120 * s, 80 * s, 86 * s, -112, 112, 4);
  const arms = [...outerA.map(([x, y]) => [x, 2 * (top + 120 * s) - y] as P), ...innerA.map(([x, y]) => [x, 2 * (top + 120 * s) - y] as P)];
  sil.push(pl(arms, true));
  // flukes
  for (const sx of [-1, 1]) sil.push(pl([P2(sx * 70, 196), P2(sx * 104, 150), P2(sx * 112, 196), P2(sx * 98, 210)], true));
  return { sil, d: [circle(cx, top + 18 * s, 8 * s)] };
}

function anchorRing(): Art {
  const ring: P[] = arcPts(200, 200, 160, 160, 0, 360, 2).slice(0, -1);
  const r = rope(ring, 11, true);
  const an = anchorShape(200, 76, 236);
  const items: Item[] = [
    { sil: an.sil, d: an.d },
    { sil: '', p: [r.edges], d: chunks(r.twists, 4) },
  ];
  const a = layered(items);
  a.d.push(`${star(110, 120, 12, 5, 5)} ${star(290, 120, 12, 5, 5)}`);
  return a;
}

function scaleTile(): Art {
  const p: string[] = [];
  const d: string[] = [];
  const frame = pl(rectPts(40, 40, 360, 360), true);
  const reg = region(frame);
  const R = 40;
  const rows: string[] = [];
  const inner: string[] = [];
  for (let j = 0, y = 40; y <= 392; y += R, j++) {
    for (let x = 40 + (j % 2 ? R : 0) - 2 * R; x <= 392; x += 2 * R) {
      rows.push(pl(arcPts(x, y, R, R, 90, 270, 10)));
      inner.push(pl(arcPts(x, y, R * 0.55, R * 0.55, 110, 250, 14)));
    }
  }
  p.push(...chunks(rows, 3).map((s) => clip(s, [reg], 'inside')).filter(Boolean));
  d.push(...chunks(inner, 2).map((s) => clip(s, [reg], 'inside')).filter(Boolean));
  p.push(frame, pl(rectPts(28, 28, 372, 372), true));
  return { p, d };
}

// ==== PATTERNS: advanced ========================================================================================

function damaskTile(): Art {
  const p: string[] = [];
  const d: string[] = [];
  p.push(pl(rectPts(24, 24, 376, 376), true));
  // central medallion, built on the right half and mirrored
  const right = (pts: P[]) => [pts, mx(pts)];
  const body: P[] = [[200, 70], [222, 110], [262, 132], [290, 176], [276, 224], [244, 252], [226, 290], [200, 330]];
  const bodyFull = [...body, ...mx(body).reverse().slice(1, -1)];
  p.push(smooth(bodyFull, true));
  const inner = bodyFull.map(([x, y]) => [200 + (x - 200) * 0.72, 200 + (y - 200) * 0.74] as P);
  p.push(smooth(inner, true));
  // finial and drop
  p.push(petal(200, 70, 0, 40, 10), petal(200, 330, 180, 36, 10));
  d.push(line(200, 66, 200, 40), line(200, 334, 200, 362));
  // inner fan flower
  const fan: string[] = [];
  for (let a = -60; a <= 60; a += 20) fan.push(petal(200, 230, a, 62, 11));
  p.push(fan.join(' '));
  d.push(circle(200, 232, 9));
  for (let a = -60; a <= 60; a += 20) {
    const t = polar(200, 230, 48, a);
    d.push(line(200, 230, t[0], t[1]));
  }
  // curls and leaves on each side
  for (const pts of right(curl(268, 150, 3, 22, 1.1, 200, 1))) p.push(smooth(pts, false));
  for (const pts of right(curl(262, 262, 3, 18, 1.0, 330, -1))) p.push(smooth(pts, false));
  for (const s of [1, -1]) {
    const x = (v: number) => 200 + s * v;
    p.push(petal(x(104), 196, s * 70, 44, 11), petal(x(96), 214, s * 120, 36, 9));
    d.push(line(x(104), 196, ...(polar(x(104), 196, 36, s * 70) as [number, number])), line(x(96), 214, ...(polar(x(96), 214, 28, s * 120) as [number, number])));
    d.push(smooth([[x(32), 140], [x(52), 170], [x(46), 200], [x(30), 216]], false));
  }
  // corner quarter motifs
  const cq: string[] = [];
  const cd: string[] = [];
  for (const [cx, cy, a0] of [[24, 24, 90], [376, 24, 180], [376, 376, 270], [24, 376, 0]] as const) {
    for (let k = 0; k < 3; k++) cq.push(petal(cx, cy, a0 + 22 + k * 23, 58, 12));
    cd.push(pl(arcPts(cx, cy, 78, 78, a0, a0 + 90, 4)), pl(arcPts(cx, cy, 90, 90, a0, a0 + 90, 4)));
    const dots: string[] = [];
    for (let k = 1; k < 6; k++) {
      const q = polar(cx, cy, 104, a0 + k * 15);
      dots.push(circle(q[0], q[1], 2.5));
    }
    cd.push(dots.join(' '));
  }
  p.push(cq.join(' '));
  d.push(...cd);
  // small side motifs (mid edges)
  for (const [cx, cy, a] of [[24, 200, 90], [376, 200, 270], [200, 24, 180], [200, 376, 0]] as const) {
    d.push(`${petal(cx, cy, a - 30, 30, 8)} ${petal(cx, cy, a + 30, 30, 8)} ${petal(cx, cy, a, 38, 9)}`);
  }
  const fr = [region(pl(rectPts(24, 24, 376, 376), true))];
  return { p: [p[0], ...p.slice(1).map((x) => clip(x, fr, 'inside'))], d: d.map((x) => clip(x, fr, 'inside')) };
}

function laceDoily(): Art {
  const p: string[] = [];
  const d: string[] = [];
  const [cx, cy] = [200, 200];
  // centre flower
  const fl: string[] = [];
  for (let k = 0; k < 8; k++) fl.push(petal(cx, cy, k * 45, 32, 8));
  p.push(`${fl.join(' ')} ${circle(cx, cy, 6)}`);
  p.push(circle(cx, cy, 44), circle(cx, cy, 52));
  // net between 52 and 92
  const inRing = (x: number, y: number) => {
    const r = Math.hypot(x - cx, y - cy);
    return r > 55 && r < 89;
  };
  d.push(hatch(inRing, [100, 100, 300, 300], 45, 11), hatch(inRing, [100, 100, 300, 300], -45, 11));
  p.push(circle(cx, cy, 92));
  // petal ring
  const pr: string[] = [];
  const pd: string[] = [];
  for (let k = 0; k < 16; k++) {
    const a = k * 22.5;
    const b = polar(cx, cy, 96, a);
    pr.push(petal(b[0], b[1], a, 46, 10));
    const t = polar(cx, cy, 132, a);
    pd.push(line(b[0], b[1], t[0], t[1]));
    const e = polar(cx, cy, 120, a + 11.25);
    pd.push(circle(e[0], e[1], 3.5));
  }
  p.push(...chunks(pr, 2));
  d.push(...chunks(pd, 2));
  p.push(circle(cx, cy, 146));
  // outer scallops with picots and eyelets
  const n = 24;
  const sc: P[] = [];
  const pic: string[] = [];
  const eye: string[] = [];
  for (let i = 0; i < n; i++) {
    const a0 = (360 / n) * i;
    for (let k = 0; k <= 10; k++) {
      const a = a0 + (360 / n) * (k / 10);
      sc.push(polar(cx, cy, 146 + Math.sin((Math.PI * k) / 10) * 22, a));
    }
    const q = polar(cx, cy, 175, a0 + 180 / n);
    pic.push(circle(q[0], q[1], 3));
    const e = polar(cx, cy, 156, a0 + 180 / n);
    eye.push(circle(e[0], e[1], 4));
  }
  p.push(pl(sc, true));
  d.push(pic.join(' '), eye.join(' '));
  d.push(circle(cx, cy, 140));
  return { p, d };
}

function rose(cx: number, cy: number, r: number, rot = 0): { sil: string; p: string[]; d: string[] } {
  const head: P[] = [];
  for (let i = 0; i < 10; i++) {
    const a = rot + i * 36;
    head.push(polar(cx, cy, r * (i % 2 ? 0.92 : 1.0), a));
  }
  const sil = smooth(head, true);
  const p: string[] = [];
  const d: string[] = [];
  // inner swirl and petal cups
  p.push(smooth(curl(cx, cy - r * 0.08, r * 0.06, r * 0.42, 1.6, rot, 1), false));
  p.push(smooth([polar(cx, cy, r * 0.62, rot - 100), polar(cx, cy + r * 0.2, r * 0.58, rot + 180), polar(cx, cy, r * 0.62, rot + 100)], false));
  p.push(smooth([polar(cx, cy, r * 0.95, rot - 70), polar(cx, cy, r * 0.62, rot - 30), polar(cx, cy, r * 0.5, rot + 20)], false));
  p.push(smooth([polar(cx, cy, r * 0.95, rot + 120), polar(cx, cy, r * 0.75, rot + 160), polar(cx, cy, r * 0.7, rot + 220)], false));
  // shading lines at petal bases
  for (const a of [rot + 150, rot + 190, rot + 230, rot - 60, rot - 40]) {
    const q0 = polar(cx, cy, r * 0.66, a);
    const q1 = polar(cx, cy, r * 0.84, a);
    d.push(line(q0[0], q0[1], q1[0], q1[1]));
  }
  return { sil, p, d };
}

function roseLeaf(x: number, y: number, deg: number, len: number, w: number): Item {
  const sil = petal(x, y, deg, len, w, 0.4);
  const tip = polar(x, y, len * 0.9, deg);
  const veins: string[] = [line(x, y, tip[0], tip[1])];
  for (let t = 0.25; t < 0.8; t += 0.18) {
    const m = polar(x, y, len * t, deg);
    for (const s of [-1, 1]) {
      const e = polar(m[0], m[1], w * 0.9, deg + s * 50);
      veins.push(line(m[0], m[1], e[0], e[1]));
    }
  }
  return { sil, d: [veins.join(' ')] };
}

function rosesFrame(): Art {
  const r1 = rose(104, 296, 56, 10);
  const r2 = rose(300, 300, 48, -20);
  const r3 = rose(200, 72, 34, 0);
  const items: Item[] = [
    { sil: r1.sil, p: r1.p, d: r1.d },
    { sil: r2.sil, p: r2.p, d: r2.d },
    { sil: r3.sil, p: r3.p, d: r3.d },
    roseLeaf(150, 326, 110, 64, 16),
    roseLeaf(66, 250, -20, 58, 15),
    roseLeaf(264, 330, -120, 56, 14),
    roseLeaf(330, 256, 20, 54, 14),
    roseLeaf(176, 80, -80, 44, 11),
    roseLeaf(224, 80, 80, 44, 11),
    ...banner(118, 282, (x) => 344 - 6 * Math.sin(((x - 118) / 164) * Math.PI), 36, 30),
    { sil: '', p: [ellipse(200, 200, 132, 150)], d: [ellipse(200, 200, 120, 138)] },
  ];
  const a = layered(items);
  a.d.push(`${sparkle(200, 196, 14)} ${sparkle(158, 160, 6)} ${sparkle(244, 236, 6)}`);
  return a;
}

function decoFrame(): Art {
  const p: string[] = [];
  const d: string[] = [];
  const stepped = (k: number): P[] => {
    const a = 30 + k;
    const b = 370 - k;
    const s = 26;
    return [
      [a + s, a], [b - s, a], [b - s, a + s / 2], [b - s / 2, a + s / 2], [b - s / 2, a + s], [b, a + s],
      [b, b - s], [b - s / 2, b - s], [b - s / 2, b - s / 2], [b - s, b - s / 2], [b - s, b],
      [a + s, b], [a + s, b - s / 2], [a + s / 2, b - s / 2], [a + s / 2, b - s], [a, b - s],
      [a, a + s], [a + s / 2, a + s], [a + s / 2, a + s / 2], [a + s, a + s / 2],
    ];
  };
  p.push(pl(stepped(0), true), pl(stepped(14), true));
  d.push(pl(stepped(22), true));
  // top and bottom fans
  for (const [cy, dir] of [[96, 1], [304, -1]] as const) {
    const a0 = dir > 0 ? 90 : -90;
    const pts = arcPts(200, cy, 64, 64, a0, a0 + 180, 4);
    p.push(pl(pts));
    p.push(pl(arcPts(200, cy, 30, 30, a0, a0 + 180, 6)));
    const rays: string[] = [];
    for (let a = 15; a < 180; a += 15) {
      const q0 = polar(200, cy, 30, a0 + a);
      const q1 = polar(200, cy, 64, a0 + a);
      rays.push(line(q0[0], q0[1], q1[0], q1[1]));
    }
    d.push(rays.join(' '));
    d.push(pl(arcPts(200, cy, 46, 46, a0 + 4, a0 + 176, 6)));
    p.push(line(136, cy, 264, cy));
  }
  // vertical line bands on the sides with diamonds
  for (const x of [72, 328]) {
    d.push(`${line(x - 8, 120, x - 8, 280)} ${line(x, 110, x, 290)} ${line(x + 8, 120, x + 8, 280)}`);
    p.push(pl([[x, 176], [x + 14, 200], [x, 224], [x - 14, 200]], true));
    d.push(pl([[x, 188], [x + 7, 200], [x, 212], [x - 7, 200]], true));
  }
  // chevrons and rays in the centre panel corners
  const cr: string[] = [];
  for (const [x, y, sx, sy] of [[106, 136, 1, 1], [294, 136, -1, 1], [106, 264, 1, -1], [294, 264, -1, -1]] as const) {
    for (let k = 0; k < 3; k++) cr.push(pl([[x, y + sy * (k * 9 + 10)], [x, y], [x + sx * (k * 9 + 10), y]].map(([a, b]) => [a + sx * k * 5, b + sy * k * 5] as P)));
  }
  d.push(cr.join(' '));
  return { p, d };
}

function starRosette(): Art {
  const p: string[] = [];
  const d: string[] = [];
  const [cx, cy] = [200, 200];
  p.push(pl(rectPts(26, 26, 374, 374), true));
  // octagram from two squares, with an inner parallel strap
  const sq = (r: number, rot: number): P[] => [0, 90, 180, 270].map((a) => polar(cx, cy, r, a + rot));
  const s1 = pl(sq(160, 0), true);
  const s2 = pl(sq(160, 45), true);
  const s1i = pl(sq(140, 0), true);
  const s2i = pl(sq(140, 45), true);
  // the upright strap passes over the diagonal one
  const reg1 = region(`${s1} ${s1i}`);
  p.push(s1, s1i);
  p.push(...[s2, s2i].map((s) => clip(s, [reg1])));
  // central rosette: 8-point star + petals
  p.push(star(cx, cy, 70, 40, 8, 22.5));
  const pet: string[] = [];
  for (let k = 0; k < 8; k++) pet.push(petal(cx, cy, k * 45 + 22.5, 36, 9));
  d.push(`${pet.join(' ')} ${circle(cx, cy, 8)}`);
  d.push(pl(Array.from({ length: 8 }, (_, k) => polar(cx, cy, 94, k * 45 + 22.5)), true));
  // kites from the frame corners to the star points
  const kites: string[] = [];
  for (const [x, y] of [[26, 26], [374, 26], [374, 374], [26, 374]] as const) {
    const m: P = [x + (cx - x) * 0.22, y + (cy - y) * 0.22];
    kites.push(pl([[x, y], [m[0] + (x < 200 ? 30 : -30), m[1] - (y < 200 ? 6 : -6)], [m[0] + (x < 200 ? 22 : -22), m[1] + (y < 200 ? 22 : -22)], [m[0] - (x < 200 ? 6 : -6), m[1] + (y < 200 ? 30 : -30)]], true));
  }
  d.push(kites.join(' '));
  // mid-edge triangles
  const tri: string[] = [];
  for (const a of [0, 90, 180, 270]) {
    const l = polar(cx, cy, 174, a - 24);
    const r = polar(cx, cy, 174, a + 24);
    tri.push(pl([polar(cx, cy, 128, a), [l[0], l[1]], [r[0], r[1]]], true));
  }
  d.push(...tri.map((t) => clip(t, [region(pl(rectPts(26, 26, 374, 374), true))], 'inside')));
  // small eight-point stars in the corners
  for (const [x, y] of [[62, 62], [338, 62], [338, 338], [62, 338]] as const) d.push(star(x, y, 14, 7, 8));
  return { p, d };
}

function paisleyTile(): Art {
  const p: string[] = [];
  const d: string[] = [];
  p.push(rrect(24, 24, 352, 352, 10), rrect(36, 36, 328, 328, 6));
  const fl: string[] = [];
  for (let k = 0; k < 8; k++) fl.push(petal(200, 200, k * 45, 30, 9));
  p.push(`${fl.join(' ')} ${circle(200, 200, 7)}`);
  for (let k = 0; k < 4; k++) {
    const a = k * 90 + 45;
    const c = polar(200, 200, 104, a);
    const pts = paisleyPts(104, a + 160, c[0], c[1]);
    p.push(pl(pts, true));
    const toward = (k2: number): P[] => pts.map(([x, y]) => [c[0] + (x - c[0]) * k2, c[1] + (y - c[1]) * k2] as P);
    d.push(pl(toward(0.72), true), pl(toward(0.46), true));
    const dots: string[] = [];
    const rr = toward(0.86);
    for (let i = 0; i < rr.length; i += 8) dots.push(circle(rr[i][0], rr[i][1], 2.2));
    d.push(dots.join(' '));
  }
  // mid-edge buds
  const buds: string[] = [];
  for (const a of [0, 90, 180, 270]) {
    const b = polar(200, 200, 150, a);
    buds.push(`${petal(b[0], b[1], a + 180, 26, 8)} ${petal(b[0], b[1], a + 150, 20, 6)} ${petal(b[0], b[1], a + 210, 20, 6)}`);
  }
  d.push(buds.join(' '));
  return { p, d };
}

function loneStarQuilt(): Art {
  const p: string[] = [];
  const d: string[] = [];
  const [cx, cy] = [200, 200];
  const L = 88;
  const diamonds: string[] = [];
  const grid: string[] = [];
  const stitches: string[] = [];
  for (let k = 0; k < 8; k++) {
    const a0 = k * 45;
    const u = polar(0, 0, 1, a0);
    const v = polar(0, 0, 1, a0 + 45);
    const at = (i: number, j: number): P => [cx + (u[0] * i + v[0] * j) * (L / 3), cy + (u[1] * i + v[1] * j) * (L / 3)];
    diamonds.push(pl([at(0, 0), at(3, 0), at(3, 3), at(0, 3)], true));
    for (let i = 1; i < 3; i++) grid.push(line(...at(i, 0), ...at(i, 3)), line(...at(0, i), ...at(3, i)));
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++) {
        const c0 = at(i + 0.5, j + 0.5);
        stitches.push(circle(c0[0], c0[1], 2));
      }
  }
  p.push(...chunks(diamonds, 2));
  d.push(...chunks(grid, 4));
  d.push(...chunks(stitches, 2));
  // border
  p.push(pl(rectPts(30, 30, 370, 370), true), pl(rectPts(44, 44, 356, 356), true));
  d.push(dashed(rectPts(37, 37, 363, 363), 6, 6, true));
  return { p, d };
}

// ==== LETTERING ================================================================================================

function guide(y: number, x0 = 40, x1 = 360): string {
  return dashed([[x0, y], [x1, y]], 6, 8);
}

function loveBubble(): Art {
  const w = bubbleWord('LOVE', 200, 270, 120);
  const p = [...w.outlines, heart(200, 92, 64)];
  return { p, d: [sparkle(110, 96, 10), sparkle(292, 100, 8)] };
}

function homeBubble(): Art {
  const w = bubbleWord('HOME', 200, 300, 104);
  const p = [...w.outlines];
  // roof and chimney above the word
  p.push(pl([[40, 168], [200, 56], [360, 168]]));
  p.push(pl([[290, 119], [290, 76], [314, 76], [314, 136]]));
  p.push(heart(200, 132, 34));
  return { p, d: [line(40, 326, 360, 326)] };
}

function helloScript(): Art {
  const s = scriptCentered('hello', 196, 236, 66);
  const p = [...s];
  p.push(smooth([[70, 286], [150, 298], [250, 290], [330, 270], [340, 262]], false));
  return { p, d: [guide(236), heart(330, 120, 24)] };
}

function welcomeScript(): Art {
  const s = scriptCentered('welcome', 196, 222, 38);
  const p = [rrect(28, 112, 344, 176, 88), ...s];
  return { p, d: [rrect(40, 124, 320, 152, 76), `${sparkle(80, 200, 8)} ${sparkle(330, 196, 7)}`] };
}

function monogramJ(): Art {
  const w = bubbleWord('J', 200, 276, 150, 0.1, 0.13);
  const p = [circle(200, 200, 148), ...w.outlines];
  const dots: string[] = [];
  for (let a = 0; a < 360; a += 15) {
    const q = polar(200, 200, 162, a);
    dots.push(circle(q[0], q[1], 3));
  }
  return { p, d: [dots.join(' '), circle(200, 200, 136)] };
}

function thankYouScript(): Art {
  const a = scriptCentered('thank', 196, 176, 58);
  const b = scriptCentered('you', 214, 296, 58);
  const p = [...a, ...b];
  // flourish under "you" ending in a curl
  p.push(smooth([[96, 330], [180, 344], [270, 336], [316, 318], [320, 300], [302, 296], [298, 312]], false));
  return { p, d: [`${sparkle(60, 250, 10)} ${sparkle(84, 222, 6)}`, sparkle(340, 92, 9), `${heart(342, 230, 22)}`] };
}

function goodVibes(): Art {
  const w = bubbleWord('GOOD', 200, 196, 104);
  const s = scriptCentered('vibes', 200, 320, 56);
  const p = [...w.outlines, ...s];
  const rays: string[] = [];
  for (let a = -60; a <= 60; a += 20) {
    const q0 = polar(200, 196, 150, a);
    const q1 = polar(200, 196, 172, a);
    rays.push(line(q0[0], q0[1], q1[0], q1[1]));
  }
  return { p, d: [rays.join(' '), `${sparkle(56, 300, 9)} ${sparkle(350, 266, 8)}`] };
}

function congratsScript(): Art {
  const s = scriptCentered('congrats', 196, 230, 44);
  const p = [...s, smooth([[60, 280], [140, 268], [220, 276], [300, 262], [344, 268]], false)];
  const conf: string[] = [];
  const spots: P[] = [[60, 90], [110, 60], [170, 100], [240, 70], [300, 104], [350, 64], [80, 340], [150, 330], [250, 340], [330, 320], [40, 180], [364, 170]];
  for (const [i, [x, y]] of spots.entries()) conf.push(i % 3 === 0 ? sparkle(x, y, 9) : i % 3 === 1 ? circle(x, y, 4) : line(x - 6, y + 6, x + 6, y - 6));
  return { p, d: [...chunks(conf, 3), star(200, 82, 16, 7, 5)] };
}

function monogramM(): Art {
  const w = bubbleWord('M', 200, 262, 124, 0.1, 0.14);
  const n = 20;
  const pts: P[] = [];
  for (let i = 0; i < n; i++)
    for (let k = 0; k <= 8; k++) pts.push(polar(200, 200, 132 + Math.sin((Math.PI * k) / 8) * 12, (360 / n) * (i + k / 8)));
  const p = [pl(pts, true), ...w.outlines];
  // laurel at the bottom
  const leaves: string[] = [];
  for (const s of [-1, 1])
    for (let i = 0; i < 5; i++) {
      const a = 180 + s * (28 + i * 15);
      const b = polar(200, 200, 162, a);
      leaves.push(petal(b[0], b[1], a + s * 50, 28, 7), petal(b[0], b[1], a + s * 130, 24, 6));
    }
  return { p, d: [leaves.join(' '), circle(200, 200, 120), pl(arcPts(200, 200, 162, 162, 110, 250, 4))] };
}

function happyBirthday(): Art {
  const sh = bubbleShadow('HAPPY', 200, 190, 86, 7, 7, 0.08);
  const w = bubbleWord('HAPPY', 200, 190, 86, 0.08);
  const s = scriptCentered('birthday', 200, 300, 40);
  const p = [...w.outlines, ...sh.p, ...s];
  const d = [...sh.d, `${sparkle(56, 70, 12)} ${sparkle(344, 70, 10)} ${sparkle(350, 330, 9)}`];
  // bunting across the top
  const bunt: P[] = [];
  for (let x = 40; x <= 360; x += 8) bunt.push([x, 40 + 14 * Math.sin(((x - 40) / 320) * Math.PI)]);
  d.push(pl(bunt));
  const flags: string[] = [];
  for (let x = 60; x <= 340; x += 40) {
    const y = 40 + 14 * Math.sin(((x - 40) / 320) * Math.PI);
    flags.push(pl([[x - 12, y], [x + 12, y + 1], [x, y + 24]], true));
  }
  d.push(flags.join(' '), guide(312, 70, 330), circle(70, 340, 4), circle(330, 350, 3));
  return { p, d };
}

function dreamBig(): Art {
  const s = scriptCentered('dream', 196, 136, 52);
  const sh = bubbleShadow('BIG', 196, 318, 130, 9, 9, 0.1, 0.16);
  const w = bubbleWord('BIG', 196, 318, 130, 0.1, 0.16);
  const p = [...s, ...w.outlines, ...sh.p];
  const d = [...sh.d];
  d.push(`${star(60, 70, 16, 7, 5)} ${star(340, 60, 12, 5, 5)}`, `${sparkle(350, 160, 10)} ${sparkle(48, 186, 8)}`);
  d.push(smooth([[60, 160], [140, 168], [250, 160], [330, 148]], false));
  d.push(circle(110, 40, 3), circle(286, 100, 3), circle(370, 230, 3));
  return { p, d };
}

function monogramR(): Art {
  const w = bubbleWord('R', 200, 268, 140, 0.1, 0.13);
  const sh = bubbleShadow('R', 200, 268, 140, 6, 6, 0.1, 0.13);
  const p: string[] = [...w.outlines, ...sh.p];
  const d: string[] = [...sh.d];
  // ornate frame: double octagon-ish rounded frame with corner flourishes
  p.push(rrect(52, 52, 296, 296, 40), rrect(66, 66, 268, 268, 30));
  const fl: string[] = [];
  for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]] as const) {
    const T = (pts: P[]): P[] => pts.map(([x, y]) => [sx < 0 ? 400 - x : x, sy < 0 ? 400 - y : y] as P);
    fl.push(smooth(T([[24, 120], [28, 70], [46, 40], [80, 26], [130, 24]]), false));
    fl.push(smooth(T(curl(136, 34, 3, 10, 0.9, 20, -1).reverse()), false));
    fl.push(smooth(T(curl(34, 126, 3, 10, 0.9, 310, 1).reverse()), false));
    fl.push(petal(...T([[90, 40]])[0], sx * sy > 0 ? 110 : -110, 22, 6), petal(...T([[40, 90]])[0], sx * sy > 0 ? 160 : -160, 22, 6));
  }
  p.push(...chunks(fl.filter((_, i) => i % 5 < 3), 2));
  d.push(...chunks(fl.filter((_, i) => i % 5 >= 3), 4));
  // mid-edge diamonds and dotted inner ring
  for (const [x, y] of [[200, 52], [200, 348], [52, 200], [348, 200]] as const) p.push(pl([[x, y - 10], [x + 10, y], [x, y + 10], [x - 10, y]], true));
  d.push(dashed(samplePts(rrect(78, 78, 244, 244, 22)), 4, 7, true));
  d.push(`${sparkle(120, 120, 7)} ${sparkle(290, 300, 7)}`, `${circle(104, 300, 3)} ${circle(300, 104, 3)}`);
  return { p, d };
}

// ---- templates ------------------------------------------------------------------------------------------------

const P_ = 'patterns';
const L_ = 'lettering';

export const patterns2: Template[] = [
  // patterns, beginner
  tpl('pat-arch-frame', 'Arched window frame', P_, 'beginner', ['frame', 'arch', 'classic', 'simple'], archFrame()),
  tpl('pat-scalloped-ring-frame', 'Scalloped ring frame', P_, 'beginner', ['frame', 'scalloped', 'circle', 'simple'], scallopFrame()),
  tpl('pat-notched-frame', 'Notched corner frame', P_, 'beginner', ['frame', 'rectangle', 'classic', 'simple'], notchedFrame()),
  tpl('pat-wave-borders', 'Wave border strips', P_, 'beginner', ['border', 'wave', 'pattern', 'geometric'], waveBorders()),
  tpl('pat-luggage-tag', 'Luggage tag with string', P_, 'beginner', ['tag', 'label', 'travel', 'vintage'], luggageTag()),
  tpl('pat-ticket-label', 'Ticket stub label', P_, 'beginner', ['label', 'ticket', 'vintage', 'simple'], ticketLabel()),
  tpl('pat-pinwheel-quilt', 'Pinwheel quilt block', P_, 'beginner', ['quilt', 'block', 'pattern', 'geometric'], pinwheelQuilt()),
  tpl('pat-sawtooth-star-quilt', 'Sawtooth star quilt block', P_, 'beginner', ['quilt', 'block', 'star', 'pattern'], sawtoothStar()),
  tpl('pat-log-cabin-quilt', 'Log cabin quilt block', P_, 'beginner', ['quilt', 'block', 'pattern', 'geometric'], logCabin()),
  tpl('pat-horseshoe-banner', 'Horseshoe frame with banner', P_, 'beginner', ['horseshoe', 'banner', 'frame', 'lucky'], horseshoeFrame()),
  tpl('pat-stitched-heart-frame', 'Stitched heart frame', P_, 'beginner', ['frame', 'heart', 'love', 'stitch'], stitchedHeart()),
  tpl('pat-bracket-labels', 'Bracket label trio', P_, 'beginner', ['label', 'tag', 'vintage', 'simple'], bracketLabels()),
  // patterns, intermediate
  tpl('pat-greek-key-frame', 'Greek key border frame', P_, 'intermediate', ['border', 'frame', 'greek', 'geometric'], greekKeyFrame()),
  tpl('pat-chain-borders', 'Chain link border strips', P_, 'intermediate', ['border', 'chain', 'pattern', 'nautical'], chainBorders()),
  tpl('pat-beaded-oval-frame', 'Beaded oval frame with bow', P_, 'intermediate', ['frame', 'oval', 'bow', 'ornamental'], beadedOval()),
  tpl('pat-corner-flourishes', 'Swirl corner flourishes', P_, 'intermediate', ['corners', 'flourish', 'frame', 'ornamental'], cornerFlourishes()),
  tpl('pat-vine-frame', 'Leafy vine border frame', P_, 'intermediate', ['border', 'frame', 'vine', 'botanical'], vineFrame(), 4, 2),
  tpl('pat-deco-sunburst', 'Art Deco sunburst panel', P_, 'intermediate', ['deco', 'fan', 'sunburst', 'frame'], decoSunburst()),
  tpl('pat-moroccan-lattice', 'Moroccan lantern lattice tile', P_, 'intermediate', ['tile', 'moroccan', 'lattice', 'pattern'], moroccanTile(), 3.5, 2),
  tpl('pat-paisley-motif', 'Paisley motif with flower', P_, 'intermediate', ['paisley', 'motif', 'ornamental', 'pattern'], paisleyMotif()),
  tpl('pat-scroll-banner', 'Curled scroll banner', P_, 'intermediate', ['banner', 'scroll', 'tattoo', 'vintage'], scrollBanner(), 5, 2.5),
  tpl('pat-anchor-rope-ring', 'Anchor in a rope ring', P_, 'intermediate', ['anchor', 'rope', 'tattoo', 'nautical'], anchorRing(), 5, 2.5),
  tpl('pat-scallop-scale-tile', 'Scallop scale tile', P_, 'intermediate', ['tile', 'scallop', 'pattern', 'geometric'], scaleTile(), 3.5, 2),
  // patterns, advanced
  tpl('pat-damask-tile', 'Damask medallion tile', P_, 'advanced', ['damask', 'tile', 'pattern', 'ornamental'], damaskTile(), 3.5, 2),
  tpl('pat-lace-doily', 'Round lace doily', P_, 'advanced', ['lace', 'doily', 'pattern', 'ornamental'], laceDoily(), 3.5, 1.8),
  tpl('pat-tattoo-roses-frame', 'Tattoo roses oval frame', P_, 'advanced', ['tattoo', 'frame', 'rose', 'banner'], rosesFrame(), 4.5, 2),
  tpl('pat-deco-stepped-frame', 'Art Deco stepped frame', P_, 'advanced', ['deco', 'frame', 'fan', 'geometric'], decoFrame(), 3.5, 2),
  tpl('pat-moroccan-star-tile', 'Moroccan star rosette tile', P_, 'advanced', ['tile', 'moroccan', 'star', 'geometric'], starRosette(), 3.5, 2),
  tpl('pat-paisley-tile', 'Four paisley tile', P_, 'advanced', ['paisley', 'tile', 'pattern', 'ornamental'], paisleyTile(), 3.5, 1.8),
  tpl('pat-lone-star-quilt', 'Lone star quilt block', P_, 'advanced', ['quilt', 'block', 'star', 'pattern'], loneStarQuilt(), 3.5, 1.8),
  // lettering, beginner
  tpl('letter-love-bubble', 'LOVE bubble letters', L_, 'beginner', ['lettering', 'love', 'bubble', 'word'], loveBubble()),
  tpl('letter-home-bubble', 'HOME bubble letters with roof', L_, 'beginner', ['lettering', 'home', 'bubble', 'word'], homeBubble()),
  tpl('letter-hello-script', 'Hello script with swash', L_, 'beginner', ['lettering', 'hello', 'script', 'word'], helloScript(), 5, 2),
  tpl('letter-welcome-script', 'Welcome script sign', L_, 'beginner', ['lettering', 'welcome', 'script', 'word'], welcomeScript(), 4.5, 2),
  tpl('letter-monogram-j', 'Monogram J in a dotted ring', L_, 'beginner', ['lettering', 'monogram', 'initial', 'bubble'], monogramJ()),
  // lettering, intermediate
  tpl('letter-thank-you-script', 'Thank you script with flourish', L_, 'intermediate', ['lettering', 'thanks', 'script', 'word'], thankYouScript(), 5, 2),
  tpl('letter-good-vibes', 'GOOD vibes lettering', L_, 'intermediate', ['lettering', 'vibes', 'bubble', 'script'], goodVibes(), 4.5, 2),
  tpl('letter-congrats-script', 'Congrats script with confetti', L_, 'intermediate', ['lettering', 'congrats', 'script', 'celebration'], congratsScript(), 4.5, 2),
  tpl('letter-monogram-m', 'Monogram M scalloped frame', L_, 'intermediate', ['lettering', 'monogram', 'initial', 'wedding'], monogramM()),
  // lettering, advanced
  tpl('letter-happy-birthday', 'HAPPY birthday shadow lettering', L_, 'advanced', ['lettering', 'birthday', 'bubble', 'script'], happyBirthday(), 4, 1.6),
  tpl('letter-dream-big', 'Dream BIG shadow lettering', L_, 'advanced', ['lettering', 'dream', 'bubble', 'script'], dreamBig(), 4, 1.6),
  tpl('letter-monogram-r', 'Monogram R ornate frame', L_, 'advanced', ['lettering', 'monogram', 'initial', 'ornamental'], monogramR(), 4, 1.8),
];
