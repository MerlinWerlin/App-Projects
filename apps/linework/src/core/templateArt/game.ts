// Game world: original line art in the video-game genre (fb-1022) on a 400×400 canvas — pixel-grid items and
// heroes drawn as merged cell outlines, plus robots, a mech, racers, a gamepad, monsters and a platform level.
// Every piece is our own design built from genre tropes only: no existing character, item design, logo, console
// or controller shape is drawn or evoked (see docs/TEMPLATES.md). Overlaps use occlude.ts so hidden lines vanish.
import type { Template, TemplateLevel } from '../templates.ts';
import { circle, ellipse, f, line, mirrorX, petal, poly, rotate, rrect, shift, star, type P } from './draw.ts';
import { clip, region, roundPoly, stack, union } from './occlude.ts';

const VB = '0 0 400 400';

function tpl(
  id: string,
  name: string,
  level: TemplateLevel,
  tags: string[],
  paths: string[],
  detail: string[] = [],
): Template {
  return {
    id: `game-${id}`,
    name,
    category: 'game',
    level,
    tags: ['game', 'video-game', ...tags],
    viewBox: VB,
    paths: paths.filter(Boolean),
    ...(detail.filter(Boolean).length ? { detail: detail.filter(Boolean) } : {}),
  };
}

// ---- pixel-grid kit -------------------------------------------------------------------------
// A sprite is rows of characters: '.' is empty, any other character is a filled cell of that "colour".
// The traced drawing is the merged outline of all filled cells, the lines where two colours meet, and
// (for higher levels) the remaining cell lines inside each colour.

type Grid = string[];

/** Symmetric sprite rows from half-widths per row (cols must be even). */
function sym(widths: number[], cols: number, ch = '#'): string[][] {
  return widths.map((w) => {
    const pad = (cols - w) / 2;
    return [...'.'.repeat(pad) + ch.repeat(w) + '.'.repeat(pad)];
  });
}

/** Set cells on a mutable grid: list of [row, col] for a character. */
function paint(g: string[][], ch: string, cells: [number, number][]): void {
  for (const [r, c] of cells) g[r][c] = ch;
}

const rowsOf = (g: string[][]): Grid => g.map((r) => r.join(''));

type Pixel = { outline: string; colours: string; grid: string };

/** Trace a sprite into outline / colour-boundary / cell-grid paths at cell size s with top-left (x0, y0). */
function pixel(rows: Grid, s: number, x0?: number, y0?: number): Pixel {
  const cols = Math.max(...rows.map((r) => r.length));
  const g = rows.map((r) => r.padEnd(cols, '.'));
  const R = g.length;
  const ox = x0 ?? 200 - (cols * s) / 2;
  const oy = y0 ?? 200 - (R * s) / 2;
  const at = (r: number, c: number): string => (r < 0 || r >= R || c < 0 || c >= cols ? '.' : g[r][c]);
  const filled = (r: number, c: number): boolean => at(r, c) !== '.';

  // directed boundary edges, filled cell on the right of travel (screen coordinates)
  const edges = new Map<string, [number, number][]>();
  const add = (x1: number, y1: number, x2: number, y2: number) => {
    const k = `${x1},${y1}`;
    if (!edges.has(k)) edges.set(k, []);
    edges.get(k)!.push([x2, y2]);
  };
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < cols; c++) {
      if (!filled(r, c)) continue;
      if (!filled(r - 1, c)) add(c, r, c + 1, r);
      if (!filled(r, c + 1)) add(c + 1, r, c + 1, r + 1);
      if (!filled(r + 1, c)) add(c + 1, r + 1, c, r + 1);
      if (!filled(r, c - 1)) add(c, r + 1, c, r);
    }
  }
  const loops: P[][] = [];
  for (;;) {
    const startKey = [...edges.keys()].find((k) => edges.get(k)!.length > 0);
    if (!startKey) break;
    const [sx, sy] = startKey.split(',').map(Number);
    const pts: P[] = [[sx, sy]];
    let [x, y] = [sx, sy];
    let dir: P = [0, 0];
    for (let guard = 0; guard < 10000; guard++) {
      const outs = edges.get(`${x},${y}`)!;
      let pick = 0;
      if (outs.length > 1) {
        // at a pinch, turn right (toward the filled side) so diagonal cells stay separate loops
        const right: P = [-dir[1], dir[0]];
        const i = outs.findIndex(([nx, ny]) => nx - x === right[0] && ny - y === right[1]);
        pick = i >= 0 ? i : 0;
      }
      const [nx, ny] = outs.splice(pick, 1)[0];
      dir = [nx - x, ny - y];
      [x, y] = [nx, ny];
      if (x === sx && y === sy) break;
      pts.push([x, y]);
    }
    // drop collinear vertices
    const n = pts.length;
    const keep = pts.filter((p, i) => {
      const a = pts[(i - 1 + n) % n];
      const b = pts[(i + 1) % n];
      return (p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0]) !== 0;
    });
    loops.push(keep);
  }
  const toXY = (p: P): P => [ox + p[0] * s, oy + p[1] * s];
  const outline = loops.map((l) => poly(l.map(toXY))).join(' ');

  // internal edges: between two filled cells, split into colour boundaries and same-colour grid lines
  const segs = (want: (a: string, b: string) => boolean): string => {
    const out: string[] = [];
    // vertical lines at x = c between columns c-1 and c
    for (let c = 1; c < cols; c++) {
      let start = -1;
      for (let r = 0; r <= R; r++) {
        const on = r < R && filled(r, c - 1) && filled(r, c) && want(at(r, c - 1), at(r, c));
        if (on && start < 0) start = r;
        if (!on && start >= 0) {
          out.push(line(ox + c * s, oy + start * s, ox + c * s, oy + r * s));
          start = -1;
        }
      }
    }
    for (let r = 1; r < R; r++) {
      let start = -1;
      for (let c = 0; c <= cols; c++) {
        const on = c < cols && filled(r - 1, c) && filled(r, c) && want(at(r - 1, c), at(r, c));
        if (on && start < 0) start = c;
        if (!on && start >= 0) {
          out.push(line(ox + start * s, oy + r * s, ox + c * s, oy + r * s));
          start = -1;
        }
      }
    }
    return out.join(' ');
  };
  return { outline, colours: segs((a, b) => a !== b), grid: segs((a, b) => a === b) };
}

