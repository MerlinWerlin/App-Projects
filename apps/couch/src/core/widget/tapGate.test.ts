import { WIDGET_DEDUPE_MS, WIDGET_RATE_MAX, WidgetTapGate } from './tapGate';
import type { WidgetLink } from './links';

const P: WidgetLink = { action: 'power', tvId: 'demo-1' };
const UP: WidgetLink = { action: 'volume-up', tvId: 'demo-1' };
const P2: WidgetLink = { action: 'power', tvId: 'demo-2' };

describe('WidgetTapGate', () => {
  it('drops an identical tap within 250 ms', () => {
    const g = new WidgetTapGate();
    expect(WIDGET_DEDUPE_MS).toBe(250);
    expect(g.check(P, 1000)).toBe('ok');
    expect(g.check(P, 1000)).toBe('duplicate');
    expect(g.check(P, 1249)).toBe('duplicate');
    expect(g.check(P, 1250)).toBe('ok');
  });

  it('measures from the last accepted tap, not the last dropped one', () => {
    const g = new WidgetTapGate();
    expect(g.allow(P, 0)).toBe(true);
    expect(g.allow(P, 200)).toBe(false);
    expect(g.allow(P, 260)).toBe(true);
  });

  it('lets different actions or TVs through immediately', () => {
    const g = new WidgetTapGate();
    expect(g.check(P, 0)).toBe('ok');
    expect(g.check(UP, 10)).toBe('ok');
    expect(g.check(UP, 20)).toBe('duplicate');
    expect(g.check(P2, 30)).toBe('ok');
    expect(g.check(P, 40)).toBe('ok');
  });

  it('caps the rate per second', () => {
    const g = new WidgetTapGate();
    const actions: WidgetLink['action'][] = ['power', 'volume-up', 'volume-down', 'mute', 'next-input', 'home', 'play-pause'];
    let ok = 0;
    for (let i = 0; i < 20; i++) {
      const v = g.check({ action: actions[i % actions.length]!, tvId: 'demo-1' }, i * 10);
      if (v === 'ok') ok++;
      else expect(v === 'rateLimited' || v === 'duplicate').toBe(true);
    }
    expect(ok).toBe(WIDGET_RATE_MAX);
    expect(g.check({ action: 'home', tvId: 'demo-9' }, 999)).toBe('rateLimited');
    expect(g.check({ action: 'home', tvId: 'demo-9' }, 1001)).toBe('ok');
  });

  it('honours custom options and reset()', () => {
    const g = new WidgetTapGate({ dedupeMs: 50, windowMs: 100, maxPerWindow: 2 });
    expect(g.check(P, 0)).toBe('ok');
    expect(g.check(P, 49)).toBe('duplicate');
    expect(g.check(P, 50)).toBe('ok');
    expect(g.check(UP, 60)).toBe('rateLimited');
    g.reset();
    expect(g.check(P, 61)).toBe('ok');
  });

  it('survives a clock that goes backwards', () => {
    const g = new WidgetTapGate();
    expect(g.check(P, 10_000)).toBe('ok');
    expect(g.check(P, 5_000)).toBe('ok');
    expect(g.check(P, 5_100)).toBe('duplicate');
  });
});
