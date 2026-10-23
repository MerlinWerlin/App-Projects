import type { TvDriver } from './driver';
import { WEBOS_PING_URI } from './keepAlive';
import { Reconnector, DEFAULT_DELAYS_MS, FAST_DELAYS_MS, gaveUpMessage } from './reconnect';
import { ScriptedDriver, SocketDriver, fakeClock, flush } from './reconnect.fakes';

function setup(outcomes: Array<'ok' | 'fail' | 'off'> = [], opts: { maxAttempts?: number } = {}) {
  const clock = fakeClock();
  const r = new Reconnector({ timers: clock.timers, now: clock.now, random: () => 0.5, jitter: 0, ...opts });
  const d = new ScriptedDriver(outcomes);
  r.setTarget('tv1', d);
  return { clock, r, d };
}

describe('Reconnector', () => {
  it('backs off 0.5, 1, 2, 4, 8 then caps at 15 s after the driver drops', async () => {
    const { clock, r, d } = setup([], { maxAttempts: 8 });
    d.emitState('disconnected');
    expect(r.getStatus().phase).toBe('waiting');
    expect(r.getStatus().nextAt).toBe(500);
    const times: number[] = [];
    const orig = d.connect.bind(d);
    d.connect = async () => {
      times.push(clock.now());
      return orig();
    };
    await clock.advance(60_000);
    // attempts at 500, +1000, +2000, +4000, +8000, +15000, +15000, +15000 (only those within 60 s run)
    expect(times).toEqual([500, 1500, 3500, 7500, 15500, 30500, 45500, 60500].filter((t) => t <= 60_000));
    expect(DEFAULT_DELAYS_MS[DEFAULT_DELAYS_MS.length - 1]).toBe(15000);
  });

  it('gives up after max attempts with a friendly message', async () => {
    const { clock, r, d } = setup([], { maxAttempts: 3 });
    d.emitState('error');
    await clock.advance(10_000);
    expect(d.connects).toBe(3);
    expect(r.getStatus().phase).toBe('gave_up');
    expect(r.getStatus().message).toBe(gaveUpMessage(3));
    expect(r.getStatus().message).toMatch(/Reconnect now/);
    // More driver errors do not restart the run.
    d.emitState('error');
    await clock.advance(60_000);
    expect(d.connects).toBe(3);
    expect(clock.pendingCount()).toBe(0);
  });

  it('stops and resets once a retry connects', async () => {
    const { clock, r, d } = setup(['fail', 'ok']);
    d.emitState('disconnected');
    await clock.advance(500);
    expect(r.getStatus()).toMatchObject({ phase: 'waiting', attempt: 1 });
    await clock.advance(1000);
    expect(d.connects).toBe(2);
    expect(r.getStatus()).toEqual({ phase: 'connected', attempt: 0, nextAt: null, message: null });
    await clock.advance(60_000);
    expect(d.connects).toBe(2);
  });

  it('treats a TV that answers "off" as done (no retry loop)', async () => {
    const { clock, r, d } = setup(['off']);
    d.emitState('error');
    await clock.advance(500);
    expect(r.getStatus().phase).toBe('off');
    await clock.advance(60_000);
    expect(d.connects).toBe(1);
  });

  it('onForeground reconnects immediately after a long background', async () => {
    const { clock, r, d } = setup(['ok', 'ok']);
    d.emitState('connected');
    r.onBackground();
    await clock.advance(5 * 60_000);
    r.onForeground();
    await clock.advance(0);
    expect(d.connects).toBe(1);
    expect(r.getStatus().phase).toBe('connected');
  });

  it('onForeground skips a healthy socket after a short background', async () => {
    const { clock, r, d } = setup(['ok']);
    d.emitState('connected');
    r.onBackground();
    await clock.advance(5_000);
    r.onForeground();
    await clock.advance(0);
    expect(d.connects).toBe(0);
  });

  it('onForeground after a failure retries fast (250 ms)', async () => {
    const { clock, r, d } = setup(['fail', 'ok']);
    d.emitState('disconnected');
    r.onBackground();
    expect(clock.pendingCount()).toBe(0);
    r.onForeground();
    await clock.advance(0);
    expect(d.connects).toBe(1);
    expect(r.getStatus()).toMatchObject({ phase: 'waiting', attempt: 1, nextAt: 250 });
    await clock.advance(250);
    expect(d.connects).toBe(2);
    expect(r.getStatus().phase).toBe('connected');
  });

  it('background cancels pending retries and ignores drops while backgrounded', async () => {
    const { clock, r, d } = setup([]);
    d.emitState('error');
    expect(clock.pendingCount()).toBe(1);
    r.onBackground();
    expect(clock.pendingCount()).toBe(0);
    expect(r.getStatus().phase).toBe('idle');
    d.emitState('disconnected');
    await clock.advance(60_000);
    expect(d.connects).toBe(0);
  });

  it('a connect() that resolves after background is ignored', async () => {
    const clock = fakeClock();
    const r = new Reconnector({ timers: clock.timers, now: clock.now, jitter: 0 });
    let resolve!: () => void;
    const d = new ScriptedDriver();
    d.connect = () => new Promise<void>((res) => (resolve = res));
    r.setTarget('tv1', d);
    r.reconnectNow();
    expect(r.getStatus().phase).toBe('connecting');
    r.onBackground();
    resolve();
    await flush();
    expect(r.getStatus().phase).toBe('idle');
  });

  it('reconnectNow resets a gave-up run', async () => {
    const { clock, r, d } = setup([], { maxAttempts: 1 });
    d.emitState('error');
    await clock.advance(500);
    expect(r.getStatus().phase).toBe('gave_up');
    d.setOutcomes(['ok']);
    r.reconnectNow();
    await clock.advance(0);
    expect(r.getStatus().phase).toBe('connected');
    expect(d.connects).toBe(2);
  });

  it('applies injectable jitter within bounds', () => {
    const lo = new Reconnector({ random: () => 0, jitter: 0.2 });
    const hi = new Reconnector({ random: () => 0.999999, jitter: 0.2 });
    expect(lo.delayFor(0)).toBe(400);
    expect(hi.delayFor(0)).toBe(600);
    expect(lo.delayFor(99)).toBe(12000);
  });

  it('switching TVs cancels the run and follows the new driver', async () => {
    const clock = fakeClock();
    const r = new Reconnector({ timers: clock.timers, now: clock.now, jitter: 0 });
    const a = new ScriptedDriver();
    const b = new ScriptedDriver(['ok']);
    let active: { id: string; d: TvDriver } = { id: 'a', d: a };
    const subs = new Set<() => void>();
    r.bind({
      subscribe: (cb) => {
        subs.add(cb);
        return () => subs.delete(cb);
      },
      activeDriver: () => active.d,
      getSnapshot: () => ({ activeId: active.id }),
    });
    a.emitState('error');
    expect(r.attemptFor('a')).toBe(0);
    expect(clock.pendingCount()).toBe(1);
    active = { id: 'b', d: b };
    for (const s of subs) s();
    expect(clock.pendingCount()).toBe(0);
    a.emitState('error'); // old driver: unsubscribed
    expect(clock.pendingCount()).toBe(0);
    b.emitState('disconnected');
    await clock.advance(500);
    expect(b.connects).toBe(1);
    expect(a.connects).toBe(0);
  });
});

