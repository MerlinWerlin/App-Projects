import type { TvDriver } from './driver';
import { Reconnector } from './reconnect';
import { linkReconnectToSession } from './reconnectLink';
import { SocketDriver, ScriptedDriver, fakeClock, flush } from './reconnect.fakes';
import { RemoteSession } from './session';
import type { Tv } from './types';

const TV: Tv = { id: 'tv1', name: 'Lounge', platform: 'webos', host: '192.168.1.77', model: 'OLED' } as Tv;
const TV2: Tv = { id: 'tv2', name: 'Bedroom', platform: 'roku', host: '192.168.1.78', model: 'Roku' } as Tv;

function setup(driver: ScriptedDriver = new SocketDriver()) {
  const clock = fakeClock();
  const session = new RemoteSession(clock.now, { timers: clock.timers });
  session.load([TV], new Map<string, TvDriver>([['tv1', driver]]), { demo: false });
  const r = new Reconnector({ timers: clock.timers, now: clock.now, jitter: 0, maxAttempts: 2 });
  r.bind(session);
  const unlink = linkReconnectToSession(r, session);
  return { clock, session, r, d: driver, unlink };
}

describe('RemoteSession key hold (T70)', () => {
  it('holds presses, then sends them in order once released ok', async () => {
    const { clock, session, d } = setup();
    session.holdKeys('reconnecting');
    expect(session.getSnapshot().reconnecting).toBe(true);
    const a = session.sendKey('UP');
    const b = session.sendKey('OK');
    expect(session.heldCount()).toBe(2);
    expect(d.sent).toEqual([]);
    await clock.advance(500);
    await session.releaseKeys(true);
    expect(await a).toBe(true);
    expect(await b).toBe(true);
    expect(d.sent).toEqual(['UP', 'OK']);
    expect(session.getSnapshot().reconnecting).toBe(false);
  });

  it('drops presses older than 2 s (they resolve false, never sent late)', async () => {
    const { clock, session, d } = setup();
    session.holdKeys('reconnecting');
    const old = session.sendKey('DOWN');
    await clock.advance(1500);
    const fresh = session.sendKey('LEFT');
    await clock.advance(600); // DOWN is now 2.1 s old: expired by the timer
    expect(await old).toBe(false);
    expect(session.heldCount()).toBe(1);
    await session.releaseKeys(true);
    expect(await fresh).toBe(true);
    expect(d.sent).toEqual(['LEFT']);
  });

  it('keeps at most 16 presses, dropping the oldest', async () => {
    const { session, d } = setup();
    session.holdKeys('probing');
    const first = session.sendKey('UP');
    for (let i = 0; i < 16; i++) void session.sendKey('RIGHT');
    expect(session.heldCount()).toBe(16);
    expect(await first).toBe(false);
    await session.releaseKeys(true);
    expect(d.sent).toHaveLength(16);
  });

  it('a failed reconnect drops held presses without a toast per press', async () => {
    const { session, d } = setup();
    session.holdKeys('reconnecting');
    const p = session.sendKey('UP');
    await session.releaseKeys(false);
    expect(await p).toBe(false);
    expect(d.sent).toEqual([]);
    expect(session.getSnapshot().lastError).toBeNull();
  });

  it('a probe holds keys but does not show "Reconnecting"', () => {
    const { session } = setup();
    session.holdKeys('probing');
    expect(session.getSnapshot().reconnecting).toBe(false);
    void session.sendKey('UP');
    expect(session.heldCount()).toBe(1);
  });

  it('driver error events are not shown while holding', () => {
    const { session, d } = setup();
    session.holdKeys('reconnecting');
    d.events.emit({ type: 'error', message: 'boom' });
    expect(session.getSnapshot().lastError).toBeNull();
    void session.releaseKeys(false);
    d.events.emit({ type: 'error', message: 'boom' });
    expect(session.getSnapshot().lastError).toBe('boom');
  });

  it('switching TV drops held presses', async () => {
    const clock = fakeClock();
    const session = new RemoteSession(clock.now, { timers: clock.timers });
    const d1 = new SocketDriver();
    const d2 = new ScriptedDriver([], 'roku');
    session.load([TV, TV2], new Map<string, TvDriver>([['tv1', d1], ['tv2', d2]]), { demo: false });
    session.holdKeys('reconnecting');
    const p = session.sendKey('UP');
    session.select('tv2');
    expect(await p).toBe(false);
  });

  it('presses made while a flush runs go after it (order kept)', async () => {
    const { session, d } = setup();
    let open!: () => void;
    const gate = new Promise<void>((res) => (open = res));
    const orig = d.sendKey.bind(d);
    let first = true;
    d.sendKey = async (k) => {
      if (first) {
        first = false;
        await gate;
      }
      return orig(k);
    };
    session.holdKeys('reconnecting');
    void session.sendKey('UP');
    const flushing = session.releaseKeys(true);
    const late = session.sendKey('DOWN');
    await flush();
    expect(d.sent).toEqual([]);
    open();
    await flushing;
    expect(await late).toBe(true);
    expect(d.sent).toEqual(['UP', 'DOWN']);
  });
});

