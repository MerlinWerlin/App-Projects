// Still life batch 3 (23 Oct 2026): original line art on a 400×400 canvas. See docs/TEMPLATES.md.
// Everyday objects from the kitchen, the home, the wardrobe and the garden: pots, glasses, lamps, chairs, clocks,
// shoes, bags, instruments, machines, bicycles and lanterns. All unbranded and of our own design (no logos, maker
// names or model shapes). Overlaps use occlude.ts so lines behind a shape are hidden; advanced pieces add hatching.
import type { Template, TemplateLevel } from '../templates.ts';
import { bez, circle, ellipse, f, line, mirrorX, petal, polar, rotate, rrect, spiral, type P } from './draw.ts';
import { clip, region, roundPoly, type Region } from './occlude.ts';
import { join, layered, smooth, limb, type Art } from './figures.ts';

const VB = '0 0 400 400';

function tpl(id: string, name: string, level: TemplateLevel, tags: string[], art: Art): Template {
  const detail = art.d.filter(Boolean);
  return {
    id: `obj-${id}`,
    name,
    category: 'stilllife',
    level,
    tags,
    viewBox: VB,
    paths: art.p.filter(Boolean),
    ...(detail.length ? { detail } : {}),
  };
}

// ---- helpers -----------------------------------------------------------------------------------------------------

/** Clock-style ticks: n short radial lines between radii r0 and r1 (every `skip`-th left out). */
const ticks = (cx: number, cy: number, r0: number, r1: number, n: number, skip = 0): string =>
  Array.from({ length: n }, (_, i) => i)
    .filter((i) => !skip || i % skip !== 0)
    .map((i) => line(...polar(cx, cy, r0, (360 * i) / n), ...polar(cx, cy, r1, (360 * i) / n)))
    .join(' ');

/** Shadow line under an object. */
const ground = (x0: number, x1: number, y: number): string => `M ${f(x0)} ${f(y)} Q ${f((x0 + x1) / 2)} ${f(y + 4)} ${f(x1)} ${f(y)}`;

/** Parallel hatching at angle deg (0 = horizontal) every `gap`, kept inside `shape` and outside `hide`. */
function hatch(shape: string | string[] | Region[], deg: number, gap: number, hide: readonly Region[] = [], box: [number, number, number, number] = [16, 16, 384, 384]): string[] {
  const [x0, y0, x1, y1] = box;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const R = Math.hypot(x1 - x0, y1 - y0) / 2;
  const within: Region[] = typeof shape === 'string' ? [region(shape)] : typeof shape[0] === 'string' ? [region(shape as string[])] : (shape as Region[]);
  const out: string[] = [];
  for (let o = -R + gap / 2; o <= R; o += gap) {
    const seg = rotate(line(cx - R, cy + o, cx + R, cy + o), deg, cx, cy);
    let c = clip(seg, within, 'inside');
    if (c && hide.length) c = clip(c, hide);
    if (c) out.push(c);
  }
  return out;
}

/** Cup-style loop handle on the right of a body edge, from (x, y0) down to (x, y1), reaching out by w. */
function loopHandle(x: number, y0: number, y1: number, w: number, t = 14): string {
  const h = y1 - y0;
  return (
    `M ${f(x)} ${f(y0)} C ${f(x + w * 1.3)} ${f(y0 - h * 0.15)} ${f(x + w * 1.3)} ${f(y1 + h * 0.1)} ${f(x)} ${f(y1)} ` +
    `L ${f(x)} ${f(y1 - t)} C ${f(x + w * 0.9)} ${f(y1 - t)} ${f(x + w * 0.9)} ${f(y0 + t)} ${f(x)} ${f(y0 + t)} Z`
  );
}

/** Horizontal band lines across a shape (kept inside it). */
const bands = (shape: string, ys: number[], x0 = 16, x1 = 384): string[] => ys.map((y) => clip(line(x0, y, x1, y), [region(shape)], 'inside')).filter(Boolean);

/** Flame shape with its tip at (x, y) and height h. */
const flame = (x: number, y: number, h: number): string =>
  `M ${f(x)} ${f(y)} C ${f(x + h * 0.4)} ${f(y + h * 0.45)} ${f(x + h * 0.36)} ${f(y + h)} ${f(x)} ${f(y + h)} C ${f(x - h * 0.36)} ${f(y + h)} ${f(x - h * 0.4)} ${f(y + h * 0.45)} ${f(x)} ${f(y)} Z`;

/** Symmetric turned profile about x = cx from a list of [halfWidth, y] points (top to bottom), closed. */
function turned(cx: number, prof: readonly P[]): string {
  const right = prof.map(([w, y]) => [cx + w, y] as P);
  const left = [...prof].reverse().map(([w, y]) => [cx - w, y] as P);
  return smooth([...right, ...left], true);
}

/** Straight-segment symmetric profile (polygon) about x = cx. */
function profile(cx: number, prof: readonly P[], r = 3): string {
  const right = prof.map(([w, y]) => [cx + w, y] as P);
  const left = [...prof].reverse().map(([w, y]) => [cx - w, y] as P);
  return roundPoly([...right, ...left], r);
}

// ---- beginner ----------------------------------------------------------------------------------------------------

function roundTeapot(): Art {
  const body = ellipse(200, 246, 112, 88);
  const lid = 'M 142 170 C 150 136 250 136 258 170 Z';
  const lidRim = ellipse(200, 170, 66, 10);
  const knob = circle(200, 128, 13);
  const spout = 'M 100 266 C 70 254 60 206 40 168 Q 38 158 48 158 L 60 160 C 76 192 92 214 118 220 Z';
  const handle = loopHandle(306, 200, 290, 46, 16);
  const foot = rrect(146, 326, 108, 18, 8);
  return join(layered([{ sil: knob }, { sil: lid }, { sil: lidRim }, { sil: body }, { sil: spout }, { sil: handle }, { sil: foot }]), {
    p: [],
    d: [...bands(body, [212, 290]), 'M 124 216 C 112 236 112 262 122 282', ground(100, 300, 356)],
  });
}

function coffeePot(): Art {
  const body = 'M 152 128 L 248 128 L 292 330 Q 294 346 278 346 L 122 346 Q 106 346 108 330 Z';
  const rim = rrect(144, 116, 112, 16, 6);
  const lid = 'M 158 116 C 162 88 238 88 242 116 Z';
  const knob = ellipse(200, 84, 14, 10);
  const spout = 'M 132 250 C 102 230 84 180 64 136 L 80 128 C 98 170 118 206 140 214 Z';
  const handle = 'M 244 150 C 316 150 336 210 282 300 L 270 284 C 312 214 296 172 248 172 Z';
  return join(layered([{ sil: knob }, { sil: lid }, { sil: rim }, { sil: body }, { sil: spout }, { sil: handle }]), {
    p: [],
    d: [...bands(body, [300]), 'M 162 150 L 134 320', ground(90, 310, 358)],
  });
}

function waterGlass(): Art {
  const rim = ellipse(200, 86, 72, 14);
  const bowl = 'M 128 86 C 126 186 158 222 200 224 C 242 222 274 186 272 86 Z';
  const stem = 'M 194 222 L 194 314 C 194 320 182 326 160 328 L 240 328 C 218 326 206 320 206 314 L 206 222 Z';
  const foot = ellipse(200, 330, 72, 13);
  const water = clip(ellipse(200, 148, 68, 11), [region(rim)]);
  return join(layered([{ sil: rim, p: [ellipse(200, 86, 64, 10)] }, { sil: bowl, p: [clip(water, [], 'outside')] }, { sil: stem }, { sil: foot }]), {
    p: [],
    d: ['M 146 110 C 146 150 156 182 176 202', 'M 252 150 L 248 170', ground(110, 290, 352)],
  });
}

function jamJar(): Art {
  const jar = 'M 132 170 L 268 170 L 268 186 C 290 196 296 216 296 240 L 296 324 Q 296 346 274 346 L 126 346 Q 104 346 104 324 L 104 240 C 104 216 110 196 132 186 Z';
  const cloth = 'M 120 118 C 150 96 250 96 280 118 L 286 158 L 296 176 L 276 170 L 262 190 L 246 172 L 226 192 L 208 172 L 188 192 L 170 172 L 150 190 L 136 170 L 112 178 L 120 158 Z';
  const string = 'M 118 160 C 160 168 240 168 282 160 L 282 168 C 240 176 160 176 118 168 Z';
  const bow = ['M 200 170 C 184 186 172 200 164 214', 'M 200 170 C 214 188 222 204 228 216'];
  const label = ellipse(200, 268, 64, 40);
  const checks = [...hatch(cloth, 0, 18, [region(string)]), ...hatch(cloth, 90, 18, [region(string)])];
  return join(layered([{ sil: string }, { sil: cloth, d: checks }, { sil: '', p: bow }, { sil: label, p: [ellipse(200, 268, 54, 31)] }, { sil: jar }]), {
    p: [],
    d: ['M 186 266 C 186 252 200 252 200 262 C 200 252 214 252 214 266 C 214 276 200 284 200 288 C 200 284 186 276 186 266 Z', 'M 120 230 C 116 260 116 300 122 326', ground(90, 310, 358)],
  });
}

function fryingPan(): Art {
  const pan = circle(166, 214, 124);
  const inner = circle(166, 214, 104);
  const handle = rotate(rrect(282, 202, 108, 24, 12), 30, 282, 214);
  const neck = rotate(rrect(276, 205, 30, 18, 4), 30, 282, 214);
  const white = 'M 120 214 C 104 168 150 148 178 162 C 206 150 236 174 224 206 C 244 236 214 266 184 258 C 156 280 112 266 120 236 Z';
  const yolk = circle(174, 210, 24);
  return join(layered([{ sil: yolk, p: ['M 162 200 C 166 194 172 192 178 193'] }, { sil: white }, { sil: inner }, { sil: neck }, { sil: pan }, { sil: handle, p: [rotate(circle(370, 214, 5), 30, 282, 214)] }]), {
    p: [],
    d: ['M 82 160 C 72 182 70 210 76 236'],
  });
}

