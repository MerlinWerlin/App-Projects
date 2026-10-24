// lettering2 template batch (fb-1023b T136, 23 Oct 2026): original lettering practice sheets, bubble words, drills and
// monogram frames on a 400×400 canvas. Every letterform is drawn here from our own stroke skeletons (a small monoline
// capital and digit set below): no font outlines are copied. Bubble letters are the merged outline of round-ended
// strokes around the skeleton (occlude.ts union), so each letter traces as one clean closed shape.
import type { Template, TemplateLevel } from '../templates.ts';
import { circle, ellipse, f, line, petal, polar, poly, rrect, star, type P } from './draw.ts';
import { clip, region } from './occlude.ts';

const VB = '0 0 400 400';

// ---- stroke skeleton font ---------------------------------------------------------------------
// Capitals and digits on a 100-unit cap height (y 0 = cap line, y 100 = baseline). A stroke is an open polyline
// ('l', sharp corners), a sampled curve ('c', smooth) or a full ellipse ('e').

type Stroke = { k: 'l' | 'c'; pts: P[] } | { k: 'e'; cx: number; cy: number; rx: number; ry: number };
type Glyph = { w: number; s: Stroke[] };

const L = (...pts: P[]): Stroke => ({ k: 'l', pts });
const E = (cx: number, cy: number, rx: number, ry: number): Stroke => ({ k: 'e', cx, cy, rx, ry });

/** Elliptical arc as points; angles in degrees, 0 = right, 90 = down (screen coordinates). */
function arcPts(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number): P[] {
  const n = Math.max(4, Math.ceil(Math.abs(a1 - a0) / 6));
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)] as P;
  });
}

/** Curve stroke made of straight runs and arcs joined in order. */
const Cv = (...parts: P[][]): Stroke => {
  const pts: P[] = [];
  for (const part of parts) for (const p of part) if (!pts.length || Math.hypot(p[0] - pts[pts.length - 1][0], p[1] - pts[pts.length - 1][1]) > 0.01) pts.push(p);
  return { k: 'c', pts };
};
const A = arcPts;

export const GLYPHS: Readonly<Record<string, Glyph>> = {
  A: { w: 70, s: [L([0, 100], [35, 0], [70, 100]), L([14, 62], [56, 62])] },
  B: { w: 63, s: [L([0, 0], [0, 100]), Cv([[0, 0]], A(33, 23, 25, 23, -90, 90), [[0, 46]]), Cv([[0, 46]], A(36, 73, 27, 27, -90, 90), [[0, 100]])] },
  C: { w: 82, s: [Cv(A(46, 50, 46, 50, -40, -320))] },
  D: { w: 70, s: [L([0, 0], [0, 100]), Cv([[0, 0]], A(22, 50, 48, 50, -90, 90), [[0, 100]])] },
  E: { w: 54, s: [L([54, 0], [0, 0], [0, 100], [54, 100]), L([0, 50], [44, 50])] },
  F: { w: 54, s: [L([54, 0], [0, 0], [0, 100]), L([0, 50], [44, 50])] },
  G: { w: 92, s: [Cv(A(46, 50, 46, 50, -40, -360), [[92, 50], [92, 92]]), L([92, 54], [56, 54])] },
  H: { w: 62, s: [L([0, 0], [0, 100]), L([62, 0], [62, 100]), L([0, 50], [62, 50])] },
  I: { w: 30, s: [L([15, 0], [15, 100]), L([0, 0], [30, 0]), L([0, 100], [30, 100])] },
  J: { w: 54, s: [Cv([[54, 0], [54, 68]], A(27, 68, 27, 32, 0, 180))] },
  K: { w: 60, s: [L([0, 0], [0, 100]), L([60, 0], [0, 62]), L([22, 40], [62, 100])] },
  L: { w: 52, s: [L([0, 0], [0, 100], [52, 100])] },
  M: { w: 80, s: [L([0, 100], [0, 0], [40, 66], [80, 0], [80, 100])] },
  N: { w: 64, s: [L([0, 100], [0, 0], [64, 100], [64, 0])] },
  O: { w: 92, s: [E(46, 50, 46, 50)] },
  P: { w: 60, s: [L([0, 100], [0, 0]), Cv([[0, 0]], A(32, 26, 28, 26, -90, 90), [[0, 52]])] },
  Q: { w: 92, s: [E(46, 50, 46, 50), L([56, 70], [94, 102])] },
  R: { w: 62, s: [L([0, 100], [0, 0]), Cv([[0, 0]], A(32, 26, 28, 26, -90, 90), [[0, 52]]), L([28, 52], [62, 100])] },
  S: { w: 62, s: [Cv(A(31, 25, 28, 25, -35, -270), A(31, 75, 31, 25, -90, 145))] },
  T: { w: 66, s: [L([0, 0], [66, 0]), L([33, 0], [33, 100])] },
  U: { w: 62, s: [Cv([[0, 0], [0, 64]], A(31, 64, 31, 36, 180, 0), [[62, 0]])] },
  V: { w: 70, s: [L([0, 0], [35, 100], [70, 0])] },
  W: { w: 96, s: [L([0, 0], [22, 100], [48, 28], [74, 100], [96, 0])] },
  X: { w: 64, s: [L([0, 0], [64, 100]), L([64, 0], [0, 100])] },
  Y: { w: 66, s: [L([0, 0], [33, 50], [66, 0]), L([33, 50], [33, 100])] },
  Z: { w: 62, s: [L([2, 0], [62, 0], [0, 100], [62, 100])] },
  '0': { w: 60, s: [E(30, 50, 30, 50)] },
  '1': { w: 50, s: [L([6, 20], [28, 0], [28, 100]), L([6, 100], [50, 100])] },
  '2': { w: 60, s: [Cv(A(30, 28, 28, 28, -165, 25), [[0, 100], [60, 100]])] },
  '3': { w: 58, s: [Cv(A(28, 25, 26, 25, -160, 90), A(28, 75, 30, 25, -90, 160))] },
  '4': { w: 64, s: [L([46, 100], [46, 0], [0, 68], [64, 68])] },
  '5': { w: 60, s: [L([54, 0], [12, 0], [9, 47]), Cv(A(30, 70, 30, 30, -135, 155))] },
  '6': { w: 60, s: [E(30, 70, 30, 30), Cv(A(52, 70, 52, 70, -105, -180))] },
  '7': { w: 60, s: [L([0, 0], [60, 0], [18, 100])] },
  '8': { w: 60, s: [E(30, 25, 24, 25), E(30, 74, 30, 26)] },
  '9': { w: 60, s: [E(30, 30, 30, 30), Cv(A(8, 30, 52, 70, 0, 75))] },
};

