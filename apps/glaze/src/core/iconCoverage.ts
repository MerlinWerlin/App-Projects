// T170 (owner: "what happens to icons that don't have themes?"): which of the user's apps get the
// theme's own art (a glyph drawn in the theme's style), which fall back to a monogram (the app's
// letters, designed by the theme), and which show the user's own photo. app/install.tsx shows the
// count ("12 themed · 3 monogram") and lists the monogram apps, each one tap from the glyph / photo
// picker. Pure TS (no React Native / Expo).

import { wantsMonogram } from './iconspec.ts';

export type IconCoverage = 'themed' | 'monogram' | 'photo';

/** The spec fields the classification reads (an IconSpec fits). */
export type CoverageSpec = { appId: string; glyph: string; overrideImage?: string };

/** How one app is drawn: the user's photo, a monogram (no glyph we ship), or theme art. */
export function iconCoverage(spec: CoverageSpec): IconCoverage {
  if (typeof spec.overrideImage === 'string' && spec.overrideImage.trim().length > 0) return 'photo';
  return wantsMonogram(spec.glyph) ? 'monogram' : 'themed';
}

export type CoverageSummary = {
  total: number;
  themed: number;
  monogram: number;
  photo: number;
  /** Monogram apps, in the given order (the ones worth a tap). */
  monogramIds: string[];
};

export function coverageSummary(specs: readonly CoverageSpec[]): CoverageSummary {
  const out: CoverageSummary = { total: 0, themed: 0, monogram: 0, photo: 0, monogramIds: [] };
  const seen = new Set<string>();
  for (const s of specs) {
    if (seen.has(s.appId)) continue;
    seen.add(s.appId);
    const k = iconCoverage(s);
    out.total++;
    out[k]++;
    if (k === 'monogram') out.monogramIds.push(s.appId);
  }
  return out;
}

/**
 * Rows for the install screen's "Your apps" list: monograms first (they are the ones to fix), then
 * photos, then themed apps, each group keeping the given order. Duplicate app ids are dropped.
 */
export function coverageRows<T extends CoverageSpec>(specs: readonly T[]): { spec: T; coverage: IconCoverage }[] {
  const rank: Record<IconCoverage, number> = { monogram: 0, photo: 1, themed: 2 };
  const seen = new Set<string>();
  const rows: { spec: T; coverage: IconCoverage; i: number }[] = [];
  specs.forEach((spec, i) => {
    if (seen.has(spec.appId)) return;
    seen.add(spec.appId);
    rows.push({ spec, coverage: iconCoverage(spec), i });
  });
  rows.sort((a, b) => rank[a.coverage] - rank[b.coverage] || a.i - b.i);
  return rows.map(({ spec, coverage }) => ({ spec, coverage }));
}
