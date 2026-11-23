/**
 * Reference data, each table with its source. Values are typical published figures: brands differ, so the app
 * always tells people to check the manufacturer's data. Rows the sources could not confirm are left out, or carry
 * verified: false and are labelled in the app. Research notes: docs/DATA_SOURCES.md.
 */
import { COUNTRY_FITTINGS, COUNTRY_PIPES } from './countryMaterials';

export interface PipeSize {
  id: string;
  material: string;
  size: string;
  od_mm: number;
  wall_mm: number;
  /** Bore used for volume and flow. Usually OD − 2 × wall; PVC uses the published mean ID. */
  bore_mm?: number;
  id_mm: number;
  note: string;
}

/** Inside diameter used by the calculators. */
export function pipeId(p: PipeSize): number {
  return p.bore_mm ?? p.od_mm - 2 * p.wall_mm;
}

const copper = (dn: number, od: number, wall: number, type: 'A' | 'B'): PipeSize => ({
  id: `cu${type}-${dn}`, material: `Copper ${type}`, size: `DN${dn}`, od_mm: od, wall_mm: wall, id_mm: Math.round((od - 2 * wall) * 100) / 100,
  note: 'AS 1432 copper tube (MM Kembla brochure D54/18; Austral Wright AS 1432 table).',
});

/**
 * Copper tube to AS 1432, Types A and B. Source: MM Kembla "Copper Tube to AS1432" brochure D54/18 (Type A/B tables,
 * pp. 5–6), cross-checked with Austral Wright Metals' AS 1432 table. AU DN15 is 12.70 mm OD (1/2 in); DN18 is 15.88.
 */
const COPPER_B: [number, number, number][] = [
  [10, 9.52, 0.91], [15, 12.7, 0.91], [18, 15.88, 1.02], [20, 19.05, 1.02], [25, 25.4, 1.22], [32, 31.75, 1.22],
  [40, 38.1, 1.22], [50, 50.8, 1.22], [65, 63.5, 1.22], [80, 76.2, 1.63], [100, 101.6, 1.63],
];
const COPPER_A: [number, number, number][] = [
  [10, 9.52, 1.02], [15, 12.7, 1.02], [18, 15.88, 1.22], [20, 19.05, 1.42], [25, 25.4, 1.63], [32, 31.75, 1.63],
  [40, 38.1, 1.63], [50, 50.8, 1.63], [65, 63.5, 1.63], [80, 76.2, 2.03], [100, 101.6, 2.03],
];

/**
 * PVC-U DWV to AS/NZS 1260: Iplex NZ "DWV Pipe and Fittings System Guide" V4 (Jun 2023) §7.1 (min mean OD, mean ID),
 * mean OD cross-checked with Marley NZ "DWV Technical Design Manual" (Jun 2026). DN100 is SN6, DN150 SN4.
 */
const PVC: [number, number, number, string][] = [
  [40, 43, 38.9, ''], [50, 56, 51.4, ''], [65, 69, 63.5, ''], [80, 82, 76.7, ''], [100, 110, 103.8, ' SN6'], [150, 160, 152.1, ' SN4'],
];

/** PE-X SDR 9: Reece "Auspex Water Manual" 06/22 p.16 (made within AS/NZS 2492 tolerances). Bore = middle of the published ID range. */
const PEX: [number, number, number, number][] = [
  [16, 2.0, 11.4, 12.3], [20, 2.3, 14.6, 15.7], [25, 2.8, 18.6, 19.7], [32, 3.6, 23.8, 25.1],
];

/** Steel pipe AS 1074 Medium: Steel & Tube NZ Reticulation Catalogue (Mar 2015) p.5; InfraBuild Pipe & Fittings Data Charts (Oct 2022) p.15. */
const STEEL: [number, number, number][] = [
  [15, 21.3, 2.6], [20, 26.9, 2.6], [25, 33.7, 3.2], [32, 42.4, 3.2], [40, 48.3, 3.2], [50, 60.3, 3.6], [65, 76.1, 3.6], [80, 88.9, 4.0], [100, 114.3, 4.5],
];

