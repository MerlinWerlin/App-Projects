// T91: the Widgets tab's 2-column grid, laid out row by row so neighbours share a height.
//
// Habit cards carry extra rows under the tile (T89 "Today: …" log button, T86 goal chip); other
// cards carry none. With a plain wrapping grid, a card next to a habit card ended short while its
// neighbour ran on. Now every card in a row reserves the same extra rows (an empty slot of the same
// height where it has no button), so tiles start and end level and the chips line up.
// Pure; the screen (app/(tabs)/widgets.tsx) renders what these return.

export const WIDGET_GRID_COLUMNS = 2;

/** Split `items` into rows of `columns` (the last row may be shorter). */
export function gridRows<T>(items: readonly T[], columns: number = WIDGET_GRID_COLUMNS): T[][] {
  const n = Number.isFinite(columns) && columns >= 1 ? Math.floor(columns) : 1;
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += n) rows.push(items.slice(i, i + n));
  return rows;
}

/** Which extra rows a card has under its tile. */
export type GridCardExtras = { log: boolean; goal: boolean };

/** The extra rows every card in this row shows or reserves: any card having one means all reserve it. */
export function rowExtras(row: readonly GridCardExtras[]): GridCardExtras {
  return { log: row.some((x) => x.log), goal: row.some((x) => x.goal) };
}

export type GridSlot = 'button' | 'spacer' | null;

/** For one card: draw its button, an empty spacer of the same height, or nothing. */
export function slotFor(has: boolean, rowHas: boolean): GridSlot {
  return has ? 'button' : rowHas ? 'spacer' : null;
}
