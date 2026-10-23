import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FetchLike, UdpLike } from '../driver';
import { DriverError } from '../types';
import { fetchRenderer, isLanHttpUrl, parseDeviceDescription, resolveUrl } from './description';
import { discoverRenderers } from './discover';

const fx = (name: string): string => readFileSync(join(__dirname, '__fixtures__', name), 'utf8');

function caught(fn: () => unknown): DriverError {
  try {
    fn();
  } catch (e) {
    if (e instanceof DriverError) return e;
    throw e;
  }
  throw new Error('did not throw');
}

describe('resolveUrl', () => {
  const base = 'http://192.168.1.41:1400/xml/device_description.xml';
  it.each([
    ['http://192.168.1.9/x', 'http://192.168.1.9/x'],
    ['//192.168.1.9:80/y', 'http://192.168.1.9:80/y'],
    ['/abs/path', 'http://192.168.1.41:1400/abs/path'],
    ['rel/path', 'http://192.168.1.41:1400/xml/rel/path'],
    ['../up/ctl', 'http://192.168.1.41:1400/up/ctl'],
    ['../../../too/far', 'http://192.168.1.41:1400/too/far'],
    ['./here?q=1', 'http://192.168.1.41:1400/xml/here?q=1'],
    ['?q=2', 'http://192.168.1.41:1400/xml/device_description.xml?q=2'],
  ])('%s', (ref, want) => {
    expect(resolveUrl(base, ref)).toBe(want);
  });

  it('handles a base without a path and rejects a base without a host', () => {
    expect(resolveUrl('http://192.168.1.40:49152', 'ctl')).toBe('http://192.168.1.40:49152/ctl');
    expect(resolveUrl('not a url', 'ctl')).toBeNull();
  });
});

describe('isLanHttpUrl', () => {
  it('accepts only http on RFC 1918 literals', () => {
    expect(isLanHttpUrl('http://10.0.0.5:8080/a')).toBe(true);
    expect(isLanHttpUrl('https://10.0.0.5/a')).toBe(false);
    expect(isLanHttpUrl('http://8.8.8.8/a')).toBe(false);
    expect(isLanHttpUrl('http://tv.local/a')).toBe(false);
    expect(isLanHttpUrl('http://127.0.0.1/a')).toBe(false);
    expect(isLanHttpUrl('http://user@192.168.1.2/a')).toBe(false);
  });
});

describe('parseDeviceDescription (fixtures)', () => {
  it('resolves controlURLs against URLBase and decodes the friendly name', () => {
    const r = parseDeviceDescription(fx('description-urlbase.xml'), 'http://192.168.1.40:49152/description.xml');
    expect(r).toEqual({
      name: 'Living Room & Den Screen',
      udn: 'uuid:5f9ec1b3-ed59-4f2e-9b7c-0a1b2c3d4e5f',
      host: '192.168.1.40',
      location: 'http://192.168.1.40:49152/description.xml',
      avTransportUrl: 'http://192.168.1.40:49152/upnp/control/AVTransport1',
      avTransportType: 'urn:schemas-upnp-org:service:AVTransport:1',
      renderingControlUrl: 'http://192.168.1.40:49152/upnp/control/RenderingControl1',
      renderingControlType: 'urn:schemas-upnp-org:service:RenderingControl:1',
      modelName: 'Screen 55',
    });
  });

  it('resolves against LOCATION when there is no URLBase (embedded device, ../, absolute)', () => {
    const loc = 'http://192.168.1.41:1400/xml/device_description.xml';
    const r = parseDeviceDescription(fx('description-relative.xml'), loc);
    expect(r.name).toBe('Kitchen Speaker & Screen');
    expect(r.avTransportUrl).toBe('http://192.168.1.41:1400/MediaRenderer/AVTransport/Control');
    expect(r.renderingControlUrl).toBe('http://192.168.1.41:1400/MediaRenderer/RenderingControl/Control');
  });

  it('refuses a description without AVTransport', () => {
    const e = caught(() => parseDeviceDescription(fx('description-no-avtransport.xml'), 'http://192.168.1.10:8200/rootDesc.xml'));
    expect(e.code).toBe('unsupported');
    expect(e.message).toBe("This TV can't receive photos or videos from a phone.");
  });

  it('refuses off-LAN locations, URLBases and control URLs', () => {
    const loc = 'http://192.168.1.40:49152/description.xml';
    expect(caught(() => parseDeviceDescription(fx('description-offlan-control.xml'), loc)).code).toBe('forbidden');
    expect(caught(() => parseDeviceDescription(fx('description-urlbase.xml'), 'http://203.0.113.5/d.xml')).code).toBe('forbidden');
    const badBase = fx('description-urlbase.xml').replace('http://192.168.1.40:49152/', 'http://203.0.113.5/');
    expect(caught(() => parseDeviceDescription(badBase, loc)).code).toBe('forbidden');
    const scheme = fx('description-relative.xml').replace('../MediaRenderer/AVTransport/Control', '//198.51.100.1/ctl');
    expect(caught(() => parseDeviceDescription(scheme, loc)).code).toBe('forbidden');
  });

  it('rejects non-description bodies and falls back to modelName / host for the name', () => {
    expect(caught(() => parseDeviceDescription('<html>hi</html>', 'http://192.168.1.40/d.xml')).code).toBe('network');
    const noName = fx('description-urlbase.xml').replace(/<friendlyName>[^<]*<\/friendlyName>/, '');
    expect(parseDeviceDescription(noName, 'http://192.168.1.40:49152/d.xml').name).toBe('Screen 55');
    const bare = noName.replace(/<modelName>[^<]*<\/modelName>/, '');
    expect(parseDeviceDescription(bare, 'http://192.168.1.40:49152/d.xml').name).toBe('192.168.1.40');
  });
});