export const PIPES: PipeSize[] = [
  ...COPPER_B.map(([dn, od, w]) => copper(dn, od, w, 'B')),
  ...COPPER_A.map(([dn, od, w]) => copper(dn, od, w, 'A')),
  ...PVC.map(([dn, od, bore, sn]): PipeSize => ({
    id: `pvc-${dn}`, material: 'PVC DWV', size: `DN${dn}`, od_mm: od, wall_mm: Math.round(((od - bore) / 2) * 100) / 100, bore_mm: bore, id_mm: bore,
    note: `AS/NZS 1260${sn} (Iplex DWV guide 2023 mean ID). Brands differ slightly.`,
  })),
  ...PEX.map(([od, w, lo, hi]): PipeSize => ({
    id: `pex-${od}`, material: 'PE-X', size: `${od} mm`, od_mm: od, wall_mm: w, bore_mm: (lo + hi) / 2, id_mm: (lo + hi) / 2,
    note: `SDR 9 (AS/NZS 2492 pipe, manufacturer figures). Bore ${lo}–${hi} mm; middle used. Other brands differ.`,
  })),
  ...STEEL.map(([dn, od, w]): PipeSize => ({
    id: `st-${dn}`, material: 'Steel', size: `DN${dn}`, od_mm: od, wall_mm: w, id_mm: Math.round((od - 2 * w) * 100) / 100,
    note: 'AS 1074 Medium (Steel & Tube NZ catalogue; InfraBuild data charts).',
  })),
];

export const pipeById = (id: string) => PIPES.find(p => p.id === id) ?? COUNTRY_PIPES.find(p => p.id === id);

/**
 * Hazen–Williams C, typical design values (Engineering ToolBox "Hazen-Williams Coefficients"): copper 130–140,
 * PVC 150, PE 140 (also used for PE-X, which the table doesn't list), galvanised steel 120. Lower C = more loss.
 */
export const HAZEN_C: Record<string, number> = {
  'Copper A': 140,
  'Copper B': 140,
  'PVC DWV': 150,
  'PE-X': 140,
  Steel: 120,
  'Copper (EN 1057)': 140, 'Copper Type K': 140, 'Copper Type L': 140, 'Copper Type M': 140,
  'PVC Sch 40 DWV': 150, 'Solvent waste': 150, 'Soil pipe': 150, 'Underground drain': 150,
  'PEX (CTS SDR 9)': 140, 'CPVC (CTS SDR 11)': 150,
};

/**
 * Fittings with centre-to-end (C–E) and socket depth / thread engagement, so take-off = C–E − engagement.
 */
export interface FittingSpec {
  id: string;
  group: string;
  name: string;
  size: string;
  centreToEnd: number;
  engagement: number;
  source: string;
  /** false = the source has a known misprint or the value was derived; shown with a warning. */
  verified: boolean;
  note?: string;
}

const IPLEX = 'Iplex NZ DWV System Guide V4 (2023), AS/NZS 1260 solvent weld';
const BMI = 'US pattern (ASME B16.22): BMI Canada Tech Info #125 take-off + CDA Copper Tube Handbook Table 14.9 cup depth';
const ANVIL = 'US NPT malleable iron (ASME B16.3): Anvil catalogue Fig. 1101/1102 + approx. NPT make-up';

const pvc = (dn: number, name: string, c2e: number, socket: number, verified = true, note?: string): FittingSpec => ({
  id: `pvc-${dn}-${name.replace(/\W+/g, '').toLowerCase()}`, group: 'PVC DWV', name, size: `DN${dn}`, centreToEnd: c2e, engagement: socket, source: IPLEX, verified, note,
});

/**
 * PVC DWV bends ("101 Plain Bend F&F", p.35: L = centre to socket mouth, L2 = socket depth) and junctions
 * ("104 Plain Junction F&F", p.37). Junction legs: C–E = published take-off + socket depth.
 */
const PVC_FITTINGS: FittingSpec[] = [
  pvc(40, '88° bend', 58, 27), pvc(40, '45° bend', 37, 27),
  pvc(50, '88° bend', 69, 30), pvc(50, '45° bend', 43, 30),
  pvc(65, '88° bend', 98, 40), pvc(65, '45° bend', 54, 39),
  pvc(80, '88° bend', 118, 47), pvc(80, '45° bend', 63, 45),
  pvc(100, '88° bend', 131, 51, false, 'Catalogue prints one leg as 13 mm; 131 mm used. Measure to confirm.'),
  pvc(100, '45° bend', 76, 51),
  pvc(40, '45° junction, branch', 55 + 29, 29), pvc(40, '45° junction, run (bottom)', 19 + 29, 29),
  pvc(50, '45° junction, branch', 71 + 30, 30), pvc(50, '45° junction, run (bottom)', 12 + 30, 30),
  pvc(65, '45° junction, branch', 103 + 40, 40), pvc(65, '45° junction, run (bottom)', 23 + 40, 40),
  pvc(80, '45° junction, branch', 105 + 47, 47), pvc(80, '45° junction, run (bottom)', 19 + 47, 47),
  pvc(100, '45° junction, branch', 137 + 51, 51), pvc(100, '45° junction, run (bottom)', 29 + 51, 51),
  pvc(50, '88° junction, branch', 38 + 32, 32), pvc(50, '88° junction, run (bottom)', 40 + 32, 32), pvc(50, '88° junction, run (top)', 29 + 32, 32),
  pvc(100, '88° junction, branch', 79 + 51, 51), pvc(100, '88° junction, run (bottom)', 85 + 51, 51), pvc(100, '88° junction, run (top)', 52 + 51, 51),
];

