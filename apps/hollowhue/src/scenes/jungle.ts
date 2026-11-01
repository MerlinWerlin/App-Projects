// Dinosaur jungle: a long-neck and her baby by a river, palms, ferns and a smoking volcano.
import { LevelArt, circle, curve, ellipse, petal, poly, rect, rot, scallop, smooth } from '../core/build.ts';
import { starPts } from './bookshop.ts';
import type { Scene } from '../core/scene.ts';

function palm(a: LevelArt, x: number, base: number, top: number, lean: number) {
  const segs = 9;
  for (let k = 0; k < segs; k++) {
    const t0 = k / segs;
    const t1 = (k + 1) / segs;
    const y0 = base - (base - top) * t0;
    const y1 = base - (base - top) * t1;
    const x0 = x + lean * t0 * t0;
    const x1 = x + lean * t1 * t1;
    const w0 = 18 - 7 * t0;
    const w1 = 18 - 7 * t1;
    a.fill('trunk', poly([x0 - w0, y0, x0 + w0, y0, x1 + w1 + 3, y1 + 4, x1 - w1 - 3, y1 + 4]));
  }
  const tx = x + lean;
  for (let k = 0; k < 7; k++) {
    const ang = Math.PI + (k / 6) * Math.PI + (k % 2 ? 0.12 : -0.08);
    a.fill('frond', petal(tx, top, ang + (ang > Math.PI * 1.5 ? 0.3 : -0.3) * 0, 8, 120 + (k % 3) * 14, 18, true));
  }
  for (let k = 0; k < 3; k++) a.fill('coconut', circle(tx - 12 + k * 12, top + 12, 9));
}

function fern(a: LevelArt, x: number, base: number, size: number, flip = 1) {
  for (let k = 0; k < 6; k++) {
    const ang = -Math.PI / 2 + (k - 2.5) * 0.36 * flip;
    a.fill('fern', petal(x, base, ang, 4, size * (0.75 + (k % 2) * 0.25), size * 0.16, true));
    const ex = x + Math.cos(ang) * size * 0.7;
    const ey = base + Math.sin(ang) * size * 0.7;
    a.ink(curve([x, base, (x + ex) / 2, (base + ey) / 2, ex, ey]), 0.35);
  }
}

