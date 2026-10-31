// T87 QR Code encoder (ISO/IEC 18004), versions 1-10 at error correction level M. Pure TypeScript, offline.
// One segment in the most compact mode that fits the whole text: numeric (digits only), alphanumeric (0-9, A-Z,
// space $%*+-./:) or byte (UTF-8). Reed-Solomon over GF(256) with the 0x11D field polynomial, blocks interleaved,
// the eight masks tried and the lowest penalty kept (rules N1-N4), format info BCH(15,5) and version info
// BCH(18,6) for version 7 and up. The 4-module quiet zone is left to the renderer (QR_QUIET).

export const QR_QUIET = 4;
export const MAX_VERSION = 10;

export type QrMode = 'numeric' | 'alphanumeric' | 'byte';

export type Qr = {
  version: number;
  /** Modules per side (17 + 4 * version). */
  size: number;
  mask: number;
  mode: QrMode;
  /** modules[y][x], true = dark. Quiet zone not included. */
  modules: boolean[][];
};

/** Level M block structure per version: EC codewords per block, then [block count, data codewords] groups. */
const BLOCKS_M: ReadonlyArray<{ ec: number; groups: ReadonlyArray<readonly [number, number]> }> = [
  { ec: 0, groups: [] },
  { ec: 10, groups: [[1, 16]] },
  { ec: 16, groups: [[1, 28]] },
  { ec: 26, groups: [[1, 44]] },
  { ec: 18, groups: [[2, 32]] },
  { ec: 24, groups: [[2, 43]] },
  { ec: 16, groups: [[4, 27]] },
  { ec: 18, groups: [[4, 31]] },
  { ec: 22, groups: [[2, 38], [2, 39]] },
  { ec: 22, groups: [[3, 36], [2, 37]] },
  { ec: 26, groups: [[4, 43], [1, 44]] },
];

/** Alignment pattern centre coordinates per version (rows and columns). */
const ALIGN: readonly (readonly number[])[] = [[], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];

/** Data codewords at level M for a version. */
export function dataCapacity(version: number): number {
  return BLOCKS_M[version].groups.reduce((n, [count, data]) => n + count * data, 0);
}

/** All codewords (data + EC) for a version at level M. */
export function totalCodewords(version: number): number {
  const b = BLOCKS_M[version];
  return b.groups.reduce((n, [count, data]) => n + count * (data + b.ec), 0);
}

/** Modules available for data + EC bits (all modules minus function patterns and format/version areas). */
export function rawDataModules(version: number): number {
  let n = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const a = Math.floor(version / 7) + 2;
    n -= (25 * a - 10) * a - 55;
    if (version >= 7) n -= 36;
  }
  return n;
}

// ---------------------------------------------------------------- GF(256) and Reed-Solomon

const EXP = new Array<number>(512);
const LOG = new Array<number>(256).fill(0);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}

export const gfExp = (i: number) => EXP[((i % 255) + 255) % 255];
export const gfLog = (x: number) => {
  if (x === 0) throw new Error('log(0)');
  return LOG[x];
};
const gfMul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