/** Four-point sparkle. */
function sparkle(x: number, y: number, r: number): string {
  const k = r * 0.22;
  return (
    `M ${f(x)} ${f(y - r)} Q ${f(x + k)} ${f(y - k)} ${f(x + r)} ${f(y)} Q ${f(x + k)} ${f(y + k)} ${f(x)} ${f(y + r)} ` +
    `Q ${f(x - k)} ${f(y + k)} ${f(x - r)} ${f(y)} Q ${f(x - k)} ${f(y - k)} ${f(x)} ${f(y - r)} Z`
  );
}

/** Small pixel sparkle: plus of 4 short bars around (x, y). */
function pixSpark(x: number, y: number, s: number): string {
  return poly(
    [
      [x - s / 2, y - 1.5 * s], [x + s / 2, y - 1.5 * s], [x + s / 2, y - s / 2], [x + 1.5 * s, y - s / 2],
      [x + 1.5 * s, y + s / 2], [x + s / 2, y + s / 2], [x + s / 2, y + 1.5 * s], [x - s / 2, y + 1.5 * s],
      [x - s / 2, y + s / 2], [x - 1.5 * s, y + s / 2], [x - 1.5 * s, y - s / 2], [x - s / 2, y - s / 2],
    ],
  );
}

// ---- 1. pixel heart (beginner) --------------------------------------------------------------

function pixelHeart(): Template {
  const p = pixel(
    [
      '..#####...#####..',
      '.##ww##..#######.',
      '##ww#############',
      '##w##############',
      '#################',
      '#################',
      '.###############.',
      '..#############..',
      '...###########...',
      '....#########....',
      '.....#######.....',
      '......#####......',
      '.......###.......',
      '........#........',
    ],
    20,
    30,
    60,
  );
  return tpl(
    'pixel-heart',
    'Pixel heart',
    'beginner',
    ['pixel', 'pixel-art', 'heart', 'love', 'life', 'retro', 'kids'],
    [p.outline, p.colours],
    [pixSpark(352, 70, 8), pixSpark(48, 332, 6)],
  );
}

// ---- 2. pixel coin (beginner) ---------------------------------------------------------------

function pixelCoin(): Template {
  const R = 16;
  const C = 14;
  const g: string[][] = [];
  for (let r = 0; r < R; r++) {
    const row: string[] = [];
    for (let c = 0; c < C; c++) {
      const dx = (c + 0.5 - C / 2) / (C / 2);
      const dy = (r + 0.5 - R / 2) / (R / 2);
      const d = dx * dx + dy * dy;
      row.push(d > 1 ? '.' : d > 0.6 ? 'r' : 'f');
    }
    g.push(row);
  }
  // raised emblem: a pixel diamond in the face, and a shine stroke
  for (let r = 0; r < R; r++)
    for (let c = 0; c < C; c++) {
      const dx = Math.abs(c + 0.5 - C / 2);
      const dy = Math.abs(r + 0.5 - R / 2);
      if (dx + dy <= 3.1) g[r][c] = 'e';
    }
  const p = pixel(rowsOf(g), 20);
  return tpl(
    'pixel-coin',
    'Pixel gold coin',
    'beginner',
    ['pixel', 'pixel-art', 'coin', 'gold', 'treasure', 'retro', 'kids'],
    [p.outline, p.colours],
    [pixSpark(352, 52, 9), pixSpark(46, 352, 7), pixSpark(360, 330, 5)],
  );
}

