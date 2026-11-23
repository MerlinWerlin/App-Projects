/**
 * True-scale printable templates, tiled over as many sheets as needed.
 * Every page carries a 100 mm calibration ruler (plus a 4 in ruler in imperial mode) so the print scale can be
 * checked with a tape before anything is marked out.
 */
import { lobster, mitreCutBack, type LobsterInput } from './lobster.ts';
import { PAPER, PdfDoc, type Page, type PaperId } from './pdf.ts';
import { pcd, type PcdInput } from './pcd.ts';
import { saddle, saddleT, contactRadius, type SaddleInput } from './saddle.ts';
import { DEG, fmt, inchFraction, MM_PER_IN, type UnitSystem } from './units.ts';

export const MARGIN = 10; // mm, unprintable edge most printers need (≥ 6 mm)
export const HEADER = 34; // mm band for title, notes and ruler
export const RULER_MM = 100;

export interface TileLayout {
  paper: PaperId;
  landscape: boolean;
  pageW: number;
  pageH: number;
  areaW: number; // drawing area per page, mm
  areaH: number;
  cols: number;
  rows: number;
  /** Page-space position of the 100 mm ruler's zero tick (mm from the top-left). */
  ruler: { x: number; y: number; length: number };
}

export function planTiles(contentW: number, contentH: number, paper: PaperId, landscape?: boolean): TileLayout {
  const options = (landscape === undefined ? [true, false] : [landscape]).map(ls => {
    const p = PAPER[paper];
    const pageW = ls ? p.h : p.w;
    const pageH = ls ? p.w : p.h;
    const areaW = pageW - 2 * MARGIN;
    const areaH = pageH - 2 * MARGIN - HEADER;
    const cols = Math.max(1, Math.ceil(contentW / areaW - 1e-9));
    const rows = Math.max(1, Math.ceil(contentH / areaH - 1e-9));
    return { paper, landscape: ls, pageW, pageH, areaW, areaH, cols, rows, ruler: { x: MARGIN, y: MARGIN + HEADER - 6, length: RULER_MM } };
  });
  options.sort((a, b) => a.cols * a.rows - b.cols * b.rows || (a.landscape ? -1 : 1));
  return options[0];
}

function tileName(row: number, col: number): string {
  return `${String.fromCharCode(65 + (row % 26))}${col + 1}`;
}

function drawRulers(pg: Page, L: TileLayout, units: UnitSystem) {
  const { x, y } = L.ruler;
  pg.stroke(0.25, 0);
  pg.line(x, y, x + RULER_MM, y);
  for (let mm = 0; mm <= RULER_MM; mm++) {
    const t = mm % 10 === 0 ? 4 : mm % 5 === 0 ? 2.6 : 1.5;
    pg.line(x + mm, y, x + mm, y - t);
    if (mm % 10 === 0) pg.text(x + mm, y - 4.8, 6, String(mm / 10), { align: 'center' });
  }
  pg.text(x + RULER_MM + 2, y - 0.5, 7, '100 mm', { bold: true });
  if (units === 'imperial') {
    const ix = x + RULER_MM + 18;
    const inchLen = 4 * MM_PER_IN;
    if (ix + inchLen + 14 < L.pageW - MARGIN) {
      pg.line(ix, y, ix + inchLen, y);
      for (let e = 0; e <= 32; e++) {
        const t = e % 8 === 0 ? 4 : e % 4 === 0 ? 2.8 : e % 2 === 0 ? 2 : 1.3;
        pg.line(ix + (e * MM_PER_IN) / 8, y, ix + (e * MM_PER_IN) / 8, y - t);
        if (e % 8 === 0) pg.text(ix + (e * MM_PER_IN) / 8, y - 4.8, 6, String(e / 8), { align: 'center' });
      }
      pg.text(ix + inchLen + 2, y - 0.5, 7, '4 in', { bold: true });
    }
  }
}

export interface TiledInput {
  title: string;
  lines: string[]; // up to 3 short lines under the title
  contentW: number;
  contentH: number;
  paper: PaperId;
  units: UnitSystem;
  landscape?: boolean;
  draw: (pg: Page) => void; // content in mm from the content's own top-left
}

