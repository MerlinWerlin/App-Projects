import type { Tv } from '../types';
import { FakeTimer, FakeUdp, flush, fx, recordingFetch, type FakeReply, type FetchCall } from './__tests__/fakes';
import { MOCK_CAST_TARGET } from './mockCast';
import { clearCastRenderers, createCastDriver, findCastTargets, rendererFor } from './targets';

const tv = (id: string, platform: Tv['platform'], host: string, name = id): Tv => ({ id, name, model: 'x', platform, host });

function lan(files: Record<string, string>) {
  return recordingFetch((c: FetchCall): FakeReply => {
    const f = files[c.url];
    if (!f) throw new Error('connect ECONNREFUSED');
    return { body: fx(f) };
  });
}

beforeEach(() => clearCastRenderers());

describe('findCastTargets', () => {
  it('maps mock, Roku and probed DLNA TVs; skips IR and non-LAN hosts', async () => {
    const http = lan({
      'http://192.168.1.50:9197/dmr': 'description-probe-9197.xml',
      'http://192.168.1.30:52323/dmr.xml': 'description-probe-52323.xml',
    });
    const tvs = [
      tv('demo', 'mock', 'demo', 'Demo'),
      tv('roku1', 'roku', '192.168.1.30', 'Lounge'),
      tv('sam', 'samsung', '192.168.1.50', 'Bedroom'),
      tv('lg', 'webos', '192.168.1.70'),
      tv('ir', 'ir', ''),
      tv('far', 'sony', '8.8.8.8'),
    ];
    const targets = await findCastTargets({ fetch: http.fetch, timer: new FakeTimer() }, tvs);
    expect(targets).toEqual([
      { ...MOCK_CAST_TARGET, tvId: 'demo' },
      { id: 'roku:192.168.1.30', name: 'Lounge', kind: 'roku', host: '192.168.1.30', accepts: { photo: true, video: true }, tvId: 'roku1' },
      {
        id: 'dlna:uuid:0a0b0c0d-7777-4888-9999-aaaabbbbcccc',
        name: 'Lounge',
        kind: 'dlna',
        host: '192.168.1.30',
        accepts: { photo: true, video: true },
        tvId: 'roku1',
      },
      {
        id: 'dlna:uuid:0a0b0c0d-1111-4222-8333-444455556666',
        name: 'Bedroom',
        kind: 'dlna',
        host: '192.168.1.50',
        accepts: { photo: true, video: true },
        tvId: 'sam',
      },
    ]);
    expect(http.calls.some((c) => c.url.includes('8.8.8.8'))).toBe(false);
    expect(rendererFor('dlna:uuid:0a0b0c0d-1111-4222-8333-444455556666')?.avTransportUrl).toBe(
      'http://192.168.1.50:9197/upnp/control/AVTransport1',
    );
  });

  it('adds multicast renderers, deduped against probed ones by UDN / host, matched to TVs by host', async () => {
    const http = lan({
      'http://192.168.1.40:49152/description.xml': 'description-urlbase.xml',
      'http://192.168.1.60:7676/rd.xml': 'description-probe-unicast.xml',
    });
    const timer = new FakeTimer();
    // Every socket hears both renderers (the unicast probe of .60 and the multicast search).
    const udp = async () =>
      new FakeUdp((s) => {
        s.deliver(fx('ssdp-renderer-a.txt'), '192.168.1.40');
        s.deliver(fx('ssdp-unicast-reply.txt'), '192.168.1.60');
      });
    const p = findCastTargets({ fetch: http.fetch, udp, timer }, [tv('k', 'androidtv', '192.168.1.60', 'Kitchen')]);
    await flush();
    await timer.advance(1250);
    await timer.advance(1250);
    const targets = await p;
    expect(targets.map((t) => [t.id, t.name, t.tvId])).toEqual([
      ['dlna:uuid:0a0b0c0d-dddd-4eee-8fff-000011112222', 'Kitchen', 'k'],
      ['dlna:uuid:5f9ec1b3-ed59-4f2e-9b7c-0a1b2c3d4e5f', 'Living Room & Den Screen', undefined],
    ]);
  });

  it('works with no TVs and no UDP', async () => {
    expect(await findCastTargets({ fetch: lan({}).fetch }, [])).toEqual([]);
  });
});

describe('createCastDriver', () => {
  it('builds the right driver per kind, DLNA from the remembered renderer', async () => {
    const http = lan({ 'http://192.168.1.50:9197/dmr': 'description-probe-9197.xml' });
    const env = { fetch: http.fetch, timer: new FakeTimer() };
    const [mock, dlna] = await findCastTargets(env, [tv('demo', 'mock', 'demo'), tv('sam', 'samsung', '192.168.1.50')]);
    expect(createCastDriver(mock!, env).target).toBe(mock);
    const d = createCastDriver(dlna!, env);
    expect(d.target).toBe(dlna);
    d.dispose();
    const r = createCastDriver({ id: 'roku:192.168.1.30', name: 'R', kind: 'roku', host: '192.168.1.30', accepts: { photo: true, video: true } }, env);
    expect(r.target.kind).toBe('roku');
  });

  it('refuses a DLNA target whose renderer is unknown', () => {
    expect(() =>
      createCastDriver({ id: 'dlna:unknown', name: 'X', kind: 'dlna', host: '192.168.1.9', accepts: { photo: true, video: true } }, { fetch: lan({}).fetch }),
    ).toThrow();
  });
});
