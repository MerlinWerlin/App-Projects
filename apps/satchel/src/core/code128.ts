// T87 Code 128 barcode encoder (ISO/IEC 15417). Pure TypeScript, offline, no dependencies.
// Encodes printable ASCII (32-126). Code set B for text, code set C (digit pairs) for runs of digits long enough to
// save space: a whole even-length digit string, a leading or trailing run of 4+, or an inner run of 6+. The checksum
// is the start value plus each symbol value times its position (1-based), mod 103. A quiet zone of 10 modules sits
// on each side.

/** Bar/space widths (in modules) for symbol values 0-105; each sums to 11. 106 is the stop (13 modules). */
export const PATTERNS: readonly string[] = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];

export const START_B = 104;
export const START_C = 105;
export const CODE_B = 100; // switch to code set B (from C)
export const CODE_C = 99; // switch to code set C (from B)
export const STOP = 106;
export const QUIET_ZONE = 10;

export type Code128 = {
  /** Symbol values: start, data (with code switches), checksum, stop. */
  values: number[];
  checksum: number;
  /** Module colours left to right, quiet zones included (true = bar). */
  modules: boolean[];
};

/** True when every character can go in a Code 128 symbol here (printable ASCII). */
export function code128Encodable(text: string): boolean {
  if (!text.length) return false;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 32 || c > 126) return false;
  }
  return true;
}

const isDigit = (s: string, i: number) => {
  const c = s.charCodeAt(i);
  return c >= 48 && c <= 57;
};
const digitRun = (s: string, i: number) => {
  let j = i;
  while (j < s.length && isDigit(s, j)) j++;
  return j - i;
};

/** The checksum for a start value and data values: (start + sum(value_i * i)) mod 103. */
export function code128Checksum(values: readonly number[]): number {
  let sum = values[0];
  for (let i = 1; i < values.length; i++) sum += values[i] * i;
  return sum % 103;
}

/** Symbol values (start + data with switches) before the checksum, choosing code sets B and C automatically. */
export function code128Values(text: string): number[] | null {
  if (!code128Encodable(text)) return null;
  const out: number[] = [];
  let set: 'B' | 'C';
  let i = 0;
  const lead = digitRun(text, 0);
  if ((lead === text.length && lead >= 2 && lead % 2 === 0) || lead >= 4) {
    set = 'C';
    out.push(START_C);
  } else {
    set = 'B';
    out.push(START_B);
  }
  while (i < text.length) {
    if (set === 'C') {
      if (digitRun(text, i) >= 2) {
        out.push(Number(text.slice(i, i + 2)));
        i += 2;
        continue;
      }
      out.push(CODE_B);
      set = 'B';
      continue;
    }
    const run = digitRun(text, i);
    const atEnd = i + run === text.length;
    if (run >= 6 || (atEnd && run >= 4)) {
      // An odd run keeps its first digit in set B so the pairs line up.
      if (run % 2 === 1) {
        out.push(text.charCodeAt(i) - 32);
        i++;
      }
      out.push(CODE_C);
      set = 'C';
      continue;
    }
    out.push(text.charCodeAt(i) - 32);
    i++;
  }
  return out;
}

/** Full Code 128 symbol for `text`, or null when it holds characters outside printable ASCII (or is empty). */
export function encodeCode128(text: string): Code128 | null {
  const data = code128Values(text);
  if (!data) return null;
  const checksum = code128Checksum(data);
  const values = [...data, checksum, STOP];
  const modules: boolean[] = new Array(QUIET_ZONE).fill(false);
  for (const v of values) {
    const p = PATTERNS[v];
    for (let k = 0; k < p.length; k++) {
      const w = p.charCodeAt(k) - 48;
      for (let n = 0; n < w; n++) modules.push(k % 2 === 0);
    }
  }
  for (let n = 0; n < QUIET_ZONE; n++) modules.push(false);
  return { values, checksum, modules };
}

/** Bars as [start, width] runs in modules (for drawing one rectangle per bar). */
export function barRuns(modules: readonly boolean[]): Array<[number, number]> {
  const runs: Array<[number, number]> = [];
  let i = 0;
  while (i < modules.length) {
    if (!modules[i]) {
      i++;
      continue;
    }
    let j = i;
    while (j < modules.length && modules[j]) j++;
    runs.push([i, j - i]);
    i = j;
  }
  return runs;
}
