// Still life batch 2 (fb-1022b T121, 22 Oct 2026): original line art on a 400×400 canvas. See docs/TEMPLATES.md.
// Everyday objects to draw from: kitchen pieces, fruit, desk things and vintage machines. All unbranded and of our
// own design (no logos, maker names or model shapes). Overlaps use occlude.ts so lines behind a shape are hidden.
import type { Template, TemplateLevel } from '../templates.ts';
import { circle, ellipse, f, line, polar, rotate, rrect, type P } from './draw.ts';
import { clip, region, roundPoly } from './occlude.ts';
import { join, layered, smooth, type Art } from './figures.ts';

const VB = '0 0 400 400';

function tpl(id: string, name: string, level: TemplateLevel, tags: string[], art: Art): Template {
  const detail = art.d.filter(Boolean);
  return {
    id: `still-${id}`,
    name,
    category: 'stilllife',
    level,
    tags,
    viewBox: VB,
    paths: art.p.filter(Boolean),
    ...(detail.length ? { detail } : {}),
  };
}

/** Clock-style ticks: n short radial lines between radii r0 and r1. */
const ticks = (cx: number, cy: number, r0: number, r1: number, n: number, skip = 0): string =>
  Array.from({ length: n }, (_, i) => i)
    .filter((i) => !skip || i % skip !== 0)
    .map((i) => line(...polar(cx, cy, r0, (360 * i) / n), ...polar(cx, cy, r1, (360 * i) / n)))
    .join(' ');

/** Shadow line under an object. */
const ground = (x0: number, x1: number, y: number): string => `M ${f(x0)} ${f(y)} Q ${f((x0 + x1) / 2)} ${f(y + 4)} ${f(x1)} ${f(y)}`;

// ---- beginner ----------------------------------------------------------------------------------------------------

function mug(): Art {
  const rim = ellipse(186, 128, 82, 18);
  const body = 'M 104 128 L 268 128 L 260 318 Q 258 340 236 340 L 136 340 Q 114 340 112 318 Z';
  const handle = 'M 264 170 C 336 160 342 270 258 284 L 260 254 C 306 246 304 196 266 200 Z';
  return join(
    layered([{ sil: rim, p: [ellipse(186, 128, 70, 12)] }, { sil: body }, { sil: handle }]),
    { p: [], d: ['M 160 96 C 150 80 172 70 162 52', 'M 194 98 C 184 78 208 68 196 46', 'M 226 96 C 216 80 238 70 228 54', ground(90, 290, 352)] },
  );
}

function candle(): Art {
  const top = ellipse(200, 150, 44, 11);
  const body = 'M 156 150 L 156 300 L 244 300 L 244 150 Z';
  const drip = 'M 156 150 L 156 196 Q 164 208 170 194 L 172 168 Q 180 182 186 166 L 186 150 Z';
  const dish = ellipse(200, 306, 120, 26);
  const dishRim = ellipse(200, 300, 104, 18);
  const ring = 'M 314 296 C 356 286 362 326 316 318';
  const flame = 'M 200 62 C 222 92 222 122 200 128 C 178 122 178 92 200 62 Z';
  return join(
    layered([{ sil: flame, p: ['M 200 96 C 208 108 208 118 200 122 C 192 118 192 108 200 96 Z'] }, { sil: top, p: [line(200, 128, 200, 146)] }, { sil: drip }, { sil: body }, { sil: dishRim }, { sil: dish }, { sil: '', p: [ring] }]),
    { p: [], d: ['M 232 170 L 232 260', 'M 152 74 L 140 64', 'M 248 74 L 260 64', 'M 200 44 L 200 30'] },
  );
}

function key(len: number): string[] {
  // A key lying along +x from its bow at (0, 0), as shapes to merge.
  return [
    circle(0, 0, 30),
    rrect(24, -8, len, 16, 4),
    roundPoly([[len - 6, 6], [len + 20, 6], [len + 20, 26], [len + 8, 26], [len + 8, 18], [len - 6, 18]], 3),
    roundPoly([[len - 40, 6], [len - 22, 6], [len - 22, 20], [len - 40, 20]], 3),
  ];
}
function keys(): Art {
  const ringC = circle(130, 120, 50);
  const ringI = circle(130, 120, 44);
  const big = shiftShapes(key(150), 168, 170, 40);
  const small = shiftShapes(key(116), 114, 186, 80);
  const hole = (x: number, y: number) => circle(x, y, 10);
  return join(
    layered([
      { sil: big, p: [hole(168, 170)], d: [rotate(line(196, 170, 318, 170), 40, 168, 170)] },
      { sil: small, p: [hole(114, 186)], d: [rotate(line(142, 186, 230, 186), 80, 114, 186)] },
      { sil: [ringC], p: [ringI] },
    ]),
    { p: [], d: [] },
  );
}

