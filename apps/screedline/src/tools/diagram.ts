/**
 * Drawn diagrams with dimensions for each tool: plan views, sections, sheet layouts with laps and cuts, peg
 * profiles, wall elevations and paving previews. Pure geometry (no React Native), tested in diagram.test.ts.
 * Coordinates are in drawing units inside a 0..W box (W = 320); the renderer scales to the screen.
 */
import type { Shape } from '../core/concrete.ts';
import { piecesForRun } from '../core/reo.ts';
import type { Run, Values } from './registry.ts';

export type Fill = 'slab' | 'paper' | 'amber' | 'amberSoft' | 'gravel' | 'soil' | 'steel' | 'none';
export type Item =
  | { t: 'rect'; x: number; y: number; w: number; h: number; fill: Fill; stroke?: boolean; dash?: boolean }
  | { t: 'line'; x1: number; y1: number; x2: number; y2: number; kind: 'edge' | 'string' | 'dash' | 'amber' | 'ground' }
  | { t: 'circle'; cx: number; cy: number; r: number; fill: Fill }
  | { t: 'poly'; pts: [number, number][]; fill: Fill; dash?: boolean }
  | { t: 'text'; x: number; y: number; s: string; anchor?: 'start' | 'middle' | 'end'; kind?: 'ink' | 'muted' | 'amber'; size?: 's' | 'm' }
  | { t: 'dim'; x1: number; y1: number; x2: number; y2: number; label: string; side?: 1 | -1 };
export interface Diagram { title: string; w: number; h: number; items: Item[]; legend?: { fill: Fill; label: string }[]; list?: { title: string; rows: [string, string][] } }

/** Formats a length in metres for labels in the person's units (mm/in for small, m/ft for large). */
export type Fmt = { len: (m: number) => string; mm: (m: number) => string };

export const W = 320;
const n = (v: Values, k: string): number => {
  const x = v[k];
  return typeof x === 'number' && Number.isFinite(x) ? x : NaN;
};
const ok = (...xs: number[]) => xs.every(x => Number.isFinite(x) && x > 0);

/** Fits a w×h (metres) rectangle into a box, returning scale and offset to centre it. */
function fit(wm: number, hm: number, boxW: number, boxH: number) {
  const s = Math.min(boxW / wm, boxH / hm);
  return { s, ox: (boxW - wm * s) / 2, oy: (boxH - hm * s) / 2 };
}

function slab(v: Values, f: Fmt): Diagram | null {
  const L = n(v, 'length'), Wd = n(v, 'width'), D = n(v, 'depth');
  if (!ok(L, Wd, D)) return null;
  const edge = v.edge === 'yes' && ok(n(v, 'edgeWidth'), n(v, 'edgeDepth'));
  const bw = edge ? n(v, 'edgeWidth') : 0, bd = edge ? n(v, 'edgeDepth') : 0;
  const items: Item[] = [];
  // Plan
  const { s, ox } = fit(L, Wd, W - 70, 120);
  const x0 = 40 + ox, y0 = 28, pw = L * s, ph = Wd * s;
  items.push({ t: 'text', x: 0, y: 12, s: 'PLAN', kind: 'muted', size: 's' });
  items.push({ t: 'rect', x: x0, y: y0, w: pw, h: ph, fill: 'slab', stroke: true });
  if (edge && bw * s > 1.5) items.push({ t: 'rect', x: x0 + bw * s, y: y0 + bw * s, w: Math.max(0, pw - 2 * bw * s), h: Math.max(0, ph - 2 * bw * s), fill: 'paper', stroke: true, dash: true });
  items.push({ t: 'dim', x1: x0, y1: y0 + ph + 14, x2: x0 + pw, y2: y0 + ph + 14, label: f.len(L) });
  items.push({ t: 'dim', x1: x0 - 14, y1: y0, x2: x0 - 14, y2: y0 + ph, label: f.len(Wd), side: -1 });
  // Section across the width: slab D, edge beams bw × bd at each end (vertical exaggerated)
  const sy = y0 + ph + 44;
  items.push({ t: 'text', x: 0, y: sy - 6, s: 'SECTION', kind: 'muted', size: 's' });
  const deep = Math.max(D, bd);
  const vs = Math.min(70 / deep, 400);
  const sx0 = 40, sw = W - 80;
  const hs = sw / Wd;
  items.push({ t: 'line', x1: 10, y1: sy, x2: W - 10, y2: sy, kind: 'ground' });
  const pts: [number, number][] = edge
    ? [[sx0, sy], [sx0 + sw, sy], [sx0 + sw, sy + bd * vs], [sx0 + sw - bw * hs, sy + bd * vs], [sx0 + sw - bw * hs, sy + D * vs], [sx0 + bw * hs, sy + D * vs], [sx0 + bw * hs, sy + bd * vs], [sx0, sy + bd * vs]]
    : [[sx0, sy], [sx0 + sw, sy], [sx0 + sw, sy + D * vs], [sx0, sy + D * vs]];
  items.push({ t: 'poly', pts, fill: 'slab' });
  items.push({ t: 'dim', x1: sx0 + sw + 14, y1: sy, x2: sx0 + sw + 14, y2: sy + D * vs, label: f.mm(D) });
  if (edge) {
    items.push({ t: 'dim', x1: sx0 - 14, y1: sy, x2: sx0 - 14, y2: sy + bd * vs, label: f.mm(bd), side: -1 });
    items.push({ t: 'dim', x1: sx0, y1: sy + bd * vs + 14, x2: sx0 + bw * hs, y2: sy + bd * vs + 14, label: f.mm(bw) });
  }
  return { title: 'Slab layout', w: W, h: sy + deep * vs + 34, items, legend: edge ? [{ fill: 'slab', label: 'Concrete' }, { fill: 'paper', label: 'Inside the edge beam' }] : undefined };
}

