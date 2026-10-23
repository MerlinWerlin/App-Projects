// T87: the glyph picker's search also finds the Monogram cell. English words always work; the UI
// adds the current locale's own words for it (iconsUi.monogram / iconsUi.monogramLetters), so a
// search in Japanese, Arabic, Hindi… finds it too.

/** English words that always find the Monogram cell, whatever the app's language. */
export const MONOGRAM_SEARCH_TERMS: readonly string[] = ['monogram', 'letters', 'initials'];

/**
 * Normalise text for matching: Unicode-compatible form, lower case, Latin accents dropped
 * (so "lettere" and "létters" behave), and runs of spaces, hyphens and underscores folded to one space.
 */
export function normalizeSearchText(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[\s\-_]+/g, ' ')
    .trim();
}

/**
 * True when the Monogram cell should be shown for this search. An empty query shows it (as it shows
 * every glyph). Otherwise the query must be part of an English term or of one of `localTerms`
 * (the locale's own words), the same "contains" rule the glyph names use.
 */
export function matchesMonogramQuery(query: string, localTerms: readonly string[] = []): boolean {
  const q = normalizeSearchText(query);
  if (!q) return true;
  const terms = [...MONOGRAM_SEARCH_TERMS, ...localTerms].map(normalizeSearchText).filter((t) => t);
  if (terms.some((t) => t.includes(q))) return true;
  // Several words ("monogram letters", "letras monograma"): each must be part of some term.
  const words = q.split(' ');
  return words.length > 1 && words.every((w) => terms.some((t) => t.includes(w)));
}