function wallClock(): Art {
  const rim = circle(200, 206, 150);
  const face = circle(200, 206, 132);
  const hanger = 'M 186 56 L 200 34 L 214 56 Z';
  const bars = [0, 90, 180, 270].map((a) => {
    const [x, y] = polar(200, 206, 112, a);
    return rotate(rrect(x - 5, y - 14, 10, 28, 3), a, x, y);
  });
  const hourH = rotate('M 196 206 L 198 136 L 200 128 L 202 136 L 204 206 Z', -60, 200, 206);
  const minH = rotate('M 197 206 L 199 104 L 200 96 L 201 104 L 203 206 Z', 50, 200, 206);
  const second = rotate(line(200, 236, 200, 92), 160, 200, 206);
  return join(layered([{ sil: circle(200, 206, 8) }, { sil: '', p: [hourH, minH, second] }, { sil: bars }, { sil: face }, { sil: rim }, { sil: hanger }]), {
    p: [],
    d: [ticks(200, 206, 118, 126, 60, 5)],
  });
}

function candlesticks(): Art {
  const stick = (cx: number, top: number, s: number): string =>
    turned(cx, ([[10, 0], [10, 14], [26, 22], [14, 32], [12, 70], [18, 90], [10, 110], [12, 150], [22, 170], [16, 182], [44, 204], [46, 214]] as P[]).map(([w, y]) => [w * s, top + y * s] as P));
  const taper = (cx: number, top: number, h: number) => rrect(cx - 9, top - h, 18, h + 4, 4);
  const a = stick(146, 150, 0.96);
  const b = stick(256, 126, 1.04);
  return join(
    layered([
      { sil: flame(146, 50, 40), p: [flame(146, 68, 20)] },
      { sil: flame(256, 24, 40), p: [flame(256, 42, 20)] },
      { sil: taper(146, 150, 58), p: [line(146, 90, 146, 96)] },
      { sil: taper(256, 126, 58), p: [line(256, 64, 256, 72)] },
      { sil: a },
      { sil: b },
    ]),
    { p: [], d: ['M 138 204 L 138 236', 'M 247 186 L 247 222', ground(70, 330, 360)] },
  );
}

function sunglasses(): Art {
  const lens = 'M 64 168 C 64 156 72 150 84 150 L 164 150 C 178 150 184 158 182 172 C 178 214 164 246 124 246 C 84 246 66 214 64 168 Z';
  const lensR = mirrorX(lens, 200);
  const bridge = 'M 180 166 C 190 154 210 154 220 166 L 218 176 C 210 166 190 166 182 176 Z';
  const armL = 'M 66 160 L 30 150 L 28 160 L 64 172 Z';
  const armR = mirrorX(armL, 200);
  return join(layered([{ sil: bridge }, { sil: lens, p: [] }, { sil: lensR }, { sil: armL }, { sil: armR }]), {
    p: [],
    d: ['M 92 170 L 120 200', 'M 106 168 L 140 206', 'M 236 170 L 264 200', 'M 250 168 L 284 206', 'M 70 252 Q 200 262 330 252'],
  });
}

function sunHat(): Art {
  const brim = 'M 30 254 C 30 214 110 200 200 200 C 290 200 370 214 370 254 C 370 290 290 306 200 306 C 110 306 30 290 30 254 Z';
  const crown = 'M 120 250 C 112 160 150 124 200 124 C 250 124 288 160 280 250 C 260 266 140 266 120 250 Z';
  const band = 'M 122 214 C 160 228 240 228 278 214 L 280 244 C 240 258 160 258 120 244 Z';
  const bowL = 'M 250 232 C 230 202 204 210 210 230 C 214 246 236 244 250 232 Z';
  const bowR = mirrorX(bowL, 250);
  const tails = ['M 246 238 C 240 256 232 270 224 282 L 236 286 C 242 272 248 258 252 240 Z', 'M 254 238 C 262 256 272 268 284 278 L 274 286 C 264 274 256 260 250 240 Z'];
  return join(layered([{ sil: circle(250, 232, 9) }, { sil: bowL }, { sil: bowR }, { sil: tails }, { sil: band }, { sil: crown }, { sil: brim, p: [] }]), {
    p: [],
    d: ['M 160 150 C 150 170 146 190 146 210', 'M 60 262 C 90 284 150 292 200 292', 'M 340 262 C 320 276 296 284 270 288'],
  });
}

function wristwatch(): Art {
  const strapT = 'M 162 40 L 238 40 L 232 132 L 168 132 Z';
  const strapB = 'M 168 268 L 232 268 L 238 372 L 162 372 Z';
  const lugs = rrect(152, 118, 96, 164, 26);
  const caseO = circle(200, 200, 86);
  const face = circle(200, 200, 72);
  const crown = rrect(282, 188, 18, 24, 4);
  const holes = [300, 322, 344].map((y) => ellipse(200, y, 5, 7));
  const loop = rrect(156, 66, 88, 14, 4);
  return join(
    layered([
      { sil: circle(200, 200, 6) },
      { sil: '', p: [rotate('M 197 200 L 200 152 L 203 200 Z', -40, 200, 200), rotate('M 198 200 L 200 140 L 202 200 Z', 70, 200, 200)] },
      { sil: face },
      { sil: caseO },
      { sil: crown },
      { sil: lugs },
      { sil: loop },
      { sil: strapT },
      { sil: strapB, p: holes },
    ]),
    { p: [], d: [ticks(200, 200, 60, 68, 12)] },
  );
}

function headphones(): Art {
  const band = 'M 76 236 C 64 120 120 46 200 46 C 280 46 336 120 324 236 L 302 236 C 312 132 266 70 200 70 C 134 70 88 132 98 236 Z';
  const pad = rrect(176, 46, 48, 26, 10);
  const cup = (x: number) => rrect(x, 196, 64, 128, 30);
  const cush = (x: number) => rrect(x, 206, 26, 108, 13);
  const yoke = (x: number) => rrect(x, 186, 26, 30, 6);
  return join(
    layered([
      { sil: cush(126), p: [] },
      { sil: cush(248) },
      { sil: cup(64), p: [ellipse(96, 260, 14, 30)] },
      { sil: cup(272), p: [ellipse(304, 260, 14, 30)] },
      { sil: yoke(74) },
      { sil: yoke(300) },
      { sil: pad },
      { sil: band },
    ]),
    { p: [], d: [ground(60, 340, 350)] },
  );
}

function openBook(): Art {
  const left = 'M 200 120 C 160 96 96 96 46 112 L 46 300 C 96 286 160 286 200 310 Z';
  const right = mirrorX(left, 200);
  const cover = 'M 200 326 C 160 304 90 302 34 316 L 34 124 L 46 120 L 46 300 C 96 286 160 286 200 310 C 240 286 304 286 354 300 L 354 120 L 366 124 L 366 316 C 310 302 240 304 200 326 Z';
  const text = (sx: number): string[] =>
    [140, 160, 180, 200, 220, 240, 260].map((y, i) => {
      const x0 = sx < 0 ? 68 : 216;
      const x1 = sx < 0 ? 184 : 332 - (i === 6 ? 50 : 0);
      return `M ${x0} ${y - (sx < 0 ? 0 : 0)} Q ${(x0 + x1) / 2} ${y - 8} ${x1} ${y}`;
    });
  return join(layered([{ sil: left }, { sil: right }, { sil: cover }]), {
    p: ['M 200 120 L 200 310'],
    d: [...text(-1), ...text(1), ground(40, 360, 340)],
  });
}

function spool(): Art {
  const top = ellipse(170, 104, 80, 22);
  const topSide = 'M 90 104 L 90 120 C 90 132 126 142 170 142 C 214 142 250 132 250 120 L 250 104 Z';
  const thread = 'M 108 130 L 108 280 L 232 280 L 232 130 Z';
  const bot = 'M 90 280 L 90 296 C 90 308 126 318 170 318 C 214 318 250 308 250 296 L 250 280 C 250 268 214 258 170 258 C 126 258 90 268 90 280 Z';
  const wraps = Array.from({ length: 13 }, (_, i) => `M 108 ${144 + i * 10} Q 170 ${154 + i * 10} 232 ${140 + i * 10}`);
  const needle = rotate('M 316 110 L 322 110 L 322 320 L 319 340 L 316 320 Z', 18, 319, 225);
  const eye = rotate(ellipse(319, 126, 1.6, 9), 18, 319, 225);
  const loose = 'M 232 230 C 280 240 290 300 330 330 C 360 350 370 300 340 260 C 320 230 300 160 300 130';
  return join(layered([{ sil: top, p: [ellipse(170, 104, 14, 5)] }, { sil: topSide }, { sil: needle, p: [eye] }, { sil: bot }, { sil: thread, d: wraps }, { sil: '', p: [loose] }]), {
    p: [],
    d: [ground(70, 270, 334)],
  });
}