function footing(v: Values, f: Fmt): Diagram | null {
  const Wd = n(v, 'width'), D = n(v, 'depth'), L = n(v, 'length');
  if (!ok(Wd, D, L)) return null;
  const { s, ox, oy } = fit(Wd, D, W - 120, 120);
  const x0 = 60 + ox, y0 = 20 + oy;
  const items: Item[] = [
    { t: 'line', x1: 10, y1: y0, x2: W - 10, y2: y0, kind: 'ground' },
    { t: 'rect', x: x0, y: y0, w: Wd * s, h: D * s, fill: 'slab', stroke: true },
    { t: 'dim', x1: x0, y1: y0 + D * s + 14, x2: x0 + Wd * s, y2: y0 + D * s + 14, label: f.mm(Wd) },
    { t: 'dim', x1: x0 + Wd * s + 14, y1: y0, x2: x0 + Wd * s + 14, y2: y0 + D * s, label: f.mm(D) },
    { t: 'text', x: W / 2, y: 12, s: v.shape === 'pads' ? `Each pad ${f.mm(L)} long` : `Runs ${f.len(L)}`, anchor: 'middle', kind: 'muted', size: 's' },
  ];
  return { title: 'Footing section', w: W, h: y0 + D * s + 34, items };
}

function pier(v: Values, f: Fmt): Diagram | null {
  const d = n(v, 'diameter'), h = n(v, 'depth');
  if (!ok(d, h)) return null;
  const { s, ox } = fit(d, h, 120, 150);
  const x0 = 100 + ox, y0 = 24, pw = d * s, ph = h * s, e = Math.max(4, pw * 0.18);
  return {
    title: 'Pier', w: W, h: y0 + ph + e + 34,
    items: [
      { t: 'line', x1: 20, y1: y0, x2: W - 20, y2: y0, kind: 'ground' },
      { t: 'rect', x: x0, y: y0, w: pw, h: ph, fill: 'slab', stroke: true },
      { t: 'poly', pts: Array.from({ length: 24 }, (_, i) => [x0 + pw / 2 + (pw / 2) * Math.cos((i / 24) * 2 * Math.PI), y0 + ph + e * Math.sin((i / 24) * 2 * Math.PI) * 0.5] as [number, number]), fill: 'slab' },
      { t: 'dim', x1: x0, y1: y0 - 12, x2: x0 + pw, y2: y0 - 12, label: `⌀ ${f.mm(d)}`, side: -1 },
      { t: 'dim', x1: x0 + pw + 16, y1: y0, x2: x0 + pw + 16, y2: y0 + ph, label: f.len(h) },
    ],
  };
}

