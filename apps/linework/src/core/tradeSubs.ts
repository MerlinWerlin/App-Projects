// Trade & workshop sub-categories (owner 23 Oct 2026: "the trade section would be good with its own sub categories ...
// that actually could be the main sell point"). Each trade template carries exactly one `sub-<id>` tag; the
// Templates screen shows these as a second chip row when the Trade & workshop bubble is selected. Pure TS.
import type { Template } from './templates.ts';

export const TRADE_SUBS = [
  'angles',
  'carpentry',
  'framing',
  'metal',
  'pipe',
  'electrical',
  'tiling',
  'drafting',
  'layout',
] as const;
export type TradeSub = (typeof TRADE_SUBS)[number];

export function tradeSubOf(t: Pick<Template, 'tags'>): TradeSub | null {
  for (const tag of t.tags ?? []) {
    if (tag.startsWith('sub-')) {
      const id = tag.slice(4) as TradeSub;
      if ((TRADE_SUBS as readonly string[]).includes(id)) return id;
    }
  }
  return null;
}

/** Trade templates in one sub-category (null = all of them). */
export function inTradeSub<T extends Pick<Template, 'tags'>>(pool: readonly T[], sub: TradeSub | null): T[] {
  return sub ? pool.filter((t) => tradeSubOf(t) === sub) : [...pool];
}

/** Count per sub-category, for the chips (empty ones are hidden). */
export function tradeSubCounts(pool: readonly Pick<Template, 'tags' | 'category'>[]): Record<TradeSub, number> {
  const out = Object.fromEntries(TRADE_SUBS.map((s) => [s, 0])) as Record<TradeSub, number>;
  for (const t of pool) {
    if (t.category !== 'trade') continue;
    const s = tradeSubOf(t);
    if (s) out[s]++;
  }
  return out;
}