/** Rotate shapes built around (0, 0) by deg and move them to (x, y). */
function shiftShapes(shapes: string[], x: number, y: number, deg: number): string[] {
  const a = (deg * Math.PI) / 180;
  const [c, s] = [Math.cos(a), Math.sin(a)];
  return shapes.map((d) => mapXY(d, (px, py) => [x + px * c - py * s, y + px * s + py * c], deg));
}

/** Map every point of an absolute path (arcs keep radii; rotation added to the arc angle). */
function mapXY(d: string, m: (x: number, y: number) => P, deg = 0): string {
  const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+/g) ?? [];
  const n: Record<string, number> = { M: 2, L: 2, C: 6, Q: 4, A: 7, Z: 0 };
  const out: string[] = [];
  let i = 0;
  let cmd = '';
  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i])) {
      cmd = tokens[i++];
      out.push(cmd);
      if (cmd === 'Z') continue;
    }
    const v = tokens.slice(i, i + n[cmd]).map(Number);
    i += n[cmd];
    if (cmd === 'A') {
      const [x, y] = m(v[5], v[6]);
      out.push(f(v[0]), f(v[1]), f(v[2] + deg), String(v[3]), String(v[4]), f(x), f(y));
    } else for (let k = 0; k < v.length; k += 2) out.push(...m(v[k], v[k + 1]).map(f));
  }
  return out.join(' ');
}

function scissors(): Art {
  const bladeA = 'M 200 214 L 330 60 C 336 54 344 58 338 68 L 214 232 Z';
  const bladeB = 'M 200 214 L 70 60 C 64 54 56 58 62 68 L 186 232 Z';
  const loop = (cx: number, cy: number, deg: number) => [rotate(ellipse(cx, cy, 44, 34), deg, cx, cy), rotate(ellipse(cx, cy, 28, 20), deg, cx, cy)];
  const [la, lai] = loop(142, 310, -30);
  const [lb, lbi] = loop(258, 310, 30);
  const armA = limbish(206, 226, 160, 284, 14, 12);
  const armB = limbish(194, 226, 240, 284, 14, 12);
  return join(
    layered([
      { sil: circle(200, 222, 9), p: [circle(200, 222, 3)] },
      { sil: [bladeA, armA, la], p: [lai] },
      { sil: [bladeB, armB, lb], p: [lbi] },
    ]),
    { p: [], d: ['M 212 200 L 318 74', 'M 188 200 L 82 74'] },
  );
}

function limbish(x0: number, y0: number, x1: number, y1: number, r0: number, r1: number): string {
  const L = Math.hypot(x1 - x0, y1 - y0);
  const nx = -(y1 - y0) / L;
  const ny = (x1 - x0) / L;
  return `M ${f(x0 + nx * r0)} ${f(y0 + ny * r0)} L ${f(x1 + nx * r1)} ${f(y1 + ny * r1)} L ${f(x1 - nx * r1)} ${f(y1 - ny * r1)} L ${f(x0 - nx * r0)} ${f(y0 - ny * r0)} Z`;
}

function pear(cx: number, base: number, s: number, tilt: number): string {
  const pts: P[] = [
    [0, -170], [24, -150], [36, -112], [64, -70], [84, -28], [80, 0], [50, 20], [0, 26], [-50, 20], [-80, 0], [-84, -28], [-64, -70], [-36, -112], [-24, -150],
  ];
  return rotate(smooth(pts.map(([x, y]) => [cx + x * s, base + y * s] as P)), tilt, cx, base);
}

function pears(): Art {
  const front = pear(236, 320, 1, 8);
  const back = pear(144, 300, 0.9, -12);
  const stemF = rotate('M 236 152 C 236 136 242 124 252 116', 8, 236, 320);
  const stemB = rotate('M 144 148 C 142 134 136 124 128 118', -12, 144, 300);
  const leaf = 'M 252 124 C 270 98 300 96 318 104 C 300 124 274 132 252 124 Z';
  return join(layered([{ sil: front, p: [stemF] }, { sil: leaf }, { sil: back, p: [stemB] }]), {
    p: [],
    d: ['M 254 124 C 272 114 292 108 310 106', 'M 196 220 C 186 250 186 280 198 300', 'M 108 210 C 98 236 98 262 110 280', ground(60, 340, 350)],
  });
}