function steps(v: Values, f: Fmt): Diagram | null {
  const N = Math.round(n(v, 'steps')), R = n(v, 'rise'), G = n(v, 'going');
  if (!ok(N, R, G) || N > 60) return null;
  const { s } = fit(N * G, N * R, W - 80, 150);
  const x0 = 40, base = 20 + N * R * s;
  const pts: [number, number][] = [[x0, base]];
  for (let k = 0; k < N; k++) {
    pts.push([x0 + k * G * s, base - (k + 1) * R * s]);
    pts.push([x0 + (k + 1) * G * s, base - (k + 1) * R * s]);
  }
  pts.push([x0 + N * G * s, base]);
  return {
    title: 'Steps profile', w: W, h: base + 34,
    items: [
      { t: 'line', x1: 10, y1: base, x2: W - 10, y2: base, kind: 'ground' },
      { t: 'poly', pts, fill: 'slab' },
      { t: 'dim', x1: x0, y1: base + 14, x2: x0 + G * s, y2: base + 14, label: f.mm(G) },
      { t: 'dim', x1: x0 - 14, y1: base - R * s, x2: x0 - 14, y2: base, label: f.mm(R), side: -1 },
      { t: 'text', x: x0 + N * G * s, y: base - N * R * s - 6, s: `${N} steps`, anchor: 'end', kind: 'muted', size: 's' },
    ],
  };
}

function custom(v: Values, f: Fmt): Diagram | null {
  const shapes = (Array.isArray(v.shapes) ? (v.shapes as Shape[]) : []).filter(sh => ok(sh.a ?? NaN) && (sh.kind === 'circle' || ok(sh.b ?? NaN))).slice(0, 8);
  if (!shapes.length) return null;
  const dims = shapes.map(sh => (sh.kind === 'circle' ? [sh.a!, sh.a!] : [sh.a!, sh.b!]) as [number, number]);
  const totalW = dims.reduce((a, d) => a + d[0], 0) + (dims.length - 1) * 0.15 * Math.max(...dims.map(d => d[0]));
  const maxH = Math.max(...dims.map(d => d[1]));
  const { s } = fit(totalW, maxH, W - 20, 130);
  const items: Item[] = [];
  let x = 10;
  const yb = 20 + maxH * s;
  shapes.forEach((sh, i) => {
    const [a, b] = dims[i]!;
    const fill: Fill = sh.subtract ? 'paper' : 'slab';
    if (sh.kind === 'rect') items.push({ t: 'rect', x, y: yb - b * s, w: a * s, h: b * s, fill, stroke: true, dash: !!sh.subtract });
    else if (sh.kind === 'tri') items.push({ t: 'poly', pts: [[x, yb], [x + a * s, yb], [x, yb - b * s]], fill, dash: !!sh.subtract });
    else items.push({ t: 'circle', cx: x + (a * s) / 2, cy: yb - (a * s) / 2, r: (a * s) / 2, fill });
    items.push({ t: 'text', x: x + (a * s) / 2, y: yb + 16, s: sh.kind === 'circle' ? `⌀${f.len(a)}` : `${f.len(a)} × ${f.len(b)}`, anchor: 'middle', kind: sh.subtract ? 'muted' : 'ink', size: 's' });
    x += a * s + 0.15 * Math.max(...dims.map(d => d[0])) * s;
  });
  return { title: 'Shapes', w: W, h: yb + 30, items, legend: shapes.some(sh => sh.subtract) ? [{ fill: 'slab', label: 'Added' }, { fill: 'paper', label: 'Cut out' }] : undefined };
}

/** Mesh sheet layout with laps, cut sheets and chairs, plus a cut list. */
export function meshLayout(L: number, Wd: number, edge: number, SL: number, SW: number, lap: number, rotated: boolean) {
  const ml = L - 2 * edge, mw = Wd - 2 * edge;
  const [sa, sb] = rotated ? [SW, SL] : [SL, SW];
  const along = piecesForRun(ml, sa, lap), across = piecesForRun(mw, sb, lap);
  // Sheets start at one corner; each next one overlaps the last by the lap; the last row/column is cut to fit.
  const xs = Array.from({ length: along }, (_, i) => i * (sa - lap));
  const ys = Array.from({ length: across }, (_, j) => j * (sb - lap));
  const lastW = ml - xs[along - 1]!, lastH = mw - ys[across - 1]!;
  return { ml, mw, sa, sb, along, across, xs, ys, cutAlong: lastW < sa - 1e-6 ? lastW : null, cutAcross: lastH < sb - 1e-6 ? lastH : null };
}

