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
import type { WidgetArtPiece } from './widgetArtLibrary.ts';

/** Artwork slots shown in the Add Widget gallery. */
export const ARTWORK_SLOT_COUNT = 5;

export type ArtworkSlotColour = { name: string; fill: string; ink: string };

/** Slot 1 first. Slot 6 stays registered for widgets placed before 1.0.24. */
export const ARTWORK_SLOT_COLOURS: readonly ArtworkSlotColour[] = Object.freeze([
  { name: 'coral', fill: '#E5533D', ink: '#FFFFFF' },
  { name: 'amber', fill: '#F2A91D', ink: '#2A1A00' },
  { name: 'mint', fill: '#2FBF8F', ink: '#062A1E' },
  { name: 'blue', fill: '#2F7BEA', ink: '#FFFFFF' },
  { name: 'violet', fill: '#8A5CF0', ink: '#FFFFFF' },
  { name: 'rose', fill: '#E04F8E', ink: '#FFFFFF' },
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
): WidgetArtPiece[] {
  if (artwork) {
    const byId = new Map(pieces.map((p) => [p.id, p] as const));
    return artwork.flatMap((id) => byId.get(id) ?? []);
  }
  if (!currentThemeId) return [];
  const small = pieces
    .filter((p) => p.source !== 'photo' && p.themeId === currentThemeId && p.size === 'small' && !p.live?.design)
    .sort(shelfOrder);
  const art = small.filter((p) => !p.live);
  return art.length ? art : small;
}

/** Piece id → the Artwork slot numbers (1..count) that show it. A piece can fill several slots. */
export function artworkNumbers(
  pieces: readonly WidgetArtPiece[],
  currentThemeId: string | null,
  count: number = ARTWORK_SLOT_COUNT,
): Map<string, number[]> {
  const list = artworkPieces(pieces, currentThemeId);
  const out = new Map<string, number[]>();
  if (!list.length) return out;
  for (let slot = 1; slot <= count; slot++) {
    const id = list[(slot - 1) % list.length].id;
    out.set(id, [...(out.get(id) ?? []), slot]);
  }
  return out;
}
