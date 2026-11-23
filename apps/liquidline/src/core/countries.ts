// Country profiles: units, refrigerants in common use, licensing and standards names, and the copper line-set
// (pair-coil) catalogue local HVAC wholesalers commonly stock. Researched 23 Nov 2026; every value's source and how
// firmly it was checked is in docs/SOURCES.md (C = read on the page, S = search listing only, I = inferred).
// Shown in the app as guidance with "check locally" wording. Retailer and brand names stay in docs only, never in
// the UI. A value that could not be checked is either left out or marked `checked: false` and shown as "typical".
//
// Code-doc notes on where catalogue values came from (not shown in the app):
//  AU: pair coil sizes 1/4x3/8 … 3/8x3/4 in 20 m (Reece "Ardent" pair coil PDF, Sparky Direct, C); 10 m retail coils
//      (Bunnings iTemp, C); 18 m (MM Kembla, S); insulation 9 mm (Ricambi, S), 10 mm (Bunnings, C), 13 mm fire-rated
//      (Airconditioning-Online, C). Tube to AS/NZS 1571.
//  NZ: same five sizes in 20 m (Smooth-Air "PairCoil Premium Fire Rated", C); 5/10 m boxes (Ideal Electrical, S).
//  GB: 1/4x3/8 … 3/8x5/8 in 20 m (FSW, C); 25 m (Greenmill / Lawton, C); 15 m install kits incl. 3/8x3/4
//      (Orion Air Sales, C); 9 and 13 mm insulation (C).
//  IE: 1/4x1/2 and 3/8x5/8 in 20 and 25 m, 9 or 13 mm (Heat Merchants / Lawton, C); other sizes inferred from GB.
//  US: 15/25/35/50 ft sets 1/4x3/8 … 3/8x7/8 (Mueller Streamline submittal C; Ferguson / SupplyHouse listings S);
//      mini-split twin tube with 1/2" wall (JMF EZ-Pull, C); pre-charged quick-connect 16/25/35/50 ft (MRCOOL at
//      Lowe's, S).
//  CA: 1/4x3/8 x 50 ft, 1/4x1/2 x 25/50 ft, 3/8x3/4 x 50 ft (Great Lakes Copper EZ-Roll at RSL, S); otherwise as US (I).
//  Charge rates: R32 ductless 20 g/m (Mitsubishi Electric AU MSZ-AP, Daikin, Fujitsu, C); 3/8" R32 35 g/m (Daikin
//      ARXM71N, C); US ducted R410A / R454B 0.6 oz/ft beyond 15 ft (Carrier, Goodman, Lennox, C).

import type { LengthUnit, MassUnit, PressureUnit, TempUnit, VacuumUnit } from './units.ts';

export type CountryCode = 'AU' | 'NZ' | 'GB' | 'IE' | 'US' | 'CA' | 'OTHER';
export type Pair = { liquid: string; suction: string };
export type LineSetCatalogue = {
  unit: LengthUnit;
  pairs: Pair[];
  /** Coil lengths commonly stocked, in `unit`. */
  lengths: number[];
  insulation: string[];
  /** Pre-charged quick-connect sets, if sold there (lengths in `unit`). */
  precharged?: number[];
  note: string;
  checked: boolean;
};
export type ChargeDefault = { liquid: '1/4"' | '3/8"'; gPerM: number; prechargedM: number; note: string };
export type Rule = { text: string; checked: boolean };
export type CountryProfile = {
  code: CountryCode;
  name: string;
  flag: string;
  /** Fully guided (checked local data) or generic metric fallback. */
  guided: boolean;
  units: { pressure: PressureUnit; temp: TempUnit; length: LengthUnit; mass: MassUnit; vacuum: VacuumUnit };
  currency: { code: string; symbol: string };
  /** US spelling ("meter", "color") or Commonwealth ("metre", "colour"). */
  spelling: 'US' | 'GB';
  /** What techs call the twin insulated copper: "pair coil" or "line set". */
  lineSetWord: string;
  refrigerants: string[];
  /** How many of `refrigerants` to show under "Common here". */
  commonCount: number;
  licence: Rule[];
  standards: string[];
  rules: Rule[];
  /** Standard named in A2L / A3 safety notes. */
  flammableStandard: string;
  lineSets: LineSetCatalogue;
  charge: ChargeDefault[];
};

