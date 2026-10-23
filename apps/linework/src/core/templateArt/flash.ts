// flash template batch (T123, fb-1022b + market-1018 T71, 22 Oct 2026): original tattoo-flash style line art on a
// 400×400 canvas. Bold confident outlines (thick main stroke) with simple thin interior lines, in the spirit of classic
// sailor flash but all of our own design: friendly subjects only (no skulls, no weapons, no birds), no lettering
// copied from anyone, no real artist's sheet. Overlaps use occlude.ts so lines behind a shape are hidden; ropes,
// interlace and chains get real over-under crossings. See docs/TEMPLATES.md.
import type { Template, TemplateLevel } from '../templates.ts';
import { circle, ellipse, f, line, petal, poly, polar, rotate, rrect, star, type P } from './draw.ts';
import { clip, outline, region, union, type Layer, type Region } from './occlude.ts';

const VB = '0 0 400 400';

type Art = { p: string[]; d: string[] };

// ---- helpers --------------------------------------------------------------------------------------------------

const pl = (pts: readonly P[], closed = false): string =>
  pts.map((p, i) => `${i ? 'L' : 'M'} ${f(p[0])} ${f(p[1])}`).join(' ') + (closed ? ' Z' : '');

/** Dense points of a Catmull-Rom curve through pts. */
function curvePts(pts: readonly P[], closed = false, per = 16): P[] {
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

/** Points of a closed path's outline offset by d (positive = to the left of travel). */
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
  const ux = Math.cos((deg * Math.PI) / 180);
  const uy = Math.sin((deg * Math.PI) / 180);
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

function inPoly(pts: readonly P[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const boxOf = (pts: readonly P[]): [number, number, number, number] => [
  Math.min(...pts.map((p) => p[0])),
  Math.min(...pts.map((p) => p[1])),
  Math.max(...pts.map((p) => p[0])),
  Math.max(...pts.map((p) => p[1])),
];

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

const join = (...arts: Art[]): Art => ({ p: arts.flatMap((a) => a.p), d: arts.flatMap((a) => a.d) });

/** A rope (twisted cord) along a centreline: band outline for hiding, edge lines and twist strokes. */
function rope(pts: readonly P[], w: number, closed = false): { sil: string; edges: string; twists: string[] } {
  const L = offset(pts, w, closed);
  const R = offset(pts, -w, closed);
  const sil = pl([...L, ...[...R].reverse()], true);
  const edges = closed ? `${pl(L, true)} ${pl(R, true)}` : sil;
  // twist strokes: slanted curves from the left edge to the right edge a little further on
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

/** Group a list of short strokes into n path strings. */
function chunks(list: readonly string[], n: number): string[] {
  const out: string[] = [];
  const size = Math.ceil(list.length / n);
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size).join(' '));
  return out;
}

/**
 * Ribbon banner: a main band between x0 and x1 following centreline yc(x) with height h, and folded swallow-tail
 * ends tucked behind. Returns layered items (front to back).
 */
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

/** Classic faceted flash star: outline plus lines from the centre to every corner. */
function flashStar(x: number, y: number, r: number, rot = 0): { p: string; d: string } {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const [px, py] = polar(x, y, i % 2 ? r * 0.42 : r, rot + i * 36);
    pts.push(line(x, y, px, py));
  }
  return { p: star(x, y, r, r * 0.42, 5, rot), d: pts.join(' ') };
}

/** Annular sector (band of an arc) between radii r0 < r1 from angle a0 to a1 (deg, 0 = up, clockwise). */
function arcBand(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): string {
  const pts: P[] = [];
  for (let a = a0; a <= a1 + 0.01; a += 3) pts.push(polar(cx, cy, r1, a));
  for (let a = a1; a >= a0 - 0.01; a -= 3) pts.push(polar(cx, cy, r0, a));
  return pl(pts, true);
}

const tpl = (id: string, name: string, level: TemplateLevel, tags: string[], a: Art, sw = 6, dw = 2.5): Template => ({
  id,
  name,
  category: 'patterns',
  level,
  tags: ['tattoo', 'flash', ...tags],
  viewBox: VB,
  strokeWidth: sw,
  detailWidth: dw,
  paths: a.p.filter(Boolean),
  ...(a.d.filter(Boolean).length ? { detail: a.d.filter(Boolean) } : {}),
});

// ---- beginner ---------------------------------------------------------------------------------------------------

function anchor(): Art {
  const cx = 200;
  const ac = 196;
  const fluke = (a: number, s: number): string => {
    const e = polar(cx, ac, 119, a);
    const dir: P = [-s * Math.cos((a * Math.PI) / 180), -s * Math.sin((a * Math.PI) / 180)];
    const nrm: P = [Math.sin((a * Math.PI) / 180), -Math.cos((a * Math.PI) / 180)];
    const b: P = [e[0] - dir[0] * 8, e[1] - dir[1] * 8];
    return pl([[b[0] + nrm[0] * 24, b[1] + nrm[1] * 24], [e[0] + dir[0] * 40, e[1] + dir[1] * 40], [b[0] - nrm[0] * 24, b[1] - nrm[1] * 24], [e[0], e[1]]] as P[], true);
  };
  const body = [
    circle(cx, 62, 26),
    rrect(116, 100, 168, 18, 9),
    circle(116, 109, 12),
    circle(284, 109, 12),
    rrect(189, 84, 22, 222, 6),
    arcBand(cx, ac, 110, 128, 118, 242),
    fluke(118, 1),
    fluke(242, -1),
    pl([[184, 318], [216, 318], [200, 342]], true),
  ];
  // rope from the ring winding round the shank: crossings alternate in front / behind
  const c = curvePts([[204, 52], [236, 74], [248, 112], [224, 142], [176, 160], [158, 188], [184, 212], [228, 224], [242, 250], [216, 274], [168, 280], [138, 262], [134, 236]], false, 14);
  const cross: number[] = [];
  for (let i = 1; i < c.length; i++) if (c[i][1] > 95 && (c[i - 1][0] - cx) * (c[i][0] - cx) <= 0) cross.push(i);
  const cuts = [0, ...cross.slice(0, -1).map((v, k) => Math.round((v + cross[k + 1]) / 2)), c.length - 1];
  const pieces = cuts.slice(0, -1).map((a, k) => ({ pts: c.slice(a, cuts[k + 1] + 1), front: k % 2 === 0 }));
  const w = 8;
  const ropes = pieces.map((pc) => ({ ...pc, r: rope(pc.pts, w) }));
  // piece outlines: draw only the long edges inside the rope, caps only at the rope's two ends
  const edges = (pc: (typeof ropes)[number], k: number) => {
    const Lp = offset(pc.pts, w, false);
    const Rp = offset(pc.pts, -w, false);
    const out = [pl(Lp), pl(Rp)];
    if (k === 0) out.push(line(Lp[0][0], Lp[0][1], Rp[0][0], Rp[0][1]));
    if (k === ropes.length - 1) out.push(line(Lp[Lp.length - 1][0], Lp[Lp.length - 1][1], Rp[Rp.length - 1][0], Rp[Rp.length - 1][1]));
    return out.join(' ');
  };
  const front = ropes.filter((r) => r.front);
  const back = ropes.filter((r) => !r.front);
  const frontRegs = front.map((r) => region(r.r.sil));
  const anchorReg = region(body);
  const p: string[] = [];
  const d: string[] = [];
  ropes.forEach((r, k) => {
    if (!r.front) return;
    const others = front.filter((x) => x !== r).map((x) => region(x.r.sil));
    const e = others.length ? clip(edges(r, k), []) : edges(r, k);
    p.push(e);
    d.push(r.r.twists.join(' '));
  });
  p.push(clip(union(body), frontRegs));
  p.push(clip(circle(cx, 62, 13), frontRegs));
  d.push(clip(`${line(196, 128, 196, 296)} ${line(132, 106, 182, 106)} ${line(218, 106, 268, 106)}`, frontRegs));
  d.push(clip(`M ${f(polar(cx, ac, 119, 140)[0])} ${f(polar(cx, ac, 119, 140)[1])} ${(() => {
    const q: string[] = [];
    for (let a = 143; a <= 217; a += 3) {
      const [x, y] = polar(cx, ac, 119, a);
      q.push(`L ${f(x)} ${f(y)}`);
    }
    return q.join(' ');
  })()}`, frontRegs));
  back.forEach((r) => {
    const k = ropes.indexOf(r);
    p.push(clip(edges(r, k), [anchorReg, ...frontRegs]));
    d.push(clip(r.r.twists.join(' '), [anchorReg, ...frontRegs]));
  });
  return { p: p.filter(Boolean), d: d.filter(Boolean) };
}

function heartBanner(): Art {
  const items: Item[] = [
    ...banner(70, 330, (x) => 222 - 16 * (1 - ((x - 200) / 130) ** 2), 50, 42),
    {
      sil: heart(200, 172, 290),
      d: [`M 104 108 Q 112 84 140 78`, `M 98 128 L 99 136`],
    },
  ];
  const a = layered(items);
  a.d.push(`${sparkle(52, 64, 14)} ${sparkle(350, 70, 11)} ${sparkle(346, 330, 13)}`, `${circle(70, 112, 3)} ${circle(330, 116, 3)} ${circle(60, 316, 3)}`);
  a.d.push(`M 96 214 L 304 214`.replace(/.*/, line(98, 222 - 16 * (1 - (102 / 130) ** 2) + 14, 302, 222 - 16 * (1 - (102 / 130) ** 2) + 14)));
  return a;
}

function horseshoe(): Art {
  const cx = 200;
  const cy = 236;
  const shoe = arcBand(cx, cy, 78, 122, 48, 312);
  const ends = [rotate(rrect(cx + 63 - 4, cy - 98, 48, 20, 5), 48 - 90 + 90, cx, cy), rotate(rrect(cx - 111 + 4, cy - 98, 48, 20, 5), 0, cx, cy)];
  void ends;
  const caps = [48, 312].map((a) => {
    const m = polar(cx, cy, 100, a);
    return rotate(rrect(m[0] - 28, m[1] - 9, 56, 18, 5), a, m[0], m[1]);
  });
  const holes = [72, 100, 128, 232, 260, 288].map((a) => {
    const m = polar(cx, cy, 102, a);
    return rotate(rrect(m[0] - 4, m[1] - 8, 8, 16, 4), a, m[0], m[1]);
  });
  const holeRegs = holes.map((h) => region(h));
  const groove: P[] = [];
  for (let a = 60; a <= 300; a += 3) groove.push(polar(cx, cy, 102, a));
  const s1 = flashStar(200, 92, 46);
  const s2 = flashStar(78, 70, 24, -12);
  const s3 = flashStar(322, 70, 24, 12);
  return {
    p: [union([shoe, ...caps]), ...holes, s1.p, s2.p, s3.p],
    d: [clip(pl(groove), holeRegs), s1.d, s2.d, s3.d, `${circle(60, 150, 3)} ${circle(340, 150, 3)} ${circle(200, 30, 3)}`],
  };
}

function sunFace(): Art {
  const cx = 200;
  const cy = 200;
  const long: string[] = [];
  const short: string[] = [];
  for (let i = 0; i < 12; i++) {
    const a = i * 30;
    const tip = polar(cx, cy, 172, a);
    const b1 = polar(cx, cy, 90, a - 8);
    const b2 = polar(cx, cy, 90, a + 8);
    long.push(pl([b1, tip, b2] as P[], true));
    // wavy flame ray between the straight ones
    const m = a + 15;
    const pts: P[] = [polar(cx, cy, 90, m - 6), polar(cx, cy, 110, m + 3), polar(cx, cy, 128, m - 3), polar(cx, cy, 146, m + 1)];
    const back: P[] = [polar(cx, cy, 128, m + 3), polar(cx, cy, 110, m + 9), polar(cx, cy, 90, m + 6)];
    short.push(smooth([...pts, ...back], true));
  }
  return {
    p: [
      circle(cx, cy, 80),
      long.join(' '),
      short.join(' '),
      'M 152 190 Q 168 204 184 190',
      'M 216 190 Q 232 204 248 190',
      'M 200 200 Q 192 220 204 226',
      'M 168 242 Q 200 266 232 242',
    ],
    d: ['M 150 172 Q 166 162 184 170', 'M 216 170 Q 234 162 250 172', `${circle(152, 222, 9)} ${circle(248, 222, 9)}`, `${circle(cx, cy, 70)}`.replace(/.*/, 'M 136 150 Q 150 132 170 126')],
  };
}

function moonFace(): Art {
  // crescent: the outer circle minus a second circle, with a calm profile along the inner edge
  const C1: P = [214, 200];
  const r1 = 158;
  const C2: P = [292, 176];
  const r2 = 128;
  const inner: P[] = [];
  for (let a = 0; a <= 360; a += 1) {
    const q: P = [C2[0] + r2 * Math.cos((a * Math.PI) / 180), C2[1] + r2 * Math.sin((a * Math.PI) / 180)];
    if (Math.hypot(q[0] - C1[0], q[1] - C1[1]) < r1 - 9) inner.push(q);
  }
  // the inner arc runs bottom → left → top as the angle grows; reverse it to go top to bottom
  const leftArc = [...inner].reverse();
  const n = leftArc.length;
  const bump = (t: number, at: number, w: number, amp: number) => amp * Math.exp(-(((t - at) / w) ** 2));
  const prof = leftArc.map((q, i) => {
    const t = i / (n - 1);
    const k = bump(t, 0.36, 0.05, 7) + bump(t, 0.5, 0.045, 30) + bump(t, 0.6, 0.02, 7) + bump(t, 0.645, 0.02, 9) + bump(t, 0.72, 0.04, 12);
    const dx = C2[0] - q[0];
    const dy = C2[1] - q[1];
    const len = Math.hypot(dx, dy);
    return [q[0] + (dx / len) * k, q[1] + (dy / len) * k] as P;
  });
  const top = prof[0];
  const bot = prof[n - 1];
  const outer: P[] = [];
  const a0 = Math.atan2(top[1] - C1[1], top[0] - C1[0]);
  let a1 = Math.atan2(bot[1] - C1[1], bot[0] - C1[0]);
  if (a1 < a0) a1 += 2 * Math.PI;
  // go the long way round on the left
  const from = a1;
  const to = a0 + 2 * Math.PI;
  for (let a = from; a <= to + 1e-6; a += (to - from) / 120) outer.push([C1[0] + r1 * Math.cos(a), C1[1] + r1 * Math.sin(a)]);
  const shape = pl([...prof, ...outer], true);
  // eye: closed lid set back from the profile
  const e = leftArc[Math.round(n * 0.42)];
  const ex = e[0] - 34;
  const ey = e[1] + 2;
  const s1 = flashStar(298, 214, 24, 10);
  const s2 = flashStar(342, 112, 14, -8);
  return {
    p: [shape, `M ${f(ex - 20)} ${f(ey - 2)} Q ${f(ex)} ${f(ey + 14)} ${f(ex + 20)} ${f(ey - 4)}`, s1.p, s2.p],
    d: [
      `${line(ex - 14, ey + 5, ex - 18, ey + 13)} ${line(ex - 4, ey + 8, ex - 5, ey + 17)} ${line(ex + 8, ey + 7, ex + 11, ey + 15)}`,
      `M ${f(ex - 22)} ${f(ey - 22)} Q ${f(ex)} ${f(ey - 32)} ${f(ex + 18)} ${f(ey - 22)}`,
      circle(ex - 6, ey + 46, 10),
      s1.d,
      s2.d,
      `${sparkle(342, 160, 9)} ${circle(262, 122, 3)} ${circle(330, 262, 3)}`,
      (() => {
        const q: P[] = [];
        for (let a = 200; a <= 250; a += 5) q.push([C1[0] + (r1 - 16) * Math.cos((a * Math.PI) / 180), C1[1] + (r1 - 16) * Math.sin((a * Math.PI) / 180)]);
        return pl(q);
      })(),
    ],
  };
}

/** Isometric die: faces and pips. o = centre of the near top corner, s = edge. */
function die(cx: number, cy: number, s: number, pipsTop: number, pipsLeft: number, pipsRight: number, turn: number): { sil: string; p: string[]; d: string[] } {
  const k = 0.866 * s;
  const T: P = [cx, cy - s];
  const Rr: P = [cx + k, cy - s / 2];
  const C: P = [cx, cy];
  const Ll: P = [cx - k, cy - s / 2];
  const B: P = [cx, cy + s];
  const R2: P = [cx + k, cy + s / 2];
  const L2: P = [cx - k, cy + s / 2];
  const rot = (d: string) => rotate(d, turn, cx, cy);
  const LAYOUT: Record<number, P[]> = {
    1: [[0.5, 0.5]],
    2: [[0.27, 0.27], [0.73, 0.73]],
    3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]],
    4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
    5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]],
    6: [[0.27, 0.22], [0.73, 0.22], [0.27, 0.5], [0.73, 0.5], [0.27, 0.78], [0.73, 0.78]],
  };
  const pips = (o: P, u: P, v: P, n: number) =>
    LAYOUT[n]
      .map(([a, b]) => {
        const r = n === 1 ? 0.15 : 0.085;
        const pts: P[] = [];
        for (let i = 0; i < 24; i++) {
          const t = (i / 24) * 2 * Math.PI;
          const aa = a + r * Math.cos(t);
          const bb = b + r * Math.sin(t);
          pts.push([o[0] + (u[0] - o[0]) * aa + (v[0] - o[0]) * bb, o[1] + (u[1] - o[1]) * aa + (v[1] - o[1]) * bb]);
        }
        return pl(pts, true);
      })
      .join(' ');
  const sil = rot(pl([T, Rr, R2, B, L2, Ll], true));
  return {
    sil,
    p: [rot(`${line(Ll[0], Ll[1], C[0], C[1])} ${line(C[0], C[1], Rr[0], Rr[1])} ${line(C[0], C[1], B[0], B[1])}`), rot(pips(Ll, T, C, pipsTop)), rot(pips(Ll, C, L2, pipsLeft)), rot(pips(C, Rr, B, pipsRight))],
    d: [],
  };
}

