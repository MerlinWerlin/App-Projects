// Owner 2026-11-13 ("Use everything" icons step "seems scary... looks scammy... so much information
// thrown at you at once"): a gentle first-time walkthrough before the icon install screen, one idea
// per card in calm plain words (no technical terms up front). Shown the FIRST time only; after that
// the theme page offers a one-line "Set up icons" with a "How it works" link that reopens it.

/** AsyncStorage: set once the walkthrough has been seen (finished or skipped). */
export const ICONS_INTRO_SEEN_KEY = 'glaze.iconsIntro.seen.v1';

/** The cards, in order (strings: theme.iconsIntro.steps.<id>). */
export const ICONS_INTRO_STEPS = ['look', 'oneGo', 'confirm', 'undo'] as const;
export type IconsIntroStep = (typeof ICONS_INTRO_STEPS)[number];

/** Where "Use everything" goes for the icons part: the walkthrough first time, then the inline row. */
export function iconsAfterUseEverything(seen: boolean): 'intro' | 'inline' {
  return seen ? 'inline' : 'intro';
}