export const SPACE = 40;

/** Width of a string in skeleton units (gap between letters in units). */
export function textWidth(text: string, gap: number): number {
  let w = 0;
  [...text].forEach((ch, i) => {
    w += ch === ' ' ? SPACE : GLYPHS[ch].w;
    if (i > 0) w += gap;
  });
  return w;
}

type Placed = { s: Stroke[]; scale: number; x: number; y: number };

/** Place a string with its cap line at y, starting at x, cap height h. One entry per letter. */
export function place(text: string, x: number, y: number, h: number, gap = 18): Placed[] {
  const k = h / 100;
  const out: Placed[] = [];
  let cx = x;
  for (const ch of text) {
    if (ch === ' ') {
      cx += (SPACE + gap) * k;
      continue;
    }
    const g = GLYPHS[ch];
    if (!g) throw new Error(`no glyph ${ch}`);
    out.push({ s: g.s, scale: k, x: cx, y });
    cx += (g.w + gap) * k;
  }
  return out;
}

/** Centre a string horizontally on cx. */
export function placeC(text: string, cx: number, y: number, h: number, gap = 18, maxW = 336): Placed[] {
  const k = Math.min(1, maxW / ((textWidth(text, gap) * h) / 100));
  const hh = h * k;
  return place(text, cx - (textWidth(text, gap) * hh) / 200, y + (h - hh) / 2, hh, gap);
}

/** Centre a string for bubble letters of half-width w: the gap between skeletons keeps outlines apart. */
export function placeB(text: string, cx: number, y: number, h: number, w: number, maxW = 336): Placed[] {
  let gap = 18;
  for (let it = 0; it < 6; it++) {
    const k = Math.min(h, (maxW - 2 * w) / (textWidth(text, gap) / 100)) / 100;
    gap = (2 * w + 7) / k;
  }
  return placeC(text, cx, y, h, gap, maxW - 2 * w);
}

const tp = (g: Placed, p: P): P => [g.x + p[0] * g.scale, g.y + p[1] * g.scale];

/** RDP simplification of a polyline. */
function rdp(pts: P[], tol: number): P[] {
  if (pts.length < 3) return pts;
  const keep = new Array<boolean>(pts.length).fill(false);
  keep[0] = keep[pts.length - 1] = true;
  const st: [number, number][] = [[0, pts.length - 1]];
  while (st.length) {
    const [a, b] = st.pop()!;
    const [ax, ay] = pts[a];
    const [bx, by] = pts[b];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    let best = -1;
    let bd = tol;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0]) * (by - ay)) / len;
      if (d > bd) {
        bd = d;
        best = i;
      }
    }
    if (best >= 0) {
      keep[best] = true;
      st.push([a, best], [best, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

const pl = (pts: P[], closed = false): string => {
  let s: P[];
  if (closed || (pts.length > 3 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 0.01)) {
    // closed loop: split at the point farthest from the start so RDP has a real chord
    let far = 1;
    for (let i = 1; i < pts.length; i++) if (Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]) > Math.hypot(pts[far][0] - pts[0][0], pts[far][1] - pts[0][1])) far = i;
    const ring = [...pts, pts[0]];
    s = [...rdp(ring.slice(0, far + 1), 0.3), ...rdp(ring.slice(far), 0.3).slice(1)];
    if (closed) s.pop();
  } else s = rdp(pts, 0.3);
  return s.map((p, i) => `${i ? 'L' : 'M'} ${f(p[0])} ${f(p[1])}`).join(' ') + (closed ? ' Z' : '');
};

/** Monoline (single stroke) drawing of placed letters: one path per letter. */
export function mono(letters: Placed[]): string[] {
  return letters.map((g) =>
    g.s
      .map((st) => (st.k === 'e' ? ellipse(g.x + st.cx * g.scale, g.y + st.cy * g.scale, st.rx * g.scale, st.ry * g.scale) : pl(st.pts.map((p) => tp(g, p)))))
      .join(' '),
  );
}

/** Skeleton of a placed letter as straight segments in canvas coordinates. */
function segments(g: Placed): [P, P][] {
  const out: [P, P][] = [];
  for (const st of g.s) {
    const pts =
      st.k === 'e'
        ? arcPts(g.x + st.cx * g.scale, g.y + st.cy * g.scale, st.rx * g.scale, st.ry * g.scale, 0, 360)
        : st.pts.map((p) => tp(g, p));
    for (let i = 0; i + 1 < pts.length; i++) out.push([pts[i], pts[i + 1]]);
  }
  return out;
}

function segDist(x: number, y: number, [a, b]: [P, P]): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l2));
  return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
}

