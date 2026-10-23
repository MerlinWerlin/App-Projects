import { familyFor, lineHeightFor } from './typography';
import { fonts } from './tokens';

describe('script typography (owner-1016 T47)', () => {
  it('Latin keeps brand fonts', () => {
    expect(familyFor('latin', fonts.display)).toEqual({ fontFamily: fonts.display });
  });
  it('CJK / Devanagari / Arabic swap brand fonts for the system font at the same weight', () => {
    expect(familyFor('cjk', fonts.textBold)).toEqual({ fontFamily: undefined, fontWeight: '700' });
    expect(familyFor('arab', fonts.textSemi)).toEqual({ fontFamily: undefined, fontWeight: '600' });
    expect(familyFor('deva', fonts.text)).toEqual({ fontFamily: undefined, fontWeight: '400' });
  });
  it('mono numbers keep their font', () => {
    expect(familyFor('cjk', fonts.mono)).toEqual({ fontFamily: fonts.mono });
  });
  it('taller lines for non-Latin scripts, never below an explicit value', () => {
    expect(lineHeightFor('latin', 10)).toBe(13);
    expect(lineHeightFor('deva', 10)).toBe(16);
    expect(lineHeightFor('cjk', 10, 20)).toBe(20);
  });
});
