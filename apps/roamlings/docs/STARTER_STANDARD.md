# App Factory: new-app starter standard (24 Oct 2026)

Every new app gets everything below from its first build (T00 / T01), so we stop learning the same lessons app by app. These are taken from what went wrong or right in Linework, Glaze and Couch (12–24 Oct). Each new repo copies this file to docs/STARTER_STANDARD.md, and its first build run turns any missing item into tasks tagged `starter`.

## 1. Pipeline (born shippable)
- **One stream.** The app's shipped home is the GitHub repo MerlinWerlin/App-Projects, folder `apps/<app>`. The hourly "App Factory auto-ship" task merges the build page into it and ships it: a TestFlight build when native code changed, an over-the-air update otherwise. Each run starts by syncing owner fixes made directly in the repo (3-way apply; the owner's change wins).
- **Expo SDK 57 from day one**, with the same pins as the other apps. Set up expo-updates with `runtimeVersion` policy `appVersion` and channel `production`, so updates reach phones without a rebuild.
- **Two EAS profiles:** `production` (no native modules; must pass tests) and `production-native` (widgets, Live Activities and other native modules). Native pieces sit behind adapters that never crash Expo Go.
- **The cloud can't reach the npm registry.** Keep offline checks green every run: `node --test` core tests, `ops/typecheck-core.sh`, `npm run typecheck:ui` against `scripts/tsc-stubs`, and `node ops/ui-check.mjs`. The PC runs the full install and type check.
- **The owner never runs scripts.** His PC auto-installs each build and restarts Expo, and auto-ship handles TestFlight. His only steps are to open the app and give feedback through page comments. Every run updates `docs/TRIAL.md` "New since your last test" with yes/no questions.
- **Onboarding a new app to auto-ship and PC refresh** needs an App Store Connect app record (ascAppId) and both scheduled-task prompts updated. Do this when the app reaches trial.

## 2. First-launch quality (bugs we already paid for)
- **No route name or header flash on startup** (Glaze: "index" flashed). Every route sets `headerShown: false` or a real title. Keep the splash up with `preventAutoHideAsync` and hide it on the first layout, with no white frame in between. Add a test that no route can render its raw name.
- **Original app icon, splash and startup animation** from the start (Couch got these late, on 23 Oct).
- **No lag** (Glaze): use windowed lists (FlatList with stable keys), never `.map()` over hundreds of previews; memoise cards; keep animations on the UI thread; defer offscreen work until after interactions.
- **Motion:** one motion file (120/200/320 ms, one gentle spring at most), Reduce Motion respected, no bouncy springs. Use PressableScale and haptics, with a setting to turn haptics off. Add shimmer skeletons, empty states with a clear next step, and tabular count-up numbers (premium-polish-1013).
- **Save to Photos** (Glaze): import `expo-media-library` legacy, request add-only permission, save a file URI with the right extension after rendering finishes, and show the real reason with Try again / Open Settings if it fails.
- **Permissions:** every denied state explains in plain words and offers Open Settings, plus a fallback path where one exists.
- **Accessibility:** a label and role on every control, touch targets of 48 pt or more, light and dark themes from tokens (no raw colours), Dynamic Type safe.
- **Languages:** strings in a catalogue from day one, so later translations and right-to-left layouts are cheap (Couch owner-1016).

## 3. Honest features (App Review + owner trust)
- **Never ship a fake version of a feature iOS doesn't allow.** Glaze's Now Playing "live lock screen" was called dumb and removed. If iOS forbids something, say so in the UI and offer the real path, such as exporting a Live Photo plus a 3-step guide.
- **Widgets follow the active theme:** write the theme to the App Group, call `reloadAllTimelines`, and make the gallery previews themed too, never plain white. No debug or theme-name text inside widgets.
- **Config-profile installs are unreliable and an App Review 5.5 risk.** Prefer a guided Shortcuts path.
- **Never claim a feature works on a real device** until the owner confirms it.

## 4. Money (same model everywhere)
- **Free core forever.** One-time Plus purchase through a guarded expo-iap adapter (the Linework pattern), with restore purchases in Settings. A free trial, if used, is a free non-consumable "14-day trial" item (Linework).
- **No subscriptions, weekly plans, ads, tracking SDKs, accounts or network calls** unless the feature needs them. Privacy label "Data Not Collected".
- **Paywall sheet:** close button visible from the start, plain price, no fake timers. A test proves the core screens never read the entitlement.
- **Release kit tasks from the start:** `docs/privacy.html` and `docs/support.html` (GitHub Pages), `docs/STORE.md` (title, subtitle, keywords, description, 6 screenshot captions, no competitor names), a screenshot kit (Couch owner-1017), and `docs/RELEASE_CHECKLIST.md` with the owner's App Store Connect steps (Paid Apps agreement, IAP product ids).

## 5. Content and art
- All art, icons, prompts and templates are original. No brand logos, famous characters, lyrics or competitor names. NASA, ESA and Webb images are fine with their credit and licence recorded.
- **Use OpenAI wherever it's the cheaper hand:**
  - **GPT image generation** for wallpapers, hero art, store screenshots' backgrounds, mascot concepts and onboarding illustrations. Each image is saved with its prompt in `meta.json`. Not for icon sets: generate those from vector glyphs.
  - **Codex (PC bridge)** reviews every app every overseer cycle and returns patches; Claude accepts or rejects them in `ops/DECISIONS.md`.
  - **StarNet Project 002** (pending activation): per-app OpenAI reviewer and worker lanes (Luna), designer (Astra) and overseer (Sol), so content grinds such as question banks, prompt packs, translations, store copy and theme packs run on OpenAI, while Claude writes the code (one writer per app).
- **Market research per app** (`docs/MARKET.md`): copy competitors' good flows, never their look, words or art.

## 6. Marketing from day one
- Add the app to `marketing/apps.json` in App-Projects (stage, keywords, Reddit queries and subs, claims to avoid) so the weekly "App launch marketing" run makes pins and drafts Reddit replies.
- Until the name is locked, drafts and pins don't name the app.