/**
 * Outline of everything within distance w of the skeleton segments (marching squares on a fine grid), as closed
 * polylines: round ends and joins, counters (holes) included, no overlaps to merge.
 */
function offsetOutline(segs: [P, P][], w: number, step = 0.5): string {
  const xs = segs.flatMap(([a, b]) => [a[0], b[0]]);
  const ys = segs.flatMap(([a, b]) => [a[1], b[1]]);
  const x0 = Math.min(...xs) - w - 2;
  const y0 = Math.min(...ys) - w - 2;
  const nx = Math.ceil((Math.max(...xs) + w + 2 - x0) / step);
  const ny = Math.ceil((Math.max(...ys) + w + 2 - y0) / step);
  const v = new Float64Array((nx + 1) * (ny + 1));
  for (let j = 0; j <= ny; j++)
    for (let i = 0; i <= nx; i++) {
      const x = x0 + i * step;
      const y = y0 + j * step;
      let d = Infinity;
      for (const sg of segs) {
        const e = segDist(x, y, sg);
        if (e < d) d = e;
      }
      v[j * (nx + 1) + i] = d - w;
    }
  const val = (i: number, j: number) => v[j * (nx + 1) + i];
  // edge points: horizontal edge (i,j)-(i+1,j) key 2*(j*(nx+1)+i), vertical (i,j)-(i,j+1) key +1
  const pt = new Map<number, P>();
  const edge = (i: number, j: number, horiz: boolean): number => {
    const key = 2 * (j * (nx + 1) + i) + (horiz ? 0 : 1);
    if (!pt.has(key)) {
      const a = val(i, j);
      const b = horiz ? val(i + 1, j) : val(i, j + 1);
      const t = a / (a - b);
      pt.set(key, horiz ? [x0 + (i + t) * step, y0 + j * step] : [x0 + i * step, y0 + (j + t) * step]);
    }
    return key;
  };
  const adj = new Map<number, number[]>();
  const link = (p: number, q: number) => {
    (adj.get(p) ?? adj.set(p, []).get(p)!).push(q);
    (adj.get(q) ?? adj.set(q, []).get(q)!).push(p);
  };
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const a = val(i, j) < 0;
      const b = val(i + 1, j) < 0;
      const c = val(i + 1, j + 1) < 0;
      const d = val(i, j + 1) < 0;
      const idx = (a ? 1 : 0) | (b ? 2 : 0) | (c ? 4 : 0) | (d ? 8 : 0);
      if (idx === 0 || idx === 15) continue;
      const T = () => edge(i, j, true);
      const R = () => edge(i + 1, j, false);
      const B = () => edge(i, j + 1, true);
      const Lf = () => edge(i, j, false);
      const centre = (val(i, j) + val(i + 1, j) + val(i + 1, j + 1) + val(i, j + 1)) / 4 < 0;
      switch (idx) {
        case 1: case 14: link(Lf(), T()); break;
        case 2: case 13: link(T(), R()); break;
        case 3: case 12: link(Lf(), R()); break;
        case 4: case 11: link(R(), B()); break;
        case 6: case 9: link(T(), B()); break;
        case 7: case 8: link(Lf(), B()); break;
        case 5: if (centre) { link(Lf(), B()); link(T(), R()); } else { link(Lf(), T()); link(R(), B()); } break;
        case 10: if (centre) { link(Lf(), T()); link(R(), B()); } else { link(Lf(), B()); link(T(), R()); } break;
      }
    }
  const seen = new Set<number>();
  const loops: string[] = [];
  for (const start of adj.keys()) {
    if (seen.has(start)) continue;
    const loop: P[] = [];
    let prev = -1;
    let cur = start;
    while (!seen.has(cur)) {
      seen.add(cur);
      loop.push(pt.get(cur)!);
      const nb = adj.get(cur)!;
      const next = nb[0] !== prev ? nb[0] : nb[1];
      prev = cur;
      if (next === undefined) break;
      cur = next;
    }
    if (loop.length > 6) loops.push(pl(loop, true));
  }
  return loops.join(' ');
}

/** Bubble (outlined) drawing of placed letters: one outline per letter. */
export function bubble(letters: Placed[], w: number): string[] {
  return letters.map((g) => offsetOutline(segments(g), w));
}

/** Closed regions of bubble letters (for clipping decoration behind them). */
function letterRegions(letters: Placed[], w: number, pad = 0) {
  return letters.map((g) => region(offsetOutline(segments(g), w + pad, 1)));
}

// ---- small helpers ----------------------------------------------------------------------------

