// Faces & figures batch 2 (fb-1023b T139, 23 Oct 2026): original line art on a 400×400 canvas. See docs/TEMPLATES.md.
// Generic people of our own design for learners, beside figures.ts: hand gestures, a face proportions guide,
// feature close-ups and expression sheets, hairstyle portraits, older faces and full figures in motion (running,
// yoga, a dancer's leap, sitting). No real or famous people, characters or lookalikes. Overlaps use occlude.ts so
// lines behind a shape are hidden; limbs are tapered capsules merged into one clean outline.
import type { Template, TemplateLevel } from '../templates.ts';
import { circle, ellipse, f, line, mirrorX, rotate, rrect, type P } from './draw.ts';
import { clip, region, roundPoly, type Layer } from './occlude.ts';
import { join, layered, limb, smooth, type Art } from './figures.ts';
import { shaggy, tube } from './animals3.ts';

const VB = '0 0 400 400';

// ---- helpers ------------------------------------------------------------------------------------------------------

/** A chain of capsules through joints with radii (one merged limb). */
const chain = (pts: readonly P[], r: readonly number[]): string[] => pts.slice(1).map((p, i) => limb(pts[i], p, r[i], r[i + 1]));

const mirrorArt = (a: Art, axis = 200): Art => ({ p: a.p.map((d) => mirrorX(d, axis)), d: a.d.map((d) => mirrorX(d, axis)) });

const E = (cx: number, cy: number, rx: number, ry: number, deg = 0): string =>
  deg ? rotate(ellipse(cx, cy, rx, ry), deg, cx, cy) : ellipse(cx, cy, rx, ry);

/** Keep only the part of lines inside shape. */
const inside = (lines: string, shape: Layer): string => clip(lines, [region(shape)], 'inside');

type EyeO = { lashes?: boolean; crease?: boolean; look?: P; lid?: number; lower?: number };

/** Eye centred on (x, y), half-width w, half-height h; lid 0..1 lowers the upper lid; lower lifts the lower lid. */
function eye(x: number, y: number, w: number, h: number, o: EyeO = {}): Art {
  const up = h * 1.3 * (1 - (o.lid ?? 0));
  const lo = h * 1.05 * (1 - (o.lower ?? 0));
  const shape =
    `M ${f(x - w)} ${f(y)} C ${f(x - w / 2)} ${f(y - up)} ${f(x + w / 2)} ${f(y - up)} ${f(x + w)} ${f(y)} ` +
    `C ${f(x + w / 2)} ${f(y + lo)} ${f(x - w / 2)} ${f(y + lo)} ${f(x - w)} ${f(y)} Z`;
  const [lx, ly] = o.look ?? [0, 0];
  const ir = h * 0.8;
  const reg = [region(shape)];
  const p = [shape, clip(circle(x + lx, y + ly, ir), reg, 'inside'), clip(circle(x + lx, y + ly, ir * 0.42), reg, 'inside')];
  const d: string[] = [];
  if (o.crease !== false) d.push(`M ${f(x - w * 0.82)} ${f(y - up * 0.62)} C ${f(x - w * 0.4)} ${f(y - up * 1.3)} ${f(x + w * 0.4)} ${f(y - up * 1.3)} ${f(x + w * 0.86)} ${f(y - up * 0.5)}`);
  if (o.lashes) {
    const strokes: string[] = [];
    for (let i = 0; i < 7; i++) {
      const t = 0.12 + i * 0.12;
      const u = 1 - t;
      const bx = u * u * u * (x - w) + 3 * u * u * t * (x - w / 2) + 3 * u * t * t * (x + w / 2) + t * t * t * (x + w);
      const by = u * u * u * y + 3 * u * u * t * (y - up) + 3 * u * t * t * (y - up) + t * t * t * y;
      const lean = (t - 0.5) * 12;
      strokes.push(`M ${f(bx)} ${f(by)} Q ${f(bx + lean * 0.3)} ${f(by - h * 0.5)} ${f(bx + lean)} ${f(by - h * 0.8)}`);
    }
    d.push(strokes.join(' '));
  }
  return { p, d };
}

/** Eyebrow centred on (x, y), half-width w, tilt in degrees (positive raises the right end). */
function brow(x: number, y: number, w: number, tilt = 0, arch = 8): string {
  const d =
    `M ${f(x - w)} ${f(y + 3)} C ${f(x - w / 2)} ${f(y - arch)} ${f(x + w / 3)} ${f(y - arch)} ${f(x + w)} ${f(y - 1)} ` +
    `L ${f(x + w)} ${f(y + 4)} C ${f(x + w / 3)} ${f(y - arch + 7)} ${f(x - w / 2)} ${f(y - arch + 8)} ${f(x - w)} ${f(y + 3)} Z`;
  return tilt ? rotate(d, -tilt, x, y) : d;
}

/** Front nose: two wings and the tip, bottom at y. */
function nose(x: number, y: number, s = 1): Art {
  return {
    p: [
      `M ${f(x - 12 * s)} ${f(y - 12 * s)} C ${f(x - 20 * s)} ${f(y - 5 * s)} ${f(x - 15 * s)} ${f(y + 4 * s)} ${f(x - 6 * s)} ${f(y + 1 * s)}`,
      `M ${f(x + 12 * s)} ${f(y - 12 * s)} C ${f(x + 20 * s)} ${f(y - 5 * s)} ${f(x + 15 * s)} ${f(y + 4 * s)} ${f(x + 6 * s)} ${f(y + 1 * s)}`,
      `M ${f(x - 6 * s)} ${f(y + 1 * s)} Q ${f(x)} ${f(y + 6 * s)} ${f(x + 6 * s)} ${f(y + 1 * s)}`,
    ],
    d: [`M ${f(x - 5 * s)} ${f(y - 48 * s)} C ${f(x - 7 * s)} ${f(y - 34 * s)} ${f(x - 9 * s)} ${f(y - 22 * s)} ${f(x - 11 * s)} ${f(y - 15 * s)}`],
  };
}

