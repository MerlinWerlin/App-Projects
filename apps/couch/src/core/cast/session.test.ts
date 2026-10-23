import { driverError } from '../drivers/errors';
import type { AvTransport, PositionInfo, TransportInfo } from './avTransport';
import type { CastMedia } from './didl';
import { CastSession, type CastState, type CastTimer } from './session';

const VIDEO: CastMedia = { url: 'http://192.168.1.20:8090/abcdefghijklmnopqrstuv.mp4', title: 'Clip', mime: 'video/mp4', kind: 'video', durationSec: 120 };
const PHOTO: CastMedia = { url: 'http://192.168.1.20:8090/abcdefghijklmnopqrstuv.jpg', title: 'Pic', mime: 'image/jpeg', kind: 'photo' };

class FakeTimer implements CastTimer {
  t = 0;
  intervals = new Map<number, { cb: () => void; ms: number }>();
  private next = 1;
  setInterval(cb: () => void, ms: number): unknown {
    const id = this.next++;
    this.intervals.set(id, { cb, ms });
    return id;
  }
  clearInterval(h: unknown): void {
    this.intervals.delete(h as number);
  }
  now(): number {
    return this.t;
  }
  /** Advances time by one poll period and fires every interval once. */
  async tick(ms = 1000): Promise<void> {
    this.t += ms;
    for (const { cb } of [...this.intervals.values()]) cb();
    await flush();
  }
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

class FakeAvt implements AvTransport {
  calls: string[] = [];
  state: string = 'TRANSITIONING';
  pos: PositionInfo = { durationSec: null, positionSec: null, trackUri: null };
  fail: Partial<Record<string, Error>> = {};
  gate: Promise<void> | null = null;

