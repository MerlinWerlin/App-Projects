import { dpadGeometry } from '../../core/dpadGeometry';
import { OK_GOLD, RING_GOLD } from '../../core/introRemote';
import { REMOTE_THEME_IDS, REMOTE_THEMES } from '../../theme/remoteThemes';
import { capColors, metalSamples, nubSpec, okModel, padModel, padRadii, tiltFor, wellColors } from './machined';

describe('machined remote (logo remote in the app)', () => {
  it('Charcoal & Gold uses the icon\'s own spun-gold samples', () => {
    const t = REMOTE_THEMES.charcoal;
    expect(metalSamples(t.ring, 'ring', true)).toEqual([...RING_GOLD]);
    expect(metalSamples(t.accent, 'ok', true)).toEqual([...OK_GOLD]);
  });

  it('other metals keep the icon\'s light pattern in their own colour; smooth themes get one colour', () => {
    const a = metalSamples('#E6E9EC', 'ring', true);
    expect(a).toHaveLength(RING_GOLD.length);
    expect(new Set(a).size).toBeGreaterThan(10);
    for (const c of a) expect(c).toMatch(/^#[0-9A-F]{6}$/);
    expect(metalSamples('#123456', 'ring', false)).toEqual(['#123456']);
  });

  it('the OK groove sits inside the gold ring and the nubs fit in the band, on every phone width', () => {
    for (const w of [252, 300, 343, 360, 400]) {
      const g = dpadGeometry(w, 1);
      const r = padRadii(g.diameter, g.key.size);
      expect(r.groove).toBeGreaterThan(r.key);
      expect(r.ring).toBeGreaterThan(r.groove);
      expect(r.ring).toBeLessThan(r.outer);
      const n = nubSpec(g.diameter, g.key.size);
      expect(n.dist - n.height / 2).toBeGreaterThan(r.groove);
      expect(n.dist + n.height / 2).toBeLessThan(r.ring);
    }
  });

  it('builds a model for every theme without NaN', () => {
    const g = dpadGeometry(320, 1);
    for (const id of REMOTE_THEME_IDS) {
      const t = REMOTE_THEMES[id];
      const json = JSON.stringify([padModel(t, g.diameter, g.key.size), okModel(t, g.key.size)]);
      expect(json).not.toMatch(/NaN|undefined|Infinity/);
    }
  });

  it('wells are darker than the body, caps keep the key colour in the middle', () => {
    for (const id of REMOTE_THEME_IDS) {
      const t = REMOTE_THEMES[id];
      if (t.body !== '#000000') expect(wellColors(t.body).deep).not.toBe(t.body);
      expect(capColors(t).mid).toBe(t.key);
    }
  });

  it('the pad rocks toward the pressed side and rests flat', () => {
    expect(tiltFor('up').rotateX).toBeGreaterThan(0);
    expect(tiltFor('down').rotateX).toBeLessThan(0);
    expect(tiltFor('right').rotateY).toBeGreaterThan(0);
    expect(tiltFor('left').rotateY).toBeLessThan(0);
    expect(tiltFor(null)).toEqual({ rotateX: 0, rotateY: 0 });
  });
});
