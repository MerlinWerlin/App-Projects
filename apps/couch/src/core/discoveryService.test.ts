import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FetchLike, UdpLike } from './driver';
import type { MdnsRecord } from './discovery';
import { discoverTvs, type MdnsLike } from './discoveryService';

const fx = (name: string): string => readFileSync(join(__dirname, 'drivers', '__fixtures__', 'ssdp', name), 'utf8');
const bytes = (s: string): Uint8Array => Uint8Array.from(s, (ch) => ch.charCodeAt(0));
const text = (b: Uint8Array): string => String.fromCharCode(...b);

/** Fake socket: replies to each M-SEARCH with the fixtures whose ST matches. */
function fakeUdp(replies: { st: string; from: string; body: string }[], opts: { receive?: boolean } = {}) {
  const sent: { msg: string; port: number; host: string }[] = [];
  let cb: ((d: Uint8Array, from: { address: string; port: number }) => void) | null = null;
  let closed = false;
  const sock: UdpLike = {
    async send(data, port, host) {
      const msg = text(data);
      sent.push({ msg, port, host });
      for (const r of replies) if (msg.includes(`ST: ${r.st}\r\n`)) cb?.(bytes(r.body), { address: r.from, port: 1900 });
    },
    close() {
      closed = true;
    },
  };
  if (opts.receive !== false) sock.onMessage = (c) => (cb = c);
  return { sock, sent, isClosed: () => closed };
}

const noFetch: FetchLike = async () => {
  throw new Error('no network');
};
const sleep = async (): Promise<void> => undefined;

describe('discoverTvs', () => {
  it('runs SSDP for every target twice, parses replies, dedupes and closes the socket', async () => {
    const u = fakeUdp([
      { st: 'roku:ecp', from: '192.168.1.134', body: fx('roku.txt') },
      { st: 'urn:lge-com:service:webos-second-screen:1', from: '192.168.1.77', body: fx('lg.txt') },
    ]);
    const seen: string[] = [];
    const fetchCalls: string[] = [];
    const res = await discoverTvs(
      { udp: () => Promise.resolve(u.sock), fetch: async (url) => (fetchCalls.push(url), Promise.reject(new Error('x'))), localIp: '192.168.1.40', sleep },
      { onFound: (c) => seen.push(c.host) },
    );
    expect(u.sent).toHaveLength(8);
    expect(u.sent.every((s) => s.host === '239.255.255.250' && s.port === 1900)).toBe(true);
    expect(res.methods).toEqual(['ssdp']);
    expect(res.candidates.map((c) => c.platform)).toEqual(['roku', 'webos']);
    expect(seen).toEqual(['192.168.1.134', '192.168.1.77']); // onFound once per host despite two rounds
    expect(u.isClosed()).toBe(true);
    expect(fetchCalls).toEqual([]); // SSDP found TVs, so no probe
  });

  it('falls back to the subnet probe when UDP is unavailable', async () => {
    const f: FetchLike = async (url) => {
      if (url === 'http://192.168.1.134:8060/query/device-info') return { status: 200, ok: true, text: async () => fx('roku-device-info.xml') };
      throw new Error('refused');
    };
    const res = await discoverTvs({ udp: () => null, fetch: f, localIp: '192.168.1.40', sleep });
    expect(res.methods).toEqual(['probe']);
    expect(res.candidates).toHaveLength(1);
    expect(res.candidates[0]).toMatchObject({ platform: 'roku', name: 'Living Room', source: 'probe' });
  });

  it('falls back when the socket factory rejects or cannot receive', async () => {
    const r1 = await discoverTvs({ udp: () => Promise.reject(new Error('EPERM')), fetch: noFetch, localIp: '192.168.1.40', sleep });
    expect(r1.methods).toEqual(['probe']);
    expect(r1.errors[0]).toContain('EPERM');
    const u = fakeUdp([], { receive: false });
    const r2 = await discoverTvs({ udp: () => Promise.resolve(u.sock), fetch: noFetch, localIp: '192.168.1.40', sleep });
    expect(r2.methods).toEqual(['probe']);
    expect(u.isClosed()).toBe(true);
  });

  it('probes when SSDP is silent (no multicast entitlement), unless disabled', async () => {
    let probed = 0;
    const f: FetchLike = async () => {
      probed++;
      throw new Error('x');
    };
    const res = await discoverTvs({ udp: () => Promise.resolve(fakeUdp([]).sock), fetch: f, localIp: '192.168.1.40', sleep });
    expect(res.methods).toEqual(['ssdp', 'probe']);
    expect(probed).toBe(253 * 5); // Roku, Samsung, Sony, Cast and LG per host
    probed = 0;
    await discoverTvs({ udp: () => Promise.resolve(fakeUdp([]).sock), fetch: f, localIp: '192.168.1.40', sleep }, { probeIfEmpty: false });
    expect(probed).toBe(0);
  });

  it('merges mDNS results and stops the browser', async () => {
    let stopped = false;
    const rec: MdnsRecord = { type: '_androidtvremote2._tcp', name: 'Bedroom TV', addresses: ['192.168.1.60'], port: 6466 };
    const mdns: MdnsLike = {
      browse(types, on) {
        expect(types).toEqual(['_androidtvremote2._tcp', '_amzn-wplay._tcp', '_viziocast._tcp', '_googlecast._tcp']);
        on(rec);
        on({ type: '_http._tcp', addresses: ['192.168.1.2'] });
        return () => (stopped = true);
      },
    };
    const u = fakeUdp([{ st: 'roku:ecp', from: '192.168.1.134', body: fx('roku.txt') }]);
    const res = await discoverTvs({ udp: () => Promise.resolve(u.sock), fetch: noFetch, mdns, sleep });
    expect(res.methods).toEqual(['mdns', 'ssdp']);
    expect(res.candidates.map((c) => c.platform).sort()).toEqual(['androidtv', 'roku']);
    expect(stopped).toBe(true);
  });

  it('skips the probe without a local IP and does not re-probe hosts already found', async () => {
    const r = await discoverTvs({ fetch: noFetch, sleep });
    expect(r).toEqual({ candidates: [], methods: [], errors: [], localIp: null, probed: 0, tlsCheck: false });

    const probedHosts = new Set<string>();
    const f: FetchLike = async (url) => {
      probedHosts.add(url.split('/')[2]?.split(':')[0] ?? '');
      throw new Error('x');
    };
    const mdns: MdnsLike = {
      browse(_t, on) {
        on({ type: '_amzn-wplay._tcp', addresses: ['192.168.1.61'] });
        return () => undefined;
      },
    };
    await discoverTvs({ fetch: f, mdns, localIp: '192.168.1.40', sleep });
    expect(probedHosts.has('192.168.1.61')).toBe(false);
    expect(probedHosts.size).toBe(252);
  });
});
