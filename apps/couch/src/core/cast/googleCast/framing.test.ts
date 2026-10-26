/**
 * T106: CASTV2 framing (hand-written protobuf + 4-byte length prefix). Byte layouts below were built
 * from the CastMessage field list, not captured from a device.
 */
import { utf8 } from '../../crypto/bytes';
import {
  CAST_MAX_FRAME,
  CastFrameDecoder,
  CastFramingError,
  decodeCastMessage,
  encodeCastMessage,
  frameCastMessage,
  utf8Decode,
  type CastMessage,
} from './framing';

const CONNECT: CastMessage = {
  sourceId: 'sender-0',
  destinationId: 'receiver-0',
  namespace: 'urn:x-cast:com.google.cast.tp.connection',
  payloadUtf8: '{"type":"CONNECT"}',
};

describe('CastMessage encoding', () => {
  it('writes the fields in order with the expected tags', () => {
    const b = encodeCastMessage({ sourceId: 'a', destinationId: 'bc', namespace: 'n', payloadUtf8: '{}' });
    expect([...b]).toEqual([
      0x08, 0x00, // protocol_version = CASTV2_1_0
      0x12, 0x01, 0x61, // source_id "a"
      0x1a, 0x02, 0x62, 0x63, // destination_id "bc"
      0x22, 0x01, 0x6e, // namespace "n"
      0x28, 0x00, // payload_type = STRING
      0x32, 0x02, 0x7b, 0x7d, // payload_utf8 "{}"
    ]);
  });

  it('prefixes a frame with its big-endian length', () => {
    const f = frameCastMessage(CONNECT);
    const body = encodeCastMessage(CONNECT);
    expect(f.length).toBe(body.length + 4);
    expect([...f.subarray(0, 4)]).toEqual([0, 0, 0, body.length]);
    expect([...f.subarray(4)]).toEqual([...body]);
  });

  it('round-trips, including multi-byte varint lengths and non-ASCII text', () => {
    const long = { ...CONNECT, payloadUtf8: JSON.stringify({ type: 'LOAD', title: 'Strand été \u{1F3D6} ' + 'x'.repeat(400) }) };
    expect(decodeCastMessage(encodeCastMessage(long))).toEqual(long);
  });

  it('skips unknown fields and binary payloads', () => {
    const body = [
      ...encodeCastMessage(CONNECT),
      0x3a, 0x02, 0x01, 0x02, // payload_binary (field 7, bytes)
      0x48, 0x96, 0x01, // unknown varint field 9 = 150
      0x55, 1, 2, 3, 4, // unknown fixed32 field 10
    ];
    expect(decodeCastMessage(Uint8Array.from(body))).toEqual(CONNECT);
  });

  it('rejects truncated messages', () => {
    const b = encodeCastMessage(CONNECT);
    expect(() => decodeCastMessage(b.subarray(0, b.length - 3))).toThrow(CastFramingError);
  });

  it('refuses to frame a message over 64 KiB', () => {
    expect(() => frameCastMessage({ ...CONNECT, payloadUtf8: 'x'.repeat(CAST_MAX_FRAME) })).toThrow(CastFramingError);
  });

  it('decodes UTF-8 like the encoder writes it', () => {
    const s = 'aé中\u{1F600}';
    expect(utf8Decode(utf8(s))).toBe(s);
    expect(utf8Decode(Uint8Array.of(0xff, 0x41))).toBe('�A');
  });
});

describe('CastFrameDecoder', () => {
  const a = frameCastMessage(CONNECT);
  const b = frameCastMessage({ ...CONNECT, namespace: 'urn:x-cast:com.google.cast.tp.heartbeat', payloadUtf8: '{"type":"PING"}' });

  it('handles frames split across chunks, byte by byte', () => {
    const d = new CastFrameDecoder();
    const out: CastMessage[] = [];
    for (const x of [...a, ...b]) out.push(...d.push(Uint8Array.of(x)));
    expect(out.map((m) => m.payloadUtf8)).toEqual(['{"type":"CONNECT"}', '{"type":"PING"}']);
    expect(d.pending).toBe(0);
  });

  it('handles coalesced frames and a partial tail', () => {
    const d = new CastFrameDecoder();
    const all = Uint8Array.from([...a, ...b, ...a.subarray(0, 6)]);
    expect(d.push(all)).toHaveLength(2);
    expect(d.pending).toBe(6);
    expect(d.push(a.subarray(6))).toEqual([CONNECT]);
  });

  it('rejects a declared length over 64 KiB and stays failed', () => {
    const d = new CastFrameDecoder();
    const n = CAST_MAX_FRAME + 1;
    expect(() => d.push(Uint8Array.of((n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255))).toThrow(CastFramingError);
    expect(() => d.push(a)).toThrow(CastFramingError);
  });

  it('accepts a frame of exactly 64 KiB', () => {
    const d = new CastFrameDecoder();
    const base = encodeCastMessage({ ...CONNECT, payloadUtf8: '' }).length;
    // base already counts a 1-byte length; this payload's length needs a 3-byte varint (+2).
    const payload = 'y'.repeat(CAST_MAX_FRAME - base - 2);
    const f = frameCastMessage({ ...CONNECT, payloadUtf8: payload });
    expect(f.length - 4).toBe(CAST_MAX_FRAME);
    expect(d.push(f)[0]?.payloadUtf8.length).toBe(payload.length);
  });
});
