# Owner brief, 23 Oct 2026 evening (fb-1023b)

"Other than adding a ton of templates, I think this is done. Maybe add some like 45 degree angles for engineers, boilermakers and carpenters, push that in the app photos, make them paid only."

Done live (owner's chat, ~19:00): new category **Trade & workshop** (`trade`, 69 templates in src/core/templateArt/trade.ts): angle guides 15–150°, protractors, angle fans, set squares, 3-4-5 / 5-12-13 square checks, mitres for 4/6/8/12-sided frames, circle divisions (3–16), polygon layouts, bolt-circle flanges (4/6/8), dovetails (1:6, 1:8), finger joint, roof pitches (15–45°), stair stringers (37°, 42°), weld preps (single-V, double-V, single-bevel, J, U, fillet), pipe end cuts (30/45/60°), radius arcs, concentric circles, square / isometric / dot / diagonal grids, herringbone and chevron floor layouts. Every labelled angle is computed and tested exact (0.1°) in the shipped path data. Lengths are not to scale (camera tracing has no physical scale); the detail sheet says "Angles are exact. Lengths are not to scale on paper." in 11 languages.
Linework Plus only: locked unless the person owns Plus or is inside the 14-day trial; never a starter (src/plus/tradeAccess.test.ts). First bubble on the Templates shelf and part of New.
Still open: C3 (more templates toward 800+) and C4 (a store shot for the pack).

## Build run 90 (23 Oct 2026, ~18:30–19:40 Sydney): C3 + C4, and the 1.0 starters pinned

- Run 90 was fired with this brief while the live session was building the pack. It built its own trade sets too, but the live pack (f1062a3) was already shipped over the air, so on merge the shipped pack was kept as is (same ids on devices) and run 90's duplicate trade sets were dropped (DECISIONS).
- C3: 12 new batches, 216 templates across 12 categories: Birds & insects 20, Flowers 16, Lettering 18, Mandalas 18, Kids 20, Simple shapes 16, Frames & patterns 18, Still life 18, Animals 18, Faces & figures 18, Buildings & landscapes 18, Fantasy 18. Catalogue 598 → 814.
- C4: store copy "800+ templates" in 11 locales, shot 04 re-rendered (both styles), trade-pack shot idea + localised captions in docs/STORE.md.
- The 24 starters of the 1.0 release are pinned by a test (src/plus/access.test.ts), so adding templates can never move a free template behind the lock; paid-only categories are skipped by `isPaidOnly` (src/plus/access.ts).
- app.json `version` 1.0.0 (the live session had already set it). No native changes: no plugins, dependencies or native config touched.
- Review SVGs for new templates are no longer committed (T128 part 1); `node scripts/export-templates.ts` writes them on demand.
