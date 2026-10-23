import { directionPlan, needsDirectionChange } from './direction';
import { LOCALE_CODES } from './locales';

describe('layout direction (owner-1016 T50)', () => {
  it('only Arabic needs a right-to-left layout', () => {
    expect(needsDirectionChange('ar', false)).toBe(true);
    expect(needsDirectionChange('ar', true)).toBe(false);
    expect(needsDirectionChange('en', true)).toBe(true);
    expect(needsDirectionChange('pseudo', false)).toBe(false);
    for (const c of LOCALE_CODES.filter((c) => c !== 'ar')) expect(needsDirectionChange(c, false)).toBe(false);
  });

  it('switching between left-to-right languages never reloads', () => {
    expect(directionPlan('en', 'fr', false)).toEqual({ forceRtl: false, reload: false });
    expect(directionPlan('ja', 'hi', false)).toEqual({ forceRtl: false, reload: false });
  });

  it('switching to or from Arabic reloads', () => {
    expect(directionPlan('en', 'ar', false)).toEqual({ forceRtl: true, reload: true });
    expect(directionPlan('ar', 'de', true)).toEqual({ forceRtl: false, reload: true });
  });

  it('Arabic to Arabic (e.g. system -> ar) keeps the running layout', () => {
    expect(directionPlan('ar', 'ar', true)).toEqual({ forceRtl: true, reload: false });
  });

  it('a postponed switch still reloads when the running layout disagrees', () => {
    // User chose Arabic, tapped "Later" (layout still LTR), then picked another LTR language: no reload.
    expect(directionPlan('ar', 'en', false)).toEqual({ forceRtl: false, reload: false });
    // Layout is RTL from an earlier session but prefs now say French: reload.
    expect(directionPlan('fr', 'es', true)).toEqual({ forceRtl: false, reload: true });
  });
});