function umbrella(): Art {
  const tips = [40, 93, 147, 200, 253, 307, 360];
  let canopy = `M 40 200 C 40 110 110 50 200 50 C 290 50 360 110 360 200`;
  for (let i = tips.length - 1; i > 0; i--) canopy += ` Q ${(tips[i] + tips[i - 1]) / 2} ${182} ${tips[i - 1]} 200`;
  canopy += ' Z';
  const ribs = [93, 147, 253, 307].map((x) => clip(`M 200 54 Q ${200 + (x - 200) * 0.6} 90 ${x} 196`, [], 'outside'));
  const finial = rrect(195, 30, 10, 24, 4);
  const shaft = 'M 196 190 L 196 324 C 196 356 244 356 244 324 L 244 316 L 236 316 L 236 324 C 236 344 204 344 204 324 L 204 190 Z';
  return join(layered([{ sil: finial }, { sil: canopy, p: [...ribs, 'M 200 54 L 200 196'] }, { sil: shaft }]), {
    p: [],
    d: ['M 70 150 C 84 110 110 86 140 74', ground(150, 290, 364)],
  });
}

function wateringCan(): Art {
  const body = 'M 120 170 L 270 170 L 280 330 Q 280 344 266 344 L 124 344 Q 110 344 110 330 Z';
  const top = ellipse(195, 170, 75, 14);
  const spout = 'M 268 290 L 340 140 L 354 146 L 278 316 Z';
  const rose = rotate('M 330 136 L 366 122 C 378 140 374 160 366 166 L 334 150 Z', 0, 0, 0);
  const handle = 'M 136 170 C 136 80 254 80 254 170 L 238 170 C 238 104 152 104 152 170 Z';
  const back = 'M 118 196 C 70 196 64 270 112 282 L 112 266 C 82 258 86 212 118 212 Z';
  return join(layered([{ sil: top, p: [ellipse(195, 170, 60, 9)] }, { sil: handle }, { sil: rose }, { sil: spout }, { sil: body }, { sil: back }]), {
    p: [],
    d: [...bands(body, [210, 304]), 'M 352 132 L 360 150 M 342 138 L 350 156', ground(90, 300, 356)],
  });
}

function handbag(): Art {
  const body = 'M 96 176 L 304 176 L 334 330 Q 336 346 320 346 L 80 346 Q 64 346 66 330 Z';
  const flap = 'M 96 176 L 304 176 L 312 220 C 270 252 130 252 88 220 Z';
  const clasp = rrect(184, 226, 32, 26, 6);
  const handle = 'M 136 178 C 136 82 264 82 264 178 L 248 178 C 248 104 152 104 152 178 Z';
  const tabs = [rrect(128, 166, 32, 20, 5), rrect(240, 166, 32, 20, 5)];
  return join(layered([{ sil: clasp, p: [rrect(194, 234, 12, 10, 3)] }, { sil: tabs }, { sil: flap }, { sil: body }, { sil: handle }]), {
    p: [],
    d: ['M 100 186 L 300 186', 'M 90 320 L 310 320', ground(60, 340, 358)],
  });
}

// ---- intermediate ------------------------------------------------------------------------------------------------

/** Tapered tube along a cubic Bézier: a closed outline from width w0 to w1. */
function tube(p0: P, p1: P, p2: P, p3: P, w0: number, w1: number, n = 20): string {
  const pts: P[] = [];
  for (let i = 0; i <= n; i++) pts.push(bez(p0, p1, p2, p3, i / n));
  const side = (sgn: number): P[] =>
    pts.map((p, i) => {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(n, i + 1)];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const w = (w0 + (w1 - w0) * (i / n)) * sgn;
      return [p[0] - ((b[1] - a[1]) / L) * w, p[1] + ((b[0] - a[0]) / L) * w] as P;
    });
  const all = [...side(1), ...side(-1).reverse()];
  return `M ${all.map(([x, y]) => `${f(x)} ${f(y)}`).join(' L ')} Z`;
}

function goosenecKettle(): Art {
  const body = 'M 112 330 L 112 204 C 112 174 152 160 200 160 C 248 160 288 174 288 204 L 288 330 Q 288 346 272 346 L 128 346 Q 112 346 112 330 Z';
  const lid = 'M 152 166 C 156 140 244 140 248 166 Z';
  const knob = ellipse(200, 138, 16, 9);
  const stem = rrect(194, 140, 12, 12, 2);
  const handle = 'M 280 186 C 356 176 366 296 288 306 L 288 284 C 338 278 334 202 282 208 Z';
  const spout = tube([120, 300], [40, 304], [84, 166], [30, 140], 9, 4);
  const tip = rotate(rrect(18, 132, 22, 12, 3), 28, 30, 140);
  return join(layered([{ sil: knob }, { sil: stem }, { sil: lid }, { sil: body }, { sil: handle, d: ['M 300 200 C 324 222 326 258 304 280'] }, { sil: tip }, { sil: spout }]), {
    p: [],
    d: [...bands(body, [190, 316]), 'M 132 214 C 126 246 126 284 132 312', 'M 168 160 L 232 160', ground(90, 320, 358)],
  });
}

function cakeStand(): Art {
  const top = ellipse(200, 150, 104, 20);
  const cake = 'M 96 150 L 96 240 C 96 252 144 262 200 262 C 256 262 304 252 304 240 L 304 150 Z';
  const yf = (x: number) => 150 + 20 * Math.sqrt(Math.max(0, 1 - ((x - 200) / 104) ** 2));
  let drip = `M 96 150`;
  const xs = [96, 116, 140, 162, 188, 212, 238, 262, 286, 304];
  const lens = [10, 22, 12, 30, 14, 26, 10, 20, 12];
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i] + 4;
    const b = xs[i + 1] - 4;
    drip += ` L ${f(a)} ${f(yf(a))} C ${f(a)} ${f(yf(a) + lens[i] + 10)} ${f(b)} ${f(yf(b) + lens[i] + 10)} ${f(b)} ${f(yf(b))}`;
  }
  drip += ` L 304 150`;
  const cherry = (x: number, y: number) => circle(x, y, 11);
  const plate = ellipse(200, 262, 156, 24);
  const plateSide = 'M 44 262 L 44 270 C 44 284 114 296 200 296 C 286 296 356 284 356 270 L 356 262 Z';
  const ped = profile(200, [[16, 292], [12, 304], [12, 326], [22, 336], [66, 348], [66, 358]]);
  return join(
    layered([
      { sil: [cherry(170, 140), cherry(204, 132), cherry(236, 142)], p: ['M 170 129 C 170 116 176 108 186 104', 'M 204 121 C 206 108 212 100 222 96', 'M 236 131 C 236 120 240 112 248 108'] },
      { sil: top },
      { sil: cake, p: [drip], d: ['M 96 204 C 96 216 144 226 200 226 C 256 226 304 216 304 204', 'M 96 210 C 96 222 144 232 200 232 C 256 232 304 222 304 210'] },
      { sil: plate },
      { sil: plateSide },
      { sil: ped },
    ]),
    { p: [], d: [ground(110, 290, 368)] },
  );
}

function saucepan(): Art {
  const pot = 'M 76 196 L 256 196 L 256 316 Q 256 340 232 340 L 100 340 Q 76 340 76 316 Z';
  const rim = rrect(68, 188, 196, 14, 6);
  const lid = 'M 72 190 C 80 150 252 150 260 190 Z';
  const knob = 'M 150 160 C 150 136 182 136 182 160 Z';
  const handle = 'M 256 214 L 372 196 Q 384 196 382 208 L 380 216 Q 378 224 368 224 L 256 236 Z';
  const rivets = [circle(266, 216, 3), circle(266, 230, 3)];
  return join(layered([{ sil: knob }, { sil: lid, p: [] }, { sil: rim }, { sil: '', p: rivets }, { sil: pot }, { sil: handle, p: [circle(366, 210, 5)] }]), {
    p: [],
    d: ['M 92 226 C 88 260 88 296 94 324', 'M 100 176 C 120 166 150 162 170 162', 'M 130 120 C 120 104 140 96 130 78', 'M 166 118 C 156 100 178 92 168 70', 'M 202 120 C 192 104 212 96 202 80', ground(60, 300, 352)],
  });
}

function mokaPot(): Art {
  const bottom = roundPoly([[128, 344], [272, 344], [248, 258], [152, 258]], 4);
  const waist = rrect(146, 244, 108, 18, 4);
  const top = roundPoly([[156, 246], [244, 246], [264, 140], [136, 140]], 4);
  const lid = roundPoly([[130, 142], [270, 142], [250, 112], [150, 112]], 5);
  const knob = ellipse(200, 106, 16, 10);
  const spout = 'M 142 168 L 98 118 L 150 128 Z';
  const handle = 'M 262 156 L 324 148 L 308 256 L 286 256 L 300 172 L 260 178 Z';
  const valve = circle(240, 300, 9);
  return join(
    layered([
      { sil: knob },
      { sil: lid, d: ['M 180 112 L 176 142 M 220 112 L 224 142'] },
      { sil: spout },
      { sil: valve, p: [circle(240, 300, 3)] },
      { sil: waist },
      { sil: top, d: ['M 178 246 L 168 140', 'M 222 246 L 232 140'] },
      { sil: bottom, d: ['M 178 344 L 184 258', 'M 222 344 L 216 258'] },
      { sil: handle },
    ]),
    { p: [], d: [ground(90, 310, 358), 'M 162 92 C 154 76 170 68 162 52', 'M 196 88 C 188 70 206 62 198 44'] },
  );
}