function luckyDice(): Art {
  const d1 = die(158, 236, 92, 5, 1, 3, -6);
  const d2 = die(262, 152, 74, 6, 2, 4, 14);
  const a = layered([d1, d2]);
  a.d.push(`${sparkle(80, 96, 16)} ${sparkle(330, 300, 14)} ${sparkle(118, 50, 8)}`);
  a.d.push(`${line(276, 262, 312, 250)} ${line(282, 284, 322, 280)} ${line(70, 330, 110, 344)}`);
  return a;
}

function ribbonBanner(): Art {
  const yc = (x: number) => 196 + 26 * Math.sin(((x - 70) / 260) * 2 * Math.PI);
  const items = banner(74, 326, yc, 64, 46, 0.42);
  const a = layered(items);
  const inner: P[] = [];
  const inner2: P[] = [];
  for (let x = 84; x <= 316; x += 4) {
    inner.push([x, yc(x) - 22]);
    inner2.push([x, yc(x) + 22]);
  }
  a.d.push(pl(inner), pl(inner2));
  const s1 = flashStar(200, 86, 30);
  const s2 = flashStar(200, 312, 22, 36);
  a.p.push(s1.p, s2.p);
  a.d.push(s1.d, s2.d, `${circle(140, 92, 3)} ${circle(260, 92, 3)} ${circle(150, 318, 3)} ${circle(250, 318, 3)}`);
  return a;
}