/** Guide lines (cap line, baseline, optional midline dashes) across the page. */
function guides(top: number, h: number, x0 = 24, x1 = 376, mid = false): string {
  let d = `${line(x0, top, x1, top)} ${line(x0, top + h, x1, top + h)}`;
  if (mid) for (let x = x0; x < x1; x += 16) d += ` ${line(x, top + h / 2, Math.min(x1, x + 8), top + h / 2)}`;
  return d;
}

const heart = (cx: number, cy: number, s: number): string =>
  `M ${f(cx)} ${f(cy + s)} C ${f(cx - s * 1.4)} ${f(cy + s * 0.1)} ${f(cx - s * 1.1)} ${f(cy - s * 1.1)} ${f(cx)} ${f(cy - s * 0.4)} ` +
  `C ${f(cx + s * 1.1)} ${f(cy - s * 1.1)} ${f(cx + s * 1.4)} ${f(cy + s * 0.1)} ${f(cx)} ${f(cy + s)} Z`;

const sparkle = (x: number, y: number, r: number): string =>
  `M ${f(x)} ${f(y - r)} Q ${f(x + r * 0.15)} ${f(y - r * 0.15)} ${f(x + r)} ${f(y)} Q ${f(x + r * 0.15)} ${f(y + r * 0.15)} ${f(x)} ${f(y + r)} ` +
  `Q ${f(x - r * 0.15)} ${f(y + r * 0.15)} ${f(x - r)} ${f(y)} Q ${f(x - r * 0.15)} ${f(y - r * 0.15)} ${f(x)} ${f(y - r)} Z`;

/** Six-arm snowflake with side twigs. */
function snowflake(cx: number, cy: number, r: number): string {
  const parts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = i * 60;
    const tip = polar(cx, cy, r, a);
    parts.push(line(cx, cy, tip[0], tip[1]));
    const m = polar(cx, cy, r * 0.55, a);
    const l = polar(m[0], m[1], r * 0.3, a - 45);
    const rr = polar(m[0], m[1], r * 0.3, a + 45);
    parts.push(`M ${f(l[0])} ${f(l[1])} L ${f(m[0])} ${f(m[1])} L ${f(rr[0])} ${f(rr[1])}`);
  }
  return parts.join(' ');
}

/** Balloon with knot and string. */
function balloon(cx: number, cy: number, r: number, sway: number): { p: string; d: string } {
  const body =
    `M ${f(cx)} ${f(cy + r * 1.2)} C ${f(cx - r * 1.35)} ${f(cy + r * 0.6)} ${f(cx - r * 1.1)} ${f(cy - r * 1.15)} ${f(cx)} ${f(cy - r * 1.15)} ` +
    `C ${f(cx + r * 1.1)} ${f(cy - r * 1.15)} ${f(cx + r * 1.35)} ${f(cy + r * 0.6)} ${f(cx)} ${f(cy + r * 1.2)} Z`;
  const knot = poly([[cx, cy + r * 1.2], [cx - 4, cy + r * 1.2 + 6], [cx + 4, cy + r * 1.2 + 6]]);
  const y0 = cy + r * 1.2 + 6;
  const str = `M ${f(cx)} ${f(y0)} C ${f(cx + sway)} ${f(y0 + 14)} ${f(cx - sway)} ${f(y0 + 28)} ${f(cx + sway * 0.4)} ${f(y0 + 42)}`;
  return { p: `${body} ${knot}`, d: `${str} M ${f(cx - r * 0.55)} ${f(cy - r * 0.35)} Q ${f(cx - r * 0.5)} ${f(cy - r * 0.8)} ${f(cx - r * 0.1)} ${f(cy - r * 0.85)}` };
}

/** Holly sprig: two leaves and three berries. */
function holly(cx: number, cy: number, s: number, flip = 1): string[] {
  const leafAt = (deg: number): string => {
    const len = 34 * s;
    const w = 9 * s;
    const pts: P[] = [];
    const a = (deg * Math.PI) / 180;
    const ux = Math.sin(a);
    const uy = -Math.cos(a);
    const px = -uy;
    const py = ux;
    const spikes = 4;
    for (let i = 0; i <= spikes * 2; i++) {
      const t = i / (spikes * 2);
      const wid = Math.sin(Math.PI * t) * (i % 2 === 1 ? w * 1.35 : w * 0.8);
      pts.push([cx + ux * len * t + px * wid, cy + uy * len * t + py * wid]);
    }
    for (let i = spikes * 2 - 1; i > 0; i--) {
      const t = i / (spikes * 2);
      const wid = Math.sin(Math.PI * t) * (i % 2 === 1 ? w * 1.35 : w * 0.8);
      pts.push([cx + ux * len * t - px * wid, cy + uy * len * t - py * wid]);
    }
    return poly(pts);
  };
  return [leafAt(-60 * flip), leafAt(60 * flip), `${circle(cx - 5 * s, cy + 6 * s, 5 * s)} ${circle(cx + 5 * s, cy + 6 * s, 5 * s)} ${circle(cx, cy - 3 * s, 5 * s)}`];
}

