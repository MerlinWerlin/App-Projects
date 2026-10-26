/** Speech locales are regional BCP-47 tags, independent of the UI's translation catalogue. */
interface Locale { language: string; script?: string; region?: string; baseName: string }

// Do not depend on Intl.Locale/maximize: availability varies between Hermes builds.
function locale(tag: string): Locale | null {
  const parts = tag.trim().replace(/_/g, '-').split('-');
  if (!/^[a-z]{2,3}$/i.test(parts[0] ?? '') || parts.some((part) => !/^[a-z0-9]{2,8}$/i.test(part))) return null;
  const language = parts.shift()!.toLowerCase();
  const script = /^[a-z]{4}$/i.test(parts[0] ?? '') ? parts.shift()!.toLowerCase().replace(/^./, (c) => c.toUpperCase()) : undefined;
  const region = /^(?:[a-z]{2}|[0-9]{3})$/i.test(parts[0] ?? '') ? parts.shift()!.toUpperCase() : undefined;
  return { language, script, region, baseName: [language, script, region, ...parts.map((p) => p.toLowerCase())].filter(Boolean).join('-') };
}

const DEFAULT_REGIONS: Record<string, string> = { en: 'US', fr: 'FR', de: 'DE', es: 'ES', it: 'IT', pt: 'BR', zh: 'CN', ja: 'JP', ko: 'KR', hi: 'IN', ar: 'SA', nl: 'NL', ru: 'RU' };
const scriptOf = (tag: Locale) => tag.script ?? (tag.language === 'zh' ? (['TW', 'HK', 'MO'].includes(tag.region ?? '') ? 'Hant' : 'Hans') : undefined);

export function selectSpeechLocale(requested: string, device: string, supported?: readonly string[]): string | null {
  const phone = locale(device) ?? locale('en-US')!;
  const wanted = requested === 'system' ? phone : locale(requested) ?? phone;
  const defaultRegion = wanted.language === 'zh' && wanted.script === 'Hant' ? 'TW' : DEFAULT_REGIONS[wanted.language];
  const regional = wanted.region ? wanted.baseName : defaultRegion ? `${wanted.language}-${defaultRegion}` : undefined;
  const candidates = [
    wanted.region ? wanted.baseName : '',
    phone.region && phone.language === wanted.language && (!wanted.script || scriptOf(phone) === wanted.script) ? phone.baseName : '',
    regional,
  ].filter((tag): tag is string => Boolean(tag));

  // Older Android services cannot enumerate languages. Still never send a bare "en".
  if (supported === undefined) return candidates.find((tag) => locale(tag)?.region) ?? null;
  const available = supported.map(locale).filter((tag): tag is Locale => tag !== null);
  for (const candidate of candidates) {
    const match = available.find((tag) => tag.baseName.toLowerCase() === candidate.toLowerCase());
    if (match) return match.baseName;
  }
  const match = available.find((tag) => tag.language === wanted.language
    && (!wanted.script || scriptOf(tag) === wanted.script));
  return match?.baseName ?? null;
}
