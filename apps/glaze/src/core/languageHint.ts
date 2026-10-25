// First-launch language line (docs/RELEASE_STANDARD.md §1, docs/I18N.md): the Themes tab shows a small
// "Language: English · Change" line in the very first session only. It goes away once tapped, and never
// comes back in a later session. Pure rules here (tested); src/store/languageHint.ts does the storage.

/** AsyncStorage key: absent = the line has never been shown; 'shown' = a first session already happened. */
export const LANGUAGE_HINT_KEY = 'glaze.languageHint.v1';
export const LANGUAGE_HINT_SHOWN = 'shown';

/**
 * Decide at launch whether this session shows the line.
 * - `stored`: the LANGUAGE_HINT_KEY value (null when absent or unreadable).
 * - `localeOverride`: the saved Settings › Language value (null when absent): someone who already chose a
 *   language in Settings does not need the line.
 * Returns whether to show it and the value to write now (so the next session never shows it again).
 */
export function decideLanguageHint(
  stored: string | null,
  localeOverride: string | null,
): { show: boolean; write: string | null } {
  if (stored !== null) return { show: false, write: null };
  if (localeOverride !== null) return { show: false, write: LANGUAGE_HINT_SHOWN };
  return { show: true, write: LANGUAGE_HINT_SHOWN };
}