function alarmClock(): Art {
  const face = circle(200, 210, 112);
  const inner = circle(200, 210, 96);
  const bellL = rotate('M 104 116 A 50 50 0 0 1 164 70 Z', 0, 0, 0);
  const bellR = 'M 296 116 A 50 50 0 0 0 236 70 Z';
  const hammer = rrect(194, 74, 12, 30, 4);
  const legs = [roundPoly([[124, 300], [146, 316], [112, 352], [100, 344]], 4), roundPoly([[276, 300], [254, 316], [288, 352], [300, 344]], 4)];
  return join(
    layered([
      { sil: '', p: ['M 200 210 L 200 140', 'M 200 210 L 252 236', circle(200, 210, 7)] },
      { sil: face, p: [inner] },
      { sil: hammer, p: [ellipse(200, 70, 22, 8)] },
      { sil: bellL },
      { sil: bellR },
      { sil: legs },
    ]),
    { p: [], d: [ticks(200, 210, 80, 92, 12), ground(80, 320, 362)] },
  );
}

function booksStack(): Art {
  const b = (x: number, y: number, w: number, h: number, tilt: number) => rotate(rrect(x, y, w, h, 6), tilt, x + w / 2, y + h / 2);
  const books = [b(70, 298, 260, 46, 0), b(90, 254, 230, 44, -2), b(78, 214, 248, 40, 3), b(104, 176, 200, 38, -3), b(120, 140, 170, 36, 2)];
  const spines = [
    rotate('M 100 298 L 100 344 M 300 298 L 300 344', 0, 200, 321),
    rotate('M 118 254 L 118 298 M 292 254 L 292 298', -2, 205, 276),
    rotate('M 106 214 L 106 254 M 298 214 L 298 254', 3, 202, 234),
    rotate('M 130 176 L 130 214 M 278 176 L 278 214', -3, 204, 195),
    rotate('M 144 140 L 144 176 M 266 140 L 266 176', 2, 205, 158),
  ];
  return join(layered(books.map((s, i) => ({ sil: s, p: [spines[i]] }))), {
    p: [],
    d: ['M 70 310 L 330 310', rotate('M 160 270 L 250 270', -2, 205, 276), ground(56, 344, 356)],
  });
}

// ---- intermediate ------------------------------------------------------------------------------------------------

function bottleJar(): Art {
  const bottle = 'M 128 92 L 170 92 L 170 132 C 196 142 204 170 204 204 L 204 336 Q 204 346 194 346 L 104 346 Q 94 346 94 336 L 94 204 C 94 170 102 142 128 132 Z';
  const cork = rrect(132, 66, 34, 30, 5);
  const label = rrect(108, 230, 82, 76, 6);
  const jar = 'M 228 176 L 324 176 L 324 192 C 340 204 344 220 344 240 L 344 330 Q 344 346 328 346 L 224 346 Q 208 346 208 330 L 208 240 C 208 220 212 204 228 192 Z';
  const lid = rrect(222, 148, 108, 32, 6);
  return join(
    layered([
      { sil: cork, d: ['M 132 80 L 166 80'] },
      { sil: bottle, p: [label], d: ['M 112 196 C 108 230 108 290 112 330', 'M 122 250 L 176 250 M 122 268 L 176 268 M 122 286 L 160 286', 'M 128 124 L 170 124'] },
      { sil: lid, d: ['M 222 164 L 330 164', 'M 238 148 L 238 180 M 258 148 L 258 180 M 278 148 L 278 180 M 298 148 L 298 180 M 316 148 L 316 180'] },
      { sil: jar, d: ['M 224 210 L 328 210', 'M 226 222 L 330 222', 'M 222 250 C 220 280 220 310 226 330', 'M 248 290 C 262 270 290 270 304 290 C 290 306 262 306 248 290 Z'] },
    ]),
    { p: [], d: [ground(80, 360, 358)] },
  );
}

