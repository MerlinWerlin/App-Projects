// Cut-list optimiser: cut pieces from stock lengths with as little offcut as possible, allowing for the saw kerf.
//
// Method (one-dimensional cutting stock, two heuristics, the better plan kept): (A) "best fit": while pieces are left,
// for every stock length still available find the combination of remaining pieces that fills it best (an exact
// bounded subset-sum), take the stock with the highest fill ratio, cut it, repeat; (B) first-fit decreasing into the
// longest stock when stock is unlimited. Each bar is then moved to the shortest stock that still holds its pieces,
// and the plan buying less timber (then fewer lengths) wins. This is the classic sequential heuristic
// for the cutting-stock problem (Gilmore & Gomory 1961 frame the problem; sequential heuristic procedures as in
// Haessler 1975). It is not guaranteed to be the global optimum, but every bar it produces is a valid cut plan.
//
// Kerf: n pieces from one bar need n - 1 saw cuts between them, plus one more if an offcut is left. Pieces and the
// kerf are rounded UP to the next 0.1 mm for the fit.
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
/** Longest stock or piece accepted (mm): anything longer is almost always a units slip, and would be slow to plan. */
export const MAX_LENGTH = 30000;

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
  const maxLen = Math.max(...stock.map((s) => s.length), ...pieces.map((p) => p.length));
  if (maxLen > MAX_LENGTH) return fail(`A length over ${f.len(MAX_LENGTH)}: check the units (2400 mm is 2.4 m).`);
  // Fitting works in whole units of 0.1 mm (1 mm for stock over 7.4 m, to keep the fill table small), with each piece
  // and the kerf rounded up to a unit, so a plan never relies on a fraction smaller than the display shows.
  const Q = Math.max(...stock.map((s) => s.length)) <= 7400 ? 10 : 1;
  const up = (mm: number) => Math.ceil(mm * Q - 1e-6);
  const kerfQ = up(kerf);
  const trimQ = up(trim);
  const capQ = (len: number) => Math.floor(len * Q + 1e-6) - trimQ;
  const longest = Math.max(...stock.map((s) => s.length)) - trim;
  const tooLong = pieces.filter((p) => up(p.length) > Math.max(...stock.map((s) => capQ(s.length))));
  if (tooLong.length) return fail(`${[...new Set(tooLong.map((p) => f.len(p.length)))].join(', ')} won’t fit in your longest stock (${f.len(longest)} after trim). Join it, or add a longer length.`);

  // Group equal lengths; longest first so the reconstruction lists long pieces first on each bar.
  const map = new Map<string, Group>();
  for (const p of pieces) {
    const key = `${p.length}|${p.label ?? ''}`;
    const g = map.get(key);
    if (g) g.left += p.qty;
    else map.set(key, { w: up(p.length), len: p.length, label: p.label, left: p.qty });
  }
  const proto = [...map.values()].sort((a, b) => b.w - a.w);
  const need = (cuts: { w: number }[]) => cuts.reduce((a, c) => a + c.w, 0) + (cuts.length - 1) * kerfQ;

  // Plan A: fill one bar at a time as fully as possible (exact subset-sum per bar).
  const planBestFill = () => {
    const groups = proto.map((g) => ({ ...g }));
    const left = stock.map((s) => (s.qty == null ? Infinity : s.qty));
    const out: { idx: number; items: Group[] }[] = [];
    while (groups.some((g) => g.left > 0)) {
      let best: { idx: number; counts: number[]; used: number; ratio: number } | null = null;
      for (let i = 0; i < stock.length; i++) {
        if (left[i] <= 0 || capQ(stock[i].length) <= 0) continue;
        const counts = bestFill(groups, capQ(stock[i].length) + kerfQ, kerfQ);
        const n = counts.reduce((x, y) => x + y, 0);
        if (!n) continue;
        const used = counts.reduce((x, k, g) => x + k * groups[g].w, 0) + (n - 1) * kerfQ;
        const ratio = used / (stock[i].length * Q);
        if (!best || ratio > best.ratio + 1e-12 || (Math.abs(ratio - best.ratio) < 1e-12 && used > best.used)) best = { idx: i, counts, used, ratio };
      }
      if (!best) break;
      left[best.idx]--;
      const items: Group[] = [];
      best.counts.forEach((k, g) => {
        for (let m = 0; m < k; m++) items.push(groups[g]);
        groups[g].left -= k;
      });
      out.push({ idx: best.idx, items });
    }
    return { bars: out, left, unplaced: groups.filter((g) => g.left > 0).map((g) => ({ length: g.len, qty: g.left, label: g.label })) };
  };

  // Plan B: first-fit decreasing into the longest stock (only when every stock length is unlimited).
  const planFFD = () => {
    if (stock.some((s) => s.qty != null)) return null;
    const idx = stock.reduce((bi, s, i) => (capQ(s.length) > capQ(stock[bi].length) ? i : bi), 0);
    const cap = capQ(stock[idx].length);
    const out: { idx: number; items: Group[] }[] = [];
    for (const g of proto) {
      for (let m = 0; m < g.left; m++) {
        const bin = out.find((b) => need([...b.items, g]) <= cap);
        if (bin) bin.items.push(g);
        else out.push({ idx, items: [g] });
      }
    }
    return { bars: out, left: stock.map(() => Infinity), unplaced: [] as { length: number; qty: number; label: string | undefined }[] };
  };

  // Move each bar to the shortest stock that still holds it, then keep the plan that buys the least timber.
  const finish = (plan: { bars: { idx: number; items: Group[] }[]; left: number[] }) => {
    for (const bar of plan.bars) {
      let bestIdx = bar.idx;
      for (let i = 0; i < stock.length; i++) {
        if (need(bar.items) <= capQ(stock[i].length) && stock[i].length < stock[bestIdx].length && plan.left[i] > 0) bestIdx = i;
      }
      if (bestIdx !== bar.idx) {
        plan.left[bar.idx]++;
        plan.left[bestIdx]--;
        bar.idx = bestIdx;
      }
    }
    return plan.bars.reduce((a, b) => a + stock[b.idx].length, 0);
  };
  let plan = planBestFill();
  let boughtA = finish(plan);
  const alt = planFFD();
  if (alt) {
    const boughtB = finish(alt);
    if (plan.unplaced.length === 0 && (boughtB < boughtA - 1e-6 || (Math.abs(boughtB - boughtA) < 1e-6 && alt.bars.length < plan.bars.length))) {
      plan = alt;
      boughtA = boughtB;
    }
  }
  const bars: Bar[] = plan.bars.map((b) => {
    const cuts: Cut[] = [];
    let pos = trim;
    for (const g of b.items) {
      cuts.push({ length: g.len, label: g.label, start: pos });
      pos += g.len + kerf;
    }
    return { stock: stock[b.idx].length, stockIndex: b.idx, cuts, used: 0, offcut: 0 };
  });

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
  const unplaced = plan.unplaced;
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