// ---- 3. potion bottle (beginner) ------------------------------------------------------------

function pixelPotion(): Template {
  const p = pixel(
    [
      '......cccc......',
      '......cccc......',
      '.....gggggg.....',
      '.......gg.......',
      '.......gg.......',
      '......gggg......',
      '.....gggggg.....',
      '....gggggggg....',
      '...gggggggggg...',
      '..gggggggggggg..',
      '..llllllllllll..',
      '..lwllllllblll..',
      '..lwllllllllll..',
      '..lwlbllllllll..',
      '..lllllllbllll..',
      '...llllllllll...',
      '....llllllll....',
    ],
    20,
  );
  return tpl(
    'pixel-potion',
    'Pixel potion bottle',
    'beginner',
    ['pixel', 'pixel-art', 'potion', 'magic', 'bottle', 'retro', 'kids'],
    [p.outline, p.colours],
    [pixSpark(300, 90, 8), pixSpark(96, 120, 6)],
  );
}

// ---- 4. pixel slime (beginner) --------------------------------------------------------------

function pixelSlime(): Template {
  const g = sym([6, 10, 12, 14, 16, 16, 18, 18, 18, 18, 18, 18, 18, 18], 18, 's');
  paint(g, 'e', [[6, 5], [7, 5], [6, 12], [7, 12]]);
  paint(g, 'w', [[3, 4], [3, 5], [4, 4]]);
  paint(g, 'm', [[9, 7], [9, 10], [10, 8], [10, 9]]);
  paint(g, 'b', [[9, 3], [9, 14]]);
  const p = pixel(rowsOf(g), 20, 20, 60);
  return tpl(
    'pixel-slime',
    'Pixel slime monster',
    'beginner',
    ['pixel', 'pixel-art', 'slime', 'monster', 'cute', 'retro', 'kids'],
    [p.outline, p.colours],
  );
}

// ---- 5. pixel sword (intermediate) ----------------------------------------------------------

function pixelSword(): Template {
  const N = 20;
  const g: string[][] = Array.from({ length: N }, () => Array<string>(N).fill('.'));
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      const s = c + r - (N - 1); // across the blade (0 = axis)
      const t = c - r; // along the blade (tip at top right)
      const a = Math.abs(s);
      if (t >= -4 && t <= 19 && a <= 2 && t + a <= 19) g[r][c] = s < 0 ? 'e' : 'b';
      if (t >= -7 && t <= -5 && a <= 4) g[r][c] = 'q'; // cross-guard
      if (t >= -13 && t <= -8 && a <= 1) g[r][c] = 'h'; // grip
      if (t >= -18 && t <= -14 && a <= 2 && Math.abs(t + 16) + a <= 3) g[r][c] = 'p'; // pommel
    }
  const p = pixel(rowsOf(g), 17);
  return tpl(
    'pixel-sword',
    'Pixel hero sword',
    'intermediate',
    ['pixel', 'pixel-art', 'sword', 'weapon', 'adventure', 'retro', 'kids'],
    [p.outline, p.colours],
    [pixSpark(330, 70, 9), pixSpark(70, 70, 6), pixSpark(340, 330, 6)],
  );
}

// ---- 6. treasure chest (intermediate) -------------------------------------------------------

function pixelChest(): Template {
  const p = pixel(
    [
      '...wmmwwwwwwwwmmw...',
      '.wwwmmwwwwwwwwmmwww.',
      'wwwwmmwwwwwwwwmmwwww',
      'wwwwmmwwwwwwwwmmwwww',
      'wwwwmmwwwwwwwwmmwwww',
      'rrrrrrrrrkkrrrrrrrrr',
      'rrrrrrrrkkkkrrrrrrrr',
      'vvvvmmvvkkkkvvmmvvvv',
      'vvvvmmvvkkkkvvmmvvvv',
      'uuuummuuukkuuummuuuu',
      'uuuummuuuuuuuummuuuu',
      'vvvvmmvvvvvvvvmmvvvv',
      'vvvvmmvvvvvvvvmmvvvv',
      'uuuummuuuuuuuummuuuu',
      'rrrrrrrrrrrrrrrrrrrr',
    ],
    16,
    40,
    90,
  );
  const ky = 90 + 7 * 16;
  const keyhole = `${circle(200, ky - 3, 5)} ${poly([[197, ky], [203, ky], [205, ky + 12], [195, ky + 12]])}`;
  // nail heads on the metal bands
  const nails = [120, 280]
    .flatMap((x) => [130, 178, 250].map((y) => circle(x, y, 3)))
    .join(' ');
  return tpl(
    'treasure-chest',
    'Pixel treasure chest',
    'intermediate',
    ['pixel', 'pixel-art', 'treasure', 'chest', 'loot', 'gold', 'retro', 'kids'],
    [p.outline, p.colours, keyhole],
    [nails, pixSpark(350, 50, 10), pixSpark(56, 56, 7), pixSpark(372, 120, 5)],
  );
}

