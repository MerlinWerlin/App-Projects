// T83 trip cover art: the eight original scenes as plain shape lists (no React, so Node can test them and a script
// can draw them). src/ui/TripCover.tsx turns each shape into a react-native-svg element and fills it from the scene's
// palette in src/theme/tokens.ts (a day palette in light mode, a dusk / night one in dark mode).
//
// Canvas: 400 x 200, drawn with preserveAspectRatio "xMidYMax slice", so a wide strip crops sky off the top and a
// narrower tile crops the sides: everything that matters sits between x 40-360 and below y 66. Each scene is simple
// shapes only (layered hills, roofs, waves, a sun / moon) and stays well under MAX_SHAPES elements.
//
// T152 redraw (until bundled art lands, src/core/covers2.ts): every scene now has 3-5 depth layers back to front
// with a band of horizon haze ('haze' shapes, drawn as a sky1 gradient) between them so far layers fade into the air,
// soft clouds, shaded faces on the side away from the light (shade helpers below), and the renderer adds a three-step
// sky, a layered sun / moon glow, a crescent moon at night, a fine grain texture and a gentle bottom scrim.
import type { CoverId } from './covers.ts';

export const COVER_W = 400;
export const COVER_H = 200;
/** Ceiling per scene (elements drawn), kept low so lists of covers stay quick. */
export const MAX_SHAPES = 48;

/** Colour slots every scene palette fills (src/theme/tokens.ts coverPalettes). */
export const COVER_PAINTS = ['sky0', 'sky1', 'glow', 'far', 'mid', 'near', 'accent', 'detail'] as const;
export type CoverPaint = (typeof COVER_PAINTS)[number];

type Common = {
  fill?: CoverPaint;
  stroke?: CoverPaint;
  sw?: number;
  /** Opacity 0-1. */
  o?: number;
  /** Drawn only in the day (light) or night (dark) version. */
  only?: 'day' | 'night';
};
export type CoverShape =
  | (Common & { k: 'path'; d: string })
  | (Common & { k: 'circle'; cx: number; cy: number; r: number })
  | (Common & { k: 'rect'; x: number; y: number; w: number; h: number; rx?: number })
  /** T152: a band of air from y to y + h: the fill colour fading in from clear at the top (aerial depth). */
  | (Common & { k: 'haze'; y: number; h: number });

export type CoverScene = {
  /** The sun (day) or moon (night): drawn with a soft halo behind it. */
  sun: { cx: number; cy: number; r: number };
  shapes: readonly CoverShape[];
};

// ---- small path helpers (run once, when the module loads) ----

const r1 = (n: number) => Math.round(n * 10) / 10;

/** One closed outline of buildings standing on `base`: [width, height] each, left to right from x0. */
function skyline(x0: number, base: number, blocks: ReadonlyArray<readonly [number, number]>): string {
  let x = x0;
  let d = `M${x} ${base}`;
  for (const [w, h] of blocks) {
    d += ` V${base - h} H${x + w}`;
    x += w;
  }
  return `${d} V${base} Z`;
}

/** Small rectangles (windows, sun glints) as one path. */
const rects = (list: ReadonlyArray<readonly [number, number, number, number]>) => list.map(([x, y, w, h]) => `M${x} ${y} h${w} v${h} h${-w} Z`).join(' ');

/** Tiny dots (stars, snowflakes) as one path of circles. */
const dots = (list: ReadonlyArray<readonly [number, number, number]>) =>
  list.map(([x, y, r]) => `M${r1(x - r)} ${y} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0 Z`).join(' ');

/** A jagged range from (x0, base) through each [x, y] peak / dip to (x1, base). */
const range = (x0: number, x1: number, base: number, pts: ReadonlyArray<readonly [number, number]>) =>
  `M${x0} ${base} ${pts.map(([x, y]) => `L${x} ${y}`).join(' ')} L${x1} ${base} Z`;

