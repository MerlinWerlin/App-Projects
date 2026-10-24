// T118 (fb-1024 B): progressive mounting for the tab grids, beyond T107's showcase reveal
// (core/categorySwitch: REVEAL_FIRST / nextReveal). Cards that were already mounted before a list
// change stay mounted (no tear-down and rebuild when a search or a page swap keeps them); only new
// cards are revealed a few per frame, with same-sized placeholders holding their place.
// Pure TypeScript (Node runs it directly).

/** Theme pack cards (below the showcase, off screen at first) added per frame once the tab is up. */
export const PACK_REVEAL_BATCH = 2;
/** Wallpaper tiles mounted at once after a change (two rows of two), then per frame. */
export const TILE_REVEAL_FIRST = 4;
export const TILE_REVEAL_BATCH = 2;
/** Widget rows mounted at once after a change, then per frame. */
export const WIDGET_ROWS_FIRST = 2;
export const WIDGET_ROWS_BATCH = 1;

/** Next mounted count after one frame. */
export function revealStep(current: number, total: number, batch: number): number {
  return Math.min(Math.max(0, total), Math.max(0, current) + Math.max(1, Math.floor(batch)));
}

/** Whether the item at `index` (with id `id`) is mounted: within the revealed count or kept from before. */
export function isMounted(index: number, revealed: number, kept: ReadonlySet<string>, id: string): boolean {
  return index < revealed || kept.has(id);
}

/**
 * Ids of the next list that were already mounted in the previous one (revealed by index, or kept
 * from an earlier swap). They stay mounted across the swap.
 */
export function keptAcrossSwap(
  prevIds: readonly string[],
  prevRevealed: number,
  prevKept: ReadonlySet<string>,
  nextIds: readonly string[],
): Set<string> {
  const mounted = new Set<string>();
  prevIds.forEach((id, i) => {
    if (isMounted(i, prevRevealed, prevKept, id)) mounted.add(id);
  });
  const out = new Set<string>();
  for (const id of nextIds) if (mounted.has(id)) out.add(id);
  return out;
}

/** How many items mount on the first frame after a change. */
export function firstReveal(total: number, first: number): number {
  return Math.min(Math.max(0, total), Math.max(1, Math.floor(first)));
}

/** Every mounted count from a change until the list is complete (for tests and docs). */
export function revealSchedule(total: number, first: number, batch: number): number[] {
  if (total <= 0) return [0];
  const out = [firstReveal(total, first)];
  while (out[out.length - 1] < total) out.push(revealStep(out[out.length - 1], total, batch));
  return out;
}

/** How many items of a section (starting at `offset` in a flattened reveal) are mounted. */
export function sectionLimit(offset: number, length: number, revealed: number): number {
  return Math.max(0, Math.min(length, revealed - offset));
}
