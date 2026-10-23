import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { UdpLike } from '../driver';
import { SSDP_ADDRESS, SSDP_PORT } from '../discovery';
import { MEDIA_RENDERER_ST, dedupeByUsn, parseRendererResponse, searchRenderers } from './ssdp';
import { escapeXml, firstText, unescapeXml } from './xml';

const fx = (name: string): string => readFileSync(join(__dirname, '__fixtures__', name), 'utf8');
const bytes = (s: string): Uint8Array => Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff);
const text = (b: Uint8Array): string => String.fromCharCode(...b);

describe('xml helpers', () => {
  it('escapes and unescapes every special character', () => {
    const raw = `a & b < c > d "e" 'f'`;
    expect(escapeXml(raw)).toBe('a &amp; b &lt; c &gt; d &quot;e&quot; &apos;f&apos;');
    expect(unescapeXml(escapeXml(raw))).toBe(raw);
    expect(unescapeXml('&amp;lt;')).toBe('&lt;');
    expect(unescapeXml('&#65;&#x42;&#xZZ;')).toBe('AB&#xZZ;');
  });

  it('finds elements with or without a namespace prefix, and self-closing ones', () => {
    expect(firstText('<a:b><x:name> v &amp; w </x:name></a:b>', 'name')).toBe('v & w');
    expect(firstText('<r><name/></r>', 'name')).toBe('');
    expect(firstText('<r><nameList>x</nameList></r>', 'name')).toBeNull();
    expect(firstText('<r><t><![CDATA[a & <b>]]></t></r>', 't')).toBe('a & <b>');
  });
});

describe('parseRendererResponse (fixtures)', () => {
  it('parses an M-SEARCH reply', () => {
    expect(parseRendererResponse(fx('ssdp-renderer-a.txt'), '192.168.1.40')).toEqual({
      usn: 'uuid:5f9ec1b3-ed59-4f2e-9b7c-0a1b2c3d4e5f::urn:schemas-upnp-org:device:MediaRenderer:1',
      st: MEDIA_RENDERER_ST,
      location: 'http://192.168.1.40:49152/description.xml',
      host: '192.168.1.40',
      fromIp: '192.168.1.40',
      server: 'Linux/4.9 UPnP/1.0 GenericRenderer/2.1',
    });
  });

  it('accepts lower-case header names', () => {
    const hit = parseRendererResponse(fx('ssdp-renderer-b.txt'));
    expect(hit?.location).toBe('http://192.168.1.41:1400/xml/device_description.xml');
    expect(hit?.usn).toMatch(/^uuid:0d6b7c11/);
  });

  it('accepts NOTIFY ssdp:alive and drops byebye', () => {
    expect(parseRendererResponse(fx('ssdp-notify-alive.txt'))?.host).toBe('192.168.1.40');
    expect(parseRendererResponse(fx('ssdp-notify-byebye.txt'))).toBeNull();
  });

  it('ignores public LOCATIONs, other device types and junk', () => {
    expect(parseRendererResponse(fx('ssdp-public-location.txt'))).toBeNull();
    expect(parseRendererResponse(fx('ssdp-media-server.txt'))).toBeNull();
    expect(parseRendererResponse('')).toBeNull();
    expect(parseRendererResponse('HTTP/1.1 404 Not Found\r\n\r\n')).toBeNull();
    const https = fx('ssdp-renderer-a.txt').replace('http://192.168.1.40', 'https://192.168.1.40');
    expect(parseRendererResponse(https)).toBeNull();
    const hostname = fx('ssdp-renderer-a.txt').replace('http://192.168.1.40', 'http://tv.local');
    expect(parseRendererResponse(hostname)).toBeNull();
  });

  it('accepts later MediaRenderer versions and falls back to LOCATION without a USN', () => {
    const v2 = fx('ssdp-renderer-a.txt').replace(/MediaRenderer:1/g, 'MediaRenderer:2');
    expect(parseRendererResponse(v2)?.st).toBe('urn:schemas-upnp-org:device:MediaRenderer:2');
    const noUsn = fx('ssdp-renderer-a.txt').replace(/USN:[^\r\n]*\r\n/, '');
    expect(parseRendererResponse(noUsn)?.usn).toBe('http://192.168.1.40:49152/description.xml');
  });

  it('dedupes by USN, case-insensitively, keeping the first', () => {
    const a = parseRendererResponse(fx('ssdp-renderer-a.txt'))!;
    const again = parseRendererResponse(fx('ssdp-notify-alive.txt'))!;
    const b = parseRendererResponse(fx('ssdp-renderer-b.txt'))!;
    const upper = { ...again, usn: again.usn.toUpperCase() };
    expect(dedupeByUsn([a, again, b, upper])).toEqual([a, b]);
  });
});

class FakeUdp implements UdpLike {
  sent: { data: string; port: number; host: string }[] = [];
  closed = false;
  private cb: ((d: Uint8Array, from: { address: string; port: number }) => void) | null = null;
  async send(data: Uint8Array, port: number, host: string): Promise<void> {
    this.sent.push({ data: text(data), port, host });
  }
  close(): void {
    this.closed = true;
  }
  onMessage(cb: (d: Uint8Array, from: { address: string; port: number }) => void): void {
    this.cb = cb;
  }
  deliver(s: string, address: string): void {
    this.cb?.(bytes(s), { address, port: 1900 });
  }
}

describe('searchRenderers', () => {
  it('sends the MediaRenderer M-SEARCH twice and collects deduped replies', async () => {
    const udp = new FakeUdp();
    const found: string[] = [];
    let sleeps = 0;
    const res = await searchRenderers(
      {
        udp: async () => udp,
        sleep: async () => {
          sleeps += 1;
          udp.deliver(fx('ssdp-renderer-a.txt'), '192.168.1.40');
          udp.deliver(fx('ssdp-notify-alive.txt'), '192.168.1.40');
          udp.deliver(fx('ssdp-media-server.txt'), '192.168.1.10');
          if (sleeps === 2) udp.deliver(fx('ssdp-renderer-b.txt'), '192.168.1.41');
        },
      },
      { windowMs: 1000, onFound: (h) => found.push(h.host) },
    );
    expect(udp.sent).toHaveLength(2);
    for (const s of udp.sent) {
      expect(s).toMatchObject({ port: SSDP_PORT, host: SSDP_ADDRESS });
      expect(s.data).toContain(`ST: ${MEDIA_RENDERER_ST}\r\n`);
      expect(s.data.startsWith('M-SEARCH * HTTP/1.1\r\n')).toBe(true);
      expect(s.data.endsWith('\r\n\r\n')).toBe(true);
    }
    expect(found).toEqual(['192.168.1.40', '192.168.1.41']);
    expect(res.hits.map((h) => h.host)).toEqual(['192.168.1.40', '192.168.1.41']);
    expect(udp.closed).toBe(true);
    expect(res.errors).toEqual([]);
  });

  it('reports a missing or failing socket without throwing', async () => {
    expect(await searchRenderers({ udp: null })).toEqual({ hits: [], errors: ['udp: unavailable'] });
    const r = await searchRenderers({
      udp: async () => {
        throw new Error('boom');
      },
    });
    expect(r.hits).toEqual([]);
    expect(r.errors[0]).toMatch(/^udp: /);
    const sendOnly: UdpLike = { send: async () => undefined, close: () => undefined };
    expect((await searchRenderers({ udp: async () => sendOnly })).errors).toEqual(['udp: socket cannot receive']);
  });
});
