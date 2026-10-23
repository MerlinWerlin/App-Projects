import { applyDirection, currentIsRtl, reloadAppFallback, syncDirectionOnStart, type I18nManagerLike } from '../src/native/rtl';

function hasModule(id: string): boolean {
  try {
    require(id);
    return true;
  } catch {
    return false;
  }
}

function fakeI18n(isRTL: boolean) {
  const log: string[] = [];
  const i18n: I18nManagerLike = {
    isRTL,
    allowRTL: (v) => log.push(`allow ${v}`),
    forceRTL: (v) => log.push(`force ${v}`),
    swapLeftAndRightInRTL: (v) => log.push(`swap ${v}`),
  };
  return { i18n, log };
}

describe('RTL switching (owner-1016 T50)', () => {
  it('switching to Arabic forces RTL and reloads', async () => {
    const { i18n, log } = fakeI18n(false);
    let reloads = 0;
    expect(await applyDirection('ar', { i18n, reload: () => void reloads++ })).toBe(true);
    expect(log).toEqual(['allow true', 'force true', 'swap true']);
    expect(reloads).toBe(1);
  });

  it('switching from Arabic back to English forces LTR and reloads', async () => {
    const { i18n, log } = fakeI18n(true);
    let reloads = 0;
    expect(await applyDirection('en', { i18n, reload: async () => void reloads++ })).toBe(true);
    expect(log).toContain('force false');
    expect(reloads).toBe(1);
  });

  it('same direction: no reload, but the stored flag is (re)written', async () => {
    const { i18n, log } = fakeI18n(false);
    let reloads = 0;
    expect(await applyDirection('ja', { i18n, reload: () => void reloads++ })).toBe(false);
    expect(log).toEqual(['allow true', 'force false', 'swap true']);
    expect(reloads).toBe(0);
  });

  it('never throws: missing I18nManager, failing reload, throwing manager', async () => {
    expect(await applyDirection('ar', { i18n: null, reload: () => {} })).toBe(false);
    const { i18n } = fakeI18n(false);
    expect(
      await applyDirection('ar', {
        i18n,
        reload: async () => {
          throw new Error('no updates');
        },
      }),
    ).toBe(true);
    const bad = { ...fakeI18n(false).i18n, allowRTL: () => { throw new Error('x'); } };
    expect(await applyDirection('ar', { i18n: bad, reload: () => {} })).toBe(false);
    expect(syncDirectionOnStart('ar', { i18n: bad })).toBe(false);
  });

  it('syncDirectionOnStart forces without reloading', () => {
    const { i18n, log } = fakeI18n(false);
    expect(syncDirectionOnStart('ar', { i18n })).toBe(true);
    expect(log).toEqual(['allow true', 'force true', 'swap true']);
    const same = fakeI18n(true);
    expect(syncDirectionOnStart('ar', { i18n: same.i18n })).toBe(false);
    expect(same.log).toEqual(['allow true', 'force true', 'swap true']);
  });

  it('defaults never throw (with or without react-native / expo-updates installed)', async () => {
    expect(typeof currentIsRtl()).toBe('boolean');
    expect(currentIsRtl({ i18n: fakeI18n(true).i18n })).toBe(true);
    if (currentIsRtl() === false && !hasModule('react-native')) {
      await expect(reloadAppFallback()).resolves.toBeUndefined();
      await expect(applyDirection('ar')).resolves.toBe(false);
    }
    expect(typeof syncDirectionOnStart('en')).toBe('boolean');
  });
});
