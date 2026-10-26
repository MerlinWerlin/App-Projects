/**
 * Google Cast (CASTV2) wire framing (T106), written by hand so no protobuf library is needed.
 *
 * Every message on the TLS socket (port 8009) is a 4-byte big-endian length followed by a protobuf
 * `CastMessage`:
 *
 *   1 protocol_version  varint  (CASTV2_1_0 = 0)
 *   2 source_id         string
 *   3 destination_id    string
 *   4 namespace         string
 *   5 payload_type      varint  (STRING = 0, BINARY = 1)
 *   6 payload_utf8      string
 *   7 payload_binary    bytes   (never sent by us; read and ignored)
 *
 * Reconstructed from public descriptions of the protocol; tested against our own fixtures only and
 * never against a real TV. Pure TypeScript, no TextEncoder / Buffer assumptions (Hermes-safe).
 */
import { utf8 } from '../../crypto/bytes';

export interface CastMessage {
  sourceId: string;
  destinationId: string;
  namespace: string;
  /** JSON text for every namespace we use. */
  payloadUtf8: string;
}

/** Largest frame accepted (and sent); real Cast messages are a few KiB at most. */
export const CAST_MAX_FRAME = 64 * 1024;

/** Thrown for malformed or oversized frames; the channel closes the connection on it. */
export class CastFramingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CastFramingError';
  }
}

/** UTF-8 decode (invalid sequences become U+FFFD). */
export function utf8Decode(b: Uint8Array): string {
  let s = '';
  let i = 0;
  while (i < b.length) {
    const c = b[i]!;
    let cp = 0xfffd;
    let n = 1;
    if (c < 0x80) cp = c;
    else if (c >= 0xc2 && c < 0xe0 && i + 1 < b.length && (b[i + 1]! & 0xc0) === 0x80) {
      cp = ((c & 0x1f) << 6) | (b[i + 1]! & 0x3f);
      n = 2;
    } else if (c >= 0xe0 && c < 0xf0 && i + 2 < b.length && (b[i + 1]! & 0xc0) === 0x80 && (b[i + 2]! & 0xc0) === 0x80) {
      cp = ((c & 0x0f) << 12) | ((b[i + 1]! & 0x3f) << 6) | (b[i + 2]! & 0x3f);
      n = 3;
      if (cp < 0x800 || (cp >= 0xd800 && cp <= 0xdfff)) cp = 0xfffd;
    } else if (
      c >= 0xf0 &&
      c < 0xf5 &&
      i + 3 < b.length &&
      (b[i + 1]! & 0xc0) === 0x80 &&
      (b[i + 2]! & 0xc0) === 0x80 &&
      (b[i + 3]! & 0xc0) === 0x80
    ) {
      cp = ((c & 0x07) << 18) | ((b[i + 1]! & 0x3f) << 12) | ((b[i + 2]! & 0x3f) << 6) | (b[i + 3]! & 0x3f);
      n = 4;
      if (cp < 0x10000 || cp > 0x10ffff) cp = 0xfffd;
    }
    s += String.fromCodePoint(cp);
    i += n;
  }
  return s;
}

function pushVarint(out: number[], v: number): void {
  let n = v >>> 0;
  while (n >= 0x80) {
    out.push((n & 0x7f) | 0x80);
    n >>>= 7;
  }
  out.push(n);
}

function pushString(out: number[], field: number, s: string): void {
  const bytes = utf8(s);
  pushVarint(out, (field << 3) | 2);
  pushVarint(out, bytes.length);
  for (const x of bytes) out.push(x);
}

/** Protobuf body of one CastMessage (no length prefix). */
export function encodeCastMessage(m: CastMessage): Uint8Array {
  const out: number[] = [];
  pushVarint(out, (1 << 3) | 0);
  pushVarint(out, 0); // CASTV2_1_0
  pushString(out, 2, m.sourceId);
  pushString(out, 3, m.destinationId);
  pushString(out, 4, m.namespace);
  pushVarint(out, (5 << 3) | 0);
  pushVarint(out, 0); // STRING
  pushString(out, 6, m.payloadUtf8);
  return Uint8Array.from(out);
}

