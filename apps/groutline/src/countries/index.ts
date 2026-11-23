import { notchCoverage, type Notch } from '../core/notch.ts';
import type { UnitSystem } from '../core/units.ts';
import { AU } from './au.ts';
import { CA } from './ca.ts';
import { GENERIC } from './generic.ts';
import { IE } from './ie.ts';
import { NZ } from './nz.ts';
import { GB } from './uk.ts';
import { US } from './us.ts';
import type { AdhesiveItem, Country, CountryCode } from './types.ts';

export const COUNTRIES: Country[] = [AU, NZ, GB, IE, US, CA];
const BY_CODE: Record<string, Country> = Object.fromEntries([...COUNTRIES, GENERIC].map(c => [c.code, c]));

/** Device region (ISO 3166 alpha-2) to a guided country; UK is "GB" in ISO. Anything else is the generic fallback. */
export function countryForRegion(region: string | null | undefined): Country {
  const r = (region ?? '').toUpperCase();
  if (r === 'UK') return GB;
  return BY_CODE[r] ?? GENERIC;
}

export function getCountry(code: CountryCode | string | null | undefined): Country {
  return (code && BY_CODE[code]) || GENERIC;
}

/** The unit system to use: the person's override, else the country's. */
export const systemFor = (c: Country, override: UnitSystem | null | undefined): UnitSystem => override ?? c.system;

/**
 * kg/m² for an adhesive and notch: the maker's figure when the product lists that notch (within 0.5 mm), otherwise
 * the generic rate per mm of notch depth (lightweight products use the lightweight rate).
 */
export function adhesiveRate(item: AdhesiveItem | null, notch: Notch): { kgPerM2: number; fromMaker: boolean } {
  const hit = item?.coverage?.find(c => Math.abs(c.notchMm - notch.mm) <= 0.5);
  if (hit) return { kgPerM2: hit.kgPerM2, fromMaker: true };
  return { kgPerM2: notchCoverage(notch, !!item?.lightweight), fromMaker: false };
}

export type { Country, CountryCode } from './types.ts';
export { GENERIC };
