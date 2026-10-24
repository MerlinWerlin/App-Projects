import { REMOTE_THEMES } from '../../theme/remoteThemes';
import { dark, light } from '../../theme/tokens';
import {
  BACKDROP,
  BREATH,
  DRIFT,
  GLOW_COLORS,
  GLOW_LOBES,
  PULSE,
  STAGE_INK,
  STATIC_OPACITY,
  SWELL,
  SWELL_COLOR,
  TV_GLOW_COLORS,
  blend,
  brightestStage,
  contrast,
  falloffStops,
  glowColor,
  haloStyle,
  hashId,
  hexToRgb,
  hsl,
  luminance,
  maxStageAlpha,
  pulseCenter,
  remoteStage,
  stageContrast,
  tvGlowColor,
} from './glow';

const ALL = [...Object.values(GLOW_COLORS), ...TV_GLOW_COLORS, SWELL_COLOR];

describe('glow palettes', () => {
  it('are low saturation and not neon', () => {
    for (const c of ALL) {
      const { s, l } = hsl(c);
      expect({ c, lowSat: s <= 0.6 }).toEqual({ c, lowSat: true });
      // Not pure/neon: no channel pinned at 0 or 255, and lightness in a soft mid-light band.
      const { r, g, b } = hexToRgb(c);
      expect({ c, pinned: [r, g, b].some((v) => v === 0 || v === 255) }).toEqual({ c, pinned: false });
      expect(l).toBeGreaterThan(0.45);
      expect(l).toBeLessThan(0.85);
    }
  });

  it('resolves the setting to a colour, Off to null', () => {
    expect(glowColor('amber', 'x')).toBe(GLOW_COLORS.amber);
    expect(glowColor('blue', null)).toBe(GLOW_COLORS.blue);
    expect(glowColor('violet', null)).toBe(GLOW_COLORS.violet);
    expect(glowColor('off', 'x')).toBeNull();
    expect(glowColor('tv', null)).toBe(GLOW_COLORS.amber);
    expect(glowColor('tv', 'roku-uuid:roku:ecp:X1')).toBe(tvGlowColor('roku-uuid:roku:ecp:X1'));
  });
});

describe('Match TV hashing', () => {
  it('is deterministic FNV-1a', () => {
    expect(hashId('')).toBe(0x811c9dc5);
    expect(hashId('a')).toBe(0xe40c292c);
    expect(hashId('demo-1')).toBe(hashId('demo-1'));
  });

  it('maps ids into the curated set, demo/no TV to amber', () => {
    expect(tvGlowColor(null)).toBe(GLOW_COLORS.amber);
    expect(tvGlowColor('')).toBe(GLOW_COLORS.amber);
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const c = tvGlowColor(`roku-192.168.1.${i}`);
      expect(TV_GLOW_COLORS).toContain(c);
      seen.add(c);
    }
    // Spreads across the set rather than giving every TV the same colour.
    expect(seen.size).toBeGreaterThanOrEqual(5);
  });
});

describe('gradient falloff and layout', () => {
  it('falls smoothly from the peak to 0 over many stops', () => {
    const s = falloffStops(0.2, 9);
    expect(s).toHaveLength(9);
    expect(s[0]).toEqual({ offset: 0, opacity: 0.2 });
    expect(s[s.length - 1]).toEqual({ offset: 1, opacity: 0 });
    for (let i = 1; i < s.length; i++) expect(s[i]!.opacity).toBeLessThanOrEqual(s[i - 1]!.opacity);
    expect(falloffStops(5, 1)).toHaveLength(3);
    expect(falloffStops(5)[0]!.opacity).toBe(1);
  });

  it('has 2-3 soft lobes', () => {
    expect(GLOW_LOBES.length).toBeGreaterThanOrEqual(2);
    expect(GLOW_LOBES.length).toBeLessThanOrEqual(3);
    for (const l of GLOW_LOBES) expect(l.peak).toBeLessThanOrEqual(0.2);
  });

  it('centres the press pulse toward the key', () => {
    expect(pulseCenter({ x: 0, y: 0 })).toEqual({ cx: 0.5, cy: 0.5 });
    const left = pulseCenter({ x: -1, y: 0 });
    expect(left.cx).toBeLessThan(0.5);
    const down = pulseCenter({ x: 0, y: 1 });
    expect(down.cy).toBeGreaterThan(0.5);
    expect(pulseCenter({ x: 9, y: Number.NaN })).toEqual(pulseCenter({ x: 1, y: 0 }));
  });

  it('timings match the brief', () => {
    expect(BREATH.min).toBeCloseTo(0.55);
    expect(BREATH.max).toBeCloseTo(0.8);
    expect(BREATH.period).toBeGreaterThanOrEqual(6000);
    expect(BREATH.period).toBeLessThanOrEqual(8000);
    expect(STATIC_OPACITY).toBeCloseTo(0.65);
    expect(DRIFT.px).toBeLessThanOrEqual(6);
    expect(PULSE.in + PULSE.out).toBeLessThanOrEqual(220);
    expect(SWELL.in + SWELL.out).toBe(1200);
  });
});

