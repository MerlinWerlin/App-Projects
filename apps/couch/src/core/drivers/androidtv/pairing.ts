/**
 * Android TV Remote v2 pairing secret ("polo" protocol, :6467).
 *
 * After configuration the TV shows a 6-character hex code. The client proves it saw the code by
 * sending
 *
 *   secret = SHA-256( clientModulus || clientExponent || serverModulus || serverExponent || codeBytes )
 *
 * where the four RSA numbers come from the client's own certificate and the TV's certificate on
 * the TLS connection, and codeBytes = the code's characters 2..6 parsed as hex (2 bytes). The TV
 * computes the same hash and puts its first byte in the code: characters 0..2 must equal
 * secret[0], which lets the client reject a mistyped code before sending anything.
 *
 * Number normalisation (as implemented by androidtvremote2 and kud/androidtv-remote, which feed the
 * hash with the hex string of the integer turned back into bytes): each number is its unsigned
 * big-endian magnitude with NO leading zero bytes (so the ASN.1 DER sign byte 0x00 in front of a
 * modulus with the top bit set is dropped), and at least one byte. Hence exponent 65537 is
 * 01 00 01 (three bytes) and a 2048-bit modulus is exactly 256 bytes. UNVERIFIED on hardware.
 *
 * SHA-256 is implemented here in pure TypeScript so Node/bun and Hermes behave identically.
 */
import { DriverError } from '../../types';
import { driverError } from '../errors';

// ---------------------------------------------------------------- SHA-256 (FIPS 180-4)

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01,
  0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08,
  0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/** One-shot SHA-256 over the concatenation of `parts`. */
export function sha256(...parts: Uint8Array[]): Uint8Array {
  let len = 0;
  for (const p of parts) len += p.length;
  // message || 0x80 || zeros || 64-bit big-endian bit length, padded to a multiple of 64 bytes
  const total = Math.ceil((len + 9) / 64) * 64;
  const m = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    m.set(p, o);
    o += p.length;
  }
  m[len] = 0x80;
  const dv = new DataView(m.buffer);
  const bits = len * 8;
  dv.setUint32(total - 8, Math.floor(bits / 0x100000000));
  dv.setUint32(total - 4, bits >>> 0);

  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const W = new Uint32Array(64);
  const rotr = (x: number, n: number): number => (x >>> n) | (x << (32 - n));
  for (let blk = 0; blk < total; blk += 64) {
    for (let t = 0; t < 16; t++) W[t] = dv.getUint32(blk + t * 4);
    for (let t = 16; t < 64; t++) {
      const w15 = W[t - 15]!;
      const w2 = W[t - 2]!;
      const s0 = rotr(w15, 7) ^ rotr(w15, 18) ^ (w15 >>> 3);
      const s1 = rotr(w2, 17) ^ rotr(w2, 19) ^ (w2 >>> 10);
      W[t] = (W[t - 16]! + s0 + W[t - 7]! + s1) >>> 0;
    }
    let a = H[0]!;
    let b = H[1]!;
    let c = H[2]!;
    let d = H[3]!;
    let e = H[4]!;
    let f = H[5]!;
    let g = H[6]!;
    let h = H[7]!;
    for (let t = 0; t < 64; t++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[t]! + W[t]!) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    H[0] = (H[0]! + a) >>> 0;
    H[1] = (H[1]! + b) >>> 0;
    H[2] = (H[2]! + c) >>> 0;
    H[3] = (H[3]! + d) >>> 0;
    H[4] = (H[4]! + e) >>> 0;
    H[5] = (H[5]! + f) >>> 0;
    H[6] = (H[6]! + g) >>> 0;
    H[7] = (H[7]! + h) >>> 0;
  }
  const out = new Uint8Array(32);
  const ov = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) ov.setUint32(i * 4, H[i]!);
  return out;
}

// ---------------------------------------------------------------- secret

/** An RSA public key as raw big-endian integers (any leading zero bytes are tolerated). */
export interface RsaPublicKey {
  modulus: Uint8Array;
  exponent: Uint8Array;
}

/** Unsigned big-endian magnitude without leading zero bytes; zero becomes a single 0x00 byte. */
export function normalizeBigEndian(b: Uint8Array): Uint8Array {
  let i = 0;
  while (i < b.length - 1 && b[i] === 0) i++;
  if (b.length === 0) return new Uint8Array([0]);
  return b.slice(i);
}

/** Uppercase, trimmed code if it is exactly 6 hex characters; else null. */
export function normalizeCode(code: string): string | null {
  const c = code.replace(/\s+/g, '').toUpperCase();
  return /^[0-9A-F]{6}$/.test(c) ? c : null;
}

/** The hash, before the first-byte check. */
export function pairingHash(client: RsaPublicKey, server: RsaPublicKey, code: string): Uint8Array {
  const c = normalizeCode(code);
  if (!c) throw driverError('pair_required', 'core.driver.androidtv.codeFormat', { length: '6' });
  const tail = new Uint8Array([parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)]);
  return sha256(
    normalizeBigEndian(client.modulus),
    normalizeBigEndian(client.exponent),
    normalizeBigEndian(server.modulus),
    normalizeBigEndian(server.exponent),
    tail,
  );
}

/**
 * The secret to send for a code the user typed. Throws DriverError('pair_required') when the
 * code is malformed or its first byte does not match the hash (a typo, or the wrong TV).
 */
export function pairingSecret(client: RsaPublicKey, server: RsaPublicKey, code: string): Uint8Array {
  const h = pairingHash(client, server, code);
  const c = normalizeCode(code)!;
  if (h[0] !== parseInt(c.slice(0, 2), 16)) {
    throw driverError('pair_required', 'core.driver.androidtv.codeMismatch');
  }
  return h;
}

/** True when `code` is well-formed and matches the hash's first byte. */
export function isCodeValid(client: RsaPublicKey, server: RsaPublicKey, code: string): boolean {
  try {
    pairingSecret(client, server, code);
    return true;
  } catch {
    return false;
  }
}