// ---- intermediate -----------------------------------------------------------------------------------------------

function shipsWheel(): Art {
  const cx = 200;
  const cy = 200;
  const spokes: string[] = [];
  for (let i = 0; i < 8; i++) {
    const a = i * 45 + 22.5;
    const shapes = [
      rotate(rrect(cx - 7, cy - 150, 14, 120, 4), a, cx, cy),
      rotate(rrect(cx - 7, cy - 172, 14, 26, 6), a, cx, cy),
      rotate(ellipse(cx, cy - 152, 12, 6), a, cx, cy),
      circle(...(polar(cx, cy, 176, a) as [number, number]), 12),
    ];
    spokes.push(...shapes);
  }
  const rimShape = `${circle(cx, cy, 124)} ${circle(cx, cy, 102)}`;
  const rim: Item = { sil: rimShape, d: [circle(cx, cy, 113)] };
  const bolts: string[] = [];
  for (let i = 0; i < 8; i++) {
    const [x, y] = polar(cx, cy, 113, i * 45 + 22.5);
    bolts.push(circle(x, y, 4));
  }
  const hub: Item = { sil: circle(cx, cy, 36), p: [circle(cx, cy, 20)], d: [circle(cx, cy, 6), ...[0, 90, 180, 270].map((a) => circle(...(polar(cx, cy, 28, a + 45) as [number, number]), 2.5))] };
  const boltsItem: Item = { sil: '', d: [bolts.join(' ')] };
  const a = layered([hub, boltsItem, rim, { sil: spokes, d: [] }]);
  // turned grooves on each handle
  const grooves: string[] = [];
  for (let i = 0; i < 8; i++) {
    const a2 = i * 45 + 22.5;
    grooves.push(rotate(`${line(cx - 6, cy - 160, cx + 6, cy - 160)}`, a2, cx, cy));
  }
  a.d.push(grooves.join(' '));
  return a;
}

