// Slider value pop-up maths (T84, docs/MARKET.md "Design reference 18 Oct" §3): the magnified value bubble sits
// over the thumb while dragging, clamped so it never leaves the track, with its little tail still pointing at the
// thumb. Works on one axis (x for horizontal sliders, y for the vertical camera slider). No React Native imports.

export const sliderBubble = {
  /** Scale the bubble springs in from (and back out to). */
  popFrom: 0.6,
  /** Extra rise (points) while it pops in, towards its resting place. */
  rise: 8,
  /** Gap (points) between the bubble and the thumb. */
  gap: 6,
  /** The tail never sits closer than this to the bubble's ends (its rounded corners). */
  tailInset: 14,
  /** Value text size in the bubble (the label row uses 15–16: this is the "magnified" size). */
  fontSize: 22,
} as const;

/**
 * Bubble placement along the track.
 * - `thumbCenter`: thumb centre in track coordinates (points from the track's start).
 * - `bubbleSize`: bubble length along the same axis.
 * - `trackLength`: track length; the bubble stays within 0..trackLength.
 * Returns `start` (the bubble's leading edge) and `tail` (tail centre, measured from the bubble's leading edge).
 */
export function bubbleLayout(
  thumbCenter: number,
  bubbleSize: number,
  trackLength: number,
  tailInset: number = sliderBubble.tailInset,
): { start: number; tail: number } {
  const size = Number.isFinite(bubbleSize) && bubbleSize > 0 ? bubbleSize : 0;
  const len = Number.isFinite(trackLength) && trackLength > 0 ? trackLength : 0;
  const c = Number.isFinite(thumbCenter) ? thumbCenter : len / 2;
  const maxStart = Math.max(0, len - size);
  // A bubble longer than the track is centred on it.
  const start = size >= len ? (len - size) / 2 : Math.min(maxStart, Math.max(0, c - size / 2));
  const inset = Math.min(Math.max(0, tailInset), size / 2);
  const tail = Math.min(size - inset, Math.max(inset, c - start));
  return { start, tail };
}

/** Keyframes for the pop value (0 hidden → 1 shown): scale and opacity. Reduce Motion keeps scale at 1. */
export function bubblePopKeys(reduce: boolean): {
  scale: { inputRange: number[]; outputRange: number[] };
  opacity: { inputRange: number[]; outputRange: number[] };
  rise: { inputRange: number[]; outputRange: number[] };
} {
  return {
    scale: { inputRange: [0, 1], outputRange: reduce ? [1, 1] : [sliderBubble.popFrom, 1] },
    opacity: { inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] },
    rise: { inputRange: [0, 1], outputRange: reduce ? [0, 0] : [sliderBubble.rise, 0] },
  };
}
