/**
 * Trowel notch and adhesive coverage defaults (docs/SOURCES.md "Adhesive").
 *
 * A square notch leaves ridges that hold about half the notch depth of adhesive (ARDEX TP002.005: a 10 mm notch
 * flattens to a 4–4.5 mm bed in theory, 2.5–3 mm in practice). Makers' published coverage works out at
 * 0.41–0.50 kg/m² per mm of notch depth in the US (LATICRETE 254, MAPEI Ultraflex 2) and 0.28–0.33 in AU/EU
 * (Davco Ultraflex, Schomburg, Würth). We default to 0.45 (standard) so the job doesn't run short, with a
 * lightweight preset at 0.30. Back-buttering: +1.2 kg/m² (a 1 mm skim × MAPEI's 1.2 kg/m² per mm; derived).
 * Always prefer the coverage printed on the product's data sheet.
 */
export const KG_PER_M2_PER_MM_NOTCH = 0.45;
export const LIGHTWEIGHT_KG_PER_M2_PER_MM = 0.30;
export const BACK_BUTTER_KG_PER_M2 = 1.2;

export interface Notch { mm: number; label: string; round?: boolean }

export const NOTCHES: Notch[] = [
  { mm: 3, label: '3 mm' }, { mm: 4, label: '4 mm' }, { mm: 6, label: '6 mm' }, { mm: 8, label: '8 mm' },
  { mm: 10, label: '10 mm' }, { mm: 12, label: '12 mm' }, { mm: 15, label: '15 mm' }, { mm: 20, label: '20 mm round', round: true },
];

/** Imperial trowel names map to the metric notch depth (1/4 in = 6.35 mm etc.). */
export const IMPERIAL_NOTCHES: Notch[] = [
  { mm: 3.175, label: '1/8 × 1/8 in' }, { mm: 4.7625, label: '3/16 × 3/16 in' }, { mm: 6.35, label: '1/4 × 1/4 in' },
  { mm: 9.525, label: '1/4 × 3/8 in' }, { mm: 12.7, label: '1/2 × 1/2 in' }, { mm: 19.05, label: '3/4 in round', round: true },
];

/** kg/m² for a notch: a square notch at the given rate; a 20 mm round / half-moon holds less (Schomburg 6.2 kg/m²). */
export function notchCoverage(n: Notch, lightweight = false): number {
  const rate = lightweight ? LIGHTWEIGHT_KG_PER_M2_PER_MM : KG_PER_M2_PER_MM_NOTCH;
  if (n.round) return (lightweight ? 6.5 * (LIGHTWEIGHT_KG_PER_M2_PER_MM / KG_PER_M2_PER_MM_NOTCH) : 6.5) * (n.mm / 20);
  return rate * n.mm;
}

/**
 * Suggested notch by the tile's longest side (Davco/Sika Ultraflex data sheet, TTA Guide to Tiling 2026,
 * ARDEX TB001.010 "large format = one side 400 mm or more"):
 * ≤100 → 4 mm, ≤200 → 6 mm, <400 → 10 mm, <600 → 12 mm, ≥600 → 12 mm plus back-buttering.
 */
export function recommendNotch(longSideMm: number): { mm: number; backButter: boolean; why: string } {
  if (longSideMm <= 100) return { mm: 4, backButter: false, why: 'Mosaic and small tiles up to 100 mm' };
  if (longSideMm <= 200) return { mm: 6, backButter: false, why: 'Tiles up to 200 mm' };
  if (longSideMm < 400) return { mm: 10, backButter: false, why: 'Tiles from 200 to 400 mm' };
  if (longSideMm < 600) return { mm: 12, backButter: false, why: 'Large format: one side 400 mm or more' };
  return { mm: 12, backButter: true, why: 'Tiles 600 mm and over: back-butter as well' };
}

/** Contact coverage you should see when you lift a tile, by country standard. */
export const CONTACT_RULES = {
  AS3958: 'AS 3958.1: 65% residential walls, 80% residential floors, 90% wet areas, commercial floors and outside.',
  ANSI: 'ANSI A108.5: at least 80% contact, 95% in showers and outside. Back-butter to reach 95%.',
  BS5385: 'BS 5385: solid bed for floors, wet areas and wall tiles of 0.1 m² or more. No dot and dab.',
} as const;