// ---- 7. power-up mushroom (intermediate) ----------------------------------------------------

function pixelMushroom(): Template {
  const g = sym([4, 8, 12, 14, 16, 16, 18, 18, 18, 16], 18, 'c');
  // a lightning bolt across the cap (no spots) and a shine
  paint(g, 'd', [[1, 9], [1, 10], [2, 8], [2, 9], [3, 7], [3, 8], [4, 7], [4, 8], [4, 9], [4, 10], [5, 9], [5, 10], [6, 8], [6, 9], [7, 7], [7, 8]]);
  paint(g, 'w', [[2, 4], [2, 5], [3, 3]]);
  g.push([...'...gggggggggggg...']);
  for (const row of ['.....ssssssss.....', '.....ssssssss.....', '....ssssssssss....', '....ssssssssss....'])
    g.push([...row]);
  const p = pixel(rowsOf(g), 19, undefined, 80);
  return tpl(
    'power-mushroom',
    'Lightning power-up mushroom',
    'intermediate',
    ['pixel', 'pixel-art', 'mushroom', 'power-up', 'bonus', 'retro', 'kids'],
    [p.outline, p.colours, pixSpark(200, 60, 10)],
    [pixSpark(66, 90, 8), pixSpark(334, 90, 8), pixSpark(40, 300, 5), pixSpark(360, 300, 5)],
  );
}

// ---- 8. pixel hero (advanced) ---------------------------------------------------------------

function pixelHero(): Template {
  const p = pixel(
    [
      '.......ppp.....k.',
      '......pp.......k.',
      '.....hhhhhh....k.',
      '....hhhhhhhh...k.',
      '...hhhhhhhhhh..k.',
      '...hhffffffhh..k.',
      '...hfeffffefh..k.',
      '...hffffffffh..k.',
      '....ffffffff..qqq',
      '.ddd.tttttt.aaggg',
      'dxxxdtttttttaaggg',
      'dxdxdtttttt....n.',
      'dxxxdbbbbbb......',
      '.dxd.tttttt......',
      '..d..ll..ll......',
      '.....ll..ll......',
      '....sss..sss.....',
    ],
    20,
  );
  const t = tpl(
    'pixel-knight',
    'Pixel knight hero',
    'advanced',
    ['pixel', 'pixel-art', 'knight', 'hero', 'sword', 'shield', 'retro', 'kids'],
    [p.outline, p.colours],
    [p.grid],
  );
  return { ...t, detailWidth: 1.4 };
}

// ---- 9. gamepad (beginner) ------------------------------------------------------------------

function gamepad(): Template {
  const body = [
    rrect(58, 128, 284, 120, 60),
    rotate(ellipse(112, 236, 46, 66), 25, 112, 236),
    rotate(ellipse(288, 236, 46, 66), -25, 288, 236),
  ];
  const bumpers = [rrect(78, 114, 76, 30, 14), rrect(246, 114, 76, 30, 14)];
  const cx = 126;
  const cy = 184;
  const a = 13;
  const r = 36;
  const dpad = roundPoly(
    [
      [cx - a, cy - r], [cx + a, cy - r], [cx + a, cy - a], [cx + r, cy - a], [cx + r, cy + a], [cx + a, cy + a],
      [cx + a, cy + r], [cx - a, cy + r], [cx - a, cy + a], [cx - r, cy + a], [cx - r, cy - a], [cx - a, cy - a],
    ],
    4,
  );
  const buttons = [circle(270, 160, 15), circle(306, 186, 15), circle(270, 212, 15)];
  const sticks = [circle(162, 236, 21), circle(238, 236, 21)];
  const cable = 'M 200 128 C 200 104 232 100 230 76 C 228 52 196 56 200 36';
  return tpl(
    'gamepad',
    'Round-grip gamepad',
    'beginner',
    ['gamepad', 'controller', 'joypad', 'console', 'play', 'kids'],
    [
      ...stack([body, ...bumpers]),
      dpad,
      ...buttons,
      ...sticks,
      `${circle(162, 236, 11)} ${circle(238, 236, 11)}`,
      `${rrect(174, 152, 20, 10, 5)} ${rrect(206, 152, 20, 10, 5)}`,
      circle(200, 192, 10),
      cable,
      rrect(190, 22, 20, 14, 4),
    ],
    [
      `${line(cx, cy - 26, cx, cy - 18)} ${line(cx, cy + 18, cx, cy + 26)} ${line(cx - 26, cy, cx - 18, cy)} ${line(cx + 18, cy, cx + 26, cy)}`,
      buttons.map((_, i) => {
        const [x, y] = [[270, 160], [306, 186], [270, 212]][i];
        return `M ${f(x - 8)} ${f(y - 2)} Q ${f(x - 7)} ${f(y - 8)} ${f(x - 1)} ${f(y - 9)}`;
      }).join(' '),
      `${line(186, 210, 214, 210)} ${line(190, 216, 210, 216)}`,
    ],
  );
}

