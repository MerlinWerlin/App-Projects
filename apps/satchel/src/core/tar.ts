// POSIX ustar reading, pure TS (T47). The city map packs (docs: PACK_CONTRACT) are plain uncompressed tar files;
// src/native/cityMaps.ts walks one on disk by reading each 512-byte header, decoding it here, then copying the
// entry's body. Also a small base64 <-> bytes codec, because expo-file-system reads byte ranges only as base64 and
// Hermes has no Buffer (and atob/btoa handle only Latin-1 strings, not bytes).

export const BLOCK = 512;

export type TarEntryType = 'file' | 'dir' | 'meta' | 'other';

export type TarHeader = {
  /** Full path: the ustar prefix field joined to the name field with '/'. */
  name: string;
  /** Body size in bytes. */
  size: number;
  /** Raw typeflag character ('0' or '\0' for a regular file). */
  typeflag: string;
  type: TarEntryType;
};

/** Header problems: a block that is not a tar header at all. */
export type TarHeaderError = 'short' | 'checksum' | 'size';

const isZero = (b: Uint8Array) => b.every((x) => x === 0);

/** A NUL-terminated field as a string (ustar names are ASCII; UTF-8 is decoded leniently). */
function field(b: Uint8Array, start: number, len: number): string {
  let end = start;
  while (end < start + len && b[end] !== 0) end++;
  return utf8Decode(b.subarray(start, end));
}

/** An octal numeric field (spaces/NULs around it allowed), or the GNU base-256 form; NaN when malformed. */
export function readOctal(b: Uint8Array, start: number, len: number): number {
  if ((b[start] & 0x80) !== 0) {
    // base-256: big-endian, the top bit of the first byte is the marker (positive numbers only)
    let n = b[start] & 0x7f;
    for (let i = start + 1; i < start + len; i++) n = n * 256 + b[i];
    return n;
  }
  const s = field(b, start, len).trim();
  if (s === '') return 0;
  if (!/^[0-7]+$/.test(s)) return NaN;
  return parseInt(s, 8);
}

/** The header checksum: the sum of all bytes with the checksum field itself read as spaces. */
export function headerChecksum(b: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < BLOCK; i++) sum += i >= 148 && i < 156 ? 32 : b[i];
  return sum;
}

function entryType(flag: string): TarEntryType {
  if (flag === '0' || flag === '\0' || flag === '' || flag === '7') return 'file';
  if (flag === '5') return 'dir';
  // pax extended headers (x, g) and GNU long names (L, K): metadata whose body must be skipped
  if (flag === 'x' || flag === 'g' || flag === 'L' || flag === 'K') return 'meta';
  return 'other';
}

/**
 * Decodes one 512-byte header block. 'end' for an all-zero block (the end-of-archive marker); an error string for
 * a block that is not a valid header.
 */
export function parseTarHeader(block: Uint8Array): TarHeader | 'end' | TarHeaderError {
  if (block.length < BLOCK) return 'short';
  if (isZero(block.subarray(0, BLOCK))) return 'end';
  const stored = readOctal(block, 148, 8);
  if (!Number.isFinite(stored) || stored !== headerChecksum(block)) return 'checksum';
  const size = readOctal(block, 124, 12);
  if (!Number.isFinite(size) || size < 0 || !Number.isSafeInteger(size)) return 'size';
  const typeflag = String.fromCharCode(block[156]);
  const base = field(block, 0, 100);
  const magic = field(block, 257, 6);
  const prefix = magic.startsWith('ustar') ? field(block, 345, 155) : '';
  const name = prefix ? `${prefix}/${base}` : base;
  return { name, size, typeflag, type: entryType(typeflag) };
}

/** Bytes a body of `size` takes in the archive (rounded up to whole blocks). */
export const paddedSize = (size: number) => Math.ceil(size / BLOCK) * BLOCK;

/** Offset of the next header after the header at `offset` whose body is `size` bytes. */
export const nextHeaderOffset = (offset: number, size: number) => offset + BLOCK + paddedSize(size);

// ---- tar writing (tests and fixtures only need it, but it is tiny) ----

function putString(b: Uint8Array, start: number, len: number, s: string) {
  const bytes = utf8Encode(s);
  if (bytes.length > len) throw new Error(`tar field too long: ${s}`);
  b.set(bytes, start);
}

function putOctal(b: Uint8Array, start: number, len: number, n: number) {
  putString(b, start, len, n.toString(8).padStart(len - 1, '0'));
}

