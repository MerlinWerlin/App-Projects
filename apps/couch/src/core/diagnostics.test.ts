import { createDemoSession } from './demo';
import { Diagnostics, LATENCY_WINDOW, LOG_LIMIT, latencyStats } from './diagnostics';
import { Emitter, type TvDriver } from './driver';
import { RemoteSession } from './session';
import type { Tv } from './types';

const noSleep = async () => {};

class FakeDriver implements TvDriver {
  readonly platform = 'roku' as const;
  readonly capabilities = new Set<never>();
  readonly events = new Emitter();
  async connect() {}
  async disconnect() {}
  async sendKey() {}
  async sendText() {}
  async launchApp() {}
  on(cb: Parameters<Emitter['on']>[0]) {
    return this.events.on(cb);
  }
}

function fakeSource(tvs: Tv[], drivers: Map<string, TvDriver>, activeId: string | null) {
  const subs = new Set<() => void>();
  const src = {
    snap: { tvs, activeId, lastError: null as string | null, demo: false },
    subscribe(cb: () => void) {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    getSnapshot() {
      return src.snap;
    },
    activeDriver() {
      return src.snap.activeId ? (drivers.get(src.snap.activeId) ?? null) : null;
    },
    set(p: Partial<typeof src.snap>) {
      src.snap = { ...src.snap, ...p };
      for (const s of subs) s();
    },
  };
  return src;
}

const tv = (id: string, host = '192.168.1.50'): Tv => ({ id, name: `Jared's ${id}`, room: 'Den', model: 'Ultra 4K', platform: 'roku', host, token: 'secret-token', mac: 'aa:bb:cc:dd:ee:ff' });

describe('latencyStats', () => {
  it('returns null for no samples', () => {
    expect(latencyStats([])).toBeNull();
  });
  it('computes last, median, p90, min, max', () => {
    const s = latencyStats([30, 10, 20, 50, 40, 60, 70, 80, 90, 100])!;
    expect(s).toEqual({ count: 10, last: 100, median: 55, p90: 90, min: 10, max: 100 });
    expect(latencyStats([5, 1, 3])!.median).toBe(3);
  });
});

describe('Diagnostics', () => {
  it('keeps a rolling latency window per TV', () => {
    const d1 = new FakeDriver();
    const src = fakeSource([tv('a')], new Map([['a', d1]]), 'a');
    const diag = new Diagnostics();
    diag.bind(src);
    for (let i = 1; i <= LATENCY_WINDOW + 10; i++) d1.events.emit({ type: 'sent', what: 'UP', ms: i });
    const g = diag.get('a')!;
    expect(g.samples.length).toBe(LATENCY_WINDOW);
    expect(g.samples[0]).toBe(11);
    expect(diag.stats('a')!.last).toBe(LATENCY_WINDOW + 10);
    expect(diag.stats('a')!.min).toBe(11);
  });

  it('logs state transitions (bounded) with the reconnect attempt', () => {
    let t = 1000;
    let attempt = 0;
    const d1 = new FakeDriver();
    const src = fakeSource([tv('a')], new Map([['a', d1]]), 'a');
    const diag = new Diagnostics({ now: () => t, attemptFor: () => attempt });
    diag.bind(src);
    d1.events.emit({ type: 'state', state: 'connected' });
    t = 2000;
    d1.events.emit({ type: 'state', state: 'disconnected' });
    attempt = 1;
    d1.events.emit({ type: 'state', state: 'connecting' });
    d1.events.emit({ type: 'state', state: 'connecting' }); // duplicate ignored
    const log = diag.get('a')!.log;
    expect(log).toEqual([
      { at: 1000, from: null, to: 'connected', attempt: 0 },
      { at: 2000, from: 'connected', to: 'disconnected', attempt: 0 },
      { at: 2000, from: 'disconnected', to: 'connecting', attempt: 1 },
    ]);
    for (let i = 0; i < LOG_LIMIT * 2; i++) d1.events.emit({ type: 'state', state: i % 2 ? 'connected' : 'error' });
    expect(diag.get('a')!.log.length).toBe(LOG_LIMIT);
  });

  it('records driver errors and session-caught errors with time', () => {
    let t = 5000;
    const d1 = new FakeDriver();
    const src = fakeSource([tv('a')], new Map([['a', d1]]), 'a');
    const diag = new Diagnostics({ now: () => t });
    diag.bind(src);
    d1.events.emit({ type: 'error', message: 'Socket closed' });
    expect(diag.get('a')!.lastError).toEqual({ message: 'Socket closed', at: 5000 });
    t = 6000;
    src.set({ lastError: 'The TV did not answer in time.' });
    expect(diag.get('a')!.lastError).toEqual({ message: 'The TV did not answer in time.', at: 6000 });
  });

  it('keeps observing a TV after switching away, and forgets removed TVs', () => {
    const d1 = new FakeDriver();
    const d2 = new FakeDriver();
    const src = fakeSource([tv('a'), tv('b')], new Map<string, TvDriver>([['a', d1], ['b', d2]]), 'a');
    const diag = new Diagnostics();
    diag.bind(src);
    src.set({ activeId: 'b' });
    d1.events.emit({ type: 'sent', what: 'UP', ms: 12 });
    d2.events.emit({ type: 'sent', what: 'UP', ms: 34 });
    expect(diag.stats('a')!.last).toBe(12);
    expect(diag.stats('b')!.last).toBe(34);
    src.set({ tvs: [tv('b')] });
    expect(diag.get('a')).toBeNull();
    d1.events.emit({ type: 'sent', what: 'UP', ms: 99 }); // unsubscribed: no throw, no record
    expect(diag.get('a')).toBeNull();
  });

  it('works against a real RemoteSession with demo TVs', async () => {
    const demo = await createDemoSession({ sleep: noSleep, random: () => 0.5 });
    const s = new RemoteSession(() => 1000);
    const diag = new Diagnostics({ now: () => 1000 });
    diag.bind(s);
    s.load(demo.tvs, demo.drivers, { demo: true });
    await s.sendKey('UP');
    expect(diag.stats('demo-1')!.last).toBe(38);
    s.select('demo-3'); // off TV
    await s.sendKey('UP');
    expect(diag.get('demo-3')!.lastError?.message).toMatch(/off/);
  });

  it('formats a plain-text report without names, tokens or MACs', () => {
    const d1 = new FakeDriver();
    const d2 = new FakeDriver();
    const src = fakeSource([tv('a'), tv('b', 'tv.example.com')], new Map<string, TvDriver>([['a', d1], ['b', d2]]), 'a');
    const diag = new Diagnostics({ now: () => Date.UTC(2026, 9, 12, 10, 0, 0), attemptFor: () => 2 });
    diag.bind(src);
    d1.events.emit({ type: 'state', state: 'disconnected' });
    d1.events.emit({ type: 'sent', what: 'UP', ms: 20 });
    d1.events.emit({ type: 'sent', what: 'UP', ms: 40 });
    d1.events.emit({ type: 'error', message: 'Not connected to the TV.' });
    const r = diag.formatReport(Date.UTC(2026, 9, 12, 10, 0, 30), { appVersion: '0.1.0', os: 'ios 18.0' });
    expect(r).toContain('Couch diagnostics');
    expect(r).toContain('App version: 0.1.0');
    expect(r).toContain('Device OS: ios 18.0');
    expect(r).toContain('TV 1: Roku Ultra 4K [active]');
    expect(r).toContain('Address: 192.168.1.50');
    expect(r).toContain('median 30 ms');
    expect(r).toContain('Last error: Not connected to the TV.');
    expect(r).toContain('30s ago');
    expect(r).toContain('10:00:00 start -> disconnected (attempt 2)');
    expect(r).toContain('TV 2: Roku Ultra 4K');
    expect(r).toContain('(not a LAN IP, hidden)');
    expect(r).toContain('Latency: no commands sent yet');
    expect(r).not.toContain('Jared');
    expect(r).not.toContain('Den');
    expect(r).not.toContain('secret-token');
    expect(r).not.toContain('aa:bb');
    expect(r).not.toContain('example.com');
  });
});