function kettle(): Art {
  const body = 'M 112 330 C 96 260 120 170 200 160 C 280 170 304 260 288 330 Z';
  const base = rrect(98, 322, 204, 22, 10);
  const lid = 'M 160 166 C 166 142 234 142 240 166 Z';
  const knob = ellipse(200, 140, 14, 10);
  const handle = 'M 140 186 C 130 90 270 90 260 186 L 244 180 C 252 116 148 116 156 180 Z';
  const spout = 'M 276 236 C 306 220 326 190 352 164 L 362 176 C 340 210 318 258 290 282 Z';
  return join(
    layered([{ sil: knob }, { sil: lid }, { sil: base }, { sil: body }, { sil: handle }, { sil: spout }]),
    { p: [], d: ['M 126 220 C 116 250 116 284 124 314', 'M 170 160 L 230 160', 'M 352 164 L 362 176', 'M 120 300 L 280 300', ground(80, 340, 360)] },
  );
}

function deskLamp(): Art {
  const base = 'M 80 344 C 80 318 180 318 180 344 Z';
  const baseBand = rrect(74, 340, 112, 14, 6);
  const arm1 = limbish(130, 324, 196, 176, 9, 9);
  const arm2 = limbish(196, 176, 272, 118, 9, 9);
  const joint = circle(196, 176, 14);
  const shade = 'M 258 124 C 262 104 300 104 304 124 L 346 214 L 216 214 Z';
  const rim = ellipse(281, 214, 65, 14);
  const cap = circle(281, 110, 12);
  const bulb = clip(ellipse(281, 228, 26, 16), [region(shade), region(rim)]);
  return join(
    layered([
      { sil: rim },
      { sil: cap, p: [circle(281, 110, 4)] },
      { sil: shade, d: ['M 266 130 L 240 206', 'M 296 130 L 326 206'] },
      { sil: joint, p: [circle(196, 176, 5)] },
      { sil: arm2 },
      { sil: arm1 },
      { sil: baseBand },
      { sil: base },
      { sil: '', p: [bulb] },
    ]),
    { p: [], d: ['M 150 300 L 170 304 M 156 284 L 176 288 M 162 268 L 182 272 M 168 252 L 188 256 M 176 236 L 194 240 M 182 220 L 200 224', ground(60, 200, 360), 'M 250 268 L 240 284 M 281 272 L 281 290 M 312 268 L 322 284'] },
  );
}

function sneaker(): Art {
  const upper = 'M 60 262 C 56 230 64 204 84 192 C 104 184 126 198 150 196 C 160 180 168 170 180 166 L 196 172 C 220 200 262 214 306 222 C 336 228 352 244 350 262 Z';
  const sole = 'M 52 260 L 356 260 C 362 276 352 296 330 298 L 74 298 C 56 298 48 276 52 260 Z';
  const toe = 'M 290 222 C 330 228 352 244 350 262 L 296 262 C 300 246 298 232 290 222 Z';
  const heel = 'M 60 262 C 56 230 64 204 84 192 L 96 196 C 92 220 100 246 112 262 Z';
  const panel = 'M 166 184 C 200 196 240 210 272 218 L 264 236 C 230 228 196 216 160 202 Z';
  const eyelets: P[] = [[176, 192], [198, 200], [220, 208], [242, 215]];
  const laceX = eyelets.slice(0, -1).map(([x, y], i) => `M ${x} ${y} L ${eyelets[i + 1][0] - 4} ${eyelets[i + 1][1] + 14} M ${x - 4} ${y + 14} L ${eyelets[i + 1][0]} ${eyelets[i + 1][1]}`).join(' ');
  return join(
    layered([
      { sil: '', p: ['M 176 192 C 158 164 136 160 132 176 C 144 186 160 190 176 192 M 176 192 C 170 162 182 150 194 158 C 194 172 186 184 176 192'] },
      { sil: eyelets.map(([x, y]) => circle(x, y, 4.5)) },
      { sil: panel, p: [laceX] },
      { sil: toe, d: ['M 300 228 C 330 236 344 248 344 262'] },
      { sil: heel },
      { sil: upper, d: ['M 120 230 C 160 238 220 240 280 236'] },
      { sil: sole, d: ['M 56 280 L 350 280'] },
    ]),
    { p: [], d: [ground(40, 370, 314), 'M 90 288 L 96 288 M 120 288 L 126 288 M 150 288 L 156 288 M 180 288 L 186 288 M 210 288 L 216 288 M 240 288 L 246 288 M 270 288 L 276 288 M 300 288 L 306 288'] },
  );
}

