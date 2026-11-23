/**
 * Country profiles. The person picks their country at first launch (device region pre-selected); it decides units,
 * the code Spigot names in notes, minimum grades, velocity limits, trade terms and the materials on offer.
 * Every value cites its source here or in catalog.ts; anything we could not verify is null / generic, and the app
 * then shows generic guidance instead of a guess. Research notes: docs/COUNTRY_DATA.md.
 */
import { getLocales } from 'expo-localization';
import type { CountryCode, CountryProfile, Terms } from './types';
import { COUNTRY_CODES } from '../state/data';
import { CATALOG } from './catalog';

const METRIC_TERMS: Terms = { fall: 'Fall', fallLower: 'fall', centre: 'centre', takeoff: 'Take-off' };
const US_TERMS: Terms = { fall: 'Slope', fallLower: 'slope', centre: 'center', takeoff: 'Take-off' };

/**
 * Australia. Minimum grades: AS/NZS 3500.2:2003 Clause 3.4.1, Table 3.2 (superseded by the 2025 edition; shown with
 * that caveat). Velocity: NCC 2022 Vol 3 (Plumbing Code of Australia) B1P2 for cold water; heated water limits from
 * MM Kembla's AS 1432 guide (D54/18 p.6). Materials: catalog.ts AU.
 */
const AU: CountryProfile = {
  code: 'AU', name: 'Australia', locale: 'en-AU', defaultUnit: 'metric', currency: 'AUD', terms: METRIC_TERMS,
  codeName: 'AS/NZS 3500 and the NCC',
  checkNote: 'Check against the fitting manufacturer’s data, AS/NZS 3500 and your state’s plumbing rules before you cut.',
  minGrades: {
    rules: [
      { size: 'DN65', n: 40 }, { size: 'DN80', n: 60 },
      { size: 'DN100', n: 60, note: '1:100 allowed for drains from septic tanks, treatment plants and unvented tundish discharges' },
      { size: 'DN125', n: 80 }, { size: 'DN150', n: 100 }, { size: 'DN225', n: 154 }, { size: 'DN300', n: 250 },
    ],
    source: 'AS/NZS 3500.2:2003, Table 3.2. Check the current edition (2025) and your state’s rules: reduced grades are allowed in some cases.',
  },
  maxVelocity: {
    rules: [
      { service: 'Cold water', max: 3.0 }, { service: 'Heated water, not circulating', max: 3.0 },
      { service: 'Heated water, circulating flow', max: 1.2 }, { service: 'Heated water, circulating return', max: 1.0 },
    ],
    source: 'Cold water: NCC Volume Three, B1P2 (not over 3.0 m/s for more than 1 % of the peak hour). Heated water: MM Kembla copper guide.',
  },
  commonGrades: [40, 60, 80, 100],
  stockLengthMm: 6000,
  ...CATALOG.AU,
};

/** Anywhere else: metric, generic guidance, the generic materials list, no code-specific limits. */
const OTHER: CountryProfile = {
  code: 'OTHER', name: 'Somewhere else', locale: 'en-GB', defaultUnit: 'metric', currency: 'USD', terms: METRIC_TERMS,
  codeName: 'Generic guidance',
  checkNote: 'Check against the fitting manufacturer’s data and your local plumbing code before you cut.',
  minGrades: null,
  maxVelocity: null,
  commonGrades: [40, 60, 80, 100],
  stockLengthMm: 6000,
  ...CATALOG.OTHER,
};

export const PROFILES: Record<CountryCode, CountryProfile> = {
  AU,
  NZ: { ...OTHER, code: 'NZ', name: 'New Zealand', locale: 'en-NZ', currency: 'NZD' },
  GB: { ...OTHER, code: 'GB', name: 'United Kingdom', locale: 'en-GB', currency: 'GBP' },
  IE: { ...OTHER, code: 'IE', name: 'Ireland', locale: 'en-IE', currency: 'EUR' },
  US: { ...OTHER, code: 'US', name: 'United States', locale: 'en-US', currency: 'USD', defaultUnit: 'imperial', terms: US_TERMS },
  CA: { ...OTHER, code: 'CA', name: 'Canada', locale: 'en-CA', currency: 'CAD' },
  OTHER,
};

export const COUNTRY_LIST: CountryCode[] = ['AU', 'NZ', 'GB', 'IE', 'US', 'CA', 'OTHER'];

export function profileFor(code: CountryCode | null | undefined): CountryProfile {
  return PROFILES[code ?? 'OTHER'] ?? OTHER;
}

/** Maps an ISO 3166 region to a supported profile ("UK" is accepted as GB); anything else is OTHER. */
export function countryFromRegion(region: string | null | undefined): CountryCode {
  const r = (region ?? '').toUpperCase();
  const code = r === 'UK' ? 'GB' : r;
  return (COUNTRY_CODES as readonly string[]).includes(code) && code !== 'OTHER' ? (code as CountryCode) : 'OTHER';
}

export function deviceCountry(): CountryCode {
  try {
    return countryFromRegion(getLocales()[0]?.regionCode);
  } catch {
    return 'OTHER';
  }
}