function mesh(v: Values, f: Fmt, run: Extract<Run, { ok: true }>): Diagram | null {
  const L = n(v, 'length'), Wd = n(v, 'width'), e = n(v, 'edge'), SL = n(v, 'sheetLength'), SW = n(v, 'sheetWidth'), lap = n(v, 'lap'), cs = n(v, 'chairSpacing');
  if (!ok(L, Wd, SL, SW, cs) || !(e >= 0) || !(lap >= 0)) return null;
  const rotated = /across the slab/.test(run.notes.join(' '));
  const g = meshLayout(L, Wd, e, SL, SW, lap, rotated);
  if (g.along * g.across > 400) return null;
  const { s, ox } = fit(L, Wd, W - 50, 190);
  const x0 = 30 + ox, y0 = 14;
  const items: Item[] = [{ t: 'rect', x: x0, y: y0, w: L * s, h: Wd * s, fill: 'paper', stroke: true }];
  const mx = x0 + e * s, my = y0 + e * s;
  g.ys.forEach((yy, j) => g.xs.forEach((xx, i) => {
    const w = Math.min(g.sa, g.ml - xx), h = Math.min(g.sb, g.mw - yy);
    const cut = w < g.sa - 1e-6 || h < g.sb - 1e-6;
    items.push({ t: 'rect', x: mx + xx * s, y: my + yy * s, w: w * s, h: h * s, fill: cut ? 'amberSoft' : 'steel', stroke: true, dash: cut });
    void i;
  }));
  // Chairs: one per spacing cell, at cell centres (as the calculator counts them)
  const cx = Math.ceil(g.ml / cs - 1e-9), cy = Math.ceil(g.mw / cs - 1e-9);
  if (cx * cy <= 600) for (let i = 0; i < cx; i++) for (let j = 0; j < cy; j++) items.push({ t: 'circle', cx: mx + ((i + 0.5) * g.ml) / cx * s, cy: my + ((j + 0.5) * g.mw) / cy * s, r: 1.8, fill: 'amber' });
  items.push({ t: 'dim', x1: x0, y1: y0 + Wd * s + 14, x2: x0 + L * s, y2: y0 + Wd * s + 14, label: f.len(L) });
  items.push({ t: 'dim', x1: x0 - 14, y1: y0, x2: x0 - 14, y2: y0 + Wd * s, label: f.len(Wd), side: -1 });
  const full = g.along * g.across - (g.cutAlong ? g.across : 0) - (g.cutAcross ? g.along : 0) + (g.cutAlong && g.cutAcross ? 1 : 0);
  const rows: [string, string][] = [['Full sheets', `${full}`]];
  if (g.cutAlong) rows.push([`Cut to ${f.len(g.cutAlong)} long`, `${g.across - (g.cutAcross ? 1 : 0)}`]);
  if (g.cutAcross) rows.push([`Cut to ${f.len(g.cutAcross)} wide`, `${g.along - (g.cutAlong ? 1 : 0)}`]);
  if (g.cutAlong && g.cutAcross) rows.push([`Cut to ${f.len(g.cutAlong)} × ${f.len(g.cutAcross)}`, '1']);
  rows.push(['Laps', f.mm(lap)]);
  return {
    title: 'Sheet layout', w: W, h: y0 + Wd * s + 34, items,
    legend: [{ fill: 'steel', label: 'Full sheet' }, { fill: 'amberSoft', label: 'Cut sheet' }, { fill: 'amber', label: 'Chair' }],
    list: { title: 'Cut list', rows },
  };
}

function lengthsDiagram(title: string, L: number, S: number, lap: number, f: Fmt, laps: string): Diagram | null {
  if (!ok(L, S) || !(lap >= 0) || lap >= S) return null;
  const k = piecesForRun(L, S, lap);
  if (k > 40) return null;
  const s = (W - 40) / L;
  const items: Item[] = [];
  for (let i = 0; i < k; i++) {
    const x = 20 + i * (S - lap) * s, len = Math.min(S, L - i * (S - lap));
    items.push({ t: 'rect', x, y: 30 + (i % 2) * 10, w: len * s, h: 7, fill: len < S - 1e-6 ? 'amberSoft' : 'steel', stroke: true });
  }
  items.push({ t: 'dim', x1: 20, y1: 64, x2: W - 20, y2: 64, label: f.len(L) });
  items.push({ t: 'text', x: 20, y: 18, s: `${k} lengths of ${f.len(S)}, ${laps} ${f.mm(lap)}`, kind: 'muted', size: 's' });
  const last = L - (k - 1) * (S - lap);
  return { title, w: W, h: 84, items, list: { title: 'Per line', rows: [['Full lengths', `${last < S - 1e-6 ? k - 1 : k}`], ...(last < S - 1e-6 ? [[`Cut to ${f.len(last)}`, '1'] as [string, string]] : [])] } };
}

