import {
  accessoryPlacement,
  boxShadow,
  compositeOver,
  designDark,
  designLight,
  designPairs,
  designPalette,
  legacyShadow,
  materialAllows,
  materialContrast,
  materialMode,
  materials,
  pickReadable,
  radii,
  remoteDesignPalette,
  separatorInset,
  list,
  textStyle,
  typeScale,
  type DesignPalette,
  type Material,
  type TypeRole,
} from './design';
import { contrastRatio, REMOTE_THEME_IDS, REMOTE_THEMES } from './remoteThemes';
import { fonts, minTarget } from './tokens';
import { pillColors } from '../ui/v2/pillColors';

const remotePalettes: [string, DesignPalette][] = REMOTE_THEME_IDS.map((id) => [`remote:${id}`, remoteDesignPalette(REMOTE_THEMES[id])]);
const allPalettes: [string, DesignPalette][] = [['light', designLight], ['dark', designDark], ...remotePalettes];
const MATERIALS = Object.keys(materials) as Material[];

describe('design v2 palette', () => {
  it('light and dark define the same roles', () => {
    expect(Object.keys(designDark).sort()).toEqual(Object.keys(designLight).sort());
  });

  it('designPalette() picks dark only for dark', () => {
    expect(designPalette('dark')).toBe(designDark);
    expect(designPalette('light')).toBe(designLight);
    expect(designPalette('unspecified')).toBe(designLight);
    expect(designPalette(null)).toBe(designLight);
  });

  it.each(allPalettes)('%s: every text/background pair meets WCAG AA', (_name, p) => {
    const fails = designPairs(p)
      .map((q) => ({ ...q, ratio: Math.round(contrastRatio(q.fg, q.bg) * 100) / 100 }))
      .filter((q) => q.ratio < q.min);
    expect(fails).toEqual([]);
  });

  it.each(allPalettes)('%s: every pill variant label meets AA on its fill (plain on surface)', (_name, p) => {
    for (const variant of ['filled', 'tinted', 'plain'] as const) {
      for (const tone of ['accent', 'destructive'] as const) {
        const c = pillColors(p, variant, tone);
        const bg = c.bg === 'transparent' ? p.surface : c.bg;
        expect({ variant, tone, ok: contrastRatio(c.ink, bg) >= 4.5 }).toEqual({ variant, tone, ok: true });
      }
    }
  });

  it('remote palettes keep the theme colours where they are readable', () => {
    const m = REMOTE_THEMES.midnight;
    const p = remoteDesignPalette(m);
    expect(p.scheme).toBe('dark');
    expect(p.surface).toBe(m.body);
    expect(p.label).toBe(m.ink);
    expect(p.tint).toBe(m.accent);
    expect(p.tintInk).toBe(m.accentInk);
    expect(remoteDesignPalette(REMOTE_THEMES.daylight).scheme).toBe('light');
  });

  it('pickReadable falls back to the most readable candidate', () => {
    expect(pickReadable(['#777777', '#000000'], '#FFFFFF')).toBe('#000000');
    expect(pickReadable(['#000000', '#111111'], '#FFFFFF')).toBe('#000000');
    expect(pickReadable(['#FEFEFE', '#EEEEEE'], '#FFFFFF')).toBe('#EEEEEE');
  });
});