/** Generator polynomial (x - a^0)(x - a^1)...(x - a^(degree-1)), coefficients highest power first (leading 1). */
export function rsGenerator(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array<number>(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly;
}

/** EC codewords: remainder of data(x) * x^degree divided by the generator. */
export function rsRemainder(data: readonly number[], degree: number): number[] {
  const gen = rsGenerator(degree);
  const rem = new Array<number>(degree).fill(0);
  for (const b of data) {
    const factor = b ^ rem[0];
    rem.shift();
    rem.push(0);
    for (let i = 0; i < degree; i++) rem[i] ^= gfMul(gen[i + 1], factor);
  }
  return rem;
}

// ---------------------------------------------------------------- data encoding

const ALNUM = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

function utf8(text: string): number[] {
  const out: number[] = [];
  for (const ch of text) {
    let c = ch.codePointAt(0)!;
    if (c >= 0xd800 && c <= 0xdfff) c = 0xfffd; // lone surrogate
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return out;
}

/** The most compact single mode for the whole text. */
export function qrMode(text: string): QrMode {
  if (/^[0-9]*$/.test(text)) return 'numeric';
  if ([...text].every((c) => ALNUM.includes(c))) return 'alphanumeric';
  return 'byte';
}

const countBits = (mode: QrMode, version: number) => {
  const big = version >= 10;
  return mode === 'numeric' ? (big ? 12 : 10) : mode === 'alphanumeric' ? (big ? 11 : 9) : big ? 16 : 8;
};

class Bits {
  bits: number[] = [];
  put(value: number, n: number) {
    for (let i = n - 1; i >= 0; i--) this.bits.push((value >>> i) & 1);
  }
}

/** Segment bits (mode, count, payload) for a version, without terminator or padding. */
function segmentBits(text: string, mode: QrMode, version: number): number[] | null {
  const b = new Bits();
  if (mode === 'numeric') {
    b.put(0b0001, 4);
    b.put(text.length, countBits(mode, version));
    for (let i = 0; i < text.length; i += 3) {
      const chunk = text.slice(i, i + 3);
      b.put(Number(chunk), chunk.length * 3 + 1);
    }
  } else if (mode === 'alphanumeric') {
    b.put(0b0010, 4);
    b.put(text.length, countBits(mode, version));
    for (let i = 0; i < text.length; i += 2) {
      if (i + 1 < text.length) b.put(ALNUM.indexOf(text[i]) * 45 + ALNUM.indexOf(text[i + 1]), 11);
      else b.put(ALNUM.indexOf(text[i]), 6);
    }
  } else {
    const bytes = utf8(text);
    b.put(0b0100, 4);
    b.put(bytes.length, countBits(mode, version));
    for (const x of bytes) b.put(x, 8);
  }
  const count = mode === 'byte' ? utf8(text).length : text.length;
  if (count >= 1 << countBits(mode, version)) return null;
  return b.bits;
}

/** Data codewords (with terminator and 0xEC/0x11 padding) for `text` in `version` at level M, or null if it doesn't fit. */
export function dataCodewords(text: string, version: number, mode: QrMode = qrMode(text)): number[] | null {
  const seg = segmentBits(text, mode, version);
  const capBits = dataCapacity(version) * 8;
  if (!seg || seg.length > capBits) return null;
  const bits = [...seg];
  for (let i = 0; i < 4 && bits.length < capBits; i++) bits.push(0);
  while (bits.length % 8) bits.push(0);
  const out: number[] = [];
  for (let i = 0; i < bits.length; i += 8) out.push(bits.slice(i, i + 8).reduce((v, bit) => (v << 1) | bit, 0));
  for (let pad = 0xec; out.length < dataCapacity(version); pad ^= 0xec ^ 0x11) out.push(pad);
  return out;
}

/** Smallest version (1-10) that holds the text at level M, or null. */
export function chooseVersion(text: string): number | null {
  for (let v = 1; v <= MAX_VERSION; v++) if (dataCodewords(text, v)) return v;
  return null;
}

/** Splits data into blocks, adds EC per block and interleaves (data columns first, then EC columns). */
export function interleave(data: readonly number[], version: number): number[] {
  const { ec, groups } = BLOCKS_M[version];
  const blocks: number[][] = [];
  let k = 0;
  for (const [count, len] of groups) {
    for (let i = 0; i < count; i++) {
      blocks.push(data.slice(k, k + len));
      k += len;
    }
  }
  const ecs = blocks.map((b) => rsRemainder(b, ec));
  const out: number[] = [];
  const maxLen = Math.max(...blocks.map((b) => b.length));
  for (let i = 0; i < maxLen; i++) for (const b of blocks) if (i < b.length) out.push(b[i]);
  for (let i = 0; i < ec; i++) for (const e of ecs) out.push(e[i]);
  return out;
}

// ---------------------------------------------------------------- format and version info

/** 15-bit format info for level M (bits 00) and a mask, BCH(15,5) with generator 0x537, XOR 0x5412. */
export function formatBits(mask: number): number {
  const data = (0b00 << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | (rem & 0x3ff)) ^ 0x5412;
}

/** 18-bit version info (versions 7+), BCH(18,6) with generator 0x1F25. */
export function versionBits(version: number): number {
  let rem = version;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  return (version << 12) | (rem & 0xfff);
}

// ---------------------------------------------------------------- matrix

const bit = (x: number, i: number) => ((x >>> i) & 1) !== 0;

export const MASKS: ReadonlyArray<(x: number, y: number) => boolean> = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

class Matrix {
  size: number;
  m: boolean[][];
  fn: boolean[][];
  version: number;
  constructor(version: number) {
    this.version = version;
    this.size = 17 + 4 * version;
    this.m = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false));
    this.fn = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false));
  }
  set(x: number, y: number, dark: boolean) {
    this.m[y][x] = dark;
    this.fn[y][x] = true;
  }
  finder(cx: number, cy: number) {
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= this.size || y >= this.size) continue;
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        this.set(x, y, d !== 2 && d !== 4);
      }
  }
  alignment(cx: number, cy: number) {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) this.set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
  format(mask: number) {
    const bits = formatBits(mask);
    const s = this.size;
    for (let i = 0; i <= 5; i++) this.set(8, i, bit(bits, i));
    this.set(8, 7, bit(bits, 6));
    this.set(8, 8, bit(bits, 7));
    this.set(7, 8, bit(bits, 8));
    for (let i = 9; i < 15; i++) this.set(14 - i, 8, bit(bits, i));
    for (let i = 0; i < 8; i++) this.set(s - 1 - i, 8, bit(bits, i));
    for (let i = 8; i < 15; i++) this.set(8, s - 15 + i, bit(bits, i));
    this.set(8, s - 8, true); // the dark module
  }
  functionPatterns() {
    const s = this.size;
    for (let i = 0; i < s; i++) {
      this.set(6, i, i % 2 === 0);
      this.set(i, 6, i % 2 === 0);
    }
    this.finder(3, 3);
    this.finder(s - 4, 3);
    this.finder(3, s - 4);
    const pos = ALIGN[this.version];
    const last = pos.length - 1;
    for (let i = 0; i <= last; i++)
      for (let j = 0; j <= last; j++) {
        if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) continue;
        this.alignment(pos[i], pos[j]);
      }
    this.format(0); // reserve the areas; redrawn with the chosen mask
    if (this.version >= 7) {
      const v = versionBits(this.version);
      for (let i = 0; i < 18; i++) {
        const a = s - 11 + (i % 3);
        const b = Math.floor(i / 3);
        this.set(a, b, bit(v, i));
        this.set(b, a, bit(v, i));
      }
    }
  }
  codewords(data: readonly number[]) {
    const s = this.size;
    let i = 0;
    for (let right = s - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < s; vert++)
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? s - 1 - vert : vert;
          if (!this.fn[y][x] && i < data.length * 8) {
            this.m[y][x] = bit(data[i >>> 3], 7 - (i & 7));
            i++;
          }
        }
    }
  }
  applyMask(mask: number) {
    const f = MASKS[mask];
    for (let y = 0; y < this.size; y++) for (let x = 0; x < this.size; x++) if (!this.fn[y][x] && f(x, y)) this.m[y][x] = !this.m[y][x];
  }
}

