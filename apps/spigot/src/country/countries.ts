/**
 * Country profiles. The person picks their country at first launch (device region pre-selected); it decides units,
 * the code Spigot names in notes, minimum grades, velocity limits, trade terms and the materials on offer.
 * Every value cites its source here or in catalog.ts / docs/COUNTRY_DATA.md; anything we could not verify is null or
 * generic, and the app then shows generic guidance instead of a guess.
 */
import { getLocales } from 'expo-localization';
import type { CountryCode, CountryProfile, Terms } from './types';
import { COUNTRY_CODES } from '../state/data';
import { CATALOG } from './catalog';

const METRIC_TERMS: Terms = { fall: 'Fall', fallLower: 'fall', centre: 'centre', takeoff: 'Take-off' };
const US_TERMS: Terms = { fall: 'Slope', fallLower: 'slope', centre: 'center', takeoff: 'Take-off' };
const CA_TERMS: Terms = { fall: 'Slope', fallLower: 'slope', centre: 'centre', takeoff: 'Take-off' };

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
    code: 'the NCC (B1P2)',
  },
  usGallons: false,
  commonGrades: [40, 60, 80, 100],
  stockLengthMm: 6000,
  ...CATALOG.AU,
};

/**
 * New Zealand. Drains: NZBC G13/AS2 (2nd ed. Amdt 10, 2023) para 3.5.3 Table 2: flattest listed gradient DN80 1:100,
 * DN100 1:120, DN150 1:200. Above-ground discharge pipes DN80/100: G13/AS1 Table 4, 1:60. G13/AS3 also accepts
 * AS/NZS 3500.2. Velocity: G12/AS1 sets none (3.0 m/s via AS/NZS 3500.1 could not be confirmed) -> null.
 */
const NZ: CountryProfile = {
  code: 'NZ', name: 'New Zealand', locale: 'en-NZ', defaultUnit: 'metric', currency: 'NZD', terms: METRIC_TERMS,
  codeName: 'NZ Building Code G12/G13',
  checkNote: 'Check against the fitting manufacturer’s data and the Building Code (G12/G13 Acceptable Solutions or AS/NZS 3500) before you cut.',
  minGrades: {
    rules: [
      { size: 'DN80 drain', n: 100, note: 'waste water only' }, { size: 'DN100 drain', n: 120 }, { size: 'DN150 drain', n: 200 },
      { size: 'DN80 discharge pipe', n: 60, note: 'above ground' }, { size: 'DN100 discharge pipe', n: 60, note: 'above ground' },
    ],
    source: 'Drains: G13/AS2 Table 2 (para 3.5.3), the flattest gradient listed for each size; levelling devices are needed at 1:80 or flatter. Discharge pipes: G13/AS1 Table 4.',
  },
  maxVelocity: null,
  usGallons: false,
  commonGrades: [40, 60, 80, 120],
  stockLengthMm: 6000,
  ...CATALOG.NZ,
};

/**
 * United Kingdom (England). Approved Document H (2015) Table 6, para 2.34: foul drains 75 and 100 mm at 1:40 when peak
 * flow is under 1 l/s; 100 mm at 1:80 above 1 l/s with at least 1 WC; 150 mm at 1:150 with at least 5 WCs.
 * Velocity: CIPHE Plumbing Engineering Services Design Guide, Hot and cold water supplies, Table 17 (noise-based).
 * Scotland and Northern Ireland have their own documents, which the check note says.
 */
const GB: CountryProfile = {
  code: 'GB', name: 'United Kingdom', locale: 'en-GB', defaultUnit: 'metric', currency: 'GBP', terms: METRIC_TERMS,
  codeName: 'Approved Document H',
  checkNote: 'Check against the fitting manufacturer’s data and the Building Regulations (Approved Document H in England; Scotland and Northern Ireland have their own) before you cut.',
  minGrades: {
    rules: [
      { size: '75 mm', n: 40, note: 'peak flow under 1 l/s' }, { size: '100 mm', n: 40, note: 'peak flow under 1 l/s' },
      { size: '100 mm (1 WC+)', n: 80, note: 'peak flow over 1 l/s, at least 1 WC' }, { size: '150 mm (5 WCs+)', n: 150, note: 'at least 5 WCs' },
    ],
    source: 'Approved Document H (2015), Table 6, foul drains. Branch pipes are set in mm fall per metre (Table 2).',
  },
  maxVelocity: {
    rules: [
      { service: 'Risers, ducts, plant rooms (metal pipe)', max: 2.0 }, { service: 'Ceiling voids, circulation areas', max: 1.5 },
      { service: 'Meeting and seating areas', max: 1.25 }, { service: 'Bedrooms', max: 1.0 },
    ],
    source: 'CIPHE design guide, hot and cold water supplies, Table 17: noise-based limits (plastic risers up to 2.5 m/s).',
    code: 'CIPHE guidance',
  },
  usGallons: false,
  commonGrades: [40, 80, 150],
  stockLengthMm: 3000,
  ...CATALOG.GB,
};

/**
 * Ireland. TGD H (2010, applying from 2017) Table 6, para 1.3.4.3: 100 mm at 1:60 for one dwelling (peak under
 * 2.5 l/s, at least 1 wc) or 1:100 for up to 3 dwellings; 150 mm at 1:150 for 3 to 8 dwellings. Minimum foul drain
 * 100 mm. Velocity: I.S. EN 806-3 / S.R. 50-3 could not be read -> null.
 */