function vaseBranches(): Art {
  const vase = 'M 172 170 L 228 170 L 222 196 C 270 220 284 280 260 330 Q 254 344 238 344 L 162 344 Q 146 344 140 330 C 116 280 130 220 178 196 Z';
  const lip = ellipse(200, 170, 34, 8);
  const branch = (pts: P[]) => smooth(pts, false);
  const b1 = branch([[196, 180], [180, 120], [140, 80], [96, 60]]);
  const b2 = branch([[204, 180], [220, 110], [250, 70], [292, 44]]);
  const b3 = branch([[200, 180], [210, 130], [270, 120], [330, 120]]);
  const buds: string[] = [];
  const along: P[] = [[150, 88], [122, 70], [176, 118], [238, 82], [266, 58], [222, 112], [262, 122], [300, 118], [326, 120], [98, 60], [292, 44]];
  along.forEach(([x, y], i) => buds.push(rotate(ellipse(x, y - 9, 6, 10), (i * 47) % 90 - 45, x, y)));
  return join(
    layered([{ sil: lip }, { sil: vase, d: ['M 150 230 C 140 260 140 300 152 326'] }, { sil: '', p: [b1, b2, b3] }]),
    { p: buds, d: [ground(100, 300, 356), 'M 170 120 L 160 108 M 236 98 L 248 92 M 240 126 L 244 114'] },
  );
}

function brushesJar(): Art {
  const jar = 'M 128 200 L 272 200 L 266 330 Q 264 346 248 346 L 152 346 Q 136 346 134 330 Z';
  const rim = rrect(120, 188, 160, 18, 6);
  const brush = (x0: number, y0: number, deg: number, len: number, head: 'round' | 'flat' | 'fan'): string[] => {
    const handle = rotate(rrect(x0 - 5, y0 - len, 10, len, 5), deg, x0, y0);
    const ferrule = rotate(rrect(x0 - 8, y0 - len - 28, 16, 30, 3), deg, x0, y0);
    const tip =
      head === 'round'
        ? `M ${x0 - 8} ${y0 - len - 26} C ${x0 - 12} ${y0 - len - 50} ${x0 - 2} ${y0 - len - 66} ${x0} ${y0 - len - 74} C ${x0 + 2} ${y0 - len - 66} ${x0 + 12} ${y0 - len - 50} ${x0 + 8} ${y0 - len - 26} Z`
        : head === 'flat'
          ? `M ${x0 - 8} ${y0 - len - 26} L ${x0 - 10} ${y0 - len - 62} L ${x0 + 10} ${y0 - len - 62} L ${x0 + 8} ${y0 - len - 26} Z`
          : `M ${x0 - 6} ${y0 - len - 26} L ${x0 - 30} ${y0 - len - 60} Q ${x0} ${y0 - len - 74} ${x0 + 30} ${y0 - len - 60} L ${x0 + 6} ${y0 - len - 26} Z`;
    return [ferrule, rotate(tip, deg, x0, y0), handle];
  };
  const set = [brush(170, 210, -18, 90, 'round'), brush(200, 210, 0, 120, 'flat'), brush(228, 210, 16, 96, 'fan'), brush(186, 210, -6, 60, 'round'), brush(246, 210, 28, 70, 'flat')];
  const items = set.flatMap((parts) => parts.map((s) => ({ sil: s })));
  return join(layered([{ sil: rim }, { sil: jar, d: ['M 146 228 C 142 264 144 300 150 326', 'M 160 260 C 190 250 220 270 250 258'] }, ...items]), {
    p: [],
    d: [ground(100, 300, 358)],
  });
}

// ---- advanced ----------------------------------------------------------------------------------------------------

