// Programmatic check of the printed scale: read the PDF back and measure the drawing in millimetres.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mitreCutBack } from './lobster.ts';
import { PAPER, PT_PER_MM, pdfString, toBase64 } from './pdf.ts';
import { saddleT } from './saddle.ts';
import { HEADER, MARGIN, mitreTemplate, pcdTemplate, saddleTemplate, wrapGeometry } from './templates.ts';

const DEG = Math.PI / 180;
const near = (a: number, b: number, tol: number, msg?: string) => assert.ok(Math.abs(a - b) <= tol, msg ?? `${a} ≉ ${b} (±${tol})`);
const latin1 = (b: Uint8Array) => Array.from(b, c => String.fromCharCode(c)).join('');

interface ParsedPage { w: number; h: number; ops: string }

function parsePdf(bytes: Uint8Array): ParsedPage[] {
  const s = latin1(bytes);
  assert.ok(s.startsWith('%PDF-1.4'));
  assert.ok(s.trimEnd().endsWith('%%EOF'));
  // Every xref offset must point at its object.
  const xrefAt = Number(/startxref\n(\d+)/.exec(s)![1]);
  assert.ok(s.slice(xrefAt).startsWith('xref'));
  const entries = [...s.slice(xrefAt).matchAll(/^(\d{10}) 00000 n $/gm)].map(m => Number(m[1]));
  entries.forEach((off, k) => assert.ok(s.slice(off).startsWith(`${k + 1} 0 obj`), `object ${k + 1} offset`));
  const pages: ParsedPage[] = [];
  for (const m of s.matchAll(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\][^]*?\/Contents (\d+) 0 R/g)) {
    const id = m[3];
    const body = new RegExp(`\\n${id} 0 obj\\n<< /Length (\\d+) >>\\nstream\\n`).exec(s)!;
    const start = body.index + body[0].length;
    const len = Number(body[1]);
    assert.equal(s.slice(start + len, start + len + 10), '\nendstream', 'stream length');
    pages.push({ w: Number(m[1]), h: Number(m[2]), ops: s.slice(start, start + len) });
  }
  return pages;
}

/** Content-space mm points of the polyline drawn right after a given stroke command, on a page. */
function polylineAfter(ops: string, strokeOp: string): [number, number][][] {
  const out: [number, number][][] = [];
  const lines = ops.split('\n');
  lines.forEach((l, k) => {
    if (l === strokeOp && lines[k + 1]?.endsWith(' S') && / l /.test(lines[k + 1])) {
      const nums = lines[k + 1].replace(/ [ml]/g, '').replace(/ S$/, '').trim().split(/\s+/).map(Number);
      const pts: [number, number][] = [];
      for (let j = 0; j < nums.length; j += 2) pts.push([nums[j], nums[j + 1]]);
      out.push(pts);
    }
  });
  return out;
}

const strokeOp = (mm: number, gray = 0) => `${Math.round(mm * PT_PER_MM * 1000) / 1000} w ${gray} G [] 0 d`;

test('1 mm is 72/25.4 pt and the 100 mm ruler is exactly 283.465 pt long on every sheet', () => {
  near(PT_PER_MM, 2.834645669, 1e-9);
  const t = saddleTemplate({ headerOD: 323.9, branchOD: 273.1, branchWall: 9.3, angleDeg: 90, offset: 0, contact: 'inside' }, 'metric', 'a4');
  assert.ok(t.ok);
  const pages = parsePdf(t.value.doc.toBytes());
  assert.ok(pages.length > 1, 'a 273 branch needs several sheets');
  for (const p of pages) {
    const { x, y } = t.value.layout.ruler;
    const x0 = Math.round(x * PT_PER_MM * 1000) / 1000;
    const x1 = Math.round((x + 100) * PT_PER_MM * 1000) / 1000;
    const yy = Math.round((p.h / PT_PER_MM - y) * PT_PER_MM * 1000) / 1000;
    assert.ok(p.ops.includes(`${x0} ${yy} m ${x1} ${yy} l S`), 'ruler line');
    near(x1 - x0, 283.465, 0.001);
    // 101 millimetre ticks.
    const ticks = p.ops.split('\n').filter(l => new RegExp(` ${yy} l S$`).test(l) === false && new RegExp(`^[\\d.]+ ${yy} m [\\d.]+ [\\d.]+ l S$`).test(l));
    assert.ok(ticks.length >= 101, `ticks ${ticks.length}`);
  }
});

test('A4 landscape and US Letter page sizes', () => {
  const a4 = saddleTemplate({ headerOD: 60.3, branchOD: 48.3, branchWall: 0, angleDeg: 90, offset: 0, contact: 'outside' }, 'metric', 'a4');
  assert.ok(a4.ok);
  const [p] = parsePdf(a4.value.doc.toBytes());
  near(p.w, 297 * PT_PER_MM, 0.001); // 841.89
  near(p.h, 210 * PT_PER_MM, 0.001); // 595.276
  const us = saddleTemplate({ headerOD: 60.3, branchOD: 48.3, branchWall: 0, angleDeg: 90, offset: 0, contact: 'outside' }, 'imperial', 'letter');
  assert.ok(us.ok);
  const [q] = parsePdf(us.value.doc.toBytes());
  near(q.w, 792, 0.001); // 11 in
  near(q.h, 612, 0.001); // 8.5 in
  assert.ok(q.ops.includes('(4 in) Tj'), 'imperial ruler');
});