/** Length-prefixed frame ready for the socket. Throws CastFramingError when over CAST_MAX_FRAME. */
export function frameCastMessage(m: CastMessage): Uint8Array {
  const body = encodeCastMessage(m);
  if (body.length > CAST_MAX_FRAME) throw new CastFramingError('Cast message too large.');
  const out = new Uint8Array(4 + body.length);
  const n = body.length;
  out[0] = (n >>> 24) & 0xff;
  out[1] = (n >>> 16) & 0xff;
  out[2] = (n >>> 8) & 0xff;
  out[3] = n & 0xff;
  out.set(body, 4);
  return out;
}

/** Parses one protobuf CastMessage body. Unknown fields are skipped; binary payloads give ''. */
export function decodeCastMessage(b: Uint8Array): CastMessage {
  const m: CastMessage = { sourceId: '', destinationId: '', namespace: '', payloadUtf8: '' };
  let i = 0;
  const varint = (): number => {
    let v = 0;
    let shift = 0;
    for (;;) {
      if (i >= b.length) throw new CastFramingError('Truncated varint.');
      const x = b[i++]!;
      if (shift < 32) v += (x & 0x7f) * 2 ** shift;
      if ((x & 0x80) === 0) return v;
      shift += 7;
      if (shift > 63) throw new CastFramingError('Varint too long.');
    }
  };
  while (i < b.length) {
    const key = varint();
    const field = Math.floor(key / 8);
    const wire = key % 8;
    if (wire === 0) {
      varint();
    } else if (wire === 2) {
      const len = varint();
      if (i + len > b.length) throw new CastFramingError('Truncated field.');
      const chunk = b.subarray(i, i + len);
      i += len;
      if (field === 2) m.sourceId = utf8Decode(chunk);
      else if (field === 3) m.destinationId = utf8Decode(chunk);
      else if (field === 4) m.namespace = utf8Decode(chunk);
      else if (field === 6) m.payloadUtf8 = utf8Decode(chunk);
    } else if (wire === 1) {
      i += 8;
    } else if (wire === 5) {
      i += 4;
    } else {
      throw new CastFramingError('Unsupported wire type.');
    }
    if (i > b.length) throw new CastFramingError('Truncated field.');
  }
  return m;
}

/**
 * Stream decoder: feed it socket chunks in any split (half a length prefix, several frames at once)
 * and it returns the complete messages. A declared length over CAST_MAX_FRAME throws
 * CastFramingError and the decoder stays broken (the connection must be closed).
 */
export class CastFrameDecoder {
  private buf = new Uint8Array(0);
  private broken = false;

  push(chunk: Uint8Array): CastMessage[] {
    if (this.broken) throw new CastFramingError('Cast stream already failed.');
    const merged = new Uint8Array(this.buf.length + chunk.length);
    merged.set(this.buf, 0);
    merged.set(chunk, this.buf.length);
    const out: CastMessage[] = [];
    let off = 0;
    while (merged.length - off >= 4) {
      const len = ((merged[off]! << 24) >>> 0) + (merged[off + 1]! << 16) + (merged[off + 2]! << 8) + merged[off + 3]!;
      if (len > CAST_MAX_FRAME) {
        this.broken = true;
        this.buf = new Uint8Array(0);
        throw new CastFramingError('Cast frame too large.');
      }
      if (merged.length - off - 4 < len) break;
      const body = merged.subarray(off + 4, off + 4 + len);
      off += 4 + len;
      try {
        out.push(decodeCastMessage(body));
      } catch (e) {
        this.broken = true;
        this.buf = new Uint8Array(0);
        throw e;
      }
    }
    this.buf = merged.slice(off);
    return out;
  }

  /** Bytes waiting for the rest of their frame. */
  get pending(): number {
    return this.buf.length;
  }
}
