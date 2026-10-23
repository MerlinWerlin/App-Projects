// Flowers & botanicals batch 2 (fb-1023b T135, 23 Oct 2026): original line art on a 400×400 canvas. See
// docs/TEMPLATES.md. Garden and wild flowers of our own design, built from rounded, ruffled and pointed petal shapes
// whose overlaps are hidden with occlude.ts (helpers shared with wild2.ts). Beginner pieces are bold single blooms,
// intermediate ones add spikes, clusters and leaves with veins, advanced ones add dense florets and hatching.
import type { Template } from '../templates.ts';
import { circle, f, line, petal, polar, rotate, type P } from './draw.ts';
import { E, NONE, frame, inside, layered, makeTpl, ruffle, serrated, smooth, spoon, tube, veinLeaf, type Art, type Item } from './wild2.ts';

const tpl = makeTpl('flor2', 'flowers');

/** Petal veins: lines from the centre (cx, cy) toward each listed angle, from r0 to r1. */
function rays(cx: number, cy: number, angles: readonly number[], r0: number, r1: number): string {
  return angles
    .map((a) => {
      const [x0, y0] = polar(cx, cy, r0, a);
      const [x1, y1] = polar(cx, cy, r1, a);
      return line(x0, y0, x1, y1);
    })
    .join(' ');
}

/** Petal with a notched (three-toothed) tip. */
function notched(bx: number, by: number, deg: number, len: number, w: number): string {
  const q = frame(bx, by, deg, len);
  return smooth([q(0, w * 0.15), q(0.5, w * 0.85), q(0.9, w), q(1, w * 0.62), q(0.93, w * 0.32), q(1.0, 0), q(0.93, -w * 0.32), q(1, -w * 0.62), q(0.9, -w), q(0.5, -w * 0.85), q(0, -w * 0.15)]);
}

