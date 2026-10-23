import { readFileSync } from 'fs';
import { join } from 'path';
import {
  EncodingType,
  FrameReader,
  KeyDirection,
  PairingStatus,
  RF,
  RoleType,
  Writer,
  decodePairingMessage,
  decodeRemoteMessage,
  decodeVarint,
  encodePairingMessage,
  encodeRemoteMessage,
  encodeVarint,
  frame,
  fromHex,
  pairingConfigurationMessage,
  pairingOptionsMessage,
  pairingRequestMessage,
  pairingSecretMessage,
  readFields,
  toHex,
  type PairingMessage,
  type RemoteMessage,
} from './proto';
import { COUCH_APP_PACKAGE } from '../../appIdentity';

const FX = JSON.parse(readFileSync(join(__dirname, '..', '__fixtures__', 'androidtv', 'frames.json'), 'utf8')) as Record<
  string,
  Record<string, string>
>;
const fx = (group: string, k: string): Uint8Array => fromHex(FX[group]![k]!);
const hex = (s: string): string => s.replace(/\s+/g, '').toLowerCase();
/** Strips the varint length prefix of one whole frame, checking it. */
function unframe(b: Uint8Array): Uint8Array {
  const r = new FrameReader().push(b);
  expect(r).toHaveLength(1);
  return r[0]!;
}

describe('varint', () => {
  test.each([
    [0, '00'],
    [1, '01'],
    [127, '7f'],
    [128, '8001'],
    [200, 'c801'],
    [300, 'ac02'],
    [622, 'ee04'],
    [16384, '808001'],
    [0xffffffff, 'ffffffff0f'],
  ])('%d -> %s', (n, h) => {
    expect(toHex(encodeVarint(n))).toBe(h);
    expect(decodeVarint(fromHex(h))).toEqual({ value: BigInt(n), next: h.length / 2 });
  });

  test('negative int32 is 10 bytes two\'s complement', () => {
    expect(toHex(encodeVarint(-1))).toBe('ffffffffffffffffff01');
    const w = new Writer().varint(1, -2).finish();
    const f = readFields(w);
    expect(f[0]!.int).toBe((1n << 64n) - 2n);
  });

  test('truncated varint returns null; overlong throws', () => {
    expect(decodeVarint(fromHex('80'))).toBeNull();
    expect(() => decodeVarint(fromHex('ffffffffffffffffffffff01'))).toThrow();
  });
});

describe('readFields', () => {
  test('throws on truncation and unsupported wire types', () => {
    expect(() => readFields(fromHex('0a05616263'))).toThrow();
    expect(() => readFields(fromHex('08'))).toThrow();
    expect(() => readFields(fromHex('0b'))).toThrow(); // wire 3 (start group)
  });
  test('skips fixed64 / fixed32 fields', () => {
    const f = readFields(fromHex('090102030405060708 15aabbccdd 0801'));
    expect(f.map((x) => [x.no, x.wire])).toEqual([
      [1, 1],
      [2, 5],
      [1, 0],
    ]);
  });
});

describe('FrameReader', () => {
  test('reassembles frames split across chunks and several frames in one chunk', () => {
    const a = frame(fromHex('0801'));
    const b = frame(new Uint8Array(200).fill(7)); // 2-byte length prefix
    const all = new Uint8Array([...a, ...b, ...a]);
    const r = new FrameReader();
    const got: Uint8Array[] = [];
    for (let i = 0; i < all.length; i += 5) got.push(...r.push(all.subarray(i, i + 5)));
    expect(got.map((g) => g.length)).toEqual([2, 200, 2]);
    expect(toHex(got[0]!)).toBe('0801');
    expect(r.pending).toBe(0);
  });
  test('rejects absurd lengths', () => {
    expect(() => new FrameReader(10).push(fromHex('0b'))).toThrow();
  });
});