function tableLamp(): Art {
  const shade = 'M 130 70 Q 200 80 270 70 L 312 190 Q 200 208 88 190 Z';
  const topRim = ellipse(200, 71, 70, 8);
  const pleats: string[] = [];
  for (let i = 1; i < 14; i++) pleats.push(clip(line(130 + (140 * i) / 14, 60, 88 + (224 * i) / 14, 210), [region(shade)], 'inside'));
  const base = turned(200, [[12, 196], [12, 208], [34, 218], [64, 244], [74, 278], [62, 312], [38, 330], [40, 338]]);
  const plinth = rrect(144, 334, 112, 16, 6);
  const chain = 'M 286 196 L 286 236';
  return join(
    layered([
      { sil: topRim },
      { sil: shade, d: pleats },
      { sil: circle(286, 242, 6) },
      { sil: '', p: [chain] },
      { sil: base, d: [...bands(base, [250, 300]), 'M 176 262 C 192 250 208 250 224 262 C 208 274 192 274 176 262 Z', 'M 150 256 C 146 272 148 290 156 304'] },
      { sil: plinth },
    ]),
    { p: [], d: [ground(100, 300, 362)] },
  );
}

function armchair(): Art {
  const back = 'M 112 252 L 112 104 C 112 66 288 66 288 104 L 288 252 Z';
  const wingL = 'M 114 108 C 82 104 70 134 74 186 C 76 210 84 226 96 236 L 124 236 L 124 120 Z';
  const wingR = mirrorX(wingL, 200);
  const armL = 'M 56 224 C 56 196 116 196 116 224 L 116 330 L 56 330 Z';
  const armR = mirrorX(armL, 200);
  const scrollL = ellipse(86, 226, 30, 22);
  const scrollR = ellipse(314, 226, 30, 22);
  const cushion = rrect(110, 238, 180, 42, 14);
  const skirt = rrect(52, 276, 296, 60, 8);
  const leg = (x: number) => roundPoly([[x - 10, 334], [x + 10, 334], [x + 6, 366], [x - 6, 366]], 3);
  const tufts: string[] = [];
  for (const [y, xs] of [[110, [150, 200, 250]], [146, [126, 176, 226, 276]], [182, [150, 200, 250]], [218, [176, 226]]] as const) for (const x of xs) tufts.push(circle(x, y, 3));
  const diamonds = ['M 150 110 L 126 146 L 150 182 L 176 218 M 200 110 L 176 146 L 150 182 M 250 110 L 226 146 L 200 182 L 176 218 M 200 110 L 226 146 L 250 182 L 226 218 M 150 110 L 176 146 L 200 182 L 226 218 M 250 110 L 276 146 L 250 182'];
  return join(
    layered([
      { sil: scrollL, p: [ellipse(86, 226, 14, 10)] },
      { sil: scrollR, p: [ellipse(314, 226, 14, 10)] },
      { sil: armL },
      { sil: armR },
      { sil: cushion, d: ['M 120 262 C 160 268 240 268 280 262'] },
      { sil: skirt, d: ['M 52 300 L 348 300'] },
      { sil: back, d: [...diamonds.map((d) => clip(d, [region(back)], 'inside')), ...tufts] },
      { sil: wingL },
      { sil: wingR },
      { sil: [leg(76), leg(324)] },
    ]),
    { p: [], d: [ground(40, 360, 372)] },
  );
}

function plantStand(): Art {
  const pot = 'M 142 206 L 258 206 L 246 286 Q 244 294 236 294 L 164 294 Q 156 294 154 286 Z';
  const rim = rrect(132, 192, 136, 20, 6);
  const ringS = rrect(128, 290, 144, 12, 5);
  const legs = [limb([148, 300], [104, 372], 6, 5), limb([252, 300], [296, 372], 6, 5), limb([200, 302], [200, 370], 6, 5)];
  const brace = 'M 124 336 L 276 336';
  const leaves = [
    { a: -66, l: 120, w: 34 },
    { a: -32, l: 150, w: 36 },
    { a: 0, l: 160, w: 34 },
    { a: 30, l: 150, w: 36 },
    { a: 64, l: 124, w: 34 },
    { a: -14, l: 110, w: 28 },
    { a: 16, l: 104, w: 26 },
  ];
  const order = [5, 6, 2, 1, 3, 0, 4];
  const items = order.map((i) => {
    const { a, l, w } = leaves[i];
    const tip = polar(200, 196, l * 0.9, a);
    return { sil: petal(200, 196, a, l, w, 0.55), d: [line(...polar(200, 196, 18, a), ...tip)] };
  });
  return join(layered([{ sil: rim }, { sil: pot, d: ['M 160 226 C 158 250 160 270 166 286'] }, { sil: ringS }, ...items, { sil: '', p: legs }, { sil: '', p: [brace] }]), {
    p: [],
    d: [ground(80, 320, 376)],
  });
}

function mantelClock(): Art {
  const caseS = 'M 56 320 L 56 252 C 56 206 104 196 136 174 C 156 116 244 116 264 174 C 296 196 344 206 344 252 L 344 320 Z';
  const inlay = 'M 72 312 L 72 254 C 72 220 112 210 146 188 C 162 140 238 140 254 188 C 288 210 328 220 328 254 L 328 312 Z';
  const plinth = rrect(44, 316, 312, 22, 6);
  const feet = [rrect(64, 336, 40, 14, 6), rrect(296, 336, 40, 14, 6)];
  const bezel = circle(200, 230, 70);
  const dial = circle(200, 230, 58);
  const hands = [rotate('M 196 230 L 200 186 L 204 230 Z', -50, 200, 230), rotate('M 197 230 L 200 178 L 203 230 Z', 60, 200, 230)];
  return join(
    layered([
      { sil: circle(200, 230, 5) },
      { sil: '', p: hands },
      { sil: dial, d: [ticks(200, 230, 46, 54, 12)] },
      { sil: bezel },
      { sil: caseS, p: [clip(inlay, [region(bezel)])] },
      { sil: plinth },
      { sil: feet },
    ]),
    { p: [], d: ['M 100 290 L 300 290', ground(40, 360, 360)] },
  );
}

function hikingBoot(): Art {
  const collar = 'M 104 82 C 140 70 170 70 200 82 L 196 108 C 166 98 136 98 108 108 Z';
  const tongue = 'M 164 86 C 166 60 196 56 204 74 L 198 112 L 166 112 Z';
  const upper = 'M 110 96 L 194 96 L 200 204 C 236 216 290 228 320 248 C 344 264 350 284 346 300 L 96 300 C 92 230 104 160 110 96 Z';
  const toe = 'M 290 234 C 330 248 350 272 346 300 L 280 300 C 290 282 294 258 290 234 Z';
  const heel = 'M 96 300 C 94 262 98 236 104 212 C 132 220 152 252 152 300 Z';
  const sole = 'M 84 296 L 354 296 C 360 314 354 334 336 336 L 98 336 C 82 336 78 314 84 296 Z';
  const hooks: P[] = [[194, 118], [196, 146], [198, 174], [200, 202]];
  const inner: P[] = [[170, 118], [172, 146], [176, 174], [182, 200]];
  const lace = hooks.slice(0, -1).map(([x, y], i) => `M ${x} ${y} L ${inner[i + 1][0]} ${inner[i + 1][1]} M ${inner[i][0]} ${inner[i][1]} L ${hooks[i + 1][0]} ${hooks[i + 1][1]}`).join(' ');
  const lugs: string[] = [];
  for (let x = 104; x < 340; x += 22) lugs.push(`M ${x} 336 L ${x} 330 L ${x + 12} 330 L ${x + 12} 336`);
  return join(
    layered([
      { sil: hooks.map(([x, y]) => circle(x, y, 5)) },
      { sil: '', p: [lace, 'M 194 110 C 214 96 232 100 226 116 C 214 122 204 116 194 110 M 194 110 C 210 124 214 142 206 150'] },
      { sil: collar },
      { sil: tongue },
      { sil: toe, d: ['M 296 244 C 330 258 342 278 340 296'] },
      { sil: heel, d: ['M 104 222 C 126 232 142 256 144 296'] },
      { sil: upper, d: ['M 118 120 C 112 180 108 240 110 290', 'M 200 216 C 210 250 230 274 270 290'] },
      { sil: sole, d: ['M 88 312 L 352 312', ...lugs] },
    ]),
    { p: [], d: [ground(60, 370, 350)] },
  );
}

function lantern(): Art {
  const tank = 'M 108 300 C 108 280 150 270 200 270 C 250 270 292 280 292 300 L 292 330 C 292 344 250 352 200 352 C 150 352 108 344 108 330 Z';
  const globe = turned(200, [[38, 150], [62, 176], [72, 214], [62, 252], [44, 274]]);
  const cap = roundPoly([[136, 152], [264, 152], [242, 112], [158, 112]], 5);
  const chimney = rrect(176, 94, 48, 20, 5);
  const tubeL = rrect(98, 136, 14, 170, 6);
  const tubeR = rrect(288, 136, 14, 170, 6);
  const bail = 'M 104 140 C 104 20 296 20 296 140 L 286 140 C 286 36 114 36 114 140 Z';
  const ringH = rrect(186, 34, 28, 16, 8);
  const guards = ['M 166 160 C 150 200 150 240 168 270', 'M 234 160 C 250 200 250 240 232 270', 'M 200 156 L 200 168'];
  return join(
    layered([
      { sil: ringH },
      { sil: chimney },
      { sil: cap, d: ['M 150 132 L 250 132'] },
      { sil: tubeL },
      { sil: tubeR },
      { sil: globe, p: [flame(200, 184, 52), rrect(190, 236, 20, 30, 3)], d: guards },
      { sil: tank, p: [], d: ['M 112 300 C 112 316 150 326 200 326 C 250 326 288 316 288 300', 'M 124 318 C 124 330 140 340 150 342'] },
      { sil: bail },
      { sil: rrect(292, 300, 26, 14, 4) },
    ]),
    { p: [], d: [ground(90, 310, 364)] },
  );
}

