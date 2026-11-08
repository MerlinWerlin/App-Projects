// owner-1102b T278: the Word clock widget's phrase ("IT'S HALF PAST TEN", "IT'S TWENTY TO SIX").
// Mirrors targets/widget/WordClock.swift: the two word tables below are copied there verbatim and
// wordClock.test.ts checks they stay identical, and that both sides agree on a fixture table
// (__fixtures__/wordClock.json).
//
// Rules: round to the nearest five minutes (0-2 down, 3-7 to 5, ...; 58 rolls into the next hour),
// twelve-hour words, "TO" phrases name the next hour. English only: other languages get a big
// digital time instead (wordClockSupported).
//
// Pure TS, no clock reads: callers pass hour and minute.

/** Hour words, index = hour % 12 (0 is TWELVE). */
export const WORD_CLOCK_HOURS = Object.freeze([
  'TWELVE',
  'ONE',
  'TWO',
  'THREE',
  'FOUR',
  'FIVE',
  'SIX',
  'SEVEN',
  'EIGHT',
  'NINE',
  'TEN',
  'ELEVEN',
] as const);

/** Minute words, index = rounded minute / 5. 0 is placed after the hour; 1-6 say PAST; 7-11 say TO. */
export const WORD_CLOCK_MINUTES = Object.freeze([
  "O'CLOCK",
  'FIVE PAST',
  'TEN PAST',
  'QUARTER PAST',
  'TWENTY PAST',
  'TWENTY-FIVE PAST',
  'HALF PAST',
  'TWENTY-FIVE TO',
  'TWENTY TO',
  'QUARTER TO',
  'TEN TO',
  'FIVE TO',
] as const);

export const WORD_CLOCK_LEAD = "IT'S";

export interface WordClockPhrase {
  /** Display lines, e.g. ["IT'S", "HALF PAST", "TEN"] or ["IT'S", "TEN", "O'CLOCK"]. */
  lines: string[];
  /** The lines joined with spaces. */
  text: string;
  /** Rounded minute step, 0..11. */
  step: number;
}

export function wordClockPhrase(hour: number, minute: number): WordClockPhrase {
  const h = Number.isFinite(hour) ? Math.trunc(hour) : 0;
  const m = Number.isFinite(minute) ? Math.min(59, Math.max(0, Math.trunc(minute))) : 0;
  // Integer rounding to the nearest 5 (identical in Swift: (minute + 2) / 5).
  let step = Math.floor((m + 2) / 5);
  let base = ((h % 24) + 24) % 24;
  if (step === 12) {
    step = 0;
    base += 1;
  }
  const shown = step >= 7 ? base + 1 : base;
  const hourWord = WORD_CLOCK_HOURS[shown % 12];
  const lines = step === 0 ? [WORD_CLOCK_LEAD, hourWord, WORD_CLOCK_MINUTES[0]] : [WORD_CLOCK_LEAD, WORD_CLOCK_MINUTES[step], hourWord];
  return { lines, text: lines.join(' '), step };
}

/** The word clock speaks English only; any other app language shows a big digital time. */
export function wordClockSupported(languageTag: string | null | undefined): boolean {
  return typeof languageTag === 'string' && /^en(?:[-_]|$)/i.test(languageTag.trim());
}
