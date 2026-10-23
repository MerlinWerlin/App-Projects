import { contrastRatio, REMOTE_THEME_IDS, REMOTE_THEMES } from '../../theme/remoteThemes';
import { keyFaceColors, mixHex } from './keyFaceColors';

describe('key face shading', () => {
  it('mixes colours', () => {
    expect(mixHex('#000000', '#FFFFFF', 0.5)).toBe('#808080');
    expect(mixHex('#123456', '#FFFFFF', 0)).toBe('#123456');
    expect(mixHex('#123456', '#000000', 2)).toBe('#000000');
    expect(() => mixHex('red', '#000000', 0.5)).toThrow();
  });

  it('comes only from theme tokens: lit top, shaded bottom', () => {
    const m = REMOTE_THEMES.midnight;
    const c = keyFaceColors(m);
    expect(c.top).toBe(mixHex(m.key, '#FFFFFF', 0.07));
    expect(c.bottom).toBe(mixHex(m.key, m.keyEdge, 0.05));
    expect(c.shade).toBe(m.keyEdge);
    expect(keyFaceColors(REMOTE_THEMES.daylight).highlightOpacity).toBeGreaterThan(c.highlightOpacity);
  });

  it('every theme keeps AA for key labels and icons across the whole face', () => {
    for (const id of REMOTE_THEME_IDS) {
      const t = REMOTE_THEMES[id];
      const c = keyFaceColors(t);
      for (const bg of [c.top, c.bottom]) {
        for (const [what, fg] of [['ink', t.ink], ['muted', t.muted], ['power', t.power]] as const) {
          expect({ id, what, aa: contrastRatio(fg, bg) >= 4.5 }).toEqual({ id, what, aa: true });
        }
      }
    }
  });
});
