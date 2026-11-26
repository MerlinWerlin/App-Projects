// Owner 2026-11-12 ("like colour code them or some thing"): every "Artwork n" widget slot has one
// fixed colour, the same in every theme, so the gallery tile "blue 4" visibly matches artwork 4 in
// the app. The same table is in targets/widget/ThemeArtWidgets.swift (ArtworkSlotColour); a test
// keeps them equal. Each slot's colour is a strong mid tone with its own ink (white, or a dark ink
// on the light amber / mint), readable on light and dark backgrounds.
//
// Which piece is Artwork n: since 2026-11-13 the index's ordered `artwork` list (pure illustrations,
// written at theme apply by commitThemeArt), read by the app here and by ThemeArtSlots in
// ThemeArtWidgets.swift, cycling when the theme has fewer pieces than slots. Older indexes without
// the list fall back to the current theme's small plain pieces in shelf order.
import type { WidgetArtIndex, WidgetArtPiece, WidgetArtSize } from './widgetArtLibrary.ts';

/** Small Artwork slots shown in the Add Widget gallery (Artwork 1-5). */
export const ARTWORK_SLOT_COUNT = 5;

/**
 * Owner 2026-11-27 ("make the number scheme for the galary increase and possibly custom for large
 * and medium as well"): one numbering that keeps going up through the sizes, the same for Artwork
 * and Custom, in the app's Widgets tab and the Home Screen gallery:
 *   small  Artwork 1-5   Custom 1-5   (unchanged, so placed widgets keep their numbers)
 *   medium Artwork 6-7   Custom 6-7
 *   large  Artwork 8-9   Custom 8-9
 * A number always means one size. targets/widget/ThemeArtWidgets.swift (ThemeArtKind.group) and
 * CustomArtWidgets.swift use the same table; artworkSlots.test.ts keeps them equal.
 */
export type ArtworkGroup = { size: WidgetArtSize; first: number; count: number };
export const ARTWORK_GROUPS: readonly ArtworkGroup[] = Object.freeze([
  { size: 'small', first: 1, count: 5 },
  { size: 'medium', first: 6, count: 2 },
  { size: 'large', first: 8, count: 2 },
] as ArtworkGroup[]);
/** Highest Artwork / Custom number. */
export const ARTWORK_NUMBER_MAX = 9;

export function artworkGroup(size: WidgetArtSize): ArtworkGroup {
  return ARTWORK_GROUPS.find((g) => g.size === size) ?? ARTWORK_GROUPS[0];
}

/** The Artwork / Custom numbers of one size, e.g. medium -> [6, 7]. */
export function artworkNumbersOf(size: WidgetArtSize): number[] {
  const g = artworkGroup(size);
  return Array.from({ length: g.count }, (_, i) => g.first + i);
}

/** Which size an Artwork / Custom number belongs to (1-5 small, 6-7 medium, 8-9 large), or null. */
export function sizeOfArtworkNumber(n: number): WidgetArtSize | null {
  return ARTWORK_GROUPS.find((g) => n >= g.first && n < g.first + g.count)?.size ?? null;
}

/** The index key holding a size's ordered Artwork list. */
export function artworkListKey(size: WidgetArtSize): 'artwork' | 'artworkMedium' | 'artworkLarge' {
  return size === 'medium' ? 'artworkMedium' : size === 'large' ? 'artworkLarge' : 'artwork';
}

/** A size's ordered Artwork list from an index (null = an older index without it). */
export function artworkListOf(lib: Pick<WidgetArtIndex, 'artwork' | 'artworkMedium' | 'artworkLarge'>, size: WidgetArtSize): string[] | null {
  return lib[artworkListKey(size)] ?? null;
}

export type ArtworkSlotColour = { name: string; fill: string; ink: string };

/** Slot 1 first; one colour per Artwork / Custom number 1-9 (slot 6 was also the pre-1.0.24 sixth small slot). */
export const ARTWORK_SLOT_COLOURS: readonly ArtworkSlotColour[] = Object.freeze([
  { name: 'coral', fill: '#E5533D', ink: '#FFFFFF' },
  { name: 'amber', fill: '#F2A91D', ink: '#2A1A00' },
  { name: 'mint', fill: '#2FBF8F', ink: '#062A1E' },
  { name: 'blue', fill: '#2F7BEA', ink: '#FFFFFF' },
  { name: 'violet', fill: '#8A5CF0', ink: '#FFFFFF' },
  { name: 'rose', fill: '#E04F8E', ink: '#FFFFFF' },
  { name: 'teal', fill: '#1A9AAE', ink: '#FFFFFF' },
  { name: 'rust', fill: '#C4512A', ink: '#FFFFFF' },
  { name: 'slate', fill: '#4E5D78', ink: '#FFFFFF' },
]);

export function artworkSlotColour(slot: number): ArtworkSlotColour {
  const n = ARTWORK_SLOT_COLOURS.length;
  return ARTWORK_SLOT_COLOURS[(((Math.floor(slot) - 1) % n) + n) % n];
}

const SIZE_RANK: Record<string, number> = { small: 0, medium: 1, large: 2 };

/** WidgetArtStore.shelfOrder: size, then slot, then newest, then id. */
function shelfOrder(a: WidgetArtPiece, b: WidgetArtPiece): number {
  const sa = SIZE_RANK[a.size ?? ''] ?? 3;
  const sb = SIZE_RANK[b.size ?? ''] ?? 3;
  if (sa !== sb) return sa - sb;
  const la = a.slot ?? Number.MAX_SAFE_INTEGER;
  const lb = b.slot ?? Number.MAX_SAFE_INTEGER;
  if (la !== lb) return la - lb;
  if (a.created !== b.created) return b.created - a.created;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** The pieces Artwork 1, 2, ... draw from (before cycling). */
export function artworkPieces(
  pieces: readonly WidgetArtPiece[],
  currentThemeId: string | null,
  /** Owner 2026-11-13: index.json `artwork`, the ordered list the widget reads too (null = older index). */
  artwork: readonly string[] | null = null,
  /** Owner 2026-11-27: the size whose list this is (medium = Artwork 6-7, large = 8-9). */
  size: WidgetArtSize = 'small',
): WidgetArtPiece[] {
  if (artwork) {
    const byId = new Map(pieces.map((p) => [p.id, p] as const));
    return artwork.flatMap((id) => byId.get(id) ?? []);
  }
  if (!currentThemeId) return [];
  const small = pieces
    .filter((p) => p.source !== 'photo' && p.themeId === currentThemeId && p.size === size && !p.live?.design)
    .sort(shelfOrder);
  const art = small.filter((p) => !p.live);
  return art.length ? art : small;
}

/** Piece id → the Artwork slot number (1..count) that shows it. 1.0.39: one slot per piece, never a repeat. */
export function artworkNumbers(
  pieces: readonly WidgetArtPiece[],
  currentThemeId: string | null,
  count: number = ARTWORK_SLOT_COUNT,
): Map<string, number[]> {
  const list = artworkPieces(pieces, currentThemeId);
  const out = new Map<string, number[]>();
  if (!list.length) return out;
  for (let slot = 1; slot <= Math.min(count, list.length); slot++) {
    const id = list[slot - 1].id;
    out.set(id, [...(out.get(id) ?? []), slot]);
  }
  return out;
}
