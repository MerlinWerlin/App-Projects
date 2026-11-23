// Flare nut tightening torque and typical pipe sizing, as aids. These are the ranges commonly printed in split-system
// installation manuals for R410A / R32 flares (ISO 14903-style 45° flares on ACR copper). Every manual has its own
// table, and it always wins: the app labels these "typical".

export type FlareTorque = { od: string; odMm: number; minNm: number; maxNm: number };

export const FLARE_TORQUE: FlareTorque[] = [
  { od: '1/4"', odMm: 6.35, minNm: 14, maxNm: 18 },
  { od: '3/8"', odMm: 9.52, minNm: 34, maxNm: 42 },
  { od: '1/2"', odMm: 12.7, minNm: 49, maxNm: 61 },
  { od: '5/8"', odMm: 15.88, minNm: 68, maxNm: 82 },
  { od: '3/4"', odMm: 19.05, minNm: 100, maxNm: 120 },
];

export const NM_TO_FTLB = 0.737562149;

export type PipePair = { liquid: string; suction: string };
/**
 * Typical liquid × suction (gas) line sizes for single-split R32 / R410A systems by nominal cooling capacity.
 * Use the size printed on the unit's service valves and in its manual; long runs may need different sizes.
 */
export const TYPICAL_PAIRS: { upToKw: number; pair: PipePair }[] = [
  { upToKw: 3.6, pair: { liquid: '1/4"', suction: '3/8"' } },
  { upToKw: 5.3, pair: { liquid: '1/4"', suction: '1/2"' } },
  { upToKw: 7.2, pair: { liquid: '1/4"', suction: '5/8"' } },
  { upToKw: 10.0, pair: { liquid: '3/8"', suction: '5/8"' } },
  { upToKw: 16.0, pair: { liquid: '3/8"', suction: '3/4"' } },
];

export function typicalPair(kw: number): PipePair | null {
  if (!(kw > 0)) return null;
  return TYPICAL_PAIRS.find((p) => kw <= p.upToKw)?.pair ?? null;
}

export const OD_MM: Record<string, number> = { '1/4"': 6.35, '3/8"': 9.52, '1/2"': 12.7, '5/8"': 15.88, '3/4"': 19.05, '7/8"': 22.22, '1-1/8"': 28.58 };

/**
 * Liquid-line volume per metre (internal) for a rough check of extra charge, using typical 0.8 mm wall (1/4"–1/2")
 * and 1.0 mm wall (5/8"+) soft-drawn ACR tube.
 */
export function internalVolumeLPerM(od: string): number | null {
  const mm = OD_MM[od];
  if (!mm) return null;
  const wall = mm < 15 ? 0.8 : 1.0;
  const id = (mm - 2 * wall) / 1000;
  return Math.PI * (id / 2) ** 2 * 1000;
}