function teapotCups(): Art {
  const body = 'M 108 250 C 96 190 140 150 200 150 C 260 150 304 190 292 250 C 286 290 250 312 200 312 C 150 312 114 290 108 250 Z';
  const lid = 'M 150 156 C 160 128 240 128 250 156 Z';
  const knob = circle(200, 122, 12);
  const handle = 'M 284 190 C 344 180 352 268 286 280 L 290 262 C 326 254 324 204 286 210 Z';
  const spout = 'M 116 226 C 90 220 76 200 60 170 L 48 176 C 62 220 80 262 112 276 Z';
  const foot = rrect(150, 306, 100, 14, 6);
  const cup = (cx: number, by: number): { sil: string; p: string[]; d: string[] }[] => [
    { sil: ellipse(cx, by - 70, 44, 10), p: [ellipse(cx, by - 70, 38, 7)], d: [] },
    { sil: `M ${cx - 44} ${by - 70} C ${cx - 44} ${by - 20} ${cx - 26} ${by} ${cx} ${by} C ${cx + 26} ${by} ${cx + 44} ${by - 20} ${cx + 44} ${by - 70} Z`, p: [], d: [`M ${cx - 30} ${by - 50} Q ${cx} ${by - 38} ${cx + 30} ${by - 50}`, circle(cx - 14, by - 32, 3), circle(cx, by - 26, 3), circle(cx + 14, by - 32, 3)] },
    { sil: `M ${cx + 40} ${by - 58} C ${cx + 64} ${by - 62} ${cx + 66} ${by - 30} ${cx + 34} ${by - 26} L ${cx + 36} ${by - 34} C ${cx + 54} ${by - 38} ${cx + 54} ${by - 54} ${cx + 42} ${by - 50} Z`, p: [], d: [] },
    { sil: ellipse(cx, by + 2, 66, 13), p: [ellipse(cx, by + 2, 34, 6)], d: [] },
  ];
  const dots: string[] = [];
  for (let i = 0; i < 7; i++) dots.push(circle(140 + i * 20, 230 + (i % 2) * 14, 4));
  const vine = 'M 124 214 C 160 200 180 240 200 222 C 220 204 240 240 276 214';
  return join(
    layered([
      ...cup(96, 352),
      ...cup(318, 360),
      { sil: knob },
      { sil: lid, d: ['M 160 150 L 240 150'] },
      { sil: foot },
      { sil: body, d: [vine, ...dots, 'M 116 270 C 150 290 250 290 284 270', 'M 132 186 C 124 196 118 210 116 222'] },
      { sil: handle },
      { sil: spout, d: ['M 58 178 C 70 204 84 226 104 244'] },
    ]),
    { p: [], d: [] },
  );
}

function fruitBowl(): Art {
  const bowl = 'M 60 230 L 340 230 C 334 300 280 336 200 336 C 120 336 66 300 60 230 Z';
  const footB = 'M 160 330 L 240 330 L 254 356 L 146 356 Z';
  const apple = (cx: number, cy: number, r: number) =>
    `M ${cx} ${cy - r * 0.7} C ${cx + r * 0.4} ${cy - r * 1.1} ${cx + r * 1.1} ${cy - r * 0.9} ${cx + r} ${cy} C ${cx + r * 0.9} ${cy + r * 0.8} ${cx + r * 0.4} ${cy + r} ${cx} ${cy + r * 0.85} ` +
    `C ${cx - r * 0.4} ${cy + r} ${cx - r * 0.9} ${cy + r * 0.8} ${cx - r} ${cy} C ${cx - r * 1.1} ${cy - r * 0.9} ${cx - r * 0.4} ${cy - r * 1.1} ${cx} ${cy - r * 0.7} Z`;
  const a1 = apple(128, 200, 54);
  const orange = circle(236, 196, 56);
  const a2 = apple(184, 160, 46);
  const pearB = rotate(smooth(([[0, -100], [16, -86], [24, -60], [44, -30], [52, 0], [36, 20], [0, 26], [-36, 20], [-52, 0], [-44, -30], [-24, -60], [-16, -86]] as P[]).map(([x, y]) => [292 + x, 210 + y] as P)), 14, 292, 210);
  const gp: P[] = [[282, 236], [306, 236], [330, 236], [294, 258], [318, 258], [306, 280], [270, 254], [342, 256]];
  const grapes = gp.map(([x, y]) => circle(x, y, 13));
  const pores: string[] = [];
  for (let i = 0; i < 12; i++) {
    const [x, y] = polar(236, 196, 18 + (i % 3) * 12, i * 47);
    pores.push(circle(x, y, 1.5));
  }
  return join(
    layered([
      { sil: grapes, p: ['M 306 222 C 306 210 312 202 322 196'] },
      { sil: a1, p: ['M 128 162 C 128 148 132 138 140 132'], d: ['M 98 184 C 92 198 92 212 96 224', 'M 140 136 C 154 124 170 124 178 130 C 166 140 152 142 140 136 Z'] },
      { sil: orange, p: [circle(246, 158, 4)], d: pores },
      { sil: a2, p: ['M 184 128 C 184 112 188 100 196 92'], d: ['M 160 140 C 154 150 152 162 154 172'] },
      { sil: pearB, p: [rotate('M 292 110 C 292 98 296 90 304 84', 14, 292, 210)] },
      { sil: bowl, d: ['M 70 248 C 120 262 280 262 330 248', 'M 96 286 C 150 300 250 300 304 286', 'M 140 230 C 136 260 148 300 170 326', 'M 260 230 C 264 260 252 300 230 326'] },
      { sil: footB },
    ]),
    { p: [], d: [ground(60, 340, 366)] },
  );
}