/** Closed lips centred on the mouth line (x, y); w = half width; smile lifts the corners. */
function lips(x: number, y: number, w = 24, full = 1, smile = 0): Art {
  const up = 7 * full;
  const lo = 12 * full;
  const cy = y - smile;
  const shape =
    `M ${f(x - w)} ${f(cy)} C ${f(x - w * 0.55)} ${f(y - up)} ${f(x - w * 0.25)} ${f(y - up - 2)} ${f(x)} ${f(y - up * 0.55)} ` +
    `C ${f(x + w * 0.25)} ${f(y - up - 2)} ${f(x + w * 0.55)} ${f(y - up)} ${f(x + w)} ${f(cy)} ` +
    `C ${f(x + w * 0.55)} ${f(y + lo)} ${f(x - w * 0.55)} ${f(y + lo)} ${f(x - w)} ${f(cy)} Z`;
  const mid = `M ${f(x - w)} ${f(cy)} C ${f(x - w * 0.4)} ${f(y + 2 + smile * 0.4)} ${f(x + w * 0.4)} ${f(y + 2 + smile * 0.4)} ${f(x + w)} ${f(cy)}`;
  return { p: [shape, mid], d: [] };
}

/** Left ear (viewer's left) of a front face, top at (x, y). */
function earL(x: number, y: number, h = 52): Art {
  const s = h / 50;
  return {
    p: [`M ${f(x + 4 * s)} ${f(y)} C ${f(x - 14 * s)} ${f(y - 10 * s)} ${f(x - 22 * s)} ${f(y + 12 * s)} ${f(x - 16 * s)} ${f(y + 28 * s)} C ${f(x - 12 * s)} ${f(y + 42 * s)} ${f(x - 2 * s)} ${f(y + 52 * s)} ${f(x + 8 * s)} ${f(y + 46 * s)} Z`],
    d: [`M ${f(x - 2 * s)} ${f(y + 8 * s)} C ${f(x - 12 * s)} ${f(y + 8 * s)} ${f(x - 14 * s)} ${f(y + 24 * s)} ${f(x - 6 * s)} ${f(y + 34 * s)}`],
  };
}

const ears = (x: number, y: number, h = 52): { sil: string[]; d: string[] } => {
  const e = earL(x, y, h);
  return { sil: [e.p[0], mirrorX(e.p[0], 200)], d: [...e.d, ...e.d.map((d) => mirrorX(d, 200))] };
};

/** Slightly narrow adult head, eye line about y = 192. */
const HEAD = 'M 200 84 C 250 84 280 120 280 184 C 280 226 268 256 250 278 C 234 298 218 308 200 308 C 182 308 166 298 150 278 C 132 256 120 226 120 184 C 120 120 150 84 200 84 Z';

/** Pair of eyes, brows, nose and lips for a front face on HEAD. */
function features(o: { lashes?: boolean; smile?: number; full?: number; lipW?: number; browTilt?: number; eyeH?: number } = {}): Art {
  const e = eye(160, 194, 19, o.eyeH ?? 9, { lashes: o.lashes });
  const b = { p: [brow(160, 168, 22, o.browTilt ?? 0)], d: [] };
  return join(e, mirrorArt(e), b, mirrorArt(b), nose(200, 242), lips(200, 270, o.lipW ?? 23, o.full ?? 1, o.smile ?? 0));
}

const SHOULDERS = 'M 44 384 C 50 346 94 332 150 324 C 166 320 172 308 172 292 M 228 292 C 228 308 234 320 250 324 C 306 332 350 346 356 384';

function tpl(id: string, name: string, level: TemplateLevel, tags: string[], art: Art): Template {
  const detail = art.d.filter(Boolean);
  return {
    id: `fig2-${id}`,
    name,
    category: 'faces',
    level,
    tags,
    viewBox: VB,
    paths: art.p.filter(Boolean),
    ...(detail.length ? { detail } : {}),
  };
}

// ---- beginner -----------------------------------------------------------------------------------------------------

function heartHands(): Art {
  const index = tube([[152, 240], [128, 196], [134, 152], [166, 130], [196, 148]], 26, 22);
  const middle = tube([[140, 254], [104, 206], [110, 148], [148, 112], [186, 116]], 24, 20);
  const thumb = tube([[146, 270], [174, 288], [196, 300]], 28, 20);
  const palm = smooth([[100, 196], [146, 226], [172, 296], [168, 346], [154, 372], [96, 372], [76, 320], [72, 250]]);
  const m = (d: string) => mirrorX(d, 200);
  return join(
    layered([
      { sil: [index, m(index)] },
      { sil: [thumb, m(thumb)] },
      { sil: [middle, m(middle)] },
      { sil: [palm, m(palm)] },
    ]),
    { p: [], d: ['M 100 356 L 154 360', 'M 300 356 L 246 360', 'M 128 196 Q 138 194 142 202', 'M 272 196 Q 262 194 258 202'] },
  );
}

function peaceHand(): Art {
  const palm = smooth([[150, 204], [250, 200], [264, 262], [250, 320], [216, 346], [172, 344], [146, 310], [140, 252]]);
  const index = limb([178, 214], [140, 74], 18, 15);
  const middle = limb([214, 210], [236, 64], 18, 15);
  const ring = limb([252, 232], [208, 244], 15, 14);
  const pinky = limb([252, 262], [214, 272], 14, 13);
  const thumb = chain([[160, 304], [196, 282], [224, 268]], [18, 15, 12]);
  return join(
    layered([
      { sil: thumb },
      { sil: ring },
      { sil: pinky },
      { sil: [palm, index, middle], p: ['M 172 344 L 170 384 M 228 340 L 236 384'] },
    ]),
    { p: [], d: [rotate(rrect(132, 70, 16, 20, 7), -15, 140, 80), rotate(rrect(228, 60, 16, 20, 7), 9, 236, 70), 'M 146 146 Q 158 152 170 146', 'M 216 140 Q 228 146 240 142'] },
  );
}

