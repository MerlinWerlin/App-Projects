// Flagship scene: Bookshop Lane. Four nested levels:
//   street -> (shop window) inside the bookshop -> (reading nook) window seat -> (cushion) sleeping cat.
// Each child is drawn in its parent's portal rectangle; the parent draws a simple stand-in there so the
// zoomed-out view still reads, and the child fades in with the real detail.
import { LevelArt, circle, curve, ellipse, frame, line, petal, poly, rect, ring, rot, scallop, smooth } from '../core/build.ts';
import { between, rng } from '../core/rng.ts';
import type { Level, Scene } from '../core/scene.ts';

// ---------------------------------------------------------------- shared bits

/** Paned window: frame with holes + one fillable pane per hole. */
function panes(a: LevelArt, x: number, y: number, w: number, h: number, cols: number, rows: number, bar = 6, edge = 8, name = 'pane') {
  const pw = (w - bar * (cols - 1)) / cols;
  const ph = (h - bar * (rows - 1)) / rows;
  const holes: [number, number, number, number][] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) holes.push([x + c * (pw + bar), y + r * (ph + bar), pw, ph]);
  a.fill('frame', frame(x - edge, y - edge, w + edge * 2, h + edge * 2, holes));
  for (const [hx, hy, hw, hh] of holes) a.fill(name, rect(hx, hy, hw, hh));
}

function archPath(x: number, y: number, w: number, h: number): string {
  const r = w / 2;
  const k = 0.5523 * r;
  return `M${x} ${y + h}V${y + r}C${x} ${y + r - k} ${x + r - k} ${y} ${x + r} ${y}C${x + r + k} ${y} ${x + w} ${y + r - k} ${x + w} ${y + r}V${y + h}Z`;
}

/** A curtain gathered at a tie-back. xo = outer edge, xi = inner edge (works for either side). */
function drape(a: LevelArt, xo: number, xi: number, top: number, tie: number, bottom: number) {
  const w = xi - xo;
  const at = (f: number) => xo + w * f;
  a.fill(
    'curtain',
    `M${xo} ${top}H${xi}Q${at(0.86)} ${(top + tie) / 2} ${at(0.8)} ${tie}Q${at(0.86)} ${(tie + bottom) / 2} ${xi} ${bottom}` +
      `Q${at(0.5)} ${bottom + 10} ${at(-0.12)} ${bottom}Q${at(0.06)} ${(tie + bottom) / 2} ${at(0.05)} ${tie}Q${xo} ${(top + tie) / 2} ${xo} ${top}Z`,
  );
  for (const f of [0.3, 0.55]) a.ink(curve([at(f), top + 6, at(f * 0.9 + 0.08), (top + tie) / 2, at(0.42), tie - 4]), 0.45);
  for (const f of [0.25, 0.6]) a.ink(curve([at(0.42), tie + 14, at(f), (tie + bottom) / 2, at(f * 1.1 - 0.05), bottom - 4]), 0.45);
  const tl = Math.min(at(0.02), at(0.83));
  a.fill('tieback', rect(tl - 4, tie - 10, Math.abs(at(0.83) - at(0.02)) + 8, 20, 9));
}

/** Little five-petal flower (window boxes, rugs, cushions). */
function flower(a: LevelArt, cx: number, cy: number, r: number, n = 5, name = 'petal') {
  for (let i = 0; i < n; i++) a.fill(name, petal(cx, cy, (i / n) * Math.PI * 2 - Math.PI / 2, r * 0.25, r, r * 0.32));
  a.fill('flowerheart', circle(cx, cy, r * 0.3));
}

/** Books standing on a shelf between x0 and x1, bottoms on `base`. */
function books(a: LevelArt, x0: number, x1: number, base: number, maxH: number, seed: number) {
  const r = rng(seed);
  let x = x0 + 3;
  while (x < x1 - 14) {
    const w = Math.min(between(r, 15, 30), x1 - x - 2);
    if (w < 12) break;
    const h = between(r, maxH * 0.68, maxH * 0.97);
    const lean = r() < 0.12 && x1 - x > 60;
    if (lean) {
      // A book leaning on its neighbour.
      const pts = rot([x, base - h, x + w, base - h, x + w, base, x, base], x + w, base, 16);
      a.fill('book', poly(pts));
      x += w + h * 0.3;
      continue;
    }
    a.fill('book', rect(x, base - h, w, h, 2));
    const band = r();
    if (band < 0.45) {
      a.fill('label', rect(x + 3, base - h * 0.62, w - 6, h * 0.16, 1.5));
    } else if (band < 0.8) {
      a.ink(line([x + 1, base - h + 9, x + w - 1, base - h + 9]), 0.5);
      a.ink(line([x + 1, base - 10, x + w - 1, base - 10]), 0.5);
    }
    x += w + (r() < 0.15 ? 6 : 1.5);
  }
}