const ALL = ['R32', 'R410A', 'R454B', 'R290', 'R134a', 'R404A', 'R407C', 'R22', 'R600a', 'R1234yf', 'R1234ze(E)', 'R448A', 'R449A', 'R513A', 'R507A', 'R744', 'R717'];
const order = (first: string[]) => [...first, ...ALL.filter((r) => !first.includes(r))];

const METRIC_CHARGE: ChargeDefault[] = [
  { liquid: '1/4"', gPerM: 20, prechargedM: 10, note: 'Typical for R32 and R410A ductless splits: 20 g/m beyond 7.5–15 m depending on brand. Use the nameplate or manual.' },
  { liquid: '3/8"', gPerM: 35, prechargedM: 10, note: 'Typical for R32 with a 3/8" liquid line (R410A is often higher). Use the nameplate or manual.' },
];
const IMPERIAL_CHARGE: ChargeDefault[] = [
  { liquid: '1/4"', gPerM: 20, prechargedM: 7.62, note: 'Typical ductless: about 0.2 oz/ft beyond 25 ft (some brands pre-charge for 49 ft). Use the nameplate or manual.' },
  { liquid: '3/8"', gPerM: 55.8, prechargedM: 4.572, note: 'Typical ducted R410A / R454B: 0.6 oz/ft beyond 15 ft. Use the nameplate or manual.' },
];

const P = (liquid: string, suction: string): Pair => ({ liquid, suction });
const FIVE = [P('1/4"', '3/8"'), P('1/4"', '1/2"'), P('1/4"', '5/8"'), P('3/8"', '5/8"'), P('3/8"', '3/4"')];