function thumbsUp(): Art {
  const fist = smooth([[124, 196], [250, 190], [278, 222], [276, 300], [252, 330], [146, 332], [120, 302], [116, 236]]);
  const fingers = [0, 1, 2, 3].map((i) => limb([138, 212 + i * 34], [234 - i * 6, 212 + i * 34], 17, 16));
  const thumb = limb([240, 206], [252, 76], 23, 19);
  return join(
    layered([
      ...fingers.map((s) => ({ sil: s })),
      { sil: [thumb, fist], p: ['M 152 332 L 150 384 M 248 330 L 256 384'] },
    ]),
    { p: [], d: [rotate(rrect(242, 72, 18, 22, 8), 5, 251, 83), 'M 236 140 Q 250 148 264 140', 'M 160 362 L 250 362'] },
  );
}

function faceGuide(): Art {
  const head = smooth([[200, 56], [282, 92], [304, 196], [282, 290], [200, 344], [118, 290], [96, 196], [118, 92]]);
  const e = eye(152, 200, 24, 9, { crease: false });
  const ear = smooth([[96, 174], [80, 180], [78, 224], [92, 258], [100, 256]], false);
  return join(
    { p: [head, ear, mirrorX(ear, 200), 'M 190 254 Q 200 264 210 254', 'M 172 290 Q 200 298 228 290', 'M 180 300 Q 200 310 220 300'], d: [] },
    e,
    mirrorArt(e),
    { p: [brow(152, 172, 26), brow(248, 172, 26)], d: [] },
    {
      p: [],
      d: [
        line(200, 40, 200, 360), line(76, 200, 324, 200), line(96, 172, 304, 172), line(100, 258, 300, 258), line(120, 290, 280, 290),
        line(112, 116, 288, 116), 'M 118 200 L 118 206 M 186 200 L 186 206 M 214 200 L 214 206 M 282 200 L 282 206',
      ],
    },
  );
}

function runner(): Art {
  const head = ellipse(258, 70, 24, 28);
  const hair = 'M 234 64 C 232 38 252 34 266 38 C 284 44 286 62 280 70 C 268 58 250 56 240 70 Z';
  const torso = smooth([[226, 104], [266, 104], [270, 150], [244, 210], [206, 206], [212, 150]]);
  const armF = chain([[256, 116], [292, 150], [312, 118]], [13, 11, 9]);
  const armB = chain([[230, 118], [196, 154], [164, 176]], [13, 11, 9]);
  const legF = chain([[238, 196], [294, 236], [282, 302]], [21, 15, 11]);
  const legB = chain([[216, 198], [190, 268], [124, 290]], [21, 15, 11]);
  const shoeF = rrect(274, 300, 44, 18, 8);
  const shoeB = rotate(rrect(98, 280, 40, 18, 8), 30, 118, 290);
  return join(
    layered([
      { sil: hair },
      { sil: head },
      { sil: [...armF, circle(314, 112, 10)] },
      { sil: torso, p: ['M 236 104 Q 248 116 260 104'] },
      { sil: shoeF },
      { sil: legF },
      { sil: [...armB, circle(158, 180, 10)] },
      { sil: shoeB },
      { sil: legB },
      { sil: rrect(238, 88, 22, 22, 6) },
    ]),
    { p: [], d: ['M 60 340 L 340 340', 'M 70 150 L 130 150', 'M 50 180 L 120 180', 'M 80 210 L 140 210'] },
  );
}

function yogaTree(): Art {
  const head = ellipse(200, 94, 22, 27);
  const hair = 'M 178 92 C 176 64 196 60 206 62 C 222 64 226 82 222 92 C 212 78 194 76 182 92 Z';
  const torso = smooth([[176, 126], [224, 126], [230, 176], [226, 236], [174, 236], [170, 176]]);
  const armL = chain([[180, 134], [146, 84], [194, 34]], [13, 11, 9]);
  const armR = armL.map((d) => mirrorX(d, 200));
  const legStand = chain([[212, 228], [212, 296], [212, 356]], [21, 15, 11]);
  const legBent = chain([[188, 228], [128, 262], [204, 294]], [21, 15, 11]);
  return join(
    layered([
      { sil: [roundPoly([[192, 44], [200, 18], [208, 44]], 5)] },
      { sil: hair },
      { sil: head },
      { sil: armL },
      { sil: armR },
      { sil: rrect(189, 112, 22, 20, 6) },
      { sil: legBent },
      { sil: torso, p: ['M 188 126 Q 200 138 212 126'] },
      { sil: [...legStand, ellipse(222, 362, 22, 9)] },
    ]),
    { p: [], d: [rrect(70, 370, 260, 8, 4)] },
  );
}

function parentChild(): Art {
  const figure = (x: number, top: number, s: number): Layer[] => {
    const q = (px: number, py: number): P => [x + px * s, top + py * s];
    return [
      circle(...q(0, 26), 26 * s),
      smooth([q(-30, 64), q(30, 64), q(38, 120), q(46, 176), q(-46, 176), q(-38, 120)]),
      [...chain([q(-14, 170), q(-16, 230), q(-18, 280)], [13 * s, 11 * s, 10 * s]), ellipse(...q(-22, 286), 16 * s, 8 * s)],
      [...chain([q(14, 170), q(16, 230), q(18, 280)], [13 * s, 11 * s, 10 * s]), ellipse(...q(22, 286), 16 * s, 8 * s)],
    ];
  };
  const parent = figure(140, 60, 1.05);
  const child = figure(272, 196, 0.6);
  const armP = chain([[164, 136], [196, 196], [222, 236]], [11, 10, 9]);
  const armP2 = chain([[116, 136], [100, 196], [96, 240]], [11, 10, 9]);
  const armC = chain([[258, 248], [236, 244]], [7, 7]);
  const armC2 = chain([[288, 244], [302, 280]], [7, 6]);
  return join(
    layered([
      { sil: circle(228, 240, 11) },
      { sil: armP },
      { sil: armC },
      { sil: parent[0] },
      { sil: parent[1] },
      { sil: [circle(96, 250, 10), ...armP2] },
      { sil: parent[2] },
      { sil: parent[3] },
      { sil: child[0] },
      { sil: [...armC2, circle(304, 286, 7)] },
      { sil: child[1] },
      { sil: child[2] },
      { sil: child[3] },
    ]),
    { p: [], d: [line(60, 372, 340, 372), 'M 120 66 Q 140 52 164 66', 'M 258 208 Q 272 198 288 208'] },
  );
}

