// Café window: brick front, scalloped awning, cakes and coffee inside, a cat on the sill.
import { LevelArt, circle, curve, ellipse, frame, line, petal, poly, rect, ring, scallop, smooth } from '../core/build.ts';
import { between, rng } from '../core/rng.ts';
import type { Scene } from '../core/scene.ts';

function cafe() {
  const a = new LevelArt('cafe');
  a.fill('mortar', rect(0, 0, 1200, 900));
  const r = rng(21);
  for (let row = 0; row < 26; row++) {
    const y = row * 30;
    let x = row % 2 ? -45 : 0;
    while (x < 1200) {
      const w = between(r, 80, 100);
      const x0 = Math.max(0, x + 3);
      const x1 = Math.min(1200, x + w - 3);
      if (x1 - x0 > 14) a.fill('brick', rect(x0, y + 3, x1 - x0, 24, 3));
      x += w;
    }
  }
  // shop front panel
  a.fill('front', rect(130, 160, 940, 620));
  a.fill('signBoard', rect(390, 26, 420, 72, 14));
  a.fill('signInset', rect(402, 36, 396, 52, 10));
  a.fill('signCup', `M580 46H624Q622 82 602 82Q582 82 580 46Z`);
  a.fill('signHandle', ring(628, 58, 5, 11));
  for (const sx of [560, 600, 640]) a.ink(curve([sx - 16, 70, sx - 26, 60]), 0.4);
  for (const k of [-1, 1]) a.fill('signLeaf', petal(600 + k * 120, 62, k < 0 ? Math.PI : 0, 6, 70, 12, true));
  // scalloped awning
  for (let i = 0; i < 12; i++) {
    const x0 = 120 + i * 80;
    const x1 = x0 + 80;
    a.fill(i % 2 ? 'awningB' : 'awningA', `M${x0 + 10} 110L${x1 + 10} 110L${x1} 180Q${(x0 + x1) / 2} 222 ${x0} 180Z`);
  }
  a.fill('awningBar', rect(118, 102, 974, 12, 5));
  // the window and what's inside
  a.fill('inside', rect(190, 230, 820, 400));
  a.fill('backShelf', rect(210, 330, 780, 14, 3));
  const jr = rng(4);
  for (let k = 0; k < 9; k++) {
    const x = 230 + k * 84;
    const h = between(jr, 46, 70);
    a.fill('jar', rect(x, 330 - h, 44, h, 8));
    a.fill('jarLid', rect(x - 3, 330 - h - 10, 50, 12, 4));
    if (k % 2 === 0) a.fill('jarLabel', rect(x + 8, 330 - h * 0.6, 28, 16, 3));
  }
  for (const lx of [330, 600, 870]) {
    a.ink(line([lx, 230, lx, 262]), 0.7);
    a.fill('pendant', `M${lx - 34} 300Q${lx} 236 ${lx + 34} 300Z`);
    a.fill('pendantBulb', `M${lx - 12} 300Q${lx} 318 ${lx + 12} 300Z`);
  }
  a.fill('counter', rect(190, 540, 820, 90));
  a.fill('counterTop', rect(184, 528, 832, 18, 5));
  for (let k = 0; k < 5; k++) a.fill('counterPanel', rect(214 + k * 158, 560, 138, 56, 6));
  // cake stand with a layer cake
  a.fill('standFoot', ellipse(330, 524, 44, 8));
  a.fill('standStem', rect(323, 470, 14, 54));
  a.fill('standPlate', ellipse(330, 468, 90, 12));
  a.fill('cakeLayer', rect(270, 424, 120, 40, 8));
  a.fill('cakeFilling', rect(270, 414, 120, 12, 6));
  a.fill('cakeLayer', rect(270, 376, 120, 40, 8));
  a.fill('icing', `M266 384Q266 360 330 360Q394 360 394 384Q384 400 372 386Q360 402 350 388Q340 402 330 388Q320 402 310 388Q300 402 288 386Q276 400 266 384Z`);
  a.fill('cherry', circle(330, 350, 12));
  a.ink(curve([330, 338, 336, 324, 346, 316]), 0.6);
  // cupcakes
  for (const cx of [470, 540]) {
    a.fill('cupcakeCase', poly([cx - 26, 486, cx + 26, 486, cx + 20, 526, cx - 20, 526]));
    for (let k = -2; k <= 2; k++) a.ink(line([cx + k * 9, 488, cx + k * 7.5, 524]), 0.4);
    a.fill('frosting', scallop(cx, 476, 28, 16, 7, 0.18));
    a.fill('sprinkleTop', circle(cx, 458, 7));
  }
  // coffee cups and a croissant
  for (const [cx, big] of [
    [660, true],
    [740, false],
  ] as const) {
    const w = big ? 34 : 26;
    const h = big ? 50 : 40;
    a.fill('saucer', ellipse(cx, 526, w + 16, 6));
    a.fill('cup', `M${cx - w} ${526 - h}H${cx + w}Q${cx + w - 2} 522 ${cx} 522Q${cx - w + 2} 522 ${cx - w} ${526 - h}Z`);
    a.fill('cupHandle', ring(cx + w + 4, 526 - h * 0.62, 6, 12));
    a.fill('latteArt', ellipse(cx, 526 - h + 1, w - 6, 4));
    a.ink(curve([cx - 8, 526 - h - 8, cx - 16, 526 - h - 28, cx - 4, 526 - h - 48]), 0.45);
    a.ink(curve([cx + 8, 526 - h - 8, cx, 526 - h - 30, cx + 12, 526 - h - 52]), 0.45);
  }
  a.fill('croissant', smooth([830, 520, 846, 488, 890, 474, 934, 488, 950, 520, 924, 512, 890, 502, 856, 512], 0.8));
  for (const k of [-1, 0, 1]) a.ink(curve([890 + k * 24, 478 + Math.abs(k) * 6, 890 + k * 20, 496, 890 + k * 26, 508]), 0.45);
  a.fill('plate', ellipse(890, 524, 74, 7));
  // window frame and glazing bars over the interior
  a.fill('frame', frame(170, 210, 860, 440, [[190, 230, 400, 400], [610, 230, 400, 400]], 6));
  a.ink(line([190, 380, 590, 380]), 0.35);
  // sill, flower box and the cat
  a.fill('sill', rect(150, 646, 900, 24, 5));
  a.fill('flowerBox', rect(210, 676, 360, 52, 6));
  a.ink(line([210, 700, 570, 700]), 0.4);
  const fr = rng(9);
  for (let k = 0; k < 9; k++) {
    const x = 228 + k * 40;
    a.fill('stem', rect(x - 2, 620, 4, 56));
    a.fill('leaf', petal(x, 660, k % 2 ? -0.6 : Math.PI + 0.6, 2, 26, 7, true));
    const fy = 612 - between(fr, 0, 26);
    for (let p = 0; p < 5; p++) a.fill('flowerPetal', petal(x, fy, (p / 5) * Math.PI * 2, 4, 17, 6));
    a.fill('flowerHeart', circle(x, fy, 6));
  }
  // cat sitting on the sill, looking in
  a.fill('catTail', smooth([905, 646, 960, 640, 1000, 610, 1004, 570, 990, 560, 980, 604, 948, 626, 900, 630], 0.8));
  a.fill('catBody', smooth([820, 646, 812, 560, 840, 500, 880, 488, 918, 512, 936, 580, 930, 646], 0.95));
  a.fill('catEar', poly([838, 470, 846, 420, 872, 452]));
  a.fill('catEar', poly([892, 452, 920, 424, 920, 474]));
  a.fill('catHead', smooth([830, 480, 846, 446, 880, 436, 914, 448, 928, 482, 912, 512, 878, 520, 846, 512], 0.9));
  a.ink(curve([846, 640, 852, 600, 872, 590]), 0.6);
  a.ink(curve([900, 640, 896, 600, 878, 590]), 0.6);
  // wainscot below
  a.fill('panelWall', rect(130, 728, 940, 52));
  for (let k = 0; k < 6; k++) a.fill('panel', rect(144 + k * 154, 736, 140, 36, 4));
  // pavement, chalkboard and a potted bay tree
  a.fill('pavement', rect(0, 780, 1200, 120));
  for (let k = 0; k < 8; k++) a.ink(line([k * 160 + 40, 780, k * 160 + 10, 900]), 0.5);
  a.ink(line([0, 840, 1200, 840]), 0.5);
  a.fill('boardLeg', poly([40, 880, 54, 880, 96, 640, 84, 640]));
  a.fill('boardLeg', poly([186, 880, 172, 880, 130, 640, 142, 640]));
  a.fill('boardFrame', frame(48, 650, 130, 180, [[60, 662, 106, 156]], 6));
  a.fill('board', rect(60, 662, 106, 156));
  a.ink(curve([74, 700, 100, 690, 150, 700]), 0.5);
  a.ink(curve([74, 740, 120, 732, 150, 742]), 0.5);
  a.fill('boardHeart', `M113 790C100 776 86 782 92 794C98 804 113 812 113 812C113 812 128 804 134 794C140 782 126 776 113 790Z`);
  a.fill('bayPot', poly([1080, 800, 1160, 800, 1148, 880, 1092, 880]));
  a.fill('bayRim', rect(1074, 790, 92, 14, 4));
  a.fill('bayTrunk', rect(1116, 690, 8, 102));
  a.fill('bayTop', scallop(1120, 640, 62, 70, 10, 0.18));
  return a.level({ stroke: 2.6 });
}

export const cafeScene: Scene = { id: 'cafe', theme: 'cosy', version: 1, palette: 'garden', levels: [cafe()] };