describe('pairing messages: byte-exact', () => {
  test('pairing_request', () => {
    const b = frame(encodePairingMessage(pairingRequestMessage('Couch Remote')));
    expect(toHex(b)).toBe(hex(FX.pairing_client!.request!));
  });
  test('options: HEXADECIMAL x6, preferred role INPUT', () => {
    expect(toHex(frame(encodePairingMessage(pairingOptionsMessage())))).toBe(hex(FX.pairing_client!.options!));
  });
  test('configuration', () => {
    expect(toHex(frame(encodePairingMessage(pairingConfigurationMessage())))).toBe(hex(FX.pairing_client!.configuration!));
  });
  test('secret', () => {
    const s = new Uint8Array(32).map((_, i) => i);
    expect(toHex(frame(encodePairingMessage(pairingSecretMessage(s))))).toBe(hex(FX.pairing_client!.secretPrefix!) + toHex(s));
  });
});

describe('pairing messages: decode fixtures', () => {
  test('server replies', () => {
    const ack = decodePairingMessage(unframe(fx('pairing_server', 'requestAck')));
    expect(ack).toEqual({ protocolVersion: 2, status: 200, pairingRequestAck: { serverName: 'Living Room TV' } });
    const op = decodePairingMessage(unframe(fx('pairing_server', 'options')));
    expect(op.options).toEqual({
      inputEncodings: [{ type: EncodingType.HEXADECIMAL, symbolLength: 6 }],
      outputEncodings: [],
      preferredRole: RoleType.INPUT,
    });
    expect(decodePairingMessage(unframe(fx('pairing_server', 'configurationAck'))).configurationAck).toEqual({});
    expect(toHex(decodePairingMessage(unframe(fx('pairing_server', 'secretAck'))).secretAck!.secret)).toBe('deadbeef');
    expect(decodePairingMessage(unframe(fx('pairing_server', 'badSecret')))).toEqual({
      protocolVersion: 2,
      status: PairingStatus.BAD_SECRET,
    });
    expect(decodePairingMessage(unframe(fx('pairing_server', 'badConfiguration'))).status).toBe(PairingStatus.BAD_CONFIGURATION);
  });

  test('round trip of every pairing field', () => {
    const m: PairingMessage = {
      protocolVersion: 2,
      status: 200,
      pairingRequest: { serviceName: 'svc', clientName: 'Né' },
      pairingRequestAck: { serverName: 'TV' },
      options: {
        inputEncodings: [{ type: 3, symbolLength: 6 }],
        outputEncodings: [
          { type: 1, symbolLength: 4 },
          { type: 2, symbolLength: 8 },
        ],
        preferredRole: 2,
      },
      configuration: { encoding: { type: 3, symbolLength: 6 }, clientRole: 1 },
      configurationAck: {},
      secret: { secret: fromHex('0102') },
      secretAck: { secret: fromHex('0304') },
    };
    expect(decodePairingMessage(encodePairingMessage(m))).toEqual(m);
  });
});

