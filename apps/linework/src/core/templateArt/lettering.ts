// Lettering practice sheets: original block letters, guide lines and loop drills on a 400×400 canvas.
import type { Template } from '../templates.ts';
import { ellipse, f, line, mirrorX, poly, rrect, shift } from './draw.ts';

const VB = '0 0 400 400';

// ---- HELLO block letters (each 60 × 110, gap 15) ----------------------------------------------

const H = poly([[0, 0], [18, 0], [18, 44], [42, 44], [42, 0], [60, 0], [60, 110], [42, 110], [42, 62], [18, 62], [18, 110], [0, 110]]);
const E = poly([[0, 0], [60, 0], [60, 18], [18, 18], [18, 46], [50, 46], [50, 64], [18, 64], [18, 92], [60, 92], [60, 110], [0, 110]]);
const L = poly([[0, 0], [18, 0], [18, 92], [60, 92], [60, 110], [0, 110]]);
const O = `${rrect(0, 0, 60, 110, 28)} ${rrect(18, 18, 24, 74, 12)}`;

const hello: Template = {
  id: 'hello-block-letters',
  name: 'HELLO block letters',
  category: 'lettering',
  viewBox: VB,
  paths: [
    ...[H, E, L, L, O].map((letter, i) => shift(letter, 20 + i * 75, 145)),
    // guide lines: cap line, baseline, and a practice line below
    `${line(20, 128, 380, 128)} ${line(20, 272, 380, 272)}`,
    `${line(20, 330, 380, 330)} ${line(20, 360, 380, 360)}`,
  ],
};

// ---- A to E outline letters (each about 100 × 130) ---------------------------------------------

const A = `${poly([[0, 130], [38, 0], [62, 0], [100, 130], [78, 130], [69, 100], [31, 100], [22, 130]])} ${poly([[36, 82], [64, 82], [50, 32]])}`;
const B =
  'M 0 0 L 58 0 C 92 0 96 54 70 62 C 100 70 100 130 62 130 L 0 130 Z ' +
  'M 20 18 L 54 18 C 72 18 72 54 54 54 L 20 54 Z M 20 72 L 58 72 C 80 72 80 112 58 112 L 20 112 Z';
const C =
  'M 94 30 C 80 2 6 0 4 65 C 6 130 80 128 94 100 L 76 92 C 66 112 24 112 24 65 C 24 18 66 18 76 38 Z';
const D = 'M 0 0 L 42 0 C 104 0 104 130 42 130 L 0 130 Z M 20 18 L 42 18 C 80 18 80 112 42 112 L 20 112 Z';
const Ebig = poly([[0, 0], [90, 0], [90, 20], [22, 20], [22, 55], [75, 55], [75, 75], [22, 75], [22, 110], [90, 110], [90, 130], [0, 130]]);

const alphabet: Template = {
  id: 'alphabet-a-e',
  name: 'Alphabet A to E',
  category: 'lettering',
  viewBox: VB,
  paths: [
    shift(A, 30, 40),
    shift(B, 152, 40),
    shift(C, 272, 40),
    shift(D, 92, 220),
    shift(Ebig, 216, 220),
    `${line(20, 178, 380, 178)} ${line(20, 358, 380, 358)}`,
  ],
};

// ---- Loop drills: four rows, each with ascender line, midline and baseline --------------------

function guideRows(tops: number[]): string {
  return tops.map((top) => `${line(24, top, 376, top)} ${line(24, top + 40, 376, top + 40)} ${line(24, top + 80, 376, top + 80)}`).join(' ');
}

/** Connected loops from the baseline up to `peak`. */
function loops(x0: number, base: number, peak: number, count: number, width: number): string {
  let d = `M ${f(x0)} ${f(base)}`;
  let x = x0;
  for (let i = 0; i < count; i++) {
    d +=
      ` C ${f(x + width)} ${f(base - 4)} ${f(x + width)} ${f(peak)} ${f(x + width * 0.6)} ${f(peak)}` +
      ` C ${f(x + width * 0.25)} ${f(peak)} ${f(x + width * 0.25)} ${f(base)} ${f(x + width)} ${f(base)}`;
    x += width;
  }
  return d;
}

/** Connected "u" waves between the midline and baseline. */
function waves(x0: number, mid: number, base: number, count: number, width: number): string {
  let d = `M ${f(x0)} ${f(mid)}`;
  for (let i = 0; i < count; i++) {
    const x = x0 + i * width;
    d += ` C ${f(x)} ${f(base + 6)} ${f(x + width)} ${f(base + 6)} ${f(x + width)} ${f(mid)}`;
  }
  return d;
}

const loopTops = [24, 118, 212, 306];

const cursive: Template = {
  id: 'cursive-loops',
  name: 'Loop practice sheet',
  category: 'lettering',
  viewBox: VB,
  strokeWidth: 3.5,
  paths: [
    guideRows(loopTops),
    loops(30, loopTops[0] + 80, loopTops[0] + 4, 8, 42),
    loops(30, loopTops[1] + 80, loopTops[1] + 42, 11, 31),
    Array.from({ length: 8 }, (_, i) => ellipse(50 + i * 43, loopTops[2] + 60, 15, 19)).join(' '),
    waves(30, loopTops[3] + 40, loopTops[3] + 80, 8, 42),
  ],
};

// ---- Ribbon banner with lettering guides ------------------------------------------------------

const tail = 'M 92 176 L 30 180 L 56 216 L 30 252 L 106 248 L 92 228';

const banner: Template = {
  id: 'ribbon-banner',
  name: 'Ribbon banner',
  category: 'lettering',
  viewBox: VB,
  paths: [
    // main band
    'M 92 140 C 160 118 240 118 308 140 L 308 228 C 240 206 160 206 92 228 Z',
    // folded tails
    `${tail} ${mirrorX(tail, 200)}`,
    // lettering guides inside the band
    'M 112 160 C 170 142 230 142 288 160 M 112 204 C 170 186 230 186 288 204',
    // practice lines below
    `${line(40, 296, 360, 296)} ${line(40, 326, 360, 326)} ${line(40, 356, 360, 356)}`,
  ],
};

export const lettering: Template[] = [hello, alphabet, cursive, banner];