export function tiledDocument(i: TiledInput): { doc: PdfDoc; layout: TileLayout } {
  const L = planTiles(i.contentW, i.contentH, i.paper, i.landscape);
  const doc = new PdfDoc(i.title);
  const total = L.cols * L.rows;
  for (let row = 0; row < L.rows; row++) {
    for (let col = 0; col < L.cols; col++) {
      const pg = doc.addPage(L.pageW, L.pageH);
      const ax = MARGIN;
      const ay = MARGIN + HEADER;
      pg.fillGray(0);
      pg.text(MARGIN, MARGIN + 4, 12, i.title, { bold: true });
      pg.text(L.pageW - MARGIN, MARGIN + 4, 9, total > 1 ? `Sheet ${tileName(row, col)}  (${row * L.cols + col + 1} of ${total})` : 'Sheet 1 of 1', { align: 'right', bold: true });
      i.lines.slice(0, 3).forEach((s, k) => pg.text(MARGIN, MARGIN + 9 + k * 3.6, 7, s));
      pg.text(MARGIN, MARGIN + HEADER - 14.5, 7, 'PRINT AT 100 % / ACTUAL SIZE (not "fit to page"). The ruler below must measure exactly 100 mm. Check it before you mark the job.', { bold: true });
      drawRulers(pg, L, i.units);
      // Trim line round the drawing area.
      pg.stroke(0.2, 0.55, [2, 1.5]);
      pg.rect(ax, ay, L.areaW, L.areaH);
      if (total > 1) {
        pg.fillGray(0.35);
        if (col < L.cols - 1) pg.text(L.pageW - MARGIN + 1.5, ay + L.areaH / 2, 6, `Tape to ${tileName(row, col + 1)}`, { rotate90: true });
        if (row < L.rows - 1) pg.text(ax + L.areaW / 2, L.pageH - MARGIN + 4, 6, `Tape to ${tileName(row + 1, col)} below`, { align: 'center' });
        if (col > 0) pg.text(ax + 1, ay + L.areaH - 1.5, 5.5, `Trim this edge, lay on ${tileName(row, col - 1)}`);
        pg.fillGray(0);
      }
      pg.beginClip(ax, ay, L.areaW, L.areaH, ax - col * L.areaW, ay - row * L.areaH);
      pg.stroke(0.35, 0);
      i.draw(pg);
      pg.endClip();
    }
  }
  return { doc, layout: L };
}

/* ---------------- Wrap-around templates (saddle and mitre) ---------------- */

const TOP = 14; // label band above the pipe-end line, mm
const BELOW = 22; // from the deepest point to the straight wrap line
const FOOT = 12;
const OVERLAP = 12;
export const LEFT = 7; // inset so the 0° labels are not cut off at the sheet edge

interface WrapSpec {
  title: string;
  lines: string[];
  odMm: number;
  depthAt: (phiRad: number) => number;
  maxDepth: number;
  divisions: number;
  labels: (deg: number) => string | null;
  units: UnitSystem;
  paper: PaperId;
}

export interface WrapGeometry { pipeEndY: number; baseY: number; circumference: number; left: number }

export function wrapGeometry(maxDepth: number, od: number): WrapGeometry {
  return { pipeEndY: TOP, baseY: TOP + maxDepth + BELOW, circumference: Math.PI * od, left: LEFT };
}

