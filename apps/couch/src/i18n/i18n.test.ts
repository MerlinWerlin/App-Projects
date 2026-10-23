import { formatNumber, getLocale, pluralCategory, pseudo, setLocale, subscribeLocale, t } from './core';
import { isRtl, LOCALE_CODES, resolveLocale } from './locales';

describe('i18n core (owner-1016 T47)', () => {
  it('translates with English fallback and interpolation', () => {
    expect(t('app.settings.title', undefined, 'en')).toBe('Settings');
    expect(t('core.common.tvCount', { count: 1 }, 'en')).toBe('1 TV');
    expect(t('core.common.tvCount', { count: 3 }, 'en')).toBe('3 TVs');
  });

  it('numbers in params use the locale formatting', () => {
    expect(t('core.common.tvCount', { count: 1200 }, 'de')).toContain('1.200');
  });

  it('plural categories follow CLDR (Arabic has few/many)', () => {
    expect(pluralCategory(1, 'en')).toBe('one');
    expect(pluralCategory(3, 'ar')).toBe('few');
    expect(pluralCategory(11, 'ar')).toBe('many');
    expect(pluralCategory(5, 'ja')).toBe('other');
  });

  it('pseudo locale accents, keeps placeholders and grows ~40%', () => {
    const p = pseudo('Volume {n} up');
    expect(p).toContain('{n}');
    expect(p.startsWith('[')).toBe(true);
    expect(p.length).toBeGreaterThanOrEqual(Math.floor('Volume  up'.length * 1.4));
    expect(t('app.settings.title', undefined, 'pseudo')).not.toBe('Settings');
  });

  it('setLocale notifies subscribers once per change', () => {
    let n = 0;
    const off = subscribeLocale(() => (n += 1));
    setLocale('fr');
    setLocale('fr');
    expect(getLocale()).toBe('fr');
    setLocale('en');
    off();
    expect(n).toBe(2);
  });

  it('resolves phone languages to shipped locales', () => {
    expect(resolveLocale(['pt-PT'])).toBe('pt-BR');
    expect(resolveLocale(['zh-Hant-TW'])).toBe('zh-Hans');
    expect(resolveLocale(['sr-RS', 'de-AT'])).toBe('de');
    expect(resolveLocale(['ar_EG'])).toBe('ar');
    expect(resolveLocale([null, 'xx'])).toBe('en');
    expect(LOCALE_CODES).toHaveLength(11);
  });

  it('only Arabic is right-to-left', () => {
    expect(LOCALE_CODES.filter((c) => isRtl(c))).toEqual(['ar']);
    expect(formatNumber(1.5, 'fr')).toBe('1,5');
  });
});
