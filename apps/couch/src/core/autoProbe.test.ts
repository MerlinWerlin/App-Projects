import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolvePhoneIp, validPhoneIp } from './autoProbe';
import type { FetchLike, UdpLike } from './driver';
import { discoverTvs } from './discoveryService';

const fx = (...p: string[]): string => readFileSync(join(__dirname, 'drivers', '__fixtures__', ...p), 'utf8');
const bytes = (s: string): Uint8Array => Uint8Array.from(s, (ch) => ch.charCodeAt(0));
const text = (b: Uint8Array): string => String.fromCharCode(...b);
const sleep = async (): Promise<void> => undefined;

describe('validPhoneIp / resolvePhoneIp', () => {
  it('accepts only RFC 1918 IPv4', () => {
    expect(validPhoneIp('192.168.1.40')).toBe('192.168.1.40');
    expect(validPhoneIp(' 10.0.0.7 ')).toBe('10.0.0.7');
    expect(validPhoneIp('172.20.1.2')).toBe('172.20.1.2');
    for (const bad of ['0.0.0.0', '127.0.0.1', '169.254.3.4', '100.64.0.1', '8.8.8.8', 'fe80::1', '', 'nope', '192.168.01.4']) {
      expect(validPhoneIp(bad)).toBeNull();
    }
    expect(validPhoneIp(null)).toBeNull();
    expect(validPhoneIp(42)).toBeNull();
  });

  it('never throws: missing provider, rejection, junk and timeout all give null', async () => {
    expect(await resolvePhoneIp(null)).toBeNull();
    expect(await resolvePhoneIp(undefined)).toBeNull();
    expect(await resolvePhoneIp(async () => '192.168.0.9')).toBe('192.168.0.9');
    expect(await resolvePhoneIp(() => Promise.reject(new Error('no wifi')))).toBeNull();
    expect(
      await resolvePhoneIp(() => {
        throw new Error('sync');
      }),
    ).toBeNull();
    expect(await resolvePhoneIp(async () => '0.0.0.0')).toBeNull();
    expect(await resolvePhoneIp(() => new Promise<string>(() => undefined), { timeoutMs: 5 })).toBeNull();
  });
});

describe('discoverTvs with a phone IP provider (automatic subnet probe)', () => {
  const rokuAt = (host: string): FetchLike => async (url) => {
    if (url === `http://${host}:8060/query/device-info`) return { status: 200, ok: true, text: async () => fx('ssdp', 'roku-device-info.xml') };
    throw new Error('refused');
  };

  it('probes the /24 around the phone IP with no IP typing (Expo Go: no UDP)', async () => {
    const res = await discoverTvs({ fetch: rokuAt('192.168.1.134'), udp: null, mdns: null, phoneIp: async () => '192.168.1.40', sleep });
    expect(res.methods).toEqual(['probe']);
    expect(res.candidates.map((c) => c.host)).toEqual(['192.168.1.134']);
  });

  it('probes even after SSDP found TVs, skipping hosts SSDP already found (de-duplicated)', async () => {
    let cb: ((d: Uint8Array, from: { address: string; port: number }) => void) | null = null;
    const sock: UdpLike = {
      async send(data) {
        if (text(data).includes('ST: roku:ecp\r\n')) cb?.(bytes(fx('ssdp', 'roku.txt')), { address: '192.168.1.134', port: 1900 });
      },
      close() {},
      onMessage: (c) => {
        cb = c;
      },
    };
    const probed = new Set<string>();
    const f: FetchLike = async (url) => {
      const host = url.split('/')[2]?.split(':')[0] ?? '';
      probed.add(host);
      if (host === '192.168.1.90') return rokuAt('192.168.1.90')(url);
      throw new Error('refused');
    };
    const seen: string[] = [];
    const res = await discoverTvs(
      { fetch: f, udp: () => Promise.resolve(sock), phoneIp: async () => '192.168.1.40', sleep },
      { onFound: (c) => seen.push(c.host) },
    );
    expect(res.methods).toEqual(['ssdp', 'probe']);
    expect(probed.has('192.168.1.134')).toBe(false);
    expect(probed.has('192.168.1.40')).toBe(false);
    expect(probed.size).toBe(252);
    expect(res.candidates.map((c) => c.host).sort()).toEqual(['192.168.1.134', '192.168.1.90']);
    expect(seen).toEqual(['192.168.1.134', '192.168.1.90']);
  });

  it('can turn the always-probe off, and skips the probe when the provider has no usable IP', async () => {
    let calls = 0;
    const f: FetchLike = async () => {
      calls++;
      throw new Error('x');
    };
    const sock: UdpLike = { async send() {}, close() {}, onMessage: () => undefined };
    await discoverTvs({ fetch: f, udp: () => Promise.resolve(sock), phoneIp: async () => '192.168.1.40', sleep }, { alwaysProbe: false, probeIfEmpty: false });
    expect(calls).toBe(0);
    const r = await discoverTvs({ fetch: f, udp: null, phoneIp: async () => '0.0.0.0', sleep });
    expect(r.methods).toEqual([]);
    const r2 = await discoverTvs({ fetch: f, udp: null, phoneIp: () => Promise.reject(new Error('boom')), sleep });
    expect(r2.methods).toEqual([]);
    expect(calls).toBe(0);
  });

  it('an explicit localIp wins over the provider and keeps fallback-only probing', async () => {
    let asked = 0;
    const res = await discoverTvs({
      fetch: rokuAt('10.0.0.5'),
      udp: null,
      localIp: '10.0.0.2',
      phoneIp: async () => {
        asked++;
        return '192.168.1.40';
      },
      sleep,
    });
    expect(asked).toBe(0);
    expect(res.candidates.map((c) => c.host)).toEqual(['10.0.0.5']);
  });
});
