// Pure-TS DEFLATE decoder (RFC 1951) and gzip unwrapper (RFC 1952) for theme-pack artwork (T46).
// React Native has no zlib, and packs are small, so a compact table-driven inflater is enough.
// Packs are compressed at build time with node:zlib (ops/build-pack.ts).

type Tree = { counts: Uint16Array; symbols: Uint16Array };

function tree(): Tree {
  return { counts: new Uint16Array(16), symbols: new Uint16Array(288) };
}

const LEN_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const LEN_BITS = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const DIST_BASE = [
  1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577,
];
const DIST_BITS = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
const CL_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

function build(t: Tree, lengths: ArrayLike<number>, off: number, num: number): void {
  t.counts.fill(0);
  for (let i = 0; i < num; i++) t.counts[lengths[off + i]]++;
  t.counts[0] = 0;
  const offs = new Uint16Array(16);
  let sum = 0;
  for (let i = 0; i < 16; i++) {
    offs[i] = sum;
    sum += t.counts[i];
  }
  for (let i = 0; i < num; i++) if (lengths[off + i]) t.symbols[offs[lengths[off + i]]++] = i;
}

const FIXED_LIT = tree();
const FIXED_DIST = tree();
{
  const l = new Uint8Array(288);
  for (let i = 0; i < 144; i++) l[i] = 8;
  for (let i = 144; i < 256; i++) l[i] = 9;
  for (let i = 256; i < 280; i++) l[i] = 7;
  for (let i = 280; i < 288; i++) l[i] = 8;
  build(FIXED_LIT, l, 0, 288);
  const d = new Uint8Array(30).fill(5);
  build(FIXED_DIST, d, 0, 30);
}

type Reader = { src: Uint8Array; pos: number; tag: number; bits: number };

function bit(r: Reader): number {
  if (r.bits === 0) {
    if (r.pos >= r.src.length) throw new Error('inflate: unexpected end of data');
    r.tag = r.src[r.pos++];
    r.bits = 8;
  }
  const b = r.tag & 1;
  r.tag >>>= 1;
  r.bits--;
  return b;
}

function bitsOf(r: Reader, n: number, base: number): number {
  let v = 0;
  for (let i = 0; i < n; i++) v |= bit(r) << i;
  return v + base;
}

function decodeSym(r: Reader, t: Tree): number {
  let sum = 0;
  let cur = 0;
  let len = 0;
  do {
    cur = 2 * cur + bit(r);
    len++;
    if (len > 15) throw new Error('inflate: bad code');
    sum += t.counts[len];
    cur -= t.counts[len];
  } while (cur >= 0);
  return t.symbols[sum + cur];
}

class Out {
  buf = new Uint8Array(1024);
  n = 0;
  push(b: number): void {
    if (this.n === this.buf.length) {
      const next = new Uint8Array(this.buf.length * 2);
      next.set(this.buf);
      this.buf = next;
    }
    this.buf[this.n++] = b;
  }
}

function dynamicTrees(r: Reader, lt: Tree, dt: Tree): void {
  const hlit = bitsOf(r, 5, 257);
  const hdist = bitsOf(r, 5, 1);
  const hclen = bitsOf(r, 4, 4);
  const lengths = new Uint8Array(288 + 32);
  for (let i = 0; i < hclen; i++) lengths[CL_ORDER[i]] = bitsOf(r, 3, 0);
  const ct = tree();
  build(ct, lengths, 0, 19);
  lengths.fill(0, 0, 19);
  let num = 0;
  while (num < hlit + hdist) {
    const sym = decodeSym(r, ct);
    if (sym < 16) lengths[num++] = sym;
    else {
      let rep: number;
      let val = 0;
      if (sym === 16) {
        if (num === 0) throw new Error('inflate: bad repeat');
        val = lengths[num - 1];
        rep = bitsOf(r, 2, 3);
      } else if (sym === 17) rep = bitsOf(r, 3, 3);
      else rep = bitsOf(r, 7, 11);
      if (num + rep > hlit + hdist) throw new Error('inflate: bad lengths');
      while (rep--) lengths[num++] = val;
    }
  }
  build(lt, lengths, 0, hlit);
  build(dt, lengths, hlit, hdist);
}