function compassRose(): Art {
  const cx = 200;
  const cy = 200;
  const kite = (a: number, R: number, r: number): { shape: string; half: P[] } => {
    const tip = polar(cx, cy, R, a);
    const l = polar(cx, cy, r, a - 45);
    const rr = polar(cx, cy, r, a + 45);
    return { shape: pl([[cx, cy], l, tip, rr] as P[], true), half: [[cx, cy], tip, rr] };
  };
  const longK = [0, 90, 180, 270].map((a) => kite(a, 172, 34));
  const shortK = [45, 135, 225, 315].map((a) => kite(a, 112, 26));
  const ticks: string[] = [];
  for (let i = 0; i < 32; i++) {
    const a = i * 11.25;
    const [x0, y0] = polar(cx, cy, 136, a);
    const [x1, y1] = polar(cx, cy, i % 4 === 0 ? 122 : 128, a);
    ticks.push(line(x0, y0, x1, y1));
  }
  const hatchHalf = (h: P[]) => hatch((x, y) => inPoly(h, x, y), boxOf(h), 0, 6);
  const items: Item[] = [
    { sil: circle(cx, cy, 10) },
    ...longK.map((k) => ({ sil: k.shape, p: [line(cx, cy, ...(polar(cx, cy, 172, 0) as [number, number]))].map(() => ''), d: [hatchHalf(k.half)] })),
    ...shortK.map((k) => ({ sil: k.shape, d: [hatchHalf(k.half)] })),
    { sil: `${circle(cx, cy, 150)} ${circle(cx, cy, 138)}` },
    { sil: '', d: [ticks.join(' '), circle(cx, cy, 120)] },
  ];
  const a = layered(items);
  // centre lines of the long points (drawn over their kites)
  const regs = [region(circle(cx, cy, 10))];
  a.p.push(clip([0, 90, 180, 270].map((ang) => line(cx, cy, ...(polar(cx, cy, 172, ang) as [number, number]))).join(' '), regs));
  return a;
}

