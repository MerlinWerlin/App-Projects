import { readFileSync } from 'fs';
import { join } from 'path';
import type { FetchLike, TvDriver, WsLike } from './driver';
import { SamsungDriver } from './drivers/samsung';
import { WebOsDriver } from './drivers/webos';
import { MockTv } from './drivers/mock';
import { KeepAlive, WEBOS_PING_URI, keepAlivePing, withTimeout } from './keepAlive';
import { ScriptedDriver, SocketDriver, fakeClock } from './reconnect.fakes';

const FIX = join(__dirname, 'drivers', '__fixtures__');
const fx = (p: string): string => readFileSync(join(FIX, p), 'utf8');
const WEBOS_FRAMES = JSON.parse(fx('webos/frames.json')) as Record<string, Record<string, unknown>>;
const webosFrame = (k: string, id?: string) => JSON.stringify(id === undefined ? WEBOS_FRAMES[k] : { ...WEBOS_FRAMES[k], id });

/** Minimal webOS TV on recorded frames: registers, answers every request with the given fixture. */
function webosTv(reply: string | null = 'volumeStatus') {
  const requests: string[] = [];
  const ws = async (): Promise<WsLike> => {
    const msg: ((d: string) => void)[] = [];
    return {
      send(d: string) {
        const m = JSON.parse(d) as { id: string; type: string; uri?: string };
        if (m.type === 'register') for (const cb of msg) cb(webosFrame('registered'));
        else if (m.type === 'request') {
          requests.push(m.uri!);
          const k = m.uri === 'ssap://com.webos.service.networkinput/getPointerInputSocket' ? 'pointerSocket' : reply;
          if (k) for (const cb of msg) cb(webosFrame(k, m.id));
        }
      },
      close() {},
      onMessage(cb) {
        msg.push(cb);
      },
      onClose() {},
    };
  };
  const tv = new WebOsDriver({ host: '192.168.1.77', ws, clientKey: 'k', connectTimeoutMs: 200, timeoutMs: 50 });
  return { tv, requests };
}

function samsungTv(info: string) {
  const fetch: FetchLike = async () => ({ status: 200, ok: true, text: async () => info });
  const ws = async (): Promise<WsLike> => {
    throw new Error('no socket in this test');
  };
  return new SamsungDriver({ host: '192.168.1.50', ws, fetch });
}

describe('keepAlivePing (per protocol)', () => {
  it('HTTP drivers need no keep-alive', () => {
    expect(keepAlivePing(new ScriptedDriver([], 'roku'))).toBeNull();
    expect(keepAlivePing(new ScriptedDriver([], 'sony'))).toBeNull();
    expect(keepAlivePing(new MockTv())).toBeNull();
  });

  it('webOS: an SSAP getVolume round trip on the main socket (recorded frames)', async () => {
    const { tv, requests } = webosTv();
    await tv.connect();
    const ping = keepAlivePing(tv)!;
    expect(ping).not.toBeNull();
    await ping();
    expect(requests).toContain(WEBOS_PING_URI);
  });

  it('webOS: rejects when the socket is gone', async () => {
    const { tv } = webosTv();
    await expect(keepAlivePing(tv)!()).rejects.toThrow();
  });

  it('webOS: a TV that stops answering times out', async () => {
    const { tv } = webosTv(null);
    await tv.connect();
    await expect(keepAlivePing(tv)!()).rejects.toThrow();
  });

  it('Samsung: device info answers -> alive; standby -> miss (recorded device-info)', async () => {
    await expect(keepAlivePing(samsungTv(fx('samsung/device-info-on.json')))!()).resolves.toBeUndefined();
    await expect(keepAlivePing(samsungTv(fx('samsung/device-info-standby.json')))!()).rejects.toThrow(/standby/);
  });
});

describe('withTimeout', () => {
  it('passes results through and rejects a hung promise after the timeout', async () => {
    const clock = fakeClock();
    await expect(withTimeout(Promise.resolve(3), 100, clock.timers)).resolves.toBe(3);
    expect(clock.pendingCount()).toBe(0);
    const hung = withTimeout(new Promise(() => {}), 100, clock.timers);
    let err: unknown = null;
    hung.catch((e: unknown) => (err = e));
    await clock.advance(99);
    expect(err).toBeNull();
    await clock.advance(1);
    expect(String(err)).toMatch(/timeout/);
  });
});

