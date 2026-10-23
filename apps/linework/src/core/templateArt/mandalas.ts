// Mandalas: generated procedurally with rotational symmetry around the canvas centre (200, 200).
import type { Template } from '../templates.ts';
import { circle, f, petal, polar, ring, star } from './draw.ts';

const VB = '0 0 400 400';
const C = 200;

/** Pointed arch between two angles at radius r0 rising to a point at radius r1. */
function arch(r0: number, r1: number, from: number, to: number): string {
  const a = polar(C, C, r0, from);
  const b = polar(C, C, r0, to);
  const mid = (from + to) / 2;
  const tip = polar(C, C, r1, mid);
  const ca = polar(C, C, (r0 + r1) / 2 + (r1 - r0) * 0.25, from + (mid - from) * 0.2);
  const cb = polar(C, C, (r0 + r1) / 2 + (r1 - r0) * 0.25, to - (to - mid) * 0.2);
  return (
    `M ${f(a[0])} ${f(a[1])} Q ${f(ca[0])} ${f(ca[1])} ${f(tip[0])} ${f(tip[1])} ` +
    `Q ${f(cb[0])} ${f(cb[1])} ${f(b[0])} ${f(b[1])}`
  );
}

/** Scalloped ring: n outward bumps between radius r and r + h. */
function scallops(r: number, h: number, n: number): string {
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    const a0 = (360 * i) / n;
    const a1 = (360 * (i + 1)) / n;
    const p0 = polar(C, C, r, a0);
    const p1 = polar(C, C, r, a1);
    const chord = 2 * r * Math.sin(Math.PI / n);
    const bump = Math.max(h, chord / 2);
    parts.push(`M ${f(p0[0])} ${f(p0[1])} A ${f(bump)} ${f(bump)} 0 0 1 ${f(p1[0])} ${f(p1[1])}`);
  }
  return parts.join(' ');
}

/** Dots on a circle. */
function dots(r: number, n: number, size: number, offset = 0): string {
  return Array.from({ length: n }, (_, i) => {
    const [x, y] = polar(C, C, r, offset + (360 * i) / n);
    return circle(x, y, size);
  }).join(' ');
}

const mandala8: Template = {
  id: 'mandala-8-petal',
  name: '8-petal mandala',
  category: 'mandalas',
  viewBox: VB,
  strokeWidth: 3,
  paths: [
    `${circle(C, C, 22)} ${circle(C, C, 50)}`,
    ring(petal(C, C - 50, 0, 100, 26), 8, C, C),
    ring(petal(C, C - 50, 0, 62, 13), 8, C, C, 22.5),
    ring(petal(C, C - 66, 0, 52, 10), 8, C, C),
    dots(132, 8, 7, 22.5),
    `${circle(C, C, 160)} ${scallops(160, 14, 24)}`,
  ],
};

const mandala12: Template = {
  id: 'mandala-12-fold',
  name: '12-fold mandala',
  category: 'mandalas',
  viewBox: VB,
  strokeWidth: 3,
  paths: [
    `${circle(C, C, 16)} ${star(C, C, 40, 24, 12)}`,
    circle(C, C, 48),
    Array.from({ length: 12 }, (_, i) => arch(48, 112, i * 30, (i + 1) * 30)).join(' '),
    Array.from({ length: 12 }, (_, i) => arch(48, 84, i * 30, (i + 1) * 30)).join(' '),
    circle(C, C, 118),
    ring(petal(C, C - 118, 0, 56, 14, 0.55), 12, C, C, 15),
    dots(150, 12, 5),
    circle(C, C, 178),
  ],
};

const mandala16: Template = {
  id: 'mandala-16-scallop',
  name: '16-fold scallop mandala',
  category: 'mandalas',
  viewBox: VB,
  strokeWidth: 3,
  paths: [
    `${circle(C, C, 12)} ${scallops(12, 8, 8)}`,
    `${circle(C, C, 40)} ${ring(petal(C, C - 40, 0, 38, 7), 16, C, C)}`,
    `${circle(C, C, 82)} ${scallops(82, 12, 16)}`,
    ring(petal(C, C - 98, 0, 58, 11, 0.4), 16, C, C, 11.25),
    `${circle(C, C, 160)} ${scallops(160, 16, 32)}`,
    dots(110, 16, 4),
  ],
};

const mandala10: Template = {
  id: 'mandala-10-star',
  name: '10-point star mandala',
  category: 'mandalas',
  viewBox: VB,
  strokeWidth: 3,
  paths: [
    `${circle(C, C, 20)} ${star(C, C, 56, 26, 10, 18)}`,
    circle(C, C, 64),
    star(C, C, 140, 76, 10),
    ring(petal(C, C - 64, 0, 64, 9, 0.5), 10, C, C, 18),
    circle(C, C, 150),
    ring(petal(C, C - 150, 0, 26, 9, 0.5), 20, C, C, 9),
    dots(168, 10, 5),
  ],
};

export const mandalas: Template[] = [mandala8, mandala12, mandala16, mandala10];