describe('Reconnector fast foreground path (T70)', () => {
  function socketSetup(outcomes: Array<'ok' | 'fail' | 'off'> = [], opts: { maxAttempts?: number; probeTimeoutMs?: number } = {}) {
    const clock = fakeClock();
    const r = new Reconnector({ timers: clock.timers, now: clock.now, random: () => 0.5, jitter: 0, ...opts });
    const d = new SocketDriver(outcomes);
    r.setTarget('tv1', d);
    return { clock, r, d };
  }

  it('retries at 0, 250 ms, 1 s, 3 s, then the normal schedule from 0.5 s', async () => {
    const { clock, r, d } = setup([], { maxAttempts: 3 });
    const times: number[] = [];
    const orig = d.connect.bind(d);
    d.connect = async () => {
      times.push(clock.now());
      return orig();
    };
    d.emitState('disconnected');
    r.onBackground();
    await clock.advance(10_000);
    const t0 = clock.now();
    r.onForeground();
    await clock.advance(0);
    await clock.advance(60_000);
    expect(times.map((t) => t - t0)).toEqual([0, 250, 1250, 4250, 4750, 5750, 7750]);
    // fast list (4) + maxAttempts (3), then one friendly message
    expect(r.getStatus()).toMatchObject({ phase: 'gave_up', attempt: 7, message: gaveUpMessage(7) });
  });

  it('fastDelayFor: fast list first, then the normal schedule', () => {
    const r = new Reconnector({ jitter: 0 });
    expect([0, 1, 2, 3, 4, 5, 6].map((n) => r.fastDelayFor(n))).toEqual([0, 250, 1000, 3000, 500, 1000, 2000]);
    expect(FAST_DELAYS_MS).toEqual([0, 250, 1000, 3000]);
  });

  it('reconnectNow and onLinkLost use the fast schedule', async () => {
    const { clock, r, d } = setup(['fail', 'ok']);
    r.reconnectNow();
    await clock.advance(0);
    expect(r.getStatus()).toMatchObject({ phase: 'waiting', attempt: 1, nextAt: 250 });
    await clock.advance(250);
    expect(r.getStatus().phase).toBe('connected');
    d.setOutcomes(['ok']);
    r.onLinkLost();
    await clock.advance(0);
    expect(d.connects).toBe(3);
    expect(r.getStatus().phase).toBe('connected');
  });

  it('a healthy socket is probed silently on foreground: no reconnect, no status change', async () => {
    const { clock, r, d } = socketSetup();
    d.emitState('connected');
    const seen: string[] = [];
    r.subscribe(() => seen.push(`${r.getStatus().phase}${r.isProbing() ? '+probe' : ''}`));
    r.onBackground();
    await clock.advance(5 * 60_000);
    r.onForeground();
    expect(r.isProbing()).toBe(true);
    await clock.advance(0);
    expect(d.pings).toEqual([WEBOS_PING_URI]);
    expect(d.connects).toBe(0);
    expect(r.isProbing()).toBe(false);
    expect(r.probeOutcome()).toBe('ok');
    expect(r.getStatus().phase).toBe('connected');
    expect(seen).toEqual(['connected+probe', 'connected']);
  });

  it('a failed probe reconnects immediately, with no gap between probe and run', async () => {
    const { clock, r, d } = socketSetup(['ok']);
    d.emitState('connected');
    d.pingScript = ['fail'];
    const modes: string[] = [];
    r.subscribe(() => modes.push(r.isProbing() ? 'probe' : r.getStatus().phase));
    r.onForeground();
    await clock.advance(0);
    expect(d.connects).toBe(1);
    expect(r.getStatus().phase).toBe('connected');
    expect(r.probeOutcome()).toBe('failed');
    // probing -> connecting (still flagged) -> connecting ... -> connected: never idle in between
    expect(modes[0]).toBe('probe');
    expect(modes[1]).toBe('probe');
    expect(modes.slice(2, -1).every((m) => m === 'connecting')).toBe(true);
    expect(modes[modes.length - 1]).toBe('connected');
  });

  it('a probe that never answers times out and reconnects', async () => {
    const { clock, r, d } = socketSetup(['ok'], { probeTimeoutMs: 2500 });
    d.emitState('connected');
    d.pingScript = ['hang'];
    r.onForeground();
    await clock.advance(2499);
    expect(d.connects).toBe(0);
    await clock.advance(1);
    expect(d.connects).toBe(1);
    expect(r.getStatus().phase).toBe('connected');
  });

  it('going to the background mid-probe cancels it (no reconnect)', async () => {
    const { clock, r, d } = socketSetup(['ok']);
    d.emitState('connected');
    d.pingScript = ['hang'];
    r.onForeground();
    r.onBackground();
    expect(r.isProbing()).toBe(false);
    expect(r.probeOutcome()).toBe('cancelled');
    await clock.advance(60_000);
    expect(d.connects).toBe(0);
  });

  it('HTTP drivers (no ping) keep the stale-socket rule', async () => {
    const { clock, r, d } = setup(['ok']);
    d.emitState('connected');
    r.onBackground();
    await clock.advance(5_000);
    r.onForeground();
    await clock.advance(0);
    expect(r.isProbing()).toBe(false);
    expect(d.connects).toBe(0);
  });
});
