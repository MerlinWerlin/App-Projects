// Guided first trace (T66, docs/MARKET.md §4.5–4.6): a short 4-step setup guide shown on first run and replayable
// from Settings. Pure data + navigation maths; no React Native imports.
//
// The "seen" flag is the same AsyncStorage key the old 3 first-run tip cards used (KEYS.firstRunDone in
// src/native/storage.ts), so people who already dismissed the tips are not shown the guide again unexpectedly.

/** Step ids double as the illustration id (src/ui/SetupGuideArt.tsx) and the i18n key part (home.guide.step.<id>.*). */
export type GuideStepId = 'stand' | 'pick' | 'lock' | 'trace';

export type GuideStep = { id: GuideStepId; title: string; body: string };

// English source text; the UI reads the translated copy via home.guide.step.<id>.title / .body.
export const SETUP_GUIDE_STEPS: readonly GuideStep[] = [
  {
    id: 'stand',
    title: 'Stand your phone up',
    body: 'Rest it about 20–30 cm above the paper — on a glass, a stack of books or a phone stand — so your hand has room to draw underneath.',
  },
  {
    id: 'pick',
    title: 'Pick a picture',
    body: 'Choose one of your photos or a template. Outline mode can turn a photo into clean lines.',
  },
  {
    id: 'lock',
    title: 'Fade it, then lock it',
    body: 'Slide the opacity until you can see both the picture and your pencil. Then tap Lock so it can’t move — the focus stays put too.',
  },
  {
    id: 'trace',
    title: 'Trace away',
    body: 'Draw along the lines. The controls tuck away while you work — tap once to bring them back. Rather trace over the screen? Try Lightbox.',
  },
];

export type GuideAction = 'next' | 'back' | 'skip';

/** Where the guide is: the current step, and whether it has closed (finished on the last step, or skipped). */
export type GuideNav = { index: number; closed: boolean; finished: boolean };

export function startGuide(): GuideNav {
  return { index: 0, closed: false, finished: false };
}

/** Clamp a step index into [0, total - 1] (0 when there are no steps). */
export function clampStep(index: number, total: number): number {
  if (total <= 0 || !Number.isFinite(index)) return 0;
  return Math.max(0, Math.min(total - 1, Math.trunc(index)));
}

export function isLastStep(index: number, total: number): boolean {
  return total > 0 && clampStep(index, total) === total - 1;
}

/**
 * Next on the last step finishes (closed + finished: the success haptic fires); Skip closes without finishing;
 * Back on the first step stays put. A closed guide ignores further actions.
 */
export function stepGuide(nav: GuideNav, action: GuideAction, total: number): GuideNav {
  if (nav.closed) return nav;
  const i = clampStep(nav.index, total);
  if (action === 'skip') return { index: i, closed: true, finished: false };
  if (action === 'back') return { index: Math.max(0, i - 1), closed: false, finished: false };
  if (total <= 0 || i >= total - 1) return { index: i, closed: true, finished: true };
  return { index: i + 1, closed: false, finished: false };
}

/**
 * Horizontal start offset (pt) for the incoming step's slide: moving forward it comes in from the reading
 * "end" side, moving back from the "start" side. Screen coordinates, so right-to-left flips the sign.
 * Reduced motion uses no slide at all (fade only).
 */
export function slideFrom(forward: boolean, rtl: boolean, distance: number, reduce: boolean): number {
  if (reduce) return 0;
  const endSide = rtl ? -1 : 1;
  return (forward ? endSide : -endSide) * Math.abs(distance);
}
