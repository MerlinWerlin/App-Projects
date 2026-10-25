// Sample images for the demo trip (T33), drawn in code so the screenshot kit needs no bundled asset: a sample
// ticket code (a QR-style pattern that encodes nothing, with SAMPLE printed under it) and a sample passport page
// (placeholder bars and SAMPLE, no names or numbers). Encoded as small greyscale PNGs (stored, uncompressed
// deflate) and handed to the file adapter as base64. Pure TypeScript, no React Native imports.

/** A greyscale bitmap: one byte per pixel, 0 = black, 255 = white. */
export type Bitmap = { width: number; height: number; px: Uint8Array };

const WHITE = 255;
const INK = 20;
const SOFT = 200;

function blank(width: number, height: number): Bitmap {
  return { width, height, px: new Uint8Array(width * height).fill(WHITE) };
}

function rect(b: Bitmap, x: number, y: number, w: number, h: number, v: number): void {
  for (let j = Math.max(0, y); j < Math.min(b.height, y + h); j++) {
    for (let i = Math.max(0, x); i < Math.min(b.width, x + w); i++) b.px[j * b.width + i] = v;
  }
}

// 5x7 glyphs for the one word the samples print.
const GLYPHS: Record<string, string[]> = {
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
};

/** Width in pixels of `text` printed at `scale` (5 columns per glyph plus 1 gap). */
export const textWidth = (text: string, scale: number) => (text.length * 6 - 1) * scale;

function print(b: Bitmap, text: string, x: number, y: number, scale: number, v: number): void {
  [...text].forEach((ch, k) => {
    const g = GLYPHS[ch];
    if (!g) return;
    g.forEach((row, r) => {
      for (let c = 0; c < 5; c++) if (row[c] === '1') rect(b, x + (k * 6 + c) * scale, y + r * scale, scale, scale, v);
    });
  });
}

/** Small deterministic generator, so the sample code looks the same on every phone and in every screenshot. */
function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 0x1_0000_0000;
  };
}

/** A sample ticket code: 25x25 modules with three corner squares, random fill, and SAMPLE underneath. */
export function sampleTicketBitmap(module = 8): Bitmap {
  const n = 25;
  const quiet = 4 * module;
  const code = n * module;
  const textScale = Math.max(2, Math.floor(module * 0.75));
  const width = code + quiet * 2;
  const height = quiet + code + quiet + 7 * textScale + quiet;
  const b = blank(width, height);
  const next = rng(0x5a7c4e1);
  const inFinder = (r: number, c: number) => (r < 8 && c < 8) || (r < 8 && c >= n - 8) || (r >= n - 8 && c < 8);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!inFinder(r, c) && next() < 0.5) rect(b, quiet + c * module, quiet + r * module, module, module, INK);
    }
  }
  for (const [r, c] of [
    [0, 0],
    [0, n - 7],
    [n - 7, 0],
  ] as const) {
    rect(b, quiet + c * module, quiet + r * module, 7 * module, 7 * module, INK);
    rect(b, quiet + (c + 1) * module, quiet + (r + 1) * module, 5 * module, 5 * module, WHITE);
    rect(b, quiet + (c + 2) * module, quiet + (r + 2) * module, 3 * module, 3 * module, INK);
  }
  print(b, 'SAMPLE', Math.floor((width - textWidth('SAMPLE', textScale)) / 2), quiet + code + quiet, textScale, INK);
  return b;
}

/** A sample passport page: a frame, a photo placeholder, grey placeholder lines, and SAMPLE across it. */
export function samplePassportBitmap(width = 360, height = 250): Bitmap {
  const b = blank(width, height);
  const m = 10;
  rect(b, 0, 0, width, 3, INK);
  rect(b, 0, height - 3, width, 3, INK);
  rect(b, 0, 0, 3, height, INK);
  rect(b, width - 3, 0, 3, height, INK);
  const photoW = Math.floor(width * 0.28);
  const photoH = Math.floor(photoW * 1.3);
  rect(b, m * 2, m * 3, photoW, photoH, SOFT);
  const lx = m * 3 + photoW;
  for (let k = 0; k < 6; k++) rect(b, lx, m * 3 + k * 18, Math.floor((width - lx - m * 2) * (k % 2 ? 0.6 : 0.85)), 8, SOFT);
  for (let k = 0; k < 2; k++) rect(b, m * 2, height - m * 2 - 14 - k * 18, width - m * 4, 8, SOFT);
  const s = 5;
  print(b, 'SAMPLE', Math.floor((width - textWidth('SAMPLE', s)) / 2), Math.floor(height / 2) - 18, s, INK);
  return b;
}

// ---------------------------------------------------------------- PNG encoding

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const x of bytes) c = CRC_TABLE[(c ^ x) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (const x of bytes) {
    a = (a + x) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

const u32 = (n: number) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const td = concat([Uint8Array.from([...type].map((c) => c.charCodeAt(0))), data]);
  return concat([Uint8Array.from(u32(data.length)), td, Uint8Array.from(u32(crc32(td)))]);
}

/** zlib stream with stored (uncompressed) deflate blocks: simple, and every PNG reader accepts it. */
function zlibStored(raw: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = [Uint8Array.from([0x78, 0x01])];
  const MAX = 65535;
  for (let o = 0; o < raw.length || o === 0; o += MAX) {
    const len = Math.min(MAX, raw.length - o);
    const last = o + len >= raw.length ? 1 : 0;
    parts.push(Uint8Array.from([last, len & 0xff, len >>> 8, ~len & 0xff, (~len >>> 8) & 0xff]), raw.subarray(o, o + len));
    if (last) break;
  }
  parts.push(Uint8Array.from(u32(adler32(raw))));
  return concat(parts);
}

/** An 8-bit greyscale PNG of the bitmap. */
export function encodePng(b: Bitmap): Uint8Array {
  const raw = new Uint8Array((b.width + 1) * b.height);
  for (let y = 0; y < b.height; y++) {
    raw[y * (b.width + 1)] = 0; // filter: none
    raw.set(b.px.subarray(y * b.width, (y + 1) * b.width), y * (b.width + 1) + 1);
  }
  const ihdr = Uint8Array.from([...u32(b.width), ...u32(b.height), 8, 0, 0, 0, 0]);
  return concat([Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlibStored(raw)), chunk('IEND', new Uint8Array(0))]);
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Standard base64 (with padding), for writing binary files through the file adapter. */
export function toBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
    out += B64[(n >>> 18) & 63]! + B64[(n >>> 12) & 63]! + (b === undefined ? '=' : B64[(n >>> 6) & 63]!) + (c === undefined ? '=' : B64[n & 63]!);
  }
  return out;
}
