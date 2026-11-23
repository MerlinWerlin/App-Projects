/**
 * Materials catalogue per country: the pipe and fittings commonly stocked by the main trade suppliers and hardware
 * chains there, so the pickers offer what a plumber can actually buy. Sources per country below and in
 * docs/COUNTRY_DATA.md (retailer names appear in code docs only, never in the app). Where store availability could not
 * be confirmed the list says so (materialsVerified = false) and the app tells the person.
 */
import { FITTINGS, PIPES, type FittingSpec, type PipeSize } from '../calc/reference';
import {
  ABS_DWV, ABS_FITTINGS, EU_COPPER, EU_SOIL, GB_WASTE, NZ_PEX, PVC_DWV_FITTINGS, PVC_DWV_US, US_COPPER, US_CPVC, US_PEX, WROT_COPPER_FITTINGS,
} from '../calc/countryMaterials';
import type { CountryCode } from '../state/data';

type Materials = { pipes: PipeSize[]; fittings: FittingSpec[]; materialsNote: string; materialsVerified: boolean };

const pick = (ids: string[]) => ids.map(id => {
  const p = PIPES.find(x => x.id === id);
  if (!p) throw new Error(`catalog: unknown pipe ${id}`);
  return p;
});
const fit = (prefix: string[]) => FITTINGS.filter(f => prefix.some(p => f.id.startsWith(p)));

/**
 * Australia (checked 23 Nov 2026): copper AS 1432 Type B DN10–DN200 in 6 m (DN15–50 also 3 m) and Type A DN15–DN200
 * at a national plumbing supplier; DWV DN40–150 in 6 m (retail 1, 3, 6 m); PE-X 16–32 mm in 5 m straights and coils.
 * Galvanised medium steel by trade order. Fittings: AS/NZS 1260 DWV (Iplex dimensions), US-pattern copper that fits
 * AS 1432 tube of the same OD, US NPT malleable. Australian AS 3688 copper take-offs are not published.
 */
const AU: Materials = {
  pipes: pick([
    'cuB-10', 'cuB-15', 'cuB-18', 'cuB-20', 'cuB-25', 'cuB-32', 'cuB-40', 'cuB-50', 'cuB-65', 'cuB-80', 'cuB-100',
    'cuA-15', 'cuA-18', 'cuA-20', 'cuA-25', 'cuA-32', 'cuA-40', 'cuA-50',
    'pvc-40', 'pvc-50', 'pvc-65', 'pvc-80', 'pvc-100', 'pvc-150',
    'pex-16', 'pex-20', 'pex-25', 'pex-32',
    'st-15', 'st-20', 'st-25', 'st-32', 'st-40', 'st-50',
  ]),
  fittings: fit(['pvc-', 'cu-', 'mi-']),
  materialsNote: 'Sizes stocked by Australian plumbing suppliers. Fitting dimensions are typical: check your brand.',
  materialsVerified: true,
};

/**
 * New Zealand: DWV PVC-U (AS/NZS 1260) DN40–150 in 3 and 6 m at hardware chains and merchants; PE-X 16/20/25 PN16 in
 * 5 m straights and coils. Copper: NZ accepts NZS 3501 (bore-sized) or AS 1432 tube (G12/AS1 Table 1); AS 1432 Type B
 * is listed here, NZS 3501 sizes could not be checked. DWV fittings: Iplex NZ guide (same data as AU).
 */
const NZ: Materials = {
  pipes: [...pick(['pvc-40', 'pvc-50', 'pvc-65', 'pvc-80', 'pvc-100', 'pvc-150']), ...NZ_PEX, ...pick(['cuB-15', 'cuB-20', 'cuB-25'])],
  fittings: fit(['pvc-']),
  materialsNote: 'DWV and PE-X sizes sold in New Zealand. Copper is AS 1432; bore-sized NZS 3501 copper is also sold and differs, so check yours.',
  materialsVerified: true,
};

/**
 * United Kingdom: copper EN 1057 15/22/28 mm in 2 and 3 m; solvent waste 32/40/50 mm in 3 m; soil 110 mm in 3 and 4 m;
 * underground 110 mm in 3 m. No UK maker publishes centre-to-stop take-offs we could read, so there is no fitting
 * table: people add their own measured fittings.
 */
const GB: Materials = {
  pipes: [...EU_COPPER, ...GB_WASTE, ...EU_SOIL],
  fittings: [],
  materialsNote: 'Sizes sold in the UK. UK fitting makers don’t publish take-offs, so measure yours and add them as your own fittings.',
  materialsVerified: true,
};

/**
 * Ireland: soil 110 mm in 3/4/6 m and sewer 110 mm in 6 m (Irish manufacturer trade brochure); waste is sold in 4 m
 * lengths there (dimensions per brand not published, so waste is left out); copper EN 1057 as UK (Irish store stock
 * seen in search results only).
 */
const IE: Materials = {
  pipes: [...EU_COPPER, ...EU_SOIL],
  fittings: [],
  materialsNote: 'Soil and drain sizes sold in Ireland; copper sizes as the UK (store stock not checked). Measure your fittings and add them as your own.',
  materialsVerified: false,
};

/**
 * United States: copper Types K/L/M 1/2–2 in, PVC and ABS Sch 40 DWV 1-1/2–4 in, PEX and CPVC: standard ASTM sizes.
 * Big-box store pages could not be read, so stock lengths (10 ft typical) are unconfirmed.
 */
const US: Materials = {
  pipes: [...US_COPPER, ...PVC_DWV_US, ...ABS_DWV, ...US_PEX, ...US_CPVC],
  fittings: [...PVC_DWV_FITTINGS, ...ABS_FITTINGS, ...WROT_COPPER_FITTINGS],
  materialsNote: 'Standard US sizes. Store stock and lengths not checked (10 ft is typical); fitting take-offs are one maker’s figures.',
  materialsVerified: false,
};

/** Canada: same ASTM sizes; ABS dominates residential DWV; copper and ABS often sold in 12 ft (unconfirmed). */
const CA: Materials = {
  pipes: [...US_COPPER.filter(p => !p.material.endsWith('K')), ...ABS_DWV, ...US_PEX],
  fittings: [...ABS_FITTINGS, ...WROT_COPPER_FITTINGS],
  materialsNote: 'Standard sizes sold in Canada. Store stock and lengths not checked (12 ft is common); ABS take-offs are one maker’s figures.',
  materialsVerified: false,
};

/** Anywhere else: every pipe and fitting in the reference tables, flagged as not checked. */
const OTHER: Materials = {
  pipes: PIPES,
  fittings: FITTINGS,
  materialsNote: 'Generic sizes: not checked against what’s sold where you are. Add your own fittings if yours differ.',
  materialsVerified: false,
};

export const CATALOG: Record<CountryCode, Materials> = { AU, NZ, GB, IE, US, CA, OTHER };