/** Laurel branch: stem along a quarter arc with paired leaves. */
function laurel(cx: number, cy: number, r: number, from: number, to: number, n: number, side: 1 | -1): { stem: string; leaves: string[] } {
  const pts = arcPts(cx, cy, r, r, from, to);
  const leaves: string[] = [];
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1);
    const a = from + (to - from) * t;
    const rad = (a * Math.PI) / 180;
    const p: P = [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
    const tangentDeg = a + (to > from ? 90 : -90); // direction of travel, in our 0 = right convention
    const toUp = (d: number) => d + 90; // convert (0 = right) → petal (0 = up)
    leaves.push(petal(p[0], p[1], toUp(tangentDeg) + (i % 2 ? -42 : 42), 24, 6.5, 0.45));
  }
  void side;
  return { stem: pl(pts), leaves };
}

function T(id: string, name: string, level: TemplateLevel, tags: string[], paths: string[], detail: string[] = [], strokeWidth = 3): Template {
  const t: Template = { id: `letter2-${id}`, name, category: 'lettering', level, tags, viewBox: VB, paths, strokeWidth };
  if (detail.length) {
    t.detail = detail;
    t.detailWidth = 1.8;
  }
  return t;
}

// ---- alphabet practice sheets (beginner) --------------------------------------------------------

/** Big bubble letters on one row, plus a guide row with the same letters as single strokes to copy. */
function alphaSheet(id: string, name: string, letters: string): Template {
  const n = letters.length;
  const h = n > 5 ? 92 : 104;
  const big = placeB(letters, 200, 64, h, n > 5 ? 9 : 10);
  const small = placeC(letters, 200, 262, 52, 48);
  return T(
    id,
    name,
    'beginner',
    ['alphabet', 'letters', 'practice', 'kids'],
    [
      ...bubble(big, n > 5 ? 9 : 10),
      guides(52, h + 24, 24, 376),
      ...mono(small),
      guides(262, 52, 24, 376, true),
      guides(340, 36, 24, 376, true),
    ],
  );
}

const alphaFJ = alphaSheet('alphabet-f-j', 'Alphabet F to J', 'FGHIJ');
const alphaKO = alphaSheet('alphabet-k-o', 'Alphabet K to O', 'KLMNO');
const alphaPT = alphaSheet('alphabet-p-t', 'Alphabet P to T', 'PQRST');
const alphaUZ = alphaSheet('alphabet-u-z', 'Alphabet U to Z', 'UVWXYZ');

// ---- numbers -------------------------------------------------------------------------------------

const numbers = T(
  'numbers',
  'Number lettering 0 to 9',
  'beginner',
  ['lettering', 'numbers', 'practice', 'kids'],
  [...bubble(placeB('01234', 200, 60, 100, 10), 10), ...bubble(placeB('56789', 200, 236, 100, 10), 10), guides(46, 128), guides(222, 128)],
);

// ---- bubble words ---------------------------------------------------------------------------------

const loveL = placeB('LOVE', 200, 118, 120, 13);
const love = T(
  'love-bubble',
  'LOVE bubble lettering',
  'beginner',
  ['lettering', 'love', 'valentine', 'cute'],
  [...bubble(loveL, 13), heart(200, 312, 30), `${heart(96, 66, 16)} ${heart(304, 66, 16)}`],
);

const helloL = placeB('HELLO', 200, 128, 110, 11);
const hello = T(
  'hello-bubble',
  'HELLO bubble lettering',
  'beginner',
  ['lettering', 'hello', 'greeting', 'cute'],
  [...bubble(helloL, 11), `${sparkle(60, 80, 16)} ${sparkle(340, 304, 16)}`, `${sparkle(330, 84, 10)} ${sparkle(70, 300, 10)}`],
);

// ---- oval drill (beginner) -------------------------------------------------------------------------

/** Slanted oval centred on (cx, cy), slant in degrees from vertical. */
function slantOval(cx: number, cy: number, rx: number, ry: number, slant: number): string {
  const s = Math.tan((slant * Math.PI) / 180);
  const pts = arcPts(0, 0, rx, ry, 0, 360).map(([x, y]) => [cx + x - y * s, cy + y] as P);
  return pl(pts, true);
}

/** Connected slanted push-pull ovals (compound ovals) along a row. */
function compound(x0: number, cy: number, rx: number, ry: number, n: number, step: number, slant: number): string {
  const s = Math.tan((slant * Math.PI) / 180);
  const pts: P[] = [];
  for (let i = 0; i <= n * 36; i++) {
    const a = (i / 36) * 2 * Math.PI;
    const x = (step * a) / (2 * Math.PI) - rx * Math.sin(a);
    const y = ry * Math.cos(a);
    pts.push([x0 + x - y * s, cy + y]);
  }
  return pl(pts);
}

const ovalTops = [30, 122, 214, 306];
const ovalDrill = T(
  'oval-drill',
  'Slanted oval calligraphy drill',
  'beginner',
  ['calligraphy', 'drill', 'practice', 'ovals'],
  [
    ovalTops.map((t) => guides(t, 64, 24, 376)).join(' '),
    Array.from({ length: 7 }, (_, i) => slantOval(58 + i * 48, ovalTops[0] + 32, 15, 30, 12)).join(' '),
    compound(54, ovalTops[1] + 32, 16, 30, 9, 32, 12),
    Array.from({ length: 5 }, (_, i) => {
      const x = 64 + i * 68;
      return `${slantOval(x, ovalTops[2] + 32, 9, 16, 12)} ${slantOval(x + 16, ovalTops[2] + 32, 22, 30, 12)}`;
    }).join(' '),
    Array.from({ length: 9 }, (_, i) => slantOval(50 + i * 38, ovalTops[3] + 32, 10, 30, 30)).join(' '),
  ],
);

