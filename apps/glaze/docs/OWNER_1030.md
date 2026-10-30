# Owner brief, 30 Oct 2026 (Jared, via Claude chat) — tasks tagged "owner-1030"

These outrank the backlog. Import them into ops/backlog.json and keep this file's status lines current.

## A. Theme-pack hosting: GitHub instead of Cloudflare R2 (replaces glaze-r2-account)
Jared asked Claude to set up Cloudflare R2. Claude can't: it needs a new account and a payment card, which only Jared may enter. A free host that needs nothing from Jared exists, so use it instead:
- Host remote art packs as **GitHub Release assets** on the public repo MerlinWerlin/App-Projects (tag per pack set, e.g. `glaze-packs-v1`), downloaded from `https://github.com/MerlinWerlin/App-Projects/releases/download/<tag>/<file>`. Free, no account or card, no bandwidth bill. (GitHub Pages is the fallback for small files.)
- Point the app's pack base URL there (src/config or wherever the R2 URL lives), keep the offline-safe behaviour and the integrity check (sha256 in the pack manifest).
- Adapt the existing upload scripts to produce the release asset files + manifest; publishing the release is done by a workflow or a Claude chat with repo access — write exact steps in docs/PACK_HOSTING.md. Drop docs/R2_SETUP.md from the owner's to-do (keep it as reference).
- Never put tokens in the repo.