const PROFILE = smooth([
  [196, 100], [244, 100], [270, 126], [278, 160], [280, 186], [300, 222], [292, 231], [284, 236], [289, 248], [282, 256], [286, 266],
  [276, 280], [270, 298], [246, 310], [216, 304], [196, 290], [170, 276], [142, 250], [128, 200], [134, 142], [160, 110],
]);

function profileHat(): Art {
  const brim = E(198, 116, 112, 15, -4);
  const crown = roundPoly([[134, 112], [146, 40], [252, 40], [262, 108]], 16);
  const band = 'M 136 96 L 262 92';
  const ear = smooth([[182, 188], [198, 184], [206, 210], [200, 236], [186, 240], [176, 214]]);
  return join(
    layered([
      { sil: brim },
      { sil: crown, p: [band], d: ['M 196 42 Q 200 56 198 70'] },
      { sil: ear, d: ['M 192 198 Q 198 212 190 226'] },
      {
        sil: PROFILE,
        p: ['M 252 186 Q 262 180 270 188 Q 262 192 252 186 Z', 'M 246 166 Q 260 160 274 166', 'M 288 256 L 274 258', 'M 278 228 Q 272 234 280 238'],
        d: ['M 262 270 Q 268 274 274 270'],
      },
      { sil: smooth([[140, 128], [176, 128], [174, 176], [150, 200], [132, 186]]) },
      { sil: '', p: ['M 196 290 L 192 330 C 150 340 100 350 80 384', 'M 252 308 L 256 332 C 290 342 320 356 330 384', 'M 192 330 L 222 360 L 256 332'] },
    ]),
  );
}

// ---- intermediate -------------------------------------------------------------------------------------------------

function cupHands(): Art {
  const mug = rrect(140, 166, 120, 160, 16);
  const rim = E(200, 166, 60, 11);
  const fingers = [0, 1, 2, 3].map((i) => limb([110, 210 + i * 28], [186 - i * 6, 214 + i * 28], 13, 12));
  const thumb = limb([126, 186], [176, 176], 13, 11);
  const palm = smooth([[150, 196], [104, 196], [72, 250], [74, 330], [104, 374], [150, 374], [156, 320]]);
  const m = (d: string) => mirrorX(d, 200);
  const nails = fingers.map((_, i) => rrect(172 - i * 6, 207 + i * 28, 12, 14, 5));
  const steam = ['M 180 150 C 170 130 194 116 182 92', 'M 204 148 C 194 124 220 110 206 80', 'M 226 150 C 218 132 238 120 228 100'];
  return join(
    layered([
      ...fingers.map((s) => ({ sil: [s, m(s)] })),
      { sil: [thumb, m(thumb)] },
      { sil: [palm, m(palm)] },
      { sil: rim, d: [E(200, 168, 50, 7)] },
      { sil: mug },
    ]),
    { p: [], d: [...nails, ...nails.map(m), ...steam, 'M 100 350 L 150 356', 'M 300 350 L 250 356'] },
  );
}

function eyeStudy(): Art {
  const e = eye(200, 214, 120, 44, { lashes: false, crease: false, look: [6, -2] });
  const shape = e.p[0];
  const iris = circle(206, 212, 35.2);
  const rays: string[] = [];
  for (let i = 0; i < 24; i++) {
    const a = (i * 15 * Math.PI) / 180;
    rays.push(`M ${f(206 + Math.cos(a) * 18)} ${f(212 + Math.sin(a) * 18)} L ${f(206 + Math.cos(a) * 31)} ${f(212 + Math.sin(a) * 31)}`);
  }
  const lashes: string[] = [];
  for (let i = 0; i < 13; i++) {
    const t = 0.06 + i * 0.07;
    const u = 1 - t;
    const bx = u * u * u * 80 + 3 * u * u * t * 140 + 3 * u * t * t * 260 + t * t * t * 320;
    const by = u * u * u * 214 + 3 * u * u * t * 156.8 + 3 * u * t * t * 156.8 + t * t * t * 214;
    const lean = (t - 0.5) * 40;
    lashes.push(`M ${f(bx)} ${f(by)} Q ${f(bx + lean * 0.3)} ${f(by - 16)} ${f(bx + lean)} ${f(by - 26)}`);
  }
  const lower: string[] = [];
  for (let i = 0; i < 9; i++) {
    const t = 0.15 + i * 0.09;
    const u = 1 - t;
    const bx = u * u * u * 80 + 3 * u * u * t * 140 + 3 * u * t * t * 260 + t * t * t * 320;
    const by = u * u * u * 214 + 3 * u * u * t * 260.2 + 3 * u * t * t * 260.2 + t * t * t * 214;
    lower.push(`M ${f(bx)} ${f(by)} L ${f(bx + (t - 0.5) * 10)} ${f(by + 9)}`);
  }
  return join(
    { p: [shape, ...e.p.slice(1), circle(222, 198, 8), 'M 70 190 C 120 120 280 112 336 186', brow(204, 100, 140, 0, 26)], d: [] },
    {
      p: [],
      d: [
        inside(rays.join(' '), iris), lashes.slice(0, 7).join(' '), lashes.slice(7).join(' '), lower.join(' '),
        'M 80 214 Q 72 220 78 228', 'M 96 268 C 150 290 250 292 312 262',
      ],
    },
  );
}

