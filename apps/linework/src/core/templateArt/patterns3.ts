// Frames & patterns batch 2 (fb-1023b T138, 23 Oct 2026): original line art on a 400×400 canvas. See docs/TEMPLATES.md.
// Frames, labels, borders and repeat tiles to trace: scalloped and bracket labels, a ticket tag, wave, key and stepped
// frames, honeycomb, chevron, quatrefoil, shingle, damask and woven tiles, a lace doily and corner flourishes. All of
// our own geometry (no copied ornament sheets). Overlaps use occlude.ts so lines behind a shape are hidden.
import type { Template, TemplateLevel } from '../templates.ts';
import { circle, ellipse, f, line, mapPath, petal, polar, rotate, rrect, star, type P } from './draw.ts';
import { clip, region, roundPoly, samplePath } from './occlude.ts';
import { join, layered, smooth, type Art } from './figures.ts';

const VB = '0 0 400 400';

function tpl(id: string, name: string, level: TemplateLevel, tags: string[], art: Art): Template {
  const detail = art.d.filter(Boolean);
  return {
    id: `pat2-${id}`,
    name,
    category: 'patterns',
    level,
    tags,
    viewBox: VB,
    paths: art.p.filter(Boolean),
    ...(detail.length ? { detail } : {}),
  };
}

// ---- helpers --------------------------------------------------------------------------------------------------

const pl = (pts: readonly P[], closed = false): string =>
  pts.map((p, i) => `${i ? 'L' : 'M'} ${f(p[0])} ${f(p[1])}`).join(' ') + (closed ? ' Z' : '');

