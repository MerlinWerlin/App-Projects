import { HUD_HIDE_MS, HUD_NEUTRAL_FRACTION, HudController, hudFromEvent, type HudView, type Timers } from './hud';

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
    now += ms;
    for (const [k, e] of [...pending].sort((a, b) => a[1].at - b[1].at)) {
      if (e.at <= now && pending.has(k)) {
        pending.delete(k);
        e.fn();
      }
    }
  };
  return { timers, advance, pendingCount: () => pending.size };
}

describe('hudFromEvent', () => {
  it('shows the level with tabular-ready digits when the TV reports it', () => {
    const v = hudFromEvent({ step: 'up', level: 41.6 });
    expect(v.value).toBe('42');
    expect(v.label).toBe('Volume up, 42');
    expect(v.fraction).toBeCloseTo(0.42);
    expect(v.known).toBe(true);
  });

  it('clamps out-of-range levels', () => {
    expect(hudFromEvent({ step: 'up', level: 140 }).fraction).toBe(1);
    expect(hudFromEvent({ step: 'down', level: -5 }).value).toBe('0');
  });

  it('shows a direction and a neutral bar when the level is unknown', () => {
    const up = hudFromEvent({ step: 'up' });
    expect(up.label).toBe('Volume up');
    expect(up.value).toBe('');
    expect(up.valueIcon).toBe('up');
    expect(up.icon).toBe('speaker');
    expect(up.fraction).toBe(HUD_NEUTRAL_FRACTION);
    expect(hudFromEvent({ step: 'down', level: Number.NaN }).label).toBe('Volume down');
    expect(hudFromEvent({ step: 'down' }).valueIcon).toBe('down');
  });

  it('mute reads "Muted" with an empty bar', () => {
    const m = hudFromEvent({ step: 'mute', level: 30 });
    expect(m.label).toBe('Muted');
    expect(m.value).toBe('Muted');
    expect(m.muted).toBe(true);
    expect(m.icon).toBe('mute');
    expect(m.valueIcon).toBeNull();
    expect(m.fraction).toBe(0);
  });
});

describe('HudController', () => {
  it('shows on an event and hides after ~1.1 s of quiet', () => {
    const f = fakeTimers();
    const seen: HudView[] = [];
    const c = new HudController((v) => seen.push(v), f.timers);
    expect(c.view.visible).toBe(false);
    c.push({ step: 'up' });
    expect(c.view.visible).toBe(true);
    expect(HUD_HIDE_MS).toBe(1100);
    f.advance(HUD_HIDE_MS - 1);
    expect(c.view.visible).toBe(true);
    f.advance(1);
    expect(c.view.visible).toBe(false);
    // The fade-out keeps the last text.
    expect(c.view.label).toBe('Volume up');
    expect(seen.map((v) => v.visible)).toEqual([true, false]);
  });

  it('each new event restarts the hide timer and bumps seq', () => {
    const f = fakeTimers();
    const c = new HudController(() => {}, f.timers);
    c.push({ step: 'up' });
    f.advance(800);
    c.push({ step: 'down', level: 10 });
    expect(c.view.seq).toBe(2);
    expect(c.view.label).toBe('Volume down, 10');
    f.advance(800);
    expect(c.view.visible).toBe(true);
    f.advance(300);
    expect(c.view.visible).toBe(false);
    expect(f.pendingCount()).toBe(0);
  });

  it('dispose cancels the pending hide', () => {
    const f = fakeTimers();
    let calls = 0;
    const c = new HudController(() => calls++, f.timers);
    c.push({ step: 'mute' });
    c.dispose();
    f.advance(5000);
    expect(calls).toBe(1);
    expect(f.pendingCount()).toBe(0);
  });
});
