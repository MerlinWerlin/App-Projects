/**
 * Minimal hand-written protobuf (wire format) encoder/decoder plus the Android TV Remote v2
 * messages Couch needs. No dependency: varints, length-delimited fields and nothing else.
 *
 * Message layouts are written from public knowledge of the protocol (the "polo" pairing protocol
 * on :6467 and the remote protocol on :6466, as described by androidtvremote2 (Apache-2.0) and
 * kud/androidtv-remote (MIT)); logic is described, not copied. Field numbers and enum values are
 * UNVERIFIED on hardware.
 *
 * Every frame on both ports is `varint(length) || message bytes`.
 */

// ---------------------------------------------------------------- wire format

export const WIRE_VARINT = 0;
export const WIRE_I64 = 1;
export const WIRE_LEN = 2;
export const WIRE_I32 = 5;

const TWO_64 = 1n << 64n;

/** Varint bytes for a non-negative integer, or a negative int32/int64 (two's complement, 10 bytes). */
export function encodeVarint(n: number | bigint): Uint8Array {
  let v = typeof n === 'bigint' ? n : BigInt(Math.trunc(n));
  if (v < 0n) v += TWO_64;
  if (v < 0n || v >= TWO_64) throw new RangeError(`varint out of range: ${String(n)}`);
  const out: number[] = [];
  while (v >= 0x80n) {
    out.push(Number(v & 0x7fn) | 0x80);
    v >>= 7n;
  }
  out.push(Number(v));
  return Uint8Array.from(out);
}

/** Reads a varint at `pos`. Returns null when the buffer ends mid-varint. Throws if longer than 10 bytes. */
export function decodeVarint(buf: Uint8Array, pos = 0): { value: bigint; next: number } | null {
  let v = 0n;
  let shift = 0n;
  for (let i = pos; i < buf.length; i++) {
    const b = buf[i]!;
    v |= BigInt(b & 0x7f) << shift;
    if ((b & 0x80) === 0) return { value: v, next: i + 1 };
    shift += 7n;
    if (shift >= 70n) throw new Error('varint too long');
  }
  return null;
}

/** uint64 varint value -> JS number as int32/int64 semantics (negative when the top bit is set). */
function toSigned(v: bigint): number {
  return Number(v >= 1n << 63n ? v - TWO_64 : v);
}