describe('linkReconnectToSession (T70)', () => {
  it('wake with a dead socket: probe fails, fast reconnect, held presses flushed, one pill state', async () => {
    const { clock, session, r, d } = setup(new SocketDriver(['fail', 'ok']));
    d.emitState('connected');
    const pill: boolean[] = [];
    session.subscribe(() => pill.push(session.getSnapshot().reconnecting));
    r.onBackground();
    await clock.advance(10 * 60_000);
    d.pingScript = ['fail'];
    r.onForeground();
    // pressed while probing
    const a = session.sendKey('UP');
    await clock.advance(0);
    expect(session.getSnapshot().reconnecting).toBe(true);
    expect(d.connects).toBe(1);
    // pressed while waiting for the 250 ms retry
    const b = session.sendKey('OK');
    await clock.advance(250);
    expect(d.connects).toBe(2);
    expect(await a).toBe(true);
    expect(await b).toBe(true);
    expect(d.sent).toEqual(['UP', 'OK']);
    expect(session.getSnapshot().reconnecting).toBe(false);
    expect(session.getSnapshot().lastError).toBeNull();
    // the pill turned on once and off once (no flicker between attempts)
    const flips = pill.filter((v, i) => i === 0 || v !== pill[i - 1]);
    expect(flips).toEqual([false, true, false].slice(pill[0] ? 1 : 0));
  });

  it('wake with a healthy socket: silent probe, presses go straight through after it', async () => {
    const { clock, session, r, d } = setup(new SocketDriver());
    d.emitState('connected');
    r.onBackground();
    await clock.advance(60_000);
    r.onForeground();
    const p = session.sendKey('UP');
    expect(session.getSnapshot().reconnecting).toBe(false);
    await clock.advance(0);
    expect(await p).toBe(true);
    expect(d.connects).toBe(0);
    expect(d.sent).toEqual(['UP']);
  });

  it('giving up drops held presses and shows exactly one message', async () => {
    const { clock, session, r, d } = setup(new SocketDriver([]));
    r.reconnectNow();
    const p = session.sendKey('UP');
    await clock.advance(0);
    await clock.advance(60_000);
    expect(r.getStatus().phase).toBe('gave_up');
    expect(await p).toBe(false);
    expect(d.sent).toEqual([]);
    expect(session.getSnapshot().lastError).toBe(r.getStatus().message);
    expect(session.getSnapshot().reconnecting).toBe(false);
  });

  it('going to the background mid-reconnect drops held presses', async () => {
    const { clock, session, r, d } = setup(new ScriptedDriver(['fail'], 'roku'));
    r.reconnectNow();
    const p = session.sendKey('UP');
    await clock.advance(0);
    r.onBackground();
    expect(await p).toBe(false);
    expect(session.getSnapshot().reconnecting).toBe(false);
    expect(d.sent).toEqual([]);
  });
});