function formworkD(v: Values, f: Fmt): Diagram | null {
  if (v.outline === 'custom') return null;
  const L = n(v, 'length'), Wd = n(v, 'width'), B = n(v, 'boardLength'), ps = n(v, 'pegSpacing');
  if (!ok(L, Wd, B, ps)) return null;
  const { s, ox } = fit(L, Wd, W - 60, 150);
  const x0 = 30 + ox, y0 = 14, pw = L * s, ph = Wd * s;
  const items: Item[] = [{ t: 'rect', x: x0, y: y0, w: pw, h: ph, fill: 'paper', stroke: true }];
  const side = (ax: number, ay: number, bx: number, by: number, len: number) => {
    const k = Math.ceil(len / B - 1e-9);
    for (let i = 0; i < k; i++) {
      const t0 = (i * B) / len, t1 = Math.min(1, ((i + 1) * B) / len);
      items.push({ t: 'line', x1: ax + (bx - ax) * t0, y1: ay + (by - ay) * t0, x2: ax + (bx - ax) * t1, y2: ay + (by - ay) * t1, kind: i % 2 ? 'edge' : 'amber' });
    }
    const p = Math.ceil(len / ps - 1e-9);
    for (let i = 0; i <= p; i++) items.push({ t: 'circle', cx: ax + ((bx - ax) * i) / p, cy: ay + ((by - ay) * i) / p, r: 2.2, fill: 'slab' });
  };
  side(x0, y0, x0 + pw, y0, L); side(x0 + pw, y0, x0 + pw, y0 + ph, Wd); side(x0 + pw, y0 + ph, x0, y0 + ph, L); side(x0, y0 + ph, x0, y0, Wd);
  items.push({ t: 'dim', x1: x0, y1: y0 + ph + 14, x2: x0 + pw, y2: y0 + ph + 14, label: f.len(L) });
  items.push({ t: 'dim', x1: x0 - 14, y1: y0, x2: x0 - 14, y2: y0 + ph, label: f.len(Wd), side: -1 });
  return { title: 'Form layout', w: W, h: y0 + ph + 34, items, legend: [{ fill: 'amber', label: `Boards (${f.len(B)})` }, { fill: 'slab', label: 'Pegs' }] };
}

function fallsD(run: Extract<Run, { ok: true }>, v: Values, f: Fmt): Diagram | null {
  const L = n(v, 'run');
  const drop = run.headline.value;
  if (!ok(L, drop)) return null;
  const vs = Math.min(60 / drop, 4000), s = (W - 60) / L;
  const x0 = 30, y0 = 26;
  const items: Item[] = [
    { t: 'line', x1: x0, y1: y0, x2: x0 + L * s, y2: y0, kind: 'string' },
    { t: 'text', x: x0, y: y0 - 8, s: 'Level string line', kind: 'muted', size: 's' },
    { t: 'poly', pts: [[x0, y0 + 10], [x0 + L * s, y0 + 10 + drop * vs], [x0 + L * s, y0 + 10 + drop * vs + 14], [x0, y0 + 24]], fill: 'slab' },
  ];
  const rows = run.table?.rows ?? [];
  const stations = [{ at: 0, below: 0 }, ...rows.map(([a, b]) => ({ at: a.value, below: b.value }))].slice(0, 12);
  for (const st of stations) {
    const x = x0 + st.at * s;
    items.push({ t: 'line', x1: x, y1: y0 - 3, x2: x, y2: y0 + 10 + st.below * vs, kind: 'dash' });
    items.push({ t: 'rect', x: x - 2, y: y0 - 6, w: 4, h: 10, fill: 'amber' });
  }
  items.push({ t: 'dim', x1: x0 + L * s + 14, y1: y0 + 10, x2: x0 + L * s + 14, y2: y0 + 10 + drop * vs, label: f.mm(drop) });
  items.push({ t: 'dim', x1: x0, y1: y0 + 46 + drop * vs, x2: x0 + L * s, y2: y0 + 46 + drop * vs, label: f.len(L) });
  return { title: 'Fall profile (height exaggerated)', w: W, h: y0 + 66 + drop * vs, items };
}