export function concat(parts: readonly Uint8Array[]): Uint8Array {
  let len = 0;
  for (const p of parts) len += p.length;
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

const utf8Enc = new TextEncoder();
const utf8Dec = new TextDecoder();

/** Accumulates fields of one message. */
export class Writer {
  private parts: Uint8Array[] = [];
  private tag(field: number, wire: number): void {
    this.parts.push(encodeVarint(field * 8 + wire));
  }
  varint(field: number, v: number | bigint): this {
    this.tag(field, WIRE_VARINT);
    this.parts.push(encodeVarint(v));
    return this;
  }
  bool(field: number, v: boolean): this {
    return this.varint(field, v ? 1 : 0);
  }
  bytes(field: number, v: Uint8Array): this {
    this.tag(field, WIRE_LEN);
    this.parts.push(encodeVarint(v.length), v);
    return this;
  }
  string(field: number, v: string): this {
    return this.bytes(field, utf8Enc.encode(v));
  }
  finish(): Uint8Array {
    return concat(this.parts);
  }
}

export interface Field {
  no: number;
  wire: number;
  /** For WIRE_VARINT. */
  int?: bigint;
  /** For WIRE_LEN (and raw bytes of fixed-width fields). */
  bytes?: Uint8Array;
}

/** Splits a message into its fields, in order. Throws on truncated or malformed input. */
export function readFields(buf: Uint8Array): Field[] {
  const out: Field[] = [];
  let pos = 0;
  while (pos < buf.length) {
    const t = decodeVarint(buf, pos);
    if (!t) throw new Error('truncated tag');
    pos = t.next;
    const no = Number(t.value >> 3n);
    const wire = Number(t.value & 7n);
    if (no === 0) throw new Error('field number 0');
    if (wire === WIRE_VARINT) {
      const v = decodeVarint(buf, pos);
      if (!v) throw new Error('truncated varint');
      pos = v.next;
      out.push({ no, wire, int: v.value });
    } else if (wire === WIRE_LEN) {
      const l = decodeVarint(buf, pos);
      if (!l) throw new Error('truncated length');
      const len = Number(l.value);
      const end = l.next + len;
      if (end > buf.length) throw new Error('truncated bytes');
      out.push({ no, wire, bytes: buf.subarray(l.next, end) });
      pos = end;
    } else if (wire === WIRE_I64 || wire === WIRE_I32) {
      const end = pos + (wire === WIRE_I64 ? 8 : 4);
      if (end > buf.length) throw new Error('truncated fixed');
      out.push({ no, wire, bytes: buf.subarray(pos, end) });
      pos = end;
    } else {
      throw new Error(`unsupported wire type ${wire}`);
    }
  }
  return out;
}

/** Last occurrence wins for scalars (protobuf semantics). */
function last(fields: readonly Field[], no: number, wire: number): Field | undefined {
  let f: Field | undefined;
  for (const x of fields) if (x.no === no && x.wire === wire) f = x;
  return f;
}
function intOf(fields: readonly Field[], no: number, dflt = 0): number {
  const f = last(fields, no, WIRE_VARINT);
  return f?.int === undefined ? dflt : toSigned(f.int);
}
function boolOf(fields: readonly Field[], no: number): boolean {
  const f = last(fields, no, WIRE_VARINT);
  return f?.int !== undefined && f.int !== 0n;
}
function bytesOf(fields: readonly Field[], no: number): Uint8Array | undefined {
  return last(fields, no, WIRE_LEN)?.bytes;
}
function strOf(fields: readonly Field[], no: number): string | undefined {
  const b = bytesOf(fields, no);
  return b === undefined ? undefined : utf8Dec.decode(b);
}
function subOf(fields: readonly Field[], no: number): Field[] | undefined {
  const b = bytesOf(fields, no);
  return b === undefined ? undefined : readFields(b);
}

// ---------------------------------------------------------------- framing

/** varint(length) || payload */
export function frame(payload: Uint8Array): Uint8Array {
  return concat([encodeVarint(payload.length), payload]);
}

/** Reassembles varint-length-prefixed frames from arbitrary TCP chunks. */
export class FrameReader {
  private buf: Uint8Array = new Uint8Array(0);
  /** Upper bound to stop a bad length prefix from buffering forever. */
  constructor(private readonly maxFrame = 1 << 20) {}
  push(chunk: Uint8Array): Uint8Array[] {
    this.buf = this.buf.length === 0 ? chunk.slice() : concat([this.buf, chunk]);
    const out: Uint8Array[] = [];
    for (;;) {
      const l = decodeVarint(this.buf, 0);
      if (!l) break;
      const len = Number(l.value);
      if (len > this.maxFrame) throw new Error(`frame too large: ${len}`);
      if (this.buf.length < l.next + len) break;
      out.push(this.buf.slice(l.next, l.next + len));
      this.buf = this.buf.subarray(l.next + len);
    }
    return out;
  }
  /** Bytes buffered but not yet forming a whole frame. */
  get pending(): number {
    return this.buf.length;
  }
}

// ---------------------------------------------------------------- pairing (:6467)

export const PAIRING_PROTOCOL_VERSION = 2;

export const PairingStatus = {
  OK: 200,
  ERROR: 400,
  BAD_CONFIGURATION: 401,
  BAD_SECRET: 402,
} as const;

export const EncodingType = {
  UNKNOWN: 0,
  ALPHANUMERIC: 1,
  NUMERIC: 2,
  HEXADECIMAL: 3,
  QRCODE: 4,
} as const;

export const RoleType = {
  UNKNOWN: 0,
  INPUT: 1,
  DISPLAY: 2,
} as const;

export interface PairingEncoding {
  type: number;
  symbolLength: number;
}

export interface PairingOptions {
  inputEncodings: PairingEncoding[];
  outputEncodings: PairingEncoding[];
  preferredRole?: number;
}

export interface PairingMessage {
  protocolVersion: number;
  status: number;
  pairingRequest?: { serviceName: string; clientName?: string };
  pairingRequestAck?: { serverName?: string };
  options?: PairingOptions;
  configuration?: { encoding: PairingEncoding; clientRole: number };
  configurationAck?: Record<string, never>;
  secret?: { secret: Uint8Array };
  secretAck?: { secret: Uint8Array };
}

/** Pairing field numbers (outer message). */
export const PF = {
  protocolVersion: 1,
  status: 2,
  pairingRequest: 10,
  pairingRequestAck: 11,
  options: 20,
  configuration: 30,
  configurationAck: 31,
  secret: 40,
  secretAck: 41,
} as const;

function encEncoding(e: PairingEncoding): Uint8Array {
  return new Writer().varint(1, e.type).varint(2, e.symbolLength).finish();
}
function decEncoding(f: Field[]): PairingEncoding {
  return { type: intOf(f, 1), symbolLength: intOf(f, 2) };
}

/** Pairing messages are proto2 with required fields, so scalars are always written. */
export function encodePairingMessage(m: PairingMessage): Uint8Array {
  const w = new Writer().varint(PF.protocolVersion, m.protocolVersion).varint(PF.status, m.status);
  if (m.pairingRequest) {
    const s = new Writer().string(1, m.pairingRequest.serviceName);
    if (m.pairingRequest.clientName !== undefined) s.string(2, m.pairingRequest.clientName);
    w.bytes(PF.pairingRequest, s.finish());
  }
  if (m.pairingRequestAck) {
    const s = new Writer();
    if (m.pairingRequestAck.serverName !== undefined) s.string(1, m.pairingRequestAck.serverName);
    w.bytes(PF.pairingRequestAck, s.finish());
  }
  if (m.options) {
    const s = new Writer();
    for (const e of m.options.inputEncodings) s.bytes(1, encEncoding(e));
    for (const e of m.options.outputEncodings) s.bytes(2, encEncoding(e));
    if (m.options.preferredRole !== undefined) s.varint(3, m.options.preferredRole);
    w.bytes(PF.options, s.finish());
  }
  if (m.configuration) {
    const s = new Writer().bytes(1, encEncoding(m.configuration.encoding)).varint(2, m.configuration.clientRole);
    w.bytes(PF.configuration, s.finish());
  }
  if (m.configurationAck) w.bytes(PF.configurationAck, new Uint8Array(0));
  if (m.secret) w.bytes(PF.secret, new Writer().bytes(1, m.secret.secret).finish());
  if (m.secretAck) w.bytes(PF.secretAck, new Writer().bytes(1, m.secretAck.secret).finish());
  return w.finish();
}

export function decodePairingMessage(buf: Uint8Array): PairingMessage {
  const f = readFields(buf);
  const m: PairingMessage = { protocolVersion: intOf(f, PF.protocolVersion), status: intOf(f, PF.status) };
  const pr = subOf(f, PF.pairingRequest);
  if (pr) {
    m.pairingRequest = { serviceName: strOf(pr, 1) ?? '' };
    const c = strOf(pr, 2);
    if (c !== undefined) m.pairingRequest.clientName = c;
  }
  const pra = subOf(f, PF.pairingRequestAck);
  if (pra) {
    m.pairingRequestAck = {};
    const s = strOf(pra, 1);
    if (s !== undefined) m.pairingRequestAck.serverName = s;
  }
  const op = subOf(f, PF.options);
  if (op) {
    m.options = {
      inputEncodings: op.filter((x) => x.no === 1 && x.bytes).map((x) => decEncoding(readFields(x.bytes!))),
      outputEncodings: op.filter((x) => x.no === 2 && x.bytes).map((x) => decEncoding(readFields(x.bytes!))),
    };
    if (last(op, 3, WIRE_VARINT)) m.options.preferredRole = intOf(op, 3);
  }
  const cf = subOf(f, PF.configuration);
  if (cf) m.configuration = { encoding: decEncoding(subOf(cf, 1) ?? []), clientRole: intOf(cf, 2) };
  if (subOf(f, PF.configurationAck)) m.configurationAck = {};
  const se = subOf(f, PF.secret);
  if (se) m.secret = { secret: (bytesOf(se, 1) ?? new Uint8Array(0)).slice() };
  const sa = subOf(f, PF.secretAck);
  if (sa) m.secretAck = { secret: (bytesOf(sa, 1) ?? new Uint8Array(0)).slice() };
  return m;
}

/** Service name sent in pairing_request (androidtvremote2 uses "atvremote"). UNVERIFIED whether TVs check it. */
export const PAIRING_SERVICE_NAME = 'atvremote';

const HEX6: PairingEncoding = { type: EncodingType.HEXADECIMAL, symbolLength: 6 };

export function pairingRequestMessage(clientName: string, serviceName = PAIRING_SERVICE_NAME): PairingMessage {
  return {
    protocolVersion: PAIRING_PROTOCOL_VERSION,
    status: PairingStatus.OK,
    pairingRequest: { serviceName, clientName },
  };
}

export function pairingOptionsMessage(): PairingMessage {
  return {
    protocolVersion: PAIRING_PROTOCOL_VERSION,
    status: PairingStatus.OK,
    options: { inputEncodings: [HEX6], outputEncodings: [], preferredRole: RoleType.INPUT },
  };
}

export function pairingConfigurationMessage(): PairingMessage {
  return {
    protocolVersion: PAIRING_PROTOCOL_VERSION,
    status: PairingStatus.OK,
    configuration: { encoding: HEX6, clientRole: RoleType.INPUT },
  };
}

export function pairingSecretMessage(secret: Uint8Array): PairingMessage {
  return { protocolVersion: PAIRING_PROTOCOL_VERSION, status: PairingStatus.OK, secret: { secret } };
}

// ---------------------------------------------------------------- remote (:6466)

/** Feature bitmask the phone app advertises in remote_configure and remote_set_active. UNVERIFIED meaning of bits. */
export const REMOTE_FEATURES = 622;

export const KeyDirection = {
  UNKNOWN: 0,
  START_LONG: 1,
  END_LONG: 2,
  SHORT: 3,
} as const;

export interface RemoteDeviceInfo {
  model?: string;
  vendor?: string;
  unknown1?: number;
  unknown2?: string;
  packageName?: string;
  appVersion?: string;
}

export interface RemoteMessage {
  remoteConfigure?: { code1: number; deviceInfo?: RemoteDeviceInfo };
  remoteSetActive?: { active: number };
  remoteError?: { value: boolean; message?: RemoteMessage };
  remotePingRequest?: { val1: number; val2: number };
  remotePingResponse?: { val1: number };
  remoteKeyInject?: { keyCode: number; direction: number };
  remoteStart?: { started: boolean };
  remoteAppLinkLaunchRequest?: { appLink: string };
  /** Field numbers we received but do not model (IME, volume, voice ...). Decode only. */
  unknown?: number[];
}

/** RemoteMessage field numbers. */
export const RF = {
  remoteConfigure: 1,
  remoteSetActive: 2,
  remoteError: 3,
  remotePingRequest: 8,
  remotePingResponse: 9,
  remoteKeyInject: 10,
  remoteImeKeyInject: 20,
  remoteImeBatchEdit: 21,
  remoteImeShowRequest: 22,
  remoteVoiceBegin: 30,
  remoteVoicePayload: 31,
  remoteVoiceEnd: 32,
  remoteStart: 40,
  remoteSetVolumeLevel: 50,
  remoteAdjustVolumeLevel: 51,
  remoteAppLinkLaunchRequest: 90,
} as const;

const MODELLED = new Set<number>([
  RF.remoteConfigure,
  RF.remoteSetActive,
  RF.remoteError,
  RF.remotePingRequest,
  RF.remotePingResponse,
  RF.remoteKeyInject,
  RF.remoteStart,
  RF.remoteAppLinkLaunchRequest,
]);

/** Remote messages are proto3: scalars equal to their default (0, '', false) are omitted. */
export function encodeRemoteMessage(m: RemoteMessage): Uint8Array {
  const w = new Writer();
  const int = (s: Writer, no: number, v: number | undefined): void => {
    if (v) s.varint(no, v);
  };
  const str = (s: Writer, no: number, v: string | undefined): void => {
    if (v) s.string(no, v);
  };
  if (m.remoteConfigure) {
    const s = new Writer();
    int(s, 1, m.remoteConfigure.code1);
    const d = m.remoteConfigure.deviceInfo;
    if (d) {
      const di = new Writer();
      str(di, 1, d.model);
      str(di, 2, d.vendor);
      int(di, 3, d.unknown1);
      str(di, 4, d.unknown2);
      str(di, 5, d.packageName);
      str(di, 6, d.appVersion);
      s.bytes(2, di.finish());
    }
    w.bytes(RF.remoteConfigure, s.finish());
  }
  if (m.remoteSetActive) {
    const s = new Writer();
    int(s, 1, m.remoteSetActive.active);
    w.bytes(RF.remoteSetActive, s.finish());
  }
  if (m.remoteError) {
    const s = new Writer();
    if (m.remoteError.value) s.bool(1, true);
    if (m.remoteError.message) s.bytes(2, encodeRemoteMessage(m.remoteError.message));
    w.bytes(RF.remoteError, s.finish());
  }
  if (m.remotePingRequest) {
    const s = new Writer();
    int(s, 1, m.remotePingRequest.val1);
    int(s, 2, m.remotePingRequest.val2);
    w.bytes(RF.remotePingRequest, s.finish());
  }
  if (m.remotePingResponse) {
    const s = new Writer();
    int(s, 1, m.remotePingResponse.val1);
    w.bytes(RF.remotePingResponse, s.finish());
  }
  if (m.remoteKeyInject) {
    const s = new Writer();
    int(s, 1, m.remoteKeyInject.keyCode);
    int(s, 2, m.remoteKeyInject.direction);
    w.bytes(RF.remoteKeyInject, s.finish());
  }
  if (m.remoteStart) {
    const s = new Writer();
    if (m.remoteStart.started) s.bool(1, true);
    w.bytes(RF.remoteStart, s.finish());
  }
  if (m.remoteAppLinkLaunchRequest) {
    const s = new Writer();
    str(s, 1, m.remoteAppLinkLaunchRequest.appLink);
    w.bytes(RF.remoteAppLinkLaunchRequest, s.finish());
  }
  return w.finish();
}

export function decodeRemoteMessage(buf: Uint8Array): RemoteMessage {
  const f = readFields(buf);
  const m: RemoteMessage = {};
  const cfg = subOf(f, RF.remoteConfigure);
  if (cfg) {
    m.remoteConfigure = { code1: intOf(cfg, 1) };
    const d = subOf(cfg, 2);
    if (d) {
      const info: RemoteDeviceInfo = {};
      const model = strOf(d, 1);
      const vendor = strOf(d, 2);
      const u2 = strOf(d, 4);
      const pkg = strOf(d, 5);
      const ver = strOf(d, 6);
      if (model !== undefined) info.model = model;
      if (vendor !== undefined) info.vendor = vendor;
      if (last(d, 3, WIRE_VARINT)) info.unknown1 = intOf(d, 3);
      if (u2 !== undefined) info.unknown2 = u2;
      if (pkg !== undefined) info.packageName = pkg;
      if (ver !== undefined) info.appVersion = ver;
      m.remoteConfigure.deviceInfo = info;
    }
  }
  const sa = subOf(f, RF.remoteSetActive);
  if (sa) m.remoteSetActive = { active: intOf(sa, 1) };
  const er = subOf(f, RF.remoteError);
  if (er) {
    m.remoteError = { value: boolOf(er, 1) };
    const inner = bytesOf(er, 2);
    if (inner) m.remoteError.message = decodeRemoteMessage(inner);
  }
  const pq = subOf(f, RF.remotePingRequest);
  if (pq) m.remotePingRequest = { val1: intOf(pq, 1), val2: intOf(pq, 2) };
  const pr = subOf(f, RF.remotePingResponse);
  if (pr) m.remotePingResponse = { val1: intOf(pr, 1) };
  const ki = subOf(f, RF.remoteKeyInject);
  if (ki) m.remoteKeyInject = { keyCode: intOf(ki, 1), direction: intOf(ki, 2) };
  const st = subOf(f, RF.remoteStart);
  if (st) m.remoteStart = { started: boolOf(st, 1) };
  const al = subOf(f, RF.remoteAppLinkLaunchRequest);
  if (al) m.remoteAppLinkLaunchRequest = { appLink: strOf(al, 1) ?? '' };
  const unknown = [...new Set(f.filter((x) => !MODELLED.has(x.no)).map((x) => x.no))];
  if (unknown.length > 0) m.unknown = unknown;
  return m;
}

// ---------------------------------------------------------------- hex helpers (fixtures, logs)

export function toHex(b: Uint8Array): string {
  let s = '';
  for (const x of b) s += x.toString(16).padStart(2, '0');
  return s;
}

/** Parses hex, ignoring whitespace. Throws on odd length or non-hex characters. */
export function fromHex(hex: string): Uint8Array {
  const h = hex.replace(/\s+/g, '');
  if (h.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(h)) throw new Error('invalid hex');
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}