function eyeDiamond(): Art {
  const cx = 200;
  const cy = 200;
  const dia = pl([[cx, 40], [346, cy], [cx, 360], [54, cy]], true);
  const dia2 = pl([[cx, 63], [323, cy], [cx, 337], [77, cy]], true);
  const lids = `M 104 200 Q 200 104 296 200 Q 200 286 104 200 Z`;
  const lidReg = region(lids);
  const iris = clip(circle(cx, 198, 46), [lidReg], 'inside');
  const pupil = circle(cx, 198, 19);
  const lashes: string[] = [];
  for (const t of [0.18, 0.32, 0.5, 0.68, 0.82]) {
    // point on the upper lid (quadratic) and outward normal
    const x = (1 - t) ** 2 * 104 + 2 * (1 - t) * t * 200 + t * t * 296;
    const y = (1 - t) ** 2 * 200 + 2 * (1 - t) * t * 104 + t * t * 200;
    const dx = 2 * (1 - t) * (200 - 104) + 2 * t * (296 - 200);
    const dy = 2 * (1 - t) * (104 - 200) + 2 * t * (200 - 104);
    const len = Math.hypot(dx, dy);
    lashes.push(line(x, y, x + (dy / len) * 18, y - (dx / len) * 18));
  }
  const rays: string[] = [];
  for (const [x, y, a] of [[cx, 40, 0], [346, cy, 90], [cx, 360, 180], [54, cy, 270]] as const) {
    const [x1, y1] = polar(x, y, 8, a);
    const [x2, y2] = polar(x, y, 18, a);
    rays.push(line(x1, y1, x2, y2));
  }
  return {
    p: [dia, lids, iris, pupil, lashes.join(' ')],
    d: [
      dia2,
      circle(212, 186, 6),
      'M 128 226 Q 200 262 272 226',
      rays.join(' '),
      `${circle(124, 84, 4)} ${circle(276, 84, 4)} ${circle(124, 316, 4)} ${circle(276, 316, 4)}`,
      `${sparkle(70, 70, 14)} ${sparkle(330, 330, 14)}`,
    ],
  };
}

/** Spade pip: an upside-down heart with a flared stem. */
function spade(cx: number, cy: number, s: number): string {
  const h = rotate(heart(cx, cy, s), 180, cx, cy);
  const stem = pl([[cx - s * 0.04, cy + s * 0.12], [cx - s * 0.2, cy + s * 0.5], [cx + s * 0.2, cy + s * 0.5], [cx + s * 0.04, cy + s * 0.12]], true);
  return union([h, stem]);
}

const letterA = (x: number, y: number, h: number): string => `M ${f(x - h * 0.35)} ${f(y + h / 2)} L ${f(x)} ${f(y - h / 2)} L ${f(x + h * 0.35)} ${f(y + h / 2)} M ${f(x - h * 0.2)} ${f(y + h * 0.1)} L ${f(x + h * 0.2)} ${f(y + h * 0.1)}`;

function playingCards(): Art {
  const card = (cx: number, cy: number, a: number) => rotate(rrect(cx - 82, cy - 118, 164, 236, 14), a, cx, cy);
  const inner = (cx: number, cy: number, a: number) => rotate(rrect(cx - 70, cy - 106, 140, 212, 8), a, cx, cy);
  const fc: [number, number, number] = [236, 206, 10];
  const bc: [number, number, number] = [150, 192, -14];
  const front: Item = {
    sil: card(...fc),
    p: [rotate(heart(fc[0], fc[1], 90), fc[2], fc[0], fc[1]), rotate(letterA(fc[0] - 58, fc[1] - 90, 22), fc[2], fc[0], fc[1]), rotate(`${heart(fc[0] - 58, fc[1] - 64, 18)} ${rotate(heart(fc[0] + 58, fc[1] + 64, 18), 180, fc[0] + 58, fc[1] + 64)}`, fc[2], fc[0], fc[1]), rotate(rotate(letterA(fc[0] + 58, fc[1] + 90, 22), 180, fc[0] + 58, fc[1] + 90), fc[2], fc[0], fc[1])],
    d: [inner(...fc), rotate('M 216 182 Q 220 170 232 168', fc[2], fc[0], fc[1])],
  };
  const back: Item = {
    sil: card(...bc),
    p: [rotate(spade(bc[0], bc[1] - 4, 80), bc[2], bc[0], bc[1]), rotate(letterA(bc[0] - 58, bc[1] - 90, 22), bc[2], bc[0], bc[1]), rotate(spade(bc[0] - 58, bc[1] - 62, 18), bc[2], bc[0], bc[1])],
    d: [inner(...bc)],
  };
  const a = layered([front, back]);
  a.d.push(`${sparkle(60, 60, 14)} ${sparkle(352, 352, 12)} ${circle(340, 60, 3)} ${circle(56, 350, 3)}`);
  return a;
}

