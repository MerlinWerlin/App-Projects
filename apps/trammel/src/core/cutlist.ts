// Cut-list optimiser: cut pieces from stock lengths with as little offcut as possible, allowing for the saw kerf.
//
// Method (one-dimensional cutting stock, "best-fit" heuristic): while pieces are left, for every stock length still
// available find the combination of remaining pieces that fills it best (an exact bounded subset-sum, so each bar
// is filled as fully as it can be), take the stock length with the highest fill ratio, cut it, and repeat. Then each
// bar is moved to the shortest stock length that still holds its pieces. This is the classic sequential heuristic
// for the cutting-stock problem (Gilmore & Gomory 1961 frame the problem; sequential heuristic procedures as in
// Haessler 1975). It is not guaranteed to be the global optimum, but every bar it produces is a valid cut plan.
//
// Kerf: n pieces from one bar need n - 1 saw cuts between them, plus one more if an offcut is left. Pieces are
// rounded UP to the next whole millimetre for the fit, so a plan never relies on a fraction of a millimetre.
// End trim (squaring a factory end) is taken off each bar before cutting.
import { type Fmt } from './units.ts';
import { fail, type Calc, type Check, type Step } from './result.ts';

/** price: optional cost of one length, in the country's currency; with prices on every length used, a total is given. */
export type StockSpec = { length: number; qty?: number | null; label?: string; price?: number | null };
export type PieceSpec = { length: number; qty: number; label?: string };
export type CutInput = { stock: StockSpec[]; pieces: PieceSpec[]; kerf?: number | null; trim?: number | null };

export type Cut = { length: number; label?: string; start: number };
export type Bar = { stock: number; stockIndex: number; cuts: Cut[]; used: number; offcut: number };
export type CutResult = {
  bars: Bar[];
  byStock: { length: number; count: number }[];
  bought: number;
  piecesLength: number;
  offcutTotal: number;
  kerfTotal: number;
  yieldPct: number;
  unplaced: PieceSpec[];
  /** Sum of the bars' prices, or null when any length used has no price. */
  cost: number | null;
};

const MAX_PIECES = 1000;

type Group = { w: number; len: number; label?: string; left: number };

/** Best fill of one bar: returns how many of each group to take. Bounded subset-sum, O(groups x capacity). */
export function bestFill(groups: Group[], capacity: number, kerf: number): number[] {
  const cap = Math.floor(capacity);
  const G = groups.length;
  if (cap <= 0 || G === 0) return groups.map(() => 0);
  let reach = new Uint8Array(cap + 1);
  reach[0] = 1;
  const takes: Uint16Array[] = [];
  for (let g = 0; g < G; g++) {
    const w = groups[g].w + kerf;
    const c = groups[g].left;
    const take = new Uint16Array(cap + 1);
    const next = new Uint8Array(cap + 1);
    for (let j = 0; j <= cap; j++) {
      if (reach[j]) {
        next[j] = 1;
        take[j] = 0;
      } else if (j >= w && next[j - w] && take[j - w] < c) {
        next[j] = 1;
        take[j] = take[j - w] + 1;
      }
    }
    takes.push(take);
    reach = next;
  }
  let j = cap;
  while (j > 0 && !reach[j]) j--;
  const counts = groups.map(() => 0);
  for (let g = G - 1; g >= 0; g--) {
    const k = takes[g][j];
    counts[g] = k;
    j -= k * (groups[g].w + kerf);
  }
  return counts;
}

