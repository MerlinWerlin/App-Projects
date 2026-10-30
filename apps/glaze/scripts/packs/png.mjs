// T159: tiny PNG decode/encode + area-average resize for the pack builder (Node built-ins only).
// Decodes 8-bit, non-interlaced PNGs of every colour type (grey, RGB, palette, grey+alpha, RGBA,
// with tRNS) to RGBA; that is all the art-pack validator (src/core/artPack.ts) accepts anyway.
// Encodes RGB or RGBA 8-bit PNGs with node:zlib. Used for ThumbHash pixels and for the no-encoder
// fallback thumbnail.

import { deflateSync, inflateSync } from 'node:zlib';

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** Decode a PNG to { width, height, rgba: Uint8Array }. Throws on anything unsupported. */
export function decodePng(buf) {
  const b = Buffer.from(buf.buffer ? buf : new Uint8Array(buf));
  if (b.length < 33 || !b.subarray(0, 8).equals(SIG)) throw new Error('not a PNG');
  let p = 8;
  let ihdr = null;
  let plte = null;
  let trns = null;
  const idat = [];
  while (p + 12 <= b.length) {
    const len = b.readUInt32BE(p);
    const type = b.toString('latin1', p + 4, p + 8);
    const data = b.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') ihdr = { width: data.readUInt32BE(0), height: data.readUInt32BE(4), depth: data[8], ct: data[9], interlace: data[12] };
    else if (type === 'PLTE') plte = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (!ihdr) throw new Error('PNG has no IHDR');
  const { width: w, height: h, depth, ct, interlace } = ihdr;
  if (depth !== 8 || interlace !== 0 || !(ct in CHANNELS)) throw new Error(`PNG must be 8-bit, non-interlaced (depth ${depth}, type ${ct}, interlace ${interlace})`);
  if (ct === 3 && !plte) throw new Error('palette PNG without PLTE');
  const raw = inflateSync(Buffer.concat(idat));
  const ch = CHANNELS[ct];
  const stride = w * ch;
  if (raw.length < (stride + 1) * h) throw new Error('PNG data too short');
  const out = new Uint8Array(w * h * 4);
  let prev = new Uint8Array(stride);
  let cur = new Uint8Array(stride);
  const key = trns && ct === 0 && trns.length >= 2 ? [trns[1]] : trns && ct === 2 && trns.length >= 6 ? [trns[1], trns[3], trns[5]] : null;
  for (let y = 0; y < h; y++) {
    const base = y * (stride + 1);
    const f = raw[base];
    for (let x = 0; x < stride; x++) {
      const v = raw[base + 1 + x];
      const a = x >= ch ? cur[x - ch] : 0;
      const up = prev[x];
      const c = x >= ch ? prev[x - ch] : 0;
      let o;
      if (f === 0) o = v;
      else if (f === 1) o = v + a;
      else if (f === 2) o = v + up;
      else if (f === 3) o = v + ((a + up) >> 1);
      else if (f === 4) o = v + paeth(a, up, c);
      else throw new Error(`PNG row ${y}: unknown filter ${f}`);
      cur[x] = o & 0xff;
    }
    for (let i = 0; i < w; i++) {
      const d = (y * w + i) * 4;
      let r, g, bl, al = 255;
      if (ct === 0) {
        r = g = bl = cur[i];
        if (key && cur[i] === key[0]) al = 0;
      } else if (ct === 2) {
        r = cur[i * 3];
        g = cur[i * 3 + 1];
        bl = cur[i * 3 + 2];
        if (key && r === key[0] && g === key[1] && bl === key[2]) al = 0;
      } else if (ct === 3) {
        const k = cur[i];
        r = plte[k * 3] ?? 0;
        g = plte[k * 3 + 1] ?? 0;
        bl = plte[k * 3 + 2] ?? 0;
        if (trns && k < trns.length) al = trns[k];
      } else if (ct === 4) {
        r = g = bl = cur[i * 2];
        al = cur[i * 2 + 1];
      } else {
        r = cur[i * 4];
        g = cur[i * 4 + 1];
        bl = cur[i * 4 + 2];
        al = cur[i * 4 + 3];
      }
      out[d] = r;
      out[d + 1] = g;
      out[d + 2] = bl;
      out[d + 3] = al;
    }
    const t = prev;
    prev = cur;
    cur = t;
  }
  return { width: w, height: h, rgba: out };
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** Encode RGBA pixels as an 8-bit PNG (RGB when every pixel is opaque). Deterministic. */
export function encodePng(width, height, rgba) {
  let opaque = true;
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i] !== 255) { opaque = false; break; }
  const ch = opaque ? 3 : 4;
  const raw = Buffer.alloc((width * ch + 1) * height);
  for (let y = 0; y < height; y++) {
    const o = y * (width * ch + 1);
    raw[o] = 0;
    for (let x = 0; x < width; x++) {
      const s = (y * width + x) * 4;
      const d = o + 1 + x * ch;
      raw[d] = rgba[s];
      raw[d + 1] = rgba[s + 1];
      raw[d + 2] = rgba[s + 2];
      if (ch === 4) raw[d + 3] = rgba[s + 3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = opaque ? 2 : 6;
  return Buffer.concat([SIG, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/** Centred crop rectangle of a source so it has the target's aspect ratio ("cover"). */
export function coverCrop(sw, sh, tw, th) {
  const want = tw / th;
  if (sw / sh > want) {
    const cw = sh * want;
    return { x: (sw - cw) / 2, y: 0, w: cw, h: sh };
  }
  const ch = sw / want;
  return { x: 0, y: (sh - ch) / 2, w: sw, h: ch };
}

/** Area-average downscale ("cover" crop) of RGBA pixels to tw x th, alpha-weighted. */
export function resizeRgba(img, tw, th) {
  const { width: sw, height: sh, rgba } = img;
  const crop = coverCrop(sw, sh, tw, th);
  const sx = crop.w / tw;
  const sy = crop.h / th;
  const out = new Uint8Array(tw * th * 4);
  for (let y = 0; y < th; y++) {
    const y0 = Math.floor(crop.y + y * sy);
    const y1 = Math.max(y0 + 1, Math.min(sh, Math.ceil(crop.y + (y + 1) * sy)));
    for (let x = 0; x < tw; x++) {
      const x0 = Math.floor(crop.x + x * sx);
      const x1 = Math.max(x0 + 1, Math.min(sw, Math.ceil(crop.x + (x + 1) * sx)));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const s = (yy * sw + xx) * 4;
          const al = rgba[s + 3];
          r += rgba[s] * al;
          g += rgba[s + 1] * al;
          b += rgba[s + 2] * al;
          a += al;
          n++;
        }
      }
      const d = (y * tw + x) * 4;
      if (a > 0) {
        out[d] = Math.round(r / a);
        out[d + 1] = Math.round(g / a);
        out[d + 2] = Math.round(b / a);
      }
      out[d + 3] = Math.round(a / n);
    }
  }
  return { width: tw, height: th, rgba: out };
}

/** Size that fits inside max x max keeping the aspect ratio (never upscales). */
export function fitInside(w, h, max) {
  if (w <= max && h <= max) return { width: w, height: h };
  const s = max / Math.max(w, h);
  return { width: Math.max(1, Math.round(w * s)), height: Math.max(1, Math.round(h * s)) };
}
