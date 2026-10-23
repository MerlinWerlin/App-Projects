// T86 designed empty states (docs/MARKET.md "Design reference 18 Oct" §2): which pastel and accent each art
// variant of src/ui/v2/EmptyStateV2.tsx uses. Pure, so the mapping is tested (one distinct pastel per variant).

export type EmptyArt = 'drawings' | 'favourites' | 'search' | 'recents';

export const EMPTY_ARTS: readonly EmptyArt[] = ['drawings', 'favourites', 'search', 'recents'];

/** Accent token names of PaletteV2 (src/theme/tokensV2.ts). */
export type EmptyAccent = 'sunny' | 'bubblegum' | 'sky' | 'lilac';

export type EmptyArtStyle = {
  /** Index into PaletteV2.pastels: [inkSoft, pink, yellow, mint, lilac, sky]. */
  pastel: number;
  accent: EmptyAccent;
};

const STYLES: Record<EmptyArt, EmptyArtStyle> = {
  drawings: { pastel: 2, accent: 'sunny' },
  favourites: { pastel: 1, accent: 'bubblegum' },
  search: { pastel: 5, accent: 'sky' },
  recents: { pastel: 4, accent: 'lilac' },
};

export function emptyArtStyle(art: EmptyArt): EmptyArtStyle {
  return STYLES[art] ?? STYLES.drawings;
}