/** Horizontal stack of books lying flat (tables, floor). */
function bookStack(a: LevelArt, cx: number, base: number, n: number, seed: number, scale = 1) {
  const r = rng(seed);
  let y = base;
  for (let i = 0; i < n; i++) {
    const w = between(r, 90, 130) * scale;
    const h = between(r, 16, 24) * scale;
    const off = between(r, -10, 10) * scale;
    a.fill('stackbook', rect(cx - w / 2 + off, y - h, w, h, 2 * scale));
    a.ink(line([cx - w / 2 + off + 8 * scale, y - h + 3 * scale, cx - w / 2 + off + 8 * scale, y - 3 * scale]), 0.5);
    y -= h;
  }
  return y;
}

// ---------------------------------------------------------------- level 0: the street

function street(): Level {
  const a = new LevelArt('street');
  a.fill('sky', rect(0, 0, 1200, 900));
  a.fill('sun', circle(1095, 95, 46));
  a.fill('cloud', scallop(160, 75, 78, 24, 7, 0.4));
  a.fill('cloud', scallop(700, 40, 66, 18, 6, 0.4));
  a.fill('cloud', scallop(1010, 175, 50, 15, 5, 0.4));
  for (const [bx, by] of [
    [420, 40],
    [460, 58],
    [930, 70],
  ] as const)
    a.ink(curve([bx - 12, by - 4, bx - 5, by - 7, bx, by, bx + 5, by - 7, bx + 12, by - 4]), 0.7);

  // Left house
  a.fill('chimney', rect(200, 92, 36, 70));
  a.fill('chimneycap', rect(193, 84, 50, 12, 3));
  a.fill('houseWall', rect(0, 200, 288, 470));
  a.fill('houseRoof', poly([-10, 206, 298, 206, 252, 128, 26, 128]));
  for (let i = 1; i < 3; i++) a.ink(line([26 - i * 0 + i * 4, 128 + i * 26, 252 + i * 15 - i * 4, 128 + i * 26]), 0.5);
  panes(a, 38, 250, 84, 104, 2, 2);
  panes(a, 166, 250, 84, 104, 2, 2);
  for (const wx of [38, 166]) {
    a.fill('windowbox', rect(wx - 12, 364, 108, 20, 3));
    for (let k = 0; k < 4; k++) flower(a, wx + 6 + k * 24, 356, 12);
  }
  panes(a, 36, 440, 214, 132, 3, 2);
  a.fill('houseDoorstep', rect(20, 585, 248, 16, 3));
  a.fill('houseBase', rect(0, 618, 288, 52));
  for (let k = 0; k < 4; k++) a.ink(line([k * 72 + 36, 618, k * 72 + 36, 670]), 0.5);

  // Right townhouse
  a.fill('townWall', rect(914, 210, 296, 460));
  a.fill('cornice', rect(904, 192, 316, 24, 3));
  for (const wx of [948, 1078]) {
    a.fill('archFrame', archPath(wx - 9, 247, 98, 135) + archPath(wx, 256, 80, 126));
    a.fill('archGlass', archPath(wx, 256, 80, 126));
    a.ink(line([wx + 40, 256, wx + 40, 382]), 0.6);
    a.ink(line([wx, 330, wx + 80, 330]), 0.6);
  }
  a.fill('balcony', rect(928, 392, 270, 14, 3));
  a.fill('rail', rect(936, 360, 254, 8, 3));
  for (let k = 0; k <= 12; k++) a.ink(line([940 + k * 20.5, 368, 940 + k * 20.5, 392]), 0.6);
  for (let k = 0; k < 3; k++) {
    a.fill('pot', poly([960 + k * 88, 362, 990 + k * 88, 362, 986 + k * 88, 340, 964 + k * 88, 340]));
    a.fill('bush', scallop(975 + k * 88, 325, 26, 18, 6, 0.3));
  }
  panes(a, 944, 452, 140, 150, 2, 3);
  a.fill('townDoorFrame', rect(1100, 436, 86, 234, 4) + rect(1110, 446, 66, 224));
  a.fill('townDoor', rect(1110, 446, 66, 224));
  a.fill('townDoorPanel', rect(1120, 470, 46, 70, 4));
  a.fill('townDoorPanel', rect(1120, 560, 46, 90, 4));
  a.fill('knob', circle(1168, 555, 5));

  // Bookshop
  a.fill('shopWall', rect(310, 150, 580, 520));
  a.fill('mansard', poly([294, 156, 906, 156, 860, 70, 340, 70]));
  a.ink(line([322, 99, 878, 99]), 0.5);
  a.ink(line([308, 128, 892, 128]), 0.5);
  a.fill('dormerRing', ring(600, 112, 21, 31));
  a.fill('dormer', circle(600, 112, 21));
  a.fill('signBoard', rect(400, 172, 400, 66, 12));
  a.fill('signInset', rect(412, 182, 376, 46, 8));
  // open-book emblem
  a.fill('emblemPage', poly([600, 196, 560, 186, 545, 192, 545, 220, 560, 214, 600, 222]));
  a.fill('emblemPage', poly([600, 196, 640, 186, 655, 192, 655, 220, 640, 214, 600, 222]));
  for (const sx of [470, 730]) a.fill('star', poly(starPts(sx, 205, 14, 6, 5)));
  // striped scalloped awning
  for (let i = 0; i < 10; i++) {
    const tx0 = 336 + i * 52.8;
    const tx1 = tx0 + 52.8;
    const bx0 = 318 + i * 56.4;
    const bx1 = bx0 + 56.4;
    a.fill(i % 2 ? 'awningB' : 'awningA', `M${tx0} 256L${tx1} 256L${bx1} 304Q${(bx0 + bx1) / 2} 352 ${bx0} 304Z`);
  }
  a.fill('awningBar', rect(330, 248, 540, 10, 4));
  // shop window (portal into the shop)
  a.fill('shopFrame', frame(330, 344, 380, 286, [[350, 362, 340, 255]], 4));
  a.fill('shopGlass', rect(350, 362, 340, 255));
  // stand-in for the inside: shelves and spines as seen from the street
  for (const sy of [430, 505, 580]) a.ink(line([358, sy, 470, sy]), 0.7);
  for (const sy of [430, 505, 580]) a.ink(line([570, sy, 682, sy]), 0.7);
  for (const [sx, sy] of [
    [362, 430],
    [362, 505],
    [362, 580],
    [578, 430],
    [578, 505],
    [578, 580],
  ] as const) {
    let x = sx;
    const r = rng(sx * 7 + sy);
    while (x < sx + 96) {
      const w = between(r, 8, 13);
      const h = between(r, 34, 50);
      a.fill('glimpseBook', rect(x, sy - h, w, h, 1));
      x += w + 1.5;
    }
  }
  a.fill('glimpseNook', rect(487, 400, 66, 50, 3), 'shop/nookWall');
  a.ink(line([352, 372, 400, 372]), 0.4);
  a.fill('sill', rect(320, 626, 400, 20, 4));
  // door
  a.fill('doorFrame', archPath(734, 372, 142, 298) + archPath(750, 388, 110, 282));
  a.fill('door', archPath(750, 388, 110, 282));
  a.fill('doorGlass', archPath(770, 406, 70, 84));
  a.fill('doorPanel', rect(770, 512, 70, 120, 5));
  a.fill('knob', circle(848, 560, 6));
  a.fill('step', rect(726, 656, 158, 16, 4));
  a.fill('shopBase', rect(310, 646, 416, 24));
  // topiary by the door
  a.fill('topiaryStem', rect(902, 616, 7, 40));
  a.fill('topiary', scallop(905, 600, 34, 34, 9, 0.22));
  a.fill('topiaryPot', poly([882, 650, 928, 650, 918, 702, 892, 702]));
  a.fill('topiaryRim', rect(878, 644, 54, 12, 3));

  // lamp post
  a.fill('lampBase', poly([248, 700, 282, 700, 276, 672, 254, 672]));
  a.fill('lampPole', rect(259, 430, 12, 244));
  a.fill('lampCap', poly([240, 382, 290, 382, 265, 360]));
  a.fill('lampGlass', poly([246, 382, 284, 382, 278, 428, 252, 428]));
  a.fill('lampFoot', rect(246, 426, 38, 8, 2));
  a.fill('lampFinial', circle(265, 354, 7));

  // pavement and cobbled lane
  a.fill('pavement', rect(0, 670, 1200, 46));
  for (let k = 1; k < 15; k++) a.ink(line([k * 80, 670, k * 80 - 6, 716]), 0.5);
  a.fill('kerb', rect(0, 714, 1200, 12));
  a.fill('mortar', rect(0, 726, 1200, 174));
  const r = rng(11);
  for (let row = 0; row < 5; row++) {
    const y = 731 + row * 36;
    let x = row % 2 ? -30 : -5;
    while (x < 1200) {
      const w = between(r, 58, 84);
      const x0 = Math.max(0, x);
      const x1 = Math.min(1200, x + w);
      if (x1 - x0 > 16) a.fill('cobble', rect(x0, y, x1 - x0, 30, Math.min(12, (x1 - x0) / 2)));
      x += w + 6;
    }
  }

  // bunting from the chimney to the townhouse
  const sag = (t: number) => [236 + t * (1210 - 236), 92 + t * (120 - 92) + Math.sin(t * Math.PI) * 30] as const;
  const pts: number[] = [];
  for (let k = 0; k <= 20; k++) pts.push(...sag(k / 20));
  a.ink(curve(pts), 0.6);
  for (let k = 1; k < 22; k++) {
    const [x0, y0] = sag((k - 0.35) / 22);
    const [x1, y1] = sag((k + 0.35) / 22);
    a.fill(k % 3 === 0 ? 'flagA' : k % 3 === 1 ? 'flagB' : 'flagC', poly([x0, y0, x1, y1, (x0 + x1) / 2, (y0 + y1) / 2 + 30]));
  }
  return a.level({ stroke: 2.6 });
}

