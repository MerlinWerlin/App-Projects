// Mandalas & geometric batch 2 (23 Oct 2026): original radial line art on a 400×400 canvas, centred on (200, 200).
// Each piece is built from concentric bands (petal rings, scallops, waves, zigzags, star polygons, lattices,
// spirograph curves) with its own symmetry order and structure, so no two read alike. Overlaps that should hide a
// line (back petals behind front petals, a braid passing under itself) are cut with occlude.ts. Beginner pieces are
// a few bold bands; intermediate pieces add rings and inner lines; advanced pieces add fine detail (veins, dots,
// hatching). All geometry is our own; no logos or organisational emblems.
import type { Template, TemplateLevel } from '../templates.ts';
import { circle, f, leaf, line, ngon, petal, polar, poly, ring, star, type P } from './draw.ts';
import { clip, region, stack } from './occlude.ts';

const VB = '0 0 400 400';
const C = 200;

type Art = { p: string[]; d?: string[]; sw?: number; dw?: number };

// ---- helpers --------------------------------------------------------------------------------------------------

const rad = (deg: number): number => (deg * Math.PI) / 180;
const at = (r: number, deg: number): P => polar(C, C, r, deg);
/** Local motif frame pointing straight up from the centre: u = distance from centre, v = sideways offset. */
const U = (u: number, v = 0): P => [C + v, C - u];
const pt = (p: P): string => `${f(p[0])} ${f(p[1])}`;
const circ = (r: number): string => circle(C, C, r);
const join = (...parts: string[]): string => parts.filter(Boolean).join(' ');

/** n copies of fn(angle, i) around the centre. */
function around(n: number, fn: (deg: number, i: number) => string, off = 0): string {
  return Array.from({ length: n }, (_, i) => fn(off + (360 * i) / n, i)).join(' ');
}