test('the drawn saddle curve sits exactly on the cut-back equation, at true scale, across every sheet', () => {
  const input = { headerOD: 219.1, branchOD: 168.3, branchWall: 7.1, angleDeg: 60, offset: 15, contact: 'inside' as const };
  const t = saddleTemplate(input, 'metric', 'a4');
  assert.ok(t.ok);
  const L = t.value.layout;
  const g = wrapGeometry(t.value.saddle.maxDepth, input.branchOD);
  const R = input.headerOD / 2, rc = input.branchOD / 2 - input.branchWall, ro = input.branchOD / 2;
  const depth = (x: number) => saddleT(x / ro, R, rc, input.offset, input.angleDeg * DEG) - t.value.saddle.tMin;
  const pages = parsePdf(t.value.doc.toBytes());
  assert.equal(pages.length, L.cols * L.rows);
  let checked = 0;
  let maxX = 0;
  pages.forEach((p, k) => {
    const col = k % L.cols, row = Math.floor(k / L.cols);
    // Each sheet shifts the drawing by exactly one drawing-area width/height.
    const cm = /1 0 0 1 (-?[\d.]+) (-?[\d.]+) cm/.exec(p.ops)!;
    near(Number(cm[1]) / PT_PER_MM, MARGIN - col * L.areaW, 0.001);
    near(-Number(cm[2]) / PT_PER_MM, MARGIN + HEADER - row * L.areaH, 0.001);
    for (const line of polylineAfter(p.ops, strokeOp(0.6))) {
      for (const [X, Y] of line) {
        const cx = X / PT_PER_MM;
        const cy = p.h / PT_PER_MM - Y / PT_PER_MM; // content mm from the top (before the cm shift)
        near(cy, g.pipeEndY + depth(cx - g.left), 0.002, `x ${cx}`);
        maxX = Math.max(maxX, cx - g.left);
        checked++;
      }
    }
  });
  assert.ok(checked > 1000, `checked ${checked} points`);
  near(maxX, Math.PI * input.branchOD, 0.002); // curve spans exactly one circumference
  // Points no more than ~0.5 mm apart along the wrap.
  assert.ok(checked >= Math.PI * input.branchOD / 0.5);
});

test('mitre template: cut-back curve and depth', () => {
  const t = mitreTemplate({ od: 114.3, bendDeg: 90, pieces: 4, radius: 150 }, 'metric', 'a4');
  assert.ok(t.ok);
  const [p] = parsePdf(t.value.doc.toBytes());
  const g = wrapGeometry(t.value.lobster.cutDepth, 114.3);
  const lines = polylineAfter(p.ops, strokeOp(0.6));
  assert.equal(lines.length, 1);
  for (const [X, Y] of lines[0]) {
    const cx = X / PT_PER_MM, cy = p.h / PT_PER_MM - Y / PT_PER_MM;
    near(cy, g.pipeEndY + mitreCutBack((cx - g.left) / 57.15, 114.3, 15 * DEG), 0.002);
  }
});

test('bolt circle: hole circles have the right size and sit on the PCD', () => {
  const t = pcdTemplate({ pcd: 120, holes: 8, layout: 'straddle', holeDia: 18 }, 'metric', 'a4');
  assert.ok(t.ok);
  const pages = parsePdf(t.value.doc.toBytes());
  assert.equal(pages.length, 1);
  const circles = [...pages[0].ops.matchAll(/^(-?[\d.]+) (-?[\d.]+) m (?:(?:-?[\d.]+ ){6}c ){4}S$/gm)];
  assert.equal(circles.length, 1 + 8, 'PCD circle + 8 holes');
  const c = t.value.centre;
  const hMm = pages[0].h / PT_PER_MM;
  const holes = circles.map(m => [Number(m[1]) / PT_PER_MM, hMm - Number(m[2]) / PT_PER_MM]).slice(1);
  for (const [x, y] of holes) {
    // Each circle starts at (cx + r, cy): r = 9 → centre is 9 mm left of the start point.
    near(Math.hypot(x - 9 - c, y - c), 60, 0.002);
  }
});

test('text escaping and base64', () => {
  assert.equal(pdfString('a (b) \\ 30°'), '(a \\(b\\) \\\\ 30\\260)');
  assert.equal(pdfString('π'), '(?)');
  assert.equal(toBase64(new Uint8Array([77, 97, 110])), 'TWFu');
  assert.equal(toBase64(new Uint8Array([77, 97])), 'TWE=');
  assert.equal(toBase64(new Uint8Array([77])), 'TQ==');
  assert.equal(PAPER.letter.w, 215.9);
});

test('invalid input never produces a template', () => {
  assert.equal(saddleTemplate({ headerOD: 50, branchOD: 60, branchWall: 0, angleDeg: 90, offset: 0, contact: 'outside' }, 'metric', 'a4').ok, false);
  assert.equal(mitreTemplate({ od: 100, bendDeg: 90, pieces: 1, radius: 150 }, 'metric', 'a4').ok, false);
  assert.equal(pcdTemplate({ pcd: 100, holes: 0, layout: 'straddle' }, 'metric', 'a4').ok, false);
});