function jungle() {
  const a = new LevelArt('jungle');
  a.fill('sky', rect(0, 0, 1200, 900));
  a.fill('sun', circle(150, 120, 52));
  for (let k = 0; k < 12; k++) {
    const ang = (k / 12) * Math.PI * 2;
    a.fill('ray', poly(rot([150 + 64, 112, 150 + 92, 120, 150 + 64, 128], 150, 120, (ang * 180) / Math.PI)));
  }
  a.fill('cloud', scallop(470, 90, 80, 24, 7, 0.4));
  a.fill('cloud', scallop(1060, 60, 60, 18, 6, 0.4));
  // volcano with lava and smoke
  a.fill('smoke', scallop(820, 120, 46, 30, 6, 0.3));
  a.fill('smoke', scallop(870, 60, 36, 24, 6, 0.3));
  a.fill('mountain', `M470 520C580 440 660 380 730 300C760 268 780 240 800 210H860C880 240 900 268 930 300C980 360 1060 400 1200 450V520H560Z`);
  a.fill('lava', `M800 210H860C852 236 846 262 852 290C842 278 838 262 830 262C822 262 822 300 808 318C806 286 812 252 800 210Z`);
  a.fill('farHills', `M0 450C120 400 240 420 360 450C460 476 520 440 600 470V560H0Z`);
  // ground and river
  a.fill('ground', `M0 520C200 500 400 520 600 510C800 500 1000 520 1200 505V900H0Z`);
  a.fill('river', `M0 760C180 720 360 760 520 740C700 718 860 760 1200 720V800C900 840 700 800 520 820C360 840 180 810 0 840Z`);
  for (const [x0, y0] of [
    [120, 770],
    [420, 778],
    [760, 760],
    [1000, 750],
  ] as const)
    a.ink(curve([x0, y0, x0 + 30, y0 - 6, x0 + 60, y0]), 0.5);
  // background palms
  palm(a, 300, 560, 250, 40);
  palm(a, 1080, 540, 230, -50);
  // mama long-neck
  a.fill('tail', smooth([440, 600, 360, 640, 250, 650, 150, 640, 260, 666, 380, 676, 470, 650], 0.9));
  a.fill('legBack', rect(480, 610, 52, 140, 22));
  a.fill('legBack', rect(700, 600, 52, 150, 22));
  a.fill('body', smooth([430, 610, 470, 520, 580, 480, 700, 490, 790, 540, 800, 620, 720, 680, 560, 690, 470, 670], 0.95));
  a.fill('neck', smooth([716, 540, 752, 452, 792, 370, 826, 292, 846, 226, 884, 212, 878, 288, 852, 372, 826, 462, 806, 566], 0.85));
  a.fill('head', smooth([840, 220, 850, 180, 900, 168, 950, 180, 962, 210, 930, 228, 880, 232], 0.9));
  a.fill('eye', circle(900, 192, 7));
  a.ink(curve([930, 214, 945, 218, 956, 212]), 0.6);
  a.fill('legFront', rect(540, 630, 56, 140, 24));
  a.fill('legFront', rect(740, 620, 56, 150, 24));
  for (const fx of [540, 740]) for (let t = 0; t < 3; t++) a.fill('toe', ellipse(fx + 10 + t * 18, 766, 8, 6));
  for (const [sx, sy, sr] of [
    [560, 540, 16],
    [610, 520, 12],
    [660, 545, 18],
    [720, 530, 11],
    [600, 590, 10],
    [520, 580, 12],
  ] as const)
    a.fill('spot', circle(sx, sy, sr));
  a.fill('belly', smooth([500, 660, 600, 676, 720, 660, 700, 680, 600, 690, 510, 678], 0.8));
  // baby triceratops, front left
  a.fill('babyLeg', rect(212, 770, 30, 60, 12));
  a.fill('babyLeg', rect(300, 770, 30, 60, 12));
  a.fill('babyBody', smooth([160, 790, 190, 730, 260, 710, 330, 730, 350, 790, 300, 812, 210, 812], 0.95));
  a.fill('babyTail', smooth([170, 770, 120, 790, 90, 800, 130, 806, 175, 800], 0.8));
  a.fill('frill', scallop(350, 728, 50, 48, 7, 0.1));
  a.fill('babyHead', smooth([320, 760, 340, 712, 390, 704, 420, 740, 410, 784, 360, 794], 0.95));
  a.fill('horn', poly([372, 708, 380, 666, 392, 708]));
  a.fill('horn', poly([396, 716, 412, 676, 414, 722]));
  a.fill('noseHorn', poly([408, 748, 432, 738, 414, 760]));
  a.fill('babyEye', circle(384, 740, 6));
  a.ink(curve([392, 770, 404, 776, 414, 770]), 0.5);
  a.fill('babyLeg', rect(232, 780, 30, 54, 12));
  a.fill('babyLeg', rect(280, 780, 30, 54, 12));
  // rocks, ferns and flowers in front
  a.fill('rock', smooth([900, 860, 920, 800, 990, 780, 1060, 800, 1080, 860], 0.9));
  a.fill('rock', smooth([1050, 870, 1070, 830, 1120, 820, 1170, 840, 1180, 880], 0.9));
  fern(a, 40, 900, 170);
  fern(a, 520, 900, 130, -1);
  fern(a, 1180, 900, 150, -1);
  for (const [fx, fy] of [
    [640, 860],
    [700, 880],
    [860, 870],
  ] as const) {
    a.fill('stem', rect(fx - 2, fy, 4, 40));
    a.fill('bloom', poly(starPts(fx, fy, 20, 9, 6)));
    a.fill('bloomHeart', circle(fx, fy, 6));
  }
  a.ink(curve([560, 60, 572, 52, 584, 60, 596, 52, 608, 60]), 0.6);
  a.ink(curve([620, 100, 630, 94, 640, 100, 650, 94, 660, 100]), 0.6);
  return a.level({ stroke: 2.6 });
}

export const jungleScene: Scene = { id: 'jungle', theme: 'dinosaurs', version: 1, palette: 'garden', levels: [jungle()] };