// ---- 10. one-eyed monster (beginner) --------------------------------------------------------

function cyclops(): Template {
  const body = 'M 200 96 C 286 96 316 168 316 236 C 316 298 270 330 200 330 C 130 330 84 298 84 236 C 84 168 114 96 200 96 Z';
  const horns = [petal(146, 122, -32, 72, 15, 0.3), petal(254, 122, 32, 72, 15, 0.3)];
  const arms = [petal(92, 236, 248, 58, 17), petal(306, 214, 58, 58, 17)];
  const feet = [ellipse(158, 330, 32, 17), ellipse(242, 330, 32, 17)];
  const mouth = 'M 146 254 Q 200 314 254 254 Q 200 274 146 254 Z';
  const fangs = `${poly([[168, 261], [184, 266], [177, 281]])} ${poly([[216, 266], [232, 261], [223, 281]])}`;
  return tpl(
    'cyclops-monster',
    'One-eyed horned monster',
    'beginner',
    ['monster', 'creature', 'cute', 'cyclops', 'enemy', 'kids'],
    [
      ...stack([body, ...horns, ...arms, ...feet]),
      circle(200, 186, 44),
      circle(207, 192, 20),
      circle(214, 182, 6),
      mouth,
      fangs,
    ],
    [
      `${circle(124, 282, 8)} ${circle(278, 288, 10)} ${circle(262, 136, 6)} ${circle(116, 196, 5)}`,
      'M 186 98 Q 190 84 198 92 Q 204 80 212 98',
      `${line(142, 340, 142, 330)} ${line(158, 343, 158, 332)} ${line(258, 340, 258, 330)} ${line(242, 343, 242, 332)}`,
    ],
  );
}

// ---- 11. friendly robot (intermediate) ------------------------------------------------------

function robot(): Template {
  const head = rrect(125, 78, 150, 108, 28);
  const ears = [rrect(108, 112, 22, 42, 7), rrect(270, 112, 22, 42, 7)];
  const neck = rrect(182, 180, 36, 26, 4);
  const torso = rrect(118, 200, 164, 120, 24);
  const joints = [circle(116, 226, 15), circle(284, 226, 15)];
  const armL = rrect(86, 228, 30, 70, 15);
  const armR = rotate(rrect(296, 156, 30, 70, 15), 20, 300, 226);
  const handL = circle(101, 304, 15);
  const handR = circle(336, 154, 15);
  const legs = [rrect(148, 316, 32, 34, 6), rrect(220, 316, 32, 34, 6)];
  const feet = [rrect(132, 346, 60, 26, 13), rrect(208, 346, 60, 26, 13)];
  return tpl(
    'friendly-robot',
    'Arcade buddy robot',
    'intermediate',
    ['robot', 'droid', 'sci-fi', 'machine', 'cute', 'kids'],
    [
      ...stack([head, ...ears, neck, torso, ...feet, ...legs, ...joints, armL, armR, handL, handR]),
      'M 200 78 L 200 52',
      circle(200, 42, 10),
      rrect(145, 98, 110, 66, 18),
      `${ellipse(176, 128, 10, 13)} ${ellipse(224, 128, 10, 13)}`,
      'M 184 148 Q 200 160 216 148',
      rrect(146, 222, 108, 60, 12),
      circle(178, 252, 17),
    ],
    [
      `${circle(180, 124, 3)} ${circle(228, 124, 3)}`,
      'M 178 252 L 188 242',
      `${circle(222, 240, 6)} ${circle(240, 240, 6)}`,
      `${line(214, 258, 244, 258)} ${line(214, 268, 244, 268)}`,
      `${circle(119, 133, 4)} ${circle(281, 133, 4)}`,
      'M 92 310 Q 101 316 110 310 M 330 146 Q 338 142 344 148',
      `${line(150, 330, 178, 330)} ${line(222, 330, 250, 330)}`,
      'M 110 384 L 290 384',
      'M 356 128 Q 366 124 366 112 M 362 144 Q 380 138 380 120 M 312 116 Q 304 108 306 96',
    ],
  );
}

// ---- 12. race car (intermediate) ------------------------------------------------------------

function wheel(cx: number, cy: number, r: number): { tyre: string; rim: string; spokes: string } {
  const spokes: string[] = [];
  for (let i = 0; i < 5; i++) {
    const a = (i * 72 * Math.PI) / 180;
    spokes.push(
      line(cx + Math.sin(a) * r * 0.2, cy - Math.cos(a) * r * 0.2, cx + Math.sin(a) * r * 0.52, cy - Math.cos(a) * r * 0.52),
    );
  }
  return { tyre: circle(cx, cy, r), rim: `${circle(cx, cy, r * 0.58)} ${circle(cx, cy, r * 0.16)}`, spokes: spokes.join(' ') };
}

