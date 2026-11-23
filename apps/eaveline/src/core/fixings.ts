/**
 * Fixing (screw / nail / clip) estimates.
 *
 * Sheet roofs: fasteners per sheet at each support line come from the profile maker's fixing pattern
 * (end supports usually take more than intermediate ones because of higher wind suction at edges):
 *   support lines on a run = ⌈ slope length ÷ support spacing ⌉ + 1   (one at the eave and one at the ridge)
 *   fasteners = sheets × (2 × end-support fasteners + (support lines − 2) × intermediate fasteners)
 *   + side-lap stitching screws if the profile needs them, at the given spacing along each side lap.
 * Tiles: fixings per tile × tiles (where every tile is mechanically fixed, e.g. BS 5534 since 2015),
 * or per the local wind-region schedule.
 * Shingles: nails per shingle × shingles (IRC R905.2.6 and makers: 4 nails, 6 in high-wind areas).
 */
import { fail, type Ctx, type Result, type Step } from './context';

export interface SheetFixInput {
  sheets: number;
  slopeMm: number;
  supportSpacingMm: number;
  endPerSheet: number;
  intermediatePerSheet: number;
  sideLapSpacingMm: number | null; // stitching screws along each side lap (null/0 = none)
  sideLaps?: number; // side laps across the roof: Σ (sheets across a plane − 1); defaults to sheets − 1
  edgeClipsPerSupport?: number; // concealed-fix: one extra clip line at the starting edge of each plane
  wastePct: number;
  boxSize: number;
}

export function sheetFixings(input: SheetFixInput, ctx: Ctx): Result<{ supports: number; screws: number; stitching: number; total: number; boxes: number }> {
  const { sheets, slopeMm, supportSpacingMm: sp, endPerSheet: e, intermediatePerSheet: m, wastePct, boxSize } = input;
  if (!(sheets > 0)) return fail('Enter the number of sheets.');
  if (!(slopeMm > 0)) return fail('Enter the sheet run (slope length).');
  if (!(sp > 0) || sp > 6000) return fail(`Enter the ${ctx.terms.purlin} spacing (up to 6 m).`);
  if (!(e >= 0) || !(m >= 0) || e + m === 0) return fail('Enter fasteners per sheet at each support.');
  if (!(wastePct >= 0) || wastePct > 50) return fail('Waste should be between 0 and 50%.');
  if (!(boxSize > 0)) return fail('Enter how many come in a box.');
  const supports = Math.ceil(slopeMm / sp - 1e-9) + 1;
  const inter = Math.max(0, supports - 2);
  const screws = sheets * (2 * e + inter * m) + (input.edgeClipsPerSupport ?? 0) * supports;
  const laps = Math.max(0, input.sideLaps ?? sheets - 1);
  const stitching = input.sideLapSpacingMm && input.sideLapSpacingMm > 0 ? laps * Math.ceil(slopeMm / input.sideLapSpacingMm - 1e-9) : 0;
  const total = Math.ceil((screws + stitching) * (1 + wastePct / 100) - 1e-9);
  const boxes = Math.ceil(total / boxSize - 1e-9);
  const steps: Step[] = [
    { label: `Support lines per sheet (${ctx.terms.purlins})`, formula: `⌈ ${ctx.len(slopeMm)} sheet run ÷ ${ctx.len(sp)} ⌉ + 1`, value: String(supports) },
    { label: 'Fasteners per sheet', formula: `2 ends × ${e} + ${inter} intermediate × ${m}`, value: String(2 * e + inter * m) },
    { label: 'Fasteners for all sheets', formula: `${sheets} sheets × ${2 * e + inter * m}${input.edgeClipsPerSupport ? ` + ${input.edgeClipsPerSupport} edge clips × ${supports} supports` : ''}`, value: String(screws) },
  ];
  if (stitching) steps.push({ label: 'Side-lap stitching', formula: `${laps} laps × ⌈ ${ctx.len(slopeMm)} ÷ ${ctx.len(input.sideLapSpacingMm!)} ⌉`, value: String(stitching) });
  steps.push({ label: 'To order', formula: `+ ${wastePct}% spare, boxes of ${boxSize}`, value: `${total} (${boxes} box${boxes === 1 ? '' : 'es'})` });
  return { ok: true, value: { supports, screws, stitching, total, boxes }, steps,
    notes: ['Fixing patterns change with wind region, edge zones and support type. Use the maker’s table for the job.'] };
}

export function perPieceFixings(pieces: number, perPiece: number, wastePct: number, boxSize: number, what: string): Result<{ total: number; boxes: number }> {
  if (!(pieces > 0)) return fail(`Enter the number of ${what}.`);
  if (!(perPiece > 0)) return fail('Enter fixings per piece.');
  if (!(boxSize > 0)) return fail('Enter how many come in a box.');
  const total = Math.ceil(pieces * perPiece * (1 + wastePct / 100) - 1e-9);
  const boxes = Math.ceil(total / boxSize - 1e-9);
  return { ok: true, value: { total, boxes }, steps: [
    { label: 'Fixings', formula: `${pieces} ${what} × ${perPiece} + ${wastePct}% spare`, value: String(total) },
    { label: 'Boxes', formula: `⌈ ${total} ÷ ${boxSize} ⌉`, value: String(boxes) },
  ], notes: [] };
}