## B. Apps that have no themed icon
Jared: "what happens to icons that don't have themes?" Today they fall back to a monogram (1–2 letters in the theme's style) and the user can pick a glyph or their own image. Make that path obvious and good-looking:
- In the install flow, show clearly which of the user's apps are themed and which use the monogram, with one tap to choose a glyph or photo.
- Make monograms look designed for each theme (theme font, colours, background treatment), not plain letters.
- Widen the built-in app catalogue (popular apps by category, with their URL schemes for Shortcuts/profile launching) so fewer apps fall back. Original glyph art only — never brand logos.

## C. "Scan my home screen" (new feature, native build)
iOS doesn't let any app see which apps are installed, so a real scan isn't possible. Free workaround with no API: the user takes screenshots of their Home Screen pages and picks them in Glaze; **on-device text recognition** (Apple Vision `VNRecognizeTextRequest`, free, offline) reads the app names under the icons, matches them against the catalogue (fuzzy match, user confirms the list), and adds every found app to the theme with its glyph or monogram. Unmatched names become custom apps with a monogram. Behind an adapter that never crashes Expo Go (falls back to manual picking). Photos are processed on the phone only and never uploaded; say so on screen. Add tests for the name-matching logic.

## D. TestFlight only
Glaze is tested via TestFlight now. Don't point Jared to Expo Go for Glaze in TRIAL.md, Workboard needs or finish messages.

## E. Premium interface upgrade (Jared 30 Oct 21:04: "looking for the interface to be upgraded - this will be our premium app")
Glaze is the App Factory's flagship, premium-feel app. Treat the UI as the top priority after A–D, every run, until it feels like a top-10 paid design app:
- Write docs/PREMIUM_UI.md first: the design direction (calm, rich, editorial; generous spacing; refined type scale; depth via soft layered surfaces/blur, not borders; subtle haptics; smooth timed transitions with NO bounce/springs — Jared's standing rule), the screen-by-screen plan, and what "done" looks like. Build on docs/DESIGN_V2.md, don't restart.
- Upgrade in order of what people see first: onboarding, Themes browse (large art-led cards, theme preview on a phone mock), theme detail (hero preview, apply flow), Widgets, Install flow, Plus sheet, Settings.
- Consistency pass: one token set (colour, radius, spacing, type), one icon style, real empty/loading states (skeletons, not spinners), accessible contrast and Dynamic Type.
- Use the design-critique loop already planned (need glaze-design-critique): render key screens, get a Sol/Astra critique, apply the agreed points, record them in docs/DESIGN_CRITIQUE_1030.md.
- Each run: ship visible UI improvements, and list them in TRIAL.md "New since your last test" with yes/no questions so Jared can judge them on TestFlight.

> Build-run note (run 182): the brief above arrived via App-Projects commits ea142a9 + 2b133ce (Jared's chat, 30 Oct 20:39/21:04 Sydney). Its tasks are tagged `owner-1030b` (T169+). The earlier 16:30 brief of the same day follows below with its status; A above replaces its Cloudflare R2 plan.

## Status of owner-1030b (kept current by the build runs)
- Run 182 (30 Oct, 22:xx Sydney): all imported (T169-T173) and A-D done in code; E started. Nothing compiled beyond core (npm registry unreachable) and nothing device-tested.
  - A (T169): packs hosted as GitHub Release assets, tag `glaze-packs-v1` (staging `glaze-packs-staging`); flat asset names (`/` -> `__`), sha256 kept; 404 = offline. `scripts/packs/release_assets.mjs`, workflow `scripts/packs/publish-packs.yml` (GITHUB_TOKEN only, written not run), steps in `docs/PACK_HOSTING.md`. R2_SETUP.md is reference only.
  - B (T170): theme-designed monograms (theme font, colours, badge/ring/glow), Install shows "N themed · M monogram" with one-tap glyph/photo pick, catalogue 379 -> 565 apps (original glyphs; 12 public URL schemes marked unverified).
  - C (T171): Scan my Home Screen: screenshots -> on-device Vision text recognition (new module modules/glaze-home-scan, native build only) -> matched list to confirm; unmatched become monogram apps; Expo Go/Android fall back to the manual list.
  - D (T172): TRIAL.md points to TestFlight only.
  - E (T173): docs/PREMIUM_UI.md written; first slice on Themes browse + large titles. Continues every run.

---

## Earlier brief, same day (owner-1030, manual fire 16:30 Sydney): release prep, theme hosting on Cloudflare R2, professional UI pass

Arrived as the payload of a manual fire of the Glaze build task (Jared in chat 30 Oct 2026 16:30 Sydney: "find and use scheduled tasks that have access ... get the work done"). Also on Google Drive as GLAZE_RELEASE_BRIEF_1030.md (not read; the payload carried the full text). Backlog tasks are tagged `owner-1030` (T159-T165). Status of each item is kept at the bottom of this file.

Jared: "I've got a lot of themes and it's starting to get really good. It needs to start moving towards release now, so we need to start preparing the Cloudflare R2 servers ... the overall user interface can be more professional ... it needs to feel clean, load smoothly, off as minimal processing power as possible, so that when its features do work they move cleanly ... use ChatGPT to also assist you and critique in improving that design."

## A. Theme hosting on Cloudflare R2 (code side now; the account is Jared's step)
Today (docs/THEME_PACKS.md): pack format, resumable downloader with SHA-256 checks, cache index and Settings > Storage exist; PACK_BASE_URL is empty and only 3 themes are bundled in themes/. Codex has made ~87 themes with art plus 261 widget designs on the PC (outside the cloud run's reach; plan for them arriving as theme folders).
1. Decision: host packs on Cloudflare R2 (Jared's choice), public r2.dev URL first, custom domain later. Keep code host-agnostic (PACK_BASE_URL in src/config with staging/production).
2. scripts/packs/build_packs.mjs: theme folders -> versioned packs (manifest.json last, WebP art sized for real device classes, sha256 per file, thumbnails + thumbhash placeholders, catalog.json listing every pack with size).
3. scripts/packs/publish_r2.mjs: upload a built pack to R2 via its S3-compatible API using env R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET (never committed; .env gitignored); Cache-Control immutable for hashed files, short for catalog.json; HEAD-verify every object; --dry-run. Add a GitHub-style workflow file publish-packs.yml (manual dispatch, reads repo secrets) under the app's docs or scripts for auto-ship to place; written but not run until secrets exist. No account creation, no spending.
4. App: catalogue lists remote packs from catalog.json (cached, offline-safe), wire the Download button on app/theme/[id].tsx via usePackAccess; free packs need no Plus, Plus packs gated.
5. docs/R2_SETUP.md: phone-friendly steps for Jared (Cloudflare account, R2 bucket "glaze-packs", enable public r2.dev, R2 API token Object Read & Write for that bucket only, paste the 4 values as GitHub repo secrets). Add Workboard need "glaze-r2-account" (priority soon) pointing at it.
6. Plan for the 87 themes: bundled free starters vs free downloadable packs vs Plus packs; app download target under ~40 MB.

## B. Professional UI pass
Audit of App-Projects apps/glaze (30 Oct): two token sets in use (tokens.ts in 5 files, tokensV2.ts in 74) - finish migrating to one, remove the old imports, and add a guard test against raw hex colours / font sizes / radii in screens (~12 raw colours in src/ui, ~11 distinct font sizes, ~12 distinct radii outside tokens today). One type scale, 4-pt spacing grid, 3 radii (card/control/pill), one elevation style, LargeTitleHeader on every main screen, PillButton variants only, skeletons instead of spinners, calm motion from src/theme/motion.ts honouring useReduceMotion. ChatGPT critique: render the main screens (Themes, Icons, Widgets, Wallpaper, Theme detail, Install, Settings) to PNG screenshots (web export or view-shot), save them as docs/design_review_1030/*.png with a short brief, and add a Workboard need "glaze-design-critique" so the PC-side tasks / Codex review room get Astra/Sol to critique them; adopt agreed points in later runs (record in docs/DESIGN_CRITIQUE_1030.md).

## C. Smooth and light
Audit: 30 files use ScrollView, only 2 a virtualised list; Themes/Icons/Widgets tabs render grids with .map() in (Animated.)ScrollView (31 maps); 12 files use react-native Image vs 7 expo-image; 62 LinearGradient uses; 50 inline style objects. Fix: grids -> FlatList with getItemLayout/windowSize/removeClippedSubviews (or FlashList if it installs) + memoised cells and stable keys; all images -> expo-image cachePolicy memory-disk, fixed sizes, placeholders, thumbnail-size art in grids; replace stacked gradients in list cells with thumbnails; StyleSheet instead of inline objects; memo WidgetPreview/CatalogueWidgetPreview/HomeMock; animations on the UI thread only; lazy-load non-first screens; add a perf-budget test; TRIAL.md iPhone checks (fast scroll Themes, open a theme, back).

## D. Release track
Keep docs/RELEASE_CHECKLIST.md current in plain words (screenshots, privacy labels, IAP, review notes). Known blockers on the board: glaze-test-latest (retest 1.0.1), glaze-iap-product, and auto-ship skipping every app while draft PR #106 is open (factory-pr106-blocks-ship). When done, mark Workboard need "glaze-brief-1030-go" done (done_by "Glaze build").

## Status (kept current by the build runs)
- **Run 179 (30 Oct, 17:xx Sydney):** brief imported (T159-T165).
  - A1-A4 done in code:
    - Host-agnostic `PACK_BASE_URLS` staging/production (empty today, so no network).
    - `scripts/packs/build_packs.mjs` makes WebP packs with 3 wallpaper sizes, sha256 per file, thumbs + ThumbHash, manifest written last, and `catalog.json`. The 3 starters come to 0.81 MB.
    - `scripts/packs/publish_r2.mjs` uses its own SigV4: immutable/short cache headers, HEAD verify, --dry-run, refuses to overwrite a published version. Tested against a mock S3 server; no real host contacted.
    - `scripts/packs/publish-packs.yml` is written, not run.
    - The app lists hosted packs from a cached `catalog.json` (offline-safe) and downloads only the files the phone needs. Free packs need no Plus; Plus packs show the Plus sheet.
  - A5-A6: `docs/R2_SETUP.md` (your phone steps + the tier plan for ~87 themes); Workboard need `glaze-r2-account`.
  - C done (mostly): Themes/Widgets/Wallpapers are virtualised lists, gallery art uses expo-image downscaled and cached, mocks memoised, perf-budget guard test, TRIAL.md checks. Still left (T166): the Icons tab list, a few remaining RN Image files, and the gradient and animation audit.
  - B half done: one token set (tokensV2) and a ratchet guard on raw colours/sizes/radii (T163). The critique needs screenshots from the PC side (`docs/design_review_1030/README.md`, need `glaze-design-critique`).
  - D: `docs/RELEASE_CHECKLIST.md` gained R2 and look-and-feel sections. Nothing compiled or phone-tested (npm registry unreachable from the cloud).