describe('remote messages: byte-exact', () => {
  test('remote_set_active 622', () => {
    expect(toHex(frame(encodeRemoteMessage({ remoteSetActive: { active: 622 } })))).toBe(hex(FX.remote_client!.setActive!));
  });
  test('key inject DPAD_UP SHORT / OK long press', () => {
    expect(toHex(frame(encodeRemoteMessage({ remoteKeyInject: { keyCode: 19, direction: KeyDirection.SHORT } })))).toBe(
      hex(FX.remote_client!.keyUpShort!),
    );
    expect(toHex(frame(encodeRemoteMessage({ remoteKeyInject: { keyCode: 23, direction: KeyDirection.START_LONG } })))).toBe(
      hex(FX.remote_client!.okStartLong!),
    );
    expect(toHex(frame(encodeRemoteMessage({ remoteKeyInject: { keyCode: 23, direction: KeyDirection.END_LONG } })))).toBe(
      hex(FX.remote_client!.okEndLong!),
    );
  });
  test('ping response echoes val1', () => {
    expect(toHex(frame(encodeRemoteMessage({ remotePingResponse: { val1: 7 } })))).toBe(hex(FX.remote_client!.pong!));
  });
  test('remote_configure with device_info', () => {
    const b = frame(
      encodeRemoteMessage({
        remoteConfigure: {
          code1: 622,
          deviceInfo: {
            model: 'Couch Remote',
            vendor: 'Couch',
            unknown1: 1,
            unknown2: '1',
            packageName: 'com.jared797.couch',
            appVersion: '0.1.0',
          },
        },
      }),
    );
    expect(toHex(b)).toBe(hex(FX.remote_client!.configure!));
  });
  test('remote_configure fixture hand-decodes to packageName com.jared797.couch (T54)', () => {
    // Walk the raw bytes with readFields only (no decodeRemoteMessage), checking every length.
    const raw = fx('remote_client', 'configure');
    const lenV = decodeVarint(raw, 0)!;
    const len = Number(lenV.value);
    const off = lenV.next;
    expect(len).toBe(60);
    expect(raw.length - off).toBe(60);
    const top = readFields(raw.subarray(off));
    expect(top.map((f) => [f.no, f.wire])).toEqual([[1, 2]]);
    const cfgBytes = top[0]!.bytes!;
    expect(cfgBytes.length).toBe(58);
    const cfg = readFields(cfgBytes);
    expect(cfg.map((f) => f.no)).toEqual([1, 2]);
    expect(cfg[0]!.int).toBe(622n);
    const di = readFields(cfg[1]!.bytes!);
    expect(cfg[1]!.bytes!.length).toBe(53);
    const text = (no: number) => new TextDecoder().decode(di.find((f) => f.no === no)!.bytes!);
    expect(di.map((f) => f.no)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(text(1)).toBe('Couch Remote');
    expect(text(2)).toBe('Couch');
    expect(di.find((f) => f.no === 3)!.int).toBe(1n);
    expect(text(4)).toBe('1');
    const pkg = di.find((f) => f.no === 5)!.bytes!;
    expect(pkg.length).toBe(18);
    expect(text(5)).toBe('com.jared797.couch');
    expect(text(6)).toBe('0.1.0');
    expect(decodeRemoteMessage(unframe(raw)).remoteConfigure?.deviceInfo?.packageName).toBe(COUCH_APP_PACKAGE);
  });
  test('proto3 defaults are omitted; empty submessage still present', () => {
    expect(toHex(encodeRemoteMessage({ remoteStart: { started: false } }))).toBe('c20200');
    expect(toHex(encodeRemoteMessage({ remotePingResponse: { val1: 0 } }))).toBe('4a00');
  });
  test('app link launch', () => {
    const b = encodeRemoteMessage({ remoteAppLinkLaunchRequest: { appLink: 'ab' } });
    // field 90 wire 2 = 722 = d2 05
    expect(toHex(b)).toBe('d205040a026162');
  });
});

describe('remote messages: decode fixtures', () => {
  test('server frames', () => {
    expect(decodeRemoteMessage(unframe(fx('remote_server', 'configure')))).toEqual({
      remoteConfigure: { code1: 622, deviceInfo: { model: 'TestTV', vendor: 'Example' } },
    });
    expect(decodeRemoteMessage(unframe(fx('remote_server', 'setActive')))).toEqual({ remoteSetActive: { active: 0 } });
    expect(decodeRemoteMessage(unframe(fx('remote_server', 'startOn')))).toEqual({ remoteStart: { started: true } });
    expect(decodeRemoteMessage(unframe(fx('remote_server', 'startOff')))).toEqual({ remoteStart: { started: false } });
    expect(decodeRemoteMessage(unframe(fx('remote_server', 'ping')))).toEqual({ remotePingRequest: { val1: 7, val2: 9 } });
    expect(decodeRemoteMessage(unframe(fx('remote_server', 'error')))).toEqual({ remoteError: { value: true } });
    expect(decodeRemoteMessage(unframe(fx('remote_server', 'imeKeyInject')))).toEqual({ unknown: [RF.remoteImeKeyInject] });
  });

  test('round trip', () => {
    const msgs: RemoteMessage[] = [
      { remoteConfigure: { code1: 622, deviceInfo: { model: 'm', vendor: 'v', unknown1: 1, unknown2: '1', packageName: 'p', appVersion: '1' } } },
      { remoteSetActive: { active: 622 } },
      { remotePingRequest: { val1: 5, val2: 123456 } },
      { remotePingResponse: { val1: 5 } },
      { remoteKeyInject: { keyCode: 26, direction: 3 } },
      { remoteStart: { started: true } },
      { remoteAppLinkLaunchRequest: { appLink: 'https://www.example.com/title/1' } },
      { remoteError: { value: true, message: { remoteKeyInject: { keyCode: 3, direction: 3 } } } },
    ];
    for (const m of msgs) expect(decodeRemoteMessage(encodeRemoteMessage(m))).toEqual(m);
  });
});
