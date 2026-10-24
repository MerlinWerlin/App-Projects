# Template budget (fb-1022b B4, measured run 78, 22 Oct 2026)

Measured in the cloud workspace on the committed repo (Node 22, gzip -9 as a stand-in for App Store compression). No device build was possible here (npm registry unreachable), so the app-binary figures are estimates; real numbers need `eas build` on the PC.

## Numbers

| What | 213 templates (run 77) | 354 templates (run 78) |
|---|---|---|
| Path data the app holds at runtime (JSON of all `paths` + `detail`) | ≈ 1.6 MB | **2.39 MB raw / 0.80 MB gzip** |
| Template source files `src/core/templateArt/*.ts` (what Metro bundles) | — | 1.71 MB raw / 0.56 MB gzip |
| All app JS source (app/ + src/, no tests) | — | 3.25 MB raw / 0.99 MB gzip |
| Exported review SVGs `assets/templates/` (not bundled into the app) | 1.6 MB | 2.71 MB |

Per template (runtime path data):

| Level | Count | Avg raw | Avg gzip |
|---|---|---|---|
| Beginner | 153 | 2.9 KB | 1.1 KB |
| Intermediate | 127 | 7.0 KB | 2.5 KB |
| Advanced | 74 | 14.2 KB | 4.8 KB |
| **All** | 354 | **6.8 KB** | **2.3 KB** |

Startup cost (found while measuring): the newer sets (Cute, Heroes, Game world, Movie night, Fairy tales, Kids and the fb-1022b batches) compute their outlines with `occlude.ts` when the module loads. In Node on this (busy) machine importing the catalogue took ≈ 5 s at 213 templates and ≈ 13 s at 354; the older sets (botanical, scenes, wildlife, ornament) are stored as finished path strings and load in milliseconds. On a phone this generation would run on the JS thread at startup.

## Recommendation

1. **Bake the art before growing further (T117, next run).** A script writes each generated set as finished path strings (like the older sets) and `src/core/templates.ts` imports the baked files; a test checks baked == generated so the generator stays the source. This removes the startup cost; download size barely changes (strings compress well).
2. **Size is not the limit for a 500–1 000 template base app.** At ≈ 2.3 KB compressed per template, 500 templates ≈ 1.2 MB and 1 000 ≈ 2.3 MB compressed (≈ 3.4 / 6.8 MB uncompressed in the JS bundle). A typical Expo app downloads at roughly 20–35 MB, so even 1 000 templates add under 10 % to the download and stay far below Apple's 200 MB cellular-download prompt.
3. **Target: 600 templates in the base app** across the next few runs (25–30 per batch, thin shelves first: Animals, Faces, Still life, Places, Fantasy, Shapes), then reassess with a real `eas build` size report. Keep advanced pieces ≤ 30 000 characters each.
4. **No on-demand download packs for now.** Downloading packs needs a server and a network call, which breaks the "no network calls / Data Not Collected" promise and adds hosting cost. If the library ever passes ~1 500 templates, the option is Apple On-Demand Resources / Play Asset Delivery (store-hosted, no own server) — decide then.
5. **Guards that keep quality up as it grows:** `templateSubjects.test.ts` (category ↔ subject), `templateDuplicates.test.ts` (no near-duplicate shapes), per-set tests (bounds, size budget, banned franchise words), `newSets.test.ts` (names in all 11 locales, unique per locale). The old "< 2 MB of SVG" cap in `templates.test.ts` is raised to 6 MB (≈ 900 templates at today's average) to match this budget.

## Update run 79 (22 Oct 2026, evening): baked, 529 templates

| What | 354 (run 78) | **529 (run 79)** |
|---|---|---|
| Runtime path data (JSON of `paths` + `detail`) | 2.39 MB raw / 0.80 MB gzip | **3.06 MB raw / 1.01 MB gzip** |
| Baked set files `src/core/templateArt/baked/` (what Metro now bundles for generated sets) | — | 2.09 MB raw / 0.68 MB gzip |
| Importing the whole catalogue in Node | ≈ 13 s | **≈ 0.3 s** (guard test: < 1 s) |
| Exported review SVGs `assets/templates/` (not in the app) | 2.7 MB | 4.6 MB |

Per template: beginner 225 × 2.9 KB raw / 1.0 KB gzip · intermediate 187 × 6.1 / 2.2 KB · advanced 117 × 11.5 / 3.9 KB · **all 529 ≈ 5.9 KB raw / 2.0 KB gzip**.

- T117 done: generated sets are baked into finished path strings (`scripts/bake-templates.ts`), so the phone never runs generation code; the startup freeze the overseer flagged is gone.
- The download estimate still holds: 529 templates add ≈ 1 MB compressed; 1 000 would add ≈ 2 MB. **Target stays 600 in the base app**, then reassess with a real `eas build` size report.
- New constraint found: the build artifact carries the repo as one git bundle (8.7 MB now, limit 10 MB). Each 30-template batch adds roughly 0.25 MB (generator + baked file + review SVGs). Git history keeps every old blob, so deleting files does not shrink the bundle; T125 halves future growth (stop committing the generated review SVGs) and adds a split restore (frozen base bundle + small incremental bundle) before the library grows past ~600.

## Update 24 Oct 2026: Letters, 1 940 templates

730 one-character Letters templates (16 styles, `src/core/templateArt/letters/`, generated from open-licence font
outlines by `scripts/gen-letters.py`, integer coordinates) take the library from 1 210 to **1 940**. They are small:
≈ 0.8 MB of TypeScript in total (≈ 1.1 KB per letter; the distressed Typewriter style is the largest at ≈ 3.3 KB),
so the exported SVG total is 7.54 MB and stays under the 8 MB guard without raising it. Letters are exempt from the
near-duplicate guard (the same character in two typefaces is meant to look alike); `letterStyles.test.ts` guards them.