function wrapTemplate(s: WrapSpec) {
  const g = wrapGeometry(s.maxDepth, s.odMm);
  const C = g.circumference;
  const ro = s.odMm / 2;
  const W = C + OVERLAP;
  const X0 = LEFT;
  const H = g.baseY + FOOT;
  const curve = (from: number, to: number): [number, number][] => {
    const pts: [number, number][] = [];
    const steps = Math.max(8, Math.ceil((to - from) / 0.5)); // a point every ~0.5 mm of circumference
    for (let k = 0; k <= steps; k++) {
      const x = from + ((to - from) * k) / steps;
      pts.push([X0 + x, g.pipeEndY + s.depthAt(x / ro)]);
    }
    return pts;
  };
  return tiledDocument({
    title: s.title,
    lines: s.lines,
    contentW: X0 + W,
    contentH: H,
    paper: s.paper,
    units: s.units,
    landscape: true,
    draw: pg => {
      // Pipe end and wrap line.
      pg.stroke(0.3, 0.4, [3, 2]);
      pg.line(X0, g.pipeEndY, X0 + C, g.pipeEndY);
      pg.stroke(0.5, 0);
      pg.line(X0, g.baseY, X0 + W, g.baseY);
      pg.line(X0, g.pipeEndY - 4, X0, g.baseY + 4);
      pg.line(X0 + C, g.pipeEndY - 4, X0 + C, g.baseY + 4);
      // Ordinate lines.
      for (let k = 0; k <= s.divisions; k++) {
        const deg = (360 * k) / s.divisions;
        const x = X0 + ro * deg * DEG;
        const h = s.depthAt(deg * DEG);
        const quarter = s.labels(deg);
        pg.stroke(quarter ? 0.3 : 0.15, quarter ? 0.2 : 0.55, quarter ? undefined : [1.2, 1.2]);
        pg.line(x, g.pipeEndY, x, g.baseY);
        pg.fillGray(0.25);
        pg.text(x, g.pipeEndY - 1.5, 6, `${fmt(deg, deg % 1 ? 1 : 0)}°`, { align: 'center' });
        pg.text(x + 0.8, g.pipeEndY + h + 3.5, 5.5, s.units === 'imperial' ? `${inchFraction(h / MM_PER_IN)}"` : fmt(h, 1));
        if (quarter) pg.text(x, g.pipeEndY - 6.5, 7, quarter, { align: 'center', bold: true });
        pg.fillGray(0);
      }
      // The cut line, heavy, and the overlap continuation, dashed.
      pg.stroke(0.6, 0);
      pg.polyline(curve(0, C));
      pg.stroke(0.4, 0.4, [2, 1.5]);
      pg.polyline(curve(C, W));
      pg.fillGray(0.3);
      pg.text(X0 + C + 1, g.baseY - 2, 5.5, 'overlap');
      pg.fillGray(0);
      pg.text(X0, g.baseY + 4.5, 6.5, 'WRAP LINE: keep this edge square round the pipe. Cut the paper on the heavy curve, wrap it with the 0° and 360° lines meeting, and scribe along the curve.', { bold: true });
      pg.text(X0, g.baseY + 8.5, 6, 'Waste is between the curve and the pipe end (top). Numbers on the curve = cut-back from a square pipe end. VERIFY BEFORE CUTTING: check one ordinate with a tape.');
    },
  });
}

export function saddleQuarterLabel(deg: number, angleDeg: number): string | null {
  const d = Math.round(deg * 1000) / 1000;
  if (d === 0 || d === 180 || d === 360) return 'SIDE';
  if (d === 90) return angleDeg >= 90 ? 'CROTCH' : 'HEEL';
  if (d === 270) return angleDeg >= 90 ? 'CROTCH' : 'TOE';
  return null;
}

export function saddleTemplate(i: SaddleInput, units: UnitSystem, paper: PaperId) {
  const r = saddle(i);
  if (!r.ok) return r;
  const R = i.headerOD / 2;
  const rc = contactRadius(i);
  const th = i.angleDeg * DEG;
  const tMin = r.value.tMin;
  const L = (mm: number) => (units === 'imperial' ? `${fmt(mm / MM_PER_IN, 3)} in` : `${fmt(mm, 1)} mm`);
  const out = wrapTemplate({
    title: `Saddle template: ${L(i.branchOD)} branch on ${L(i.headerOD)} header`,
    lines: [
      `Branch angle ${fmt(i.angleDeg, 1)}°, offset ${L(i.offset)}, line worked on the ${i.contact} of the branch wall${i.contact === 'inside' ? ` (wall ${L(i.branchWall)})` : ''}.`,
      `Template width = branch circumference ${L(r.value.circumference)}. Deepest cut ${L(r.value.maxDepth)}.`,
      'Made with Rootpass. Check fit-up on the job; the welder is responsible for the final cut.',
    ],
    odMm: i.branchOD,
    depthAt: phi => saddleT(phi, R, rc, i.offset, th) - tMin,
    maxDepth: r.value.maxDepth,
    divisions: i.divisions ?? 16,
    labels: deg => saddleQuarterLabel(deg, i.angleDeg),
    units,
    paper,
  });
  return { ok: true as const, value: { ...out, saddle: r.value } };
}