function camera(): Art {
  const body = rrect(60, 140, 280, 170, 18);
  const top = 'M 96 140 L 104 108 L 196 108 L 204 140 Z';
  const dialL = rrect(70, 120, 34, 22, 4);
  const dialR = rrect(278, 116, 46, 26, 4);
  const lensOuter = circle(200, 232, 70);
  const lensMid = circle(200, 232, 54);
  const lensIn = circle(200, 232, 36);
  const glass = circle(200, 232, 22);
  const window1 = rrect(82, 158, 46, 26, 4);
  const window2 = rrect(272, 158, 46, 26, 4);
  const knurl: string[] = [];
  knurl.push(ticks(200, 232, 56, 68, 48));
  const tex: string[] = [];
  for (let y = 196; y <= 296; y += 12) {
    tex.push(clip(line(64, y, 336, y), [region(lensOuter)]));
  }
  return join(
    layered([
      { sil: lensOuter, p: [lensMid, lensIn, glass], d: [...knurl, 'M 190 222 C 194 216 200 214 206 216', ticks(200, 232, 40, 50, 24)] },
      { sil: top, p: [rrect(126, 114, 48, 18, 3)] },
      { sil: dialL, d: ['M 76 120 L 76 142 M 84 120 L 84 142 M 92 120 L 92 142 M 100 120 L 100 142'] },
      { sil: dialR, d: ['M 286 116 L 286 142 M 296 116 L 296 142 M 306 116 L 306 142 M 316 116 L 316 142'] },
      { sil: window1, p: [rrect(88, 164, 34, 14, 3)] },
      { sil: window2, d: ['M 280 166 L 310 176'] },
      { sil: body, d: ['M 60 190 L 340 190', 'M 60 296 L 340 296', ...tex.map((t) => clip(t, [region(window1), region(window2)]))] },
      { sil: '', p: [rrect(46, 170, 16, 20, 4), rrect(338, 170, 16, 20, 4)] },
    ]),
    { p: [], d: [ground(50, 350, 330)] },
  );
}

function radio(): Art {
  const cab = 'M 70 340 L 70 170 C 70 90 330 90 330 170 L 330 340 Q 330 352 318 352 L 82 352 Q 70 352 70 340 Z';
  const inner = 'M 92 324 L 92 176 C 92 112 308 112 308 176 L 308 324 Z';
  const grille = 'M 112 236 L 112 180 C 112 132 288 132 288 180 L 288 236 Z';
  const dial = rrect(112, 254, 176, 34, 8);
  const knob = (x: number) => circle(x, 310, 14);
  const lines: string[] = [];
  for (let x = 124; x <= 276; x += 12) lines.push(clip(line(x, 120, x, 236), [region(grille)], 'inside'));
  const feet = [rrect(84, 350, 40, 12, 4), rrect(276, 350, 40, 12, 4)];
  return join(
    layered([
      { sil: knob(140), p: [circle(140, 310, 4)], d: [ticks(140, 310, 9, 14, 16)] },
      { sil: knob(260), p: [circle(260, 310, 4)], d: [ticks(260, 310, 9, 14, 16)] },
      { sil: dial, p: ['M 200 258 L 200 284'], d: [Array.from({ length: 17 }, (_, i) => line(122 + i * 9.8, 258, 122 + i * 9.8, i % 2 ? 266 : 272)).join(' ')] },
      { sil: grille, d: lines },
      { sil: inner },
      { sil: cab },
      { sil: feet },
      { sil: '', p: ['M 250 94 L 310 30'], d: [circle(310, 30, 5)] },
    ]),
    { p: [], d: [ground(50, 350, 368), 'M 200 300 L 200 320'] },
  );
}