function guitarParts(): { sil: string | string[]; p?: string[]; d?: string[] }[] {
  const prof: P[] = [[0, 188], [46, 192], [64, 212], [60, 238], [52, 256], [74, 282], [86, 318], [78, 354], [44, 374], [0, 378]];
  const body = smooth([...prof.map(([w, y]) => [200 + w, y] as P), ...prof.slice(1, -1).reverse().map(([w, y]) => [200 - w, y] as P)]);
  const neck = rrect(188, 60, 24, 140, 3);
  const head = 'M 184 66 L 180 22 Q 200 14 220 22 L 216 66 Z';
  const pegs = [30, 42, 54].flatMap((y) => [circle(174, y, 5), circle(226, y, 5)]);
  const frets = [74, 90, 104, 117, 129, 140, 150, 160, 169, 178].map((y) => line(188, y, 212, y));
  const strings = [0, 1, 2, 3, 4, 5].map((i) => line(192 + i * 3.2, 64, 182 + i * 7.2, 326));
  const bridge = rrect(172, 320, 56, 12, 4);
  const guard = 'M 224 276 C 248 270 262 300 244 318 C 232 330 214 316 216 298 Z';
  return [
    { sil: '', p: strings },
    { sil: bridge, p: ['M 180 326 L 220 326'] },
    { sil: pegs },
    { sil: head, d: ['M 200 22 L 200 60'] },
    { sil: neck, d: frets },
    { sil: circle(200, 262, 22) },
    { sil: '', p: [circle(200, 262, 30)], d: [circle(200, 262, 27)] },
    { sil: guard },
    { sil: body, d: ['M 128 300 C 124 320 132 344 150 358'] },
  ];
}

function guitar(): Art {
  const parts = guitarParts();
  const rot = (s: string) => (s ? rotate(s, 24, 200, 200) : s);
  const items = parts.map((it) => ({ ...it, sil: Array.isArray(it.sil) ? it.sil.map(rot) : rot(it.sil as string), p: it.p?.map(rot), d: it.d?.map(rot) }));
  return layered(items as Parameters<typeof layered>[0]);
}

function wheelbarrow(): Art {
  const tray = 'M 54 156 L 300 156 L 276 252 Q 272 262 260 262 L 150 262 Q 132 262 120 250 Z';
  const rim = rrect(46, 146, 262, 16, 6);
  const wheel = circle(112, 304, 48);
  const tyre = circle(112, 304, 36);
  const hub = circle(112, 304, 9);
  const rail = limb([112, 304], [356, 196], 7, 7);
  const grip = limb([332, 207], [368, 191], 9, 9);
  const leg = roundPoly([[248, 250], [262, 250], [278, 352], [264, 352]], 3);
  const foot = rrect(252, 348, 42, 10, 4);
  const spokes = [0, 60, 120].map((a) => line(...polar(112, 304, 10, a), ...polar(112, 304, 34, a + 180)));
  return join(
    layered([
      { sil: hub },
      { sil: grip },
      { sil: rail },
      { sil: foot },
      { sil: leg },
      { sil: rim },
      { sil: tray, d: ['M 70 176 L 290 176', 'M 136 236 L 268 236'] },
      { sil: tyre, p: spokes },
      { sil: wheel },
    ]),
    { p: [], d: ['M 90 146 C 120 124 170 118 200 128 C 230 114 270 120 290 146', ground(56, 340, 366)] },
  );
}

function tulipPitcher(): Art {
  const pitcher = 'M 152 214 L 252 214 C 262 254 288 292 272 330 Q 266 346 250 346 L 154 346 Q 138 346 132 330 C 116 292 142 254 152 214 Z';
  const lip = 'M 148 206 L 256 206 L 256 220 L 152 220 L 118 200 Z';
  const handle = loopHandle(262, 230, 304, 44, 14);
  const tulip = (x: number, y: number, deg: number) =>
    rotate(`M ${x - 22} ${y} C ${x - 28} ${y - 30} ${x - 16} ${y - 46} ${x - 8} ${y - 52} L ${x} ${y - 34} L ${x + 8} ${y - 52} C ${x + 16} ${y - 46} ${x + 28} ${y - 30} ${x + 22} ${y} C ${x + 14} ${y + 14} ${x - 14} ${y + 14} ${x - 22} ${y} Z`, deg, x, y);
  const heads: [number, number, number][] = [[110, 118, -30], [160, 86, -12], [212, 76, 6], [262, 94, 20], [306, 130, 34]];
  const stems = heads.map(([x, y]) => `M ${200 + (x - 200) * 0.12} 214 C ${200 + (x - 200) * 0.3} 170 ${x} ${y + 60} ${x} ${y + 10}`);
  const leafs = [petal(178, 210, -40, 120, 16, 0.4), petal(226, 210, 36, 120, 16, 0.4), petal(196, 210, -8, 100, 12, 0.4)];
  return join(
    layered([
      { sil: lip },
      { sil: pitcher, d: ['M 150 244 C 140 274 140 306 150 330', ...bands(pitcher, [258])] },
      { sil: handle },
      ...heads.map(([x, y, d]) => ({ sil: tulip(x, y, d), p: [rotate(`M ${x} ${y + 8} L ${x} ${y - 34}`, d, x, y)] })),
      ...leafs.map((l) => ({ sil: l })),
      { sil: '', p: stems },
    ]),
    { p: [], d: [ground(100, 310, 358)] },
  );
}

function vanityMirror(): Art {
  const frame = ellipse(200, 168, 92, 120);
  const glass = ellipse(200, 168, 76, 104);
  const posts = [rrect(92, 160, 14, 160, 5), rrect(294, 160, 14, 160, 5)];
  const pivots = [circle(99, 168, 10), circle(301, 168, 10)];
  const base = rrect(70, 312, 260, 42, 8);
  const drawer = rrect(150, 322, 100, 24, 4);
  const top = rrect(62, 304, 276, 12, 5);
  return join(
    layered([
      { sil: pivots, p: [circle(99, 168, 3), circle(301, 168, 3)] },
      { sil: frame, p: [glass], d: [clip('M 140 120 L 196 64 M 148 150 L 234 64 M 196 260 L 252 204', [region(glass)], 'inside')] },
      { sil: posts },
      { sil: top },
      { sil: drawer, p: [circle(200, 334, 4)] },
      { sil: base },
    ]),
    { p: [], d: [ground(50, 350, 366)] },
  );
}

// ---- advanced ----------------------------------------------------------------------------------------------------

function recordPlayer(): Art {
  const sleeve = rotate(rrect(36, 34, 176, 176, 4), -10, 124, 122);
  const topF = rrect(40, 96, 320, 214, 14);
  const front = rrect(40, 290, 320, 50, 12);
  const platter = circle(170, 204, 96);
  const record = circle(170, 204, 88);
  const label = circle(170, 204, 28);
  const grooves = [80, 72, 64, 56, 48, 40].map((r) => circle(170, 204, r));
  const pivot = circle(306, 136, 18);
  const arm = 'M 302 140 L 310 140 L 312 230 C 312 250 296 262 270 268 L 266 260 C 288 254 302 246 302 230 Z';
  const head = rotate(rrect(244, 258, 34, 18, 3), -14, 262, 266);
  const knobs = [circle(318, 266, 12), circle(286, 290, 0.1)].slice(0, 1);
  const grain = hatch(front, 0, 6, [], [40, 290, 360, 340]).map((d, i) => (i % 2 ? d : ''));
  return join(
    layered([
      { sil: head, d: [rotate('M 250 268 L 272 268', -14, 262, 266)] },
      { sil: arm },
      { sil: pivot, p: [circle(306, 136, 8)] },
      { sil: label, p: [circle(170, 204, 4)], d: ['M 152 196 L 188 196', 'M 156 212 L 184 212'] },
      { sil: record, d: [...grooves, 'M 110 160 C 124 144 142 134 162 130', 'M 230 250 C 216 266 196 276 176 278'] },
      { sil: platter, d: [ticks(170, 204, 90, 95, 48)] },
      { sil: knobs, p: [line(318, 256, 318, 262)] },
      { sil: [rrect(330, 168, 14, 40, 4)] },
      { sil: topF, d: [rrect(52, 106, 296, 194, 8)] },
      { sil: front, d: [...grain.filter(Boolean), 'M 70 314 C 120 306 170 322 230 312 C 280 304 320 318 340 312'] },
      { sil: sleeve, d: hatch(sleeve, 35, 9, [region(topF)]) },
    ]),
    { p: [], d: [ground(30, 370, 352)] },
  );
}

