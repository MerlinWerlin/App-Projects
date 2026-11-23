/** Every calculator returns its working as plain steps so the tiler can check the sums on the job. */
export interface Step {
  /** What this line works out, e.g. "Tiles before waste". */
  label: string;
  /** The sum written out with the numbers used, e.g. "8.40 m² ÷ 0.0937 m² per tile = 89.6". */
  working: string;
  /** The answer of this line, already formatted. */
  result: string;
}

export type Problem = { field: string; message: string };

export type CalcResult<T> = { ok: true; value: T; steps: Step[]; notes: string[] } | { ok: false; problems: Problem[] };

export const fail = <T>(...problems: Problem[]): CalcResult<T> => ({ ok: false, problems });

export const ceilSafe = (v: number) => Math.ceil(v - 1e-9);

export const fmt = (v: number, dp = 2) => {
  const f = 10 ** dp;
  const r = Math.round(v * f) / f;
  return r.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: dp });
};
