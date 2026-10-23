// T85: the small PNG reader used to sample the user's wallpaper photo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { crc32 } from './inflate.ts';
import { PNG_MAX_PIXELS, decodePng } from './png.ts';

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** Minimal encoder: raw samples (channels per pixel) with a filter per row (cycled). */
function encode(width: number, height: number, colourType: number, samples: Uint8Array, filters: number[], extra: Uint8Array[] = []): Uint8Array {
  const ch = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[colourType];
  const stride = width * ch;
  const raw = new Uint8Array((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const f = filters[y % filters.length];
    raw[y * (stride + 1)] = f;
    for (let x = 0; x < stride; x++) {
      const v = samples[y * stride + x];
      const a = x >= ch ? samples[y * stride + x - ch] : 0;
      const up = y > 0 ? samples[(y - 1) * stride + x] : 0;
      const c = x >= ch && y > 0 ? samples[(y - 1) * stride + x - ch] : 0;
      const pred = f === 0 ? 0 : f === 1 ? a : f === 2 ? up : f === 3 ? (a + up) >> 1 : paeth(a, up, c);
      raw[y * (stride + 1) + 1 + x] = (v - pred) & 0xff;
    }
  }
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, width);
  dv.setUint32(4, height);
  ihdr[8] = 8;
  ihdr[9] = colourType;
  const sig = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const parts = [sig, chunk('IHDR', ihdr), ...extra, chunk('IDAT', new Uint8Array(deflateSync(raw))), chunk('IEND', new Uint8Array(0))];
  const len = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function noise(n: number, seed: number): Uint8Array {
  const out = new Uint8Array(n);
  let s = seed;
  for (let i = 0; i < n; i++) {
    s = (s * 1103515245 + 12345) >>> 0;
    out[i] = (s >>> 16) & 0xff;
  }
  return out;
}

test('RGBA round-trips through every filter type', () => {
  const w = 9;
  const h = 10;
  const px = noise(w * h * 4, 7);
  const img = decodePng(encode(w, h, 6, px, [0, 1, 2, 3, 4]));
  assert.ok(img);
  assert.equal(img.width, w);
  assert.equal(img.height, h);
  assert.deepEqual([...img.rgba], [...px]);
});

test('RGB, grey, grey + alpha and palette images decode to RGBA', () => {
  const rgb = noise(5 * 4 * 3, 3);
  const a = decodePng(encode(5, 4, 2, rgb, [4, 1]))!;
  for (let i = 0; i < 20; i++) assert.deepEqual([...a.rgba.subarray(i * 4, i * 4 + 4)], [rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2], 255]);

  const grey = noise(6 * 3, 5);
  const g = decodePng(encode(6, 3, 0, grey, [2]))!;
  for (let i = 0; i < 18; i++) assert.deepEqual([...g.rgba.subarray(i * 4, i * 4 + 4)], [grey[i], grey[i], grey[i], 255]);

  const ga = noise(4 * 4 * 2, 9);
  const gaImg = decodePng(encode(4, 4, 4, ga, [3]))!;
  for (let i = 0; i < 16; i++) assert.deepEqual([...gaImg.rgba.subarray(i * 4, i * 4 + 4)], [ga[i * 2], ga[i * 2], ga[i * 2], ga[i * 2 + 1]]);

  const plte = Uint8Array.from([10, 20, 30, 200, 100, 50]);
  const trns = Uint8Array.from([0]);
  const idx = Uint8Array.from([0, 1, 1, 0]);
  const p = decodePng(encode(2, 2, 3, idx, [0], [chunk('PLTE', plte), chunk('tRNS', trns)]))!;
  assert.deepEqual([...p.rgba], [10, 20, 30, 0, 200, 100, 50, 255, 200, 100, 50, 255, 10, 20, 30, 0]);
});

test('broken, unsupported or oversized files give null, never throw', () => {
  const good = encode(3, 3, 6, noise(36, 1), [1]);
  assert.equal(decodePng(new Uint8Array(0)), null);
  assert.equal(decodePng(good.slice(0, 40)), null);
  const badSig = good.slice();
  badSig[1] = 0;
  assert.equal(decodePng(badSig), null);
  const sixteen = good.slice();
  sixteen[8 + 8 + 8] = 16; // IHDR bit depth
  assert.equal(decodePng(sixteen), null);
  const interlaced = good.slice();
  interlaced[8 + 8 + 12] = 1;
  assert.equal(decodePng(interlaced), null);
  const corrupt = good.slice();
  for (let i = 45; i < corrupt.length - 12; i++) corrupt[i] ^= 0x5a;
  assert.equal(decodePng(corrupt), null);
  const side = Math.ceil(Math.sqrt(PNG_MAX_PIXELS)) + 1;
  const huge = encode(side, 1, 0, new Uint8Array(side), [0]);
  const dv = new DataView(huge.buffer);
  dv.setUint32(8 + 8 + 4, side); // claim side × side
  assert.equal(decodePng(huge), null);
  assert.equal(decodePng('nope' as unknown as Uint8Array), null);
});

test('the bundled pack thumbnails (real wallpaper art) decode at their size', () => {
  const dir = new URL('./__fixtures__/packs/pack-aurora-2026/thumbs/', import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith('.png'));
  assert.ok(files.length >= 4);
  for (const f of files) {
    const img = decodePng(new Uint8Array(readFileSync(new URL(f, dir))));
    assert.ok(img, f);
    assert.equal(img.width, 48);
    assert.equal(img.height, 104);
    assert.equal(img.rgba.length, 48 * 104 * 4);
    assert.ok(new Set(img.rgba).size > 8, `${f} has real content`);
  }
});