function braidGirl(): Art {
  const cap = 'M 118 196 C 106 112 150 70 200 70 C 254 70 296 112 282 196 C 276 150 258 120 222 108 L 200 92 L 178 108 C 140 120 124 150 118 196 Z';
  const braidPts: P[] = [[262, 262], [278, 290], [290, 318], [296, 346], [298, 370]];
  const segs: string[] = [];
  braidPts.slice(0, -1).forEach(([x, y], i) => {
    const [nx, ny] = braidPts[i + 1];
    const ang = (Math.atan2(nx - x, -(ny - y)) * 180) / Math.PI;
    segs.push(rotate(E((x + nx) / 2 - 7, (y + ny) / 2, 12, 18, 0), ang + 28, (x + nx) / 2 - 7, (y + ny) / 2));
    segs.push(rotate(E((x + nx) / 2 + 7, (y + ny) / 2, 12, 18, 0), ang - 28, (x + nx) / 2 + 7, (y + ny) / 2));
  });
  const tie = rrect(288, 364, 22, 10, 4);
  const tuft = 'M 292 374 Q 284 384 288 384 M 299 374 L 299 384 M 306 374 Q 314 384 310 384';
  const hairSide = 'M 270 150 C 290 190 290 230 270 262 L 254 262 C 270 230 272 190 262 160 Z';
  const ea = ears(122, 186);
  return join(
    layered([
      { sil: tie, d: [tuft] },
      ...segs.slice().reverse().map((s) => ({ sil: s })),
      { sil: cap, d: ['M 200 92 C 196 120 186 140 170 150', 'M 200 92 C 210 120 226 136 250 146', 'M 150 110 C 136 130 128 156 124 180'] },
      { sil: hairSide },
      { sil: HEAD },
      { sil: ea.sil, d: ea.d },
      { sil: '', p: [SHOULDERS], d: ['M 160 330 Q 200 352 240 330'] },
    ]),
    features({ lashes: true, smile: 3, full: 1.05, eyeH: 10 }),
  );
}

function curlyWoman(): Art {
  const centres: [number, number, number][] = [];
  const ring = (cx: number, cy: number, rx: number, ry: number, n: number, r: number, a0: number, a1: number) => {
    for (let i = 0; i < n; i++) {
      const a = ((a0 + ((a1 - a0) * i) / (n - 1)) * Math.PI) / 180;
      centres.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, r]);
    }
  };
  ring(200, 200, 118, 130, 15, 30, 150, 390);
  ring(200, 210, 76, 100, 7, 26, 200, 340);
  const curls = centres.map(([x, y, r]) => circle(x, y, r));
  const spirals = centres.map(([x, y, r]) => `M ${f(x - r * 0.4)} ${f(y)} A ${f(r * 0.4)} ${f(r * 0.4)} 0 1 1 ${f(x)} ${f(y + r * 0.4)} A ${f(r * 0.25)} ${f(r * 0.25)} 0 1 1 ${f(x + r * 0.1)} ${f(y)}`);
  const fringe = 'M 128 176 C 130 130 160 106 200 104 C 240 106 270 130 272 176 C 256 150 236 140 214 146 C 196 136 168 140 150 156 C 140 160 132 168 128 176 Z';
  return join(
    layered([
      { sil: fringe, d: ['M 160 146 Q 168 132 182 128', 'M 214 146 Q 226 132 244 136'] },
      { sil: HEAD },
      { sil: curls, d: [spirals.slice(0, 11).join(' '), spirals.slice(11).join(' ')] },
      { sil: '', p: [SHOULDERS], d: ['M 150 324 Q 200 362 250 324'] },
    ]),
    features({ lashes: true, smile: 4, full: 1.1, eyeH: 9.5 }),
  );
}

function sittingKnees(): Art {
  const head = ellipse(214, 132, 28, 32);
  const hair = 'M 186 132 C 182 96 206 90 220 92 C 244 96 250 116 244 128 C 230 116 206 116 194 130 C 192 140 190 148 186 152 Z';
  const torso = smooth([[176, 176], [216, 168], [222, 230], [214, 300], [168, 322], [146, 300], [150, 230]]);
  const thigh = limb([176, 304], [262, 212], 26, 20);
  const shin = limb([262, 212], [276, 316], 19, 13);
  const foot = rrect(258, 310, 52, 18, 8);
  const arm = chain([[194, 188], [228, 238], [272, 254]], [13, 11, 9]);
  const hand = circle(276, 254, 10);
  const arm2 = chain([[204, 182], [246, 222], [284, 236]], [12, 10, 8]);
  return join(
    layered([
      { sil: hand },
      { sil: arm },
      { sil: shin },
      { sil: hair, d: ['M 198 106 Q 214 98 234 104'] },
      { sil: head, p: ['M 236 128 Q 240 132 236 136'] },
      { sil: thigh },
      { sil: foot },
      { sil: [...arm2, circle(288, 236, 9)] },
      { sil: torso },
      { sil: rrect(196, 154, 22, 26, 6) },
    ]),
    { p: [], d: [line(60, 330, 340, 330), 'M 186 304 Q 210 300 236 296'] },
  );
}

function elderlyMan(): Art {
  const tuftL = shaggy(smooth([[104, 150], [122, 134], [132, 160], [126, 200], [110, 204], [100, 178]]), 4, 7);
  const tuftR = mirrorX(tuftL, 200);
  const mous = 'M 200 258 C 186 250 168 254 156 270 C 170 268 182 270 200 266 C 218 270 230 268 244 270 C 232 254 214 250 200 258 Z';
  const ea = ears(122, 184);
  const wrinkles = [
    'M 160 118 Q 200 108 240 118', 'M 166 132 Q 200 124 234 132', 'M 128 196 Q 136 204 140 200', 'M 272 196 Q 264 204 260 200',
    'M 166 226 C 160 240 160 254 166 262', 'M 234 226 C 240 240 240 254 234 262', 'M 182 300 Q 200 308 218 300', 'M 186 150 L 190 160 M 214 150 L 210 160',
  ];
  const f0 = features({ lipW: 18, full: 0.6, smile: 2, eyeH: 7.5, browTilt: -4 });
  return join(
    layered([
      { sil: mous, d: ['M 180 260 L 176 268 M 220 260 L 224 268'] },
      { sil: [tuftL, tuftR] },
      { sil: HEAD, d: wrinkles },
      { sil: ea.sil, d: ea.d },
      { sil: '', p: [SHOULDERS, 'M 150 324 L 176 356 L 200 330 L 224 356 L 250 324'] },
    ]),
    { p: f0.p.filter((_, i) => i < f0.p.length - 2), d: f0.d },
    { p: ['M 188 282 Q 200 288 212 282'], d: [] },
  );
}

