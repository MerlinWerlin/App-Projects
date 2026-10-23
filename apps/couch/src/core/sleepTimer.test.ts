import type { Key } from './keys';
import {
  isSleepPreset,
  parseSleepDoc,
  SLEEP_GRACE_MS,
  SLEEP_PRESETS,
  SLEEP_TIMER_KEY,
  sleepRemainingParts,
  SleepTimer,
  type SleepTimers,
} from './sleepTimer';
import { MemoryKv } from './store';

const MIN = 60_000;

/** Fake wall clock + timers: timers fire only when advance() passes their due time. */
function fakeClock(start = 1_700_000_000_000) {
  let now = start;
  let id = 0;
  const pending = new Map<number, { at: number; fn: () => void }>();
  const timers: SleepTimers = {
    setTimeout: (fn, ms) => {
      id += 1;
      pending.set(id, { at: now + ms, fn });
      return id;
    },
    clearTimeout: (h) => {
      pending.delete(h as number);
    },
  };
  const advance = (ms: number) => {
    const end = now + ms;
    for (;;) {
      let next: [number, { at: number; fn: () => void }] | undefined;
      for (const e of pending) if (e[1].at <= end && (!next || e[1].at < next[1].at)) next = e;
      if (!next) break;
      pending.delete(next[0]);
      now = next[1].at;
      next[1].fn();
    }
    now = end;
  };
  /** Moves the wall clock without running timers (the phone suspended the app). */
  const jump = (ms: number) => {
    now += ms;
  };
  return { timers, advance, jump, now: () => now, pendingCount: () => pending.size };
}