function violinArt(): { sil: string | string[]; p?: string[]; d?: string[] }[] {
  const prof: P[] = [[0, 118], [34, 122], [54, 138], [60, 162], [54, 186], [58, 196], [40, 204], [35, 222], [40, 240], [62, 250], [70, 268], [72, 296], [62, 322], [36, 338], [0, 342]];
  const pts = (k: number): P[] => [...prof, ...prof.slice(1, -1).reverse().map(([w, y]) => [-w, y] as P)].map(([w, y], i) => [200 + w * (i <= prof.length - 1 ? 1 : 1) * k, 230 + (y - 230) * (k === 1 ? 1 : 0.95)] as P);
  const body = smooth([...prof.map(([w, y]) => [200 + w, y] as P), ...prof.slice(1, -1).reverse().map(([w, y]) => [200 - w, y] as P)]);
  const purfle = smooth(pts(0.9));
  const board = roundPoly([[193, 44], [207, 44], [214, 250], [186, 250]], 3);
  const box = rrect(192, 26, 16, 36, 5);
  const scroll = circle(200, 22, 11);
  const pegs = [[186, 34], [214, 40], [186, 48], [214, 54]].map(([x, y]) => rrect(x - 8, y - 3, 16, 6, 3));
  const tail = 'M 190 286 L 210 286 L 214 326 Q 200 336 186 326 Z';
  const bridge = 'M 180 264 L 220 264 L 216 272 L 184 272 Z';
  const fhole = (x: number, s: number) => `M ${x - 6 * s} 230 C ${x + 10 * s} 236 ${x - 10 * s} 270 ${x + 6 * s} 282`;
  const strings = [0, 1, 2, 3].map((i) => line(196 + i * 2.7, 46, 192 + i * 5.4, 288));
  const grain = hatch(body, 90, 9, [region(board), region(tail), region(bridge)]);
  return [
    { sil: '', p: strings },
    { sil: bridge },
    { sil: tail, p: [circle(200, 326, 2.5)] },
    { sil: scroll, p: [spiral(198, 22, 2.4, 4)] },
    { sil: pegs },
    { sil: box },
    { sil: board },
    { sil: '', p: [fhole(166, 1), fhole(234, -1), circle(160, 228, 3), circle(172, 284, 3), circle(240, 228, 3), circle(228, 284, 3)] },
    { sil: body, p: [purfle], d: grain },
  ];
}

function violin(): Art {
  const rot = (s: string) => (s ? rotate(s, -22, 200, 200) : s);
  const items = violinArt().map((it) => ({ ...it, sil: Array.isArray(it.sil) ? it.sil.map(rot) : rot(it.sil as string), p: it.p?.map(rot), d: it.d?.map(rot) }));
  const stick = limb([70, 330], [340, 70], 4, 3);
  const hair = 'M 84 330 L 344 82';
  const frog = rotate(rrect(64, 316, 40, 18, 4), -44, 84, 325);
  const tip = rotate('M 334 64 L 356 64 L 352 84 L 334 76 Z', -44, 344, 74);
  return join(layered([...(items as Parameters<typeof layered>[0]), { sil: frog, p: [rotate(circle(84, 325, 3), -44, 84, 325)] }, { sil: tip }, { sil: stick }, { sil: '', p: [hair] }]), {
    p: [],
    d: [ground(60, 340, 372)],
  });
}

function sewingMachine(): Art {
  const bed = rrect(40, 288, 320, 34, 8);
  const plinth = rrect(28, 318, 344, 34, 8);
  const pillar = 'M 252 288 L 262 150 L 318 150 L 322 288 Z';
  const arm = 'M 96 114 C 96 96 110 90 130 90 L 300 90 C 326 90 336 104 336 126 L 336 156 L 128 162 L 128 250 L 96 250 Z';
  const head = rrect(84, 106, 52, 150, 12);
  const wheel = circle(342, 150, 40);
  const hub = circle(342, 150, 10);
  const spool = [rrect(206, 58, 34, 10, 3), rrect(210, 66, 26, 22, 3), rrect(206, 82, 34, 10, 3)];
  const needleBar = rrect(104, 254, 10, 26, 2);
  const foot = 'M 96 280 L 128 280 L 132 288 L 92 288 Z';
  const thread = 'M 223 62 C 200 40 160 60 130 98 M 110 120 L 110 252';
  const ornament = [
    'M 150 110 C 170 98 200 120 220 106 C 240 92 270 116 300 104',
    'M 160 130 C 176 120 196 138 214 126 C 230 116 252 136 280 124',
    'M 186 118 C 192 108 204 108 206 118 C 204 128 192 128 186 118 Z',
  ];
  const spokes = [0, 72, 144, 216, 288].map((a) => line(...polar(342, 150, 12, a), ...polar(342, 150, 32, a)));
  return join(
    layered([
      { sil: '', p: [thread] },
      { sil: spool, d: ['M 214 70 L 232 70 M 214 76 L 232 76 M 214 82 L 232 82'] },
      { sil: hub, p: [circle(342, 150, 3)] },
      { sil: wheel, p: [circle(342, 150, 32)], d: spokes },
      { sil: head, d: ['M 92 140 L 128 140', rrect(94, 190, 32, 40, 6)] },
      { sil: needleBar, p: [line(109, 280, 109, 290)] },
      { sil: foot },
      { sil: arm, d: [...ornament, 'M 140 150 L 330 146'] },
      { sil: pillar, d: hatch(pillar, 70, 9) },
      { sil: bed, p: [rrect(150, 292, 50, 12, 3)], d: ['M 220 298 L 330 298'] },
      { sil: plinth, d: hatch(plinth, 0, 6).slice(1), draw: true },
    ]),
    { p: [], d: [ground(30, 370, 364)] },
  );
}

function bicycle(): Art {
  const R = 70;
  const rear: P = [104, 282];
  const frontH: P = [300, 282];
  const bb: P = [192, 288];
  const seatTop: P = [172, 176];
  const headTop: P = [276, 166];
  const headBot: P = [284, 198];
  const wheel = (c: P) => [circle(c[0], c[1], R), circle(c[0], c[1], R - 8)];
  const spokes = (c: P) => Array.from({ length: 12 }, (_, i) => line(...polar(c[0], c[1], 6, i * 30), ...polar(c[0], c[1], R - 10, i * 30 + 14))).join(' ');
  const tube = (a: P, b: P, w = 5) => limb(a, b, w, w);
  const down = tube(headBot, bb, 6);
  const step = 'M 282 212 C 240 230 210 260 196 284 L 186 280 C 202 252 234 220 278 200 Z';
  const fork = tube(headBot, frontH, 4);
  const stays = [tube(rear, bb, 4), tube(rear, [seatTop[0] + 4, seatTop[1] + 28], 3.5)];
  const seatT = tube(bb, seatTop, 5);
  const head = tube(headTop, headBot, 7);
  const saddle = 'M 140 168 C 150 158 186 158 198 166 C 196 176 170 178 140 174 Z';
  const post = tube([172, 176], [170, 168], 3);
  const bars = 'M 276 166 L 270 140 C 262 128 244 128 236 136 L 240 142 C 248 136 258 138 262 144 L 268 168 Z';
  const grip = rrect(226, 130, 18, 12, 5);
  const basket = roundPoly([[290, 120], [366, 120], [358, 182], [298, 182]], 5);
  const ring = circle(bb[0], bb[1], 20);
  const fenderR = `M ${rear[0] - 78} ${rear[1]} A 78 78 0 0 1 ${rear[0] + 40} ${rear[1] - 67}`;
  const fenderF = `M ${frontH[0] - 54} ${frontH[1] - 57} A 78 78 0 0 1 ${frontH[0] + 78} ${frontH[1]}`;
  const chain = `M ${bb[0]} ${bb[1] - 20} L ${rear[0]} ${rear[1] - 9} M ${bb[0]} ${bb[1] + 20} L ${rear[0]} ${rear[1] + 9}`;
  const pedal = rrect(206, 316, 26, 8, 3);
  const crank = tube(bb, [218, 318], 3);
  const weave = [...hatch(basket, 90, 10), ...bands(basket, [136, 152, 168])];
  return join(
    layered([
      { sil: basket, d: weave },
      { sil: grip },
      { sil: bars },
      { sil: saddle },
      { sil: post },
      { sil: head },
      { sil: pedal },
      { sil: crank },
      { sil: ring, p: [circle(bb[0], bb[1], 6)], d: [ticks(bb[0], bb[1], 16, 20, 18)] },
      { sil: seatT },
      { sil: step },
      { sil: down },
      { sil: stays },
      { sil: fork },
      { sil: '', p: [chain, 'M 312 182 L 297 262', 'M 344 182 L 303 262'] },
      { sil: circle(...rear, 9) },
      { sil: circle(...frontH, 6) },
      { sil: '', p: [fenderR, fenderF] },
      { sil: wheel(rear)[1], draw: false, d: [spokes(rear)] },
      { sil: wheel(frontH)[1], draw: false, d: [spokes(frontH)] },
      { sil: '', p: [...wheel(rear), ...wheel(frontH)] },
    ]),
    { p: [], d: [ground(24, 376, 362)] },
  );
}

function twinLensCamera(): Art {
  const body = rrect(112, 92, 176, 262, 14);
  const hood = 'M 120 92 L 132 40 L 268 40 L 280 92 Z';
  const view = circle(200, 162, 44);
  const take = circle(200, 270, 54);
  const plate = rrect(150, 206, 100, 18, 4);
  const knob = rrect(84, 176, 30, 60, 8);
  const lugs = [rrect(100, 106, 14, 22, 4), rrect(286, 106, 14, 22, 4)];
  const lenses = (c: number, r: number): { sil: string; p?: string[]; d?: string[] }[] => [
    { sil: circle(200, c, r * 0.42), d: ['M ' + f(200 - r * 0.2) + ' ' + f(c - r * 0.12) + ' C ' + f(200 - r * 0.14) + ' ' + f(c - r * 0.24) + ' ' + f(200 + r * 0.02) + ' ' + f(c - r * 0.28) + ' ' + f(200 + r * 0.12) + ' ' + f(c - r * 0.26)] },
    { sil: circle(200, c, r * 0.66) },
    { sil: circle(200, c, r * 0.82), d: [ticks(200, c, r * 0.84, r * 0.96, 36)] },
    { sil: circle(200, c, r) },
  ];
  const tex = hatch(body, 45, 8, [region(view), region(take), region(plate), region(rrect(124, 100, 152, 16, 4))]);
  const tex2 = hatch(body, -45, 8, [region(view), region(take), region(plate), region(rrect(124, 100, 152, 16, 4))]);
  return join(
    layered([
      ...lenses(162, 44),
      ...lenses(270, 54),
      { sil: plate, d: ['M 162 215 L 238 215'] },
      { sil: rrect(124, 100, 152, 16, 4), d: ['M 150 108 L 250 108'] },
      { sil: body, d: [...tex, ...tex2] },
      { sil: lugs },
      { sil: knob, d: ['M 90 186 L 108 186 M 90 196 L 108 196 M 90 206 L 108 206 M 90 216 L 108 216 M 90 226 L 108 226'] },
      { sil: hood, d: ['M 148 52 L 252 52', 'M 140 66 L 260 66', 'M 136 80 L 264 80'] },
    ]),
    { p: [], d: [ground(70, 330, 368)] },
  );
}