/** Smooth curve through points (Catmull-Rom as cubic Béziers). */
function smooth(pts: readonly P[], closed = true): string {
  const n = pts.length;
  const get = (i: number): P => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  let d = `M ${pt(pts[0])}`;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const [p0, p1, p2, p3] = [get(i - 1), get(i), get(i + 1), get(i + 2)];
    const c1: P = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: P = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${pt(c1)} ${pt(c2)} ${pt(p2)}`;
  }
  return closed ? `${d} Z` : d;
}

/** Closed curve r(deg) around the centre. */
function polarLoop(r: (deg: number) => number, samples: number, off = 0): string {
  return smooth(Array.from({ length: samples }, (_, i) => at(r(off + (360 * i) / samples), off + (360 * i) / samples)));
}

/** Wavy ring: radius R with n waves of amplitude amp. */
const wave = (R: number, amp: number, n: number, phase = 0): string =>
  polarLoop((a) => R + amp * Math.sin(rad(n * a + phase)), n * 8);

/** Zigzag ring: n points at r1, valleys at r0. */
function zigzag(r0: number, r1: number, n: number, off = 0): string {
  return star(C, C, r1, r0, n, off);
}

/** Scallop ring of n arcs through points on radius r, bulging out (or in) by depth. */
function scallop(r: number, n: number, depth: number, outward = true, off = 0): string {
  const chord = 2 * r * Math.sin(Math.PI / n);
  const s = Math.min(depth, chord / 2);
  const rho = (chord * chord) / 4 / (2 * s) + s / 2;
  let d = `M ${pt(at(r, off))}`;
  for (let i = 1; i <= n; i++) d += ` A ${f(rho)} ${f(rho)} 0 0 ${outward ? 1 : 0} ${pt(at(r, off + (360 * i) / n))}`;
  return `${d} Z`;
}

/** Round-topped arches between n spokes: a closed ring of bumps from r0 rising to r1. */
function bumps(r0: number, r1: number, n: number, off = 0): string {
  const pts: P[] = [];
  for (let i = 0; i < n; i++) {
    const a = off + (360 * i) / n;
    const s = 360 / n;
    pts.push(at(r0, a), at(r0 + (r1 - r0) * 0.75, a + s * 0.12), at(r1, a + s * 0.5), at(r0 + (r1 - r0) * 0.75, a + s * 0.88));
  }
  return smooth(pts);
}

/** Ring of n pointed arches (ogee-like) from r0 to r1. */
function arches(r0: number, r1: number, n: number, off = 0): string {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a0 = off + (360 * i) / n;
    const a1 = off + (360 * (i + 1)) / n;
    const m = (a0 + a1) / 2;
    const c0 = at(r0 + (r1 - r0) * 0.85, a0 + (m - a0) * 0.15);
    const c1 = at(r0 + (r1 - r0) * 0.85, a1 - (a1 - m) * 0.15);
    d += `${i === 0 ? `M ${pt(at(r0, a0))}` : ''} Q ${pt(c0)} ${pt(at(r1, m))} Q ${pt(c1)} ${pt(at(r0, a1))}`;
  }
  return `${d} Z`;
}

const dotsRing = (r: number, n: number, size: number, off = 0): string =>
  around(n, (a) => {
    const [x, y] = at(r, a);
    return circle(x, y, size);
  }, off);

const rays = (r0: number, r1: number, n: number, off = 0): string =>
  around(n, (a) => {
    const p = at(r0, a);
    const q = at(r1, a);
    return line(p[0], p[1], q[0], q[1]);
  }, off);

/** Star polygon {n/k}: chords from every vertex to the k-th next one, on radius r. */
function starPolygon(n: number, k: number, r: number, off = 0): string {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const p = at(r, off + (360 * i) / n);
    const q = at(r, off + (360 * (i + k)) / n);
    out.push(line(p[0], p[1], q[0], q[1]));
  }
  return out.join(' ');
}

/** Petals ring: n petals from radius r0, length len, half-width w. */
const petals = (n: number, r0: number, len: number, w: number, round = 0.5, off = 0): string =>
  ring(petal(C, C - r0, 0, len, w, round), n, C, C, off);

/** Petal midlines (veins) for a petals ring. */
const midribs = (n: number, r0: number, len: number, off = 0, from = 0.15, to = 0.75): string =>
  rays(r0 + len * from, r0 + len * to, n, off);

/** Teardrop pointing outward: round end (radius w) at r0, tip at r1. */
function teardrop(r0: number, r1: number, w: number): string {
  const b = r0 + w;
  return (
    `M ${pt(U(r1))} C ${pt(U(b + (r1 - b) * 0.55, w * 0.45))} ${pt(U(b + w * 0.6, w))} ${pt(U(b, w))} ` +
    `A ${f(w)} ${f(w)} 0 0 1 ${pt(U(b, -w))} C ${pt(U(b + w * 0.6, -w))} ${pt(U(b + (r1 - b) * 0.55, -w * 0.45))} ${pt(U(r1))} Z`
  );
}

/** Heart with its point at r0 (toward the centre) and lobes reaching r1, half-width w. */
function heart(r0: number, r1: number, w: number): string {
  const rho = w / 2;
  const lu = r1 - rho;
  return (
    `M ${pt(U(r0))} Q ${pt(U(r0 + (lu - r0) * 0.55, w * 1.05))} ${pt(U(lu, w))} ` +
    `A ${f(rho)} ${f(rho)} 0 0 0 ${pt(U(lu, 0))} A ${f(rho)} ${f(rho)} 0 0 0 ${pt(U(lu, -w))} ` +
    `Q ${pt(U(r0 + (lu - r0) * 0.55, -w * 1.05))} ${pt(U(r0))} Z`
  );
}

/** Kite point (compass point): tip at r1, shoulders at radius rs ±half degrees, inner at r0. */
function kite(r0: number, rs: number, r1: number, half: number, deg: number): string {
  return poly([at(r0, deg), at(rs, deg - half), at(r1, deg), at(rs, deg + half)]);
}

/** Hypotrochoid / epitrochoid curve scaled to outer radius R. k = ratio of rolling circle, d = pen offset. */
export function spiro(R: number, big: number, small: number, pen: number, epi: boolean, perLoop = 16, rot = 0): string {
  const g = gcd(big, small);
  const turns = small / g;
  const loops = big / g;
  const n = loops * perLoop;
  const raw: P[] = [];
  for (let i = 0; i < n; i++) {
    const t = (2 * Math.PI * turns * i) / n;
    const x = epi
      ? (big + small) * Math.cos(t) - pen * Math.cos(((big + small) / small) * t)
      : (big - small) * Math.cos(t) + pen * Math.cos(((big - small) / small) * t);
    const y = epi
      ? (big + small) * Math.sin(t) - pen * Math.sin(((big + small) / small) * t)
      : (big - small) * Math.sin(t) - pen * Math.sin(((big - small) / small) * t);
    raw.push([x, y]);
  }
  const m = Math.max(...raw.map(([x, y]) => Math.hypot(x, y)));
  const c = Math.cos(rad(rot - 90));
  const s = Math.sin(rad(rot - 90));
  return smooth(raw.map(([x, y]) => [C + ((x * c - y * s) * R) / m, C + ((x * s + y * c) * R) / m] as P));
}

function gcd(a: number, b: number): number {
  return b ? gcd(b, a % b) : a;
}

/** Hexagonal lattice centres within distance maxR of the centre (spacing s), optionally rotated. */
function hexCentres(s: number, maxR: number, rot = 0): P[] {
  const out: P[] = [];
  const N = Math.ceil(maxR / s) + 1;
  for (let i = -N; i <= N; i++)
    for (let j = -N; j <= N; j++) {
      const x = s * (i + j / 2);
      const y = s * ((j * Math.sqrt(3)) / 2);
      if (Math.hypot(x, y) <= maxR + 0.01) {
        const c = Math.cos(rad(rot));
        const sn = Math.sin(rad(rot));
        out.push([C + x * c - y * sn, C + x * sn + y * c]);
      }
    }
  return out;
}

/** Keep the part of lines inside a closed shape. */
const inside = (lines: string, shape: string): string => clip(lines, [region(shape)], 'inside');
/** Keep the part of lines outside closed shapes. */
const outside = (lines: string, ...shapes: string[]): string => clip(lines, shapes.map((s) => region(s)));

/** Split a list of strokes into a few path strings. */
function chunk(strokes: readonly string[], groups: number): string[] {
  const out: string[] = [];
  const size = Math.ceil(strokes.length / groups) || 1;
  for (let i = 0; i < strokes.length; i += size) out.push(strokes.slice(i, i + size).join(' '));
  return out;
}

/** Polyline through points (absolute L commands). */
const pl = (pts: readonly P[]): string => pts.map((p, i) => `${i ? 'L' : 'M'} ${pt(p)}`).join(' ');

// ---- beginner -------------------------------------------------------------------------------------------------

function sunRays(): Art {
  const tips: P[] = [];
  for (let i = 0; i < 24; i++) tips.push(at(i % 2 ? 118 : 166, i * 15), at(58, i * 15 + 7.5));
  return { p: [circ(24), circ(46), poly(tips)] };
}

function sixPetal(): Art {
  return {
    p: [
      join(circ(14), circ(30)),
      petals(6, 30, 104, 30, 0.62),
      petals(6, 92, 62, 12, 0.5, 30),
      dotsRing(150, 6, 8),
      circ(170),
    ],
  };
}

function seedOfLife(): Art {
  return { p: [circ(60), around(6, (a) => circle(...at(60, a), 60)), circ(120), circ(134)] };
}

function heptagram(): Art {
  return {
    p: [circ(168), starPolygon(7, 3, 156), circ(32), circ(18), dotsRing(118, 7, 6, 360 / 14)],
  };
}

function oceanWaves(): Art {
  return {
    p: [circ(24), wave(56, 7, 6), wave(94, 9, 9, 90), wave(132, 10, 12), scallop(162, 24, 10)],
  };
}

function simpleCompass(): Art {
  const main = star(C, C, 168, 30, 4);
  const diag = star(C, C, 112, 24, 4, 45);
  const [m, d, r] = stack([main, diag, circ(122)]);
  const split = join(rays(0, 168, 4), rays(0, 112, 4, 45));
  return { p: [m, d, r, outside(inside(split, main) + ' ' + outside(inside(split, diag), main), circ(12)), circ(12)] };
}

function scallopRosette(): Art {
  return {
    p: [join(circ(18), scallop(18, 6, 8)), scallop(56, 8, 16, true, 22.5), scallop(98, 12, 18), scallop(140, 16, 18, true, 11.25), circ(170)],
  };
}

function heartPetals(): Art {
  return { p: [join(circ(16), circ(36)), ring(heart(44, 146, 30), 8, C, C), dotsRing(164, 8, 7, 22.5), dotsRing(112, 8, 6, 22.5)] };
}

function triangleRing(): Art {
  return { p: [circ(80), star(C, C, 152, 80, 9), star(C, C, 72, 40, 9, 20), circ(28), dotsRing(166, 9, 6)] };
}

function leafRing(): Art {
  return { p: [circ(40), ring(leaf(C, C - 46, 0, 104, 18), 10, C, C), dotsRing(118, 10, 6, 18), circ(164)] };
}

function twistedSquares(): Art {
  return { p: [circ(160), [0, 22.5, 45, 67.5].map((r) => ngon(C, C, 160, 4, r)).join(' '), circ(36)] };
}

function teardropFive(): Art {
  return {
    p: [
      circ(26),
      ring(teardrop(36, 158, 28), 5, C, C),
      ring(teardrop(96, 160, 12), 5, C, C, 36),
      dotsRing(70, 5, 6, 36),
    ],
  };
}

function roseCurve(): Art {
  const rose = (R: number, k: number, off: number, n: number) =>
    smooth(Array.from({ length: n }, (_, i) => at(R * Math.cos(rad(k * ((360 * i) / n))), off + (360 * i) / n)));
  const hub = circ(30);
  return { p: [outside(rose(150, 4, 0, 112), hub), outside(rose(104, 4, 22.5, 96), hub), hub, circ(16), circ(166)] };
}

function spiralArms(): Art {
  const arm = (a: number) => {
    const A: P[] = [];
    const B: P[] = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      const r = 32 + 132 * t;
      A.push(at(r, a + 92 * t));
      B.push(at(r, a + 92 * t + 44 * (1 - t) ** 1.1));
    }
    return smooth([...A, ...B.reverse().slice(1, -1)]);
  };
  return { p: [circ(18), circ(32), around(7, arm), circ(174)] };
}

function nestedOctagons(): Art {
  return {
    p: [ngon(C, C, 166, 8, 22.5), ngon(C, C, 132, 8), ngon(C, C, 98, 8, 22.5), ngon(C, C, 64, 8), circ(30), rays(30, 64, 8), rays(64, 98 * Math.cos(rad(22.5)), 8), rays(98, 132 * Math.cos(rad(22.5)), 8, 22.5), rays(132, 166 * Math.cos(rad(22.5)), 8)],
  };
}

function openLotus(): Art {
  const front = petals(8, 34, 120, 30, 0.3);
  const back = petals(8, 34, 140, 28, 0.3, 22.5);
  const [c, fr, bk] = stack([circ(34), front, back]);
  return { p: [c, fr, bk, circ(18), midribs(8, 34, 120, 0, 0.2, 0.7)] };
}

// ---- intermediate ---------------------------------------------------------------------------------------------

function layeredFloral(): Art {
  return {
    sw: 3,
    p: [
      join(circ(10), circ(20)),
      petals(8, 20, 42, 12, 0.6),
      circ(66),
      petals(16, 66, 50, 8, 0.4, 11.25),
      circ(120),
      dotsRing(132, 16, 4),
      scallop(150, 24, 12),
      scallop(150, 24, 6, false),
    ],
    d: [midribs(8, 20, 42), midribs(16, 66, 50, 11.25)],
  };
}

function starburst(): Art {
  return {
    sw: 3,
    p: [
      join(circ(12), star(C, C, 58, 30, 12)),
      circ(66),
      zigzag(66, 92, 24),
      circ(96),
      join(rays(104, 140, 12), rays(104, 124, 12, 15)),
      dotsRing(134, 12, 4, 15),
      star(C, C, 172, 150, 24, 7.5),
      circ(146),
    ],
  };
}

function hexFlowerOfLife(): Art {
  const s = 46;
  const circles = hexCentres(s, 2 * s).map((c) => circle(c[0], c[1], s)).join(' ');
  return {
    sw: 3,
    p: [inside(circles, circ(3 * s)), circ(3 * s), ngon(C, C, 3 * s * 1.155 + 6, 6), ngon(C, C, 3 * s * 1.155 + 22, 6)],
    d: [around(6, (a) => circle(...at(3 * s * 1.155 + 14 - 3, a), 4))],
  };
}

function thirteenNet(): Art {
  const r = 24;
  const cs: P[] = [[C, C], ...[0, 1, 2, 3, 4, 5].map((i) => at(2 * r, 60 * i)), ...[0, 1, 2, 3, 4, 5].map((i) => at(4 * r, 60 * i))];
  const lines: string[] = [];
  for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) lines.push(line(cs[i][0], cs[i][1], cs[j][0], cs[j][1]));
  return {
    sw: 3,
    p: [cs.map((c) => circle(c[0], c[1], r)).join(' '), circ(5 * r), circ(5 * r + 40), around(12, (a) => circle(...at(5 * r + 20, a), 8), 15)],
    d: chunk(lines, 3),
  };
}

function compassSixteen(): Art {
  const main = star(C, C, 170, 26, 4);
  const diag = star(C, C, 122, 22, 4, 45);
  const minor = around(8, (a) => kite(26, 46, 88, 7, a), 22.5);
  const [m, d, mi, r1, r2] = stack([main, diag, minor, circ(132), circ(142)]);
  const ticks = outside(rays(132, 142, 32, 11.25 / 1), main, diag);
  const split = join(rays(0, 170, 4), rays(0, 122, 4, 45), rays(26, 88, 8, 22.5));
  return {
    sw: 3,
    p: [m, d, mi, r1, r2, circ(10)],
    d: [ticks, inside(split, main), outside(inside(split, diag), main), outside(inside(split, minor), main, diag)],
  };
}

function snowflake(): Art {
  const arm = (a: number): string => {
    const seg = (u0: number, v0: number, u1: number, v1: number) => {
      const p = U(u0, v0);
      const q = U(u1, v1);
      return line(p[0], p[1], q[0], q[1]);
    };
    const s = [seg(36, 0, 150, 0)];
    for (const [u, len] of [[66, 34], [100, 30], [128, 20]] as const) s.push(seg(u, 0, u + len * 0.8, len * 0.6), seg(u, 0, u + len * 0.8, -len * 0.6));
    s.push(poly([U(150), U(162, 8), U(174), U(162, -8)]));
    return s.map((d) => ring(d, 1, C, C, a)).join(' ');
  };
  return {
    sw: 3,
    p: [ngon(C, C, 36, 6), star(C, C, 26, 13, 6, 30), around(6, arm), around(6, (a) => circle(...at(112, a), 5), 30), dotsRing(150, 6, 4, 30)],
  };
}

function blazingSun(): Art {
  const flame = (a: number) => {
    const L: P[] = [];
    const R: P[] = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      const sway = 7 * Math.sin(t * Math.PI * 2);
      const w = 8 * (1 - t) + 0.5;
      L.push(at(66 + 82 * t, a + (sway - w) / (66 + 82 * t) * 57.3));
      R.push(at(66 + 82 * t, a + (sway + w) / (66 + 82 * t) * 57.3));
    }
    return smooth([...L, ...R.reverse().slice(1)]);
  };
  const longRays = around(8, (a) => poly([at(62, a - 6), at(172, a), at(62, a + 6)]));
  return {
    sw: 3,
    p: [circ(26), circ(46), zigzag(46, 58, 16, 11.25), circ(58), longRays, around(8, flame, 22.5)],
    d: [dotsRing(36, 16, 2.5), rays(80, 150, 8)],
  };
}

function spiroSeven(): Art {
  return { sw: 3, p: [spiro(150, 7, 3, 1.5, false, 18), spiro(112, 7, 3, 1.5, false, 18, 360 / 14), circ(166), circ(22), dotsRing(176, 7, 4, 360 / 14)] };
}

function roseWindow(): Art {
  const oculi = around(12, (a) => circle(...at(130, a), 15), 15);
  const trefoil = around(12, (a) => {
    const c = at(72, a);
    return join(circle(c[0], c[1], 4));
  }, 15);
  return {
    sw: 3,
    p: [circ(40), scallop(40, 6, 10, false), arches(48, 110, 12), rays(40, 154, 12), circ(110), circ(154), circ(166), oculi],
    d: [arches(56, 100, 12), trefoil],
  };
}

function featherRing(): Art {
  const n = 12;
  const len = 118;
  const r0 = 46;
  const vane = petal(C, C - r0, 0, len, 12, 0.45);
  const barbs: string[] = [];
  for (let i = 1; i <= 9; i++) {
    const u = r0 + 14 + i * 9.5;
    const w = 12 * Math.sin((Math.PI * (u - r0)) / len) * 1.15;
    barbs.push(`M ${pt(U(u - 6, 0))} L ${pt(U(u + 2, w * 0.85))} M ${pt(U(u - 6, 0))} L ${pt(U(u + 2, -w * 0.85))}`);
  }
  return {
    sw: 3,
    p: [join(circ(16), circ(38)), ring(vane, n, C, C), ring(line(C, C - r0 + 4, C, C - r0 - len + 10), n, C, C), dotsRing(176, n, 4, 15)],
    d: [ring(inside(barbs.join(' '), vane), n, C, C), dotsRing(27, 8, 2.5)],
  };
}

function hexTessellation(): Art {
  const s = 24;
  const cells = hexCentres(s * Math.sqrt(3), 170, 0)
    .map((c) => ngon(c[0], c[1], s, 6))
    .join(' ');
  const inner = circ(140);
  return {
    sw: 3,
    p: [inside(cells, inner), inner, circ(150), scallop(150, 30, 10)],
    d: [star(C, C, s * 0.7, s * 0.35, 6), around(6, (a) => circle(...at(s * Math.sqrt(3), a), 4), 0)],
  };
}

function triangleLattice(): Art {
  const R = 150;
  const hex = ngon(C, C, R, 6, 30);
  const step = (R * Math.sqrt(3)) / 2 / 4;
  const lines: string[] = [];
  for (const dir of [0, 60, 120]) {
    for (let k = -8; k <= 8; k++) {
      const off = k * step;
      const p = polar(C, C, off, dir + 90);
      const a = polar(p[0], p[1], 220, dir);
      const b = polar(p[0], p[1], -220, dir);
      lines.push(line(a[0], a[1], b[0], b[1]));
    }
  }
  return {
    sw: 3,
    p: [inside(lines.join(' '), hex), hex, circ(162), around(6, (a) => circle(...at(172, a), 6), 0)],
    d: [circ(step * 1.2), around(6, (a) => circle(...at(2 * step * 1.155, a), 6), 0)],
  };
}

function curlWaves(): Art {
  const curl = smooth(
    [U(62, -16), U(88, -18), U(114, -10), U(136, 6), U(146, 24), U(140, 38), U(126, 40), U(118, 32), U(122, 22), U(130, 22)],
    false,
  );
  const inner = smooth([U(66, -4), U(92, -4), U(114, 6), U(128, 20)], false);
  return {
    sw: 3,
    p: [join(circ(24), wave(40, 4, 8)), circ(58), ring(curl, 10, C, C), circ(158), scallop(158, 30, 8)],
    d: [ring(inner, 10, C, C), dotsRing(150, 10, 3, 18)],
  };
}

function nineStar(): Art {
  return {
    sw: 3,
    p: [circ(166), starPolygon(9, 4, 156), starPolygon(9, 2, 92, 20), circ(48), star(C, C, 40, 20, 9), dotsRing(176, 9, 4, 20)],
    d: [dotsRing(120, 9, 4, 20)],
  };
}

// ---- advanced -------------------------------------------------------------------------------------------------

/** Two ribbons weaving around a ring with alternating over/under crossings. */
function braidRing(R: number, amp: number, n: number, w: number, gap = 4): string[] {
  const centre = (s: number, a: number) => R + s * amp * Math.sin(rad(n * a));
  const slope = (a: number) => Math.abs(amp * n * Math.cos(rad(n * a))) / R;
  const out: string[] = [];
  for (const s of [1, -1]) {
    for (const e of [w, -w]) {
      const keep: boolean[] = [];
      const pts: P[] = [];
      const N = 1440;
      for (let i = 0; i < N; i++) {
        const a = (360 * i) / N;
        const r = centre(s, a) + e;
        pts.push(at(r, a));
        const k = Math.round((a * n) / 180);
        const otherOver = (k % 2 === 0) === (s === 1);
        const dist = Math.abs(r - centre(-s, a)) / Math.sqrt(1 + slope(a) ** 2);
        keep.push(!(otherOver && dist < w + gap));
      }
      // rotate so the list starts at a gap, then emit kept runs
      const first = keep.indexOf(false);
      const order = Array.from({ length: N }, (_, i) => (first + i) % N);
      let run: P[] = [];
      const flush = () => {
        if (run.length > 1) out.push(pl(run.filter((_, i) => i === 0 || i === run.length - 1 || i % 6 === 0)));
        run = [];
      };
      for (const i of order) {
        if (keep[i]) run.push(pts[i]);
        else flush();
      }
      flush();
    }
  }
  return out;
}

function knotRing(): Art {
  const braid = braidRing(122, 18, 6, 9);
  return {
    sw: 3,
    p: [
      join(circ(12), circ(28)),
      petals(12, 28, 50, 9, 0.55),
      circ(84),
      ...chunk(braid, 2),
      circ(160),
      circ(172),
    ],
    d: [
      midribs(12, 28, 50),
      dotsRing(92, 24, 2.5),
      dotsRing(166, 36, 2.5),
      dotsRing(20, 6, 2),
      around(6, (a) => circle(...at(122, a), 3), 15),
      around(6, (a) => circle(...at(122, a), 3), 45),
    ],
  };
}

function radialLace(): Art {
  const net: string[] = [];
  for (let i = 0; i < 24; i++) {
    const a = i * 15;
    net.push(pl([at(64, a), at(90, a + 15)]), pl([at(64, a + 15), at(90, a)]));
  }
  return {
    sw: 2.6,
    dw: 1.4,
    p: [
      join(circ(10), petals(6, 10, 40, 11, 0.6)),
      circ(56),
      circ(64),
      circ(90),
      bumps(98, 120, 18),
      circ(98),
      dotsRing(140, 36, 5, 5),
      scallop(160, 36, 9),
      circ(152),
    ],
    d: [
      net.join(' '),
      midribs(6, 10, 40),
      dotsRing(60, 24, 1.8),
      around(18, (a) => circle(...at(108, a + 10), 3.5)),
      scallop(56, 12, 6, false),
      dotsRing(173, 36, 2.2),
      around(36, (a) => circle(...at(140, a), 1.6), 5),
      rays(120, 132, 18),
    ],
  };
}

function tieredLotus(): Art {
  const t1 = petals(6, 24, 52, 14, 0.45);
  const t2 = petals(12, 46, 74, 13, 0.4, 15);
  const t3 = petals(12, 70, 96, 16, 0.35);
  const t4 = petals(24, 120, 48, 8, 0.4, 7.5);
  const [c, a, b, d3, e] = stack([circ(24), t1, t2, t3, t4]);
  const veins = (n: number, r0: number, len: number, w: number, off: number) =>
    ring(
      join(
        `M ${pt(U(r0 + len * 0.2))} L ${pt(U(r0 + len * 0.82))}`,
        `M ${pt(U(r0 + len * 0.3, 0))} Q ${pt(U(r0 + len * 0.55, w * 0.55))} ${pt(U(r0 + len * 0.78, w * 0.3))}`,
        `M ${pt(U(r0 + len * 0.3, 0))} Q ${pt(U(r0 + len * 0.55, -w * 0.55))} ${pt(U(r0 + len * 0.78, -w * 0.3))}`,
      ),
      n,
      C,
      C,
      off,
    );
  return {
    sw: 3,
    p: [c, a, b, d3, e, circ(172)],
    d: [
      dotsRing(14, 6, 2.5),
      circle(C, C, 3),
      outside(veins(6, 24, 52, 14, 0), circ(24)),
      outside(veins(12, 46, 74, 13, 15), t1, circ(24)),
      outside(veins(12, 70, 96, 16, 0), t2, t1),
      outside(midribs(24, 120, 48, 7.5), t3, t2),
      dotsRing(178, 24, 2, 7.5),
    ],
  };
}

function flowerOfLife37(): Art {
  const s = 30;
  const cs = hexCentres(s, 3 * s);
  const circles = cs.map((c) => circle(c[0], c[1], s)).join(' ');
  const R = 4 * s;
  const vesicas = around(24, (a) => petal(...at(R + 2, a), a, 36, 7, 0.5));
  return {
    sw: 2.6,
    dw: 1.4,
    p: [inside(circles, circ(R)), circ(R), vesicas, circ(R + 40), circ(R + 50)],
    d: [
      midribs(24, R + 2, 36, 0, 0.2, 0.8),
      around(24, (a) => circle(...at(R + 30, a), 2.5), 7.5),
      around(24, (a) => circle(...at(R + 14, a), 2), 7.5),
      dotsRing(R + 45, 48, 1.8),
      circle(C, C, 4),
      around(6, (a) => circle(...at(s, a), 3), 30),
    ],
  };
}

function ornateCompass(): Art {
  const p4 = star(C, C, 160, 24, 4);
  const p4b = star(C, C, 130, 20, 4, 45);
  const p8 = around(8, (a) => kite(22, 40, 98, 6, a), 22.5);
  const p16 = around(16, (a) => kite(30, 52, 76, 4, a), 11.25);
  const [a, b, c, d, r1, r2, r3] = stack([p4, p4b, p8, p16, circ(108), circ(140), circ(150)]);
  const split = (shape: string, n: number, r0: number, r1x: number, off: number, front: string[]) =>
    outside(inside(rays(r0, r1x, n, off), shape), ...front);
  const hatchHalf = (n: number, r1x: number, half: number, off: number, shape: string, front: string[]) => {
    const hs: string[] = [];
    for (let i = 0; i < n; i++) {
      const deg = off + (360 * i) / n;
      for (let k = 1; k < 12; k++) {
        const r = (r1x * k) / 12;
        const p = at(r, deg);
        const q = at(r + 10, deg + half * 1.6 * (1 - k / 12));
        hs.push(line(p[0], p[1], q[0], q[1]));
      }
    }
    return outside(inside(hs.join(' '), shape), ...front);
  };
  return {
    sw: 3,
    dw: 1.4,
    p: [a, b, c, d, r1, r2, r3, circ(8), poly([at(171, -5), at(182, 0), at(171, 5), at(160, 0)])],
    d: [
      split(p4, 4, 0, 160, 0, []),
      split(p4b, 4, 0, 130, 45, [p4]),
      split(p8, 8, 22, 98, 22.5, [p4, p4b]),
      hatchHalf(4, 150, 8, 0, p4, []),
      hatchHalf(4, 122, 8, 45, p4b, [p4]),
      outside(rays(140, 150, 72), p4, p4b),
      outside(rays(140, 146, 72, 2.5), p4, p4b),
    ],
  };
}

function goldenSeeds(): Art {
  const seeds: string[] = [];
  const golden = 137.508;
  for (let i = 1; i <= 150; i++) {
    const r = 5.4 * Math.sqrt(i);
    const [x, y] = at(r, i * golden);
    seeds.push(circle(x, y, 1.6 + r / 40));
  }
  return {
    sw: 3,
    dw: 1.5,
    p: [circ(72), petals(21, 72, 46, 7, 0.55), petals(21, 80, 62, 9, 0.4, 360 / 42), circ(150), scallop(150, 34, 10)],
    d: [...chunk(seeds, 4), midribs(21, 72, 46, 0, 0.2, 0.7), dotsRing(166, 34, 2, 360 / 68)],
  };
}

function spiroLayered(): Art {
  return {
    sw: 2.6,
    dw: 1.4,
    p: [spiro(168, 12, 5, 3, false, 14), spiro(108, 7, 2, 0.9, false, 18, 360 / 14), spiro(42, 8, 1, 0.8, true, 10)],
    d: [circ(178), dotsRing(178, 12, 3, 15), dotsRing(150, 24, 2), dotsRing(54, 8, 2.5, 22.5), circle(C, C, 4), circ(14)],
  };
}

function paisleyRing(): Art {
  const shape = (s: number) =>
    smooth([U(56, 2 * s), U(62, 20 * s), U(80, 32 * s), U(104, 32 * s), U(124, 22 * s), U(140, 4 * s), U(150, -14 * s), U(156, -32 * s), U(146, -24 * s), U(128, -16 * s), U(104, -20 * s), U(78, -22 * s), U(62, -14 * s)]);
  const one = shape(1);
  const innerOne = smooth([U(70, 2), U(76, 16), U(92, 24), U(110, 22), U(124, 10), U(134, -6), U(124, -6), U(106, -10), U(86, -12), U(74, -8)]);
  return {
    sw: 3,
    dw: 1.4,
    p: [join(circ(14), circ(30)), petals(8, 30, 14, 6, 0.6, 22.5), ring(one, 8, C, C), circ(166), scallop(166, 40, 6)],
    d: [
      ring(innerOne, 8, C, C),
      ring(circle(...U(96, 4), 7), 8, C, C),
      ring(join(circle(...U(96, 4), 2.5), circle(...U(140, -8), 2.5), circle(...U(146, -20), 2)), 8, C, C),
      dotsRing(158, 40, 2),
      dotsRing(22, 8, 2),
      dotsRing(118, 8, 3.5, 22.5),
      ring(
        Array.from({ length: 10 }, (_, i) => {
          const a = rad(i * 36);
          const p = U(96 + 11 * Math.cos(a), 4 + 11 * Math.sin(a));
          const q = U(96 + 16 * Math.cos(a), 4 + 16 * Math.sin(a));
          return line(p[0], p[1], q[0], q[1]);
        }).join(' '),
        8,
        C,
        C,
      ),
    ],
  };
}

function eightFoldStar(): Art {
  // outline of the {8/3} star polygon with an inner echo, an octagram core and a 16-point outer band
  const R = 150;
  const ri = R * (Math.cos((3 * Math.PI) / 8) / Math.cos((2 * Math.PI) / 8));
  return {
    sw: 2.8,
    dw: 1.4,
    p: [
      star(C, C, R, ri, 8),
      star(C, C, R - 18, ri - 9.7, 8),
      ngon(C, C, ri, 8, 22.5),
      join(ngon(C, C, 64, 4, 22.5), ngon(C, C, 64, 4, 67.5)),
      join(circ(14), circ(28)),
      rays(ri, 160, 8, 22.5),
      circ(160),
      star(C, C, 180, 160, 16, 11.25),
    ],
    d: [
      ngon(C, C, ri - 8, 8, 22.5),
      petals(8, 28, 20, 5, 0.5, 22.5),
      around(8, (a) => circle(...at(R - 34, a), 4)),
      around(16, (a) => circle(...at(170, a), 2.5), 11.25),
      around(8, (a) => circle(...at(145, a), 3), 22.5),
      dotsRing(21, 8, 1.8),
    ],
  };
}

function vineMandala(): Art {
  const R = 136;
  const n = 10;
  const vine = wave(R, 12, n);
  const leaves: string[] = [];
  const veins: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (360 * i) / (n * 2) + 360 / (n * 4) / 2;
    const out = i % 2 === 0;
    const r = R + 12 * Math.sin(rad(n * a));
    const base = at(r, a);
    const dir = out ? a + 40 : a + 180 - 40;
    leaves.push(petal(base[0], base[1], dir, 30, 8, 0.4));
    const tip = polar(base[0], base[1], 24, dir);
    veins.push(line(base[0], base[1], tip[0], tip[1]));
  }
  return {
    sw: 3,
    dw: 1.4,
    p: [join(circ(14), circ(26)), ring(leaf(C, C - 26, 0, 64, 15), 8, C, C), circ(98), outside(vine, ...leaves), leaves.join(' '), circ(176)],
    d: [
      veins.join(' '),
      dotsRing(20, 8, 2),
      dotsRing(106, 20, 2.5),
      ring(join(`M ${pt(U(50, 0))} L ${pt(U(60, 7))}`, `M ${pt(U(66, 0))} L ${pt(U(74, 6))}`, `M ${pt(U(50, 0))} L ${pt(U(60, -7))}`, `M ${pt(U(66, 0))} L ${pt(U(74, -6))}`), 8, C, C),
      dotsRing(108, 8, 4, 22.5),
      dotsRing(168, 20, 2.5, 9),
    ],
  };
}

// ---- catalogue ------------------------------------------------------------------------------------------------

function tpl(id: string, name: string, level: TemplateLevel, tags: string[], art: Art): Template {
  const detail = (art.d ?? []).filter(Boolean);
  return {
    id,
    name,
    category: 'mandalas',
    level,
    tags,
    viewBox: VB,
    paths: art.p.filter(Boolean),
    ...(detail.length ? { detail } : {}),
    ...(art.sw ? { strokeWidth: art.sw } : {}),
    ...(art.dw ? { detailWidth: art.dw } : {}),
  };
}

export const mandalas2: Template[] = [
  // beginner
  tpl('mandala-sun-rays', 'Sun ray mandala', 'beginner', ['mandala', 'sun', 'rays', 'geometric', 'simple'], sunRays()),
  tpl('mandala-six-petal', 'Six-petal mandala', 'beginner', ['mandala', 'petals', 'floral', 'simple'], sixPetal()),
  tpl('geo-seed-of-life', 'Seed of life', 'beginner', ['sacred', 'geometric', 'circles', 'seed'], seedOfLife()),
  tpl('geo-seven-point-star', 'Seven-point star circle', 'beginner', ['geometric', 'star', 'polygon', 'circle'], heptagram()),
  tpl('mandala-ocean-waves', 'Ocean wave mandala', 'beginner', ['mandala', 'waves', 'ocean', 'calm'], oceanWaves()),
  tpl('geo-compass-four-point', 'Four-point compass star', 'beginner', ['compass', 'star', 'nautical', 'geometric'], simpleCompass()),
  tpl('mandala-scallop-rosette', 'Scalloped rosette', 'beginner', ['rosette', 'scallop', 'mandala', 'simple'], scallopRosette()),
  tpl('mandala-heart-petals', 'Heart petal mandala', 'beginner', ['mandala', 'hearts', 'love', 'valentine'], heartPetals()),
  tpl('geo-triangle-ring', 'Triangle ring mandala', 'beginner', ['mandala', 'geometric', 'triangles', 'simple'], triangleRing()),
  tpl('mandala-leaf-ring', 'Leaf ring mandala', 'beginner', ['mandala', 'leaves', 'nature', 'simple'], leafRing()),
  tpl('geo-twisted-squares', 'Twisted squares medallion', 'beginner', ['geometric', 'squares', 'medallion', 'star'], twistedSquares()),
  tpl('mandala-teardrop-five', 'Five-fold teardrop mandala', 'beginner', ['mandala', 'teardrop', 'pentagonal', 'simple'], teardropFive()),
  tpl('geo-rose-curve', 'Rose curve rosette', 'beginner', ['rosette', 'geometric', 'curve', 'maths'], roseCurve()),
  tpl('mandala-pinwheel-arms', 'Pinwheel swirl mandala', 'beginner', ['mandala', 'swirl', 'pinwheel', 'motion'], spiralArms()),
  tpl('geo-nested-octagons', 'Nested octagon medallion', 'beginner', ['geometric', 'octagon', 'medallion', 'simple'], nestedOctagons()),
  tpl('mandala-open-lotus', 'Open lotus mandala', 'beginner', ['mandala', 'lotus', 'petals', 'calm'], openLotus()),
  // intermediate
  tpl('mandala-layered-floral', 'Layered floral mandala', 'intermediate', ['mandala', 'floral', 'petals', 'ornamental'], layeredFloral()),
  tpl('mandala-starburst', 'Starburst mandala', 'intermediate', ['mandala', 'star', 'burst', 'geometric'], starburst()),
  tpl('geo-flower-of-life-hexagon', 'Hexagonal flower of life', 'intermediate', ['sacred', 'geometric', 'hexagon', 'circles'], hexFlowerOfLife()),
  tpl('geo-thirteen-circle-net', 'Thirteen-circle sacred net', 'intermediate', ['sacred', 'geometric', 'circles', 'net'], thirteenNet()),
  tpl('geo-compass-sixteen-point', 'Sixteen-point compass rose', 'intermediate', ['compass', 'nautical', 'map', 'star'], compassSixteen()),
  tpl('mandala-snowflake', 'Snowflake mandala', 'intermediate', ['mandala', 'snowflake', 'winter', 'geometric'], snowflake()),
  tpl('mandala-blazing-sun', 'Blazing sun mandala', 'intermediate', ['mandala', 'sun', 'flames', 'rays'], blazingSun()),
  tpl('geo-spirograph-seven', 'Seven-loop spirograph rosette', 'intermediate', ['rosette', 'spirograph', 'geometric', 'loops'], spiroSeven()),
  tpl('mandala-rose-window', 'Rose window rosette', 'intermediate', ['rosette', 'gothic', 'tracery', 'window'], roseWindow()),
  tpl('mandala-feather-ring', 'Feather ring mandala', 'intermediate', ['mandala', 'feathers', 'boho', 'ornamental'], featherRing()),
  tpl('geo-honeycomb-medallion', 'Honeycomb tessellation medallion', 'intermediate', ['geometric', 'honeycomb', 'tessellation', 'medallion'], hexTessellation()),
  tpl('geo-triangle-lattice', 'Triangle lattice medallion', 'intermediate', ['geometric', 'lattice', 'tessellation', 'hexagon'], triangleLattice()),
  tpl('mandala-curling-waves', 'Curling wave mandala', 'intermediate', ['mandala', 'waves', 'ocean', 'surf'], curlWaves()),
  tpl('geo-nine-point-star', 'Nine-point star polygon', 'intermediate', ['geometric', 'star', 'polygon', 'circle'], nineStar()),
  // advanced
  tpl('mandala-interlaced-knot', 'Interlaced knot ring mandala', 'advanced', ['mandala', 'knot', 'interlace', 'braid', 'ornamental'], knotRing()),
  tpl('mandala-radial-lace', 'Radial lace mandala', 'advanced', ['mandala', 'lace', 'doily', 'ornamental', 'vintage'], radialLace()),
  tpl('mandala-tiered-lotus', 'Tiered lotus mandala', 'advanced', ['mandala', 'lotus', 'petals', 'ornamental', 'meditation'], tieredLotus()),
  tpl('geo-flower-of-life-ring', 'Flower of life in a petal ring', 'advanced', ['sacred', 'geometric', 'circles', 'petals', 'ornamental'], flowerOfLife37()),
  tpl('geo-compass-ornate', 'Ornate thirty-two point compass', 'advanced', ['compass', 'nautical', 'map', 'vintage', 'star'], ornateCompass()),
  tpl('mandala-golden-seeds', 'Golden spiral seed mandala', 'advanced', ['mandala', 'seeds', 'spiral', 'fibonacci', 'geometric'], goldenSeeds()),
  tpl('geo-spirograph-layered', 'Layered spirograph mandala', 'advanced', ['mandala', 'spirograph', 'geometric', 'loops', 'retro'], spiroLayered()),
  tpl('mandala-paisley-ring', 'Paisley ring mandala', 'advanced', ['mandala', 'paisley', 'ornamental', 'boho', 'henna'], paisleyRing()),
  tpl('geo-eight-fold-star', 'Eight-fold star medallion', 'advanced', ['geometric', 'star', 'medallion', 'octagram', 'ornamental'], eightFoldStar()),
  tpl('mandala-leaf-vine', 'Leaf and vine mandala', 'advanced', ['mandala', 'vine', 'leaves', 'botanical', 'ornamental'], vineMandala()),
];
