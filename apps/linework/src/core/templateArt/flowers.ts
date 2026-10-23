// Flowers: original line art on a 400×400 canvas.
import type { Template } from '../templates.ts';
import { bez, circle, f, leaf, petal, polar, spiral, type P } from './draw.ts';

const VB = '0 0 400 400';

const tulip: Template = {
  id: 'tulip',
  name: 'Tulip',
  category: 'flowers',
  viewBox: VB,
  paths: [
    // bloom
    'M 158 112 L 176 150 L 200 102 L 224 150 L 242 112 C 262 165 252 222 200 232 C 148 222 138 165 158 112 Z',
    // inner petal edges
    'M 176 150 C 178 190 188 216 200 232 M 224 150 C 222 190 212 216 200 232',
    // stem
    'M 200 232 C 197 280 203 325 200 372',
    // leaves
    'M 200 334 C 160 322 130 282 134 238 C 166 258 190 292 200 334 Z',
    'M 201 304 C 240 292 266 256 262 214 C 234 234 210 266 201 304 Z',
    // ground
    'M 120 372 L 280 372',
  ],
};

function daisyPetals(): string {
  const parts: string[] = [];
  for (let i = 0; i < 14; i++) {
    const deg = (360 * i) / 14;
    const [bx, by] = polar(200, 160, 30, deg);
    parts.push(petal(bx, by, deg, 70, 13, 0.6));
  }
  return parts.join(' ');
}

const daisy: Template = {
  id: 'daisy',
  name: 'Daisy',
  category: 'flowers',
  viewBox: VB,
  paths: [
    `${circle(200, 160, 30)} ${circle(200, 160, 14)}`,
    daisyPetals(),
    // stem and leaves
    'M 200 260 C 194 300 206 340 200 382',
    leaf(201, 330, 55, 75, 14),
    leaf(199, 300, -60, 65, 12),
  ],
};

const rose: Template = {
  id: 'rose-bloom',
  name: 'Spiral rose',
  category: 'flowers',
  viewBox: VB,
  paths: [
    // tight centre spiral
    spiral(195, 150, 8, 5),
    // cupped petals around the spiral
    'M 148 132 C 150 88 252 88 254 132',
    'M 140 150 C 132 205 270 205 262 150',
    'M 128 118 C 104 172 132 226 200 232 C 268 226 296 172 272 118',
    'M 128 118 C 150 96 172 92 186 100 M 272 118 C 250 96 228 92 214 100',
    // sepals, stem and leaves
    'M 178 228 L 190 248 L 200 234 L 210 248 L 222 228',
    'M 200 240 C 198 290 204 335 200 382',
    leaf(200, 312, -55, 80, 16),
    leaf(201, 282, 60, 70, 14),
    // thorns
    'M 199 350 L 190 344 L 200 342 M 202 262 L 211 256 L 201 254',
  ],
};

function branch(): string[] {
  const p0: P = [50, 350];
  const p1: P = [150, 290];
  const p2: P = [250, 170];
  const p3: P = [345, 60];
  const out: string[] = [
    `M ${f(p0[0])} ${f(p0[1])} C ${f(p1[0])} ${f(p1[1])} ${f(p2[0])} ${f(p2[1])} ${f(p3[0])} ${f(p3[1])}`,
  ];
  const leaves: string[] = [];
  const stops = [0.14, 0.26, 0.38, 0.5, 0.62, 0.74, 0.86];
  stops.forEach((t, i) => {
    const [x, y] = bez(p0, p1, p2, p3, t);
    const [x2, y2] = bez(p0, p1, p2, p3, t + 0.01);
    const along = (Math.atan2(x2 - x, -(y2 - y)) * 180) / Math.PI; // 0° = up
    const side = i % 2 === 0 ? -1 : 1;
    const len = 78 - i * 4;
    leaves.push(leaf(x, y, along + side * 50, len, len * 0.22));
  });
  // tip leaf
  leaves.push(leaf(p3[0], p3[1], 40, 40, 9));
  out.push(leaves.join(' '));
  return out;
}

const leafyBranch: Template = {
  id: 'leafy-branch',
  name: 'Leafy branch',
  category: 'flowers',
  viewBox: VB,
  paths: branch(),
};

export const flowers: Template[] = [tulip, daisy, rose, leafyBranch];
