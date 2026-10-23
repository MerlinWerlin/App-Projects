/** SHA-1 (FIPS 180-4) and HMAC-SHA1 (RFC 2104) in pure TypeScript, for Philips JointSpace pairing. */
import { concatBytes, toHex, utf8 } from './bytes';

const rotl = (x: number, n: number): number => (x << n) | (x >>> (32 - n));

export function sha1(input: Uint8Array | string): Uint8Array {
  const msg = typeof input === 'string' ? utf8(input) : input;
  const len = msg.length;
  const padded = new Uint8Array((((len + 8) >> 6) + 1) << 6);
  padded.set(msg);
  padded[len] = 0x80;
  const view = new DataView(padded.buffer);
  const bitLen = len * 8;
  view.setUint32(padded.length - 8, Math.floor(bitLen / 2 ** 32), false);
  view.setUint32(padded.length - 4, bitLen >>> 0, false);

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;
  const w = new Array<number>(80);
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4, false);
    for (let i = 16; i < 80; i++) w[i] = rotl(w[i - 3]! ^ w[i - 8]! ^ w[i - 14]! ^ w[i - 16]!, 1);
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    for (let i = 0; i < 80; i++) {
      let f: number;
      let k: number;
      if (i < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (i < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (i < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }
      const t = (rotl(a, 5) + f + e + k + w[i]!) | 0;
      e = d;
      d = c;
      c = rotl(b, 30);
      b = a;
      a = t;
    }
    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
  }
  const out = new Uint8Array(20);
  const ov = new DataView(out.buffer);
  [h0, h1, h2, h3, h4].forEach((h, i) => ov.setUint32(i * 4, h >>> 0, false));
  return out;
}

export function sha1Hex(input: Uint8Array | string): string {
  return toHex(sha1(input));
}

const BLOCK = 64;

export function hmacSha1(key: Uint8Array | string, data: Uint8Array | string): Uint8Array {
  let k = typeof key === 'string' ? utf8(key) : key;
  if (k.length > BLOCK) k = sha1(k);
  const kb = new Uint8Array(BLOCK);
  kb.set(k);
  const ipad = kb.map((x) => x ^ 0x36);
  const opad = kb.map((x) => x ^ 0x5c);
  const d = typeof data === 'string' ? utf8(data) : data;
  return sha1(concatBytes(opad, sha1(concatBytes(ipad, d))));
}

export function hmacSha1Hex(key: Uint8Array | string, data: Uint8Array | string): string {
  return toHex(hmacSha1(key, data));
}