function heartKey(): Art {
  const cx = 200;
  const bow = heart(cx, 104, 160);
  const hole = heart(cx, 100, 70);
  const shaft = rrect(cx - 11, 170, 22, 166, 6);
  const collars = [rrect(cx - 20, 182, 40, 12, 5), rrect(cx - 18, 302, 36, 10, 4)];
  const bit = pl([[cx + 8, 312], [cx + 62, 312], [cx + 62, 330], [cx + 46, 330], [cx + 46, 346], [cx + 30, 346], [cx + 30, 330], [cx + 8, 330]], true);
  const keyShape = [bow, shaft, ...collars, bit, circle(cx, 340, 11)];
  // ribbon bow tied round the neck
  const loops = [petal(cx, 216, 300, 66, 16, 0.65), petal(cx, 216, 60, 66, 16, 0.65)];
  const tails = [
    pl([[cx - 4, 220], [cx - 40, 268], [cx - 30, 276], [cx - 46, 284], [cx - 18, 282], [cx + 6, 226]], true),
    pl([[cx + 4, 220], [cx + 44, 260], [cx + 36, 270], [cx + 52, 276], [cx + 22, 276], [cx - 6, 226]], true),
  ];
  const knot = rrect(cx - 11, 205, 22, 22, 8);
  const a = layered([
    { sil: knot },
    { sil: loops[0], d: ['M 178 210 Q 160 200 150 186'] },
    { sil: loops[1], d: ['M 222 210 Q 240 200 250 186'] },
    { sil: tails[0] },
    { sil: tails[1] },
    { sil: keyShape, p: [hole], d: ['M 140 74 Q 148 58 168 52', `${line(cx - 3, 236, cx - 3, 296)}`] },
  ]);
  a.d.push(`${sparkle(80, 210, 14)} ${sparkle(318, 150, 12)} ${circle(300, 300, 3)} ${circle(96, 300, 3)}`);
  return a;
}

// ---- advanced ---------------------------------------------------------------------------------------------------

function ropeFrame(): Art {
  // rounded-rectangle rope frame with a banner across the top and stars in the corners
  const pts: P[] = [];
  const [x0, y0, x1, y1, r] = [56, 70, 344, 350, 44];
  const corner = (cx: number, cy: number, a0: number) => {
    for (let a = a0; a < a0 + 90; a += 6) pts.push([cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180)]);
  };
  const edge = (ax: number, ay: number, bx: number, by: number) => {
    const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 4);
    for (let i = 0; i < n; i++) pts.push([ax + ((bx - ax) * i) / n, ay + ((by - ay) * i) / n]);
  };
  edge(x0 + r, y0, x1 - r, y0);
  corner(x1 - r, y0 + r, 270);
  edge(x1, y0 + r, x1, y1 - r);
  corner(x1 - r, y1 - r, 0);
  edge(x1 - r, y1, x0 + r, y1);
  corner(x0 + r, y1 - r, 90);
  edge(x0, y1 - r, x0, y0 + r);
  corner(x0 + r, y0 + r, 180);
  const rp = rope(pts, 10, true);
  const ban = banner(104, 296, (x) => 76 - 8 * (1 - ((x - 200) / 96) ** 2), 44, 28, 0.6);
  const stars = [
    flashStar(126, 150, 17, -10),
    flashStar(274, 150, 17, 10),
    flashStar(126, 292, 17, 8),
    flashStar(274, 292, 17, -8),
  ];
  const innerLine = rrect(82, 98, 236, 226, 26);
  const a = layered([...ban, { sil: rp.sil.split(' Z')[0] + ' Z', p: [], d: [] }]);
  const banRegs = ban.map((b) => region(b.sil));
  const p = [...a.p.slice(0, a.p.length - 1), clip(rp.edges, banRegs)];
  const d = [...a.d, ...chunks(rp.twists, 6).map((t) => clip(t, banRegs)), innerLine, ...stars.map((s) => s.d)];
  p.push(...stars.map((s) => s.p));
  // little anchor-free centre motif: a heart with a small sparkle pair
  p.push(heart(200, 214, 96));
  d.push('M 166 192 Q 172 176 186 174', `${sparkle(150, 254, 9)} ${sparkle(252, 254, 9)}`);
  return { p: p.filter(Boolean), d: d.filter(Boolean) };
}

function paisleyStrip(): Art {
  const base: P[] = [[-1, 0.05], [-0.72, 0.72], [0, 1], [0.78, 0.72], [1.22, 0.05], [1.42, -0.62], [1.86, -1.25], [1.3, -1.02], [0.8, -0.9], [0.18, -1.02], [-0.55, -0.82]];
  const motif = (cx: number, cy: number, s: number, flip: boolean): { p: string; d: string[] } => {
    const map = (q: readonly P[], k = 1, ox = 0, oy = 0) => q.map(([x, y]) => [cx + (flip ? -1 : 1) * (x * k + ox) * s, cy + (y * k + oy) * s] as P);
    const outer = smooth(map(base));
    const mid = smooth(map(base, 0.66, 0.12, 0.02));
    const eye = circle(cx + (flip ? -1 : 1) * -0.05 * s, cy + 0.08 * s, 0.3 * s);
    const dots: string[] = [];
    for (let i = 0; i < 9; i++) {
      const a = -100 + i * 32;
      const [x, y] = polar(cx + (flip ? -1 : 1) * -0.02 * s, cy + 0.06 * s, 0.48 * s, flip ? -a : a);
      dots.push(circle(x, y, 2.2));
    }
    const petals: string[] = [];
    for (let i = 0; i < 7; i++) {
      const a = -150 + i * 25;
      const [x, y] = polar(cx + (flip ? -1 : 1) * 0.02 * s, cy + 0.04 * s, 0.84 * s, flip ? -a : a);
      petals.push(circle(x, y, 3.2));
    }
    return { p: outer, d: [mid, eye, dots.join(' '), petals.join(' ')] };
  };
  const p: string[] = [];
  const d: string[] = [];
  for (const [y0, flipRow] of [[60, false], [222, true]] as const) {
    const ym = y0 + 59;
    p.push(line(24, y0, 376, y0), line(24, y0 + 118, 376, y0 + 118));
    d.push(line(24, y0 + 9, 376, y0 + 9), line(24, y0 + 109, 376, y0 + 109));
    const xs = [92, 202, 312];
    xs.forEach((x, i) => {
      const flip = (i % 2 === 1) !== flipRow;
      const m = motif(x + (flip ? 14 : -14), ym + (i % 2 ? -4 : 4) + 6, 28, flip);
      p.push(m.p);
      d.push(...m.d);
    });
    // little leaf sprigs between motifs
    for (const x of [147, 257]) {
      d.push(`${petal(x, ym + 18, 0, 34, 7)} ${petal(x, ym + 6, -50, 22, 5)} ${petal(x, ym + 6, 50, 22, 5)}`);
      d.push(circle(x, ym - 26, 3));
    }
  }
  return { p, d };
}

