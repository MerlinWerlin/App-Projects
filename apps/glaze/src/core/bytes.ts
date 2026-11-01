// Byte helpers for theme packs (T46): SHA-256, UTF-8 and base64, in pure TS so the same code
// runs in Node tests and in React Native (Hermes has no node:crypto and no reliable TextDecoder).

// ------------------------------------------------------------ SHA-256 (FIPS 180-4)

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01,
  0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08,
  0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/** Incremental SHA-256: feed chunks with update(), then hex(). */
export class Sha256 {
  private h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  private block = new Uint8Array(64);
  private used = 0;
  private length = 0;
  private w = new Uint32Array(64);
  private done = false;

  update(data: Uint8Array): this {
    if (this.done) throw new Error('sha256: update after digest');
    let i = 0;
    this.length += data.length;
    while (i < data.length) {
      const take = Math.min(64 - this.used, data.length - i);
      this.block.set(data.subarray(i, i + take), this.used);
      this.used += take;
      i += take;
      if (this.used === 64) {
        this.compress(this.block);
        this.used = 0;
      }
    }
    return this;
  }

  private compress(b: Uint8Array): void {
    const w = this.w;
    for (let t = 0; t < 16; t++) w[t] = ((b[t * 4] << 24) | (b[t * 4 + 1] << 16) | (b[t * 4 + 2] << 8) | b[t * 4 + 3]) >>> 0;
    for (let t = 16; t < 64; t++) {
      const x = w[t - 15];
      const y = w[t - 2];
      const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
      const s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }
    let [a, bb, c, d, e, f, g, h] = this.h;
    for (let t = 0; t < 64; t++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[t] + w[t]) >>> 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & bb) ^ (a & c) ^ (bb & c);
      const t2 = (S0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = bb;
      bb = a;
      a = (t1 + t2) >>> 0;
    }
    const H = this.h;
    H[0] = (H[0] + a) >>> 0;
    H[1] = (H[1] + bb) >>> 0;
    H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0;
    H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0;
    H[7] = (H[7] + h) >>> 0;
  }

  /** Lower-case hex digest (64 chars). Finalises the hash. */
  hex(): string {
    if (!this.done) {
      const bits = this.length * 8;
      const pad = new Uint8Array(this.used < 56 ? 64 - this.used : 128 - this.used);
      pad[0] = 0x80;
      const hi = Math.floor(bits / 0x100000000);
      const lo = bits >>> 0;
      const n = pad.length;
      pad[n - 8] = (hi >>> 24) & 0xff;
      pad[n - 7] = (hi >>> 16) & 0xff;
      pad[n - 6] = (hi >>> 8) & 0xff;
      pad[n - 5] = hi & 0xff;
      pad[n - 4] = (lo >>> 24) & 0xff;
      pad[n - 3] = (lo >>> 16) & 0xff;
      pad[n - 2] = (lo >>> 8) & 0xff;
      pad[n - 1] = lo & 0xff;
      const len = this.length;
      this.update(pad);
      this.length = len;
      this.done = true;
    }
    let out = '';
    for (const v of this.h) out += v.toString(16).padStart(8, '0');
    return out;
  }
}

/** SHA-256 of bytes (or a string, hashed as UTF-8) as lower-case hex. */
export function sha256Hex(data: Uint8Array | string): string {
  return new Sha256().update(typeof data === 'string' ? utf8Encode(data) : data).hex();
}

/** T258: default slice for sha256HexChunked (64 KB ≈ a few ms of JS hashing on an older iPhone). */
export const SHA_CHUNK_BYTES = 64 * 1024;

/** Gives the JS thread back between slices (touches, animations, timers run in between). */
export const yieldToEventLoop = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * T258: SHA-256 of bytes hashed in slices of `chunkBytes`, awaiting `pause` between slices so a
 * multi-MB pack file never blocks the UI thread for the whole hash. Same result as sha256Hex.
 */
export async function sha256HexChunked(
  data: Uint8Array,
  chunkBytes: number = SHA_CHUNK_BYTES,
  pause: () => Promise<void> = yieldToEventLoop,
): Promise<string> {
  const step = Math.max(64, Math.floor(chunkBytes));
  const h = new Sha256();
  for (let i = 0; i < data.length; i += step) {
    if (i > 0) await pause();
    h.update(data.subarray(i, Math.min(data.length, i + step)));
  }
  return h.hex();
}

export function isSha256Hex(v: unknown): v is string {
  return typeof v === 'string' && /^[0-9a-f]{64}$/.test(v);
}

// ------------------------------------------------------------ UTF-8

export function utf8Encode(s: string): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
      const d = s.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) {
        c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00);
        i++;
      }
    }
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return Uint8Array.from(out);
}

export function utf8Decode(b: Uint8Array): string {
  let s = '';
  let i = 0;
  while (i < b.length) {
    const c = b[i++];
    let cp: number;
    if (c < 0x80) cp = c;
    else if (c >= 0xf0) cp = ((c & 7) << 18) | ((b[i++] & 63) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63);
    else if (c >= 0xe0) cp = ((c & 15) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63);
    else cp = ((c & 31) << 6) | (b[i++] & 63);
    s += String.fromCodePoint(cp);
  }
  return s;
}

// ------------------------------------------------------------ base64 (expo-file-system reads/writes binary as base64)

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_INDEX: Record<string, number> = {};
for (let i = 0; i < B64.length; i++) B64_INDEX[B64[i]] = i;

export function base64Encode(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i] << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    s += i + 1 < b.length ? B64[(n >> 6) & 63] : '=';
    s += i + 2 < b.length ? B64[n & 63] : '=';
  }
  return s;
}

export function base64Decode(s: string): Uint8Array {
  const clean = s.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = B64_INDEX[clean[i]] ?? 0;
    const b = B64_INDEX[clean[i + 1]] ?? 0;
    const c = B64_INDEX[clean[i + 2]];
    const d = B64_INDEX[clean[i + 3]];
    const n = (a << 18) | (b << 12) | ((c ?? 0) << 6) | (d ?? 0);
    out[o++] = (n >> 16) & 255;
    if (c !== undefined) out[o++] = (n >> 8) & 255;
    if (d !== undefined) out[o++] = n & 255;
  }
  return out.subarray(0, o);
}

export function concatBytes(parts: readonly Uint8Array[]): Uint8Array {
  let n = 0;
  for (const p of parts) n += p.length;
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