export function starPts(cx: number, cy: number, R: number, r: number, n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n * 2; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / n;
    const rad = i % 2 ? r : R;
    out.push(cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad);
  }
  return out;
}

// ---------------------------------------------------------------- level 1: inside the bookshop

function shop(): Level {
  const a = new LevelArt('shop');
  a.fill('wall', rect(0, 0, 1200, 900));
  // wainscot behind everything
  a.fill('wainscot', rect(0, 560, 1200, 130));
  a.ink(line([0, 575, 1200, 575]), 0.6);
  // floorboards
  a.fill('floor', rect(0, 690, 1200, 210));
  const r = rng(5);
  for (let row = 0; row < 5; row++) {
    const y = 690 + row * 42;
    let x = -between(r, 0, 120);
    while (x < 1200) {
      const w = between(r, 180, 320);
      const x0 = Math.max(0, x);
      const x1 = Math.min(1200, x + w);
      if (x1 - x0 > 20) a.fill('plank', rect(x0, y, x1 - x0, 42));
      x += w;
    }
  }

  // two tall bookcases
  for (const [ux, seed] of [
    [30, 101],
    [790, 202],
  ] as const) {
    const holes: [number, number, number, number][] = [];
    for (let k = 0; k < 5; k++) holes.push([ux + 15, 82 + k * 120, 350, 108]);
    a.fill('crown', rect(ux - 12, 46, 404, 26, 4));
    a.fill('case', frame(ux, 70, 380, 620, holes));
    for (const [hx, hy, hw, hh] of holes) {
      a.fill('caseBack', rect(hx, hy, hw, hh));
      books(a, hx, hx + hw, hy + hh, hh - 8, seed + hy);
    }
  }

  // ladder on the right bookcase
  a.fill('ladderRail', poly([858, 690, 870, 690, 918, 96, 906, 96]));
  a.fill('ladderRail', poly([934, 690, 946, 690, 984, 96, 972, 96]));
  for (let k = 1; k < 9; k++) {
    const t = k / 9;
    const y = 690 - t * 594;
    const xl = 864 + t * 48;
    const xr = 940 + t * 38;
    a.fill('rung', rect(xl + 4, y - 4, xr - xl - 8, 8, 2));
  }

  // reading-nook opening (portal into the nook)
  a.fill('nookSurround', frame(425, 140, 350, 280, [[450, 170, 300, 225]], 6));
  a.fill('nookWall', rect(450, 170, 300, 225), 'nook/wall');
  // stand-in for the nook, matching the next level's layout at 1/4 scale
  a.fill('glimpseWindow', rect(525, 185, 150, 90), 'nook/nightSky');
  a.ink(line([575, 185, 575, 275]), 0.6);
  a.ink(line([625, 185, 625, 275]), 0.6);
  a.ink(line([525, 230, 675, 230]), 0.6);
  a.fill('glimpseSeat', rect(505, 279, 190, 20, 6), 'nook/seatCushion');
  a.fill('glimpseBase', rect(503, 299, 194, 51), 'nook/seatBase');
  a.fill('glimpseCushion', rect(605, 281, 45, 36, 7), 'cushion/cushion');
  a.fill('glimpseCat', ellipse(625, 305, 18, 9), 'cushion/catBody');
  a.fill('glimpsePillow', rect(527, 262, 40, 35, 6), 'nook/pillow');
  // valance and curtains (outside the portal so the child never cuts them)
  let v = 'M413 122H787V150';
  for (let k = 0; k < 8; k++) {
    const x1 = 787 - k * 46.75;
    v += `Q${x1 - 23.4} 172 ${x1 - 46.75} 150`;
  }
  a.fill('valance', v + 'Z');
  drape(a, 398, 449, 122, 268, 416);
  drape(a, 802, 751, 122, 268, 416);

  // pendant lamp
  a.ink(line([600, 0, 600, 62]), 0.8);
  a.fill('shade', poly([570, 62, 630, 62, 660, 106, 540, 106]));
  a.fill('bulb', `M582 106Q600 128 618 106Z`);

  // reading table with stacks and a desk lamp
  a.fill('tableTop', rect(440, 560, 320, 18, 4));
  a.fill('tableLeg', rect(458, 578, 16, 112));
  a.fill('tableLeg', rect(726, 578, 16, 112));
  a.fill('tableApron', rect(458, 578, 284, 18));
  bookStack(a, 520, 560, 4, 31);
  bookStack(a, 620, 560, 3, 32, 0.9);
  a.fill('lampBase', ellipse(712, 554, 30, 7));
  a.fill('lampStem', rect(708, 480, 8, 72));
  a.fill('lampShade', `M670 488Q712 446 754 488Z`);
  a.fill('mug', rect(640, 500, 28, 30, 4));
  a.fill('mugHandle', ring(670, 514, 5, 10));

  // rug with rings
  a.fill('rug', ellipse(600, 800, 290, 74));
  a.fill('rugBand', ellipse(600, 800, 250, 60) + ellipse(600, 800, 212, 48));
  a.fill('rugMid', ellipse(600, 800, 212, 48));
  a.fill('rugBand', ellipse(600, 800, 150, 32) + ellipse(600, 800, 100, 20));
  a.fill('rugCentre', ellipse(600, 800, 100, 20));
  for (let k = 0; k < 18; k++) {
    const ang = (k / 18) * Math.PI * 2;
    flowerless(a, 600 + Math.cos(ang) * 231, 800 + Math.sin(ang) * 54);
  }

  // potted plant, front left
  a.fill('leaf', smooth([120, 760, 70, 650, 60, 560, 110, 650]));
  a.fill('leaf', smooth([130, 760, 140, 620, 175, 540, 160, 660]));
  a.fill('leaf', smooth([125, 760, 205, 680, 250, 640, 195, 720]));
  a.fill('leaf', smooth([118, 760, 40, 720, 10, 680, 70, 730]));
  a.fill('plantPot', poly([80, 750, 170, 750, 158, 850, 92, 850]));
  a.fill('plantRim', rect(72, 740, 106, 16, 4));

  // books piled on the floor, right
  bookStack(a, 1040, 860, 5, 77, 1.1);
  return a.level({ parent: 'street', portal: { x: 350, y: 362, w: 340, h: 255 }, stroke: 2.6 });
}

