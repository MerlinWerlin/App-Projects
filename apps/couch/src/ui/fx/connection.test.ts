import { initialTrack, pillStatus, pillVisual, step, transition, type PillStatus, type PillTrack } from './connection';
import type { ConnectionState } from '../../core/types';

function run(states: (ConnectionState | null)[], tvId: string | null = 'a', assume = false) {
  let t: PillTrack = initialTrack;
  return states.map((s) => {
    const r = step(t, tvId, s, assume);
    t = r.next;
    return { status: r.next.status, pop: r.fx.pop };
  });
}

describe('pillStatus', () => {
  it('maps driver states', () => {
    expect(pillStatus('connected', true, false)).toBe('connected');
    expect(pillStatus('connecting', true, false)).toBe('searching');
    expect(pillStatus('connecting', true, true)).toBe('reconnecting');
    expect(pillStatus('disconnected', true, false)).toBe('offline');
    expect(pillStatus('disconnected', true, true)).toBe('reconnecting');
    expect(pillStatus('off', true, true)).toBe('off');
    expect(pillStatus('error', true, true)).toBe('error');
  });
  it('no TV is none; null is ready, or connected for pre-connected demo drivers', () => {
    expect(pillStatus('connected', false, true)).toBe('none');
    expect(pillStatus(null, true, false)).toBe('ready');
    expect(pillStatus(null, true, false, true)).toBe('connected');
  });
});

describe('pillVisual', () => {
  it('searching shimmers, reconnecting pulses amber, connected is green and static', () => {
    expect(pillVisual('searching').anim).toBe('shimmer');
    expect(pillVisual('reconnecting')).toMatchObject({ color: 'warn', anim: 'pulse' });
    expect(pillVisual('connected')).toMatchObject({ color: 'ok', anim: 'none', label: 'connected' });
  });
  it('error/off/offline are static; existing labels kept', () => {
    for (const s of ['error', 'off', 'offline', 'none', 'ready'] as PillStatus[]) expect(pillVisual(s).anim).toBe('none');
    expect(pillVisual('error').color).toBe('warn');
    expect(pillVisual('off').label).toBe('off');
    expect(pillVisual('searching').label).toBe('connecting');
    expect(pillVisual('error').label).toBe('error');
  });
  it('latency only while live', () => {
    expect(pillVisual('connected').live).toBe(true);
    expect(pillVisual('reconnecting').live).toBe(false);
  });
});

describe('transition / step', () => {
  it('pops once on first connect after mount, never while staying connected', () => {
    const r = run(['connecting', 'connected', 'connected', 'connected']);
    expect(r.map((x) => x.pop)).toEqual([false, true, false, false]);
  });
  it('pops on mount when already connected', () => {
    expect(run(['connected'])[0]).toEqual({ status: 'connected', pop: true });
  });
  it('drop -> reconnecting amber -> pops again on reconnect', () => {
    const r = run(['connected', 'disconnected', 'connecting', 'connected']);
    expect(r.map((x) => x.status)).toEqual(['connected', 'reconnecting', 'reconnecting', 'connected']);
    expect(r.map((x) => x.pop)).toEqual([true, false, false, true]);
  });
  it('after power off, the next connect is searching again, not reconnecting', () => {
    const r = run(['connected', 'off', 'connecting', 'connected']);
    expect(r.map((x) => x.status)).toEqual(['connected', 'off', 'searching', 'connected']);
  });
  it('null on a real TV never pops', () => {
    expect(run([null, null]).map((x) => x.pop)).toEqual([false, false]);
  });
  it('switching TV resets history and pops for the new connected TV', () => {
    let t = step(initialTrack, 'a', 'connected').next;
    const sw = step(t, 'b', null, true);
    expect(sw.fx).toEqual({ pop: true, haptic: true, emit: true });
    t = step(t, 'b', 'connecting').next;
    expect(t.status).toBe('searching');
  });
  it('is idempotent for repeated identical steps (StrictMode double effects)', () => {
    const a = step(initialTrack, 'a', 'connected');
    const b = step(a.next, 'a', 'connected');
    expect(b.fx.pop).toBe(false);
    expect(b.next).toEqual(a.next);
  });
  it('transition flags move together', () => {
    const fx = transition({ tvId: 'a', status: 'searching', everConnected: false }, { tvId: 'a', status: 'connected', everConnected: true });
    expect(fx).toEqual({ pop: true, haptic: true, emit: true });
    expect(transition(initialTrack, { tvId: 'a', status: 'error', everConnected: false }).pop).toBe(false);
  });
});