describe('contrast helper', () => {
  it('computes WCAG ratios', () => {
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(contrast('#777777', '#777777')).toBeCloseTo(1, 5);
    expect(luminance('#FFFFFF')).toBeCloseTo(1, 5);
    expect(blend('#FFFFFF', '#000000', 0.5)).toBe('#808080');
    expect(blend('#FFFFFF', '#000000', 2)).toBe('#FFFFFF');
  });

  it('worst case stage alpha is conservative and bounded', () => {
    expect(maxStageAlpha()).toBeGreaterThan(BREATH.max * GLOW_LOBES[0]!.peak);
    expect(maxStageAlpha()).toBeLessThanOrEqual(0.6);
  });

  it('stage text stays AA (4.5:1) over the darkest and brightest glow points for every colour', () => {
    for (const c of ALL) {
      expect({ c, ok: stageContrast(STAGE_INK, c) >= 4.5 }).toEqual({ c, ok: true });
      expect(contrast(STAGE_INK, brightestStage(c))).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(STAGE_INK, BACKDROP)).toBeGreaterThanOrEqual(4.5);
  });

  it('the remote body still separates from the stage in both themes (keys keep their own palette)', () => {
    // The light theme is a white remote on a dark stage; the dark body is lifted off near-black.
    expect(contrast(light.body, BACKDROP)).toBeGreaterThan(10);
    expect(luminance(dark.body)).toBeGreaterThan(luminance(BACKDROP));
    // Key glyph contrast is unchanged by the stage (keys draw their own backgrounds).
    expect(contrast(light.ink, light.key)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(dark.ink, dark.key)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(light.muted, light.body)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(dark.muted, dark.body)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('backlight halo (owner 24 Oct 2026)', () => {
  it('hugs the remote card in the glow colour, and is gone with the glow off', () => {
    expect(haloStyle(null)).toBeNull();
    const h = haloStyle('#C9A26C')!;
    expect(h.shadowColor).toBe('#C9A26C');
    expect(h.shadowOffset).toEqual({ width: 0, height: 0 });
    expect(h.shadowOpacity).toBeGreaterThan(0.3);
    expect(h.shadowOpacity).toBeLessThanOrEqual(0.7);
    expect(h.shadowRadius).toBeLessThanOrEqual(24);
  });
});

describe('remote themes and the glow (owner-1017 T56)', () => {
  const themes = Object.values(REMOTE_THEMES);

  it("'theme' uses the theme's glow; a theme without one means no glow", () => {
    expect(glowColor('theme', null, REMOTE_THEMES.midnight.glow)).toBe(REMOTE_THEMES.midnight.glow);
    expect(glowColor('theme', 'x', null)).toBeNull();
    expect(glowColor('theme', null)).toBe(GLOW_COLORS.amber);
    // Explicit colours keep their old behaviour whatever the theme.
    expect(glowColor('amber', null, REMOTE_THEMES.neon.glow)).toBe(GLOW_COLORS.amber);
    expect(glowColor('off', null, REMOTE_THEMES.neon.glow)).toBeNull();
  });

  it('stage text stays AA over every theme stage with its own glow and every pref colour', () => {
    for (const t of themes) {
      const colours = [t.glow, ...Object.values(GLOW_COLORS), ...TV_GLOW_COLORS].filter((c): c is string => !!c);
      for (const c of colours) {
        const s = remoteStage(t, c);
        expect({ theme: t.id, c, ok: stageContrast(s.ink, c, s.bg) >= 4.5 }).toEqual({ theme: t.id, c, ok: true });
      }
    }
  });

  it('stage text stays AA on every theme stage with the glow off', () => {
    for (const t of themes) {
      const s = remoteStage(t, null);
      expect(s.bg).toBe(t.stage);
      expect({ theme: t.id, ok: contrast(s.ink, s.bg) >= 4.5 }).toEqual({ theme: t.id, ok: true });
    }
  });
});