/** Closed outline of an ellipse with `n` small outward bumps. */
function bumpy(cx: number, cy: number, rx: number, ry: number, n: number, amp: number): string {
  const pts: P[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (Math.PI * i) / n;
    const k = i % 2 === 0 ? 1 : 1 - amp;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return smooth(pts);
}

/** Short hook strokes on a grid inside a shape (florets, styles, hairs). */
function hooks(shape: string, x0: number, x1: number, y0: number, y1: number, gap: number, size: number, curl = 1): string {
  let d = '';
  let row = 0;
  for (let y = y0; y <= y1; y += gap, row++) {
    for (let x = x0 + (row % 2) * (gap / 2); x <= x1; x += gap) {
      d += `M ${f(x - size / 2)} ${f(y + size / 2)} Q ${f(x - size / 2)} ${f(y - size / 2)} ${f(x + size / 2 * curl)} ${f(y - size / 3)} `;
    }
  }
  return inside(d.trim(), shape);
}

// ---- beginner ----------------------------------------------------------------------------------------------------

function hibiscusArt(): Art {
  const c: P = [196, 176];
  const angles = [-10, 62, 134, 206, 278];
  const petals = angles.map((a) => ruffle(c[0], c[1], a, 128, 56, 3));
  const column = tube([[c[0], c[1]], [230, 128], [256, 92]], 9, 6);
  const leafA = veinLeaf(214, 300, 128, 120, 34, 4);
  const leafB = veinLeaf(206, 318, -128, 110, 30, 4);
  return layered([
    { sil: [circle(258, 86, 6), circle(270, 96, 6), circle(250, 74, 6), circle(266, 76, 5)] },
    { sil: column },
    { sil: circle(c[0], c[1], 16) },
    ...petals.map((p, i) => ({ sil: p, d: [inside(rays(c[0], c[1], [angles[i] - 10, angles[i], angles[i] + 10], 22, 70), p)] })),
    { sil: leafA.sil, d: [leafA.d] },
    { sil: leafB.sil, d: [leafB.d] },
    { sil: tube([[206, 260], [210, 320], [204, 384]], 12, 12) },
  ]);
}

function pansyArt(): Art {
  const c: P = [200, 176];
  return layered([
    { sil: E(c[0], c[1] + 4, 16, 13) },
    { sil: ruffle(c[0], c[1], 180, 128, 66, 3), d: [inside(rays(c[0], c[1] + 6, [150, 165, 180, 195, 210], 18, 64), ruffle(c[0], c[1], 180, 128, 66, 3))] },
    { sil: spoon(c[0], c[1], -98, 118, 52), d: [rays(c[0], c[1], [-92, -104, -80], 22, 58)] },
    { sil: spoon(c[0], c[1], 98, 118, 52), d: [rays(c[0], c[1], [92, 104, 80], 22, 58)] },
    { sil: spoon(c[0] - 6, c[1], -28, 130, 58) },
    { sil: spoon(c[0] + 6, c[1], 28, 130, 58) },
    { sil: petal(150, 330, -60, 90, 22), d: ['M 150 330 L 84 292'] },
    { sil: tube([[200, 300], [190, 340], [176, 384]], 10, 10) },
  ]);
}

function cosmosArt(): Art {
  const c: P = [190, 160];
  const angles = Array.from({ length: 8 }, (_, i) => i * 45 + 10);
  const disc = circle(c[0], c[1], 26);
  const centreDots = [circle(c[0] - 9, c[1] - 6, 3), circle(c[0] + 8, c[1] - 8, 3), circle(c[0], c[1] + 9, 3), circle(c[0] + 11, c[1] + 6, 3), circle(c[0] - 10, c[1] + 7, 3)];
  const fern = (x: number, y: number, deg: number, len: number) => {
    const q = frame(x, y, deg, len);
    let d = `M ${f(x)} ${f(y)} L ${f(q(1, 0)[0])} ${f(q(1, 0)[1])}`;
    for (let i = 1; i <= 4; i++) {
      for (const s of [1, -1]) {
        const a = q(i / 5, 0);
        const b = q(i / 5 + 0.18, s * 22);
        d += ` M ${f(a[0])} ${f(a[1])} L ${f(b[0])} ${f(b[1])}`;
      }
    }
    return d;
  };
  return layered([
    { sil: disc, p: centreDots },
    ...angles.map((a) => ({ sil: notched(c[0], c[1], a, 132, 30), d: [rays(c[0], c[1], [a], 34, 96)] })),
    { sil: E(320, 250, 16, 22, 20), d: ['M 314 236 L 326 266'] },
    { sil: NONE, p: [`M ${f(c[0])} ${f(c[1] + 120)} Q 196 300 214 384`, 'M 204 330 Q 260 300 316 270'], d: [fern(200, 340, -50, 90), fern(208, 360, 60, 80)] },
  ]);
}

function marigoldArt(): Art {
  const c: P = [200, 170];
  const items: Item[] = [{ sil: circle(c[0], c[1], 16), p: [circle(c[0], c[1], 6)] }];
  const ringOf = (n: number, len: number, w: number, off: number) =>
    Array.from({ length: n }, (_, i) => ({ sil: ruffle(c[0], c[1], off + (360 * i) / n, len, w, 2) }));
  items.push(...ringOf(7, 54, 20, 0), ...ringOf(10, 94, 26, 18), ...ringOf(13, 134, 30, 7));
  const leafA = serrated(150, 330, -60, 120, 26, 7);
  const leafB = serrated(250, 330, 60, 120, 26, 7);
  items.push({ sil: leafA, d: [inside(line(150, 330, ...frame(150, 330, -60, 120)(0.9, 0)), leafA)] });
  items.push({ sil: leafB, d: [inside(line(250, 330, ...frame(250, 330, 60, 120)(0.9, 0)), leafB)] });
  items.push({ sil: tube([[200, 290], [200, 340], [200, 384]], 12, 12) });
  return layered(items);
}

function gerberaArt(): Art {
  const c: P = [200, 156];
  const outer = Array.from({ length: 18 }, (_, i) => i * 20);
  return layered([
    { sil: circle(c[0], c[1], 22), p: [circle(c[0], c[1], 9)] },
    { sil: bumpy(c[0], c[1], 40, 40, 16, 0.12) },
    ...outer.map((a) => ({ sil: spoon(c[0], c[1], a, 132, 15) })),
    { sil: petal(196, 360, -64, 120, 22), d: ['M 196 360 L 103 314'] },
    { sil: tube([[200, 270], [202, 330], [200, 384]], 12, 12) },
  ]);
}

function sweetPeaArt(): Art {
  const bloom = (x: number, y: number, deg: number, s: number): Item[] => {
    const q = frame(x, y, deg, 1);
    const [kx, ky] = q(-6 * s, 0);
    return [
      { sil: E(kx, ky, 15 * s, 10 * s, deg + 90) },
      { sil: [spoon(x, y, deg - 60, 46 * s, 20 * s), spoon(x, y, deg + 60, 46 * s, 20 * s)] },
      { sil: ruffle(x, y, deg, 82 * s, 50 * s, 3), d: [inside(rays(x, y, [deg - 20, deg, deg + 20], 14 * s, 52 * s), ruffle(x, y, deg, 82 * s, 50 * s, 3))] },
    ];
  };
  const curl = (x: number, y: number, r: number) => `M ${f(x)} ${f(y)} Q ${f(x + r * 2)} ${f(y - r)} ${f(x + r * 1.6)} ${f(y + r * 0.6)} Q ${f(x + r)} ${f(y + r * 1.4)} ${f(x + r * 0.6)} ${f(y + r * 0.4)}`;
  return layered([
    ...bloom(150, 150, -30, 1.15),
    ...bloom(262, 112, 30, 1.0),
    ...bloom(250, 236, 60, 0.9),
    { sil: petal(170, 310, -70, 90, 22), d: ['M 170 310 L 88 280'] },
    { sil: NONE, p: ['M 160 158 Q 180 220 196 270 Q 206 320 200 384', 'M 258 120 Q 226 190 196 270', 'M 246 240 Q 222 256 204 290', curl(206, 330, 20), curl(132, 250, 14)] },
  ]);
}

function frangipaniArt(): Art {
  const c: P = [200, 190];
  const angles = [0, 72, 144, 216, 288];
  const pet = (a: number) => {
    const q = frame(c[0], c[1], a, 140);
    return smooth([q(0, 8), q(0.4, 40), q(0.85, 52), q(1, 18), q(0.92, -24), q(0.6, -30), q(0.2, -14), q(0, -6)]);
  };
  return layered([
    { sil: circle(c[0], c[1], 12) },
    ...angles.map((a) => ({ sil: pet(a), d: [inside(rays(c[0], c[1], [a + 4], 18, 70), pet(a))] })),
  ]);
}

// ---- intermediate ------------------------------------------------------------------------------------------------

function foxgloveArt(): Art {
  const stem = tube([[204, 384], [200, 260], [196, 140], [204, 30]], 12, 6);
  const bell = (x: number, y: number, deg: number, len: number, w: number): Item => {
    const q = frame(x, y, deg, len);
    const sil = smooth([q(0, w * 0.3), q(0.5, w * 0.62), q(0.85, w * 0.95), q(1, w * 1.05), q(1.04, 0), q(1, -w * 1.05), q(0.85, -w * 0.95), q(0.5, -w * 0.62), q(0, -w * 0.3)]);
    const mouth = `M ${f(q(1, w * 1.05)[0])} ${f(q(1, w * 1.05)[1])} Q ${f(q(0.86, 0)[0])} ${f(q(0.86, 0)[1])} ${f(q(1, -w * 1.05)[0])} ${f(q(1, -w * 1.05)[1])}`;
    const spots = [q(0.82, w * 0.4), q(0.75, -w * 0.2), q(0.88, -w * 0.55)].map(([sx, sy]) => circle(sx, sy, Math.max(2.5, w * 0.1)));
    return { sil, p: [mouth], d: [inside(spots.join(' '), sil)] };
  };
  const bells: Item[] = [];
  const spec: [number, number, number, number][] = [
    [200, 250, 150, 92], [200, 222, 212, 88], [198, 186, 146, 80], [198, 160, 216, 76], [197, 126, 144, 66], [198, 102, 220, 60], [200, 76, 140, 50],
  ];
  for (const [x, y, deg, len] of spec) bells.push(bell(x, y, deg, len, len * 0.32));
  const leafA = veinLeaf(204, 370, -62, 150, 30, 5);
  const leafB = veinLeaf(204, 360, 66, 140, 28, 5);
  return layered([
    { sil: E(206, 44, 8, 12) },
    { sil: E(194, 58, 9, 13) },
    ...bells,
    { sil: leafA.sil, d: [leafA.d] },
    { sil: leafB.sil, d: [leafB.d] },
    { sil: stem },
  ]);
}

function magnoliaArt(): Art {
  const branch = tube([[30, 370], [140, 290], [240, 200], [330, 110]], 18, 10);
  const twig = tube([[150, 284], [120, 220], [110, 160]], 10, 7);
  const bloom = (x: number, y: number, deg: number, s: number): Item[] => {
    const petals = [-36, 36, -14, 14, 0].map((a) => spoon(x, y, deg + a, 100 * s, 28 * s));
    return [
      { sil: petals[4], d: [inside(line(x, y, ...frame(x, y, deg, 100 * s)(0.8, 0)), petals[4])] },
      { sil: petals[2] },
      { sil: petals[3] },
      { sil: petals[0] },
      { sil: petals[1] },
      { sil: E(...frame(x, y, deg, 1)(-6 * s, 0), 18 * s, 12 * s, deg + 90) },
    ];
  };
  return layered([
    ...bloom(240, 196, 20, 1.15),
    ...bloom(110, 160, -10, 0.95),
    { sil: petal(330, 112, 40, 64, 14), d: ['M 330 112 L 360 74'] },
    { sil: petal(80, 324, -40, 54, 13) },
    { sil: twig },
    { sil: branch, d: ['M 70 344 Q 90 334 110 326', 'M 200 238 Q 216 226 230 214', 'M 290 150 L 300 140'] },
  ]);
}

function camelliaArt(): Art {
  const c: P = [190, 170];
  const items: Item[] = [{ sil: circle(c[0], c[1], 18), p: [circle(c[0] - 6, c[1] - 4, 3), circle(c[0] + 6, c[1] - 6, 3), circle(c[0], c[1] + 7, 3), circle(c[0] + 9, c[1] + 4, 3), circle(c[0] - 8, c[1] + 6, 3)] }];
  for (let i = 0; i < 5; i++) items.push({ sil: spoon(c[0], c[1], i * 72 + 20, 56, 26) });
  for (let i = 0; i < 7; i++) items.push({ sil: spoon(c[0], c[1], i * (360 / 7) + 5, 92, 34) });
  for (let i = 0; i < 8; i++) {
    const a = i * 45 + 24;
    const p = spoon(c[0], c[1], a, 132, 44);
    items.push({ sil: p, d: [inside(rays(c[0], c[1], [a], 96, 124), p)] });
  }
  const leafA = veinLeaf(250, 300, 120, 130, 36, 5);
  const leafB = veinLeaf(160, 300, -120, 120, 34, 5);
  const leafC = veinLeaf(214, 330, 40, 110, 30, 4);
  items.push({ sil: leafA.sil, d: [leafA.d] }, { sil: leafB.sil, d: [leafB.d] }, { sil: leafC.sil, d: [leafC.d] });
  items.push({ sil: tube([[204, 290], [210, 340], [204, 384]], 12, 12) });
  return layered(items);
}

function hydrangeaArt(): Art {
  const c: P = [200, 166];
  const pos: P[] = [];
  for (let r = 0; r <= 2; r++) {
    const n = r === 0 ? 1 : r * 6;
    for (let i = 0; i < n; i++) {
      const [x, y] = polar(c[0], c[1], r * 54, (360 * i) / n + r * 13);
      if (Math.hypot((x - c[0]) / 140, (y - c[1]) / 128) <= 1) pos.push([x, y]);
    }
  }
  pos.sort((a, b) => b[1] - a[1]);
  const florets: Item[] = pos.map(([x, y], i) => {
    const rot = (i * 37) % 90;
    const ps = [0, 90, 180, 270].map((a) => spoon(x, y, a + rot, 34, 17));
    return { sil: ps, p: [circle(x, y, 2.5)] };
  });
  const leafA = serrated(196, 280, -120, 130, 34, 8);
  const leafB = serrated(204, 280, 120, 130, 34, 8);
  const vein = (x: number, y: number, deg: number) => line(x, y, ...frame(x, y, deg, 130)(0.9, 0));
  return layered([
    ...florets,
    { sil: leafA, d: [inside(vein(196, 280, -120), leafA)] },
    { sil: leafB, d: [inside(vein(204, 280, 120), leafB)] },
    { sil: tube([[200, 270], [202, 330], [198, 384]], 14, 12) },
  ]);
}

function craneFlowerArt(): Art {
  const spathe = smooth([[130, 236], [200, 214], [290, 198], [360, 196], [300, 218], [220, 244], [150, 256]]);
  const orange = [-46, -24, -4, 18].map((a, i) => petal(214 + i * 6, 214, a, 150 - i * 12, 15));
  const blue = petal(232, 214, 64, 96, 9);
  const leaf = veinLeaf(120, 384, -24, 200, 46, 6);
  return layered([
    { sil: blue, d: ['M 236 212 L 302 176'] },
    ...orange.map((p, i) => ({ sil: p, d: [inside(line(214 + i * 6, 214, ...polar(214 + i * 6, 214, 120 - i * 12, [-46, -24, -4, 18][i])), p)] })),
    { sil: spathe, d: ['M 150 246 Q 240 226 344 200', 'M 210 238 L 214 228'] },
    { sil: tube([[138, 248], [150, 300], [176, 384]], 14, 12) },
    { sil: leaf.sil, d: [leaf.d] },
    { sil: tube([[120, 384], [104, 330]], 10, 10) },
  ]);
}

function callaArt(): Art {
  const spathe = smooth([[200, 250], [178, 200], [152, 140], [140, 92], [158, 62], [200, 52], [246, 60], [266, 80], [250, 102], [226, 132], [214, 184], [208, 234]]);
  const lip = 'M 140 92 Q 186 112 250 102';
  const spadix = petal(196, 176, -6, 82, 8);
  const stem = tube([[205, 240], [208, 310], [210, 384]], 12, 12);
  const one = (deg: number): Item[] => [
    { sil: rotate(spadix, deg, 210, 384) },
    { sil: rotate(spathe, deg, 210, 384), p: [rotate(lip, deg, 210, 384)], d: [rotate('M 200 240 Q 186 180 170 120', deg, 210, 384)] },
    { sil: rotate(stem, deg, 210, 384) },
  ];
  const arrow = smooth([[260, 384], [300, 330], [340, 250], [352, 210], [330, 236], [300, 270], [270, 290], [246, 330]]);
  return layered([
    ...one(14),
    ...one(-22),
    { sil: arrow, d: ['M 262 370 Q 300 300 344 222'] },
  ]);
}

// ---- advanced ----------------------------------------------------------------------------------------------------

function proteaArt(): Art {
  const base: P = [200, 290];
  const dome = E(200, 150, 70, 78);
  const front = [-36, -18, 0, 18, 36].map((a) => ({ a, p: petal(base[0], base[1], a, 120, 24) }));
  const mid = [-58, -34, -12, 12, 34, 58].map((a) => ({ a, p: petal(base[0], base[1], a, 160, 26) }));
  const back = [-82, -66, 66, 82].map((a) => ({ a, p: petal(base[0], base[1], a, 180, 24) }));
  const vein = (a: number, len: number, p: string) => inside(line(base[0], base[1], ...polar(base[0], base[1], len * 0.85, a)), p);
  const hairs = hooks(dome, 136, 266, 76, 220, 14, 9);
  const leafA = veinLeaf(196, 360, -64, 130, 30, 4);
  const leafB = veinLeaf(204, 350, 62, 120, 28, 4);
  return layered([
    ...front.map(({ a, p }) => ({ sil: p, d: [vein(a, 120, p)] })),
    ...mid.map(({ a, p }) => ({ sil: p, d: [vein(a, 160, p)] })),
    { sil: dome, d: [hairs, 'M 150 110 Q 200 92 250 110'] },
    ...back.map(({ a, p }) => ({ sil: p, d: [vein(a, 180, p)] })),
    { sil: leafA.sil, d: [leafA.d] },
    { sil: leafB.sil, d: [leafB.d] },
    { sil: tube([[200, 286], [202, 340], [200, 384]], 14, 12) },
  ]);
}

function waratahArt(): Art {
  const head = bumpy(200, 150, 92, 100, 26, 0.1);
  const styles = hooks(head, 120, 282, 64, 246, 16, 11);
  const bracts = [96, 118, 140, 162, 184, 206, 228, 250, 272].map((a) => petal(200, 220, a, 140, 22));
  const leafA = serrated(196, 340, -70, 150, 22, 9);
  const leafB = serrated(204, 344, 70, 150, 22, 9);
  const vein = (x: number, y: number, deg: number) => line(x, y, ...frame(x, y, deg, 150)(0.9, 0));
  return layered([
    { sil: head, d: [styles, 'M 140 110 Q 200 80 260 110', 'M 126 160 Q 200 134 274 160'] },
    ...bracts.map((p, i) => ({ sil: p, d: [inside(line(200, 220, ...polar(200, 220, 116, 96 + i * 22)), p)] })),
    { sil: leafA, d: [inside(vein(196, 340, -70), leafA)] },
    { sil: leafB, d: [inside(vein(204, 344, 70), leafB)] },
    { sil: tube([[200, 300], [200, 340], [200, 384]], 14, 12) },
  ]);
}

function banksiaArt(): Art {
  const cone = smooth([[200, 44], [240, 56], [256, 110], [258, 190], [252, 260], [226, 298], [174, 298], [148, 260], [142, 190], [144, 110], [160, 56]]);
  let spiral = '';
  for (let k = -8; k <= 10; k++) {
    const x0 = 120 + k * 24;
    spiral += `M ${f(x0)} 40 Q ${f(x0 + 40)} 170 ${f(x0 + 80)} 310 `;
    spiral += `M ${f(x0 + 80)} 40 Q ${f(x0 + 40)} 170 ${f(x0)} 310 `;
  }
  const lattice = inside(spiral.trim(), cone);
  const florets = hooks(cone, 150, 252, 60, 290, 13, 7);
  const leaves = [-62, -36, 36, 62, -112, 112].map((a) => ({ a, p: serrated(200, 300, a, a > 90 || a < -90 ? 110 : 150, 15, 10) }));
  return layered([
    { sil: cone, d: [lattice, florets] },
    ...leaves.map(({ a, p }) => ({ sil: p, d: [inside(line(200, 300, ...polar(200, 300, 140, a)), p)] })),
    { sil: tube([[200, 296], [204, 340], [200, 384]], 14, 12), d: ['M 196 330 L 192 344'] },
  ]);
}

// ---- catalogue ---------------------------------------------------------------------------------------------------

export const flowers3: Template[] = [
  // beginner
  tpl('hibiscus', 'Tropical hibiscus flower', 'beginner', ['hibiscus', 'flower', 'tropical', 'summer', 'stylized'], hibiscusArt()),
  tpl('pansy', 'Garden pansy flower', 'beginner', ['pansy', 'flower', 'garden', 'spring', 'stylized'], pansyArt()),
  tpl('cosmos', 'Summer meadow cosmos flower', 'beginner', ['cosmos', 'flower', 'meadow', 'summer', 'stylized'], cosmosArt()),
  tpl('marigold', 'Ruffled marigold flower', 'beginner', ['marigold', 'flower', 'garden', 'autumn', 'stylized'], marigoldArt()),
  tpl('gerbera', 'Gerbera daisy', 'beginner', ['gerbera', 'daisy', 'flower', 'bright', 'stylized'], gerberaArt()),
  tpl('sweet-pea', 'Sweet pea flowers', 'beginner', ['sweet-pea', 'flower', 'cottage', 'climber', 'stylized'], sweetPeaArt()),
  tpl('frangipani', 'Frangipani flower', 'beginner', ['frangipani', 'flower', 'tropical', 'summer', 'stylized'], frangipaniArt()),
  // intermediate
  tpl('foxglove', 'Foxglove flower spike', 'intermediate', ['foxglove', 'flower', 'cottage', 'wildflower', 'botanical'], foxgloveArt()),
  tpl('magnolia', 'Magnolia branch in bloom', 'intermediate', ['magnolia', 'branch', 'blossom', 'spring', 'botanical'], magnoliaArt()),
  tpl('camellia', 'Camellia flower and leaves', 'intermediate', ['camellia', 'flower', 'leaves', 'winter', 'botanical'], camelliaArt()),
  tpl('hydrangea', 'Hydrangea flower head', 'intermediate', ['hydrangea', 'flower', 'garden', 'cluster', 'botanical'], hydrangeaArt()),
  tpl('crane-flower', 'Crane flower', 'intermediate', ['strelitzia', 'flower', 'tropical', 'exotic', 'botanical'], craneFlowerArt()),
  tpl('calla', 'Calla lily pair', 'intermediate', ['calla', 'lily', 'flower', 'wedding', 'botanical'], callaArt()),
  // advanced
  tpl('protea', 'King protea flower', 'advanced', ['protea', 'flower', 'exotic', 'australian', 'botanical'], proteaArt()),
  tpl('waratah', 'Waratah flower', 'advanced', ['waratah', 'flower', 'native', 'australian', 'botanical'], waratahArt()),
  tpl('banksia', 'Banksia flower cone', 'advanced', ['banksia', 'flower', 'native', 'australian', 'botanical'], banksiaArt()),
];