// ---- intermediate -----------------------------------------------------------------------------------

const thankYou = T(
  'thank-you-bubble',
  'THANK YOU bubble lettering',
  'intermediate',
  ['lettering', 'thanks', 'card', 'stylized'],
  [
    ...bubble(placeB('THANK', 200, 70, 88, 9), 9),
    ...bubble(placeB('YOU', 200, 200, 88, 9), 9),
    `${heart(48, 300, 16)} ${heart(352, 300, 16)}`,
    'M 60 330 C 120 310 160 352 200 330 C 240 310 280 352 340 330',
  ],
  [
    `${sparkle(44, 50, 10)} ${sparkle(356, 50, 10)}`,
    `${circle(40, 170, 4)} ${circle(360, 170, 4)} ${circle(200, 360, 4)}`,
    `${sparkle(140, 362, 7)} ${sparkle(260, 362, 7)}`,
  ],
);

// Welcome banner: ribbon band with tails folded behind, word inside.
function bannerArt(word: string, h: number): { p: string[]; d: string[] } {
  const band = 'M 50 150 C 140 128 260 128 350 150 L 350 246 C 260 224 140 224 50 246 Z';
  const tailL = 'M 66 186 L 20 190 L 42 228 L 20 268 L 82 262 L 66 240 Z';
  const tailR = 'M 334 186 L 380 190 L 358 228 L 380 268 L 318 262 L 334 240 Z';
  const foldL = 'M 50 246 L 82 262 L 66 240';
  const foldR = 'M 350 246 L 318 262 L 334 240';
  const bandR = region(band);
  const letters = placeB(word, 200, 198 - h / 2, h, 6, 270);
  return {
    p: [band, clip(tailL, [bandR]), clip(tailR, [bandR]), clip(foldL, [bandR]), clip(foldR, [bandR]), ...bubble(letters, 6)],
    d: [],
  };
}

const welcomeArt = bannerArt('WELCOME', 44);
const welcome = T(
  'welcome-banner',
  'WELCOME banner lettering',
  'intermediate',
  ['lettering', 'banner', 'welcome', 'ribbon'],
  [...welcomeArt.p, guides(310, 34, 50, 350)],
  [
    'M 64 160 C 150 140 250 140 336 160',
    'M 64 236 C 150 216 250 216 336 236',
    `${sparkle(200, 92, 14)} ${sparkle(150, 104, 8)} ${sparkle(250, 104, 8)}`,
  ],
);

const congratsL = placeB('CONGRATS', 200, 150, 60, 7);
const congratsRegs = letterRegions(congratsL, 7, 6);
const confetti = (seed: number, n: number): string[] => {
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const x = 34 + rnd() * 332;
    const y = 36 + rnd() * 330;
    if (y > 130 && y < 232) continue;
    const kind = i % 3;
    const a = rnd() * 180;
    if (kind === 0) {
      const p1 = polar(x, y, 7, a);
      const p2 = polar(x, y, 7, a + 180);
      out.push(line(p1[0], p1[1], p2[0], p2[1]));
    } else if (kind === 1) out.push(circle(x, y, 3.5));
    else out.push(`M ${f(x - 8)} ${f(y)} Q ${f(x - 4)} ${f(y - 7)} ${f(x)} ${f(y)} Q ${f(x + 4)} ${f(y + 7)} ${f(x + 8)} ${f(y)}`);
  }
  return out;
};
const congrats = T(
  'congrats',
  'CONGRATS lettering with stars',
  'intermediate',
  ['lettering', 'congratulations', 'celebration', 'stars'],
  [
    ...bubble(congratsL, 7),
    `${star(80, 80, 30, 13, 5)} ${star(320, 80, 30, 13, 5)}`,
    `${star(200, 300, 40, 17, 5)}`,
    `${star(110, 300, 18, 8, 5)} ${star(290, 300, 18, 8, 5)}`,
  ],
  [clip(confetti(7, 40).join(' '), congratsRegs), 'M 60 250 C 140 236 260 236 340 250', `${sparkle(200, 60, 12)} ${sparkle(150, 96, 7)} ${sparkle(250, 96, 7)}`],
);

const monoRows = ['ABCDEFG', 'HIJKLMN', 'OPQRST', 'UVWXYZ'];
const monoTops = [36, 128, 220, 312];
const monoAlphabet = T(
  'monoline-alphabet',
  'Monoline alphabet A to Z',
  'intermediate',
  ['alphabet', 'letters', 'monoline', 'practice'],
  [...monoRows.flatMap((row, i) => mono(placeC(row, 200, monoTops[i], 52, 44))), monoTops.map((t) => guides(t, 52, 24, 376, true)).join(' ')],
);

