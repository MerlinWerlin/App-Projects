// Theme gallery scroll maths (docs/POLISH.md G1). Pure TS, no React Native imports.
// The parallax helpers carry the 'worklet' directive so reanimated can call them on the UI
// thread; in Node the directive is just an unused string. They match parallaxAt() in ./motion.ts.

export type ArtworkTransform = { translateY: number; scale: number };

/**
 * Where a card sits relative to the viewport centre: (cardCentre - viewportCentre) / viewportHeight.
 * 0 = centred, about -1..1 while on screen. 0 when the viewport is not measured yet.
 */
export function cardProgress(cardCentre: number, scrollY: number, viewportH: number): number {
  'worklet';
  if (!(viewportH > 0) || !Number.isFinite(cardCentre) || !Number.isFinite(scrollY)) return 0;
  return (cardCentre - scrollY - viewportH / 2) / viewportH;
}

/**
 * Transform for a card's artwork. Same curve as parallaxAt (drift against the scroll by up to
 * `maxShift`, up to `maxScale` larger at the centre), times a base over-scale so the drifted
 * artwork never shows an edge inside a frame `height` tall.
 */
export function artworkTransform(
  progress: number,
  height: number,
  maxShift: number = 10,
  maxScale: number = 0.04,
): ArtworkTransform {
  'worklet';
  const p = Number.isFinite(progress) ? Math.min(1, Math.max(-1, progress)) : 0;
  const shift = Math.max(0, maxShift);
  const cover = height > 0 ? 1 + (2 * shift) / height : 1;
  const translateY = p === 0 ? 0 : -p * shift;
  return { translateY, scale: cover * (1 + maxScale * (1 - Math.abs(p))) };
}

/** Index of the centre nearest `viewportCentre` (-1 when there are none). Ties keep the first. */
export function centredIndex(centres: readonly number[], viewportCentre: number): number {
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < centres.length; i++) {
    const c = centres[i];
    if (!Number.isFinite(c)) continue;
    const d = Math.abs(c - viewportCentre);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}