// ---- advanced -----------------------------------------------------------------------------------------------------

function dancerLeap(): Art {
  const head = ellipse(196, 80, 22, 26);
  const bun = circle(178, 60, 14);
  const hair = 'M 174 80 C 172 54 194 50 206 54 C 220 58 222 72 218 80 C 206 70 188 70 178 84 Z';
  const torso = smooth([[180, 108], [214, 110], [222, 150], [210, 192], [182, 192], [176, 150]]);
  const armF = chain([[210, 118], [262, 92], [314, 58]], [11, 9, 7]);
  const armB = chain([[184, 120], [134, 112], [80, 92]], [11, 9, 7]);
  const legF = chain([[206, 196], [282, 190], [356, 166]], [17, 13, 9]);
  const legB = chain([[190, 196], [116, 214], [46, 234]], [17, 13, 9]);
  const skirt = 'M 176 176 C 150 196 126 222 110 240 C 150 238 178 226 196 214 C 220 228 262 236 300 230 C 276 212 246 190 222 172 Z';
  const ribbonF = 'M 356 166 Q 370 150 372 132 M 356 166 Q 376 160 384 146';
  return join(
    layered([
      { sil: bun, d: ['M 168 54 Q 178 48 188 56', 'M 170 66 Q 178 70 188 64'] },
      { sil: hair },
      { sil: head, p: ['M 214 78 Q 218 82 214 86'] },
      { sil: [...armF, E(318, 54, 9, 6, -30)] },
      { sil: [torso, rrect(186, 96, 20, 16, 6)], d: ['M 186 132 Q 198 140 210 132', 'M 184 160 Q 198 166 214 158'] },
      {
        sil: skirt,
        d: ['M 186 190 C 168 206 146 224 128 236', 'M 198 200 C 186 214 172 226 160 234', 'M 208 196 C 228 210 252 222 278 228', 'M 214 186 C 236 200 262 214 290 226'],
      },
      { sil: [...legF, E(362, 162, 12, 6, -18)], d: ['M 270 186 Q 286 190 300 182'] },
      { sil: [...legB, E(40, 238, 12, 6, 16)], d: ['M 120 208 Q 132 214 146 210'] },
      { sil: [...armB, E(74, 90, 9, 6, 20)] },
    ]),
    {
      p: [],
      d: [
        ribbonF, 'M 120 330 C 160 316 240 316 280 330', 'M 150 346 C 180 338 220 338 250 346', 'M 50 140 L 100 150', 'M 40 170 L 92 176',
        'M 300 270 L 350 262', 'M 312 296 L 360 290',
      ],
    },
  );
}

function scarfWoman(): Art {
  const scarf = 'M 200 52 C 278 52 318 112 314 190 C 312 240 300 280 272 306 C 252 320 232 324 214 322 L 186 322 C 168 324 148 320 128 306 C 100 280 88 240 86 190 C 82 112 122 52 200 52 Z';
  const face = 'M 200 100 C 246 100 270 136 270 188 C 270 228 260 256 244 276 C 230 294 216 302 200 302 C 184 302 170 294 156 276 C 140 256 130 228 130 188 C 130 136 154 100 200 100 Z';
  const knot = smooth([[182, 312], [200, 302], [218, 312], [214, 334], [200, 340], [186, 334]]);
  const tailL = smooth([[188, 330], [170, 350], [154, 372], [176, 374], [196, 340]]);
  const tailR = smooth([[212, 330], [234, 354], [250, 372], [226, 374], [204, 340]]);
  const dots: string[] = [];
  for (let y = 70; y < 320; y += 26) for (let x = 90 + ((y / 26) % 2) * 13; x < 312; x += 26) dots.push(circle(x, y, 3));
  const pattern = clip(dots.join(' '), [region(face)]);
  const wrinkles = [
    'M 166 130 Q 200 122 234 130', 'M 172 142 Q 200 136 228 142', 'M 132 198 Q 140 206 144 202 M 134 208 Q 142 214 146 210', 'M 268 198 Q 260 206 256 202 M 266 208 Q 258 214 254 210',
    'M 168 224 C 160 240 160 256 168 268', 'M 232 224 C 240 240 240 256 232 268', 'M 176 290 Q 200 298 224 290', 'M 152 238 Q 148 250 152 262',
    'M 248 238 Q 252 250 248 262', 'M 186 160 L 190 168 M 214 160 L 210 168',
  ];
  const folds = ['M 120 100 C 140 150 140 230 124 290', 'M 280 100 C 260 150 260 230 276 290', 'M 160 64 C 176 80 190 92 200 100', 'M 240 64 C 224 80 210 92 200 100', 'M 100 160 C 110 200 110 240 104 270', 'M 300 160 C 290 200 290 240 296 270'];
  const e = eye(166, 196, 17, 7.5, { lower: 0.15 });
  const b = { p: [brow(166, 172, 20, -3, 6)], d: [] };
  return join(
    layered([
      { sil: knot, d: ['M 192 314 Q 200 322 208 314'] },
      { sil: tailL, d: ['M 180 350 L 166 376'] },
      { sil: tailR, d: ['M 222 352 L 236 378'] },
      { sil: face, d: wrinkles },
      { sil: scarf, d: [...folds, ...[0, 1, 2, 3].map((k) => inside(pattern.split(/(?= M )/).filter((_, i) => i % 4 === k).join(' '), scarf))] },
      { sil: '', p: ['M 128 306 C 100 330 70 346 50 384', 'M 272 306 C 300 330 330 346 350 384'] },
    ]),
    e,
    mirrorArt(e),
    b,
    mirrorArt(b),
    nose(200, 244, 0.95),
    lips(200, 272, 20, 0.7, 2),
  );
}