function fakeFetch(routes: Record<string, string | number>): FetchLike & { calls: string[] } {
  const calls: string[] = [];
  const f = (async (url: string) => {
    calls.push(url);
    const r = routes[url];
    if (r === undefined) throw new Error('ECONNREFUSED');
    const status = typeof r === 'number' ? r : 200;
    return { status, ok: status >= 200 && status < 300, text: async () => (typeof r === 'string' ? r : '') };
  }) as FetchLike & { calls: string[] };
  f.calls = calls;
  return f;
}

describe('fetchRenderer', () => {
  it('never requests an off-LAN location', async () => {
    const f = fakeFetch({});
    await expect(fetchRenderer(f, 'http://203.0.113.5/d.xml')).rejects.toMatchObject({ code: 'forbidden' });
    expect(f.calls).toEqual([]);
  });

  it('maps transport errors and HTTP errors', async () => {
    const f = fakeFetch({ 'http://192.168.1.40/404.xml': 404 });
    await expect(fetchRenderer(f, 'http://192.168.1.40/none.xml')).rejects.toMatchObject({ code: 'network' });
    await expect(fetchRenderer(f, 'http://192.168.1.40/404.xml')).rejects.toMatchObject({
      code: 'network',
      message: 'The TV answered HTTP 404.',
    });
  });
});

describe('discoverRenderers', () => {
  it('searches, fetches each description, skips bad ones and dedupes by UDN', async () => {
    let cb: ((d: Uint8Array, from: { address: string; port: number }) => void) | null = null;
    const udp: UdpLike = {
      send: async () => undefined,
      close: () => undefined,
      onMessage: (c) => {
        cb = c;
      },
    };
    const deliver = (name: string, address: string): void =>
      cb?.(Uint8Array.from(fx(name), (c) => c.charCodeAt(0)), { address, port: 1900 });
    const offlan = fx('ssdp-renderer-a.txt')
      .replace('192.168.1.40:49152/description.xml', '192.168.1.50/desc.xml')
      .replace('5f9ec1b3', 'aaaaaaaa');
    const dupUdn = fx('ssdp-renderer-a.txt')
      .replace('description.xml', 'alt.xml')
      .replace('::urn:schemas-upnp-org:device:MediaRenderer:1', '::alt');
    const f = fakeFetch({
      'http://192.168.1.40:49152/description.xml': fx('description-urlbase.xml'),
      'http://192.168.1.40:49152/alt.xml': fx('description-urlbase.xml'),
      'http://192.168.1.41:1400/xml/device_description.xml': fx('description-relative.xml'),
      'http://192.168.1.50/desc.xml': fx('description-offlan-control.xml'),
    });
    const res = await discoverRenderers({
      udp: async () => udp,
      fetch: f,
      sleep: async () => {
        deliver('ssdp-renderer-a.txt', '192.168.1.40');
        deliver('ssdp-renderer-b.txt', '192.168.1.41');
        cb?.(Uint8Array.from(offlan, (c) => c.charCodeAt(0)), { address: '192.168.1.50', port: 1900 });
        cb?.(Uint8Array.from(dupUdn, (c) => c.charCodeAt(0)), { address: '192.168.1.40', port: 1900 });
      },
    });
    expect(res.renderers.map((r) => r.name)).toEqual(['Living Room & Den Screen', 'Kitchen Speaker & Screen']);
    expect(res.errors.some((e) => e.startsWith('description http://192.168.1.50/desc.xml'))).toBe(true);
  });
});