export function optimiseCuts(input: CutInput, f: Fmt): Calc<CutResult> {
  const kerf = input.kerf ?? 3;
  const trim = input.trim ?? 0;
  if (!Number.isFinite(kerf) || kerf < 0 || kerf > 20) return fail('Kerf must be between 0 and 20 mm.');
  if (!Number.isFinite(trim) || trim < 0) return fail('End trim can’t be negative.');
  const stock = (input.stock ?? []).filter((s) => s && Number.isFinite(s.length) && s.length > 0);
  if (!stock.length) return fail('Add at least one stock length.');
  for (const s of stock) if (s.qty != null && (!Number.isInteger(s.qty) || s.qty < 0)) return fail('Stock quantity must be a whole number (leave it empty for unlimited).');
  const pieces = (input.pieces ?? []).filter((p) => p && p.qty !== 0);
  if (!pieces.length) return fail('Add at least one piece to cut.');
  let total = 0;
  for (const p of pieces) {
    if (!Number.isFinite(p.length) || p.length <= 0) return fail('Every piece needs a length more than zero.');
    if (!Number.isInteger(p.qty) || p.qty < 1) return fail('Piece quantities must be whole numbers, 1 or more.');
    total += p.qty;
  }
  if (total > MAX_PIECES) return fail(`Up to ${MAX_PIECES} pieces at a time.`);
  const kerfFit = Math.ceil(kerf - 1e-9);
  const longest = Math.max(...stock.map((s) => s.length)) - trim;
  const tooLong = pieces.filter((p) => Math.ceil(p.length - 1e-9) > longest);
  if (tooLong.length) return fail(`${[...new Set(tooLong.map((p) => f.len(p.length)))].join(', ')} won’t fit in your longest stock (${f.len(longest)} after trim). Join it, or add a longer length.`);

  // Group equal lengths; longest first so the reconstruction lists long pieces first on each bar.
  const map = new Map<string, Group>();
  for (const p of pieces) {
    const key = `${p.length}|${p.label ?? ''}`;
    const g = map.get(key);
    if (g) g.left += p.qty;
    else map.set(key, { w: Math.ceil(p.length - 1e-9), len: p.length, label: p.label, left: p.qty });
  }
  const groups = [...map.values()].sort((a, b) => b.w - a.w);
  const stockLeft = stock.map((s) => (s.qty == null ? Infinity : s.qty));
  const bars: Bar[] = [];
  const remaining = () => groups.reduce((n, g) => n + g.left, 0);

  while (remaining() > 0) {
    let best: { idx: number; counts: number[]; used: number; ratio: number } | null = null;
    for (let i = 0; i < stock.length; i++) {
      if (stockLeft[i] <= 0) continue;
      const usable = stock[i].length - trim;
      if (usable <= 0) continue;
      // The fit works in whole millimetres: the kerf is rounded up (3.2 -> 4), so a plan never relies on a fraction.
      const counts = bestFill(groups, usable + kerfFit, kerfFit);
      const n = counts.reduce((a, b) => a + b, 0);
      if (!n) continue;
      const used = counts.reduce((a, k, g) => a + k * groups[g].w, 0) + (n - 1) * kerfFit;
      const ratio = used / stock[i].length;
      if (!best || ratio > best.ratio + 1e-12 || (Math.abs(ratio - best.ratio) < 1e-12 && used > best.used)) best = { idx: i, counts, used, ratio };
    }
    if (!best) break;
    stockLeft[best.idx]--;
    const cuts: Cut[] = [];
    let pos = trim;
    best.counts.forEach((k, g) => {
      for (let m = 0; m < k; m++) {
        cuts.push({ length: groups[g].len, label: groups[g].label, start: pos });
        pos += groups[g].len + kerf;
      }
      groups[g].left -= k;
    });
    bars.push({ stock: stock[best.idx].length, stockIndex: best.idx, cuts, used: 0, offcut: 0 });
  }

  // Move each bar to the shortest stock that still holds it.
  for (const bar of bars) {
    const need = bar.cuts.reduce((a, c) => a + Math.ceil(c.length - 1e-9), 0) + (bar.cuts.length - 1) * kerfFit + trim;
    let bestIdx = bar.stockIndex;
    for (let i = 0; i < stock.length; i++) {
      if (stock[i].length >= need && stock[i].length < stock[bestIdx].length && stockLeft[i] > 0) bestIdx = i;
    }
    if (bestIdx !== bar.stockIndex) {
      stockLeft[bar.stockIndex]++;
      stockLeft[bestIdx]--;
      bar.stockIndex = bestIdx;
      bar.stock = stock[bestIdx].length;
    }
  }

  let piecesLength = 0;
  let offcutTotal = 0;
  let kerfTotal = 0;
  for (const bar of bars) {
    const sum = bar.cuts.reduce((a, c) => a + c.length, 0);
    const between = (bar.cuts.length - 1) * kerf;
    const rest = bar.stock - trim - sum - between;
    const finalKerf = rest > kerf ? kerf : Math.max(0, rest);
    bar.used = sum;
    bar.offcut = Math.max(0, rest - finalKerf);
    piecesLength += sum;
    offcutTotal += bar.offcut;
    kerfTotal += between + finalKerf;
  }
  bars.sort((a, b) => a.offcut - b.offcut);
  const counts = new Map<number, number>();
  for (const b of bars) counts.set(b.stock, (counts.get(b.stock) ?? 0) + 1);
  const byStock = [...counts.entries()].sort((a, b) => b[0] - a[0]).map(([length, count]) => ({ length, count }));
  const bought = bars.reduce((a, b) => a + b.stock, 0);
  const unplaced = groups.filter((g) => g.left > 0).map((g) => ({ length: g.len, qty: g.left, label: g.label }));
  const yieldPct = bought ? (piecesLength / bought) * 100 : 0;
  const prices = bars.map((b) => stock[b.stockIndex].price);
  const cost = bars.length && prices.every((p) => typeof p === 'number' && Number.isFinite(p) && p >= 0) ? prices.reduce((a: number, p) => a + (p as number), 0) : null;
  const steps: Step[] = [
    { label: 'Stock to get', working: byStock.map((s) => `${s.count} x ${f.len(s.length)}`).join(', ') || 'none' },
    { label: 'Total bought', working: f.len(bought) },
    { label: 'Pieces', working: `${total - unplaced.reduce((a, p) => a + p.qty, 0)} pieces, ${f.len(piecesLength)}` },
    { label: 'Saw kerf', working: `${f.len(kerf)} per cut, ${f.len(kerfTotal)} in all` },
    { label: 'Offcuts', working: `${f.len(offcutTotal)} (${f.num(100 - yieldPct, 1)}% of the stock)` },
  ];
  const checks: Check[] = [];
  if (unplaced.length) checks.push({ level: 'fail', text: `Not enough stock: ${unplaced.map((p) => `${p.qty} x ${f.len(p.length)}`).join(', ')} left over` });
  checks.push({ level: 'warn', text: 'Check each length for splits, knots and bow before you cut, and measure the kerf of your blade' });
  return { ok: true, value: { bars, byStock, bought, piecesLength, offcutTotal, kerfTotal, yieldPct, unplaced, cost }, steps, checks };
}
