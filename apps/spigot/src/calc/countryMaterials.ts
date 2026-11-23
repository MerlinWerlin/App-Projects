/**
 * Pipe and fitting dimensions for the countries beyond Australia. docs/COUNTRY_DATA.md has every source URL, page
 * and table; the short source is repeated on each block. Retailer names appear in that file only, never in the app.
 */
import type { FittingSpec, PipeSize } from './reference';

const pipe = (id: string, material: string, size: string, od: number, wall: number, note: string, bore?: number): PipeSize => {
  const b = bore ?? od - 2 * wall;
  return { id, material, size, od_mm: od, wall_mm: wall, ...(bore !== undefined ? { bore_mm: bore } : {}), id_mm: Math.round(b * 100) / 100, note };
};

/** NZ PE-Xb PN16 (AS/NZS 2492): bore from the Pexline NZ plumbers' manual bore table p.23; wall derived. */
export const NZ_PEX: PipeSize[] = [
  pipe('nzpex-16', 'PE-X', '16 mm', 16, 2.1, 'PN16 PE-X (AS/NZS 2492), manufacturer bore. Other brands differ.', 11.8),
  pipe('nzpex-20', 'PE-X', '20 mm', 20, 2.4, 'PN16 PE-X (AS/NZS 2492), manufacturer bore. Other brands differ.', 15.2),
  pipe('nzpex-25', 'PE-X', '25 mm', 25, 2.95, 'PN16 PE-X (AS/NZS 2492), manufacturer bore. Other brands differ.', 19.1),
];

/**
 * GB/IE copper EN 1057 R250 half-hard 15×0.7, 22×0.9, 28×0.9 (Wednesbury Black Label data sheet).
 * GB solvent waste PVC-C (BS EN 1566-1) mean ODs 36.3 / 42.9 / 55.9 mm, mid walls (Wavin manual Table 3).
 * Soil PVC-U 110 (BS EN 1329-1; Wavin Table 1 OD 110.0–110.3, wall 3.2–3.5). Underground PVC-U 110 (BS EN 1401-1) wall 3.2.
 */
export const EU_COPPER: PipeSize[] = [
  pipe('en-cu-15', 'Copper (EN 1057)', '15 mm', 15, 0.7, 'EN 1057 R250 half-hard copper.'),
  pipe('en-cu-22', 'Copper (EN 1057)', '22 mm', 22, 0.9, 'EN 1057 R250 half-hard copper.'),
  pipe('en-cu-28', 'Copper (EN 1057)', '28 mm', 28, 0.9, 'EN 1057 R250 half-hard copper.'),
];
export const GB_WASTE: PipeSize[] = [
  pipe('gb-waste-32', 'Solvent waste', '32 mm', 36.3, 2.0, 'Solvent-weld waste (BS EN 1566-1), manufacturer mean OD. Other brands differ slightly.'),
  pipe('gb-waste-40', 'Solvent waste', '40 mm', 42.9, 2.1, 'Solvent-weld waste (BS EN 1566-1), manufacturer mean OD. Other brands differ slightly.'),
  pipe('gb-waste-50', 'Solvent waste', '50 mm', 55.9, 2.2, 'Solvent-weld waste (BS EN 1566-1), manufacturer mean OD. Other brands differ slightly.'),
];
export const EU_SOIL: PipeSize[] = [
  pipe('gb-soil-110', 'Soil pipe', '110 mm', 110.15, 3.35, 'PVC-U soil pipe (BS EN 1329-1), manufacturer mid-range OD and wall.'),
  pipe('gb-ug-110', 'Underground drain', '110 mm', 110, 3.2, 'PVC-U underground drainage (BS EN 1401-1).'),
];

/**
 * US/CA copper ASTM B88 Types K, L, M: Copper Development Association, Copper Tube Handbook, Tables 14.2a–c.
 * PVC Sch 40 DWV (ASTM D2665) and ABS Sch 40 DWV (ASTM F628): Charlotte Pipe DC-DWV catalogue pp.3 and 7.
 * PEX CTS SDR 9 (ASTM F876): Uponor AquaPEX submittal OD/bore (wall derived). CPVC CTS SDR 11 (ASTM D2846) 3/4 and
 * 1 in: Spears dimensions sheet (1/2 in left out because sources disagree on its wall).
 */