// Upstroke / downstroke drill: thin upstrokes as lines, heavy downstrokes as tapered outlined swells.
function swell(a: P, b: P, w: number): string {
  {
    const mx = (a[0] + b[0]) / 2;
    const my = (a[1] + b[1]) / 2;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const nx = -(b[1] - a[1]) / len;
    const ny = (b[0] - a[0]) / len;
    return (
      `M ${f(a[0])} ${f(a[1])} C ${f(a[0] + nx * w)} ${f(a[1] + ny * w)} ${f(mx + nx * w * 1.1)} ${f(my + ny * w * 1.1)} ${f(b[0])} ${f(b[1])} ` +
      `C ${f(mx - nx * w * 1.1)} ${f(my - ny * w * 1.1)} ${f(a[0] - nx * w)} ${f(a[1] - ny * w)} ${f(a[0])} ${f(a[1])} Z`
    );
  }
}
const drillTops = [34, 126, 218, 310];
const slantDx = 14;
const strokeDrill = T(
  'stroke-drill',
  'Upstroke and downstroke calligraphy drill',
  'intermediate',
  ['calligraphy', 'drill', 'practice', 'brush'],
  [
    drillTops.map((t) => guides(t, 60, 24, 376)).join(' '),
    // row 1: heavy downstrokes
    Array.from({ length: 9 }, (_, i) => swell([52 + i * 37 + slantDx, drillTops[0] + 4], [52 + i * 37, drillTops[0] + 56], 6)).join(' '),
    // row 2: hairline upstrokes
    Array.from({ length: 9 }, (_, i) => line(40 + i * 37, drillTops[1] + 56, 40 + i * 37 + 28, drillTops[1] + 4)).join(' '),
    // row 3: underturns (thick down, round turn, thin up)
    Array.from({ length: 6 }, (_, i) => {
      const x = 44 + i * 56;
      const t = drillTops[2];
      return `${swell([x + slantDx, t + 4], [x + 2, t + 46], 5.5)} M ${f(x + 2)} ${f(t + 46)} C ${f(x)} ${f(t + 62)} ${f(x + 26)} ${f(t + 62)} ${f(x + 40)} ${f(t + 6)}`;
    }).join(' '),
    // row 4: overturns (thin up, round turn, thick down)
    Array.from({ length: 6 }, (_, i) => {
      const x = 44 + i * 56;
      const t = drillTops[3];
      return `M ${f(x)} ${f(t + 56)} C ${f(x + 6)} ${f(t + 4)} ${f(x + 28)} ${f(t - 2)} ${f(x + 28)} ${f(t + 14)} ${swell([x + 28, t + 14], [x + 20, t + 56], 5.5)}`;
    }).join(' '),
  ],
  drillTops.map((t) => Array.from({ length: 12 }, (_, i) => line(30 + i * 30, t + 60, 30 + i * 30 + 14, t)).join(' ')),
);

// Monogram frame: diamond in a circle with a bubble initial and dot border.
const monoS = placeB('S', 200, 150, 100, 11);
const monogramFrame = T(
  'monogram-frame',
  'Diamond monogram frame',
  'intermediate',
  ['monogram', 'initial', 'frame', 'wedding'],
  [
    circle(200, 200, 150),
    circle(200, 200, 138),
    poly([[200, 72], [328, 200], [200, 328], [72, 200]]),
    poly([[200, 88], [312, 200], [200, 312], [88, 200]]),
    ...bubble(monoS, 11),
  ],
  [
    Array.from({ length: 36 }, (_, i) => {
      const p = polar(200, 200, 162, i * 10 + 5);
      return circle(p[0], p[1], 2.6);
    }).join(' '),
    [0, 90, 180, 270].map((a) => {
      const p = polar(200, 200, 144, a + 45);
      return circle(p[0], p[1], 6);
    }).join(' '),
    [45, 135, 225, 315].map((a) => {
      const p = polar(200, 200, 104, a);
      return petal(p[0], p[1], a + 180, 26, 7);
    }).join(' '),
  ],
);

// ---- advanced -----------------------------------------------------------------------------------------

const bdTop = placeB('HAPPY', 200, 84, 70, 7);
const bdBot = placeB('BIRTHDAY', 200, 186, 56, 6);
const bdRegs = [...letterRegions(bdTop, 7, 5), ...letterRegions(bdBot, 6, 5)];
const bl1 = balloon(52, 290, 24, 6);
const bl2 = balloon(348, 290, 24, -6);
const bl3 = balloon(110, 300, 18, 5);
const bl4 = balloon(290, 300, 18, -5);
const happyBirthday = T(
  'happy-birthday-bubble',
  'HAPPY BIRTHDAY bubble lettering',
  'advanced',
  ['lettering', 'birthday', 'celebration', 'balloons'],
  [...bubble(bdTop, 7), ...bubble(bdBot, 6), bl1.p, bl2.p, bl3.p, bl4.p, rrect(152, 300, 96, 50, 8), rrect(164, 274, 72, 28, 6), `${rrect(178, 250, 8, 24, 3)} ${rrect(196, 246, 8, 28, 3)} ${rrect(214, 250, 8, 24, 3)}`],
  [
    bl1.d,
    bl2.d,
    bl3.d,
    bl4.d,
    // pennant bunting above the words
    'M 30 40 Q 115 64 200 40 Q 285 64 370 40',
    [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
      // on the two quadratic swags (30,40)-(115,64)-(200,40) and (200,40)-(285,64)-(370,40)
      const t = ((i % 4) + 0.5) / 4;
      const x0 = i < 4 ? 30 : 200;
      const x = x0 + 170 * t;
      const y = 40 + 2 * t * (1 - t) * 24;
      return poly([[x - 10, y - 1], [x + 10, y + 1], [x, y + 20]]);
    }).join(' '),
    clip(confetti(11, 34).join(' '), [...bdRegs, region(rrect(140, 230, 120, 130, 8)), ...[bl1, bl2, bl3, bl4].map((b) => region(b.p.split(' M ')[0]))]),
    `${petal(182, 248, 0, 12, 4)} ${petal(200, 244, 0, 12, 4)} ${petal(218, 248, 0, 12, 4)}`,
    'M 152 322 C 168 334 184 310 200 322 C 216 334 232 310 248 322 M 164 288 C 176 296 188 282 200 288 C 212 296 224 282 236 288',
  ],
);

