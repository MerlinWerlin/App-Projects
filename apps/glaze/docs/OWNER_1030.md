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
