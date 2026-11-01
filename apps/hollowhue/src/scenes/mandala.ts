// Endless mandala: each mandala's centre is a round window onto the next one. Generated from a few numbers.
import { LevelArt, circle, ellipse, petal, ring, scallop } from '../core/build.ts';
import type { Level, Scene } from '../core/scene.ts';

type Variant = { n1: number; n2: number; n3: number; pointy: boolean };

const CX = 600;
const CY = 450;
// The centre window (portal) is the ellipse inscribed in this rectangle; the child is drawn inside it.
const PORTAL = { x: 540, y: 405, w: 120, h: 90 };

/** Half-width that lets n petals sit side by side at radius r without overlapping. */
const fitW = (r: number, n: number, pointy: boolean, k = 0.92) => ((Math.PI * r) / n / (pointy ? 1.25 : 1.6)) * k;

function mandala(id: string, parent: string | undefined, v: Variant, deepest: boolean): Level {
  const a = new LevelArt(id);
  a.fill('tile', `M0 0H1200V900H0Z`, parent ? `${parent}/eye` : undefined);
  // corner fans
  for (const [x, y] of [
    [0, 0],
    [1200, 0],
    [0, 900],
    [1200, 900],
  ] as const) {
    a.fill('fanOuter', circle(x, y, 190));
    a.fill('fanBand', ring(x, y, 130, 160));
    for (let k = 0; k < 12; k++) a.fill('fanPetal', petal(x, y, (k / 12) * Math.PI * 2, 40, 122, 16, v.pointy));
    a.fill('fanCore', circle(x, y, 36));
  }
  // outer petals with an inner petal each
  for (let i = 0; i < v.n3; i++) {
    const ang = (i / v.n3) * Math.PI * 2 + Math.PI / v.n3;
    a.fill('petalBig', petal(CX, CY, ang, 300, 436, fitW(368, v.n3, false), false));
  }
  for (let i = 0; i < v.n3; i++) {
    const ang = (i / v.n3) * Math.PI * 2 + Math.PI / v.n3;
    a.fill('petalInner', petal(CX, CY, ang, 330, 408, fitW(368, v.n3, true, 0.42), true));
  }
  a.fill('scallopRing', scallop(CX, CY, 318, 318, v.n2, 0.04) + circle(CX, CY, 292));
  a.fill('field', circle(CX, CY, 292));
  for (let i = 0; i < v.n2; i++) a.fill('spike', petal(CX, CY, (i / v.n2) * Math.PI * 2, 196, 286, fitW(241, v.n2, v.pointy, 0.8), v.pointy));
  for (let i = 0; i < v.n2; i++)
    a.fill('spikeSmall', petal(CX, CY, ((i + 0.5) / v.n2) * Math.PI * 2, 196, 250, fitW(223, v.n2, true, 0.35), true));
  a.fill('band', ring(CX, CY, 172, 192));
  for (let i = 0; i < v.n1 * 2; i++) {
    const ang = (i / (v.n1 * 2)) * Math.PI * 2;
    a.fill('dot', circle(CX + Math.cos(ang) * 158, CY + Math.sin(ang) * 158, 9));
  }
  for (let i = 0; i < v.n1; i++) a.fill('petal', petal(CX, CY, (i / v.n1) * Math.PI * 2, 82, 146, fitW(114, v.n1, !v.pointy, 0.9), !v.pointy));
  a.fill('rim', ellipse(CX, CY, 76, 60) + ellipse(CX, CY, PORTAL.w / 2, PORTAL.h / 2));
  // the centre: the next mandala opens here (it inherits this colour until coloured itself)
  a.fill('eye', ellipse(CX, CY, PORTAL.w / 2, PORTAL.h / 2), deepest ? undefined : `${id}-in/tile`);
  for (let i = 0; i < 8; i++) a.fill('eyePetal', petal(CX, CY, (i / 8) * Math.PI * 2, 8, 38, 7, true));
  a.fill('eyeCore', circle(CX, CY, 9));
  return a.level(parent ? { parent, portal: PORTAL, round: true, stroke: 2.6 } : { stroke: 2.6 });
}

export const mandalaScene: Scene = {
  id: 'mandala',
  theme: 'patterns',
  version: 1,
  palette: 'jewel',
  levels: [
    mandala('m1', undefined, { n1: 8, n2: 16, n3: 12, pointy: false }, false),
    mandala('m1-in', 'm1', { n1: 6, n2: 18, n3: 9, pointy: true }, false),
    mandala('m1-in-in', 'm1-in', { n1: 10, n2: 20, n3: 14, pointy: false }, false),
    mandala('m1-in-in-in', 'm1-in-in', { n1: 7, n2: 14, n3: 10, pointy: true }, false),
    mandala('m1-in-in-in-in', 'm1-in-in-in', { n1: 12, n2: 24, n3: 16, pointy: false }, true),
  ],
};
