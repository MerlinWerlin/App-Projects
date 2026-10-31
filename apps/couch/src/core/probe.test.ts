import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FetchLike } from './driver';
import { isPrivateLanIp, parseCastEurekaInfo, parseManualIp, parseRokuDeviceInfo, parseSamsungApiV2, parseSonyInterfaceInfo, parseWebosHello, probeHost, probeSubnet, subnetHosts } from './probe';

const fx = (name: string): string => readFileSync(join(__dirname, 'drivers', '__fixtures__', 'ssdp', name), 'utf8');

type Route = { status: number; body: string } | 'throw';
function fakeFetch(routes: Record<string, Route>, calls: { url: string; timeoutMs?: number }[] = []): FetchLike {
  return async (url, init) => {
    calls.push(init?.timeoutMs !== undefined ? { url, timeoutMs: init.timeoutMs } : { url });
    const r = routes[url];
    if (r === 'throw' || r === undefined) throw new Error('ECONNREFUSED');
    return { status: r.status, ok: r.status >= 200 && r.status < 300, text: async () => r.body };
  };
}

describe('subnetHosts', () => {
  it('lists a /24 minus network, broadcast and self', () => {
    const h = subnetHosts('192.168.1.40');
    expect(h).toHaveLength(253);
    expect(h[0]).toBe('192.168.1.1');
    expect(h[h.length - 1]).toBe('192.168.1.254');
    expect(h).not.toContain('192.168.1.40');
    expect(h).not.toContain('192.168.1.0');
    expect(h).not.toContain('192.168.1.255');
  });
  it('handles /23 and narrows huge subnets to the /24', () => {
    expect(subnetHosts('10.0.3.7', '255.255.254.0')).toHaveLength(509);
    expect(subnetHosts('10.0.3.7', '255.255.254.0')[0]).toBe('10.0.2.1');
    const big = subnetHosts('10.20.30.40', '255.255.0.0');
    expect(big).toHaveLength(253);
    expect(big[0]).toBe('10.20.30.1');
  });
  it('rejects bad input', () => {
    expect(subnetHosts('nope')).toEqual([]);
    expect(subnetHosts('192.168.1.4', '255.0.255.0')).toEqual([]);
    expect(subnetHosts('192.168.1.4', '255.255.255.255')).toEqual([]);
  });
});

describe('isPrivateLanIp / parseManualIp', () => {
  it('RFC1918 only', () => {
    for (const ip of ['10.0.0.1', '172.16.0.1', '172.31.255.254', '192.168.0.10']) expect(isPrivateLanIp(ip)).toBe(true);
    for (const ip of ['172.15.0.1', '172.32.0.1', '8.8.8.8', '127.0.0.1', '169.254.1.1', 'x']) expect(isPrivateLanIp(ip)).toBe(false);
  });
  it('accepts plain, port and pasted URL forms', () => {
    expect(parseManualIp(' 192.168.1.40 ')).toEqual({ ok: true, host: '192.168.1.40' });
    expect(parseManualIp('192.168.1.40:8060')).toEqual({ ok: true, host: '192.168.1.40', port: 8060 });
    expect(parseManualIp('http://10.0.0.5:8001/api/v2/')).toEqual({ ok: true, host: '10.0.0.5', port: 8001 });
  });
  it('rejects empty, malformed, public and bad ports', () => {
    for (const s of ['', '192.168.1', '192.168.1.300', 'tv.local', '8.8.8.8', '192.168.1.4:0', '192.168.1.4:70000']) {
      expect(parseManualIp(s).ok).toBe(false);
    }
  });
});

describe('payload parsers (fixtures)', () => {
  it('Roku device-info', () => {
    expect(parseRokuDeviceInfo(fx('roku-device-info.xml'), '192.168.1.134')).toEqual({
      platform: 'roku',
      host: '192.168.1.134',
      port: 8060,
      name: 'Living Room',
      model: 'Roku Ultra',
      usn: 'X01900ABCDEF',
      location: 'http://192.168.1.134:8060/',
      source: 'probe',
    });
    expect(parseRokuDeviceInfo('<html></html>', '1.2.3.4')).toBeNull();
  });
  it('Samsung api/v2', () => {
    expect(parseSamsungApiV2(fx('samsung-api-v2.json'), '192.168.1.52')).toEqual({
      platform: 'samsung',
      host: '192.168.1.52',
      port: 8001,
      name: '[TV] Samsung Q60 Series (55)',
      model: 'QN55Q60TAFXZA',
      usn: 'uuid:0ee6a5d4-00ab-1000-8f2c-f877b8a1c2d3',
      location: 'http://192.168.1.52:8001/api/v2/',
      source: 'probe',
    });
    expect(parseSamsungApiV2('not json', '1.2.3.4')).toBeNull();
    expect(parseSamsungApiV2('{"name":"printer"}', '1.2.3.4')).toBeNull();
  });
});

