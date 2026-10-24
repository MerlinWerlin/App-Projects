# OpenAI / StarNet lanes for Rowlight

Split (app starter standard): **OpenAI does the content grind, Claude writes the code.** ChatGPT/Codex work in
GitHub `MerlinWerlin/App-Projects` (branch from `main`, PR titled `Rowlight: ...`), never in PC copies.
Each lane below is self-contained; output files go exactly where stated so the app picks them up.

| Lane | Model | Output | Rules |
|---|---|---|---|
| L1 Translations | Luna (bulk) | `apps/crochet/src/i18n/<lang>.ts` (same keys as `en.ts`, `export const <lang>: Partial<Record<MessageKey,string>>`) then register in `src/i18n/index.ts` CATALOGUES | Keep `{params}` and `one|other`; crochet terms per country (UK terms for en-GB/AU audiences are handled by Settings, not strings) |
| L2 Glossary | Sol | add entries to `STITCHES` in `apps/crochet/src/core/terms.ts` (80+ total) | Plain-words how-to in US terms, own wording, no copied text |
| L3 Sample patterns | Sol | `apps/crochet/src/content/samples.ts` (5 original beginner amigurumi + 2 granny squares) | Must parse: `node --test "src/core/*.test.ts"`; every round's count must check (add a test like the Little Sprout one) |
| L4 Store copy | Astra | `apps/crochet/docs/STORE.md` (EN + 6 languages), keywords, 10 screenshot captions | No competitor names; no claims the app can't do |
| L5 Images (ChatGPT images) | GPT image | icon concepts (1024², no text), 6 onboarding/hero illustrations, store-shot backgrounds → `apps/crochet/assets/art/` + `docs/ART.md` | Cosy, warm, original; berry #B5476A / oat #FBF6EF palette |
| L6 Marketing | Luna | weekly `marketing/pins` + Reddit/TikTok drafts in `marketing/rowlight/` | Partner reviews before anything is posted; nothing posts automatically |
| L7 Review | Codex | PR review of every Rowlight change against `ops/CONVENTIONS.md` | Comment, don't rewrite |

Image brief (paste into ChatGPT): "App icon for a crochet row-counter app called Rowlight. A soft cream ball of
yarn with a warm yellow highlighter stripe across it (a 'row light'), on a berry-pink (#B5476A) background.
Flat, friendly, rounded, no text, centred with generous padding, 1024×1024."
