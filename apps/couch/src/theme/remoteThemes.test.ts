import {
  DEFAULT_REMOTE_THEME,
  FREE_REMOTE_THEMES,
  REMOTE_THEME_IDS,
  REMOTE_THEMES,
  contrastRatio,
  effectiveRemoteTheme,
  labelPairs,
  luminance as luminanceOf,
  remoteTheme,
} from './remoteThemes';
import { en } from '../i18n/catalog/en';

describe('remote themes (owner-1017)', () => {
  it('ships at least 10 themes, Charcoal & Gold default, exactly Charcoal/Midnight/Daylight/OLED free', () => {
    expect(REMOTE_THEME_IDS.length).toBeGreaterThanOrEqual(10);
    expect(DEFAULT_REMOTE_THEME).toBe('charcoal');
    expect([...FREE_REMOTE_THEMES].sort()).toEqual(['charcoal', 'daylight', 'midnight', 'oled']);
    for (const id of REMOTE_THEME_IDS) {
      const t = REMOTE_THEMES[id];
      expect(t.id).toBe(id);
      expect(t.tier).toBe(FREE_REMOTE_THEMES.includes(id) ? 'free' : 'plus');
      expect(en[t.nameKey]).toBeTruthy();
    }
  });

  for (const id of REMOTE_THEME_IDS) {
    it(`${id}: every key label meets WCAG AA`, () => {
      for (const p of labelPairs(REMOTE_THEMES[id])) {
        const r = contrastRatio(p.fg, p.bg);
        if (r < p.min) throw new Error(`${id} ${p.what}: ${r.toFixed(2)} < ${p.min}`);
      }
    });
  }

  it('themes carry no layout or behaviour: no d-pad geometry, sizes, keys or visibility flags', () => {
    const allowed = new Set([
      'id', 'nameKey', 'tier', 'scheme', 'bg', 'stage', 'body', 'key', 'keyEdge', 'ink', 'muted', 'accent',
      'accentSoft', 'accentInk', 'power', 'ok', 'warn', 'ring', 'ringLit', 'ringInk', 'glow', 'press', 'radius', 'texture',
    ]);
    for (const t of Object.values(REMOTE_THEMES)) for (const k of Object.keys(t)) expect(allowed.has(k)).toBe(true);
  });

  it('a Plus theme falls back to the default without Plus, shows with Plus or while trying', () => {
    expect(effectiveRemoteTheme('retro', { plus: false }).id).toBe('charcoal');
    expect(effectiveRemoteTheme('retro', { plus: true }).id).toBe('retro');
    expect(effectiveRemoteTheme('midnight', { plus: false, trying: 'neon' }).id).toBe('neon');
    expect(effectiveRemoteTheme('daylight', { plus: false }).id).toBe('daylight');
    expect(remoteTheme('nope').id).toBe('charcoal');
  });

  it('the default matches the app icon and opening animation (owner 24 Oct 2026)', () => {
    const t = REMOTE_THEMES[DEFAULT_REMOTE_THEME];
    // Same backdrop as the intro (src/core/introRemote.ts INTRO_BG) so the hand-off has no colour jump.
    expect(t.bg).toBe('#0E0E0F');
    // Gold d-pad face and OK key with dark arrows, on a charcoal body, like the icon.
    expect(luminanceOf(t.ring)).toBeGreaterThan(0.3);
    expect(luminanceOf(t.accent)).toBeGreaterThan(0.3);
    expect(luminanceOf(t.body)).toBeLessThan(0.03);
    expect(t.ringInk).toBeDefined();
  });

  it('textures are generated only (no image URLs or files)', () => {
    for (const t of Object.values(REMOTE_THEMES)) {
      for (const c of t.texture.colors) expect(c).toMatch(/^#[0-9A-F]{6}$/i);
      expect(JSON.stringify(t)).not.toMatch(/https?:|\.png|\.jpe?g|require\(/i);
    }
  });
});