describe('probeHost', () => {
  it('finds a Roku with a short timeout', async () => {
    const calls: { url: string; timeoutMs?: number }[] = [];
    const f = fakeFetch({ 'http://192.168.1.134:8060/query/device-info': { status: 200, body: fx('roku-device-info.xml') } }, calls);
    const c = await probeHost(f, '192.168.1.134', { timeoutMs: 500 });
    expect(c?.platform).toBe('roku');
    expect(calls.map((x) => x.url).sort()).toEqual([
      'http://192.168.1.134/sony/system',
      'http://192.168.1.134:3000/',
      'http://192.168.1.134:8001/api/v2/',
      'http://192.168.1.134:8008/setup/eureka_info',
      'http://192.168.1.134:8060/query/device-info',
    ]);
    expect(calls.every((x) => x.timeoutMs === 500)).toBe(true);
  });
  it('finds a Samsung', async () => {
    const f = fakeFetch({ 'http://192.168.1.52:8001/api/v2/': { status: 200, body: fx('samsung-api-v2.json') } });
    expect((await probeHost(f, '192.168.1.52'))?.platform).toBe('samsung');
  });
  it('null on errors, non-2xx and unrelated bodies', async () => {
    const f = fakeFetch({
      'http://192.168.1.9:8060/query/device-info': { status: 403, body: '' },
      'http://192.168.1.9:8001/api/v2/': { status: 200, body: '<html>router</html>' },
    });
    expect(await probeHost(f, '192.168.1.9')).toBeNull();
    expect(await probeHost(fakeFetch({}), '192.168.1.10')).toBeNull();
  });
});

describe('probeHost: brands found without multicast (owner feedback 1 Nov 2026)', () => {
  it('finds a Sony Bravia from getInterfaceInformation', async () => {
    const body = JSON.stringify({ result: [{ productCategory: 'tv', productName: 'BRAVIA', modelName: 'XR-65A80L', serverName: '', interfaceVersion: '6.0.0' }], id: 33 });
    const c = await probeHost(fakeFetch({ 'http://192.168.1.60/sony/system': { status: 200, body } }), '192.168.1.60');
    expect(c).toMatchObject({ platform: 'sony', host: '192.168.1.60', model: 'XR-65A80L', name: 'BRAVIA' });
  });
  it('finds a Google TV / Cast receiver from eureka_info', async () => {
    const body = JSON.stringify({ name: 'Living Room TV', cast_build_revision: '1.56.500000', ssdp_udn: 'abc-123', device_info: { model_name: 'Smart TV Pro' } });
    const c = await probeHost(fakeFetch({ 'http://192.168.1.61:8008/setup/eureka_info': { status: 200, body } }), '192.168.1.61');
    expect(c).toMatchObject({ platform: 'androidtv', name: 'Living Room TV', model: 'Smart TV Pro', usn: 'abc-123' });
  });
  it('finds an LG webOS TV from its SSAP hello', async () => {
    const c = await probeHost(fakeFetch({ 'http://192.168.1.62:3000/': { status: 200, body: 'Hello world' } }), '192.168.1.62');
    expect(c?.platform).toBe('webos');
  });
  it('ignores look-alikes', () => {
    expect(parseSonyInterfaceInfo(JSON.stringify({ result: [{ productCategory: 'camera' }] }), 'h')).toBeNull();
    expect(parseSonyInterfaceInfo('<html></html>', 'h')).toBeNull();
    expect(parseCastEurekaInfo(JSON.stringify({ name: 'router' }), 'h')).toBeNull();
    expect(parseWebosHello('<html>dev server</html>', 'h')).toBeNull();
  });
});

describe('probeSubnet', () => {
  it('bounds concurrency, streams finds and returns in input order', async () => {
    let inFlight = 0;
    let peak = 0;
    const base = fakeFetch({
      'http://192.168.1.52:8001/api/v2/': { status: 200, body: fx('samsung-api-v2.json') },
      'http://192.168.1.134:8060/query/device-info': { status: 200, body: fx('roku-device-info.xml') },
    });
    const f: FetchLike = async (url, init) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      try {
        return await base(url, init);
      } finally {
        inFlight--;
      }
    };
    const found: string[] = [];
    const out = await probeSubnet(f, subnetHosts('192.168.1.40'), { concurrency: 8, onFound: (c) => found.push(c.host) });
    expect(out.map((c) => [c.platform, c.host])).toEqual([
      ['samsung', '192.168.1.52'],
      ['roku', '192.168.1.134'],
    ]);
    expect(found.sort()).toEqual(['192.168.1.134', '192.168.1.52']);
    expect(peak).toBeLessThanOrEqual(16); // 8 hosts x 2 requests each
  });
  it('stops when cancelled', async () => {
    let n = 0;
    const f: FetchLike = async () => {
      n++;
      throw new Error('x');
    };
    let cancelled = false;
    await probeSubnet(f, subnetHosts('192.168.1.40'), {
      concurrency: 2,
      isCancelled: () => {
        if (n >= 10) cancelled = true;
        return cancelled;
      },
    });
    expect(n).toBeLessThan(20);
  });
});
