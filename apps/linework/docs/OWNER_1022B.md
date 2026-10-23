# Owner test 22 Oct 2026 (evening) — templates are the priority now (fb-1022b)

Imported in run 78 (22 Oct 2026). Tasks tagged `fb-1022b` outrank everything except trial blockers; keep working them every run until done.

The owner says Linework is "almost there" and wants the template library to be the selling point: "start filling up the template category like a lot … make a judgement call to make a massive app". (He may not yet have seen the 83 fb-1022 templates — his PC copy was older — but the direction stands.)

- **B1 Fix categorisation:** a whale is in "Birds and insects". Audit every template's category (whale → sea/ocean creatures; add a "Sea life" category if needed) and add a test that each template's category matches a curated list of allowed subjects per category.
- **B2 Kawaii / Cute category needs a LOT more:** at least 60 more original kawaii pieces (food with faces, animals, plants, objects, stationery, sweets, clouds/weather, chibi-style original kids and creatures).
- **B3 More Movie night and Fairy tales** (he saw none of these on his old copy): grow each to 40+ with original genre pieces — sci-fi ships and astronauts, monsters, detectives, cowboys, pirates, knights, castles, enchanted forests, witches' cottages, princesses and princes, dragons, mermaids, fairies, giants, talking animals in storybook style. The owner asked for "characters from stuff"; we cannot use real film/TV/game/Disney characters or lookalikes (App Review guideline 5.2 rejection and active enforcement by those owners), so make strong ORIGINAL characters instead — consider a small recurring cast of our own named characters across categories, which could become Linework's mascots.
- **B4 Massive library:** decide the size from data. Measure the current average stored size per template (SVG path data, compressed in the JS bundle) and total app/bundle size; write docs/TEMPLATE_BUDGET.md with the numbers and a recommendation (e.g. how many templates fit in the base app before size hurts downloads, and whether to ship extra packs as on-demand downloads). Then generate templates in batches toward that target (aim for 500+ total across all categories within the next few runs if the budget allows), with a quality bar: clean closed outlines, easy/medium/hard variants where it fits, no near-duplicates (add a duplicate-shape test), names in all 11 locales.
- **B5 Monetisation input for the owner** (he must choose between a ~A$3–4 yearly fee, a one-time purchase, or ads): add a short section to docs/MARKET.md comparing the three for Linework using the competitor prices already researched — expected conversion, App Store rules (subscriptions need ongoing value), what stays free (every tracing tool stays free per hard rules), and which template packs could sit behind the purchase — with a clear recommendation marked "owner decides".

Finish message: counts per category before/after, the storage numbers, the monetisation recommendation in one line, and what to retest.

## Counts before (run 78 start, 213 templates)
flowers 24 · animals 8 · wildlife 16 · faces 7 · lettering 11 · shapes 4 · mandalas 11 · patterns 9 · stilllife 7 · fantasy 6 · places 7 · cute 20 · heroes 13 · game 15 · movies 14 · fairytales 16 · kids 25

## Counts after run 79 (529 templates)
flowers 24 · animals 41 · wildlife 14 · sealife 35 · faces 30 · lettering 11 · shapes 20 · mandalas 11 · patterns 25 · stilllife 24 · fantasy 24 · places 28 · cute 80 · heroes 26 · game 31 · movies 40 · fairytales 40 · kids 25 (beginner 225 · intermediate 187 · advanced 117)