/** A smooth hill line through points (quadratic midpoints), closed down to the bottom of the canvas. */
function hills(pts: ReadonlyArray<readonly [number, number]>, bottom = COVER_H): string {
  let d = `M${pts[0][0]} ${bottom} L${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i];
    const [nx, ny] = pts[i + 1];
    d += ` Q${x} ${y} ${r1((x + nx) / 2)} ${r1((y + ny) / 2)}`;
  }
  const last = pts[pts.length - 1];
  return `${d} L${last[0]} ${last[1]} L${last[0]} ${bottom} Z`;
}

/** Pine trees: [x, base, height] each, as one path of stacked triangles. */
const pines = (list: ReadonlyArray<readonly [number, number, number]>) =>
  list
    .map(([x, b, h]) => {
      const w = h * 0.42;
      return `M${x} ${b - h} L${r1(x + w * 0.7)} ${r1(b - h * 0.45)} L${r1(x + w * 0.35)} ${r1(b - h * 0.45)} L${r1(x + w)} ${b - h * 0.08} L${r1(x - w)} ${b - h * 0.08} L${r1(x - w * 0.35)} ${r1(b - h * 0.45)} L${r1(x - w * 0.7)} ${r1(b - h * 0.45)} Z M${r1(x - 1.2)} ${r1(b - h * 0.1)} h2.4 V${b} h-2.4 Z`;
    })
    .join(' ');

/** A palm: curved trunk from (x, base) leaning by `lean`, with five fronds at the top. */
function palm(x: number, base: number, h: number, lean: number): { trunk: string; fronds: string } {
  const tx = x + lean;
  const ty = base - h;
  const trunk = `M${x} ${base} Q${r1(x + lean * 0.2)} ${r1(base - h * 0.6)} ${tx} ${ty}`;
  const f = (dx: number, dy: number) => {
    const ex = tx + dx;
    const ey = ty + dy;
    const cx = r1(tx + dx * 0.5);
    const cy = r1(ty + Math.min(dy, 0) - 9);
    return `M${tx} ${ty} Q${cx} ${cy} ${r1(ex)} ${r1(ey)} Q${r1(cx + dx * 0.05)} ${r1(cy + 6)} ${tx} ${ty + 1} Z`;
  };
  return { trunk, fronds: [f(-24, 10), f(-16, -4), f(4, -10), f(20, -2), f(26, 12)].join(' ') };
}

/** Wave lines: a row of soft arcs at height y from x0 to x1. */
function waves(x0: number, x1: number, y: number, step: number, amp: number): string {
  let d = `M${x0} ${y}`;
  for (let x = x0; x < x1; x += step) d += ` q${step / 4} ${-amp} ${step / 2} 0 q${step / 4} ${amp} ${step / 2} 0`;
  return d;
}

/** T152: a soft cloud resting on a flat base line y, from x, s = scale (about 36s wide), as one path. */
function cloud(x: number, y: number, s: number): string {
  const puff = (dx: number, r: number) => [r1(x + dx * s), r1(y - r * s), r1(r * s)] as const;
  const puffs = dots([puff(5, 5), puff(13, 8), puff(23, 6.5), puff(31, 4.5)]);
  // the base runs the same way round as the puffs, so overlaps stay filled
  return `${puffs} M${r1(x + 5 * s)} ${r1(y - 5 * s)} V${y} H${r1(x + 31 * s)} V${r1(y - 5 * s)} Z`;
}

/**
 * T152: the shaded faces of a jagged range: under every slope that falls to the right, the area down to the base,
 * so each peak gets a lit side and a shadow side (light from the left).
 */
function rangeShade(base: number, pts: ReadonlyArray<readonly [number, number]>): string {
  let d = '';
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    if (y1 > y0 + 4) d += `M${x0} ${y0} L${x1} ${y1} L${x1} ${base} L${r1(x0 + (x1 - x0) * 0.35)} ${base} Z `;
  }
  return d.trim();
}

/** T152: a thin shadow strip down the right side of each block of a skyline (as rects()). */
function skylineShade(x0: number, base: number, blocks: ReadonlyArray<readonly [number, number]>, w = 5): string {
  let x = x0;
  const out: Array<readonly [number, number, number, number]> = [];
  for (const [bw, h] of blocks) {
    out.push([r1(x + bw - Math.min(w, bw / 3)), base - h, r1(Math.min(w, bw / 3)), h]);
    x += bw;
  }
  return rects(out);
}

/** Soft cloud shapes for a scene (day bright, night faint). */
const clouds = (d: string, day = 0.62, night = 0.2): CoverShape[] => [
  { k: 'path', d, fill: 'sky1', o: day, only: 'day' },
  { k: 'path', d, fill: 'sky1', o: night, only: 'night' },
];

/** Horizon haze band. */
const haze = (y: number, h: number, o = 0.7): CoverShape => ({ k: 'haze', y, h, fill: 'sky1', o });

// ---- stars for every night sky (a few, kept clear of the sun / moon) ----
const STARS = dots([
  [52, 76, 1.1],
  [96, 92, 0.9],
  [148, 72, 1.2],
  [190, 98, 0.8],
  [236, 78, 1],
  [352, 74, 1.2],
  [378, 96, 0.8],
  [20, 98, 0.9],
  [170, 84, 0.7],
]);
const stars: CoverShape = { k: 'path', d: STARS, fill: 'glow', o: 0.85, only: 'night' };

// ---- the scenes ----

const city: CoverScene = (() => {
  const far = skyline(0, 160, [
    [22, 30], [18, 44], [26, 36], [14, 58], [30, 40], [20, 50], [24, 34], [16, 62], [28, 42], [22, 48], [18, 38], [26, 56], [20, 36], [30, 46], [18, 40], [24, 52], [22, 34], [42, 44],
  ]);
  const nearBlocks = [
    [30, 40], [24, 62], [34, 48], [20, 84], [28, 56], [36, 70], [22, 46], [30, 96], [26, 58], [34, 74], [24, 50], [30, 66], [22, 88], [40, 52], [20, 44],
  ] as const;
  const near = skyline(0, 172, nearBlocks);
  // T152: a hazy back row of slim towers behind everything
  const back = skyline(6, 150, [
    [26, 24], [12, 52], [30, 30], [18, 40], [40, 22], [14, 66], [34, 28], [20, 44], [44, 26], [16, 58], [30, 32], [22, 46], [36, 24], [14, 50], [32, 30],
  ]);
  const winCols = [
    [57, 118, 3], [64, 118, 3], [57, 128, 3], [64, 138, 3], [116, 104, 3], [123, 114, 3], [116, 124, 3], [123, 134, 3],
    [189, 86, 3], [196, 96, 3], [189, 106, 3], [196, 116, 3], [189, 126, 3], [258, 108, 3], [265, 118, 3], [258, 128, 3],
    [319, 94, 3], [326, 104, 3], [319, 114, 3], [326, 134, 3],
  ] as const;
  const windows = rects(winCols.map(([x, y, s]) => [x, y, s, s + 2] as const));
  return {
    sun: { cx: 300, cy: 92, r: 18 },
    shapes: [
      stars,
      ...clouds(cloud(56, 92, 1.3) + ' ' + cloud(226, 80, 0.9)),
      { k: 'path', d: back, fill: 'far', o: 0.5 },
      haze(104, 48),
      { k: 'path', d: far, fill: 'far' },
      haze(128, 34, 0.5),
      { k: 'rect', x: 171, y: 66, w: 1.6, h: 14, fill: 'mid' },
      { k: 'path', d: near, fill: 'mid' },
      { k: 'path', d: skylineShade(0, 172, nearBlocks, 7), fill: 'near', o: 0.35 },
      { k: 'path', d: windows, fill: 'detail', o: 0.9 },
      { k: 'rect', x: 0, y: 170, w: 400, h: 30, fill: 'near' },
      { k: 'path', d: rects([[284, 178, 32, 2], [290, 184, 20, 2], [295, 190, 10, 2]]), fill: 'glow', o: 0.55 },
      { k: 'path', d: rects([[40, 180, 40, 1.5], [120, 186, 60, 1.5], [210, 179, 30, 1.5], [340, 186, 44, 1.5]]), fill: 'accent', o: 0.6 },
    ],
  };
})();

const mountains: CoverScene = (() => {
  const farRange = range(0, 400, 150, [[0, 118], [40, 96], [70, 110], [110, 86], [150, 108], [196, 90], [236, 112], [282, 84], [326, 106], [364, 92], [400, 108]]);
  const midPts = [[0, 150], [60, 104], [92, 126], [150, 76], [206, 132], [250, 100], [286, 122], [338, 80], [400, 138]] as const;
  const midRange = range(0, 400, 170, midPts);
  const backPts = [[0, 104], [52, 78], [96, 98], [176, 70], [226, 92], [300, 66], [352, 88], [400, 76]] as const;
  const caps = [
    'M150 76 L166 95 L159 93 L153 99 L146 92 L138 96 Z',
    'M338 80 L352 96 L346 94 L340 100 L333 94 L324 97 Z',
    'M60 104 L71 117 L65 115 L60 120 L55 115 L49 118 Z',
    'M250 100 L260 111 L255 110 L250 114 L245 110 L240 112 Z',
  ].join(' ');
  return {
    sun: { cx: 108, cy: 90, r: 16 },
    shapes: [
      stars,
      ...clouds(cloud(186, 84, 1.2) + ' ' + cloud(300, 98, 0.8)),
      { k: 'path', d: range(0, 400, 140, backPts), fill: 'far', o: 0.45 },
      haze(80, 60),
      { k: 'path', d: farRange, fill: 'far' },
      haze(104, 46, 0.55),
      { k: 'path', d: midRange, fill: 'mid' },
      { k: 'path', d: rangeShade(170, midPts), fill: 'near', o: 0.22 },
      { k: 'path', d: caps, fill: 'detail' },
      { k: 'rect', x: 0, y: 160, w: 400, h: 14, fill: 'glow', o: 0.35 },
      { k: 'path', d: hills([[0, 172], [70, 160], [150, 176], [240, 162], [320, 174], [400, 158]]), fill: 'near' },
      { k: 'path', d: pines([[28, 176, 26], [44, 172, 20], [296, 178, 24], [312, 176, 30], [330, 180, 22], [372, 170, 26]]), fill: 'accent' },
    ],
  };
})();

const coast: CoverScene = (() => {
  return {
    sun: { cx: 214, cy: 112, r: 22 },
    shapes: [
      stars,
      ...clouds(cloud(52, 92, 1.3) + ' ' + cloud(262, 82, 0.9)),
      // T152: a far headland in the haze, then the near one
      { k: 'path', d: 'M150 132 Q190 122 236 126 Q262 120 288 132 Z', fill: 'far', o: 0.45 },
      { k: 'path', d: 'M0 132 L0 116 Q30 106 60 114 Q86 104 120 120 Q136 126 150 132 Z', fill: 'far' },
      haze(108, 26, 0.45),
      { k: 'rect', x: 0, y: 131, w: 400, h: 69, fill: 'accent' },
      // a lighter band of water by the horizon
      { k: 'rect', x: 0, y: 131, w: 400, h: 6, fill: 'sky1', o: 0.35 },
      { k: 'path', d: rects([[186, 138, 56, 2.5], [196, 146, 36, 2.5], [204, 154, 20, 2.5], [208, 161, 12, 2]]), fill: 'glow', o: 0.7 },
      { k: 'path', d: waves(20, 380, 168, 40, 3), stroke: 'detail', sw: 1.6, o: 0.45 },
      // cliff and a small striped lighthouse on the right
      { k: 'path', d: 'M290 200 L290 142 Q300 126 322 122 L360 118 Q386 118 400 126 L400 200 Z', fill: 'mid' },
      { k: 'path', d: 'M290 200 L290 142 Q300 126 322 122 L312 150 Q304 176 310 200 Z', fill: 'near', o: 0.28 },
      { k: 'path', d: 'M290 168 Q280 172 270 170', stroke: 'detail', sw: 1.4, o: 0.6 },
      { k: 'path', d: 'M340 120 L342 88 L350 88 L352 120 Z', fill: 'detail' },
      { k: 'path', d: 'M341.2 104 L350.8 104 L351.3 111 L340.7 111 Z M342.3 90 L349.7 90 L350.1 96 L341.9 96 Z', fill: 'near' },
      { k: 'path', d: 'M340 88 L346 80 L352 88 Z', fill: 'near' },
      { k: 'circle', cx: 346, cy: 86, r: 2.2, fill: 'glow' },
      // sand
      { k: 'path', d: 'M0 200 L0 176 Q80 166 170 178 Q240 188 300 200 Z', fill: 'near' },
      { k: 'path', d: 'M0 177 Q80 167 170 179 Q240 189 300 200', stroke: 'detail', sw: 2, o: 0.7 },
      { k: 'path', d: 'M120 94 q4 -4 8 0 q4 -4 8 0 M146 104 q3 -3 6 0 q3 -3 6 0', stroke: 'mid', sw: 1.6, only: 'day' },
    ],
  };
})();

const oldtown: CoverScene = (() => {
  // [x, width, wallTop, roof peak height]
  const houses = [
    [0, 38, 128, 20],
    [38, 30, 116, 18],
    [68, 42, 134, 22],
    [110, 34, 120, 20],
    [196, 36, 126, 18],
    [232, 44, 112, 24],
    [276, 32, 130, 18],
    [308, 40, 118, 22],
    [348, 52, 132, 20],
  ] as const;
  const base = 176;
  const walls = houses.map(([x, w, top]) => `M${x} ${base} V${top} H${x + w} V${base} Z`).join(' ');
  const tint = houses
    .filter((_, i) => i % 2 === 1)
    .map(([x, w, top]) => `M${x} ${base} V${top} H${x + w} V${base} Z`)
    .join(' ');
  const roofs = houses.map(([x, w, top, h]) => `M${x - 2} ${top + 1} L${x + w / 2} ${top - h} L${x + w + 2} ${top + 1} Z`).join(' ');
  // T152: the right half of each roof in shade, and a shadow strip down each wall's right side
  const roofShade = houses.map(([x, w, top, h]) => `M${x + w / 2} ${top - h} L${x + w + 2} ${top + 1} L${x + w / 2} ${top + 1} Z`).join(' ');
  const wallShade = rects(houses.map(([x, w, top]) => [x + w - 5, top, 5, base - top] as const));
  const win: Array<readonly [number, number, number, number]> = [];
  for (const [x, w, top] of houses) {
    const n = w > 40 ? 3 : 2;
    const gap = w / (n + 1);
    for (let i = 1; i <= n; i++) {
      win.push([r1(x + gap * i - 3), top + 10, 6, 8]);
      if (base - top > 50) win.push([r1(x + gap * i - 3), top + 26, 6, 8]);
    }
  }
  const doors = houses.filter((_, i) => i % 3 !== 2).map(([x, w]) => [r1(x + w / 2 - 4), base - 14, 8, 14] as const);
  return {
    sun: { cx: 92, cy: 84, r: 15 },
    shapes: [
      stars,
      ...clouds(cloud(206, 86, 1.2) + ' ' + cloud(318, 98, 0.8)),
      { k: 'path', d: hills([[0, 124], [70, 108], [170, 120], [260, 100], [340, 114], [400, 106]]), fill: 'far', o: 0.4 },
      haze(96, 40, 0.6),
      { k: 'path', d: hills([[0, 138], [90, 118], [200, 132], [300, 112], [400, 128]]), fill: 'far', o: 0.7 },
      haze(116, 30, 0.45),
      // a clock tower with a pointed spire between the houses
      { k: 'path', d: 'M150 176 V100 L164 72 L178 100 V176 Z', fill: 'far' },
      { k: 'path', d: 'M144 176 V104 H184 V176 Z', fill: 'mid' },
      { k: 'path', d: 'M141 105 L164 70 L187 105 Z', fill: 'accent' },
      { k: 'circle', cx: 164, cy: 118, r: 7, fill: 'detail' },
      { k: 'path', d: 'M164 113 V118 H168', stroke: 'near', sw: 1.4 },
      { k: 'path', d: 'M158 140 h12 v18 h-12 Z', fill: 'detail' },
      { k: 'path', d: walls, fill: 'mid' },
      { k: 'path', d: tint, fill: 'accent', o: 0.16 },
      { k: 'path', d: wallShade, fill: 'near', o: 0.2 },
      { k: 'path', d: roofs, fill: 'accent' },
      { k: 'path', d: roofShade, fill: 'near', o: 0.25 },
      { k: 'path', d: rects(win), fill: 'detail' },
      { k: 'path', d: rects(doors), fill: 'near' },
      { k: 'rect', x: 0, y: 176, w: 400, h: 24, fill: 'near' },
      { k: 'path', d: 'M0 186 H400 M0 194 H400', stroke: 'mid', sw: 1, o: 0.25 },
    ],
  };
})();

const countryside: CoverScene = (() => {
  const rows = [0, 1, 2, 3, 4]
    .map((i) => `M${-10 + i * 6} ${150 + i * 7} Q140 ${132 + i * 7} ${290 - i * 6} ${150 + i * 8}`)
    .join(' ');
  const trees = dots([
    [300, 136, 7],
    [312, 140, 5],
    [64, 152, 6],
    [356, 160, 8],
    [374, 162, 6],
  ]);
  const trunks = rects([[299, 140, 2, 6], [311, 143, 2, 5], [63, 156, 2, 6], [355, 166, 2.4, 8], [373, 166, 2, 6]]);
  return {
    sun: { cx: 296, cy: 92, r: 17 },
    shapes: [
      stars,
      ...clouds(cloud(46, 90, 1.3) + ' ' + cloud(166, 78, 0.9)),
      { k: 'path', d: hills([[0, 116], [60, 100], [150, 112], [230, 94], [320, 106], [400, 98]]), fill: 'far', o: 0.45 },
      haze(88, 40, 0.6),
      { k: 'path', d: hills([[0, 128], [80, 108], [170, 124], [260, 104], [340, 118], [400, 110]]), fill: 'far' },
      haze(106, 34, 0.45),
      { k: 'path', d: hills([[0, 150], [100, 130], [210, 146], [300, 128], [400, 144]]), fill: 'mid' },
      // T152: shade in the folds between the hills
      { k: 'path', d: hills([[120, 150], [170, 142], [230, 152], [300, 138], [400, 152]]), fill: 'near', o: 0.18 },
      { k: 'path', d: rows, stroke: 'detail', sw: 1.4, o: 0.35 },
      // farmhouse with a barn roof
      { k: 'path', d: 'M196 146 V128 H226 V146 Z', fill: 'detail' },
      { k: 'path', d: 'M193 129 L203 116 L219 116 L229 129 Z', fill: 'accent' },
      { k: 'path', d: 'M207 146 V136 h8 V146 Z', fill: 'near' },
      { k: 'path', d: dots([[306, 147, 6], [62, 162, 5], [362, 174, 7]]), fill: 'near', o: 0.25 },
      { k: 'path', d: trunks, fill: 'near' },
      { k: 'path', d: trees, fill: 'near' },
      { k: 'path', d: dots([[298, 133, 3], [62, 149, 2.5], [353, 156, 3.5]]), fill: 'detail', o: 0.25 },
      { k: 'path', d: hills([[0, 178], [90, 164], [200, 182], [300, 166], [400, 180]]), fill: 'near' },
      { k: 'path', d: 'M150 200 Q190 184 240 176 Q262 172 280 170', stroke: 'detail', sw: 3, o: 0.5 },
    ],
  };
})();

const snow: CoverScene = (() => {
  const peakPts = [[0, 128], [50, 92], [96, 118], [150, 84], [204, 116], [262, 88], [318, 112], [366, 90], [400, 104]] as const;
  const peaks = range(0, 400, 150, peakPts);
  const backPeaks = range(0, 400, 130, [[0, 100], [70, 76], [120, 96], [200, 68], [250, 90], [320, 72], [400, 92]]);
  const caps = [
    'M50 92 L62 104 L55 103 L50 108 L45 103 L38 104 Z',
    'M150 84 L164 99 L157 97 L151 103 L145 98 L137 100 Z',
    'M262 88 L275 102 L268 100 L262 106 L257 101 L249 103 Z',
    'M366 90 L377 102 L371 101 L366 105 L361 101 L355 102 Z',
  ].join(' ');
  const flakes = dots([
    [30, 120, 1.5], [78, 140, 1.2], [120, 108, 1.6], [176, 132, 1.2], [214, 104, 1.4], [246, 140, 1.6], [290, 122, 1.2], [334, 140, 1.5], [380, 118, 1.3], [140, 160, 1.4], [360, 176, 1.2],
  ]);
  return {
    sun: { cx: 214, cy: 92, r: 14 },
    shapes: [
      stars,
      ...clouds(cloud(80, 82, 1.1), 0.65, 0.18),
      { k: 'path', d: backPeaks, fill: 'far', o: 0.4 },
      haze(80, 50, 0.65),
      { k: 'path', d: peaks, fill: 'far' },
      { k: 'path', d: rangeShade(150, peakPts), fill: 'accent', o: 0.18 },
      { k: 'path', d: caps, fill: 'detail' },
      haze(118, 34, 0.5),
      { k: 'path', d: hills([[0, 156], [120, 144], [240, 158], [400, 140]]), fill: 'mid' },
      { k: 'path', d: pines([[44, 166, 34], [64, 162, 26], [82, 168, 30], [300, 164, 32], [318, 168, 26], [350, 160, 36]]), fill: 'accent' },
      // small cabin with a lit window
      { k: 'path', d: 'M180 168 V152 H212 V168 Z', fill: 'accent' },
      { k: 'path', d: 'M176 153 L196 140 L216 153 Z', fill: 'detail' },
      { k: 'path', d: 'M200 158 h6 v6 h-6 Z', fill: 'glow' },
      // T152: chimney smoke and a warm pool of window light on the snow at night
      { k: 'path', d: 'M206 142 q-4 -6 1 -11 q5 -5 0 -11 q-4 -5 1 -9', stroke: 'detail', sw: 1.6, o: 0.45 },
      { k: 'path', d: 'M196 170 q7 -2 14 0 q-7 3 -14 0 Z', fill: 'glow', o: 0.5, only: 'night' },
      { k: 'path', d: hills([[0, 178], [110, 166], [230, 180], [330, 168], [400, 176]]), fill: 'near' },
      { k: 'path', d: flakes, fill: 'detail', o: 0.9 },
    ],
  };
})();

const desert: CoverScene = (() => {
  const oasis = palm(96, 150, 30, -6);
  const oasis2 = palm(110, 152, 22, 5);
  return {
    sun: { cx: 262, cy: 104, r: 26 },
    shapes: [
      stars,
      { k: 'path', d: cloud(60, 96, 1.2), fill: 'sky1', o: 0.4, only: 'day' },
      { k: 'path', d: 'M0 140 V128 H22 L28 120 H58 L64 128 H86 V140 Z M300 140 V124 L310 116 H352 L360 124 V140 Z', fill: 'far' },
      { k: 'path', d: 'M28 120 H58 L64 128 H50 Z M310 116 H352 L360 124 H340 Z', fill: 'near', o: 0.18 },
      haze(110, 32, 0.6),
      { k: 'path', d: hills([[0, 140], [80, 132], [180, 142], [300, 128], [400, 138]]), fill: 'far', o: 0.8 },
      { k: 'path', d: hills([[0, 160], [70, 146], [170, 156], [260, 138], [340, 152], [400, 146]]), fill: 'mid' },
      // T152: the lee side of the middle dunes in shade, crests catching the light
      { k: 'path', d: 'M70 146 Q110 150 150 160 L70 160 Z M260 138 Q300 144 330 160 L260 160 Z', fill: 'near', o: 0.3 },
      { k: 'path', d: 'M30 152 Q50 147 70 146 M220 144 Q240 139 260 138', stroke: 'glow', sw: 1.4, o: 0.5 },
      { k: 'path', d: oasis.trunk + ' ' + oasis2.trunk, stroke: 'accent', sw: 2.4 },
      { k: 'path', d: oasis.fronds + ' ' + oasis2.fronds, fill: 'accent' },
      { k: 'path', d: hills([[0, 184], [110, 160], [230, 182], [330, 166], [400, 176]]), fill: 'near' },
      { k: 'path', d: 'M30 182 Q110 158 170 176 M240 180 Q320 164 400 174', stroke: 'detail', sw: 1.6, o: 0.55 },
      { k: 'path', d: 'M150 100 q4 -4 8 0 q4 -4 8 0 M174 110 q3 -3 6 0 q3 -3 6 0', stroke: 'near', sw: 1.4, only: 'day' },
    ],
  };
})();

const island: CoverScene = (() => {
  const a = palm(218, 136, 34, -8);
  const b = palm(236, 138, 26, 10);
  return {
    sun: { cx: 104, cy: 96, r: 18 },
    shapes: [
      stars,
      ...clouds(cloud(236, 86, 1.2) + ' ' + cloud(322, 100, 0.8)),
      haze(100, 28, 0.5),
      { k: 'rect', x: 0, y: 128, w: 400, h: 72, fill: 'accent' },
      // T152: a far island on the horizon, a light band of water by the horizon
      { k: 'path', d: 'M300 129 Q318 118 336 122 Q352 116 368 129 Z', fill: 'mid', o: 0.4 },
      { k: 'rect', x: 0, y: 128, w: 400, h: 5, fill: 'sky1', o: 0.35 },
      { k: 'path', d: 'M120 160 Q130 140 228 138 Q330 138 342 160 Q300 172 228 172 Q150 172 120 160 Z', fill: 'far', o: 0.75 },
      { k: 'path', d: 'M150 152 Q170 142 230 140 Q290 140 312 152 Q280 158 230 158 Q178 158 150 152 Z', fill: 'near' },
      { k: 'path', d: 'M170 146 Q190 118 226 116 Q262 118 282 146 Z', fill: 'mid' },
      { k: 'path', d: 'M226 116 Q262 118 282 146 L236 146 Q240 130 226 116 Z', fill: 'detail', o: 0.25 },
      { k: 'path', d: a.trunk + ' ' + b.trunk, stroke: 'detail', sw: 2.4 },
      { k: 'path', d: a.fronds + ' ' + b.fronds, fill: 'detail' },
      { k: 'path', d: rects([[90, 134, 30, 2], [96, 140, 18, 2], [100, 146, 10, 2]]), fill: 'glow', o: 0.7 },
      { k: 'path', d: waves(10, 110, 180, 30, 2.5) + ' ' + waves(270, 390, 186, 30, 2.5) + ' ' + waves(150, 250, 192, 30, 2.5), stroke: 'glow', sw: 1.4, o: 0.45 },
      { k: 'path', d: 'M300 104 q4 -4 8 0 q4 -4 8 0 M322 112 q3 -3 6 0 q3 -3 6 0', stroke: 'mid', sw: 1.6, only: 'day' },
    ],
  };
})();

export const COVER_ART: Record<CoverId, CoverScene> = { city, mountains, coast, oldtown, countryside, snow, desert, island };

/** The shapes drawn for a scene in day (light) or night (dark) mode. */
export const sceneShapes = (id: CoverId, dark: boolean): readonly CoverShape[] =>
  COVER_ART[id].shapes.filter((s) => !s.only || s.only === (dark ? 'night' : 'day'));