/** Closed ring of n outward scallops on radius R. */
function scallops(cx: number, cy: number, R: number, n: number, rot = 0): string {
  const pts = Array.from({ length: n }, (_, i) => polar(cx, cy, R, rot + (360 * i) / n));
  const r = R * Math.sin(Math.PI / n);
  let d = `M ${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 1; i <= n; i++) {
    const q = pts[i % n];
    d += ` A ${f(r)} ${f(r)} 0 0 1 ${f(q[0])} ${f(q[1])}`;
  }
  return `${d} Z`;
}

/** Points (and outward normals) around a rounded rectangle, about `step` apart. */
function rrPts(x: number, y: number, w: number, h: number, r: number, step: number): { p: P; n: P }[] {
  const out: { p: P; n: P }[] = [];
  const seg = (a: P, b: P, n: P) => {
    const k = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let i = 0; i < k; i++) out.push({ p: [a[0] + ((b[0] - a[0]) * i) / k, a[1] + ((b[1] - a[1]) * i) / k], n });
  };
  const arc = (cx: number, cy: number, a0: number) => {
    const k = Math.max(2, Math.round((Math.PI / 2) * r / step));
    for (let i = 0; i < k; i++) {
      const a = a0 + ((Math.PI / 2) * i) / k;
      out.push({ p: [cx + r * Math.cos(a), cy + r * Math.sin(a)], n: [Math.cos(a), Math.sin(a)] });
    }
  };
  seg([x + r, y], [x + w - r, y], [0, -1]);
  arc(x + w - r, y + r, -Math.PI / 2);
  seg([x + w, y + r], [x + w, y + h - r], [1, 0]);
  arc(x + w - r, y + h - r, 0);
  seg([x + w - r, y + h], [x + r, y + h], [0, 1]);
  arc(x + r, y + h - r, Math.PI / 2);
  seg([x, y + h - r], [x, y + r], [-1, 0]);
  arc(x + r, y + r, Math.PI);
  return out;
}

/** Dashes along a dense point list: `on` points drawn, `off` points skipped. */
function dashes(pts: readonly P[], on: number, off: number): string {
  const out: string[] = [];
  for (let i = 0; i + on < pts.length; i += on + off) out.push(pl(pts.slice(i, i + on + 1)));
  return out.join(' ');
}

function ellPts(cx: number, cy: number, rx: number, ry: number, n: number): P[] {
  return Array.from({ length: n + 1 }, (_, i) => [cx + rx * Math.cos((2 * Math.PI * i) / n), cy + ry * Math.sin((2 * Math.PI * i) / n)] as P);
}

const inside = (d: string, frame: string): string => clip(d, [region(frame)], 'inside');
const diamond = (cx: number, cy: number, rx: number, ry = rx): string => pl([[cx, cy - ry], [cx + rx, cy], [cx, cy + ry], [cx - rx, cy]], true);
const quad = (d: string): string => [0, 90, 180, 270].map((a) => rotate(d, a, 200, 200)).join(' ');
const swapXY = (d: string): string => mapPath(d, { map: (x, y) => [y, x], scale: 1, rotate: 0, flip: true });
const mirror200 = (d: string): string => mapPath(d, { map: (x, y) => [400 - x, y], scale: 1, rotate: 0, flip: true });

// ---- beginner -------------------------------------------------------------------------------------------------

function scallopLabel(): Art {
  const band = pl([[34, 168], [366, 168], [340, 200], [366, 232], [34, 232], [60, 200]], true);
  return join(
    layered([
      { sil: band, d: [line(78, 180, 322, 180), line(78, 220, 322, 220)] },
      { sil: circle(200, 200, 126) },
      { sil: scallops(200, 200, 150, 28) },
    ]),
    {
      p: [star(200, 118, 24, 10, 5), star(200, 284, 24, 10, 5)],
      d: [dashes(ellPts(200, 200, 138, 138, 216), 3, 3), circle(146, 126, 4), circle(254, 126, 4), circle(146, 276, 4), circle(254, 276, 4)],
    },
  );
}

function ticketTag(): Art {
  const outer =
    'M 60 110 L 264 110 A 16 16 0 0 0 296 110 L 340 110 A 20 20 0 0 0 360 130 L 360 270 A 20 20 0 0 0 340 290 ' +
    'L 296 290 A 16 16 0 0 0 264 290 L 60 290 A 20 20 0 0 0 40 270 L 40 130 A 20 20 0 0 0 60 110 Z';
  const perf = Array.from({ length: 13 }, (_, i) => line(280, 134 + i * 11, 280, 140 + i * 11)).join(' ');
  return {
    p: [outer, rrect(62, 130, 194, 140, 10), rrect(300, 130, 40, 140, 10), star(159, 200, 46, 19, 5)],
    d: [perf, line(84, 150, 112, 150), line(206, 150, 234, 150), line(84, 250, 112, 250), line(206, 250, 234, 250), star(320, 168, 9, 4, 5), circle(320, 200, 6), star(320, 232, 9, 4, 5)],
  };
}

function waveFrame(): Art {
  const mid = rrPts(55, 55, 290, 290, 22, 3);
  const L = mid.length;
  const wave = (phase: number) => pl(mid.map(({ p, n }, i) => {
    const s = 11 * Math.sin((2 * Math.PI * 16 * i) / L + phase);
    return [p[0] + n[0] * s, p[1] + n[1] * s] as P;
  }), true);
  return {
    p: [rrect(30, 30, 340, 340, 26), rrect(80, 80, 240, 240, 12), wave(0), wave(Math.PI)],
    d: [rrect(92, 92, 216, 216, 6), ...[[42, 42], [358, 42], [42, 358], [358, 358]].map(([x, y]) => circle(x, y, 4))],
  };
}

function honeycomb(): Art {
  const frame = rrect(40, 40, 320, 320, 22);
  const r = 40;
  const hexes: string[] = [];
  for (let c = -1; c <= 6; c++) {
    for (let k = -1; k <= 6; k++) {
      const cx = 200 + (c - 2.5) * 1.5 * r + 0.75 * r;
      const cy = 200 + (k - 2.5) * Math.sqrt(3) * r + (c % 2 ? Math.sqrt(3) * r / 2 : 0);
      hexes.push(pl(Array.from({ length: 6 }, (_, i) => [cx + r * Math.cos((Math.PI / 3) * i), cy + r * Math.sin((Math.PI / 3) * i)] as P), true));
    }
  }
  return { p: [frame, inside(hexes.join(' '), frame)], d: [rrect(28, 28, 344, 344, 30)] };
}

function stitchedPatch(): Art {
  const inner = ellipse(200, 200, 140, 104);
  const peaks = 'M 66 268 L 140 168 L 178 214 L 230 138 L 334 268';
  const snow = 'M 118 198 L 130 206 L 140 196 L 152 206 L 162 194 M 208 168 L 220 178 L 230 166 L 242 178 L 254 168';
  return {
    p: [ellipse(200, 200, 168, 132), inner, inside(`${peaks} Z`, inner), circle(286, 154, 22)],
    d: [dashes(ellPts(200, 200, 154, 118, 240), 4, 3), inside(snow, inner), inside('M 60 290 Q 200 270 340 290', inner)],
  };
}

function chevrons(): Art {
  const frame = rrect(40, 40, 320, 320, 16);
  const rows: string[] = [];
  for (let j = 0; j < 9; j++) {
    const y = 34 + j * 40;
    rows.push(pl(Array.from({ length: 11 }, (_, i) => [20 + i * 40, i % 2 ? y + 24 : y] as P)));
  }
  return { p: [frame, inside(rows.join(' '), frame)], d: [rrect(28, 28, 344, 344, 24)] };
}

function bracket(x0: number, y0: number, x1: number, y1: number, rc: number, rb: number): string {
  const my = (y0 + y1) / 2;
  return (
    `M ${f(x0 + rc)} ${f(y0)} L ${f(x1 - rc)} ${f(y0)} A ${f(rc)} ${f(rc)} 0 0 0 ${f(x1)} ${f(y0 + rc)} ` +
    `L ${f(x1)} ${f(my - rb)} A ${f(rb)} ${f(rb)} 0 0 1 ${f(x1)} ${f(my + rb)} L ${f(x1)} ${f(y1 - rc)} ` +
    `A ${f(rc)} ${f(rc)} 0 0 0 ${f(x1 - rc)} ${f(y1)} L ${f(x0 + rc)} ${f(y1)} A ${f(rc)} ${f(rc)} 0 0 0 ${f(x0)} ${f(y1 - rc)} ` +
    `L ${f(x0)} ${f(my + rb)} A ${f(rb)} ${f(rb)} 0 0 1 ${f(x0)} ${f(my - rb)} L ${f(x0)} ${f(y0 + rc)} A ${f(rc)} ${f(rc)} 0 0 0 ${f(x0 + rc)} ${f(y0)} Z`
  );
}

function bracketLabel(): Art {
  return {
    p: [bracket(46, 124, 354, 276, 26, 26), bracket(62, 140, 338, 260, 18, 18), diamond(200, 106, 12, 9), diamond(200, 294, 12, 9)],
    d: [line(112, 176, 288, 176), line(112, 224, 288, 224), diamond(98, 176, 6), diamond(302, 176, 6), diamond(98, 224, 6), diamond(302, 224, 6), line(150, 106, 184, 106), line(216, 106, 250, 106), line(150, 294, 184, 294), line(216, 294, 250, 294)],
  };
}

function bunting(): Art {
  const p: string[] = [];
  const d: string[] = [];
  const row = (y: number, sag: number, n: number) => {
    const a: P = [26, y];
    const c: P = [200, y + sag];
    const b: P = [374, y];
    const q = (t: number): P => [(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]];
    p.push(`M ${f(a[0])} ${f(a[1])} Q ${f(c[0])} ${f(c[1])} ${f(b[0])} ${f(b[1])}`);
    for (let i = 0; i < n; i++) {
      const t0 = 0.06 + (0.88 * i) / n + 0.01;
      const t1 = 0.06 + (0.88 * (i + 1)) / n - 0.01;
      const [l, r] = [q(t0), q(t1)];
      const tip: P = [(l[0] + r[0]) / 2, (l[1] + r[1]) / 2 + 64];
      p.push(pl([l, r, tip], true));
      if (i % 2) d.push(circle((l[0] + r[0] + tip[0]) / 3, (l[1] + r[1] + tip[1]) / 3 - 4, 6));
      else d.push(pl([[l[0] + (tip[0] - l[0]) * 0.35, l[1] + (tip[1] - l[1]) * 0.35], [r[0] + (tip[0] - r[0]) * 0.35, r[1] + (tip[1] - r[1]) * 0.35]]));
    }
  };
  row(60, 70, 8);
  row(206, 70, 8);
  d.push(circle(26, 60, 5), circle(374, 60, 5), circle(26, 206, 5), circle(374, 206, 5));
  return { p, d };
}

// ---- intermediate -----------------------------------------------------------------------------------------------

function stepped(x0: number, y0: number, x1: number, y1: number, s1: number, s2: number): string {
  return pl([
    [x0, y0 + s2], [x0 + s1, y0 + s2], [x0 + s1, y0 + s1], [x0 + s2, y0 + s1], [x0 + s2, y0],
    [x1 - s2, y0], [x1 - s2, y0 + s1], [x1 - s1, y0 + s1], [x1 - s1, y0 + s2], [x1, y0 + s2],
    [x1, y1 - s2], [x1 - s1, y1 - s2], [x1 - s1, y1 - s1], [x1 - s2, y1 - s1], [x1 - s2, y1],
    [x0 + s2, y1], [x0 + s2, y1 - s1], [x0 + s1, y1 - s1], [x0 + s1, y1 - s2], [x0, y1 - s2],
  ], true);
}

function decoFrame(): Art {
  const fan = (cy: number, dir: 1 | -1): { p: string[]; d: string[] } => {
    const sw = dir === 1 ? 1 : 0;
    const arcD = (r: number) => `M ${f(200 - r)} ${f(cy)} A ${f(r)} ${f(r)} 0 0 ${sw} ${f(200 + r)} ${f(cy)} Z`;
    const rays = Array.from({ length: 11 }, (_, i) => {
      const a = -75 + i * 15;
      const deg = dir === 1 ? a : 180 - a;
      return line(...polar(200, cy, 24, deg), ...polar(200, cy, 66, deg));
    }).join(' ');
    return { p: [arcD(70), arcD(20)], d: [rays, dir === 1 ? `M 152 ${f(cy)} A 48 48 0 0 1 248 ${f(cy)}` : `M 152 ${f(cy)} A 48 48 0 0 0 248 ${f(cy)}`] };
  };
  const top = fan(156, 1);
  const bot = fan(244, -1);
  const chev = (x: number, s: 1 | -1) => [0, 1, 2].map((k) => pl([[x - s * 10 + s * k * 12, 182], [x + s * 4 + s * k * 12, 200], [x - s * 10 + s * k * 12, 218]])).join(' ');
  return {
    p: [stepped(36, 36, 364, 364, 16, 44), stepped(52, 52, 348, 348, 14, 40), ...top.p, ...bot.p, line(76, 156, 324, 156), line(76, 244, 324, 244), diamond(84, 200, 14, 22), diamond(316, 200, 14, 22)],
    d: [...top.d, ...bot.d, chev(116, 1), chev(284, -1), line(76, 164, 324, 164), line(76, 236, 324, 236), line(200, 70, 200, 80), line(200, 320, 200, 330)],
  };
}

function greekKey(): Art {
  const n = 6;
  const s = 340 / (6 * (n + 2));
  const u = 6 * s;
  const o = 30;
  const units: string[] = [];
  for (let i = 0; i < n; i++) {
    const x = o + u + i * u;
    const q = (a: number, b: number): P => [x + a * s, o + b * s];
    units.push(pl([q(0, 6), q(0, 1), q(5, 1), q(5, 5), q(2, 5), q(2, 3), q(3.5, 3)]));
  }
  const side = units.join(' ');
  const corner = `${rrect(o, o, u, u, 0)} ${rrect(o + 1.5 * s, o + 1.5 * s, 3 * s, 3 * s, 0)}`;
  return {
    p: [rrect(o, o, 340, 340, 0), rrect(o + u, o + u, 340 - 2 * u, 340 - 2 * u, 0), quad(side), quad(corner)],
    d: [rrect(o + u + 12, o + u + 12, 340 - 2 * u - 24, 340 - 2 * u - 24, 0), diamond(200, 200, 22), diamond(200, 200, 10)],
  };
}

function archFrame(): Art {
  const outer = 'M 80 346 L 80 176 A 120 120 0 0 1 320 176 L 320 346 Z';
  const inner = 'M 102 346 L 102 176 A 98 98 0 0 1 298 176 L 298 346 Z';
  const key = pl([[184, 40], [216, 40], [210, 84], [190, 84]], true);
  const base = rrect(56, 340, 288, 28, 4);
  const capL = rrect(66, 166, 46, 18, 3);
  const capR = rrect(288, 166, 46, 18, 3);
  const vous = Array.from({ length: 11 }, (_, i) => -75 + i * 15)
    .filter((a) => Math.abs(a) > 8)
    .map((a) => line(...polar(200, 176, 100, a), ...polar(200, 176, 118, a)))
    .join(' ');
  return join(
    layered([
      { sil: key, d: [line(194, 52, 206, 52)] },
      { sil: base, d: [line(70, 354, 330, 354)] },
      { sil: capL },
      { sil: capR },
      { sil: inner, p: [], d: ['M 118 346 L 118 178 A 82 82 0 0 1 282 178 L 282 346'] },
      { sil: outer, d: [vous] },
    ]),
    { p: [], d: [line(80, 300, 102, 300), line(298, 300, 320, 300), line(80, 240, 102, 240), line(298, 240, 320, 240)] },
  );
}

function quatrefoil(cx: number, cy: number, dd: number): string {
  const a = `A ${f(dd)} ${f(dd)} 0 1 1`;
  return `M ${f(cx + dd)} ${f(cy - dd)} ${a} ${f(cx + dd)} ${f(cy + dd)} ${a} ${f(cx - dd)} ${f(cy + dd)} ${a} ${f(cx - dd)} ${f(cy - dd)} ${a} ${f(cx + dd)} ${f(cy - dd)} Z`;
}

function quatrefoilTile(): Art {
  const p: string[] = [rrect(36, 36, 328, 328, 12)];
  const d: string[] = [rrect(48, 48, 304, 304, 6)];
  for (const cx of [92, 200, 308]) {
    for (const cy of [92, 200, 308]) {
      p.push(quatrefoil(cx, cy, 24));
      d.push(quatrefoil(cx, cy, 13), circle(cx, cy, 4));
    }
  }
  for (const x of [146, 254]) for (const y of [146, 254]) p.push(diamond(x, y, 14));
  for (const x of [146, 254]) d.push(diamond(x, 56, 6), diamond(x, 344, 6), diamond(56, x, 6), diamond(344, x, 6));
  return { p, d };
}

function shingles(): Art {
  const frame = rrect(40, 40, 320, 320, 14);
  const rows: string[] = [];
  const inner: string[] = [];
  for (let j = 0; j < 12; j++) {
    const y = 14 + j * 30;
    const off = j % 2 ? 30 : 0;
    let d = '';
    let e = '';
    for (let i = -1; i < 7; i++) {
      const x = 20 + off + i * 60;
      d += `M ${f(x)} ${f(y)} A 30 30 0 0 0 ${f(x + 60)} ${f(y)} `;
      e += `M ${f(x + 14)} ${f(y)} A 16 16 0 0 0 ${f(x + 46)} ${f(y)} `;
    }
    rows.push(d.trim());
    inner.push(e.trim());
  }
  return { p: [frame, inside(rows.join(' '), frame)], d: [inside(inner.join(' '), frame), rrect(28, 28, 344, 344, 22)] };
}

function rosette(): Art {
  const cx = 200;
  const cy = 156;
  const pleat = roundPoly(Array.from({ length: 48 }, (_, i) => polar(cx, cy, i % 2 ? 116 : 128, (360 * i) / 48)), 3);
  const tailL = pl([[158, 226], [206, 244], [152, 372], [132, 346], [106, 362]], true);
  const tailR = pl([[242, 226], [194, 244], [248, 372], [268, 346], [294, 362]], true);
  const folds = Array.from({ length: 24 }, (_, i) => line(...polar(cx, cy, 98, (360 * i) / 24 + 7.5), ...polar(cx, cy, 116, (360 * i) / 24 + 7.5))).join(' ');
  return join(
    layered([
      { sil: circle(cx, cy, 58), p: [star(cx, cy, 36, 15, 5)] },
      { sil: circle(cx, cy, 72), d: [circle(cx, cy, 66)] },
      { sil: circle(cx, cy, 94) },
      { sil: pleat, d: [folds] },
      { sil: tailL, d: [line(176, 250, 136, 344)] },
      { sil: tailR, d: [line(224, 250, 264, 344)] },
    ]),
    { p: [], d: [] },
  );
}

// ---- advanced -----------------------------------------------------------------------------------------------------

function damask(): Art {
  const ogee = 'M 200 50 C 206 92 322 128 322 200 C 322 272 206 308 200 350 C 194 308 78 272 78 200 C 78 128 194 92 200 50 Z';
  const ogeeIn = 'M 200 70 C 206 104 306 136 306 200 C 306 264 206 296 200 330 C 194 296 94 264 94 200 C 94 136 194 104 200 70 Z';
  const centre = petal(200, 252, 0, 124, 22, 0.55);
  const sideR = petal(206, 250, 48, 96, 17, 0.5);
  const sideL = petal(194, 250, -48, 96, 17, 0.5);
  const lowR = petal(204, 262, 128, 60, 13);
  const lowL = petal(196, 262, -128, 60, 13);
  const scrollR = 'M 214 272 C 258 296 296 266 286 236 C 280 216 256 218 258 236 C 260 246 272 246 274 238';
  const scrollL = 'M 186 272 C 142 296 104 266 114 236 C 120 216 144 218 142 236 C 140 246 128 246 126 238';
  const flower = (x: number, y: number, r: number, rot: number) => [0, 90, 180, 270].map((a) => petal(x, y, a + rot, r, r * 0.32)).join(' ');
  const vein = (bx: number, by: number, deg: number, len: number) => line(bx, by, ...polar(bx, by, len, deg));
  const art = layered([
    { sil: circle(200, 254, 11), d: [circle(200, 254, 4)] },
    { sil: centre, d: [vein(200, 252, 0, 100), 'M 200 196 L 188 182 M 200 196 L 212 182 M 200 166 L 190 154 M 200 166 L 210 154'] },
    { sil: sideR, d: [vein(206, 250, 48, 78)] },
    { sil: sideL, d: [vein(194, 250, -48, 78)] },
    { sil: lowR, d: [vein(204, 262, 128, 46)] },
    { sil: lowL, d: [vein(196, 262, -128, 46)] },
    { sil: '', p: [scrollR, scrollL, 'M 200 266 L 200 316', circle(200, 112, 8)] },
    { sil: ogeeIn },
    { sil: ogee },
  ]);
  const corners = [[64, 64], [336, 64], [64, 336], [336, 336]] as const;
  return join(art, {
    p: [rrect(30, 30, 340, 340, 8), ...corners.map(([x, y]) => flower(x, y, 26, 45)), diamond(352, 200, 10, 18), diamond(48, 200, 10, 18)],
    d: [
      ...corners.map(([x, y]) => circle(x, y, 5)),
      ...[[200, 92], [178, 118], [222, 118], [200, 334], [160, 314], [240, 314]].map(([x, y]) => circle(x, y, 3)),
      ...corners.map(([x, y]) => [0, 90, 180, 270].map((a) => vein(x, y, a, 16)).join(' ')),
      dashes(samplePath('M 200 60 C 206 98 314 132 314 200 C 314 268 206 302 200 340 C 194 302 86 268 86 200 C 86 132 194 98 200 60 Z', 3)[0].pts, 2, 2),
    ],
  });
}

function laceDoily(): Art {
  const c = 200;
  const p: string[] = [scallops(c, c, 160, 36), circle(c, c, 148), circle(c, c, 126), circle(c, c, 66)];
  const d: string[] = [];
  // eyelets between the two outer rings
  d.push(Array.from({ length: 36 }, (_, i) => circle(...polar(c, c, 137, (360 * i) / 36 + 5), 5)).join(' '));
  // small inner scallops hanging inside each outer scallop
  d.push(scallops(c, c, 154, 36, 5).replace(/^/, ''));
  // petal ring
  for (let i = 0; i < 16; i++) {
    const a = (360 * i) / 16;
    const [bx, by] = polar(c, c, 70, a);
    p.push(petal(bx, by, a, 52, 12, 0.6));
    d.push(line(bx, by, ...polar(c, c, 112, a)));
    d.push(circle(...polar(c, c, 108, a + 11.25), 4));
  }
  // centre flower
  p.push(circle(c, c, 12));
  for (let i = 0; i < 8; i++) {
    const a = (360 * i) / 8;
    const [bx, by] = polar(c, c, 13, a);
    p.push(petal(bx, by, a, 34, 9, 0.7));
  }
  d.push(scallops(c, c, 56, 16, 11.25), circle(c, c, 5));
  // mesh between rings: radial threads
  d.push(Array.from({ length: 72 }, (_, i) => line(...polar(c, c, 148, (360 * i) / 72), ...polar(c, c, 156, (360 * i) / 72))).join(' '));
  return { p, d };
}

function cornersFrame(): Art {
  const scroll = 'M 62 62 C 100 58 138 58 160 72 C 178 84 172 108 152 106 C 138 104 138 88 150 86';
  const tendril = 'M 92 66 C 120 70 140 82 148 104';
  const leafDiag = petal(62, 62, 135, 76, 17, 0.5);
  const leafTop = petal(104, 62, 160, 38, 9);
  const bud = circle(126, 126, 6);
  const mid = 'M 200 70 C 180 70 168 80 174 92 C 178 100 190 98 188 88';
  const art = layered([
    { sil: bud, d: [circle(126, 126, 2)] },
    { sil: leafDiag, d: [line(62, 62, ...polar(62, 62, 60, 135))] },
    { sil: leafTop, d: [line(104, 62, ...polar(104, 62, 28, 160))] },
    { sil: swapXY(leafTop), d: [swapXY(line(104, 62, ...polar(104, 62, 28, 160)))] },
    { sil: '', p: [scroll, swapXY(scroll)], d: [tendril, swapXY(tendril)] },
  ]);
  const side = layered([{ sil: diamond(200, 60, 12, 9) }, { sil: '', p: [mid, mirror200(mid)] }]);
  const rot = (d: string, a: number) => rotate(d, a, 200, 200);
  const p: string[] = [rrect(36, 36, 328, 328, 0), rrect(48, 48, 304, 304, 0)];
  const d: string[] = [rrect(56, 56, 288, 288, 0)];
  for (const a of [0, 90, 180, 270]) {
    for (const s of [...art.p, ...side.p]) p.push(rot(s, a));
    for (const s of [...art.d, ...side.d]) d.push(rot(s, a));
    d.push(rot(`${circle(184, 62, 3)} ${circle(62, 184, 3)} ${circle(200, 100, 3)}`, a));
  }
  return { p, d };
}

function basketWeave(): Art {
  const frame = rrect(36, 36, 328, 328, 10);
  const pitch = 52;
  const w = 40;
  const start = 20;
  const N = 7;
  const edgesH: string[] = [];
  const edgesV: string[] = [];
  const grainH: string[] = [];
  const grainV: string[] = [];
  const runs = (from: number, to: number, holes: [number, number][]): [number, number][] => {
    const out: [number, number][] = [];
    let cur = from;
    for (const [a, b] of holes.sort((x, y) => x[0] - y[0])) {
      if (a > cur) out.push([cur, a]);
      cur = Math.max(cur, b);
    }
    if (cur < to) out.push([cur, to]);
    return out;
  };
  for (let j = 0; j < N; j++) {
    const y = start + j * pitch;
    const holes: [number, number][] = [];
    for (let i = 0; i < N; i++) if ((i + j) % 2 === 1) holes.push([start + i * pitch, start + i * pitch + w]);
    for (const [a, b] of runs(start - 10, 390, holes)) {
      edgesH.push(line(a, y, b, y), line(a, y + w, b, y + w));
      grainH.push(line(a + 3, y + w / 3, b - 3, y + w / 3), line(a + 3, y + (2 * w) / 3, b - 3, y + (2 * w) / 3));
    }
  }
  for (let i = 0; i < N; i++) {
    const x = start + i * pitch;
    const holes: [number, number][] = [];
    for (let j = 0; j < N; j++) if ((i + j) % 2 === 0) holes.push([start + j * pitch, start + j * pitch + w]);
    for (const [a, b] of runs(start - 10, 390, holes)) {
      edgesV.push(line(x, a, x, b), line(x + w, a, x + w, b));
      grainV.push(line(x + w / 3, a + 3, x + w / 3, b - 3), line(x + (2 * w) / 3, a + 3, x + (2 * w) / 3, b - 3));
    }
  }
  const p = [frame, inside(edgesH.join(' '), frame), inside(edgesV.join(' '), frame)];
  const d: string[] = [rrect(26, 26, 348, 348, 16)];
  for (let k = 0; k < grainH.length; k += 6) d.push(inside(grainH.slice(k, k + 6).join(' '), frame));
  for (let k = 0; k < grainV.length; k += 6) d.push(inside(grainV.slice(k, k + 6).join(' '), frame));
  return { p, d: d.filter(Boolean) };
}

// ---- catalogue -----------------------------------------------------------------------------------------------

export const patterns3: Template[] = [
  tpl('scallop-label', 'Scalloped round label', 'beginner', ['label', 'scalloped', 'badge', 'vintage', 'simple', 'ornamental'], scallopLabel()),
  tpl('ticket-tag', 'Vintage ticket tag', 'beginner', ['tag', 'ticket', 'label', 'vintage', 'simple', 'gift'], ticketTag()),
  tpl('wave-frame', 'Double wave border frame', 'beginner', ['frame', 'border', 'wave', 'simple', 'geometric'], waveFrame()),
  tpl('honeycomb', 'Honeycomb hexagon tile', 'beginner', ['tile', 'pattern', 'hexagon', 'honeycomb', 'geometric', 'simple'], honeycomb()),
  tpl('stitched-patch', 'Stitched mountain patch label', 'beginner', ['label', 'patch', 'stitched', 'outdoors', 'simple', 'stylized'], stitchedPatch()),
  tpl('chevrons', 'Chevron zigzag pattern', 'beginner', ['pattern', 'chevron', 'zigzag', 'tile', 'geometric', 'simple'], chevrons()),
  tpl('bracket-label', 'Bracket label with diamonds', 'beginner', ['label', 'bracket', 'frame', 'vintage', 'simple', 'wedding'], bracketLabel()),
  tpl('bunting', 'Bunting banner garland', 'beginner', ['banner', 'bunting', 'flags', 'party', 'birthday', 'simple'], bunting()),
  tpl('deco-frame', 'Vintage art deco fan frame', 'intermediate', ['deco', 'frame', 'stepped', 'fan', 'vintage', 'geometric'], decoFrame()),
  tpl('greek-key', 'Key meander border', 'intermediate', ['border', 'meander', 'key', 'frame', 'geometric', 'classic'], greekKey()),
  tpl('arch-frame', 'Arched keystone frame', 'intermediate', ['frame', 'arch', 'keystone', 'classic', 'architectural', 'vintage'], archFrame()),
  tpl('quatrefoil', 'Quatrefoil tile pattern', 'intermediate', ['tile', 'pattern', 'quatrefoil', 'gothic', 'geometric', 'ornamental'], quatrefoilTile()),
  tpl('shingles', 'Scalloped shingle pattern', 'intermediate', ['pattern', 'scalloped', 'shingle', 'scales', 'tile', 'geometric'], shingles()),
  tpl('rosette', 'Prize ribbon rosette', 'intermediate', ['ribbon', 'rosette', 'award', 'prize', 'winner', 'stylized'], rosette()),
  tpl('damask', 'Damask ogee tile', 'advanced', ['damask', 'tile', 'pattern', 'ogee', 'ornamental', 'vintage'], damask()),
  tpl('lace-doily', 'Vintage wedding lace doily', 'advanced', ['lace', 'doily', 'pattern', 'vintage', 'ornamental', 'wedding'], laceDoily()),
  tpl('corners-frame', 'Flourish corners frame', 'advanced', ['corners', 'frame', 'flourish', 'scrollwork', 'ornamental', 'wedding'], cornersFrame()),
  tpl('basket-weave', 'Woven basket tile', 'advanced', ['tile', 'pattern', 'weave', 'basket', 'texture', 'geometric'], basketWeave()),
];