describe('design v2 materials', () => {
  it('compositeOver blends channels', () => {
    expect(compositeOver('#FFFFFF', 0.5, '#000000')).toBe('#808080');
    expect(compositeOver('#123456', 1, '#000000')).toBe('#123456');
    expect(compositeOver('#123456', 0, '#ABCDEF')).toBe('#ABCDEF');
  });

  it.each(allPalettes)('%s: primary labels are AA on every material over any backdrop', (_name, p) => {
    for (const m of MATERIALS) expect({ m, ok: materialAllows(m, p, 'label') }).toEqual({ m, ok: true });
  });

  it('secondary text is AA on thick and chrome materials (light and dark)', () => {
    for (const p of [designLight, designDark]) {
      for (const m of ['thick', 'chrome'] as const) {
        expect(materialContrast(m, p.scheme, p.secondaryLabel)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('materials get more opaque from thin to thick', () => {
    expect(materials.thin.alpha).toBeLessThan(materials.regular.alpha);
    expect(materials.regular.alpha).toBeLessThan(materials.thick.alpha);
  });

  it('solid fallback with Reduce Transparency, without a blur view, and on Android', () => {
    expect(materialMode({ reduceTransparency: true, hasBlur: true, platform: 'ios' })).toBe('solid');
    expect(materialMode({ reduceTransparency: false, hasBlur: false, platform: 'ios' })).toBe('solid');
    expect(materialMode({ reduceTransparency: false, hasBlur: true, platform: 'android' })).toBe('solid');
    expect(materialMode({ reduceTransparency: false, hasBlur: true, platform: 'android', allowAndroidBlur: true })).toBe('blur');
    expect(materialMode({ reduceTransparency: false, hasBlur: true, platform: 'ios' })).toBe('blur');
  });
});

describe('design v2 type', () => {
  const roles = Object.keys(typeScale) as TypeRole[];

  it('follows the HIG default sizes', () => {
    expect(typeScale.largeTitle.size).toBe(34);
    expect(typeScale.body.size).toBe(17);
    expect(typeScale.footnote.size).toBe(13);
    expect(typeScale.caption2.size).toBe(11);
  });

  it('line heights are at least the font size and sizes descend from large title', () => {
    for (const r of roles) expect(typeScale[r].line).toBeGreaterThanOrEqual(typeScale[r].size);
    expect(typeScale.largeTitle.size).toBeGreaterThan(typeScale.title1.size);
    expect(typeScale.title1.size).toBeGreaterThan(typeScale.title2.size);
    expect(typeScale.headline.size).toBeGreaterThan(typeScale.footnote.size);
  });

  it('system roles leave fontFamily unset and set a weight; brand roles carry the family', () => {
    expect(textStyle('body')).toEqual({ fontSize: 17, lineHeight: 22, fontWeight: '400' });
    expect('fontFamily' in textStyle('headline')).toBe(false);
    expect(textStyle('largeTitle').fontFamily).toBe(fonts.displayBold);
    expect(textStyle('largeTitle').fontWeight).toBeUndefined();
    expect(textStyle('numeric')).toMatchObject({ fontFamily: fonts.mono, fontVariant: ['tabular-nums'] });
  });

  it('Dynamic Type caps only where a fixed container needs them, never below 1.3x', () => {
    for (const r of roles) {
      const cap = typeScale[r].maxScale;
      if (cap !== undefined) expect(cap).toBeGreaterThanOrEqual(1.3);
    }
    expect(typeScale.body.maxScale).toBeUndefined();
  });
});

describe('design v2 shape and elevation', () => {
  it('row metrics keep the 48pt touch target and inset separators under the text', () => {
    expect(list.rowMinHeight).toBeGreaterThanOrEqual(minTarget);
    expect(separatorInset(false)).toBe(list.rowPadding);
    expect(separatorInset(true)).toBe(list.rowPadding + list.icon + list.iconGap);
  });

  it('radii grow from small controls to sheets; pills are capsules', () => {
    expect(radii.sm).toBeLessThan(radii.group);
    expect(radii.group).toBeLessThan(radii.card);
    expect(radii.card).toBeLessThan(radii.sheet);
    expect(radii.pill).toBeGreaterThanOrEqual(999);
  });

  it('boxShadow lists two layers and is stronger in dark', () => {
    const l = boxShadow('low', 'light');
    expect(l.split('), ').length).toBe(2);
    expect(l).toMatch(/^0px 1px 2px 0px rgba\(0, 0, 0, 0\.06\), 0px 4px 12px 0px rgba\(0, 0, 0, 0\.06\)$/);
    expect(legacyShadow('high', 'dark').shadowOpacity).toBeGreaterThan(legacyShadow('high', 'light').shadowOpacity);
    expect(legacyShadow('mid', 'light').elevation).toBeGreaterThan(legacyShadow('low', 'light').elevation);
  });
});

describe('row accessory placement (Dynamic Type)', () => {
  it('values move below the title at accessibility sizes; controls stay at the end', () => {
    expect(accessoryPlacement(1, 'value')).toBe('end');
    expect(accessoryPlacement(1.35, 'detail')).toBe('end');
    expect(accessoryPlacement(1.6, 'value')).toBe('below');
    expect(accessoryPlacement(3, 'detail')).toBe('below');
    expect(accessoryPlacement(3, 'switch')).toBe('end');
    expect(accessoryPlacement(3, 'chevron')).toBe('end');
    expect(accessoryPlacement(Number.NaN, 'value')).toBe('end');
  });
});
