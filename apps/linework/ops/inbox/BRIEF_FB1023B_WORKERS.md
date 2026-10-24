# Worker brief — fb-1023b template batches (run 90, 23 Oct 2026)

You are one of 8 parallel workers adding original line-art templates to Linework (Expo / React Native AR tracing app).
Read first: docs/OWNER_1023B.md, docs/TEMPLATES.md, docs/TEMPLATE_BUDGET.md, ops/CONVENTIONS.md, src/core/templates.ts,
src/core/templateArt/draw.ts, kit2.ts, occlude.ts, one recent batch as the model (e.g. src/core/templateArt/places2.ts +
places2.test.ts + baked/places2.ts + src/i18n/packs/places2.ts), src/core/templateSubjects.ts (category subject words),
src/core/templateDuplicates.ts (near-duplicate guard), scripts/bake-templates.ts, scripts/preview-templates.py.

## Rules (hard)
- Original art only. Never famous characters from films, TV, games, Disney, Marvel, anime, or lookalikes; no brand,
  franchise or competitor names anywhere (names, tags, comments).
- 400×400 viewBox, stroke-only paths (no fill), absolute commands only, every point inside 0..400, `strokeWidth`/`detail`
  as in existing batches. Advanced pieces ≤ 30 000 characters of path data each.
- Each template: unique id with YOUR prefix (check `grep -r "'<id>'" src/core/templateArt` — ids must not exist yet),
  English `name` (unique across the whole catalogue, includes one subject word of its category from templateSubjects.ts),
  `category`, `level` (beginner / intermediate / advanced — aim ~45/35/20 %), `tags`.
- Quality bar: look at every piece. Run `node scripts/export-templates.ts` then
  `python3 -I scripts/preview-templates.py <scratch dir> <your id prefix>` and view the PNG contact sheets with the Read
  tool. Fix anything ugly, broken, clipped or unreadable. Pieces must be traceable on paper: clean, closed shapes, no
  hair-thin clutter.
- Near-duplicate guard and subject guard must pass for your pieces.
- Names in 10 more locales (ar de es fr hi it ja ko pt-BR zh-Hans) in a new pack file src/i18n/packs/<file>.ts exporting
  `<file>Names: PackNames` (copy the shape of src/i18n/packs/places2.ts); unique per locale across the catalogue.
- Expo Go-compatible only; touch no app/ screens, no package.json, no app.json, no native config.

## Files
- Create ONLY your own new files: src/core/templateArt/<file>.ts (generator, exports `const <file>: Template[]`),
  src/core/templateArt/<file>.test.ts (bounds, count, levels, ids/prefix, banned words, budget — model on places2.test.ts),
  src/core/templateArt/baked/<file>.ts (written by the bake script), src/i18n/packs/<file>.ts.
- To test, wire your set in locally: add `{ name: '<file>', file: '<file>' }` to src/core/templateArt/baked/sets.ts, run
  `node scripts/bake-templates.ts`, import from './templateArt/baked/<file>.ts' and spread it at the END of TEMPLATES in
  src/core/templates.ts, add your pack to src/i18n/packs/index.ts, run `node scripts/i18n-template-names.mjs`.
  Then run: `npm test` (all must pass except, until the trade pack is merged, the one assertion in
  src/core/templateShelf.test.ts "shelfBubbles … real library" that expects a New bubble), `sh ops/typecheck-core.sh`,
  `npx tsc -p scripts/tsc-stubs/tsconfig.json`.
- BEFORE COMMITTING, undo the shared wiring so branches merge cleanly:
  `git checkout -- src/core/templates.ts src/core/templateArt/baked/sets.ts src/i18n/packs/index.ts src/i18n/en/templates.ts`
  The integrator wires everything with the exact names above. Never commit assets/templates/*.svg (git-ignored).
- Commit on your branch (message ends with a blank line and
  "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"). The npm registry is unreachable; don't try to install.

## Time
Hard limit: about 50 minutes. If you run short, commit the finished, checked pieces you have (a smaller batch is fine)
rather than nothing. Final reply: branch name, commit hash, template count per category and level, ids list, anything
you are unsure about. Do not claim device testing.
