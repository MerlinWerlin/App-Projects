// Owner 2026-11-15 (1.0.30: "the vids are so small in the app and i was confused where to see them,
// the first time a widget is select a vid should come up and watching the vid should be an easy
// access button"): each how-to video opens LARGE in its own sheet, once automatically the first time
// a person reaches that task (remembered per category), and always from a "Watch how" button.

export const HOW_TO_CATEGORIES = ['wallpaper', 'icons', 'widgets'] as const;
export type HowToCategory = (typeof HOW_TO_CATEGORIES)[number];

/** AsyncStorage key remembering that a category's video has opened once on its own. */
export function howToSeenKey(category: HowToCategory): string {
  return `glaze.howTo.seen.v1.${category}`;
}

/** The video opens on its own only the first time (not seen yet) and never over Reduce Motion's choice to play. */
export function shouldAutoOpenHowTo(seen: boolean): boolean {
  return !seen;
}
