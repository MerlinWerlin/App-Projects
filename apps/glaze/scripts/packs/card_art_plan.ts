// Glaze 1.0.44 build 98 (owner 24 Nov: "make it a mix of showing some of the best art work ones that
// actualy suit the themes ... maje the split 50/50 betweem clocks and art"): decides, once and for good,
// which theme cards show the theme's Clock widget and which show one of its Artwork widgets. Neighbours
// should differ wherever people see them side by side: in each category rail (weight 5), in the All
// themes grid rows (catalogue order, 3 a row; weight 1), the Free rails and the stage (weight 1). That is
// each rail alternates exactly, and the phase of each rail is picked (all 2^n tried) to keep the
// grid rows and the 50/50 total. Run: node scripts/packs/card_art_plan.ts <catalog-v2.json> <scores.json> > plan.json
import { readFileSync } from 'node:fs';
import { parseCatalog } from '../../src/core/packCatalog.ts';
import { remoteArtTheme } from '../../src/core/remoteCatalog.ts';
import { groupByCategory } from '../../src/core/themeBrowse.ts';
import { FEATURED_FREE_IDS, FREE_THEME_IDS } from '../../src/core/freeThemes.ts';

const [catPath, scoresPath] = process.argv.slice(2);
const cat = parseCatalog(JSON.parse(readFileSync(catPath, 'utf8')));
if (!cat.ok) throw new Error('catalogue');
const scores: Record<string, { path: string; func: boolean }[]> = JSON.parse(readFileSync(scoresPath, 'utf8'));
const themes = cat.value.packs.map((p) => remoteArtTheme(p, 'https://x'));
const ids = themes.map((t) => t.id);
const W = new Map<string, number>();
const edge = (a: string, b: string, w: number) => {
  if (!a || !b || a === b) return;
  const k = a < b ? `${a}|${b}` : `${b}|${a}`;
  W.set(k, (W.get(k) ?? 0) + w);
};
for (const s of groupByCategory(themes)) for (let i = 1; i < s.themes.length; i++) edge(s.themes[i - 1].id, s.themes[i].id, 5);
for (let i = 0; i < ids.length; i++) {
  if (i % 3 !== 0) edge(ids[i - 1], ids[i], 1);
  if (i >= 3) edge(ids[i - 3], ids[i], 0.25);
}
const free = FREE_THEME_IDS.filter((id) => ids.includes(id));
const featured = new Set(FEATURED_FREE_IDS);
const rest = free.filter((id) => !featured.has(id));
for (let i = 1; i < rest.length; i++) edge(rest[i - 1], rest[i], 1);
edge(FEATURED_FREE_IDS[0], FEATURED_FREE_IDS[1], 1);
const eligible = new Set(ids.filter((id) => (scores[id] ?? []).some((c) => !c.func)));
const adj = new Map<string, [string, number][]>();
for (const [k, w] of W) {
  const [a, b] = k.split('|');
  (adj.get(a) ?? adj.set(a, []).get(a)!).push([b, w]);
  (adj.get(b) ?? adj.set(b, []).get(b)!).push([a, w]);
}
// Every category rail alternates exactly (clock, art, clock, ...); which of the two starts each rail is
// chosen to keep the All themes grid rows and the Free rails mixed too, and the total at 50/50.
const sections = groupByCategory(themes);
const art = new Map<string, boolean>(ids.map((id) => [id, false]));
const nArt = () => [...art.values()].filter(Boolean).length;
const setRail = (ix: number, phase: number) => sections[ix].themes.forEach((t, i) => art.set(t.id, eligible.has(t.id) && i % 2 === phase));
const phases = sections.map(() => 0);
phases.forEach((p, ix) => setRail(ix, p));
const score = () => {
  let c = 0;
  for (const [k, w] of W) {
    const [a, b] = k.split('|');
    if (art.get(a) !== art.get(b)) c += w;
  }
  return c - Math.abs(nArt() - ids.length / 2) * 3;
};
// 2^10 phase choices: try them all.
let best = -Infinity, bestMask = 0;
for (let mask = 0; mask < 1 << sections.length; mask++) {
  sections.forEach((_, ix) => setRail(ix, (mask >> ix) & 1));
  const sc = score();
  if (sc > best) [best, bestMask] = [sc, mask];
}
sections.forEach((_, ix) => setRail(ix, (bestMask >> ix) & 1));
let cut = 0, total = 0;
for (const [k, w] of W) {
  const [a, b] = k.split('|');
  total += w;
  if (art.get(a) !== art.get(b)) cut += w;
}
const rails = groupByCategory(themes).map((s) => {
  let alt = 0;
  for (let i = 1; i < s.themes.length; i++) if (art.get(s.themes[i - 1].id) !== art.get(s.themes[i].id)) alt++;
  return `${s.id}:${alt}/${s.themes.length - 1}`;
});
console.error(`art ${nArt()} / ${ids.length}; weighted neighbours differing ${cut}/${total}; rails ${rails.join(' ')}`);
const plan: Record<string, string> = {};
for (const id of ids) if (art.get(id)) plan[id] = scores[id].find((c) => !c.func)!.path;
console.log(JSON.stringify(plan, null, 1));