/** One ustar header for a regular file (or a directory with typeflag '5'). Names over 100 bytes use the prefix. */
export function makeTarHeader(name: string, size: number, typeflag = '0'): Uint8Array {
  const b = new Uint8Array(BLOCK);
  let base = name;
  let prefix = '';
  if (utf8Encode(name).length > 100) {
    const cut = name.lastIndexOf('/', name.length - 2);
    if (cut <= 0) throw new Error(`tar name too long: ${name}`);
    prefix = name.slice(0, cut);
    base = name.slice(cut + 1);
  }
  putString(b, 0, 100, base);
  putOctal(b, 100, 8, typeflag === '5' ? 0o755 : 0o644);
  putOctal(b, 108, 8, 0);
  putOctal(b, 116, 8, 0);
  putOctal(b, 124, 12, size);
  putOctal(b, 136, 12, 0);
  b[156] = typeflag.charCodeAt(0);
  putString(b, 257, 6, 'ustar');
  putString(b, 263, 2, '00');
  putString(b, 345, 155, prefix);
  const sum = headerChecksum(b);
  putString(b, 148, 8, sum.toString(8).padStart(6, '0') + '\0 ');
  return b;
}

/** A whole archive from entries (bodies padded, two zero blocks at the end). */
export function makeTar(entries: readonly { name: string; body: Uint8Array; typeflag?: string }[]): Uint8Array {
  const total = entries.reduce((n, e) => n + BLOCK + paddedSize(e.body.length), 0) + 2 * BLOCK;
  const out = new Uint8Array(total);
  let off = 0;
  for (const e of entries) {
    out.set(makeTarHeader(e.name, e.body.length, e.typeflag), off);
    out.set(e.body, off + BLOCK);
    off = nextHeaderOffset(off, e.body.length);
  }
  return out;
}

// ---- base64 and UTF-8 ----

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const LOOKUP = (() => {
  const t = new Int16Array(128).fill(-1);
  for (let i = 0; i < ALPHABET.length; i++) t[ALPHABET.charCodeAt(i)] = i;
  t['-'.charCodeAt(0)] = 62; // base64url tolerated
  t['_'.charCodeAt(0)] = 63;
  return t;
})();

/** Standard base64 (with '=' padding) of the bytes. */
export function bytesToBase64(bytes: Uint8Array): string {
  const parts: string[] = [];
  let chunk = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const n = (a << 16) | (b << 8) | c;
    chunk +=
      ALPHABET[(n >> 18) & 63] +
      ALPHABET[(n >> 12) & 63] +
      (i + 1 < bytes.length ? ALPHABET[(n >> 6) & 63] : '=') +
      (i + 2 < bytes.length ? ALPHABET[n & 63] : '=');
    if (chunk.length >= 8192) {
      parts.push(chunk);
      chunk = '';
    }
  }
  parts.push(chunk);
  return parts.join('');
}

/** Bytes from base64 (padding optional, whitespace ignored); null if it contains anything else. */
export function base64ToBytes(s: string): Uint8Array | null {
  const clean = s.replace(/[\s=]+/g, '');
  if (clean.length % 4 === 1) return null;
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  let acc = 0;
  let bits = 0;
  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i);
    const v = code < 128 ? LOOKUP[code] : -1;
    if (v < 0) return null;
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (acc >> bits) & 0xff;
    }
  }
  return out.subarray(0, o);
}

/** UTF-8 encode (no TextEncoder dependency). */
export function utf8Encode(s: string): Uint8Array {
  const out: number[] = [];
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return Uint8Array.from(out);
}

/** UTF-8 decode, replacing malformed sequences with U+FFFD (no TextDecoder dependency). */
export function utf8Decode(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; ) {
    const x = b[i];
    let c = 0xfffd;
    let n = 1;
    if (x < 0x80) c = x;
    else if (x >= 0xc2 && x < 0xe0 && i + 1 < b.length && (b[i + 1] & 0xc0) === 0x80) {
      c = ((x & 31) << 6) | (b[i + 1] & 63);
      n = 2;
    } else if (x >= 0xe0 && x < 0xf0 && i + 2 < b.length && (b[i + 1] & 0xc0) === 0x80 && (b[i + 2] & 0xc0) === 0x80) {
      c = ((x & 15) << 12) | ((b[i + 1] & 63) << 6) | (b[i + 2] & 63);
      n = 3;
    } else if (x >= 0xf0 && x < 0xf5 && i + 3 < b.length && (b[i + 1] & 0xc0) === 0x80 && (b[i + 2] & 0xc0) === 0x80 && (b[i + 3] & 0xc0) === 0x80) {
      c = ((x & 7) << 18) | ((b[i + 1] & 63) << 12) | ((b[i + 2] & 63) << 6) | (b[i + 3] & 63);
      n = 4;
    }
    s += String.fromCodePoint(c);
    i += n;
  }
  return s;
}