function knotBorder(): Art {
  const p: string[] = [];
  const d: string[] = [];
  // row 1: one closed cord twisting over and under itself
  const yA = 92;
  const w = 7;
  const A = (x: number) => yA + 30 * Math.cos((2 * Math.PI * (x - 60)) / 80);
  const B = (x: number) => yA - 30 * Math.cos((2 * Math.PI * (x - 60)) / 80);
  type S = { pt: P; key: string };
  const samples: S[] = [];
  const keyAt = (x: number, pass: string) => {
    const k = Math.round((x - 80) / 40);
    const cxk = 80 + 40 * k;
    return k >= 0 && k <= 6 && Math.abs(x - cxk) <= 20 ? `${pass}${k}` : 'loop';
  };
  for (let x = 60; x <= 340; x += 2) samples.push({ pt: [x, A(x)], key: keyAt(x, 'A') });
  for (let a = -90; a <= 90; a += 6) samples.push({ pt: [340 + 30 * Math.cos((a * Math.PI) / 180), yA + 30 * Math.sin((a * Math.PI) / 180)], key: 'loop' });
  for (let x = 340; x >= 60; x -= 2) samples.push({ pt: [x, B(x)], key: keyAt(x, 'B') });
  for (let a = 90; a <= 270; a += 6) samples.push({ pt: [60 + 30 * Math.cos((a * Math.PI) / 180), yA - 30 * Math.sin((a * Math.PI) / 180)], key: 'loop' });
  const pts = samples.map((s) => s.pt);
  const Lp = offset(pts, w, true);
  const Rp = offset(pts, -w, true);
  // pieces by key
  const pieces: { key: string; idx: number[] }[] = [];
  samples.forEach((s, i) => {
    const lastPiece = pieces[pieces.length - 1];
    if (lastPiece && lastPiece.key === s.key) lastPiece.idx.push(i);
    else pieces.push({ key: s.key, idx: [i] });
  });
  const band = (idx: number[]) => pl([...idx.map((i) => Lp[i]), ...[...idx].reverse().map((i) => Rp[i])], true);
  const over = (key: string) => {
    if (key === 'loop') return true;
    const k = Number(key.slice(1));
    return key[0] === 'A' ? k % 2 === 0 : k % 2 === 1;
  };
  const N = samples.length;
  for (const pc of pieces) {
    const idx = [...pc.idx, (pc.idx[pc.idx.length - 1] + 1) % N];
    const edges = `${pl(idx.map((i) => Lp[i]))} ${pl(idx.map((i) => Rp[i]))}`;
    if (over(pc.key)) p.push(edges);
    else {
      const otherKey = `${pc.key[0] === 'A' ? 'B' : 'A'}${pc.key.slice(1)}`;
      const o = pieces.find((q) => q.key === otherKey);
      p.push(o ? clip(edges, [region(band(o.idx))]) : edges);
    }
  }
  d.push(line(24, yA - 48, 376, yA - 48), line(24, yA + 48, 376, yA + 48));
  // row 2: bead and reel
  const yB = 204;
  const beads: string[] = [];
  const reels: string[] = [];
  for (let x = 44; x <= 356; x += 52) {
    beads.push(ellipse(x, yB, 17, 10));
    if (x + 26 <= 356) reels.push(`${ellipse(x + 26 - 4, yB, 3, 9)} ${ellipse(x + 26 + 4, yB, 3, 9)}`);
  }
  p.push(beads.join(' '));
  d.push(reels.join(' '), line(24, yB - 24, 376, yB - 24), line(24, yB + 24, 376, yB + 24));
  // row 3: chain of interlocking rings, alternately over and under
  const yC = 312;
  const rr = 30;
  const rw = 6;
  const xs: number[] = [];
  for (let x = 58; x <= 342; x += 47.3) xs.push(x);
  const ann = (x: number) => region(`${circle(x, yC, rr + rw)} ${circle(x, yC, rr - rw)}`);
  const quarter = (x: number, r: number, a0: number) => {
    const q: P[] = [];
    for (let a = a0; a <= a0 + 90; a += 3) q.push(polar(x, yC, r, a));
    return pl(q);
  };
  xs.forEach((x, i) => {
    for (const r of [rr + rw, rr - rw]) {
      const tr = quarter(x, r, 0);
      const br = quarter(x, r, 90);
      const bl = quarter(x, r, 180);
      const tl = quarter(x, r, 270);
      p.push(i + 1 < xs.length ? clip(tr, [ann(xs[i + 1])]) : tr);
      p.push(br, tl);
      p.push(i > 0 ? clip(bl, [ann(xs[i - 1])]) : bl);
    }
  });
  d.push(line(24, yC - 52, 376, yC - 52), line(24, yC + 52, 376, yC + 52));
  return { p: p.filter(Boolean), d };
}

