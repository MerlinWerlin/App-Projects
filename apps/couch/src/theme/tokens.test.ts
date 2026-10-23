import { dark, light, palette } from './tokens';

describe('tokens', () => {
  it('matches the prototype :root values', () => {
    expect(light.bg).toBe('#E4E8EC');
    expect(light.accent).toBe('#2F5BD3');
    expect(dark.bg).toBe('#0E1115');
    expect(dark.accent).toBe('#86A6FF');
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