function typewriter(): Art {
  const body = 'M 70 340 L 96 236 L 304 236 L 330 340 Q 332 352 320 352 L 80 352 Q 68 352 70 340 Z';
  const platen = rrect(80, 196, 240, 30, 15);
  const knobL = rrect(56, 200, 26, 22, 6);
  const knobR = rrect(318, 200, 26, 22, 6);
  const paper = 'M 128 206 L 132 70 L 268 70 L 272 206 Z';
  const lever = 'M 70 200 L 44 168 Q 42 160 50 160 L 80 194 Z';
  const keysP: string[] = [];
  const rows = [[11, 262, 100], [10, 286, 110], [9, 310, 120]] as const;
  for (const [n, y, x0] of rows) for (let i = 0; i < n; i++) keysP.push(circle(x0 + i * ((400 - 2 * x0) / (n - 1)), y, 7));
  const space = rrect(140, 324, 120, 14, 7);
  const textLines = ['M 146 96 L 250 96', 'M 146 112 L 236 112', 'M 146 128 L 254 128', 'M 146 144 L 210 144', 'M 146 160 L 244 160'];
  return join(
    layered([
      { sil: platen, d: ['M 96 196 L 96 226 M 304 196 L 304 226', 'M 180 214 L 220 214'] },
      { sil: knobL, d: ['M 62 200 L 62 222 M 70 200 L 70 222'] },
      { sil: knobR, d: ['M 330 200 L 330 222 M 338 200 L 338 222'] },
      { sil: lever },
      { sil: paper, d: textLines },
      { sil: [...keysP, space] },
      { sil: body, d: ['M 92 250 L 308 250'] },
    ]),
    { p: [], d: [ground(50, 350, 364), rrect(176, 240, 48, 6, 3)] },
  );
}

// ---- catalogue -----------------------------------------------------------------------------------------------

export const stilllife2: Template[] = [
  tpl('mug', 'Steaming mug', 'beginner', ['mug', 'cup', 'coffee', 'tea', 'cosy', 'simple'], mug()),
  tpl('candle', 'Candle in a holder', 'beginner', ['candle', 'flame', 'holder', 'cosy', 'simple', 'vintage'], candle()),
  tpl('keys', 'Keys on a ring', 'beginner', ['key', 'keys', 'ring', 'home', 'simple', 'objects'], keys()),
  tpl('scissors', 'Open scissors', 'beginner', ['scissors', 'craft', 'sewing', 'tools', 'simple', 'objects'], scissors()),
  tpl('pears', 'Two pears', 'beginner', ['pear', 'pears', 'fruit', 'kitchen', 'simple', 'realistic'], pears()),
  tpl('alarm-clock', 'Twin-bell alarm clock', 'beginner', ['clock', 'alarm', 'vintage', 'time', 'simple', 'objects'], alarmClock()),
  tpl('books-stack', 'Stack of books', 'beginner', ['books', 'stack', 'reading', 'library', 'simple', 'study'], booksStack()),
  tpl('bottle-jar', 'Glass bottle and jar', 'intermediate', ['bottle', 'jar', 'glass', 'kitchen', 'pantry', 'realistic'], bottleJar()),
  tpl('kettle', 'Stovetop kettle', 'intermediate', ['kettle', 'kitchen', 'tea', 'vintage', 'realistic', 'objects'], kettle()),
  tpl('desk-lamp', 'Desk lamp', 'intermediate', ['lamp', 'desk', 'study', 'light', 'objects', 'realistic'], deskLamp()),
  tpl('sneaker', 'Sneaker side view', 'intermediate', ['shoe', 'sneaker', 'trainer', 'fashion', 'sport', 'realistic'], sneaker()),
  tpl('vase-branches', 'Vase with budding branches', 'intermediate', ['vase', 'branch', 'buds', 'spring', 'botanical', 'realistic'], vaseBranches()),
  tpl('brushes-jar', 'Paint brushes in a jar', 'intermediate', ['jar', 'brush', 'brushes', 'paint', 'art', 'studio'], brushesJar()),
  tpl('teapot-cups', 'Patterned teapot with two cups', 'advanced', ['teapot', 'teacup', 'cup', 'tea', 'vintage', 'ornamental'], teapotCups()),
  tpl('fruit-bowl', 'Bowl of fruit', 'advanced', ['fruit', 'bowl', 'apple', 'banana', 'grapes', 'realistic'], fruitBowl()),
  tpl('camera', 'Vintage film camera', 'advanced', ['camera', 'vintage', 'photography', 'film', 'retro', 'realistic'], camera()),
  tpl('radio', 'Old tabletop radio', 'advanced', ['radio', 'vintage', 'retro', 'music', 'antique', 'realistic'], radio()),
  tpl('typewriter', 'Typewriter with a page', 'advanced', ['typewriter', 'vintage', 'writing', 'retro', 'antique', 'realistic'], typewriter()),
];
