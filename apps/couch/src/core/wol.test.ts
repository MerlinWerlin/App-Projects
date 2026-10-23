import type { UdpLike } from './driver';
import { broadcastFor, buildMagicPacket, canWake, formatMac, parseMac, sendWol, wakeTargets, wakeTv } from './wol';

describe('Wake button logic', () => {
  it('derives the /24 directed broadcast from the phone IP', () => {
    expect(broadcastFor('192.168.1.40')).toBe('192.168.1.255');
    expect(broadcastFor('10.20.30.4')).toBe('10.20.30.255');
    expect(broadcastFor(null)).toBe('255.255.255.255');
    expect(broadcastFor('8.8.8.8')).toBe('255.255.255.255');
    expect(broadcastFor('garbage')).toBe('255.255.255.255');
    expect(wakeTargets('192.168.1.40')).toEqual(['192.168.1.255', '255.255.255.255']);
    expect(wakeTargets(undefined)).toEqual(['255.255.255.255']);
  });

  it('is shown only for a network TV with a valid MAC when UDP is available', () => {
    expect(canWake({ platform: 'roku', mac: 'aa:bb:cc:dd:ee:ff' }, true)).toBe(true);
    expect(canWake({ platform: 'roku', mac: 'aa:bb:cc:dd:ee:ff' }, false)).toBe(false);
    expect(canWake({ platform: 'roku' }, true)).toBe(false);
    expect(canWake({ platform: 'roku', mac: 'nope' }, true)).toBe(false);
    expect(canWake({ platform: 'ir', mac: 'aa:bb:cc:dd:ee:ff' }, true)).toBe(false);
  });

  it('sends the magic packet to the directed then limited broadcast on port 9', async () => {
    const sent: { data: Uint8Array; port: number; host: string }[] = [];
    let closed = 0;
    const factory = async (): Promise<UdpLike> => ({
      send: async (data, port, host) => {
        sent.push({ data, port, host });
      },
      close: () => {
        closed++;
      },
    });
    const r = await wakeTv(factory, 'AA-BB-CC-DD-EE-FF', { phoneIp: '192.168.1.40' });
    expect(r.ok).toBe(true);
    expect(sent.map((s) => `${s.host}:${s.port}`)).toEqual(['192.168.1.255:9', '255.255.255.255:9']);
    expect(Array.from(sent[0]!.data)).toEqual(Array.from(buildMagicPacket('aa:bb:cc:dd:ee:ff')));
    expect(closed).toBe(2);
  });

  it('never throws: errors come back as a short note', async () => {
    expect(await wakeTv(null, 'aa:bb:cc:dd:ee:ff')).toEqual({ ok: false, note: expect.any(String) });
    expect((await wakeTv(async () => ({ send: async () => undefined, close: () => undefined }), 'bad')).ok).toBe(false);
    const failing = await wakeTv(() => Promise.reject(new Error('EPERM')), 'aa:bb:cc:dd:ee:ff', { phoneIp: '192.168.1.40' });
    expect(failing.ok).toBe(false);
    expect(failing.note.length).toBeLessThan(80);
    let n = 0;
    const partial = await wakeTv(
      async () => ({
        send: async () => {
          if (n++ === 0) throw new Error('EACCES');
        },
        close: () => undefined,
      }),
      'aa:bb:cc:dd:ee:ff',
      { phoneIp: '192.168.1.40' },
    );
    expect(partial.ok).toBe(true);
  });
});

describe('parseMac', () => {
  it('accepts colon, dash and bare forms', () => {
    const want = [0xaa, 0xbb, 0xcc, 0x01, 0x02, 0x0f];
    expect(Array.from(parseMac('AA:BB:CC:01:02:0F')!)).toEqual(want);
    expect(Array.from(parseMac('aa-bb-cc-01-02-0f')!)).toEqual(want);
    expect(Array.from(parseMac(' aabbcc01020f ')!)).toEqual(want);
  });

  it('rejects bad input', () => {
    expect(parseMac('')).toBeNull();
    expect(parseMac('aa:bb:cc:dd:ee')).toBeNull();
    expect(parseMac('aa:bb-cc:dd:ee:ff')).toBeNull();
    expect(parseMac('gg:bb:cc:dd:ee:ff')).toBeNull();
    expect(parseMac('aabbccddeeff00')).toBeNull();
  });

  it('formats to lower-case colons', () => {
    expect(formatMac('AABBCC01020F')).toBe('aa:bb:cc:01:02:0f');
    expect(formatMac('nope')).toBeNull();
  });
});

describe('buildMagicPacket', () => {
  it('is 6 x 0xFF then the MAC 16 times', () => {
    const p = buildMagicPacket('01:23:45:67:89:ab');
    expect(p.length).toBe(102);
    expect(Array.from(p.slice(0, 6))).toEqual([255, 255, 255, 255, 255, 255]);
    const mac = [0x01, 0x23, 0x45, 0x67, 0x89, 0xab];
    for (let i = 0; i < 16; i++) expect(Array.from(p.slice(6 + i * 6, 12 + i * 6))).toEqual(mac);
    const expected = 'ffffffffffff' + '0123456789ab'.repeat(16);
    expect(Array.from(p, (b) => b.toString(16).padStart(2, '0')).join('')).toBe(expected);
  });

  it('throws on an invalid MAC', () => {
    expect(() => buildMagicPacket('xyz')).toThrow(/Invalid MAC/);
  });
});

describe('sendWol', () => {
  function fakeUdp() {
    const sent: { data: Uint8Array; port: number; host: string }[] = [];
    let closed = 0;
    const sock: UdpLike = {
      send: async (data, port, host) => {
        sent.push({ data, port, host });
      },
      close: () => {
        closed++;
      },
    };
    return { factory: async () => sock, sent, closed: () => closed };
  }

  it('broadcasts to 255.255.255.255:9 by default and closes', async () => {
    const f = fakeUdp();
    await sendWol(f.factory, 'aa:bb:cc:dd:ee:ff');
    expect(f.sent.length).toBe(1);
    expect(f.sent[0]!.host).toBe('255.255.255.255');
    expect(f.sent[0]!.port).toBe(9);
    expect(f.sent[0]!.data.length).toBe(102);
    expect(f.closed()).toBe(1);
  });

  it('honours broadcast/port options', async () => {
    const f = fakeUdp();
    await sendWol(f.factory, 'aabbccddeeff', { broadcast: '192.168.1.255', port: 7 });
    expect(f.sent[0]!.host).toBe('192.168.1.255');
    expect(f.sent[0]!.port).toBe(7);
  });

  it('closes the socket even when send fails', async () => {
    let closed = false;
    const sock: UdpLike = {
      send: async () => {
        throw new Error('EACCES');
      },
      close: () => {
        closed = true;
      },
    };
    await expect(sendWol(async () => sock, 'aabbccddeeff')).rejects.toThrow('EACCES');
    expect(closed).toBe(true);
  });
});