/** Data-module positions in placement order (the zigzag), for reading a symbol back in tests. */
export function placementOrder(version: number): Array<[number, number]> {
  const mx = new Matrix(version);
  mx.functionPatterns();
  const s = mx.size;
  const out: Array<[number, number]> = [];
  for (let right = s - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < s; vert++)
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const y = ((right + 1) & 2) === 0 ? s - 1 - vert : vert;
        if (!mx.fn[y][x]) out.push([x, y]);
      }
  }
  return out;
}

const FINDER_LIKE = [true, false, true, true, true, false, true];

/** Penalty score of a finished matrix (N1 runs, N2 2x2 blocks, N3 finder-like patterns, N4 dark balance). */
export function penalty(m: readonly (readonly boolean[])[]): number {
  const s = m.length;
  let score = 0;
  const line = (get: (i: number) => boolean) => {
    let run = 1;
    for (let i = 1; i <= s; i++) {
      if (i < s && get(i) === get(i - 1)) run++;
      else {
        if (run >= 5) score += 3 + (run - 5);
        run = 1;
      }
    }
    // N3: the finder-like 1:1:3:1:1 pattern with four light modules before or after it (outside counts as light).
    const g = (k: number) => k >= 0 && k < s && get(k);
    const light = (o: number) => !g(o) && !g(o + 1) && !g(o + 2) && !g(o + 3);
    for (let i = 0; i + 7 <= s; i++) {
      if (!FINDER_LIKE.every((v, k) => g(i + k) === v)) continue;
      if (light(i - 4)) score += 40;
      if (light(i + 7)) score += 40;
    }
  };
  for (let y = 0; y < s; y++) line((i) => m[y][i]);
  for (let x = 0; x < s; x++) line((i) => m[i][x]);
  for (let y = 0; y < s - 1; y++)
    for (let x = 0; x < s - 1; x++) {
      const c = m[y][x];
      if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) score += 3;
    }
  let dark = 0;
  for (const row of m) for (const c of row) if (c) dark++;
  const percent = (dark * 100) / (s * s);
  score += 10 * Math.floor(Math.abs(percent - 50) / 5);
  return score;
}

/** Builds the symbol for `version` and a fixed mask (exported for tests). */
export function buildMatrix(data: readonly number[], version: number, mask: number): boolean[][] {
  const mx = new Matrix(version);
  mx.functionPatterns();
  mx.codewords(interleave(data, version));
  mx.applyMask(mask);
  mx.format(mask);
  return mx.m;
}

/** QR Code for `text` at level M in the smallest version 1-10 that holds it, lowest-penalty mask; null if too long or empty. */
export function encodeQr(text: string): Qr | null {
  if (!text.length) return null;
  const version = chooseVersion(text);
  if (version == null) return null;
  const mode = qrMode(text);
  const data = dataCodewords(text, version, mode)!;
  let best: { mask: number; m: boolean[][]; score: number } | null = null;
  for (let mask = 0; mask < 8; mask++) {
    const m = buildMatrix(data, version, mask);
    const score = penalty(m);
    if (!best || score < best.score) best = { mask, m, score };
  }
  return { version, size: 17 + 4 * version, mask: best!.mask, mode, modules: best!.m };
}
