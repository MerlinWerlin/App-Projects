import { selectSpeechLocale } from './speechLocale';

const apple = ['es-US', 'en-CA', 'en-US', 'en-AU', 'fr-FR', 'en-GB', 'zh-CN', 'zh-TW'];

describe('regional speech locale selection', () => {
  it('fixes the reported bare en failure with the phone region', () => {
    expect(selectSpeechLocale('en', 'en-AU', apple)).toBe('en-AU');
  });
  it('uses the phone language even when UI translations fall back to English', () => {
    expect(selectSpeechLocale('system', 'fr-FR', apple)).toBe('fr-FR');
  });
  it('keeps an explicit supported region', () => {
    expect(selectSpeechLocale('en-GB', 'en-AU', apple)).toBe('en-GB');
  });
  it('normalizes Apple underscore tags and casing', () => {
    expect(selectSpeechLocale('en_au', 'en-US', ['en_AU'])).toBe('en-AU');
  });
  it('chooses a supported same-language region when the requested region is absent', () => {
    expect(selectSpeechLocale('en-NZ', 'en-AU', apple)).toBe('en-AU');
  });
  it('never silently changes to another language', () => {
    expect(selectSpeechLocale('de-DE', 'en-AU', apple)).toBeNull();
  });
  it('does not conflate Traditional and Simplified Chinese', () => {
    expect(selectSpeechLocale('zh-Hant', 'en-AU', apple)).toBe('zh-TW');
    expect(selectSpeechLocale('zh-Hant', 'en-AU', ['zh-CN'])).toBeNull();
  });
  it('handles services that cannot enumerate locales without sending bare language codes', () => {
    expect(selectSpeechLocale('en', 'en-AU')).toBe('en-AU');
    expect(selectSpeechLocale('en', 'en')).toBe('en-US');
  });
  it('treats an actual empty supported list as unavailable', () => {
    expect(selectSpeechLocale('system', 'en-AU', [])).toBeNull();
  });
  it('ignores malformed saved preferences and service entries', () => {
    expect(selectSpeechLocale('bad_???', 'en-AU', ['???', 'en-AU'])).toBe('en-AU');
  });
  it('works on Hermes without Intl.Locale', () => {
    const descriptor = Object.getOwnPropertyDescriptor(Intl, 'Locale')!;
    try {
      Object.defineProperty(Intl, 'Locale', { value: undefined, configurable: true });
      expect(selectSpeechLocale('en', 'en-AU', apple)).toBe('en-AU');
    } finally {
      Object.defineProperty(Intl, 'Locale', descriptor);
    }
  });
});