function block(r: Reader, out: Out, lt: Tree, dt: Tree): void {
  for (;;) {
    const sym = decodeSym(r, lt);
    if (sym === 256) return;
    if (sym < 256) {
      out.push(sym);
      continue;
    }
    const li = sym - 257;
    if (li >= 29) throw new Error('inflate: bad length symbol');
    const len = bitsOf(r, LEN_BITS[li], LEN_BASE[li]);
    const di = decodeSym(r, dt);
    if (di >= 30) throw new Error('inflate: bad distance symbol');
    const dist = bitsOf(r, DIST_BITS[di], DIST_BASE[di]);
    if (dist > out.n) throw new Error('inflate: distance too far back');
    for (let i = 0; i < len; i++) out.push(out.buf[out.n - dist]);
  }
}

/** Decode a raw DEFLATE stream starting at `offset`. Returns the bytes and where the stream ended. */
export function inflateRaw(src: Uint8Array, offset = 0): { bytes: Uint8Array; end: number } {
  const r: Reader = { src, pos: offset, tag: 0, bits: 0 };
  const out = new Out();
  let last = 0;
  while (!last) {
    last = bit(r);
    const type = bitsOf(r, 2, 0);
    if (type === 0) {
      r.bits = 0; // skip to byte boundary
      if (r.pos + 4 > src.length) throw new Error('inflate: truncated stored block');
      const len = src[r.pos] | (src[r.pos + 1] << 8);
      const nlen = src[r.pos + 2] | (src[r.pos + 3] << 8);
      if ((len ^ 0xffff) !== nlen) throw new Error('inflate: bad stored block');
      r.pos += 4;
      if (r.pos + len > src.length) throw new Error('inflate: truncated stored block');
      for (let i = 0; i < len; i++) out.push(src[r.pos++]);
    } else if (type === 1) block(r, out, FIXED_LIT, FIXED_DIST);
    else if (type === 2) {
      const lt = tree();
      const dt = tree();
      dynamicTrees(r, lt, dt);
      block(r, out, lt, dt);
    } else throw new Error('inflate: bad block type');
  }
  return { bytes: out.buf.slice(0, out.n), end: r.pos };
}

let CRC_TABLE: Uint32Array | null = null;
export function crc32(b: Uint8Array): number {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Decompress a single-member gzip file, checking its CRC-32 and length trailer. */
export function gunzip(src: Uint8Array): Uint8Array {
  if (src.length < 18 || src[0] !== 0x1f || src[1] !== 0x8b || src[2] !== 8) throw new Error('gunzip: not a gzip file');
  const flags = src[3];
  let p = 10;
  if (flags & 4) p += 2 + (src[p] | (src[p + 1] << 8)); // FEXTRA
  if (flags & 8) while (p < src.length && src[p++] !== 0); // FNAME
  if (flags & 16) while (p < src.length && src[p++] !== 0); // FCOMMENT
  if (flags & 2) p += 2; // FHCRC
  const { bytes, end } = inflateRaw(src, p);
  if (end + 8 > src.length) throw new Error('gunzip: truncated trailer');
  const crc = (src[end] | (src[end + 1] << 8) | (src[end + 2] << 16) | (src[end + 3] << 24)) >>> 0;
  const size = (src[end + 4] | (src[end + 5] << 8) | (src[end + 6] << 16) | (src[end + 7] << 24)) >>> 0;
  if (crc !== crc32(bytes) || size !== (bytes.length >>> 0)) throw new Error('gunzip: checksum mismatch');
  return bytes;
}
