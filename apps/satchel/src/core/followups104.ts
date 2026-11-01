// T138 run-104 follow-ups (pure, no React Native imports).
//
// Outfit planner: on open, the day list scrolls to today's card while the trip is on (today is one of the plan's
// days, on the trip's own clock: outfitToday). Arrival card jump on the trip screen: VoiceOver focus moves to the
// card's heading once the scroll has settled (at once with Reduce Motion, after the animation otherwise).

/** Index of today's day card in the outfit planner's dates, or null when the trip is not on today. */
export function outfitTodayIndex(dates: readonly string[], today: string): number | null {
  const i = dates.indexOf(today);
  return i >= 0 ? i : null;
}

/** How long the trip screen's animated scroll to the arrival card takes, roughly (React Native's default). */
export const ARRIVAL_SCROLL_MS = 450;

/** Wait before moving accessibility focus to the arrival card after the jump: after the scroll, never during it. */
export const arrivalFocusDelay = (reduceMotion: boolean): number => (reduceMotion ? 50 : ARRIVAL_SCROLL_MS);
