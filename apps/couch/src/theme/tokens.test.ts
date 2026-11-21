import { designDark, designLight } from './design';
import { dark, light, palette } from './tokens';

describe('tokens', () => {
  it('matches the v2 roles (DESIGN.md) so old and new screens share one palette', () => {
    expect(light.bg).toBe(designLight.background);
    expect(light.accent).toBe(designLight.tint);
    expect(dark.bg).toBe(designDark.background);
    expect(dark.accent).toBe(designDark.tint);
    // Dark ground is the app icon's and opening animation's near-black.
    expect(dark.bg).toBe('#0E0E0F');
  });

  it('light and dark define the same keys', () => {
    expect(Object.keys(dark).sort()).toEqual(Object.keys(light).sort());
  });

  it('palette() picks dark only for dark', () => {
    expect(palette('dark')).toBe(dark);
    expect(palette('light')).toBe(light);
    expect(palette(null)).toBe(light);
  });
});
