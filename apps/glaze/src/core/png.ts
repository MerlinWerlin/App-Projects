// Small PNG reader (T85): turns a tiny PNG (the downscaled wallpaper capture that
// src/render/wallpaperSample.tsx takes with react-native-view-shot) into RGBA pixels, so colour
// sampling works in Expo Go with no native image library. Uses the pure-TS inflater (inflate.ts).
//
// Supported: bit depth 8, colour types 0 (grey), 2 (RGB), 3 (palette, with tRNS), 4 (grey +
// alpha), 6 (RGBA), no interlace. Anything else, a broken file or an image above the pixel cap
// returns null: callers fall back gracefully. Pure TS, Node-testable.

import { inflateRaw } from './inflate.ts';

export type RgbaImage = { width: number; height: number; rgba: Uint8Array };

/** Images above this many pixels are refused (the sampler asks for a few thousand). */
export const PNG_MAX_PIXELS = 262_144;

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const CHANNELS: Readonly<Record<number, number>> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

const u32 = (b: Uint8Array, o: number): number => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** Decode a PNG to straight (non-premultiplied) RGBA. Null when unsupported or malformed. Never throws. */
export function decodePng(bytes: Uint8Array): RgbaImage | null {
  try {
    return decode(bytes);
  } catch {
    return null;
  }
}

function decode(b: Uint8Array): RgbaImage | null {
  if (!(b instanceof Uint8Array) || b.length < 33) return null;
  for (let i = 0; i < 8; i++) if (b[i] !== SIGNATURE[i]) return null;
  let p = 8;
  let width = 0;
  let height = 0;
  let colourType = -1;
  let palette: Uint8Array | null = null;
  let trns: Uint8Array | null = null;
  const idat: Uint8Array[] = [];
  let idatLen = 0;
  while (p + 8 <= b.length) {
    const len = u32(b, p);
    const type = String.fromCharCode(b[p + 4], b[p + 5], b[p + 6], b[p + 7]);
    const start = p + 8;
    const end = start + len;
    if (end + 4 > b.length) return null;
    const data = b.subarray(start, end);
    if (type === 'IHDR') {
      if (len < 13) return null;
      width = u32(data, 0);
      height = u32(data, 4);
      const depth = data[8];
      colourType = data[9];
      const interlace = data[12];
      if (depth !== 8 || !(colourType in CHANNELS) || data[10] !== 0 || data[11] !== 0 || interlace !== 0) return null;
      if (width < 1 || height < 1 || width * height > PNG_MAX_PIXELS) return null;
    } else if (type === 'PLTE') palette = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IDAT') {
      idat.push(data);
      idatLen += len;
    } else if (type === 'IEND') break;
    p = end + 4; // skip CRC
  }
  if (!width || colourType < 0 || idat.length === 0) return null;
  if (colourType === 3 && !palette) return null;

  const z = new Uint8Array(idatLen);
  let o = 0;
  for (const part of idat) {
    z.set(part, o);
    o += part.length;
  }
  // zlib wrapper: CM 8, no preset dictionary.
  if (z.length < 2 || (z[0] & 0x0f) !== 8 || (z[1] & 0x20) !== 0 || ((z[0] << 8) | z[1]) % 31 !== 0) return null;
  const raw = inflateRaw(z, 2).bytes;

  const ch = CHANNELS[colourType];
  const stride = width * ch;
  if (raw.length < (stride + 1) * height) return null;
  const px = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const row = y * stride;
    const prev = row - stride;
    for (let x = 0; x < stride; x++) {
      const v = raw[src + x];
      const a = x >= ch ? px[row + x - ch] : 0;
      const up = y > 0 ? px[prev + x] : 0;
      const c = x >= ch && y > 0 ? px[prev + x - ch] : 0;
      let out: number;
      if (filter === 0) out = v;
      else if (filter === 1) out = v + a;
      else if (filter === 2) out = v + up;
      else if (filter === 3) out = v + ((a + up) >> 1);
      else if (filter === 4) out = v + paeth(a, up, c);
      else return null;
      px[row + x] = out & 0xff;
    }
  }

  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0, n = width * height; i < n; i++) {
    const q = i * 4;
    if (colourType === 6) {
      rgba[q] = px[i * 4];
      rgba[q + 1] = px[i * 4 + 1];
      rgba[q + 2] = px[i * 4 + 2];
      rgba[q + 3] = px[i * 4 + 3];
    } else if (colourType === 2) {
      rgba[q] = px[i * 3];
      rgba[q + 1] = px[i * 3 + 1];
      rgba[q + 2] = px[i * 3 + 2];
      rgba[q + 3] = 255;
    } else if (colourType === 0) {
      rgba[q] = rgba[q + 1] = rgba[q + 2] = px[i];
      rgba[q + 3] = 255;
    } else if (colourType === 4) {
      rgba[q] = rgba[q + 1] = rgba[q + 2] = px[i * 2];
      rgba[q + 3] = px[i * 2 + 1];
    } else {
      const idx = px[i];
      if (idx * 3 + 2 >= palette!.length) return null;
      rgba[q] = palette![idx * 3];
      rgba[q + 1] = palette![idx * 3 + 1];
      rgba[q + 2] = palette![idx * 3 + 2];
      rgba[q + 3] = trns && idx < trns.length ? trns[idx] : 255;
    }
  }
  return { width, height, rgba };
}