function raceCar(): Template {
  const body =
    'M 52 262 L 52 224 C 66 214 96 210 124 206 C 140 192 154 178 168 178 L 176 206 L 224 206 ' +
    'C 254 206 330 226 366 242 Q 378 252 368 264 Z';
  const rear = wheel(112, 262, 40);
  const front = wheel(304, 264, 36);
  const helmet = circle(198, 194, 20);
  const wing = rrect(30, 162, 56, 18, 4);
  const strut = poly([[54, 180], [66, 180], [72, 220], [60, 222]]);
  const frontWing = poly([[318, 262], [384, 262], [384, 248], [372, 248]]);
  const [w1, w2, b, fw, wg, st, hl] = stack([rear.tyre, front.tyre, body, frontWing, wing, strut, helmet]);
  return tpl(
    'race-car',
    'Racing car side view',
    'intermediate',
    ['car', 'racing', 'race', 'speed', 'vehicle', 'kids'],
    [w1, w2, b, fw, wg, st, hl, rear.rim, front.rim, circle(244, 238, 15), 'M 186 186 L 216 186 Q 218 196 210 200 L 192 200'],
    [
      rear.spokes,
      front.spokes,
      star(244, 238, 10, 4.2, 5),
      'M 128 228 L 340 244',
      'M 140 220 L 166 214 L 170 224',
      'M 228 214 L 272 222',
      `${line(16, 214, 42, 214)} ${line(8, 236, 40, 236)} ${line(20, 256, 44, 256)}`,
      'M 60 306 L 352 306',
      `${line(36, 168, 80, 168)} ${line(36, 174, 80, 174)}`,
    ],
  );
}

// ---- 13. go-kart (intermediate) -------------------------------------------------------------

function kart(): Template {
  const rear = wheel(108, 300, 40);
  const front = wheel(304, 306, 32);
  const chassis =
    'M 62 296 L 62 268 Q 62 258 74 258 L 140 258 L 172 284 L 296 284 C 326 284 348 276 360 262 ' +
    'Q 374 262 372 276 C 366 296 342 304 316 304 L 62 304 Z';
  const seat = roundPoly([[112, 266], [96, 196], [118, 190], [150, 262]], 8);
  const torso = roundPoly([[128, 262], [120, 204], [150, 188], [190, 210], [196, 262]], 14);
  const knee = roundPoly([[182, 244], [230, 224], [244, 234], [268, 274], [254, 282], [226, 246], [192, 264]], 7);
  const arm = roundPoly([[152, 200], [234, 206], [234, 222], [152, 220]], 8);
  const helmet = circle(152, 160, 32);
  const visor = 'M 160 146 L 186 148 Q 190 170 172 176 L 162 174 Z';
  const hand = circle(238, 214, 10);
  const wheelS = rotate(ellipse(250, 220, 7, 26), -20, 250, 220);
  const engine = rrect(30, 224, 54, 42, 8);
  const up = (d: string): string => shift(d, 0, -34);
  const t = tpl(
    'go-kart',
    'Go-kart racer',
    'intermediate',
    ['kart', 'racing', 'race', 'driver', 'vehicle', 'kids'],
    [
      ...stack([rear.tyre, front.tyre, helmet, hand, wheelS, arm, knee, chassis, torso, seat, engine]),
      visor,
      rear.rim,
      front.rim,
      'M 256 242 L 286 284',
      'M 34 250 L 18 250 L 18 236',
      circle(18, 222, 9),
      circle(30, 204, 7),
    ],
    [
      rear.spokes,
      front.spokes,
      `${line(40, 236, 74, 236)} ${line(40, 246, 74, 246)}`,
      'M 122 166 Q 136 150 150 146',
      'M 300 270 L 340 270',
      `${line(330, 210, 372, 210)} ${line(320, 226, 380, 226)} ${line(334, 242, 366, 242)}`,
      'M 60 346 L 350 346',
    ],
  );
  return { ...t, paths: t.paths.map(up), detail: (t.detail ?? []).map(up) };
}

// ---- 14. battle mech (advanced) -------------------------------------------------------------

