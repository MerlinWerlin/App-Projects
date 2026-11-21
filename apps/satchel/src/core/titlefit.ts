// Jared's 1.0 feedback ("Emergency is wrapping"): a big header title must never split a word across lines
// ("Emergenc / y"). The screen lays the title out, reports its lines, and shrinks the font a step while
// brokeMidWord is true, down to TITLE_MIN_SCALE. Pure so it can be tested.

/** Smallest the title shrinks to (of its type size). */
export const TITLE_MIN_SCALE = 0.55;
/** Each shrink step. */
export const TITLE_STEP = 0.9;
/** How far a header title grows with the phone's text size before it stops (its subtitle keeps growing). */
export const TITLE_MAX_FONT_MULTIPLIER = 1.2;

/** True when a line ends inside a word that carries on at the start of the next line. */
export function brokeMidWord(lines: readonly string[]): boolean {
  for (let i = 0; i < lines.length - 1; i++) {
    const end = lines[i];
    const next = lines[i + 1];
    if (!end || !next) continue;
    if (/[\s\-–—/]$/.test(end)) continue;
    if (/^\s/.test(next)) continue;
    return true;
  }
  return false;
}

/** The next scale after a layout: smaller while a word is split, never below the floor. */
export function nextTitleScale(scale: number, lines: readonly string[]): number {
  if (!brokeMidWord(lines)) return scale;
  return Math.max(TITLE_MIN_SCALE, Math.round(scale * TITLE_STEP * 1000) / 1000);
}