const cuUS = (type: 'K' | 'L' | 'M', size: string, od: number, wall: number) =>
  pipe(`us-cu${type}-${size.replace(/\W+/g, '')}`, `Copper Type ${type}`, `${size} in`, od, wall, `ASTM B88 Type ${type} copper.`);
export const US_COPPER: PipeSize[] = [
  cuUS('K', '1/2', 15.88, 1.245), cuUS('K', '3/4', 22.23, 1.651), cuUS('K', '1', 28.58, 1.651), cuUS('K', '1-1/4', 34.93, 1.651), cuUS('K', '1-1/2', 41.28, 1.829), cuUS('K', '2', 53.98, 2.108),
  cuUS('L', '1/2', 15.88, 1.016), cuUS('L', '3/4', 22.23, 1.143), cuUS('L', '1', 28.58, 1.27), cuUS('L', '1-1/4', 34.93, 1.397), cuUS('L', '1-1/2', 41.28, 1.524), cuUS('L', '2', 53.98, 1.778),
  cuUS('M', '1/2', 15.88, 0.711), cuUS('M', '3/4', 22.23, 0.813), cuUS('M', '1', 28.58, 0.889), cuUS('M', '1-1/4', 34.93, 1.067), cuUS('M', '1-1/2', 41.28, 1.245), cuUS('M', '2', 53.98, 1.473),
];
const dwvUS = (mat: 'PVC' | 'ABS', size: string, od: number, wall: number) =>
  pipe(`us-${mat.toLowerCase()}-${size.replace(/\W+/g, '')}`, `${mat} Sch 40 DWV`, `${size} in`, od, wall, `${mat} Schedule 40 DWV (${mat === 'PVC' ? 'ASTM D2665' : 'ASTM F628'}), minimum wall.`);
export const PVC_DWV_US: PipeSize[] = [dwvUS('PVC', '1-1/2', 48.3, 3.7), dwvUS('PVC', '2', 60.3, 3.9), dwvUS('PVC', '3', 88.9, 5.5), dwvUS('PVC', '4', 114.3, 6.0)];
export const ABS_DWV: PipeSize[] = [dwvUS('ABS', '1-1/2', 48.26, 3.68), dwvUS('ABS', '2', 60.33, 3.91), dwvUS('ABS', '3', 88.9, 5.49), dwvUS('ABS', '4', 114.3, 6.02)];
export const US_PEX: PipeSize[] = [
  pipe('us-pex-12', 'PEX (CTS SDR 9)', '1/2 in', 15.88, 1.91, 'PEX CTS SDR 9 (ASTM F876), manufacturer OD and bore.', 12.07),
  pipe('us-pex-34', 'PEX (CTS SDR 9)', '3/4 in', 22.23, 2.59, 'PEX CTS SDR 9 (ASTM F876), manufacturer OD and bore.', 17.04),
  pipe('us-pex-1', 'PEX (CTS SDR 9)', '1 in', 28.58, 3.34, 'PEX CTS SDR 9 (ASTM F876), manufacturer OD and bore.', 21.9),
];
export const US_CPVC: PipeSize[] = [
  pipe('us-cpvc-34', 'CPVC (CTS SDR 11)', '3/4 in', 22.23, 2.03, 'CPVC CTS SDR 11 (ASTM D2846), manufacturer figures.', 17.65),
  pipe('us-cpvc-1', 'CPVC (CTS SDR 11)', '1 in', 28.58, 2.59, 'CPVC CTS SDR 11 (ASTM D2846), manufacturer figures.', 22.89),
];

/**
 * US/CA DWV fittings, Charlotte Pipe DC-DWV catalogue: 1/4 bend (part 300, p.26), 1/8 bend (321, p.32), sanitary tee
 * (400, p.36); dimension A runs from the centre line to the socket bottom, so it is the take-off. ABS rows from the same
 * catalogue. Hub (socket) depths from its hub table p.10: 1-1/2 in 17.45, 2 in 19.05, 3 in 38.1, 4 in 44.45 mm.
 */
