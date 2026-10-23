/** night-intro: the opening animation's geometry and timing (pure TS). */
import {
  BEATS,
  BUTTONS,
  DIRS,
  INTRO_MS,
  OK_KEY,
  PANEL,
  RING,
  frameAt,
  interpolation,
  introCanFade,
  introTracks,
  nubCentre,
  remoteLayers,
  restValue,
  startupReady,
  valueAt,
} from './introRemote';

const beat = (id: string) => BEATS.find((b) => b.id === id)!;

describe('intro remote: sequence', () => {
  it('presses the arrows in turn (up, right, down, left), then OK, ripple, a bottom button, then the sheen', () => {
    expect(BEATS.map((b) => b.id)).toEqual(['nub-up', 'nub-right', 'nub-down', 'nub-left', 'ok', 'ripple', 'btn-1', 'sheen']);
    for (let i = 1; i < BEATS.length; i++) expect(BEATS[i]!.at).toBeGreaterThan(BEATS[i - 1]!.at);
    expect(beat('ok').at).toBeGreaterThanOrEqual(beat('nub-left').at + beat('nub-left').ms - 40);
    expect(beat('ripple').at).toBeGreaterThan(beat('ok').at);
  });

  it('holds still while the native splash fades, and fits in one short pass under the cap', () => {
    expect(BEATS[0]!.at).toBeGreaterThanOrEqual(INTRO_MS.splashFade);
    for (const b of BEATS) expect(b.at + b.ms).toBeLessThanOrEqual(INTRO_MS.seq);
    expect(INTRO_MS.seq).toBeGreaterThanOrEqual(1600);
    expect(INTRO_MS.seq + INTRO_MS.fadeOut).toBeLessThanOrEqual(2300);
    expect(INTRO_MS.maxWait).toBeLessThanOrEqual(3000);
    expect(INTRO_MS.maxWait).toBeGreaterThan(INTRO_MS.seq);
    expect(INTRO_MS.haptic).toBe(beat('ok').at + 130);
  });

  it('first and last frames are at rest (the splash image is frame 0)', () => {
    for (const tr of introTracks()) {
      expect({ k: `${tr.layer}.${tr.prop}`, v: valueAt(tr, 0) }).toEqual({ k: `${tr.layer}.${tr.prop}`, v: tr.prop === 'scale' && tr.layer === 'ripple' ? OK_KEY.r / RING.r : restValue(tr.prop) });
    }
    const end = frameAt(INTRO_MS.seq);
    for (const [k, v] of Object.entries(end)) {
      if (k.endsWith('.opacity') || k.endsWith('.shade')) expect({ k, v }).toEqual({ k, v: 0 });
      if (k.endsWith('.scale') && !k.startsWith('ripple')) expect({ k, v }).toEqual({ k, v: 1 });
    }
  });

  it('presses are gentle: scale only ever goes down a little, never overshoots', () => {
    for (const tr of introTracks().filter((t) => t.prop === 'scale' && t.layer !== 'ripple')) {
      for (let t = 0; t <= INTRO_MS.seq; t += 5) {
        const v = valueAt(tr, t);
        expect(v).toBeLessThanOrEqual(1);
        expect(v).toBeGreaterThanOrEqual(0.85);
      }
    }
    const f = frameAt(beat('ok').at + 140);
    expect(f['ok.scale']).toBeCloseTo(0.96, 2);
    expect(f['ok.shade']).toBeGreaterThan(0.2);
  });

  it('each arrow is pressed at its own beat, one after another', () => {
    for (const d of DIRS) {
      const at = beat(`nub-${d}`).at + 115;
      const f = frameAt(at);
      expect(f[`nub-${d}.scale`]).toBeLessThan(0.9);
      expect(f[`glint-${d}.opacity`]).toBeGreaterThan(0.8);
      for (const o of DIRS.filter((x) => x !== d && x !== DIRS[DIRS.indexOf(d) - 1])) expect(f[`nub-${o}.scale`]).toBe(1);
    }
  });

  it('interpolation ranges are strictly increasing and replay valueAt', () => {
    for (const tr of introTracks()) {
      const { inputRange, outputRange } = interpolation(tr);
      expect(inputRange.length).toBe(outputRange.length);
      for (let i = 1; i < inputRange.length; i++) expect(inputRange[i]!).toBeGreaterThan(inputRange[i - 1]!);
      for (let i = 0; i < inputRange.length; i++) expect(outputRange[i]!).toBeCloseTo(valueAt(tr, inputRange[i]!), 3);
    }
  });
});

describe('intro remote: startup gate', () => {
  it('startupReady: fonts + catalogues, or the cap', () => {
    expect(startupReady(true, true, 0)).toBe(true);
    expect(startupReady(false, true, 0)).toBe(false);
    expect(startupReady(true, false, INTRO_MS.maxWait - 1)).toBe(false);
    expect(startupReady(false, false, INTRO_MS.maxWait)).toBe(true);
  });

  it('introCanFade: one full pass and ready, or the hard cap', () => {
    expect(introCanFade(true, true, 0)).toBe(true);
    expect(introCanFade(false, true, 1000)).toBe(false);
    expect(introCanFade(true, false, 2000)).toBe(false);
    expect(introCanFade(false, false, INTRO_MS.maxWait)).toBe(true);
  });
});

describe('intro remote: art', () => {
  it('everything sits on the panel inside the viewBox', () => {
    expect(RING.cy - RING.recess).toBeGreaterThan(PANEL.y);
    expect(BUTTONS.y + BUTTONS.socket).toBeLessThan(PANEL.y + PANEL.h);
    expect(BUTTONS.xs[0] - BUTTONS.socket).toBeGreaterThan(PANEL.x);
    expect(BUTTONS.xs[2] + BUTTONS.socket).toBeLessThan(PANEL.x + PANEL.w);
  });

  it('arrows point the physical way round the ring (never mirrored)', () => {
    const [ux, uy] = nubCentre('up');
    const [rx] = nubCentre('right');
    const [lx] = nubCentre('left');
    const [, dy] = nubCentre('down');
    expect(uy).toBeLessThan(RING.cy);
    expect(dy).toBeGreaterThan(RING.cy);
    expect(rx).toBeGreaterThan(RING.cx);
    expect(lx).toBeLessThan(RING.cx);
    expect(ux).toBeCloseTo(RING.cx, 5);
  });

  it('every animated layer exists, gradient ids are unique per layer, and fills reference them', () => {
    const layers = remoteLayers();
    const ids = new Set(layers.map((l) => l.id));
    for (const tr of introTracks()) expect(ids.has(tr.layer)).toBe(true);
    for (const l of layers) {
      const g = new Set(l.gradients.map((x) => x.id));
      expect(g.size).toBe(l.gradients.length);
      for (const s of l.shapes) {
        for (const v of Object.values(s.attrs)) {
          const m = /^url\(#(.+)\)$/.exec(String(v));
          if (m) expect({ layer: l.id, ref: m[1], ok: g.has(m[1]!) }).toEqual({ layer: l.id, ref: m[1], ok: true });
        }
      }
      for (const s of l.shade ?? []) expect(String(s.attrs.fill)).not.toMatch(/url/);
    }
  });
});