export function mitreTemplate(i: LobsterInput, units: UnitSystem, paper: PaperId) {
  const r = lobster(i);
  if (!r.ok) return r;
  const beta = r.value.cutDeg * DEG;
  const L = (mm: number) => (units === 'imperial' ? `${fmt(mm / MM_PER_IN, 3)} in` : `${fmt(mm, 1)} mm`);
  const out = wrapTemplate({
    title: `Mitre cut template: ${L(i.od)} OD at ${fmt(r.value.cutDeg, 2)}° off square`,
    lines: [
      `${i.pieces}-piece ${fmt(i.bendDeg, 1)}° bend, centreline radius ${L(i.radius)}. Each weld turns ${fmt(r.value.weldDeg, 2)}°.`,
      'Use for every cut face. Line the LONG SIDE (0°) up with the outside of the bend; turn middle pieces 180° for the other end.',
      'Made with Rootpass. Check fit-up on the job; the welder is responsible for the final cut.',
    ],
    odMm: i.od,
    depthAt: phi => mitreCutBack(phi, i.od, beta),
    maxDepth: r.value.cutDepth,
    divisions: 16,
    labels: deg => (deg === 0 || deg === 360 ? 'LONG SIDE' : deg === 180 ? 'SHORT SIDE' : deg === 90 || deg === 270 ? 'SIDE' : null),
    units,
    paper,
  });
  return { ok: true as const, value: { ...out, lobster: r.value } };
}

/* ---------------- Bolt circle drilling template ---------------- */

export function pcdTemplate(i: PcdInput, units: UnitSystem, paper: PaperId) {
  const r = pcd(i);
  if (!r.ok) return r;
  const hole = i.holeDia && i.holeDia > 0 ? i.holeDia : 0;
  const pad = 12;
  const size = i.pcd + hole + 2 * pad;
  const c = size / 2;
  const L = (mm: number) => (units === 'imperial' ? `${fmt(mm / MM_PER_IN, 3)} in` : `${fmt(mm, 1)} mm`);
  const out = tiledDocument({
    title: `Bolt circle: ${i.holes} holes on ${L(i.pcd)} PCD`,
    lines: [
      `${i.layout === 'straddle' ? 'Holes straddle the centrelines' : 'First hole on the 12 o\'clock centreline'}${i.extraRotationDeg ? `, turned ${fmt(i.extraRotationDeg, 1)}°` : ''}. Holes ${hole ? L(hole) : 'marked as centres'}.`,
      `Check: neighbouring centres are ${L(r.value.chord)} apart. Centre-punch each cross, then drill.`,
      'Made with Rootpass. Check the print scale and the chord before drilling.',
    ],
    contentW: size,
    contentH: size,
    paper,
    units,
    draw: pg => {
      pg.stroke(0.2, 0.45, [3, 1.5]);
      pg.line(c, 4, c, size - 4);
      pg.line(4, c, size - 4, c);
      pg.circle(c, c, i.pcd / 2);
      pg.stroke(0.3, 0);
      pg.line(c - 4, c, c + 4, c);
      pg.line(c, c - 4, c, c + 4);
      pg.text(c + 2, c - 2, 6, 'CENTRE');
      for (const h of r.value.holes) {
        const x = c + h.x;
        const y = c - h.y; // Y up in the table, down on the page
        pg.stroke(0.35, 0);
        if (hole) pg.circle(x, y, hole / 2);
        const arm = Math.max(3, hole / 2 + 2);
        pg.stroke(0.2, 0);
        pg.line(x - arm, y, x + arm, y);
        pg.line(x, y - arm, x, y + arm);
        const lx = c + (h.x * (i.pcd / 2 + arm + 4)) / (i.pcd / 2);
        const ly = c - (h.y * (i.pcd / 2 + arm + 4)) / (i.pcd / 2);
        pg.text(lx, ly + 1.5, 7, String(h.n), { align: 'center', bold: true });
      }
    },
  });
  return { ok: true as const, value: { ...out, pcd: r.value, size, centre: c } };
}