const HUB: Record<string, number> = { '1-1/2': 17.45, '2': 19.05, '3': 38.1, '4': 44.45 };
const dwvFit = (mat: 'PVC' | 'ABS', size: string, name: string, takeoff: number, verified = true): FittingSpec => ({
  id: `us-${mat.toLowerCase()}-${size.replace(/\W+/g, '')}-${name.replace(/\W+/g, '').toLowerCase()}`,
  group: `${mat} DWV`, name, size: `${size} in`, centreToEnd: Math.round((takeoff + HUB[size]!) * 100) / 100, engagement: HUB[size]!,
  source: 'Charlotte Pipe DC-DWV catalogue (A = centre to socket bottom; hub depth table)', verified,
});
export const PVC_DWV_FITTINGS: FittingSpec[] = [
  dwvFit('PVC', '1-1/2', '1/4 bend', 44.5), dwvFit('PVC', '1-1/2', '1/8 bend', 28.6), dwvFit('PVC', '1-1/2', 'Sanitary tee', 44.5),
  dwvFit('PVC', '2', '1/4 bend', 58.7), dwvFit('PVC', '2', '1/8 bend', 38.1), dwvFit('PVC', '2', 'Sanitary tee', 58.7),
  dwvFit('PVC', '3', '1/4 bend', 77.8), dwvFit('PVC', '3', '1/8 bend', 44.5), dwvFit('PVC', '3', 'Sanitary tee', 77.8),
  dwvFit('PVC', '4', '1/4 bend', 98.4), dwvFit('PVC', '4', '1/8 bend', 55.6), dwvFit('PVC', '4', 'Sanitary tee', 98.4),
];
export const ABS_FITTINGS: FittingSpec[] = [
  dwvFit('ABS', '1-1/2', '1/4 bend', 44.45), dwvFit('ABS', '1-1/2', '1/8 bend', 28.58), dwvFit('ABS', '1-1/2', 'Sanitary tee', 43.66),
  dwvFit('ABS', '2', '1/4 bend', 57.15), dwvFit('ABS', '2', '1/8 bend', 38.1), dwvFit('ABS', '2', 'Sanitary tee', 58.74),
  dwvFit('ABS', '3', '1/4 bend', 77.79), dwvFit('ABS', '3', '1/8 bend', 44.45), dwvFit('ABS', '3', 'Sanitary tee', 76.99),
  dwvFit('ABS', '4', '1/4 bend', 98.43), dwvFit('ABS', '4', '1/8 bend', 55.56), dwvFit('ABS', '4', 'Sanitary tee', 98.43),
];

/** Wrot copper 1/2–2 in: BMI Canada Tech Info #125 take-offs + CDA Copper Tube Handbook Table 14.9 cup depths. */
const wrot = (size: string, cup: number, e90: number, e45: number, run: number, br: number): FittingSpec[] =>
  ([['90° elbow', e90], ['45° elbow', e45], ['Tee, run', run], ['Tee, branch', br]] as const).map(([name, t]) => ({
    id: `us-wrot-${size.replace(/\W+/g, '')}-${name.replace(/\W+/g, '').toLowerCase()}`, group: 'Copper (wrot)', name, size: `${size} in`,
    centreToEnd: Math.round((t + cup) * 10) / 10, engagement: cup, source: 'BMI Canada Tech Info #125 take-off + CDA handbook Table 14.9 cup depth', verified: true,
    note: 'One maker’s take-offs; ASME B16.22 sets minimums, so brands differ slightly.',
  }));
export const WROT_COPPER_FITTINGS: FittingSpec[] = [
  ...wrot('1/2', 12.7, 10.1, 6.7, 8.0, 9.5), ...wrot('3/4', 19.1, 14.1, 8.7, 11.4, 13.1), ...wrot('1', 23.1, 19.0, 10.6, 14.6, 17.0),
  ...wrot('1-1/4', 24.6, 21.7, 12.2, 17.8, 20.2), ...wrot('1-1/2', 27.7, 24.6, 14.5, 21.0, 23.9), ...wrot('2', 34.0, 33.1, 16.7, 27.3, 30.4),
];

export const COUNTRY_PIPES: PipeSize[] = [...NZ_PEX, ...EU_COPPER, ...GB_WASTE, ...EU_SOIL, ...US_COPPER, ...PVC_DWV_US, ...ABS_DWV, ...US_PEX, ...US_CPVC];
export const COUNTRY_FITTINGS: FittingSpec[] = [...PVC_DWV_FITTINGS, ...ABS_FITTINGS, ...WROT_COPPER_FITTINGS];