function rig(opts: { kv?: MemoryKv; clock?: ReturnType<typeof fakeClock>; active?: boolean } = {}) {
  const clock = opts.clock ?? fakeClock();
  const kv = opts.kv ?? new MemoryKv();
  const sent: Key[] = [];
  const timer = new SleepTimer({ kv, send: (k) => sent.push(k), now: clock.now, timers: clock.timers, active: opts.active });
  return { clock, kv, sent, timer };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('sleep timer presets and parsing', () => {
  it('offers 15 / 30 / 45 / 60 / 90 minutes', () => {
    expect([...SLEEP_PRESETS]).toEqual([15, 30, 45, 60, 90]);
    expect(isSleepPreset(30)).toBe(true);
    expect(isSleepPreset(20)).toBe(false);
    expect(isSleepPreset('30')).toBe(false);
  });

  it('parses only well-formed stored docs', () => {
    expect(parseSleepDoc(JSON.stringify({ endsAt: 5, minutes: 45 }))).toEqual({ endsAt: 5, minutes: 45 });
    for (const bad of [null, '', 'null', '{', '[]', '{"endsAt":"x","minutes":15}', '{"endsAt":5,"minutes":20}']) {
      expect(parseSleepDoc(bad)).toBeNull();
    }
  });

  it('remaining time: whole minutes rounded up, seconds in the last minute', () => {
    expect(sleepRemainingParts(30 * MIN)).toEqual({ unit: 'minutes', count: 30 });
    expect(sleepRemainingParts(29 * MIN + 1)).toEqual({ unit: 'minutes', count: 30 });
    expect(sleepRemainingParts(MIN + 1)).toEqual({ unit: 'minutes', count: 2 });
    expect(sleepRemainingParts(MIN)).toEqual({ unit: 'seconds', count: 60 });
    expect(sleepRemainingParts(1500)).toEqual({ unit: 'seconds', count: 2 });
    expect(sleepRemainingParts(-5)).toEqual({ unit: 'seconds', count: 0 });
    expect(sleepRemainingParts(Number.NaN)).toEqual({ unit: 'seconds', count: 0 });
  });
});

describe('SleepTimer', () => {
  it('starts off; start() sets the end time and remaining time counts down', async () => {
    const { clock, timer } = rig();
    await timer.load();
    expect(timer.getSnapshot()).toEqual({ loaded: true, endsAt: null, minutes: null, notice: null });
    expect(timer.remainingMs()).toBeNull();
    await timer.start(30);
    expect(timer.getSnapshot().minutes).toBe(30);
    expect(timer.getSnapshot().endsAt).toBe(clock.now() + 30 * MIN);
    clock.advance(10 * MIN);
    expect(timer.remainingMs()).toBe(20 * MIN);
  });

  it('fires Power exactly once at expiry and turns itself off', async () => {
    const { clock, sent, timer, kv } = rig();
    await timer.load();
    await timer.start(15);
    clock.advance(15 * MIN - 1);
    expect(sent).toEqual([]);
    clock.advance(1);
    expect(sent).toEqual(['POWER']);
    expect(timer.getSnapshot().endsAt).toBeNull();
    expect(timer.getSnapshot().notice).toEqual({ kind: 'fired', at: clock.now() });
    clock.advance(120 * MIN);
    timer.setActive(true);
    timer.check();
    expect(sent).toEqual(['POWER']);
    expect(clock.pendingCount()).toBe(0);
    await flush();
    expect(kv.data.get(SLEEP_TIMER_KEY)).toBe('null');
  });

  it('cancel() stops it without sending', async () => {
    const { clock, sent, timer, kv } = rig();
    await timer.load();
    await timer.start(45);
    await timer.cancel();
    clock.advance(90 * MIN);
    expect(sent).toEqual([]);
    expect(timer.getSnapshot().endsAt).toBeNull();
    expect(timer.remainingMs()).toBeNull();
    expect(kv.data.get(SLEEP_TIMER_KEY)).toBe('null');
    expect(clock.pendingCount()).toBe(0);
  });

  it('restarting with another preset replaces the end time', async () => {
    const { clock, sent, timer } = rig();
    await timer.load();
    await timer.start(15);
    clock.advance(5 * MIN);
    await timer.start(60);
    expect(timer.remainingMs()).toBe(60 * MIN);
    clock.advance(15 * MIN);
    expect(sent).toEqual([]);
    clock.advance(45 * MIN);
    expect(sent).toEqual(['POWER']);
  });

  it('ignores a minutes value that is not a preset', async () => {
    const { timer } = rig();
    await timer.load();
    await timer.start(20 as never);
    expect(timer.getSnapshot().endsAt).toBeNull();
  });

  it('persists the end time and resumes after an app restart', async () => {
    const clock = fakeClock();
    const kv = new MemoryKv();
    const first = rig({ clock, kv });
    await first.timer.load();
    await first.timer.start(60);
    expect(JSON.parse(kv.data.get(SLEEP_TIMER_KEY)!)).toEqual({ endsAt: clock.now() + 60 * MIN, minutes: 60 });
    first.timer.dispose();

    clock.jump(20 * MIN); // app killed for 20 minutes
    const second = rig({ clock, kv });
    await second.timer.load();
    expect(second.timer.getSnapshot().minutes).toBe(60);
    expect(second.timer.remainingMs()).toBe(40 * MIN);
    clock.advance(40 * MIN);
    expect(second.sent).toEqual(['POWER']);
    expect(first.sent).toEqual([]);
  });

  it('restart after expiry within 2 minutes: fires on start-up', async () => {
    const clock = fakeClock();
    const kv = new MemoryKv();
    const first = rig({ clock, kv });
    await first.timer.load();
    await first.timer.start(30);
    first.timer.dispose();
    clock.jump(30 * MIN + 90_000);
    const second = rig({ clock, kv });
    await second.timer.load();
    expect(second.sent).toEqual(['POWER']);
  });

  it('restart long after expiry: drops it and tells the user', async () => {
    const clock = fakeClock();
    const kv = new MemoryKv();
    const first = rig({ clock, kv });
    await first.timer.load();
    await first.timer.start(30);
    const endsAt = first.timer.getSnapshot().endsAt!;
    first.timer.dispose();
    clock.jump(3 * 60 * MIN);
    const second = rig({ clock, kv });
    await second.timer.load();
    expect(second.sent).toEqual([]);
    expect(second.timer.getSnapshot()).toMatchObject({ endsAt: null, notice: { kind: 'missed', endsAt } });
    await flush();
    expect(kv.data.get(SLEEP_TIMER_KEY)).toBe('null');
    second.timer.dismissNotice();
    expect(second.timer.getSnapshot().notice).toBeNull();
  });

  it('backgrounded at expiry: nothing sent then; fires on foreground within 2 minutes', async () => {
    const { clock, sent, timer } = rig();
    await timer.load();
    await timer.start(15);
    timer.setActive(false);
    clock.advance(15 * MIN + 30_000); // JS timers may still run in the background
    expect(sent).toEqual([]);
    expect(timer.getSnapshot().endsAt).not.toBeNull();
    clock.advance(SLEEP_GRACE_MS - 30_000);
    timer.setActive(true); // exactly 2 minutes late
    expect(sent).toEqual(['POWER']);
    timer.setActive(true);
    expect(sent).toEqual(['POWER']);
  });

  it('backgrounded at expiry: foreground after more than 2 minutes drops it with a missed notice', async () => {
    const { clock, sent, timer } = rig();
    await timer.load();
    await timer.start(15);
    const endsAt = timer.getSnapshot().endsAt!;
    timer.setActive(false);
    clock.jump(15 * MIN + SLEEP_GRACE_MS + 1);
    timer.setActive(true);
    expect(sent).toEqual([]);
    expect(timer.getSnapshot()).toMatchObject({ endsAt: null, minutes: null, notice: { kind: 'missed', endsAt } });
  });

  it('backgrounded and foregrounded before expiry: keeps running and fires on time', async () => {
    const { clock, sent, timer } = rig({ active: true });
    await timer.load();
    await timer.start(30);
    timer.setActive(false);
    clock.jump(10 * MIN);
    timer.setActive(true);
    expect(timer.remainingMs()).toBe(20 * MIN);
    clock.advance(20 * MIN);
    expect(sent).toEqual(['POWER']);
  });

  it('a throwing or rejecting sender never re-fires', async () => {
    const clock = fakeClock();
    let calls = 0;
    const timer = new SleepTimer({
      kv: new MemoryKv(),
      now: clock.now,
      timers: clock.timers,
      send: () => {
        calls += 1;
        throw new Error('offline');
      },
    });
    await timer.load();
    await timer.start(15);
    clock.advance(16 * MIN);
    timer.check();
    expect(calls).toBe(1);

    const t2 = new SleepTimer({ kv: new MemoryKv(), now: clock.now, timers: clock.timers, send: () => Promise.reject(new Error('x')) });
    await t2.load();
    await t2.start(15);
    clock.advance(15 * MIN);
    await flush();
    expect(t2.getSnapshot().notice?.kind).toBe('fired');
  });

  it('notifies subscribers on start, cancel and fire', async () => {
    const { clock, timer } = rig();
    let n = 0;
    timer.subscribe(() => n++);
    await timer.load();
    const base = n;
    await timer.start(15);
    await timer.cancel();
    await timer.start(15);
    clock.advance(15 * MIN);
    expect(n).toBe(base + 4);
  });

  it('survives a storage that throws', async () => {
    const clock = fakeClock();
    const kv = {
      getItem: () => Promise.reject(new Error('io')),
      setItem: () => Promise.reject(new Error('io')),
    };
    const sent: Key[] = [];
    const timer = new SleepTimer({ kv, send: (k) => sent.push(k), now: clock.now, timers: clock.timers });
    await timer.load();
    await timer.start(15);
    clock.advance(15 * MIN);
    expect(sent).toEqual(['POWER']);
  });
});