const cu = (dn: number, usNom: string, name: string, takeoff: number, cup: number): FittingSpec => ({
  id: `cu-${dn}-${name.replace(/\W+/g, '').toLowerCase()}`, group: 'Copper (US pattern)', name, size: `DN${dn} (US ${usNom}″)`,
  centreToEnd: Math.round((takeoff + cup) * 10) / 10, engagement: cup, source: BMI, verified: false,
  note: 'Same tube OD as AU, but US-pattern fittings. AS 3688 fittings may differ: measure yours or add a custom fitting.',
});

/** Only the US sizes whose tube OD matches AS 1432: US 3/8 = DN15 (12.70), 1/2 = DN18 (15.88), 5/8 = DN20 (19.05). */
const COPPER_FITTINGS: FittingSpec[] = [
  cu(15, '3/8', '90° elbow', 8.8, 9.7), cu(15, '3/8', 'Tee, run', 6.6, 9.7), cu(15, '3/8', 'Tee, branch', 7.9, 9.7),
  cu(18, '1/2', '90° elbow', 10.1, 12.7), cu(18, '1/2', '45° elbow', 6.7, 12.7), cu(18, '1/2', 'Tee, run', 8.0, 12.7), cu(18, '1/2', 'Tee, branch', 9.5, 12.7),
  cu(20, '5/8', '90° elbow', 12.2, 19.1), cu(20, '5/8', 'Tee, run', 9.7, 19.1), cu(20, '5/8', 'Tee, branch', 11.4, 19.1),
];

const mi = (dn: number, nps: string, name: string, c2e: number, makeup: number): FittingSpec => ({
  id: `mi-${dn}-${name.replace(/\W+/g, '').toLowerCase()}`, group: 'Steel, threaded (US NPT)', name, size: `DN${dn} (${nps}″)`,
  centreToEnd: c2e, engagement: makeup, source: ANVIL, verified: false,
  note: 'NPT make-up is approximate (hand + wrench). AU BSPT fittings may differ.',
});

/** Anvil Fig. 1101 90° (dim A) and Fig. 1102 45° (dim C); NPT make-up from Engineering ToolBox (ASME B1.20.1 based). */
const STEEL_FITTINGS: FittingSpec[] = ([
  [15, '1/2', 29, 22, 11.1], [20, '3/4', 33, 25, 12.7], [25, '1', 38, 29, 14.3], [32, '1-1/4', 44, 33, 14.3], [40, '1-1/2', 49, 37, 14.3],
  [50, '2', 57, 43, 15.9], [65, '2-1/2', 68, 49, 22.2], [80, '3', 78, 56, 25.4], [100, '4', 98, 67, 27.0],
] as const).flatMap(([dn, nps, e90, e45, mk]) => [mi(dn, nps, '90° elbow', e90, mk), mi(dn, nps, '45° elbow', e45, mk)]);

export const FITTINGS: FittingSpec[] = [...PVC_FITTINGS, ...COPPER_FITTINGS, ...STEEL_FITTINGS];

export const fittingById = (id: string) => FITTINGS.find(f => f.id === id) ?? COUNTRY_FITTINGS.find(f => f.id === id);

/**
 * Minimum grades of drains, AS/NZS 3500.2:2003 (Amdt 1–3), Clause 3.4.1, Table 3.2. That edition is superseded
 * (current: 2025), so the app shows it as a guide and tells people to check the current edition.
 */
export const MIN_GRADES: { dn: number; pct: number; ratio: string; note?: string }[] = [
  { dn: 65, pct: 2.5, ratio: '1:40' },
  { dn: 80, pct: 1.65, ratio: '1:60' },
  { dn: 100, pct: 1.65, ratio: '1:60', note: '1.00 % (1:100) allowed for drains from septic tanks, treatment plants and unvented tundish discharges' },
  { dn: 125, pct: 1.25, ratio: '1:80' },
  { dn: 150, pct: 1.0, ratio: '1:100' },
  { dn: 225, pct: 0.65, ratio: '1:154' },
  { dn: 300, pct: 0.4, ratio: '1:250' },
];

/** Velocity limits. Cold and non-drinking water: NCC 2022 Vol 3 B1P2 / B3 (3.0 m/s). Heated water: MM Kembla brochure D54/18 p.6. */
export const MAX_VELOCITY: { service: string; max: number }[] = [
  { service: 'Cold water', max: 3.0 },
  { service: 'Heated water, not circulating', max: 3.0 },
  { service: 'Heated water, circulating flow', max: 1.2 },
  { service: 'Heated water, circulating return', max: 1.0 },
];