function setup(opts: { maxMisses?: number } = {}) {
  const clock = fakeClock();
  const dead: Array<string | null> = [];
  const k = new KeepAlive({
    timers: clock.timers,
    intervalMs: 20_000,
    timeoutMs: 4_000,
    maxMisses: opts.maxMisses ?? 2,
    onDead: (id) => dead.push(id),
  });
  const d = new SocketDriver();
  k.setTarget('tv1', d);
  return { clock, k, d, dead };
}

describe('KeepAlive', () => {
  it('pings every interval only while the driver is connected', async () => {
    const { clock, k, d } = setup();
    await clock.advance(60_000);
    expect(d.pings).toHaveLength(0);
    d.emitState('connected');
    await clock.advance(60_000);
    expect(d.pings).toEqual([WEBOS_PING_URI, WEBOS_PING_URI, WEBOS_PING_URI]);
    d.emitState('disconnected');
    expect(k.isRunning()).toBe(false);
    await clock.advance(60_000);
    expect(d.pings).toHaveLength(3);
  });

  it('starts at once for a driver already connected when bound', async () => {
    const clock = fakeClock();
    const k = new KeepAlive({ timers: clock.timers, intervalMs: 1000 });
    const d = new SocketDriver();
    k.setTarget('tv1', d, 'connected');
    await clock.advance(1000);
    expect(d.pings).toHaveLength(1);
  });

  it('is a no-op for HTTP drivers', async () => {
    const clock = fakeClock();
    const k = new KeepAlive({ timers: clock.timers, intervalMs: 1000 });
    const d = new ScriptedDriver([], 'roku');
    k.setTarget('tv1', d, 'connected');
    d.emitState('connected');
    await clock.advance(60_000);
    expect(k.isRunning()).toBe(false);
    expect(k.pings).toBe(0);
    expect(clock.pendingCount()).toBe(0);
  });

  it('pauses in the background and resumes in the foreground', async () => {
    const { clock, k, d } = setup();
    d.emitState('connected');
    await clock.advance(20_000);
    expect(d.pings).toHaveLength(1);
    k.pause();
    expect(clock.pendingCount()).toBe(0);
    await clock.advance(10 * 60_000);
    expect(d.pings).toHaveLength(1);
    k.resume();
    await clock.advance(20_000);
    expect(d.pings).toHaveLength(2);
  });

  it('one miss is tolerated; two in a row report the link dead once and stop', async () => {
    const { clock, d, dead, k } = setup();
    d.emitState('connected');
    d.pingScript = ['fail', 'ok', 'fail', 'fail', 'ok'];
    await clock.advance(40_000); // fail, ok
    expect(dead).toEqual([]);
    await clock.advance(40_000); // fail, fail -> dead
    expect(dead).toEqual(['tv1']);
    expect(k.isRunning()).toBe(false);
    await clock.advance(60_000);
    expect(d.pings).toHaveLength(4);
    // the reconnect brings the link back: pinging resumes
    d.emitState('connecting');
    d.emitState('connected');
    await clock.advance(20_000);
    expect(d.pings).toHaveLength(5);
    expect(dead).toEqual(['tv1']);
  });

  it('a ping that never answers counts as a miss after the timeout', async () => {
    const { clock, d, dead } = setup({ maxMisses: 1 });
    d.emitState('connected');
    d.pingScript = ['hang'];
    await clock.advance(20_000 + 3_999);
    expect(dead).toEqual([]);
    await clock.advance(1);
    expect(dead).toEqual(['tv1']);
  });

  it('follows the active TV and ignores the old driver', async () => {
    const clock = fakeClock();
    const k = new KeepAlive({ timers: clock.timers, intervalMs: 1000 });
    const a = new SocketDriver();
    const b = new SocketDriver();
    let active: { id: string; d: TvDriver } = { id: 'a', d: a };
    const subs = new Set<() => void>();
    k.bind({
      subscribe: (cb) => {
        subs.add(cb);
        return () => subs.delete(cb);
      },
      activeDriver: () => active.d,
      getSnapshot: () => ({ activeId: active.id, state: 'connected' }),
    });
    await clock.advance(1000);
    expect(a.pings).toHaveLength(1);
    active = { id: 'b', d: b };
    for (const s of subs) s();
    a.emitState('connected');
    await clock.advance(1000);
    expect(a.pings).toHaveLength(1);
    expect(b.pings).toHaveLength(1);
  });
});
