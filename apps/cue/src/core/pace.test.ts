import { VoiceGate, nudgeSpeed, offsetForLine, pixelsPerSecond } from './pace';

describe('pace', () => {
  it('pixels per second', () => {
    expect(pixelsPerSecond(1200, 120, 120)).toBe(20);
    expect(pixelsPerSecond(0, 10, 100)).toBe(0);
  });
  it('nudges and clamps', () => {
    expect(nudgeSpeed(1, 1)).toBe(1.05);
    expect(nudgeSpeed(0.25, -5)).toBe(0.25);
    expect(nudgeSpeed(2.98, 2)).toBe(3);
  });
  it('reading line offset', () => {
    expect(offsetForLine(500, 900, 1 / 3)).toBe(200);
    expect(offsetForLine(10, 900, 1 / 3)).toBe(0);
  });
  it('voice gate opens on speech, holds through breaths, closes on silence', () => {
    const g = new VoiceGate();
    let t = 0;
    for (let i = 0; i < 40; i++) g.sample(-55, (t += 50)); // quiet room
    expect(g.speaking).toBe(false);
    for (let i = 0; i < 10; i++) g.sample(-25, (t += 50)); // talking
    expect(g.speaking).toBe(true);
    expect(g.factor).toBeGreaterThan(0.9);
    g.sample(-55, (t += 300)); // short breath
    expect(g.speaking).toBe(true);
    for (let i = 0; i < 30; i++) g.sample(-55, (t += 50));
    expect(g.speaking).toBe(false);
    expect(g.factor).toBe(0);
  });
  it('bad samples are silence', () => {
    const g = new VoiceGate();
    expect(() => g.sample(Number.NaN, 0)).not.toThrow();
  });
});