/** One eye-pair panel for the expressions sheet, centred on (cx, cy). */
function eyePanel(cx: number, cy: number, kind: 'happy' | 'sad' | 'surprised' | 'sleepy'): Art {
  const s = 0.72;
  const x1 = cx - 40;
  const x2 = cx + 40;
  const w = 26 * s * 1.3;
  const h = 10 * s * 1.3;
  const o: EyeO =
    kind === 'happy' ? { lower: 0.55, lashes: true } : kind === 'sleepy' ? { lid: 0.55, lashes: true } : kind === 'surprised' ? { lashes: true } : { lashes: true, look: [0, 2] };
  const hh = kind === 'surprised' ? h * 1.5 : h;
  const eL = eye(x1, cy, w, hh, o);
  const eR = eye(x2, cy, w, hh, o);
  const lift = kind === 'surprised' ? -10 : kind === 'sleepy' ? 2 : 0;
  const tilt = kind === 'sad' ? 14 : kind === 'happy' ? -4 : 0;
  const bL = brow(x1, cy - 28 + lift, w * 1.05, tilt, kind === 'surprised' ? 12 : 7);
  const bR = brow(x2, cy - 28 + lift, w * 1.05, -tilt, kind === 'surprised' ? 12 : 7);
  const extra =
    kind === 'happy'
      ? [`M ${f(x1 - w - 6)} ${f(cy + 4)} Q ${f(x1 - w - 2)} ${f(cy + 10)} ${f(x1 - w + 6)} ${f(cy + 12)}`, `M ${f(x2 + w + 6)} ${f(cy + 4)} Q ${f(x2 + w + 2)} ${f(cy + 10)} ${f(x2 + w - 6)} ${f(cy + 12)}`]
      : kind === 'sad'
        ? [`M ${f(x1 - 10)} ${f(cy + 14)} Q ${f(x1)} ${f(cy + 18)} ${f(x1 + 10)} ${f(cy + 14)}`, `M ${f(x2 - 10)} ${f(cy + 14)} Q ${f(x2)} ${f(cy + 18)} ${f(x2 + 10)} ${f(cy + 14)}`]
        : kind === 'surprised'
          ? [`M ${f(cx - 14)} ${f(cy - 50)} Q ${f(cx)} ${f(cy - 54)} ${f(cx + 14)} ${f(cy - 50)}`]
          : [`M ${f(x1 - 12)} ${f(cy + 12)} Q ${f(x1)} ${f(cy + 16)} ${f(x1 + 12)} ${f(cy + 12)}`, `M ${f(x2 - 12)} ${f(cy + 12)} Q ${f(x2)} ${f(cy + 16)} ${f(x2 + 12)} ${f(cy + 12)}`];
  return join(eL, eR, { p: [bL, bR], d: extra }, { p: [rrect(cx - 86, cy - 76, 172, 150, 14)], d: [] });
}

function eyeSheet(): Art {
  return join(eyePanel(108, 112, 'happy'), eyePanel(292, 112, 'sad'), eyePanel(108, 286, 'surprised'), eyePanel(292, 286, 'sleepy'));
}

