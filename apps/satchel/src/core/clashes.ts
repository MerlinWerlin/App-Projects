// Per-item overlap lookup for the timeline rows and the item detail (EDGE_CASES "Overlapping items": show both
// items and indicate the overlap; never move or delete either). Built on timeline.overlaps, so the same rules apply
// (hotel stays and notes only clash hotel-vs-hotel, hire cars never clash, items without an end never clash).
import type { Item } from './model.ts';
import { overlaps, sortItems } from './timeline.ts';

/**
 * Item id -> the other items it overlaps, in time order. Items with no clash are absent, so `map.get(id)` is
 * undefined for them. Stored items are not changed.
 */
export function overlapPartners(items: Item[]): Map<string, Item[]> {
  const out = new Map<string, Item[]>();
  const add = (a: Item, b: Item) => {
    const list = out.get(a.id) ?? [];
    if (!list.some((x) => x.id === b.id)) list.push(b);
    out.set(a.id, list);
  };
  for (const [a, b] of overlaps(items)) {
    add(a, b);
    add(b, a);
  }
  for (const [id, list] of out) out.set(id, sortItems(list));
  return out;
}

/** Titles of the items `id` overlaps, joined for one short line ("A, B"); '' when it overlaps nothing. */
export function overlapTitles(partners: Map<string, Item[]>, id: string): string {
  return (partners.get(id) ?? []).map((i) => i.title.trim() || i.kind).join(', ');
}