function laceBorder(): Art {
  const p: string[] = [];
  const d: string[] = [];
  // band 1: header, net and scalloped fans
  const top = 40;
  p.push(line(24, top, 376, top), line(24, top + 22, 376, top + 22));
  const holes: string[] = [];
  for (let x = 36; x <= 366; x += 16) holes.push(circle(x, top + 11, 3.5));
  d.push(holes.join(' '));
  const sc = 44;
  const scY = top + 110;
  const scal: P[] = [];
  const fans: string[] = [];
  const fanRegs: string[] = [];
  for (let x = 24; x < 376; x += sc * 2) {
    const cx = x + sc;
    for (let a = 180; a >= 0; a -= 6) scal.push([cx + sc * Math.cos((a * Math.PI) / 180), scY + sc * 0.8 * Math.sin((a * Math.PI) / 180)]);
    // fan: concentric arcs and ribs inside each scallop
    for (const k of [0.72, 0.46]) {
      const q: P[] = [];
      for (let a = 180; a >= 0; a -= 6) q.push([cx + sc * k * Math.cos((a * Math.PI) / 180), scY + sc * 0.8 * k * Math.sin((a * Math.PI) / 180)]);
      fans.push(pl(q));
    }
    for (let a = 20; a <= 160; a += 20) fans.push(line(cx + sc * 0.46 * Math.cos((a * Math.PI) / 180), scY + sc * 0.37 * Math.sin((a * Math.PI) / 180), cx + sc * 0.72 * Math.cos((a * Math.PI) / 180), scY + sc * 0.58 * Math.sin((a * Math.PI) / 180)));
    fans.push(circle(cx, scY + 6, 5));
    fanRegs.push(circle(cx, scY, sc * 0.98));
  }
  p.push(`M 24 ${top + 22} L ${f(scal[0][0])} ${f(scal[0][1])} ${pl(scal).replace(/^M/, 'L')} L 376 ${top + 22}`);
  d.push(...chunks(fans, 4));
  // diamond net between header and fans
  const netReg = fanRegs.map((s) => region(s));
  const net = hatch((x, y) => y > top + 26 && y < scY, [24, top + 26, 376, scY], 45, 14) + ' ' + hatch((x, y) => y > top + 26 && y < scY, [24, top + 26, 376, scY], -45, 14);
  d.push(clip(net, netReg));
  for (let x = 24 + sc * 2; x < 376; x += sc * 2) p.push(circle(x, scY + 8, 6));
  // band 2: header, eyelet flowers and picot scallops
  const t2 = 220;
  p.push(line(24, t2, 376, t2));
  d.push(line(24, t2 + 10, 376, t2 + 10));
  const sc2 = 352 / 12;
  const y2 = t2 + 70;
  const edge: P[] = [];
  const picots: string[] = [];
  const flowers: string[] = [];
  for (let x = 24; x < 375; x += sc2 * 2) {
    const cx = x + sc2;
    for (let a = 180; a >= 0; a -= 6) edge.push([cx + sc2 * Math.cos((a * Math.PI) / 180), y2 + sc2 * Math.sin((a * Math.PI) / 180)]);
    for (const a of [150, 120, 90, 60, 30]) {
      const [px, py] = [cx + (sc2 + 5) * Math.cos((a * Math.PI) / 180), y2 + (sc2 + 5) * Math.sin((a * Math.PI) / 180)];
      picots.push(circle(px, py, 4));
    }
    const fl: string[] = [];
    for (let i = 0; i < 6; i++) fl.push(petal(cx, y2 - 6, i * 60, 18, 5));
    flowers.push(`${fl.join(' ')} ${circle(cx, y2 - 6, 3)}`);
    flowers.push(`${line(x, t2 + 10, cx - 4, y2 - 24)} ${line(x + 2 * sc2, t2 + 10, cx + 4, y2 - 24)}`);
  }
  p.push(`M 24 ${t2} L ${f(edge[0][0])} ${f(edge[0][1])} ${pl(edge).replace(/^M/, 'L')} L 376 ${t2}`);
  d.push(...chunks(picots, 2), ...chunks(flowers, 3));
  return { p, d };
}

// ---- templates --------------------------------------------------------------------------------------------------

export const flash: Template[] = [
  tpl('flash-anchor-rope', 'Anchor and rope tattoo flash', 'beginner', ['anchor', 'rope', 'nautical', 'vintage'], anchor()),
  tpl('flash-heart-banner', 'Heart and banner tattoo flash', 'beginner', ['heart', 'banner', 'love', 'vintage'], heartBanner()),
  tpl('flash-horseshoe-stars', 'Lucky horseshoe and stars flash', 'beginner', ['horseshoe', 'stars', 'lucky', 'vintage'], horseshoe()),
  tpl('flash-sun-face', 'Sun face with rays flash', 'beginner', ['sun', 'rays', 'celestial', 'stylized'], sunFace()),
  tpl('flash-moon-face', 'Crescent moon face flash', 'beginner', ['moon', 'crescent', 'celestial', 'stars'], moonFace()),
  tpl('flash-lucky-dice', 'Lucky dice tattoo flash', 'beginner', ['dice', 'lucky', 'vintage', 'geometric'], luckyDice()),
  tpl('flash-ribbon-banner', 'Ribbon scroll banner flash', 'beginner', ['banner', 'ribbon', 'scroll', 'vintage'], ribbonBanner()),
  tpl('flash-ships-wheel', "Ship's wheel tattoo flash", 'intermediate', ['wheel', 'nautical', 'sailor', 'vintage'], shipsWheel()),
  tpl('flash-compass-rose', 'Compass rose tattoo flash', 'intermediate', ['compass', 'nautical', 'star', 'geometric'], compassRose()),
  tpl('flash-eye-diamond', 'Eye in a diamond flash', 'intermediate', ['eye', 'diamond', 'geometric', 'stylized'], eyeDiamond()),
  tpl('flash-playing-cards', 'Playing cards tattoo flash', 'intermediate', ['cards', 'heart', 'lucky', 'vintage'], playingCards()),
  tpl('flash-heart-key', 'Heart key tattoo flash', 'intermediate', ['key', 'heart', 'ribbon', 'love'], heartKey()),
  tpl('flash-rope-frame', 'Rope border frame flash', 'advanced', ['rope', 'border', 'frame', 'banner', 'nautical'], ropeFrame()),
  tpl('flash-paisley-strip', 'Paisley border strip flash', 'advanced', ['paisley', 'border', 'pattern', 'ornamental'], paisleyStrip(), 5, 2),
  tpl('flash-knot-border', 'Knot and chain border sheet', 'advanced', ['knot', 'border', 'interlace', 'pattern'], knotBorder(), 5, 2),
  tpl('flash-lace-border', 'Lace border sheet flash', 'advanced', ['lace', 'border', 'pattern', 'ornamental'], laceBorder(), 5, 2),
];