function castIronTeapot(): Art {
  const body = 'M 96 250 C 96 196 140 172 200 172 C 260 172 304 196 304 250 C 304 300 262 330 200 330 C 138 330 96 300 96 250 Z';
  const lid = 'M 150 178 C 156 150 244 150 250 178 Z';
  const knob = 'M 188 152 C 184 132 216 132 212 152 Z';
  const bail = 'M 116 210 C 104 70 296 70 284 210 L 272 204 C 282 90 118 90 128 204 Z';
  const lugs = [rrect(110, 196, 22, 22, 6), rrect(268, 196, 22, 22, 6)];
  const spout = 'M 104 268 C 80 262 66 240 56 214 L 74 206 C 82 228 96 240 112 240 Z';
  const cup = 'M 300 290 L 372 290 L 366 346 Q 364 356 352 356 L 320 356 Q 308 356 306 346 Z';
  const cupRim = ellipse(336, 290, 36, 8);
  const dots: string[] = [];
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 12; c++) {
      const x = 108 + c * 17 + (r % 2) * 8.5;
      const y = 196 + r * 17;
      dots.push(circle(x, y, 4));
    }
  }
  const studs = dots.map((d) => clip(d, [region(body)], 'inside')).filter((d) => d && /Z$/.test(d));
  const shade = hatch(body, -60, 6, [region(spout)], [230, 180, 310, 330]).map((d) => clip(d, [region(ellipse(200, 250, 92, 70))]));
  return join(
    layered([
      { sil: knob },
      { sil: lid, d: ['M 162 166 C 180 160 220 160 238 166'] },
      { sil: cupRim, p: [ellipse(336, 290, 30, 5)] },
      { sil: cup, d: hatch(cup, 60, 6, [region(cupRim)], [340, 290, 372, 356]) },
      { sil: lugs },
      { sil: body, p: [], d: [...studs, ...shade.filter(Boolean), 'M 100 232 C 150 220 250 220 300 232'] },
      { sil: spout },
      { sil: bail },
    ]),
    { p: [], d: [ground(60, 290, 344)] },
  );
}

function booksSpectacles(): Art {
  const D: P = [22, -20];
  type Book = { x: number; y: number; w: number; h: number; spine: boolean };
  const books: Book[] = [
    { x: 92, y: 196, w: 196, h: 34, spine: false },
    { x: 66, y: 230, w: 244, h: 38, spine: true },
    { x: 80, y: 268, w: 238, h: 40, spine: false },
    { x: 56, y: 308, w: 276, h: 44, spine: true },
  ];
  const items: { sil: string; p?: string[]; d?: string[] }[] = [];
  const lensL = circle(166, 150, 30);
  const lensR = circle(240, 150, 30);
  items.push({ sil: lensL, p: [], d: ['M 152 138 L 170 128', 'M 150 150 L 176 132'] });
  items.push({ sil: lensR, d: ['M 226 138 L 244 128', 'M 224 150 L 250 132'] });
  items.push({ sil: '', p: ['M 196 146 C 200 136 206 136 210 146', 'M 136 146 L 120 188', 'M 270 146 L 294 186'] });
  for (const b of books) {
    const face = rrect(b.x, b.y, b.w, b.h, 4);
    const top = `M ${b.x} ${b.y + 2} L ${b.x + D[0]} ${b.y + D[1]} L ${b.x + b.w + D[0]} ${b.y + D[1]} L ${b.x + b.w} ${b.y + 2} Z`;
    const side = `M ${b.x + b.w - 2} ${b.y} L ${b.x + b.w + D[0]} ${b.y + D[1]} L ${b.x + b.w + D[0]} ${b.y + b.h + D[1]} L ${b.x + b.w - 2} ${b.y + b.h} Z`;
    const d: string[] = [];
    const p: string[] = [];
    if (b.spine) {
      for (const k of [0.14, 0.2, 0.8, 0.86]) p.push(line(b.x + b.w * k, b.y + 3, b.x + b.w * k, b.y + b.h - 3));
      p.push(rrect(b.x + b.w * 0.36, b.y + b.h * 0.3, b.w * 0.28, b.h * 0.4, 3));
      d.push(line(b.x + b.w * 0.4, b.y + b.h * 0.5, b.x + b.w * 0.6, b.y + b.h * 0.5));
    } else {
      p.push(rrect(b.x + 6, b.y + 6, b.w - 12, b.h - 12, 2));
      for (let y = b.y + 10; y < b.y + b.h - 8; y += 3.5) d.push(line(b.x + 8, y, b.x + b.w - 8, y));
    }
    items.push({ sil: face, p, d });
    items.push({ sil: top, d: b === books[0] ? [`M ${b.x + 30} ${b.y - 6} L ${b.x + b.w} ${b.y - 6}`] : [] });
    items.push({ sil: side, d: b.spine ? [] : hatch(side, 0, 3.5) });
  }
  return join(layered(items), { p: [], d: [ground(30, 370, 360)] });
}

function coffeeGrinder(): Art {
  const box = rrect(110, 196, 180, 150, 6);
  const topPlate = rrect(100, 184, 200, 16, 4);
  const drawer = rrect(140, 280, 120, 46, 4);
  const knobD = circle(200, 303, 8);
  const hopper = 'M 128 186 C 120 150 140 128 200 128 C 260 128 280 150 272 186 Z';
  const shaft = rrect(194, 96, 12, 36, 3);
  const crank = 'M 196 100 C 230 82 280 80 318 88 L 316 100 C 280 94 236 96 204 110 Z';
  const handleK = rrect(306, 46, 22, 46, 10);
  const nut = ellipse(200, 96, 16, 7);
  const feet = [rrect(114, 344, 30, 10, 3), rrect(256, 344, 30, 10, 3)];
  const bean = (x: number, y: number, a: number) => rotate(`${ellipse(x, y, 10, 7)} M ${x - 8} ${y} C ${x - 3} ${y - 3} ${x + 3} ${y + 3} ${x + 8} ${y}`, a, x, y);
  const grainBox = hatch(box, 0, 7, [region(drawer)]).map((d, i) => (i % 3 === 1 ? '' : d)).filter(Boolean);
  return join(
    layered([
      { sil: handleK, d: ['M 312 56 L 312 82'] },
      { sil: crank },
      { sil: nut },
      { sil: shaft },
      { sil: hopper, d: [...bands(hopper, [150, 166]), ...hatch(hopper, -70, 7, [], [236, 128, 280, 190])] },
      { sil: topPlate },
      { sil: knobD },
      { sil: drawer, d: ['M 146 286 L 254 286'] },
      { sil: box, d: grainBox },
      { sil: feet },
    ]),
    { p: [bean(70, 340, 20), bean(96, 352, -30), bean(326, 346, 50), bean(350, 334, -10)], d: [ground(50, 360, 362)] },
  );
}

function longcaseClock(): Art {
  const hood = 'M 126 150 L 126 76 C 126 30 274 30 274 76 L 274 150 Z';
  const crest = 'M 150 40 C 170 18 230 18 250 40 Z';
  const finials = [circle(134, 50, 7), circle(266, 50, 7), circle(200, 18, 0.1)].slice(0, 2);
  const dial = circle(200, 96, 46);
  const ring = circle(200, 96, 36);
  const trunk = rrect(144, 150, 112, 160, 4);
  const door = rrect(162, 164, 76, 132, 30);
  const bob = circle(200, 260, 16);
  const rod = 'M 198 166 L 202 166 L 202 246 L 198 246 Z';
  const base = rrect(124, 308, 152, 50, 4);
  const plinth = rrect(116, 352, 168, 14, 4);
  const cornice = rrect(116, 144, 168, 12, 4);
  const moon = 'M 170 76 C 176 56 224 56 230 76 C 220 70 180 70 170 76 Z';
  const hands = [rotate('M 197 96 L 200 70 L 203 96 Z', -40, 200, 96), rotate('M 198 96 L 200 64 L 202 96 Z', 50, 200, 96)];
  return join(
    layered([
      { sil: circle(200, 96, 4) },
      { sil: '', p: hands },
      { sil: moon },
      { sil: ring, d: [ticks(200, 96, 37, 44, 60, 5), ticks(200, 96, 36, 45, 12)] },
      { sil: dial },
      { sil: finials },
      { sil: crest },
      { sil: hood, p: [rrect(140, 60, 120, 82, 6)], d: hatch(hood, 90, 6, [region(rrect(140, 60, 120, 82, 6))]) },
      { sil: cornice },
      { sil: bob, p: [circle(200, 260, 8)] },
      { sil: rod },
      { sil: door, d: ['M 172 180 L 186 168', 'M 172 200 L 210 168', 'M 214 288 L 228 274'] },
      { sil: trunk, d: hatch(trunk, 90, 6, [region(door)]) },
      { sil: base, p: [rrect(140, 318, 120, 30, 4)], d: ['M 150 333 C 170 323 190 343 200 333 C 210 323 230 343 250 333'] },
      { sil: plinth },
    ]),
    { p: [], d: [ground(90, 310, 374)] },
  );
}

