// Privacy cover policy (T57): which AppState values hide the vault from the iOS app switcher snapshot.
// iOS takes the switcher snapshot just after the app goes 'inactive' and again on 'background', so both must cover
// at once (no fade in). Back to 'active' the cover fades away. Pure: no React Native imports.

/** AppState values as React Native reports them; unknown strings are treated like 'active' (nothing to hide). */
export type AppStateValue = 'active' | 'background' | 'inactive' | 'unknown' | 'extension';

/** The states that put the cover up. */
export const COVER_STATES: readonly AppStateValue[] = ['inactive', 'background'];

/** True when the app is (about to be) out of view, so a snapshot may be taken. */
export function coversApp(state: string | null | undefined): boolean {
  return state === 'inactive' || state === 'background';
}

/** What the cover does on an AppState change: 'show' instantly, 'fade' away, or 'stay' as it is. */
export type CoverAction = 'show' | 'fade' | 'stay';

/**
 * Next cover action, given whether it is up now, the new AppState and whether a private screen is on screen.
 * Shows instantly (never animated in: the snapshot must not catch a half-faded document). Fades only when it was up
 * and the app is active again, or when no private screen is left. 'unknown' / 'extension' leave it as it is.
 */
export function coverAction(shown: boolean, state: string | null | undefined, guarded: boolean): CoverAction {
  if (!guarded) return shown ? 'fade' : 'stay';
  if (coversApp(state)) return shown ? 'stay' : 'show';
  if (state === 'active') return shown ? 'fade' : 'stay';
  return 'stay';
}