function paversD(v: Values, f: Fmt): Diagram | null {
  const pl = n(v, 'paverLength'), pw = n(v, 'paverWidth'), j = n(v, 'joint');
  if (!ok(pl, pw) || !(j >= 0)) return null;
  // A 1 m-ish swatch in stretcher bond, to scale.
  const areaW = Math.max(pl * 4, 1), areaH = Math.max(pw * 4, 0.6);
  const { s } = fit(areaW, areaH, W - 40, 150);
  const items: Item[] = [{ t: 'rect', x: 20, y: 14, w: areaW * s, h: areaH * s, fill: 'gravel', stroke: true }];
  const rowsN = Math.min(40, Math.ceil(areaH / (pw + j)));
  const colsN = Math.min(40, Math.ceil(areaW / (pl + j)) + 1);
  for (let r = 0; r < rowsN; r++) {
    const off = r % 2 ? (pl + j) / 2 : 0;
    for (let c = -1; c < colsN; c++) {
      const x = c * (pl + j) - off, y = r * (pw + j);
      const x1 = Math.max(0, x), x2 = Math.min(areaW, x + pl), y2 = Math.min(areaH, y + pw);
      if (x2 <= x1 || y >= areaH) continue;
      items.push({ t: 'rect', x: 20 + x1 * s, y: 14 + y * s, w: (x2 - x1) * s, h: (y2 - y) * s, fill: 'slab' });
    }
  }
  items.push({ t: 'dim', x1: 20, y1: 14 + areaH * s + 14, x2: 20 + areaW * s, y2: 14 + areaH * s + 14, label: f.len(areaW) });
  items.push({ t: 'text', x: W - 20, y: 10, s: `${f.mm(pl)} × ${f.mm(pw)}, ${f.mm(j)} joints`, anchor: 'end', kind: 'muted', size: 's' });
  return { title: 'Paving preview (stretcher bond)', w: W, h: 14 + areaH * s + 34, items };
}

function retainingD(v: Values, f: Fmt, run: Extract<Run, { ok: true }>): Diagram | null {
  const H = n(v, 'height'), b = n(v, 'buried'), bl = n(v, 'blockLength'), bh = n(v, 'blockHeight'), bd = n(v, 'blockDepth'), dw = n(v, 'drainWidth'), cap = n(v, 'capLength');
  if (!ok(H, bl, bh, bd) || !(b >= 0)) return null;
  const courses = Math.ceil((H + b) / bh - 1e-9);
  if (courses > 40) return null;
  const wallH = courses * bh + (cap > 0 ? bh * 0.5 : 0);
  // Elevation: 2.4 m of wall, running bond
  const showL = Math.max(bl * 4, 1.6);
  const { s } = fit(showL, wallH, 180, 150);
  const x0 = 14, base = 20 + wallH * s, groundY = base - b * s;
  const items: Item[] = [{ t: 'text', x: x0, y: 12, s: 'ELEVATION', kind: 'muted', size: 's' }];
  for (let c = 0; c < courses; c++) {
    const off = c % 2 ? bl / 2 : 0;
    for (let k = -1; k * bl - off < showL; k++) {
      const x1 = Math.max(0, k * bl - off), x2 = Math.min(showL, (k + 1) * bl - off);
      if (x2 <= x1) continue;
      items.push({ t: 'rect', x: x0 + x1 * s, y: base - (c + 1) * bh * s, w: (x2 - x1) * s, h: bh * s, fill: 'slab', stroke: true });
    }
  }
  if (cap > 0) items.push({ t: 'rect', x: x0, y: base - courses * bh * s - bh * 0.5 * s, w: showL * s, h: bh * 0.5 * s, fill: 'amberSoft', stroke: true });
  items.push({ t: 'line', x1: 4, y1: groundY, x2: x0 + showL * s + 6, y2: groundY, kind: 'ground' });
  items.push({ t: 'dim', x1: x0 + showL * s + 12, y1: base - courses * bh * s, x2: x0 + showL * s + 12, y2: groundY, label: f.mm(H) });
  // Section: block depth + drainage gravel + ag pipe
  const sx = 230, ss = Math.min(60 / Math.max(bd + dw, 0.1), s);
  items.push({ t: 'text', x: sx, y: 12, s: 'SECTION', kind: 'muted', size: 's' });
  items.push({ t: 'rect', x: sx, y: base - courses * bh * s, w: bd * ss, h: courses * bh * s, fill: 'slab', stroke: true });
  if (dw > 0) items.push({ t: 'rect', x: sx + bd * ss, y: base - courses * bh * s, w: dw * ss, h: courses * bh * s, fill: 'gravel', stroke: true });
  items.push({ t: 'circle', cx: sx + bd * ss + Math.max(dw * ss, 8) / 2, cy: base - 6, r: 4, fill: 'amber' });
  items.push({ t: 'line', x1: sx - 6, y1: groundY, x2: sx + bd * ss, y2: groundY, kind: 'ground' });
  items.push({ t: 'text', x: W / 2, y: base + 22, s: `${courses} courses × ${run.outputs.length ? '' : ''}${f.mm(bh)}, ${f.mm(b)} buried`, anchor: 'middle', kind: 'muted', size: 's' });
  return { title: 'Wall', w: W, h: base + 34, items, legend: [{ fill: 'slab', label: 'Blocks' }, ...(cap > 0 ? [{ fill: 'amberSoft' as Fill, label: 'Caps' }] : []), { fill: 'gravel', label: 'Drainage gravel' }, { fill: 'amber', label: 'Drain pipe' }] };
}