const IE: CountryProfile = {
  code: 'IE', name: 'Ireland', locale: 'en-IE', defaultUnit: 'metric', currency: 'EUR', terms: METRIC_TERMS,
  codeName: 'TGD H (Building Regulations)',
  checkNote: 'Check against the fitting manufacturer’s data and the Building Regulations (TGD H and S.R. 50) before you cut.',
  minGrades: {
    rules: [
      { size: '100 mm (1 dwelling)', n: 60, note: 'peak flow under 2.5 l/s, at least 1 wc' }, { size: '100 mm (up to 3)', n: 100, note: 'up to 3 dwellings' },
      { size: '150 mm (3 to 8)', n: 150, note: '3 to 8 dwellings, at least 5 wcs' },
    ],
    source: 'Technical Guidance Document H, Table 6 (para 1.3.4.3). The minimum foul drain is 100 mm.',
  },
  maxVelocity: null,
  usGallons: false,
  commonGrades: [40, 60, 100, 150],
  stockLengthMm: 3000,
  ...CATALOG.IE,
};

/** 1:48 = 1/4 in per ft, 1:96 = 1/8 in per ft, 1:192 = 1/16 in per ft (12 in ÷ N). */
export const usGrade = (n: number) => (n === 48 ? '¼″/ft' : n === 96 ? '⅛″/ft' : n === 192 ? '1/16″/ft' : `1:${n}`);

/**
 * United States. IPC Table 704.1: horizontal drainage 2-1/2 in or less 1/4 in/ft (1:48), 3–6 in 1/8 in/ft (1:96),
 * 8 in and larger 1/16 in/ft (1:192) (read in ICC 2018 IPC Essentials and the IPC-based NYC 2022 code). UPC 708.1: 1/4
 * in/ft for all sizes, 1/8 in/ft for 4 in+ building drains only with approval (read via the UPC-based California code).
 * Velocity: copper 8 ft/s cold, 5 ft/s hot (CDA Copper Tube Handbook; same in UPC 610.12.1 via the California code).
 */
const US: CountryProfile = {
  code: 'US', name: 'United States', locale: 'en-US', defaultUnit: 'imperial', currency: 'USD', terms: US_TERMS,
  codeName: 'the IPC or UPC',
  checkNote: 'Check against the fitting manufacturer’s data and the plumbing code your state or city adopted (IPC or UPC) before you cut.',
  minGrades: {
    rules: [
      { size: '2½ in or less', n: 48, note: '¼ in per ft' },
      { size: '3 to 6 in', n: 96, note: '⅛ in per ft (IPC; the UPC wants ¼ in per ft unless approved)' },
      { size: '8 in and larger', n: 192, note: '1/16 in per ft (IPC)' },
    ],
    source: 'IPC Table 704.1. The UPC (708.1) asks for ¼ in per ft at every size, with ⅛ in per ft for 4 in+ building drains only when approved.',
  },
  maxVelocity: {
    rules: [{ service: 'Cold water (copper)', max: 2.44 }, { service: 'Hot water (copper)', max: 1.52 }],
    source: 'Copper Development Association Copper Tube Handbook: 8 ft/s cold, 5 ft/s hot (UPC 610.12.1 uses the same figures).',
    code: 'copper guidance (8 ft/s)',
  },
  usGallons: true,
  gradeLabel: usGrade,
  commonGrades: [48, 96, 192],
  stockLengthMm: 3048,
  ...CATALOG.US,
};

/**
 * Canada. NPC 2020 Div B 2.4.8.1.(1): drainage pipe 3 in or less at 1 in 50; Table 2.4.10.6.-C flattest slopes 4 in
 * 1 in 100, 8–10 in 1 in 200, 12–15 in 1 in 400 (the 5–6 in column could not be confirmed, so it is left out).
 * Provinces adopt their own editions. Velocity: NPC 2.6.3.5 defers to the manufacturer; copper figures from the CDA
 * handbook. Units: imperial by default (retail sizes are in inches); flow stays in litres, as in the NPC.
 */
const CA: CountryProfile = {
  code: 'CA', name: 'Canada', locale: 'en-CA', defaultUnit: 'imperial', currency: 'CAD', terms: CA_TERMS,
  codeName: 'the National Plumbing Code',
  checkNote: 'Check against the fitting manufacturer’s data and your provincial plumbing code (based on the National Plumbing Code) before you cut.',
  minGrades: {
    rules: [
      { size: '3 in or less', n: 50 }, { size: '4 in', n: 100, note: 'flattest slope in Table 2.4.10.6.-C' },
      { size: '8 to 10 in', n: 200 }, { size: '12 to 15 in', n: 400 },
    ],
    source: 'National Plumbing Code of Canada 2020, 2.4.8.1 and Table 2.4.10.6.-C. Check your province’s edition (NPC 2025 is out).',
  },
  maxVelocity: {
    rules: [{ service: 'Cold water (copper)', max: 2.4 }, { service: 'Hot water (copper)', max: 1.5 }],
    source: 'The NPC (2.6.3.5) defers to the manufacturer; copper figures from the Copper Development Association handbook.',
    code: 'copper guidance (2.4 m/s)',
  },
  usGallons: false,
  commonGrades: [50, 100, 200],
  stockLengthMm: 3658,
  ...CATALOG.CA,
};

/** Anywhere else: metric, generic guidance, the generic materials list, no code-specific limits. */
const OTHER: CountryProfile = {
  code: 'OTHER', name: 'Somewhere else', locale: 'en-GB', defaultUnit: 'metric', currency: 'USD', terms: METRIC_TERMS,
  codeName: 'Generic guidance',
  checkNote: 'Check against the fitting manufacturer’s data and your local plumbing code before you cut.',
  minGrades: null,
  maxVelocity: null,
  usGallons: false,
  commonGrades: [40, 60, 80, 100],
  stockLengthMm: 6000,
  ...CATALOG.OTHER,
};

export const PROFILES: Record<CountryCode, CountryProfile> = { AU, NZ, GB, IE, US, CA, OTHER };

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