function mech(): Template {
  const m = (d: string): string => mirrorX(d, 200);
  const head = roundPoly([[176, 60], [224, 60], [234, 82], [228, 110], [172, 110], [166, 82]], 6);
  const fin = roundPoly([[194, 62], [200, 30], [206, 62]], 3);
  const antenna = roundPoly([[166, 78], [146, 56], [150, 52], [172, 72]], 3);
  const collar = rrect(168, 104, 64, 18, 6);
  const torso = roundPoly([[128, 118], [272, 118], [292, 170], [262, 234], [138, 234], [108, 170]], 12);
  const pauldron = roundPoly([[60, 112], [132, 102], [150, 126], [142, 178], [70, 182], [54, 148]], 14);
  const upper = rrect(80, 176, 42, 54, 10);
  const elbow = circle(101, 236, 16);
  const forearm = roundPoly([[68, 240], [134, 240], [140, 302], [62, 302]], 10);
  const fist = rrect(70, 298, 62, 42, 12);
  const cannon = rrect(268, 240, 64, 62, 10);
  const barrel = rrect(284, 300, 32, 40, 6);
  const muzzle = rrect(278, 336, 44, 14, 4);
  const pack = rrect(146, 76, 24, 44, 6);
  const waist = rrect(166, 228, 68, 30, 8);
  const skirt = roundPoly([[126, 246], [178, 246], [182, 290], [134, 292]], 8);
  const codpiece = roundPoly([[184, 252], [216, 252], [212, 290], [188, 290]], 6);
  const thigh = rrect(150, 280, 38, 40, 8);
  const knee = roundPoly([[144, 306], [190, 306], [186, 328], [148, 328]], 6);
  const shin = roundPoly([[140, 320], [192, 320], [196, 366], [136, 366]], 10);
  const foot = roundPoly([[116, 362], [194, 362], [198, 386], [112, 386]], 8);
  const layers = [
    head, fin, antenna, m(antenna), collar,
    torso,
    pauldron, m(pauldron),
    upper, m(upper), elbow, m(elbow),
    fist, forearm, muzzle, barrel, cannon,
    waist, codpiece, skirt, m(skirt),
    knee, m(knee), foot, m(foot), shin, m(shin), thigh, m(thigh),
    pack, m(pack),
  ];
  const stripes: string[] = [];
  for (let k = -3; k <= 3; k++) stripes.push(line(166 + k * 13 - 11, 360, 166 + k * 13 + 11, 334));
  const hazard = stripes.join(' ');
  const shinStripes = [clip(hazard, [region(shin)], 'inside'), clip(m(hazard), [region(m(shin))], 'inside')];
  const vents = (x: number, y: number): string =>
    [0, 1, 2, 3].map((i) => line(x, y + i * 7, x + 26, y + i * 7)).join(' ');
  const rivets = (pts: P[]): string => pts.map(([x, y]) => circle(x, y, 2.6)).join(' ');
  return tpl(
    'battle-mech',
    'Giant battle mech',
    'advanced',
    ['mech', 'robot', 'sci-fi', 'machine', 'armour', 'kids'],
    [
      ...stack(layers),
      roundPoly([[178, 78], [222, 78], [226, 92], [174, 92]], 3),
      circle(200, 168, 20),
    ],
    [
      circle(200, 168, 11),
      `${line(200, 122, 200, 146)} ${line(200, 190, 200, 228)}`,
      'M 132 136 L 176 136 L 186 150 M 268 136 L 224 136 L 214 150',
      'M 128 206 L 172 206 L 182 192 M 272 206 L 228 206 L 218 192',
      vents(140, 152), vents(234, 152),
      'M 72 128 L 122 122 M 328 128 L 278 122',
      'M 64 150 L 114 150 M 336 150 L 286 150',
      rivets([[84, 166], [128, 164], [316, 166], [272, 164], [178, 96], [222, 96], [174, 240], [226, 240]]),
      `${line(86, 300, 86, 320)} ${line(101, 300, 101, 322)} ${line(116, 300, 116, 320)}`,
      'M 70 258 L 136 258 M 72 280 L 138 280',
      'M 270 258 L 330 258 M 270 280 L 330 280',
      `${line(290, 312, 310, 312)} ${line(290, 324, 310, 324)}`,
      ellipse(300, 343, 14, 3),
      'M 140 262 L 178 262 M 260 262 L 222 262',
      'M 200 258 L 200 284',
      'M 154 298 L 184 298 M 246 298 L 216 298',
      ...shinStripes,
      'M 122 376 L 192 376 M 278 376 L 208 376',
      `${line(176, 84, 222, 84)}`,
      'M 40 394 L 360 394',
      `${line(26, 40, 26, 62)} ${line(15, 51, 37, 51)} ${line(370, 70, 370, 88)} ${line(361, 79, 379, 79)}`,
    ],
  );
}

// ---- 15. platform level map (advanced) ------------------------------------------------------