/** One mouth panel for the lips sheet, centred on (cx, cy). */
function lipsPanel(cx: number, cy: number, kind: 'neutral' | 'smile' | 'pout' | 'laugh'): Art {
  const frame = rrect(cx - 86, cy - 76, 172, 150, 14);
  const noseBase = `M ${f(cx - 14)} ${f(cy - 42)} Q ${f(cx - 8)} ${f(cy - 36)} ${f(cx)} ${f(cy - 38)} Q ${f(cx + 8)} ${f(cy - 36)} ${f(cx + 14)} ${f(cy - 42)}`;
  const philtrum = `M ${f(cx - 5)} ${f(cy - 34)} L ${f(cx - 6)} ${f(cy - 16)} M ${f(cx + 5)} ${f(cy - 34)} L ${f(cx + 6)} ${f(cy - 16)}`;
  const texture = (y0: number, w: number) =>
    `M ${f(cx - w * 0.35)} ${f(y0 + 9)} Q ${f(cx)} ${f(y0 + 13)} ${f(cx + w * 0.35)} ${f(y0 + 9)} M ${f(cx - w * 0.5)} ${f(y0 - 6)} Q ${f(cx - w * 0.3)} ${f(y0 - 9)} ${f(cx - w * 0.12)} ${f(y0 - 7)}`;
  if (kind === 'neutral' || kind === 'pout') {
    const l = kind === 'pout' ? lips(cx, cy, 34, 1.7, -3) : lips(cx, cy, 46, 1.4, 0);
    return join(l, { p: [frame], d: [noseBase, philtrum, texture(cy, kind === 'pout' ? 28 : 40), `M ${f(cx - 10)} ${f(cy + 30)} Q ${f(cx)} ${f(cy + 34)} ${f(cx + 10)} ${f(cy + 30)}`] });
  }
  if (kind === 'smile') {
    const outer = `M ${f(cx - 52)} ${f(cy - 8)} C ${f(cx - 30)} ${f(cy - 18)} ${f(cx - 10)} ${f(cy - 16)} ${f(cx)} ${f(cy - 12)} C ${f(cx + 10)} ${f(cy - 16)} ${f(cx + 30)} ${f(cy - 18)} ${f(cx + 52)} ${f(cy - 8)} C ${f(cx + 36)} ${f(cy + 34)} ${f(cx - 36)} ${f(cy + 34)} ${f(cx - 52)} ${f(cy - 8)} Z`;
    const opening = `M ${f(cx - 44)} ${f(cy - 6)} Q ${f(cx)} ${f(cy - 8)} ${f(cx + 44)} ${f(cy - 6)} Q ${f(cx)} ${f(cy + 26)} ${f(cx - 44)} ${f(cy - 6)} Z`;
    const teeth = [-30, -18, -6, 6, 18, 30].map((x) => `M ${f(cx + x)} ${f(cy - 7)} L ${f(cx + x)} ${f(cy + 4)}`).join(' ');
    return join({ p: [outer, opening], d: [inside(teeth, opening), `M ${f(cx - 44)} ${f(cy + 2)} Q ${f(cx)} ${f(cy + 8)} ${f(cx + 44)} ${f(cy + 2)}`, noseBase, philtrum, `M ${f(cx - 62)} ${f(cy - 14)} Q ${f(cx - 58)} ${f(cy - 4)} ${f(cx - 62)} ${f(cy + 4)}`, `M ${f(cx + 62)} ${f(cy - 14)} Q ${f(cx + 58)} ${f(cy - 4)} ${f(cx + 62)} ${f(cy + 4)}`] }, { p: [frame], d: [] });
  }
  const outer = `M ${f(cx - 44)} ${f(cy - 10)} C ${f(cx - 26)} ${f(cy - 24)} ${f(cx - 8)} ${f(cy - 22)} ${f(cx)} ${f(cy - 18)} C ${f(cx + 8)} ${f(cy - 22)} ${f(cx + 26)} ${f(cy - 24)} ${f(cx + 44)} ${f(cy - 10)} C ${f(cx + 40)} ${f(cy + 40)} ${f(cx - 40)} ${f(cy + 40)} ${f(cx - 44)} ${f(cy - 10)} Z`;
  const opening = `M ${f(cx - 36)} ${f(cy - 8)} Q ${f(cx)} ${f(cy - 14)} ${f(cx + 36)} ${f(cy - 8)} Q ${f(cx + 30)} ${f(cy + 30)} ${f(cx)} ${f(cy + 30)} Q ${f(cx - 30)} ${f(cy + 30)} ${f(cx - 36)} ${f(cy - 8)} Z`;
  const tongue = `M ${f(cx - 22)} ${f(cy + 26)} Q ${f(cx - 20)} ${f(cy + 10)} ${f(cx)} ${f(cy + 12)} Q ${f(cx + 20)} ${f(cy + 10)} ${f(cx + 22)} ${f(cy + 26)}`;
  const teeth = `M ${f(cx - 30)} ${f(cy - 2)} Q ${f(cx)} ${f(cy + 2)} ${f(cx + 30)} ${f(cy - 2)}`;
  return join({ p: [outer, opening, inside(tongue, opening)], d: [inside(teeth, opening), `M ${f(cx)} ${f(cy + 14)} L ${f(cx)} ${f(cy + 24)}`, noseBase, philtrum, `M ${f(cx - 54)} ${f(cy - 18)} Q ${f(cx - 52)} ${f(cy)} ${f(cx - 58)} ${f(cy + 10)}`, `M ${f(cx + 54)} ${f(cy - 18)} Q ${f(cx + 52)} ${f(cy)} ${f(cx + 58)} ${f(cy + 10)}`] }, { p: [frame], d: [] });
}

function lipsSheet(): Art {
  return join(lipsPanel(108, 112, 'neutral'), lipsPanel(292, 112, 'smile'), lipsPanel(108, 286, 'pout'), lipsPanel(292, 286, 'laugh'));
}

export const figures2: Template[] = [
  // beginner
  tpl('heart-hands', 'Hands making a heart', 'beginner', ['hand', 'hands', 'heart', 'love', 'gesture'], heartHands()),
  tpl('peace-hand', 'Hand making a peace sign', 'beginner', ['hand', 'gesture', 'fingers', 'stylized'], peaceHand()),
  tpl('thumbs-up', 'Thumbs-up hand', 'beginner', ['hand', 'gesture', 'thumb', 'stylized'], thumbsUp()),
  tpl('face-guide', 'Face proportions guide', 'beginner', ['face', 'proportions', 'guide', 'study'], faceGuide()),
  tpl('runner', 'Running figure', 'beginner', ['figure', 'runner', 'sport', 'motion'], runner()),
  tpl('yoga-tree', 'Figure in a yoga tree pose', 'beginner', ['figure', 'yoga', 'balance', 'pose'], yogaTree()),
  tpl('parent-child', 'Parent and child figures holding hands', 'beginner', ['figure', 'family', 'child', 'love'], parentChild()),
  tpl('profile-hat', 'Man in profile wearing a hat', 'beginner', ['man', 'profile', 'hat', 'portrait'], profileHat()),
  // intermediate
  tpl('cup-hands', 'Hands holding a warm cup', 'intermediate', ['hand', 'hands', 'cup', 'cosy'], cupHands()),
  tpl('eye-study', 'Eye close-up study', 'intermediate', ['eye', 'iris', 'lashes', 'study'], eyeStudy()),
  tpl('braid-girl', 'Girl with a side braid portrait', 'intermediate', ['girl', 'portrait', 'braid', 'hairstyle'], braidGirl()),
  tpl('curly-woman', 'Woman with curly hair portrait', 'intermediate', ['woman', 'portrait', 'curls', 'hairstyle'], curlyWoman()),
  tpl('sitting-knees', 'Figure sitting and hugging knees', 'intermediate', ['figure', 'sitting', 'pose', 'calm'], sittingKnees()),
  tpl('elderly-man', 'Elderly man with a moustache portrait', 'intermediate', ['man', 'portrait', 'elderly', 'moustache'], elderlyMan()),
  // advanced
  tpl('dancer-leap', 'Dancer in a split leap', 'advanced', ['dancer', 'figure', 'ballet', 'motion'], dancerLeap()),
  tpl('scarf-woman', 'Elderly woman in a headscarf portrait', 'advanced', ['woman', 'portrait', 'elderly', 'headscarf'], scarfWoman()),
  tpl('eye-sheet', 'Eye expressions study sheet', 'advanced', ['eye', 'eyes', 'expressions', 'study'], eyeSheet()),
  tpl('lips-sheet', 'Lips and mouth expressions study sheet', 'advanced', ['lips', 'mouth', 'expressions', 'study'], lipsSheet()),
];
