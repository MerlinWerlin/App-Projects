import { FakeTimer, FakeUdp, flush, fx, recordingFetch, type FetchCall, type FakeReply } from './__tests__/fakes';
import { buildUnicastMSearch, knownRendererUrls, probeRenderer } from './probe';

/** Serves `files` (url -> fixture name); everything else is unreachable. */
function lan(files: Record<string, string>) {
  return recordingFetch((c: FetchCall): FakeReply => {
    const f = files[c.url];
    if (!f) throw new Error('connect ECONNREFUSED');
    return { body: fx(f) };
  });
}

describe('probeRenderer', () => {
  it('lists the known description URLs for a host', () => {
    expect(knownRendererUrls('192.168.1.50')).toEqual(['http://192.168.1.50:9197/dmr', 'http://192.168.1.50:52323/dmr.xml']);
  });

  it('finds a renderer at :9197/dmr', async () => {
    const http = lan({ 'http://192.168.1.50:9197/dmr': 'description-probe-9197.xml' });
    const r = await probeRenderer('192.168.1.50', { fetch: http.fetch });
    expect(r).toMatchObject({
      name: 'Bedroom Screen',
      host: '192.168.1.50',
      udn: 'uuid:0a0b0c0d-1111-4222-8333-444455556666',
      avTransportUrl: 'http://192.168.1.50:9197/upnp/control/AVTransport1',
    });
    expect(http.calls.every((c) => c.method === 'GET')).toBe(true);
  });

  it('finds a renderer at :52323/dmr.xml when :9197 is unreachable', async () => {
    const http = lan({ 'http://192.168.1.51:52323/dmr.xml': 'description-probe-52323.xml' });
    const r = await probeRenderer('192.168.1.51', { fetch: http.fetch });
    expect(r?.name).toBe('Den Screen');
    expect(r?.avTransportUrl).toBe('http://192.168.1.51:52323/upnp/control/AVTransport');
  });

  it('the first URL in list order wins when several answer', async () => {
    const http = lan({
      'http://192.168.1.50:9197/dmr': 'description-probe-9197.xml',
      'http://192.168.1.50:52323/dmr.xml': 'description-probe-52323.xml',
    });
    expect((await probeRenderer('192.168.1.50', { fetch: http.fetch }))?.name).toBe('Bedroom Screen');
  });

  it('skips a description without AVTransport or with an off-LAN control URL', async () => {
    const http = lan({
      'http://192.168.1.50:9197/dmr': 'description-no-avtransport.xml',
      'http://192.168.1.50:52323/dmr.xml': 'description-offlan-control.xml',
    });
    expect(await probeRenderer('192.168.1.50', { fetch: http.fetch })).toBeNull();
  });

  it('returns null when nothing answers and there is no UDP', async () => {
    const http = lan({});
    expect(await probeRenderer('192.168.1.50', { fetch: http.fetch, udp: null })).toBeNull();
    expect(http.calls).toHaveLength(2);
  });

  it('refuses a non-LAN host without any request', async () => {
    const http = lan({});
    const udp = jest.fn();
    for (const h of ['8.8.8.8', 'tv.local', '127.0.0.1', '192.168.001.5', '']) {
      expect(await probeRenderer(h, { fetch: http.fetch, udp })).toBeNull();
    }
    expect(http.calls).toHaveLength(0);
    expect(udp).not.toHaveBeenCalled();
  });

  it('falls back to a unicast M-SEARCH and follows a LOCATION on the same host', async () => {
    const http = lan({ 'http://192.168.1.60:7676/rd.xml': 'description-probe-unicast.xml' });
    const sock = new FakeUdp((s, _text, host) => s.deliver(fx('ssdp-unicast-reply.txt'), host));
    const timer = new FakeTimer();
    const r = await probeRenderer('192.168.1.60', { fetch: http.fetch, udp: async () => sock, timer });
    expect(r).toMatchObject({ name: 'Kitchen Screen', avTransportUrl: 'http://192.168.1.60:7676/AVTransport/control' });
    expect(sock.sent).toEqual([{ text: buildUnicastMSearch('192.168.1.60'), port: 1900, host: '192.168.1.60' }]);
    expect(sock.sent[0]!.text).toContain('HOST: 192.168.1.60:1900\r\n');
    expect(sock.sent[0]!.text).toContain('ST: urn:schemas-upnp-org:device:MediaRenderer:1\r\n');
    expect(sock.closed).toBe(true);
    expect(timer.active).toBe(0);
  });

  it('ignores a reply pointing at another host and gives up after the timeout', async () => {
    const http = lan({});
    const sock = new FakeUdp((s, _text, host) => s.deliver(fx('ssdp-unicast-other-host.txt'), host));
    const timer = new FakeTimer();
    let done = false;
    const p = probeRenderer('192.168.1.60', { fetch: http.fetch, udp: async () => sock, timer, timeoutMs: 1500 }).then((r) => {
      done = true;
      return r;
    });
    await flush();
    expect(done).toBe(false);
    await timer.advance(1500);
    expect(await p).toBeNull();
    expect(sock.closed).toBe(true);
    expect(http.calls.some((c) => c.url.includes('192.168.1.99'))).toBe(false);
  });

  it('survives a UDP factory that throws', async () => {
    const http = lan({});
    const r = await probeRenderer('192.168.1.60', {
      fetch: http.fetch,
      udp: async () => {
        throw new Error('no udp');
      },
    });
    expect(r).toBeNull();
  });
});
