import { KEYS, type Key } from '../../core/keys';
import { allKeyControls, CHANNEL, DPAD, NAV_ROW, PLAYBACK_ROW, TOP_ROW, VOLUME } from './controls';
import { SIMPLE_CONTROLS } from './simple';
import {
  delayForStep,
  HoldPress,
  NEVER_REPEAT_KEYS,
  REPEAT_KEYS,
  repeatsOnHold,
  REPEAT_DELAY,
  REPEAT_FAST,
  REPEAT_MAX_STEPS,
  REPEAT_START,
  RepeatTimer,
  type Timers,
} from './repeat';

/** Manual clock: timers fire only when advance() passes their due time. */
function fakeTimers() {
  let now = 0;
  let id = 0;
  const pending = new Map<number, { at: number; fn: () => void }>();
  const timers: Timers = {
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
  return { timers, advance, pendingCount: () => pending.size };
}

describe('delayForStep', () => {
  it('waits before the first repeat, then starts at ~110 ms', () => {
    expect(delayForStep(0)).toBe(REPEAT_DELAY);
    expect(REPEAT_DELAY).toBe(400);
    expect(delayForStep(1)).toBe(REPEAT_START);
  });

  it('accelerates monotonically to ~70 ms by step 8 and stays there', () => {
    for (let s = 1; s < 12; s++) expect(delayForStep(s + 1)).toBeLessThanOrEqual(delayForStep(s));
    expect(delayForStep(8)).toBe(REPEAT_FAST);
    expect(delayForStep(30)).toBe(REPEAT_FAST);
  });

  it('treats bad input as step 0', () => {
    expect(delayForStep(-3)).toBe(REPEAT_DELAY);
    expect(delayForStep(Number.NaN)).toBe(REPEAT_DELAY);
  });
});

describe('RepeatTimer', () => {
  it('a quick tap fires no repeats', () => {
    const f = fakeTimers();
    const steps: number[] = [];
    const r = new RepeatTimer((n) => steps.push(n), f.timers);
    r.start();
    f.advance(150);
    r.stop();
    f.advance(2000);
    expect(steps).toEqual([]);
    expect(r.repeated).toBe(false);
    expect(f.pendingCount()).toBe(0);
  });

  it('holding repeats after the delay at the scheduled pace', () => {
    const f = fakeTimers();
    const steps: number[] = [];
    const r = new RepeatTimer((n) => steps.push(n), f.timers);
    r.start();
    f.advance(399);
    expect(steps).toEqual([]);
    f.advance(1);
    expect(steps).toEqual([1]);
    f.advance(110);
    expect(steps).toEqual([1, 2]);
    expect(r.repeated).toBe(true);
    r.stop();
    f.advance(1000);
    expect(steps).toEqual([1, 2]);
    expect(r.running).toBe(false);
    expect(r.repeated).toBe(true);
  });

  it('stops at the safety cap', () => {
    const f = fakeTimers();
    let n = 0;
    const r = new RepeatTimer(() => n++, f.timers);
    r.start();
    f.advance(60_000);
    expect(n).toBe(REPEAT_MAX_STEPS);
    expect(r.running).toBe(false);
    expect(f.pendingCount()).toBe(0);
  });

  it('start() resets the count for a new press', () => {
    const f = fakeTimers();
    const r = new RepeatTimer(() => {}, f.timers);
    r.start();
    f.advance(600);
    expect(r.repeated).toBe(true);
    r.stop();
    r.start();
    expect(r.repeated).toBe(false);
    r.stop();
  });

  it('a throwing step does not break the schedule', () => {
    const f = fakeTimers();
    let n = 0;
    const r = new RepeatTimer(() => {
      n++;
      throw new Error('send failed');
    }, f.timers);
    r.start();
    f.advance(400 + 110);
    expect(n).toBe(2);
    r.stop();
  });
});

describe('which keys repeat while held (T72)', () => {
  it('every rocker, transport key and d-pad arrow repeats', () => {
    const want: Key[] = [
      VOLUME.up.key,
      VOLUME.down.key,
      CHANNEL.up.key,
      CHANNEL.down.key,
      PLAYBACK_ROW[0]!.key,
      PLAYBACK_ROW[2]!.key,
      DPAD.up.key,
      DPAD.down.key,
      DPAD.left.key,
      DPAD.right.key,
    ];
    expect(want.sort()).toEqual(['CH_DOWN', 'CH_UP', 'DOWN', 'FF', 'LEFT', 'REW', 'RIGHT', 'UP', 'VOL_DOWN', 'VOL_UP']);
    for (const k of want) expect({ k, repeats: repeatsOnHold(k) }).toEqual({ k, repeats: true });
    expect([...REPEAT_KEYS].sort()).toEqual(want.sort());
  });

  it('Power, OK, Home, Back and Mute never repeat', () => {
    for (const k of ['POWER', 'OK', 'HOME', 'BACK', 'MUTE'] as const) {
      expect({ k, repeats: repeatsOnHold(k) }).toEqual({ k, repeats: false });
      expect(NEVER_REPEAT_KEYS.has(k)).toBe(true);
    }
    expect([TOP_ROW.power.key, DPAD.ok.key, NAV_ROW[0]!.key, NAV_ROW[1]!.key].map(repeatsOnHold)).toEqual([false, false, false, false]);
    for (const k of NEVER_REPEAT_KEYS) expect(REPEAT_KEYS.has(k)).toBe(false);
  });

  it('only the listed keys repeat; play/pause, menu, source, digits and colours do not', () => {
    const repeating = KEYS.filter(repeatsOnHold);
    expect(repeating.sort()).toEqual([...REPEAT_KEYS].sort());
    for (const k of ['PLAY_PAUSE', 'MENU', 'SOURCE', 'SETTINGS', 'NUM_5', 'RED', 'ENTER', 'VOICE'] as const) {
      expect(repeatsOnHold(k)).toBe(false);
    }
    // Every on-screen repeating control is one of the rockers, transport keys or arrows.
    const onScreen = allKeyControls().filter((c) => repeatsOnHold(c.key)).map((c) => c.key);
    expect(onScreen.sort()).toEqual([...REPEAT_KEYS].sort());
    // Simple mode: Louder / Quieter / channel repeat, Power / Home do not.
    expect(SIMPLE_CONTROLS.filter((c) => repeatsOnHold(c.key)).map((c) => c.key)).toEqual(['VOL_UP', 'CH_UP', 'VOL_DOWN', 'CH_DOWN']);
  });
});

describe('HoldPress (T72)', () => {
  function rig(key: Key) {
    const f = fakeTimers();
    const log: string[] = [];
    const p = new HoldPress(
      key,
      { send: () => log.push('send'), tapFeedback: () => log.push('tap'), repeatFeedback: () => log.push('tick') },
      f.timers,
    );
    return { f, log, p };
  }

  it('a repeating key: tap sends once on release with the tap haptic', () => {
    const { f, log, p } = rig('VOL_UP');
    expect(p.repeats).toBe(true);
    p.pressIn();
    f.advance(120);
    p.pressOut();
    p.press();
    expect(log).toEqual(['tap', 'send']);
  });

  it('a repeating key: hold repeats with a haptic tick per step and sends nothing on release', () => {
    for (const k of ['VOL_DOWN', 'CH_UP', 'FF', 'REW', 'LEFT'] as const) {
      const { f, log, p } = rig(k);
      p.pressIn();
      f.advance(REPEAT_DELAY + REPEAT_START);
      p.pressOut();
      p.press();
      f.advance(5000);
      expect({ k, log }).toEqual({ k, log: ['tick', 'send', 'tick', 'send'] });
    }
  });

  it('dispose stops a held repeat (unmount mid-hold)', () => {
    const { f, log, p } = rig('CH_DOWN');
    p.pressIn();
    f.advance(REPEAT_DELAY);
    p.dispose();
    f.advance(5000);
    expect(log).toEqual(['tick', 'send']);
    expect(f.pendingCount()).toBe(0);
  });

  it('Power, OK, Home, Back, Mute: a long hold still sends exactly once, on release', () => {
    for (const k of ['POWER', 'OK', 'HOME', 'BACK', 'MUTE'] as const) {
      const { f, log, p } = rig(k);
      expect(p.repeats).toBe(false);
      p.pressIn();
      f.advance(5000);
      expect(f.pendingCount()).toBe(0);
      p.pressOut();
      p.press();
      expect({ k, log }).toEqual({ k, log: ['tap', 'send'] });
    }
  });
});