function orderD(run: Extract<Run, { ok: true }>, f: Fmt): Diagram | null {
  const loads = run.outputs.filter(o => /truck/i.test(o.label) && o.kind === 'vol');
  if (!loads.length) return null;
  const items: Item[] = [];
  let y = 10;
  const max = Math.max(...loads.map(l => l.value));
  for (const l of loads.slice(0, 4)) {
    items.push({ t: 'rect', x: 120, y, w: (l.value / max) * (W - 140), h: 16, fill: 'amber', stroke: true });
    items.push({ t: 'text', x: 0, y: y + 12, s: l.label, kind: 'ink', size: 's' });
    y += 26;
  }
  void f;
  return { title: 'Loads', w: W, h: y + 4, items };
}

function weatherD(run: Extract<Run, { ok: true }>): Diagram | null {
  const E = run.headline.value;
  const max = 1.5, x0 = 10, x1 = W - 10, s = (x1 - x0) / max;
  const at = Math.min(max, Math.max(0, E));
  return {
    title: 'Evaporation scale (kg/m²/h)', w: W, h: 56,
    items: [
      { t: 'rect', x: x0, y: 14, w: 0.5 * s, h: 12, fill: 'steel' },
      { t: 'rect', x: x0 + 0.5 * s, y: 14, w: 0.5 * s, h: 12, fill: 'amberSoft' },
      { t: 'rect', x: x0 + 1 * s, y: 14, w: 0.5 * s, h: 12, fill: 'amber' },
      { t: 'poly', pts: [[x0 + at * s, 30], [x0 + at * s - 6, 40], [x0 + at * s + 6, 40]], fill: 'slab' },
      { t: 'text', x: x0, y: 52, s: '0', kind: 'muted', size: 's' },
      { t: 'text', x: x0 + 0.5 * s, y: 52, s: '0.5 act', anchor: 'middle', kind: 'muted', size: 's' },
      { t: 'text', x: x0 + 1 * s, y: 52, s: '1.0 high', anchor: 'middle', kind: 'muted', size: 's' },
    ],
  };
}

/** The diagram for a tool, or null when it has none or the inputs can't be drawn. */
export function diagramFor(toolId: string, v: Values, run: Run | null, f: Fmt): Diagram | null {
  if (!run || !run.ok) return null;
  switch (toolId) {
    case 'slab': return slab(v, f);
    case 'footing': return footing(v, f);
    case 'pier': return pier(v, f);
    case 'steps': return steps(v, f);
    case 'custom': return custom(v, f);
    case 'mesh': return mesh(v, f, run);
    case 'bars': return lengthsDiagram('One line of bar', n(v, 'runLength'), n(v, 'stockLength'), n(v, 'lap'), f, 'lapped');
    case 'trench': return lengthsDiagram('Trench mesh, one layer', n(v, 'totalLength'), n(v, 'stockLength'), n(v, 'lap'), f, 'end laps');
    case 'formwork': return formworkD(v, f);
    case 'falls': return fallsD(run, v, f);
    case 'pavers': return paversD(v, f);
    case 'retaining': return retainingD(v, f, run);
    case 'order': return orderD(run, f);
    case 'weather': return weatherD(run);
    default: return null;
  }
}