function flowerless(a: LevelArt, x: number, y: number) {
  a.fill('rugDot', circle(x, y, 6));
}

// ---------------------------------------------------------------- level 2: the reading nook

function nook(): Level {
  const a = new LevelArt('nook');
  a.fill('wall', rect(0, 0, 1200, 900), 'shop/nookWall');
  for (let k = 0; k < 12; k++) a.fill('stripe', rect(k * 100, 0, 50, 700));
  // floor and rug
  a.fill('floor', rect(0, 702, 1200, 198));
  a.fill('rug', rect(150, 760, 900, 120, 50));
  a.fill('rugBorder', rect(170, 772, 860, 96, 40) + rect(196, 786, 808, 68, 30));
  for (let k = 0; k < 9; k++) a.fill('rugDiamond', poly([240 + k * 90, 820, 262 + k * 90, 804, 284 + k * 90, 820, 262 + k * 90, 836]));
  for (let k = 0; k < 28; k++) a.ink(line([170 + k * 31, 880, 170 + k * 31, 896]), 0.5);
  // view through the window (kept inside the frame's inner area 305..895, 65..375)
  a.fill('nightSky', rect(305, 65, 590, 310));
  a.fill('moon', circle(790, 130, 32));
  a.fill('moonShadow', `M790 98C814 108 818 150 790 162C808 146 808 112 790 98Z`);
  for (const [sx, sy] of [
    [360, 100],
    [450, 150],
    [560, 95],
    [680, 170],
    [860, 210],
    [400, 220],
  ] as const)
    a.fill('star', poly(starPts(sx, sy, 10, 4, 4)));
  a.fill('farHill', `M305 300C420 240 540 250 640 285C730 315 820 260 895 270V375H305Z`);
  a.fill('nearHill', `M305 340C420 310 520 330 600 352C700 380 800 330 895 335V375H305Z`);
  a.fill('treeTrunk', rect(436, 260, 10, 50));
  a.fill('treeTop', scallop(441, 240, 30, 30, 7, 0.25));
  a.fill('cottage', rect(700, 285, 50, 34));
  a.fill('cottageRoof', poly([692, 287, 758, 287, 725, 262]));
  a.fill('cottageLight', rect(717, 296, 14, 12));
  panes(a, 305, 65, 590, 310, 3, 2, 16, 25, 'glass');
  // the glass panes sit over the view: make them transparent by removing them again (frame holes stay)
  a.regions.splice(a.regions.length - 6, 6);
  a.fill('sill', rect(258, 396, 684, 22, 5));
  // curtain rod, curtains, fairy lights
  a.fill('rod', rect(160, 14, 880, 12, 6));
  a.fill('finial', circle(156, 20, 13));
  a.fill('finial', circle(1044, 20, 13));
  drape(a, 178, 332, 26, 268, 520);
  drape(a, 1022, 868, 26, 268, 520);
  const lights: number[] = [];
  for (let k = 0; k <= 16; k++) {
    const x = 330 + (k / 16) * 540;
    lights.push(x, 34 + Math.abs(Math.sin((k / 16) * Math.PI * 3)) * 26);
  }
  a.ink(curve(lights), 0.5);
  for (let k = 1; k < 16; k += 1) a.fill(k % 2 ? 'bulbA' : 'bulbB', ellipse(lights[k * 2]!, lights[k * 2 + 1]! + 8, 5, 8));

  // window seat
  a.fill('seatBase', rect(200, 492, 800, 210));
  for (let k = 0; k < 3; k++) {
    a.fill('drawer', rect(226 + k * 254, 528, 238, 140, 8));
    a.fill('drawerKnob', circle(345 + k * 254, 598, 9));
  }
  a.fill('seatCushion', rect(205, 418, 790, 80, 28));
  a.ink(line([240, 470, 960, 470]), 0.4);
  // left pillow and right bolster
  a.fill('pillow', smooth(rot([250, 300, 420, 300, 425, 455, 245, 455], 335, 378, -9), 0.35));
  a.fill('pillowButton', circle(336, 378, 9));
  for (const [x0, y0, x1, y1] of [
    [270, 326, 296, 348],
    [400, 312, 376, 336],
    [276, 436, 300, 414],
    [408, 422, 384, 402],
  ] as const)
    a.ink(curve([x0, y0, (x0 + x1) / 2 + 4, (y0 + y1) / 2, x1, y1]), 0.5);
  a.fill('bolster', rect(860, 360, 120, 66, 33));
  a.fill('bolsterEnd', ellipse(965, 393, 14, 33));
  for (const bx of [890, 920]) a.ink(line([bx, 362, bx, 424]), 0.5);

  // cushion with the cat (portal: matches the next level at 1/5 scale)
  a.fill('glimpseCushion', rect(632, 446, 176, 136, 20), 'cushion/cushion');
  a.fill('glimpseMotif', circle(720, 500, 30), 'cushion/motifBack');
  a.fill('glimpseCat', smooth([640, 560, 660, 500, 720, 490, 770, 505, 800, 560, 740, 582, 680, 582]), 'cushion/catBody');
  a.fill('glimpseHead', circle(782, 530, 22), 'cushion/catHead');

  // side table with tea
  a.fill('tableTop', ellipse(1090, 560, 92, 20));
  a.fill('tableStem', rect(1082, 580, 16, 170));
  a.fill('tableFoot', ellipse(1090, 752, 60, 12));
  a.fill('saucer', ellipse(1080, 548, 40, 8));
  a.fill('cup', `M1052 500H1108Q1106 546 1080 546Q1054 546 1052 500Z`);
  a.fill('cupHandle', ring(1110, 518, 7, 14));
  for (const sx of [1068, 1088]) a.ink(curve([sx, 490, sx - 8, 470, sx + 4, 450, sx - 4, 430]), 0.5);

  // hanging planter top left
  a.ink(line([80, 0, 60, 160]), 0.5);
  a.ink(line([80, 0, 100, 160]), 0.5);
  a.fill('planter', `M44 160H116Q112 210 80 212Q48 210 44 160Z`);
  for (let k = 0; k < 6; k++) a.fill('vineLeaf', ellipse(56 - (k % 2) * 8, 220 + k * 34, 10, 16));
  for (let k = 0; k < 5; k++) a.fill('vineLeaf', ellipse(108 + (k % 2) * 8, 224 + k * 32, 10, 16));
  a.ink(curve([56, 205, 50, 300, 54, 410]), 0.4);
  a.ink(curve([108, 205, 114, 300, 110, 380]), 0.4);

  // stack of books on the floor by the seat
  bookStack(a, 100, 760, 4, 61);
  return a.level({ parent: 'shop', portal: { x: 450, y: 170, w: 300, h: 225 }, stroke: 2.6 });
}

