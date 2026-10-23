import { setLocale } from '../i18n/core';
import { createDemoSession, DEMO_APP_ART, DEMO_ART_H, DEMO_ART_W, DEMO_TV_APPS, DEMO_TVS, demoArtFor, SCREENSHOT_DEMO_APPS, shouldUseDemo } from './demo';
import { serviceFor } from './storeIcons';
import { isKey, KEY_LABEL, KEYS } from './keys';
import { PLATFORM_LABEL } from './types';

describe('demo mode', () => {
  it('is chosen automatically when there are no saved TVs', () => {
    expect(shouldUseDemo(0, null)).toBe(true);
    expect(shouldUseDemo(2, null)).toBe(false);
  });

  it('respects an explicit user choice', () => {
    expect(shouldUseDemo(0, false)).toBe(false);
    expect(shouldUseDemo(3, true)).toBe(true);
  });

  it('builds one connected MockTv per demo TV', async () => {
    const s = await createDemoSession({ sleep: async () => {} });
    expect(s.tvs).toHaveLength(DEMO_TVS.length);
    for (const tv of s.tvs) {
      expect(tv.platform).toBe('mock');
      expect(s.drivers.get(tv.id)?.connected).toBe(true);
    }
    expect(s.drivers.get('demo-3')?.isOn).toBe(false);
  });

  it('demo TV models carry no brand names', () => {
    const brands = Object.values(PLATFORM_LABEL).filter((l) => l !== 'Demo' && l !== 'IR');
    for (const tv of DEMO_TVS) for (const b of brands) expect(tv.model).not.toContain(b);
  });
});

describe('demo apps', () => {
  afterEach(() => setLocale('en'));

  it('are the real streaming apps from the store-icon catalogue, four pinned (owner 22 Oct 2026)', () => {
    expect(DEMO_TV_APPS.length).toBeGreaterThanOrEqual(12);
    for (const a of DEMO_TV_APPS) expect(serviceFor(a)?.id).toBe(a.id);
    expect(DEMO_TV_APPS.slice(0, 2).map((a) => a.name)).toEqual(['Netflix', 'YouTube']);
    expect(DEMO_TV_APPS.filter((a) => a.pinned).map((a) => a.id)).toEqual(['svc.netflix', 'svc.youtube', 'svc.disneyplus', 'svc.stan']);
  });

  it('screenshot apps keep invented names that follow the active language', () => {
    setLocale('de');
    expect(SCREENSHOT_DEMO_APPS.map((a) => a.name)).toContain('Kino');
  });

  it('every demo app has distinct original art inside its 4:3 box', () => {
    const froms = new Set<string>();
    for (const a of SCREENSHOT_DEMO_APPS) {
      const art = demoArtFor(a.id);
      expect(art).not.toBeNull();
      froms.add(art!.from);
      expect(art!.shapes.length).toBeGreaterThan(0);
      for (const sh of art!.shapes) {
        expect(sh.opacity === undefined || (sh.opacity >= 0 && sh.opacity <= 1)).toBe(true);
        if (sh.kind === 'poly') for (const [x, y] of sh.points) expect(x >= 0 && x <= DEMO_ART_W && y >= 0 && y <= DEMO_ART_H).toBe(true);
      }
    }
    expect(froms.size).toBe(SCREENSHOT_DEMO_APPS.length);
    expect(Object.keys(DEMO_APP_ART).sort()).toEqual(SCREENSHOT_DEMO_APPS.map((a) => a.id).sort());
    for (const a of DEMO_TV_APPS) expect(demoArtFor(a.id)).toBeNull();
    expect(demoArtFor('some.real.app')).toBeNull();
    expect(demoArtFor('toString')).toBeNull();
  });
});

describe('keys', () => {
  it('every key has an accessibility label', () => {
    for (const k of KEYS) expect(KEY_LABEL[k]).toBeTruthy();
  });
  it('isKey narrows', () => {
    expect(isKey('OK')).toBe(true);
    expect(isKey('NOPE')).toBe(false);
    expect(isKey(3)).toBe(false);
  });
});
