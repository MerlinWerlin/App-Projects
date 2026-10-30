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