function levelMap(): Template {
  const frame = rrect(10, 10, 380, 380, 16);
  // ground: two runs of blocks with a spike pit between them
  const groundL = 'M 10 320 L 190 320 L 190 390';
  const groundR = 'M 390 320 L 250 320 L 250 390';
  const bricks: string[] = [];
  for (const [x0, x1] of [[10, 190], [250, 390]] as const) {
    bricks.push(line(x0 === 10 ? 12 : x0, 352, x1 === 390 ? 388 : x1, 352));
    for (let x = x0 + 30; x < x1; x += 30) bricks.push(line(x, 320, x, 352));
    for (let x = x0 + 15; x < x1; x += 30) bricks.push(line(x, 352, x, 388));
  }
  const spikes = poly(
    [[190, 384], [200, 362], [210, 384], [220, 362], [230, 384], [240, 362], [250, 384]],
    false,
  );
  // floating brick platforms
  const platA = rrect(48, 236, 108, 26, 3);
  const platB = rrect(246, 168, 112, 26, 3);
  for (const [x, y, w] of [[48, 236, 108], [246, 168, 112]] as const) {
    bricks.push(line(x + 2, y + 13, x + w - 2, y + 13));
    for (let k = 1; k * 27 < w; k++) bricks.push(line(x + k * 27, y, x + k * 27, y + 13));
    for (let k = 0; k * 27 + 13 < w; k++) bricks.push(line(x + k * 27 + 13, y + 13, x + k * 27 + 13, y + 26));
  }
  // bonus block with a star of our own
  const block = rrect(178, 120, 36, 36, 4);
  // ladder up to platform A
  const ladder = `${line(120, 262, 120, 320)} ${line(140, 262, 140, 320)}`;
  const rungs = [274, 288, 302].map((y) => line(120, y, 140, y)).join(' ');
  // coins in an arc
  const coins = [[68, 210], [102, 196], [136, 210], [272, 140], [302, 132], [332, 140]] as const;
  // hero standing on the ground
  const heroBody = rrect(58, 292, 26, 22, 6);
  const heroHead = circle(71, 280, 13);
  const heroLegs = `${line(64, 314, 64, 320)} ${line(78, 314, 78, 320)}`;
  // slime enemy on platform B
  const slime = 'M 282 168 C 282 140 324 140 324 168';
  // goal door with a star
  const door = 'M 330 320 L 330 282 A 22 22 0 0 1 374 282 L 374 320';
  // background hills and clouds (behind the ground)
  const hills = 'M 10 300 Q 50 250 110 320 M 150 320 Q 176 262 220 300 Q 262 250 306 320';
  const cloudA = [circle(70, 120, 16), circle(94, 112, 20), circle(118, 122, 14), rrect(56, 120, 76, 18, 9)];
  const cloudB = [circle(290, 92, 13), circle(310, 86, 17), circle(330, 94, 12), rrect(278, 92, 64, 14, 7)];
  // HUD: hearts and a coin counter
  const heart = (x: number, y: number): string =>
    pixel(['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'], 4, x, y).outline;
  const digits = pixel(['#.#..###', '#.#....#', '.#...###', '#.#....#', '#.#..###'], 5, 324, 22).outline;
  const skyLayers = clip(
    [hills, ...union([...cloudA]).split(/(?=M)/), ...union([...cloudB]).split(/(?=M)/)].join(' '),
    [region(platA), region(platB), region(block), region(heroHead), region(heroBody), region(rrect(116, 262, 28, 58, 0)), region('M 330 320 L 330 282 A 22 22 0 0 1 374 282 L 374 320 Z')],
  );
  return tpl(
    'platform-level',
    'Platform game level',
    'advanced',
    ['level', 'platform', 'map', 'adventure', 'pixel', 'retro', 'kids'],
    [
      frame,
      groundL,
      groundR,
      spikes,
      platA,
      platB,
      block,
      ladder,
      heroHead,
      heroBody,
      heroLegs,
      slime,
      door,
      ...coins.map(([x, y]) => ellipse(x, y, 7, 10)),
      heart(24, 22),
      heart(56, 22),
      heart(88, 22),
      ellipse(306, 34, 7, 10),
      digits,
    ],
    [
      ...bricks,
      skyLayers,
      rungs,
      star(196, 138, 11, 4.6, 5),
      star(352, 252, 9, 3.8, 5),
      `${circle(66, 279, 2)} ${circle(76, 279, 2)}`,
      'M 60 272 Q 71 260 82 272',
      `${circle(296, 158, 2.5)} ${circle(310, 158, 2.5)}`,
      'M 366 300 L 366 304',
      ...coins.map(([x, y]) => line(x, y - 5, x, y + 5)),
      'M 236 160 L 230 181 L 236 202 M 368 160 L 374 181 L 368 202',
      'M 188 112 L 184 104 M 204 112 L 208 104',
    ],
  );
}

export const game: Template[] = [
  pixelHeart(),
  pixelCoin(),
  pixelPotion(),
  pixelSlime(),
  gamepad(),
  cyclops(),
  pixelSword(),
  pixelChest(),
  pixelMushroom(),
  robot(),
  raceCar(),
  kart(),
  pixelHero(),
  mech(),
  levelMap(),
];