function jugLemons(): Art {
  const jug = 'M 140 120 L 236 120 C 236 150 250 170 270 200 C 296 240 296 300 266 332 Q 256 344 240 344 L 136 344 Q 120 344 110 332 C 80 300 80 240 106 200 C 126 170 140 150 140 120 Z';
  const lip = 'M 132 106 L 244 106 Q 252 106 252 114 L 252 126 L 128 126 L 96 104 Z';
  const handle = 'M 240 150 C 330 140 340 260 278 300 L 270 282 C 316 250 306 166 246 172 Z';
  const lemon = (x: number, y: number, rx: number, ry: number, a: number) =>
    rotate(`M ${x - rx} ${y} C ${x - rx} ${y - ry * 1.2} ${x + rx} ${y - ry * 1.2} ${x + rx} ${y} Q ${x + rx + 10} ${y} ${x + rx + 12} ${y + 2} Q ${x + rx + 10} ${y + 4} ${x + rx} ${y + 4} C ${x + rx} ${y + ry * 1.3} ${x - rx} ${y + ry * 1.3} ${x - rx} ${y + 4} Q ${x - rx - 10} ${y + 4} ${x - rx - 12} ${y + 2} Q ${x - rx - 10} ${y} ${x - rx} ${y} Z`, a, x, y);
  const l1 = lemon(290, 330, 40, 26, -8);
  const half = ellipse(84, 330, 46, 24);
  const halfIn = ellipse(84, 330, 38, 18);
  const segs = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    return line(84 + Math.cos(a) * 5, 330 + Math.sin(a) * 3, 84 + Math.cos(a) * 34, 330 + Math.sin(a) * 15);
  });
  const leafL = petal(318, 300, 50, 70, 16, 0.4);
  const cloth = 'M 24 340 C 80 350 300 352 376 336 L 376 372 C 300 378 80 378 24 372 Z';
  const shadeRight = hatch(jug, -50, 6, [region(handle)], [210, 120, 300, 344]).map((d) => clip(d, [region(ellipse(178, 250, 84, 140))]));
  return join(
    layered([
      { sil: half, p: [halfIn, ...segs] },
      { sil: l1, d: ['M 266 316 C 280 310 300 310 314 316', circle(272, 338, 1.2), circle(298, 344, 1.2), circle(312, 334, 1.2)] },
      { sil: leafL, d: [line(...polar(318, 300, 8, 50), ...polar(318, 300, 60, 50))] },
      { sil: lip },
      { sil: jug, d: [...shadeRight.filter(Boolean), ...bands(jug, [210, 222]), 'M 112 236 C 100 266 102 300 116 324'] },
      { sil: handle },
      { sil: cloth, d: ['M 60 352 C 90 360 120 362 150 358', 'M 200 362 C 250 368 300 364 340 356'] },
    ]),
    { p: [], d: [] },
  );
}

// ---- catalogue -----------------------------------------------------------------------------------------------

export const stilllife3: Template[] = [
  tpl('round-teapot', 'Round teapot', 'beginner', ['teapot', 'tea', 'kitchen', 'pottery', 'simple'], roundTeapot()),
  tpl('enamel-coffee-pot', 'Enamel coffee pot', 'beginner', ['coffee', 'pot', 'kitchen', 'camping', 'simple'], coffeePot()),
  tpl('water-glass', 'Stemmed water glass', 'beginner', ['glass', 'goblet', 'water', 'kitchen', 'simple'], waterGlass()),
  tpl('jam-jar', 'Jam jar with a cloth lid', 'beginner', ['jar', 'jam', 'kitchen', 'pantry', 'gingham', 'simple'], jamJar()),
  tpl('frying-pan', 'Frying pan with a fried egg', 'beginner', ['pan', 'egg', 'breakfast', 'kitchen', 'cooking', 'simple'], fryingPan()),
  tpl('wall-clock', 'Round wall clock', 'beginner', ['clock', 'time', 'home', 'kitchen', 'simple'], wallClock()),
  tpl('candlesticks', 'Pair of candlesticks', 'beginner', ['candle', 'candlestick', 'flame', 'home', 'simple'], candlesticks()),
  tpl('sunglasses', 'Sunglasses', 'beginner', ['sunglasses', 'summer', 'fashion', 'accessory', 'simple'], sunglasses()),
  tpl('sun-hat', 'Wide-brim sun hat', 'beginner', ['hat', 'summer', 'fashion', 'ribbon', 'simple'], sunHat()),
  tpl('wristwatch', 'Wristwatch', 'beginner', ['watch', 'time', 'accessory', 'strap', 'simple'], wristwatch()),
  tpl('headphones', 'Over-ear headphones', 'beginner', ['headphones', 'music', 'audio', 'gadget', 'simple'], headphones()),
  tpl('open-book', 'Open book', 'beginner', ['book', 'reading', 'pages', 'study', 'simple'], openBook()),
  tpl('spool', 'Spool of thread with a needle', 'beginner', ['spool', 'thread', 'needle', 'sewing', 'craft', 'simple'], spool()),
  tpl('umbrella', 'Open umbrella', 'beginner', ['umbrella', 'rain', 'weather', 'outdoor', 'simple'], umbrella()),
  tpl('watering-can', 'Watering can', 'beginner', ['watering can', 'garden', 'outdoor', 'plants', 'simple'].map((t) => t.replace(' ', '-')), wateringCan()),
  tpl('handbag', 'Top-handle handbag', 'beginner', ['handbag', 'bag', 'fashion', 'accessory', 'simple'], handbag()),
  tpl('gooseneck-kettle', 'Gooseneck pour-over kettle', 'intermediate', ['kettle', 'coffee', 'pour-over', 'kitchen', 'modern'], goosenecKettle()),
  tpl('cake-stand', 'Cake stand with a layer cake', 'intermediate', ['cake', 'stand', 'baking', 'cherries', 'party'], cakeStand()),
  tpl('saucepan', 'Saucepan with a lid', 'intermediate', ['pan', 'saucepan', 'cooking', 'kitchen', 'steam'], saucepan()),
  tpl('stovetop-coffee-pot', 'Stovetop coffee pot', 'intermediate', ['coffee', 'pot', 'espresso', 'kitchen', 'italian'], mokaPot()),
  tpl('table-lamp', 'Table lamp with a pleated shade', 'intermediate', ['lamp', 'shade', 'home', 'light', 'interior'], tableLamp()),
  tpl('wingback-armchair', 'Wingback armchair', 'intermediate', ['armchair', 'chair', 'furniture', 'home', 'interior'], armchair()),
  tpl('plant-stand', 'Potted plant on a stand', 'intermediate', ['plant', 'pot', 'stand', 'houseplant', 'home'], plantStand()),
  tpl('mantel-clock', 'Arched mantel clock', 'intermediate', ['clock', 'mantel', 'antique', 'time', 'home'], mantelClock()),
  tpl('hiking-boot', 'Lace-up hiking boot', 'intermediate', ['boot', 'shoe', 'hiking', 'outdoor', 'laces'], hikingBoot()),
  tpl('hurricane-lantern', 'Hurricane lantern', 'intermediate', ['lantern', 'camping', 'flame', 'vintage', 'outdoor'], lantern()),
  tpl('acoustic-guitar', 'Acoustic guitar', 'intermediate', ['guitar', 'music', 'instrument', 'strings', 'acoustic'], guitar()),
  tpl('wheelbarrow', 'Garden wheelbarrow', 'intermediate', ['wheelbarrow', 'garden', 'outdoor', 'tools', 'wheel'], wheelbarrow()),
  tpl('tulip-pitcher', 'Tulips in a pitcher', 'intermediate', ['vase', 'pitcher', 'jug', 'tulips', 'spring'], tulipPitcher()),
  tpl('vanity-mirror', 'Oval vanity mirror', 'intermediate', ['mirror', 'dressing', 'table', 'home', 'interior'], vanityMirror()),
  tpl('record-player', 'Record player with a sleeve', 'advanced', ['record player', 'vinyl', 'music', 'retro', 'turntable'].map((t) => t.replace(' ', '-')), recordPlayer()),
  tpl('violin', 'Violin and bow', 'advanced', ['violin', 'music', 'instrument', 'strings', 'classical'], violin()),
  tpl('sewing-machine', 'Vintage sewing machine', 'advanced', ['sewing', 'machine', 'vintage', 'craft', 'antique'], sewingMachine()),
  tpl('bicycle', 'Town bicycle with a basket', 'advanced', ['bicycle', 'bike', 'basket', 'outdoor', 'cycling'], bicycle()),
  tpl('twin-lens-camera', 'Twin-lens reflex camera', 'advanced', ['camera', 'photography', 'vintage', 'film', 'medium-format'], twinLensCamera()),
  tpl('cast-iron-teapot', 'Cast-iron teapot with a cup', 'advanced', ['teapot', 'tea', 'cup', 'hobnail', 'japanese'], castIronTeapot()),
  tpl('books-spectacles', 'Old books with spectacles', 'advanced', ['books', 'spectacles', 'reading', 'library', 'antique'], booksSpectacles()),
  tpl('coffee-grinder', 'Hand-crank coffee grinder', 'advanced', ['grinder', 'coffee', 'beans', 'kitchen', 'vintage'], coffeeGrinder()),
  tpl('longcase-clock', 'Longcase clock', 'advanced', ['clock', 'grandfather', 'pendulum', 'antique', 'furniture'], longcaseClock()),
  tpl('jug-lemons', 'Stoneware jug with lemons', 'advanced', ['jug', 'lemons', 'fruit', 'kitchen', 'pottery'], jugLemons()),
];