// ---------------------------------------------------------------- level 3: the cat on its cushion

function cushion(): Level {
  const a = new LevelArt('cushion');
  a.fill('seatBase', rect(0, 0, 1200, 900), 'nook/seatBase');
  a.fill('seatFabric', rect(0, 0, 1200, 375), 'nook/seatCushion');
  // quilting stitches and buttons
  for (let k = -4; k < 14; k++) {
    a.ink(line([k * 120, 0, k * 120 + 375, 375]), 0.35);
    a.ink(line([k * 120 + 375, 0, k * 120, 375]), 0.35);
  }
  for (let k = 0; k < 11; k++) a.fill('quiltButton', circle(k * 120 + 60, 187, 9));
  a.fill('drawer', rect(-20, 455, 1240, 420, 20), 'nook/drawer2');
  a.fill('piping', rect(0, 356, 1200, 34, 17), 'nook/seatCushion');

  // the cushion: puffy square with a piped border and tassels
  const outer = 'M150 140Q600 92 1050 140Q1094 470 1050 800Q600 848 150 800Q106 470 150 140Z';
  const inner = 'M196 182Q600 142 1004 182Q1040 470 1004 758Q600 798 196 758Q160 470 196 182Z';
  for (const [tx, ty] of [
    [150, 140],
    [1050, 140],
    [150, 800],
    [1050, 800],
  ] as const) {
    const dx = tx < 600 ? -1 : 1;
    const dy = ty < 470 ? -1 : 1;
    a.fill('tassel', smooth([tx, ty, tx + dx * 30, ty + dy * 18, tx + dx * 64, ty + dy * 70, tx + dx * 40, ty + dy * 82, tx + dx * 16, ty + dy * 32]));
    for (let k = 0; k < 3; k++) a.ink(line([tx + dx * (26 + k * 10), ty + dy * (34 + k * 8), tx + dx * (40 + k * 8), ty + dy * (70 + k * 3)]), 0.4);
  }
  a.fill('cushionBorder', outer + inner);
  a.fill('cushion', inner);
  // mandala motif (top centre, the cat covers the lower part)
  const cx = 600;
  const cy = 400;
  a.fill('motifBack', circle(cx, cy, 200));
  for (let i = 0; i < 24; i++) a.fill('motifDot', circle(cx + Math.cos((i / 24) * Math.PI * 2) * 186, cy + Math.sin((i / 24) * Math.PI * 2) * 186, 9));
  for (let i = 0; i < 16; i++) a.fill('motifPetalOut', petal(cx, cy, (i / 16) * Math.PI * 2, 112, 172, 17, true));
  a.fill('motifBand', ring(cx, cy, 96, 112));
  for (let i = 0; i < 8; i++) a.fill('motifPetal', petal(cx, cy, (i / 8) * Math.PI * 2 + Math.PI / 8, 38, 96, 21));
  for (let i = 0; i < 8; i++) a.fill('motifSeed', circle(cx + Math.cos((i / 8) * Math.PI * 2) * 66, cy + Math.sin((i / 8) * Math.PI * 2) * 66, 8));
  a.fill('motifHeart', circle(cx, cy, 34));
  a.fill('motifCore', circle(cx, cy, 14));
  for (const [fx, fy] of [
    [282, 262],
    [918, 262],
  ] as const)
    flower(a, fx, fy, 50, 6, 'cornerPetal');

  // the cat, curled up asleep, head on the right
  a.fill('tail', smooth([250, 690, 330, 780, 520, 812, 700, 790, 760, 760, 700, 760, 520, 776, 360, 748, 280, 680], 0.9));
  a.fill('tailTip', smooth([700, 760, 760, 760, 790, 776, 752, 794, 700, 790], 0.8));
  a.fill('catBody', smooth([230, 640, 300, 520, 450, 470, 620, 480, 760, 540, 800, 640, 760, 730, 600, 770, 400, 765, 270, 720], 0.95));
  for (const [x0, y0, x1, y1, x2, y2] of [
    [370, 492, 392, 540, 360, 590],
    [450, 478, 470, 530, 440, 584],
    [530, 476, 548, 528, 520, 580],
    [610, 484, 622, 530, 600, 574],
  ] as const)
    a.fill('stripe', smooth([x0 - 14, y0, x0 + 14, y0 - 2, x1 + 4, y1, x2 + 2, y2, x2 - 8, y2 - 4, x1 - 10, y1 - 2], 0.7));
  a.ink(curve([300, 700, 320, 630, 390, 610, 430, 660, 420, 730]), 0.7);
  a.fill('paw', ellipse(690, 742, 44, 24));
  a.fill('paw', ellipse(760, 728, 40, 22));
  for (const [px, py] of [
    [672, 748],
    [690, 752],
    [708, 748],
    [744, 734],
    [760, 738],
    [776, 734],
  ] as const)
    a.ink(line([px, py - 8, px, py + 8]), 0.4);
  // head
  a.fill('ear', smooth([760, 520, 772, 430, 830, 486]));
  a.fill('ear', smooth([880, 486, 940, 432, 942, 528]));
  a.fill('innerEar', smooth([775, 506, 782, 456, 818, 490]));
  a.fill('innerEar', smooth([890, 492, 928, 458, 928, 512]));
  a.fill('catHead', smooth([745, 600, 760, 512, 850, 478, 940, 510, 960, 600, 920, 666, 850, 684, 780, 664], 0.9));
  a.fill('muzzle', ellipse(852, 628, 46, 30));
  a.fill('collar', smooth([770, 662, 850, 690, 930, 664, 936, 688, 850, 716, 766, 688], 0.6));
  a.fill('bell', circle(850, 716, 16));
  a.ink(line([838, 718, 862, 718]), 0.5);
  a.ink(curve([790, 580, 806, 592, 824, 580]), 0.8);
  a.ink(curve([880, 580, 896, 592, 914, 580]), 0.8);
  a.fill('nose', poly([840, 612, 864, 612, 852, 626]));
  a.ink(curve([852, 626, 852, 636, 842, 642]), 0.6);
  a.ink(curve([852, 636, 862, 642]), 0.6);
  for (const [x0, y0, x1, y1] of [
    [826, 630, 760, 618],
    [826, 638, 764, 646],
    [878, 630, 944, 618],
    [878, 638, 940, 646],
  ] as const)
    a.ink(curve([x0, y0, (x0 + x1) / 2, (y0 + y1) / 2 - 3, x1, y1]), 0.4);
  a.fill('forehead', smooth([830, 500, 852, 492, 874, 500, 862, 546, 842, 546], 0.8));

  // yarn ball, bottom right
  a.fill('yarn', circle(1080, 800, 72));
  for (const k of [-40, -10, 22, 50]) a.ink(curve([1080 + k - 30, 740, 1080 + k + 6, 800, 1080 + k - 20, 866]), 0.5);
  a.ink(curve([1030, 760, 1090, 780, 1140, 760]), 0.5);
  a.ink(curve([1010, 850, 900, 880, 760, 860, 620, 884]), 0.6);
  return a.level({ parent: 'nook', portal: { x: 600, y: 420, w: 240, h: 180 }, stroke: 2.6 });
}

export const bookshop: Scene = {
  id: 'bookshop',
  theme: 'cosy',
  version: 1,
  palette: 'cosy',
  levels: [street(), shop(), nook(), cushion()],
};
