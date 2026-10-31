// Run-94 follow-ups (T100), pure TypeScript.
//   - "Share list" grouped by bag: once rows sit in bags (src/core/bags.ts), the shared packing-list text lists each
//     bag (Carry-on, Personal item, Checked bag, the traveller's own bags) with its rows, then the rows not in a bag
//     yet. A list with no rows in a bag keeps the category grouping of smartpack.packingText.
// The other T100 parts live next to their features: bag hints in other languages (bags.ts), trusted contacts from
// the emergency card and remembered ticks (safecheck.ts), back to the hotel and "does it fit" (dayplan.ts).
import { bagsOf, cleanBagData, type Bag } from './bags.ts';
import { progress, sortByCategory, type PackItem, type PackList } from './packing.ts';
import { packingText, type PackTextWords } from './smartpack.ts';

/** True when at least one row sits in a bag the list knows (then the shared text is grouped by bag). */
export function bagsInUse(list: PackList): boolean {
  if (list.bags === undefined && !list.items.some((i) => i.bag)) return false;
  const ids = new Set(bagsOf(list).map((b) => b.id));
  return list.items.some((i) => typeof i.bag === 'string' && ids.has(i.bag));
}

export type BagTextWords = PackTextWords & {
  /** A bag's heading ("Carry-on", "Personal item", "Checked bag", or an own bag's name). */
  bag: (b: Bag) => string;
  /** Heading for rows not in a bag yet. */
  noBag: string;
};

export type BagGroup = { bag: Bag | null; items: PackItem[] };

/** Rows by bag in the bags' order (empty bags left out), each bag's rows in category order; then rows with no bag. */
export function groupByBag(list: PackList): BagGroup[] {
  const l = cleanBagData(list);
  const bags = bagsOf(l);
  const ids = new Set(bags.map((b) => b.id));
  const out: BagGroup[] = [];
  for (const bag of bags) {
    const items = l.items.filter((i) => i.bag === bag.id);
    if (items.length) out.push({ bag, items: sortByCategory(items) });
  }
  const loose = l.items.filter((i) => !i.bag || !ids.has(i.bag));
  if (loose.length) out.push({ bag: null, items: sortByCategory(loose) });
  return out;
}

const row = (i: PackItem, words: PackTextWords, qtyOf: (i: PackItem) => number | undefined) => {
  const q = qtyOf(i);
  return `${i.done ? '☑' : '☐'} ${i.label.replace(/\s+/g, ' ').trim()}${q ? ` ${words.qty(q)}` : ''}`;
};

/**
 * The packing list as plain text for the share sheet. With bags in use: title, progress, then one block per bag
 * (☑ packed / ☐ to pack rows with quantities) and a last block for rows not in a bag. Otherwise exactly
 * smartpack.packingText (grouped by category).
 */
export function packingTextByBag(list: PackList, words: BagTextWords, qtyOf: (i: PackItem) => number | undefined = (i) => i.qty): string {
  if (!bagsInUse(list)) return packingText(list, words, qtyOf);
  const p = progress(list);
  const head = [words.title.trim(), words.progress(p.done, p.total)];
  if (words.note) head.push(words.note);
  const blocks = [head.join('\n')];
  for (const g of groupByBag(list)) {
    blocks.push([g.bag ? words.bag(g.bag) : words.noBag, ...g.items.map((i) => row(i, words, qtyOf))].join('\n'));
  }
  return `${blocks.join('\n\n')}\n`;
}
