/**
 * Asphalt shingles (US/Canada practice, also used in NZ).
 * A "square" is 100 sq ft of roof surface (9.290304 m²). Makers sell strip shingles in bundles, usually 3 per square
 * (Owens Corning / GAF / IKO product data cited in src/data/sources.ts).
 *   squares          = roof area (sq ft) ÷ 100
 *   bundles          = ⌈ squares × bundles per square × (1 + waste) ⌉
 *   starter bundles  = ⌈ (eaves + rakes) ÷ starter lineal feet per bundle ⌉
 *   hip & ridge      = ⌈ (ridge + hips) ÷ cap lineal feet per bundle ⌉
 *   nails            = shingles × nails per shingle (IRC R905.2.6: at least 4 per strip shingle)
 */
import { fail, type Ctx, type Result, type Step } from './context';
import { MM_PER_FT, num, SQFT_PER_M2 } from './units';

export interface ShingleInput {
  roofAreaM2: number;
  bundlesPerSquare: number;
  shinglesPerSquare: number;
  wastePct: number;
  starterRunMm: number; // eaves + rakes
  capRunMm: number; // ridge + hips
  starterFtPerBundle: number | null;
  capFtPerBundle: number | null;
  nailsPerShingle: number;
}
export interface ShingleResult { squares: number; bundles: number; starterBundles: number; capBundles: number; nails: number }

export function shingles(input: ShingleInput, ctx: Ctx): Result<ShingleResult> {
  const { roofAreaM2, bundlesPerSquare: bps, shinglesPerSquare: sps, wastePct, nailsPerShingle } = input;
  if (!(roofAreaM2 > 0)) return fail('Add a roof first.');
  if (!(bps > 0) || !(sps > 0)) return fail('Pick a shingle or enter bundles and shingles per square.');
  if (!(wastePct >= 0) || wastePct > 50) return fail('Waste should be between 0 and 50%.');
  if (!(nailsPerShingle > 0)) return fail('Enter nails per shingle.');
  const sqft = roofAreaM2 * SQFT_PER_M2;
  const squares = sqft / 100;
  const withWaste = squares * (1 + wastePct / 100);
  const bundles = Math.ceil(withWaste * bps - 1e-9);
  const starter = input.starterFtPerBundle && input.starterRunMm > 0 ? Math.ceil(input.starterRunMm / MM_PER_FT / input.starterFtPerBundle - 1e-9) : 0;
  const cap = input.capFtPerBundle && input.capRunMm > 0 ? Math.ceil(input.capRunMm / MM_PER_FT / input.capFtPerBundle - 1e-9) : 0;
  const nails = Math.ceil(withWaste * sps * nailsPerShingle - 1e-9);
  const steps: Step[] = [
    { label: 'Squares', formula: `${num(sqft, 0)} sq ft ÷ 100`, value: num(squares, 2) },
    { label: 'Bundles', formula: `${num(squares, 2)} × ${bps} per square + ${wastePct}% waste`, value: String(bundles) },
  ];
  if (starter) steps.push({ label: 'Starter strip bundles', formula: `${ctx.run(input.starterRunMm)} eaves and rakes ÷ ${input.starterFtPerBundle} ft`, value: String(starter) });
  if (cap) steps.push({ label: 'Hip & ridge bundles', formula: `${ctx.run(input.capRunMm)} ÷ ${input.capFtPerBundle} ft`, value: String(cap) });
  steps.push({ label: 'Nails', formula: `${num(withWaste * sps, 0)} shingles × ${nailsPerShingle}`, value: String(nails) });
  return { ok: true, value: { squares, bundles, starterBundles: starter, capBundles: cap, nails }, steps,
    notes: ['Check the bundle label: coverage per bundle varies by product. High-wind areas and steep slopes need 6 nails.'] };
}
