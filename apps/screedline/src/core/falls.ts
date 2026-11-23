/**
 * Falls and gradients. A fall over a run can be written three ways, all the same slope:
 *   percent = drop ÷ run × 100,  ratio 1 : n with n = run ÷ drop,  mm per metre = drop(mm) ÷ run(m).
 * (Plain trigonometry; percent grade as defined in AS 1428.1 / AS/NZS 3500.3 usage, e.g. 1:100 = 1 %.)
 *
 * Reference falls (shown as presets, never enforced):
 * - NCC 2022 Housing Provisions (surface water drainage): finished ground next to a building falls at least
 *   50 mm over the first 1 m (≈1:20). Paved surfaces may be less steep where the NCC allows; check the clause
 *   for your job.
 * - AS/NZS 3500.3 stormwater: DN90/DN100 pipes commonly laid at 1:100 minimum (DN100 grades vary by use).
 * - Paving and driveways: 1:100 (1 %) is a common minimum to shed water; 1:60 to 1:80 is typical.
 */
import { type Calc, type Errors, type Step, check, fail, hasErrors, ok } from './calc.ts';
import { fmt } from './units.ts';

export type FallMode = 'pct' | 'ratio' | 'drop';
export interface FallInput {
  run: number | null;
  mode: FallMode;
  /** % when mode is pct, n (of 1:n) when ratio, drop in metres when drop. */
  value: number | null;
  /** Optional spacing for string-line peg heights (m). */
  station?: number | null;
}
export interface Station { at: number; below: number }
export interface FallResult { pct: number; ratio: number; drop: number; mmPerM: number; degrees: number; stations: Station[] }

export function falls(i: FallInput): Calc<FallResult> {
  const e: Errors = {};
  const run = check(e, 'run', i.run, { label: 'Run', max: 10000 });
  const label = i.mode === 'pct' ? 'Fall %' : i.mode === 'ratio' ? 'Ratio' : 'Drop';
  const v = check(e, 'value', i.value, { label, max: i.mode === 'pct' ? 1000 : i.mode === 'ratio' ? 100000 : 1000 });
  let st = 0;
  if (i.station != null && i.station !== 0) st = check(e, 'station', i.station, { label: 'Peg spacing', max: 1000 });
  if (hasErrors(e)) return fail(e);
  let drop: number;
  const steps: Step[] = [];
  if (i.mode === 'pct') {
    drop = (run * v) / 100;
    steps.push({ label: 'Drop', working: `${fmt(run, 2)} m × ${fmt(v, 2)} %`, result: `${fmt(drop * 1000, 0)} mm` });
  } else if (i.mode === 'ratio') {
    if (v < 1) return fail({ value: 'Write the ratio as 1 : n with n of 1 or more (e.g. 1 : 100).' });
    drop = run / v;
    steps.push({ label: 'Drop', working: `${fmt(run, 2)} m ÷ ${fmt(v, 1)}`, result: `${fmt(drop * 1000, 0)} mm` });
  } else {
    drop = v;
  }
  if (drop >= run * 10) return fail({ value: 'That is steeper than a wall. Check the numbers.' });
  const pct = (drop / run) * 100;
  const ratio = run / drop;
  const mmPerM = (drop * 1000) / run;
  const degrees = (Math.atan(drop / run) * 180) / Math.PI;
  steps.push({ label: 'Percent', working: `${fmt(drop * 1000, 0)} mm ÷ ${fmt(run * 1000, 0)} mm × 100`, result: `${fmt(pct, 2)} %` });
  steps.push({ label: 'Ratio', working: `${fmt(run, 2)} m ÷ ${fmt(drop, 3)} m`, result: `1 : ${fmt(ratio, ratio >= 100 ? 0 : 1)}` });
  steps.push({ label: 'Per metre', working: `${fmt(drop * 1000, 0)} mm ÷ ${fmt(run, 2)} m`, result: `${fmt(mmPerM, 1)} mm/m` });
  const stations: Station[] = [];
  if (st > 0) {
    const count = Math.min(200, Math.floor(run / st + 1e-9));
    for (let k = 1; k <= count; k++) stations.push({ at: k * st, below: k * st * (drop / run) });
    if (stations.length && Math.abs(stations[stations.length - 1]!.at - run) > 1e-6 && count < 200) stations.push({ at: run, below: drop });
  }
  const notes: string[] = [];
  if (pct < 1) notes.push('Flatter than 1 % (1:100). Water may pond on paving.');
  return ok({ pct, ratio, drop, mmPerM, degrees, stations }, steps, notes);
}

export const FALL_PRESETS: { label: string; mode: FallMode; value: number; detail: string }[] = [
  { label: '1:100', mode: 'ratio', value: 100, detail: '1 %, common minimum for paving and DN100 stormwater' },
  { label: '1:80', mode: 'ratio', value: 80, detail: '1.25 %' },
  { label: '1:60', mode: 'ratio', value: 60, detail: '1.7 %, paths and driveways' },
  { label: '1:20', mode: 'ratio', value: 20, detail: '50 mm over 1 m away from a building (NCC)' },
];
