// The country a chippy builds in, chosen on first launch (device region pre-selected) and changeable in Settings.
// It sets the default units, trade words and spelling, currency, layout spacings, the stair code checked, and the
// materials catalogue (src/core/materials.ts). Kept on the phone only (settings).
// Fully guided: Australia, New Zealand, United Kingdom, Ireland, USA, Canada. Anywhere else: metric with generic
// guidance and no code limits claimed.
import type { UnitSystem } from './units.ts';

export type CountryCode = 'AU' | 'NZ' | 'GB' | 'IE' | 'US' | 'CA' | 'OTHER';
export const GUIDED: readonly CountryCode[] = Object.freeze(['AU', 'NZ', 'GB', 'IE', 'US', 'CA']);

export type Terms = {
  /** "mitre" (AU, NZ, UK, IE) or "miter" (US, CA). */
  mitre: string;
  Mitre: string;
  /** Moulding at the wall-ceiling join: cornice (AU, NZ), coving (UK, IE), crown (US, CA). */
  cornice: string;
  /** Short horizontal piece between studs: noggin (AU, UK, IE), dwang (NZ), blocking (US, CA). */
  noggin: string;
  /** Horizontal depth of a stair step: going (AU, NZ, UK, IE), run (US, CA). */
  going: string;
  Going: string;
  /** Wall frame: stud and joist words are shared. */
  metre: string;
};

export type CountryProfile = {
  code: CountryCode;
  name: string;
  units: UnitSystem;
  currency: string;
  /** BCP 47 locale for number and currency formatting. */
  locale: string;
  terms: Terms;
  /** Common stud/joist/rafter centres offered as one-tap presets, in mm. */
  spacings: number[];
  /** The residential timber framing standard to point to, where we're sure of it; null otherwise. */
  framingCode: string | null;
};

const commonwealth: Terms = { mitre: 'mitre', Mitre: 'Mitre', cornice: 'cornice', noggin: 'noggin', going: 'going', Going: 'Going', metre: 'metre' };
const american: Terms = { mitre: 'miter', Mitre: 'Miter', cornice: 'crown', noggin: 'blocking', going: 'run', Going: 'Run', metre: 'meter' };
const IN = 25.4;

export const COUNTRIES: Record<CountryCode, CountryProfile> = {
  AU: { code: 'AU', name: 'Australia', units: 'metric', currency: 'AUD', locale: 'en-AU', terms: commonwealth, spacings: [300, 400, 450, 600], framingCode: 'AS 1684' },
  NZ: { code: 'NZ', name: 'New Zealand', units: 'metric', currency: 'NZD', locale: 'en-NZ', terms: { ...commonwealth, noggin: 'dwang' }, spacings: [400, 480, 600], framingCode: 'NZS 3604' },
  GB: { code: 'GB', name: 'United Kingdom', units: 'metric', currency: 'GBP', locale: 'en-GB', terms: { ...commonwealth, cornice: 'coving' }, spacings: [400, 600], framingCode: null },
  IE: { code: 'IE', name: 'Ireland', units: 'metric', currency: 'EUR', locale: 'en-IE', terms: { ...commonwealth, cornice: 'coving' }, spacings: [400, 600], framingCode: null },
  US: { code: 'US', name: 'United States', units: 'imperial', currency: 'USD', locale: 'en-US', terms: american, spacings: [12 * IN, 16 * IN, 19.2 * IN, 24 * IN], framingCode: 'the IRC span tables' },
  CA: { code: 'CA', name: 'Canada', units: 'metric', currency: 'CAD', locale: 'en-CA', terms: { ...american, metre: 'metre' }, spacings: [12 * IN, 16 * IN, 24 * IN], framingCode: 'NBC Part 9 span tables' },
  OTHER: { code: 'OTHER', name: 'Somewhere else', units: 'metric', currency: '', locale: 'en', terms: commonwealth, spacings: [400, 450, 600], framingCode: null },
};

/** The device's region (ISO 3166 alpha-2, e.g. "AU") mapped to a profile; anything unguided is OTHER. UK = GB. */
export function countryFromRegion(region: string | null | undefined): CountryCode {
  const r = (region ?? '').toUpperCase();
  if (r === 'UK') return 'GB';
  return (GUIDED as readonly string[]).includes(r) ? (r as CountryCode) : 'OTHER';
}

export function parseCountry(v: unknown): CountryCode | null {
  return typeof v === 'string' && v in COUNTRIES ? (v as CountryCode) : null;
}

/** Money in the country's currency, or a plain number where there is none (OTHER). */
export function formatMoney(amount: number, country: CountryCode): string {
  const p = COUNTRIES[country];
  if (!Number.isFinite(amount)) return '-';
  if (!p.currency) return amount.toFixed(2);
  try {
    return new Intl.NumberFormat(p.locale, { style: 'currency', currency: p.currency }).format(amount);
  } catch {
    return `${p.currency} ${amount.toFixed(2)}`;
  }
}