export const COUNTRIES: CountryProfile[] = [
  {
    code: 'AU', name: 'Australia', flag: '🇦🇺', guided: true,
    units: { pressure: 'kPa', temp: 'C', length: 'm', mass: 'g', vacuum: 'micron' },
    currency: { code: 'AUD', symbol: '$' }, spelling: 'GB', lineSetWord: 'pair coil',
    refrigerants: order(['R32', 'R410A', 'R22', 'R134a', 'R404A', 'R448A', 'R449A', 'R290', 'R600a', 'R744']), commonCount: 10,
    licence: [
      { text: 'Refrigerant Handling Licence (ARCtick), issued by the Australian Refrigeration Council. Types include RAC01 full and RSS03 restricted split (single-head under 18 kW).', checked: true },
      { text: 'Businesses that buy, sell or handle refrigerant need a Refrigerant Trading Authorisation.', checked: true },
    ],
    standards: ['AS/NZS 5149 Refrigerating systems and heat pumps: safety and environmental requirements'],
    rules: [
      { text: 'Since 1 Jul 2024, new single-head splits and other small AC (≤2.6 kg) can’t use refrigerant with GWP over 750; multi-head and VRF since 1 Jul 2025. Ducted systems are excluded.', checked: false },
      { text: 'R22: servicing existing equipment only. HCFC equipment imports are banned and bulk HCFC imports end 1 Jan 2030.', checked: false },
    ],
    flammableStandard: 'AS/NZS 5149',
    lineSets: { unit: 'm', pairs: FIVE, lengths: [10, 18, 20], insulation: ['9 mm', '10 mm', '13 mm fire-rated'], note: 'Imperial OD copper (AS/NZS 1571) with metric wall. 20 m is the standard trade coil.', checked: true },
    charge: METRIC_CHARGE,
  },
  {
    code: 'NZ', name: 'New Zealand', flag: '🇳🇿', guided: true,
    units: { pressure: 'kPa', temp: 'C', length: 'm', mass: 'g', vacuum: 'micron' },
    currency: { code: 'NZD', symbol: '$' }, spelling: 'GB', lineSetWord: 'pair coil',
    refrigerants: order(['R32', 'R410A', 'R134a', 'R404A', 'R448A', 'R449A', 'R290', 'R744', 'R1234yf', 'R22']), commonCount: 10,
    licence: [
      { text: 'Approved Filler certificate (from a WorkSafe-authorised compliance certifier) to fill refrigerant cylinders; separate courses for A1 and for A2/A2L flammable refrigerants. Suppliers ask for it before selling refrigerant.', checked: false },
      { text: 'A WorkSafe licence for refrigeration and air conditioning technicians (flammable, toxic and high-pressure refrigerants) is proposed but was not in force when this was checked (Nov 2026).', checked: false },
    ],
    standards: ['AS/NZS 5149 Refrigerating systems and heat pumps: safety and environmental requirements'],
    rules: [
      { text: 'Bulk HFC and HCFC imports need an EPA permit. R22 is legacy: servicing only.', checked: false },
    ],
    flammableStandard: 'AS/NZS 5149',
    lineSets: { unit: 'm', pairs: FIVE, lengths: [5, 10, 20], insulation: ['9 mm', '13 mm fire-rated'], note: 'Imperial OD copper (AS/NZS 1571). 20 m trade coils; 5 m and 10 m boxes.', checked: true },
    charge: METRIC_CHARGE,
  },
  {
    code: 'GB', name: 'United Kingdom', flag: '🇬🇧', guided: true,
    units: { pressure: 'bar', temp: 'C', length: 'm', mass: 'g', vacuum: 'micron' },
    currency: { code: 'GBP', symbol: '£' }, spelling: 'GB', lineSetWord: 'pair coil',
    refrigerants: order(['R32', 'R410A', 'R290', 'R134a', 'R513A', 'R448A', 'R449A', 'R744', 'R1234ze(E)', 'R404A']), commonCount: 10,
    licence: [
      { text: 'F-gas personnel certificate: Category I (all work), II (leak checks on any system; other work under 3 kg), III (recovery under 3 kg), IV (leak checks only). GB F-gas Regulation.', checked: true },
      { text: 'Businesses (sole traders too) working on other people’s F-gas equipment need F-gas company certification. UK certificates aren’t valid for work in the EU.', checked: false },
    ],
    standards: ['BS EN 378 Refrigerating systems and heat pumps: safety and environmental requirements'],
    rules: [
      { text: 'Since 1 Jan 2025, single splits under 3 kg using F-gas with GWP 750 or more (e.g. R410A) can’t be placed on the GB market.', checked: false },
      { text: 'R22 can’t be used for servicing. R404A is being phased out.', checked: false },
    ],
    flammableStandard: 'BS EN 378',
    lineSets: { unit: 'm', pairs: FIVE, lengths: [15, 20, 25], insulation: ['9 mm', '13 mm'], note: 'ACR tube is imperial OD (EN 12735-1); plumbing tube is metric, so don’t mix them. 15 m install kits include 3/8" × 3/4".', checked: true },
    charge: METRIC_CHARGE,
  },
  {
    code: 'IE', name: 'Ireland', flag: '🇮🇪', guided: true,
    units: { pressure: 'bar', temp: 'C', length: 'm', mass: 'g', vacuum: 'micron' },
    currency: { code: 'EUR', symbol: '€' }, spelling: 'GB', lineSetWord: 'pair coil',
    refrigerants: order(['R32', 'R410A', 'R290', 'R134a', 'R513A', 'R448A', 'R449A', 'R744', 'R1234ze(E)', 'R404A']), commonCount: 10,
    licence: [
      { text: 'F-gas personnel certificate, Category I–IV, under the EU F-gas Regulation (EU) 2024/573. Certificates from other EU countries are recognised; UK-only ones are not.', checked: false },
      { text: 'The EPA is the competent authority; certified companies are listed by F-Gas Registration Ltd.', checked: false },
    ],
    standards: ['I.S. EN 378 Refrigerating systems and heat pumps: safety and environmental requirements'],
    rules: [
      { text: 'EU bans on new split systems: from 2025 single splits under 3 kg with GWP 750+; from 2027 air-to-water splits up to 12 kW with GWP 150+; from 2029 air-to-air splits up to 12 kW with GWP 150+ (with safety exceptions).', checked: true },
    ],
    flammableStandard: 'I.S. EN 378',
    lineSets: { unit: 'm', pairs: FIVE, lengths: [20, 25], insulation: ['9 mm', '13 mm'], note: 'ACR tube is imperial OD. Merchants label metric plumbing tube in inches too, so don’t treat “½-inch” plumbing tube as 1/2" ACR.', checked: true },
    charge: METRIC_CHARGE,
  },
  {
    code: 'US', name: 'United States', flag: '🇺🇸', guided: true,
    units: { pressure: 'psi', temp: 'F', length: 'ft', mass: 'oz', vacuum: 'micron' },
    currency: { code: 'USD', symbol: '$' }, spelling: 'US', lineSetWord: 'line set',
    refrigerants: order(['R454B', 'R32', 'R410A', 'R22', 'R134a', 'R404A', 'R448A', 'R449A', 'R513A', 'R407C']), commonCount: 10,
    licence: [
      { text: 'EPA Section 608 Technician Certification: Type I (small appliances), Type II (high-pressure), Type III (low-pressure), or Universal (all three).', checked: true },
    ],
    standards: ['ASHRAE 15 Safety Standard for Refrigeration Systems', 'ASHRAE 34 Designation and Safety Classification of Refrigerants', 'UL 60335-2-40 (A2L equipment requirements)'],
    rules: [
      { text: 'AIM Act: new residential and light-commercial AC and heat pumps made or imported from 1 Jan 2025 must use refrigerant with GWP under 700 (e.g. R454B, R32). EPA’s May 2026 rule lets pre-2025 R410A equipment be installed until stock runs out.', checked: true },
      { text: 'R22 production and import ended 1 Jan 2020; service with recovered, reclaimed or stockpiled R22 only.', checked: false },
    ],
    flammableStandard: 'ASHRAE 15 and UL 60335-2-40',
    lineSets: { unit: 'ft', pairs: [...FIVE, P('3/8"', '7/8"')], lengths: [15, 25, 35, 50], insulation: ['3/8"', '1/2"', '3/4"'], precharged: [16, 25, 35, 50], note: 'ACR copper to ASTM B280. 1/2" insulation is the usual mini-split wall.', checked: true },
    charge: IMPERIAL_CHARGE,
  },
  {
    code: 'CA', name: 'Canada', flag: '🇨🇦', guided: true,
    units: { pressure: 'psi', temp: 'F', length: 'ft', mass: 'oz', vacuum: 'micron' },
    currency: { code: 'CAD', symbol: '$' }, spelling: 'US', lineSetWord: 'line set',
    refrigerants: order(['R410A', 'R454B', 'R32', 'R22', 'R134a', 'R404A', 'R448A', 'R449A', 'R513A', 'R407C']), commonCount: 10,
    licence: [
      { text: 'Provincial ODS environmental awareness certificate (HRAI course in most provinces, MOPIA in Manitoba). It is not a trade ticket.', checked: true },
      { text: 'Trade certification: Red Seal Refrigeration and Air Conditioning Mechanic (313A in Ontario, compulsory).', checked: false },
    ],
    standards: ['CSA B52 Mechanical refrigeration code (in force where a province adopts it)', 'CSA C22.2 No. 60335-2-40 (A2L equipment requirements)'],
    rules: [
      { text: 'ODSHAR: equipment containing or designed for HCFC-22 can’t be imported. New chillers limited to GWP 750 from 2025. No federal GWP limit yet for residential splits.', checked: true },
    ],
    flammableStandard: 'CSA B52 and CSA C22.2 No. 60335-2-40',
    lineSets: { unit: 'ft', pairs: FIVE, lengths: [25, 50], insulation: ['3/8"', '1/2"'], note: 'Imperial ACR, stocked much as in the US. Gauges come in psi or dual psi/kPa: change units in Settings.', checked: false },
    charge: IMPERIAL_CHARGE,
  },
  {
    code: 'OTHER', name: 'Another country', flag: '🌐', guided: false,
    units: { pressure: 'bar', temp: 'C', length: 'm', mass: 'g', vacuum: 'micron' },
    currency: { code: '', symbol: '' }, spelling: 'GB', lineSetWord: 'line set',
    refrigerants: order(['R32', 'R410A', 'R290', 'R134a', 'R404A', 'R22', 'R744', 'R600a']), commonCount: 8,
    licence: [{ text: 'Follow your country’s refrigerant handling licence or certification rules.', checked: false }],
    standards: ['ISO 5149 / EN 378 or your local equivalent'],
    rules: [],
    flammableStandard: 'ISO 5149 (or your local standard)',
    lineSets: { unit: 'm', pairs: [...FIVE, P('3/8"', '7/8"')], lengths: [15, 20, 25, 30], insulation: ['9 mm', '13 mm'], note: 'Generic sizes, not checked against stock in your country. Enter your own coil length if yours differs.', checked: false },
    charge: METRIC_CHARGE,
  },
];

const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));
export function profileFor(code: string | null | undefined): CountryProfile {
  return BY_CODE.get((code ?? '') as CountryCode) ?? BY_CODE.get('OTHER')!;
}

export function chargeDefault(c: CountryProfile, liquid: string): ChargeDefault {
  return c.charge.find((d) => d.liquid === liquid) ?? c.charge[0];
}