  private async run(name: string): Promise<void> {
    this.calls.push(name);
    if (this.gate && name === 'setUri') await this.gate;
    const e = this.fail[name];
    if (e) throw e;
  }
  setUri = async (_m: CastMedia): Promise<void> => this.run('setUri');
  play = async (): Promise<void> => this.run('play');
  pause = async (): Promise<void> => this.run('pause');
  stop = async (): Promise<void> => this.run('stop');
  seek = async (s: number): Promise<void> => this.run(`seek:${s}`);
  getTransportInfo = async (): Promise<TransportInfo> => {
    await this.run('info');
    return { state: this.state, status: 'OK', speed: '1' };
  };
  getPositionInfo = async (): Promise<PositionInfo> => {
    await this.run('pos');
    return this.pos;
  };
}

function setup(opts = {}): { avt: FakeAvt; timer: FakeTimer; s: CastSession; states: CastState[] } {
  const avt = new FakeAvt();
  const timer = new FakeTimer();
  const s = new CastSession(avt, timer, { pollMs: 1000, loadTimeoutMs: 5000, maxPollFailures: 3, ...opts });
  const states: CastState[] = [];
  s.subscribe((snap) => {
    if (states[states.length - 1] !== snap.state) states.push(snap.state);
  });
  return { avt, timer, s, states };
}

describe('CastSession', () => {
  it('starts idle', () => {
    const { s } = setup();
    expect(s.snapshot).toEqual({ state: 'idle', media: null, positionSec: null, durationSec: null, error: null, errorCode: null });
  });

  it('idle -> loading -> playing -> paused -> playing -> stopped for a video', async () => {
    const { avt, timer, s, states } = setup();
    await s.load(VIDEO);
    expect(avt.calls).toEqual(['setUri', 'play']);
    expect(s.snapshot.state).toBe('loading');
    expect(s.snapshot.durationSec).toBe(120);
    expect(timer.intervals.size).toBe(1);

    await timer.tick(); // TRANSITIONING: still loading
    expect(s.snapshot.state).toBe('loading');

    avt.state = 'PLAYING';
    avt.pos = { durationSec: 121.5, positionSec: 3, trackUri: null };
    await timer.tick();
    expect(s.snapshot).toMatchObject({ state: 'playing', positionSec: 3, durationSec: 121.5 });

    await s.pause();
    expect(s.snapshot.state).toBe('paused');
    avt.state = 'PAUSED_PLAYBACK';
    await timer.tick();
    expect(s.snapshot.state).toBe('paused');

    await s.resume();
    expect(s.snapshot.state).toBe('playing');
    avt.state = 'STOPPED'; // finished on the TV
    await timer.tick();
    expect(s.snapshot.state).toBe('stopped');
    expect(timer.intervals.size).toBe(0);
    expect(states).toEqual(['loading', 'playing', 'paused', 'playing', 'stopped']);
  });

  it('treats STOPPED right after Play as still loading, then times out', async () => {
    const { avt, timer, s } = setup();
    await s.load(VIDEO);
    avt.state = 'STOPPED';
    await timer.tick(1000);
    expect(s.snapshot.state).toBe('loading');
    await timer.tick(3000);
    expect(s.snapshot.state).toBe('loading');
    await timer.tick(1000);
    expect(s.snapshot).toMatchObject({ state: 'error', errorCode: 'timeout', error: 'The TV did not start playing in time.' });
    expect(timer.intervals.size).toBe(0);
  });

  it('a photo goes straight to playing and is not polled', async () => {
    const { avt, timer, s } = setup();
    await s.load(PHOTO);
    expect(s.snapshot.state).toBe('playing');
    expect(s.snapshot.durationSec).toBeNull();
    expect(timer.intervals.size).toBe(0);
    await expect(s.pause()).rejects.toMatchObject({ code: 'unsupported' });
    await expect(s.seek(5)).rejects.toMatchObject({ code: 'unsupported' });
    await s.stop();
    expect(avt.calls).toEqual(['setUri', 'play', 'stop']);
    expect(s.snapshot.state).toBe('stopped');
  });

  it('a failed load lands in error with the translated message', async () => {
    const { avt, timer, s } = setup();
    avt.fail.setUri = driverError('unsupported', 'core.driver.cast.formatUnsupported');
    const snap = await s.load(VIDEO);
    expect(snap).toMatchObject({ state: 'error', errorCode: 'unsupported', error: "The TV can't play this kind of file." });
    expect(avt.calls).toEqual(['setUri']);
    expect(timer.intervals.size).toBe(0);
  });

  it('a non-DriverError becomes a network error', async () => {
    const { avt, s } = setup();
    avt.fail.play = new Error('socket hang up');
    await s.load(VIDEO);
    expect(s.snapshot).toMatchObject({ state: 'error', errorCode: 'network' });
    expect(s.snapshot.error).toContain('socket hang up');
  });

  it('gives up after maxPollFailures consecutive poll errors, but recovers from fewer', async () => {
    const { avt, timer, s } = setup();
    await s.load(VIDEO);
    avt.state = 'PLAYING';
    await timer.tick();
    avt.fail.info = driverError('network', 'core.driver.common.unreachable');
    await timer.tick();
    await timer.tick();
    expect(s.snapshot.state).toBe('playing');
    delete avt.fail.info;
    await timer.tick();
    avt.fail.info = driverError('network', 'core.driver.common.unreachable');
    await timer.tick();
    await timer.tick();
    expect(s.snapshot.state).toBe('playing');
    await timer.tick();
    expect(s.snapshot).toMatchObject({ state: 'error', errorCode: 'network' });
    expect(timer.intervals.size).toBe(0);
  });

  it('seek clamps to 0..duration and updates the position', async () => {
    const { avt, timer, s } = setup();
    await s.load(VIDEO);
    avt.state = 'PLAYING';
    await timer.tick();
    await s.seek(500);
    await s.seek(-3);
    await s.seek(42.7);
    expect(avt.calls.filter((c) => c.startsWith('seek'))).toEqual(['seek:120', 'seek:0', 'seek:42']);
    expect(s.snapshot.positionSec).toBe(42);
  });

  it('a refused command rejects and keeps the state', async () => {
    const { avt, timer, s } = setup();
    await s.load(VIDEO);
    avt.state = 'PLAYING';
    await timer.tick();
    avt.fail.pause = driverError('unsupported', 'core.driver.cast.notNow');
    await expect(s.pause()).rejects.toMatchObject({ code: 'unsupported' });
    expect(s.snapshot.state).toBe('playing');
  });

  it('commands in the wrong state are refused without a request', async () => {
    const { avt, s } = setup();
    await expect(s.pause()).rejects.toMatchObject({ message: "The TV can't do that right now." });
    await expect(s.resume()).rejects.toMatchObject({ code: 'unsupported' });
    await s.stop(); // idle: no-op
    expect(avt.calls).toEqual([]);
  });

  it('stop during loading wins over the load still in flight', async () => {
    const { avt, timer, s } = setup();
    let open!: () => void;
    avt.gate = new Promise<void>((r) => (open = r));
    const loading = s.load(VIDEO);
    await flush();
    expect(s.snapshot.state).toBe('loading');
    await s.stop();
    open();
    await loading;
    expect(s.snapshot.state).toBe('stopped');
    expect(avt.calls).toEqual(['setUri', 'stop']);
    expect(timer.intervals.size).toBe(0);
  });

  it('a second load replaces the first', async () => {
    const { avt, timer, s } = setup();
    await s.load(VIDEO);
    await s.load(PHOTO);
    expect(s.snapshot).toMatchObject({ state: 'playing', media: PHOTO });
    expect(timer.intervals.size).toBe(0);
    expect(avt.calls).toEqual(['setUri', 'play', 'setUri', 'play']);
  });

  it('dispose stops polling and notifications without sending Stop', async () => {
    const { avt, timer, s, states } = setup();
    await s.load(VIDEO);
    s.dispose();
    expect(timer.intervals.size).toBe(0);
    await s.poll();
    await s.load(VIDEO);
    expect(states).toEqual(['loading']);
    expect(avt.calls).toEqual(['setUri', 'play']);
  });

  it('skips a poll while one is still in flight', async () => {
    const { avt, timer, s } = setup();
    await s.load(VIDEO);
    let release!: () => void;
    const slow = new Promise<void>((r) => (release = r));
    avt.getTransportInfo = async () => {
      avt.calls.push('info');
      await slow;
      return { state: 'PLAYING', status: 'OK', speed: '1' };
    };
    timer.intervals.forEach(({ cb }) => cb());
    timer.intervals.forEach(({ cb }) => cb());
    expect(avt.calls.filter((c) => c === 'info')).toHaveLength(1);
    release();
    await flush();
    expect(s.snapshot.state).toBe('playing');
  });
});