const xmTop = placeB('MERRY', 200, 92, 68, 7);
const xmBot = placeB('CHRISTMAS', 200, 196, 50, 5.5);
const xmRegs = [...letterRegions(xmTop, 7, 5), ...letterRegions(xmBot, 5.5, 5)];
const merryChristmas = T(
  'merry-christmas-bubble',
  'MERRY CHRISTMAS bubble lettering',
  'advanced',
  ['lettering', 'christmas', 'holiday', 'winter'],
  [...bubble(xmTop, 7), ...bubble(xmBot, 5.5), ...holly(200, 304, 1.7), rrect(60, 30, 280, 30, 15)],
  [
    snowflake(46, 140, 18),
    snowflake(354, 140, 18),
    snowflake(70, 300, 24),
    snowflake(330, 300, 24),
    `${snowflake(130, 350, 10)} ${snowflake(270, 350, 10)}`,
    clip(
      Array.from({ length: 30 }, (_, i) => {
        const x = 30 + ((i * 97) % 340);
        const y = 74 + ((i * 53) % 290);
        return circle(x, y, 2.4);
      }).join(' '),
      [...xmRegs, region(snowflake(70, 300, 28)), region(circle(330, 300, 28)), region(circle(70, 300, 28)), region(circle(200, 300, 62))],
    ),
    Array.from({ length: 13 }, (_, i) => {
      const x = 80 + i * 20;
      return star(x, 45, 6, 2.6, 5);
    }).join(' '),
  ],
);

// Block capital alphabet: every letter as a bubble outline with its single-stroke skeleton inside to follow.
const blockRows = ['ABCDEF', 'GHIJKL', 'MNOPQR', 'STUVWX', 'YZ'];
const blockAll = blockRows.map((row, i) => placeB(row, 200, 24 + i * 74, 52, 6.5));
const blockAlphabet = T(
  'block-alphabet',
  'Block capital alphabet A to Z',
  'advanced',
  ['alphabet', 'letters', 'block', 'practice'],
  [...blockAll.flatMap((row) => bubble(row, 6.5)), `${heart(84, 352, 14)} ${heart(316, 352, 14)}`],
  blockAll.flatMap((row) => mono(row)),
  3,
);

// Crest monogram: shield with two bubble initials, laurel branches and a blank scroll for a date.
const crestShield = 'M 120 80 L 280 80 L 280 200 C 280 262 238 296 200 316 C 162 296 120 262 120 200 Z';
const crestInner = 'M 132 92 L 268 92 L 268 200 C 268 254 232 284 200 302 C 168 284 132 254 132 200 Z';
const crestL = placeB('LM', 200, 136, 74, 7, 150);
const lauL = laurel(200, 196, 150, 100, 230, 9, -1);
const lauR = laurel(200, 196, 150, 80, -50, 9, 1);
const shieldR = region(crestShield);
const scroll = 'M 96 312 C 160 300 240 300 304 312 L 304 346 C 240 334 160 334 96 346 Z';
const scrollR = region(scroll);
const crest = T(
  'crest-monogram',
  'Laurel crest monogram',
  'advanced',
  ['monogram', 'initials', 'crest', 'wedding', 'vintage'],
  [
    crestShield,
    crestInner,
    ...bubble(crestL, 7),
    scroll,
    clip('M 96 318 L 60 322 L 78 340 L 62 360 L 108 352 L 96 346 M 304 318 L 340 322 L 322 340 L 338 360 L 292 352 L 304 346', [scrollR]),
  ],
  [
    clip(lauL.stem, [shieldR, scrollR]),
    clip(lauR.stem, [shieldR, scrollR]),
    clip(lauL.leaves.join(' '), [shieldR, scrollR]),
    clip(lauR.leaves.join(' '), [shieldR, scrollR]),
    `${star(200, 56, 14, 6, 5)} ${star(166, 62, 8, 3.5, 5)} ${star(234, 62, 8, 3.5, 5)}`,
    'M 140 112 L 260 112 M 160 120 L 240 120',
    'M 150 250 C 176 262 224 262 250 250',
    `${circle(160, 270, 3)} ${circle(240, 270, 3)} ${circle(200, 286, 3)}`,
    'M 116 324 C 170 315 230 315 284 324',
  ],
);

export const lettering2: Template[] = [
  alphaFJ,
  alphaKO,
  alphaPT,
  alphaUZ,
  numbers,
  love,
  hello,
  ovalDrill,
  thankYou,
  welcome,
  congrats,
  monoAlphabet,
  strokeDrill,
  monogramFrame,
  happyBirthday,
  merryChristmas,
  blockAlphabet,
  crest,
];
