# Owner brief owner-1101i (Jared in chat, 1 Nov 2026 18:50 Sydney, testing TestFlight 1.0.1 (20))

Jared: "it looks good... we're pretty much there". His chat ships this run to TestFlight straight away. Order: 2, 1, 3.

1. **One simple guided "Use this theme" flow** (T265), spelled out for a first-time iPhone user, progress dots 1-2-3, each step skippable and re-openable from the theme page ("Set it up" section); one sentence per step + an illustration, calm and premium.
   - Step 1 Wallpaper: "Save wallpaper to Photos" (saves straight away), then "Open Photos > tap the wallpaper > Share > Use as Wallpaper > Add / Set as Wallpaper Pair", then "On the Home Screen choice, tap Blur to turn it OFF" (otherwise iOS blurs the Home Screen and the icons won't match). 'Open Photos' button (photos-redirect://) and a small mock of each screen.
   - Step 2 Icons: "Install all icons" (bulk profile), then (a) Safari "Profile Downloaded" - Close; (b) Settings - "More for Your iPhone" (near the top, under your name; older iOS: "Profile Downloaded" row, or General > VPN & Device Management); (c) "Profile Downloaded > View Profile"; (d) Install (top right), passcode, Install again; (e) Home Screen - themed icons are there; move the old ones into the App Library. 'Open Settings' button. Reference: docs/owner_screens_1101/*.png, redrawn with placeholder content, never shipped as-is.
   - Step 3 Widgets: "Long-press the Home Screen > Edit > Add Widget > Glaze > pick a size; long-press the widget > Edit Widget > Art" with a mock.
2. **Crash** (T264): another TestFlight crash on build 20 (stack not yet visible to the API; his chat forwards it). Harden theme apply / return to app / widget art / category browse: catch and recover, never crash; an error boundary per tab screen showing "Something went wrong - Retry".
3. **Prepare for App Store release** (T266, T267): docs/RELEASE_CHECKLIST.md done except owner steps: version decision, STORE.md listing, App Privacy answers, App Review notes (profile web clips, 5.5/4.x risk, reviewer test steps, no login), age rating, export compliance (ITSAppUsesNonExemptEncryption false), support + privacy URLs (docs/site/ pages for publishing), screenshot plan + rendered screenshots 6.9" 1320x2868 and 6.5" 1284x2778 with captions, Plus/IAP free-vs-Plus list (no products created). Owner-only steps go on the Workboard as needs. No store submission.

Records: TRIAL.md "New since your last test (1 Nov, owner-1101i)".

## Done in run 223
- #2 T264 (7cdaf4a): theme apply, return to app, Themes tab browse and widget art paths catch and recover; "Something went wrong · Retry" boundary on every tab and the theme page; bridge Swift guards (NaN crops, zero-size canvases). docs/CRASH_1101I.md. The build 20 crash itself is not identified yet (no stack): T268.
- #1 T265 (bdb79cb): guided 3-step flow opens after Use this theme; Set it up section on the theme page; drawn mocks; Install all icons auto-starts the profile.
- #3 T266 (37c4570) + T267 (47019be): RELEASE_CHECKLIST done except owner steps; STORE.md listing; App Privacy; REVIEW_NOTES paste block; age rating 4+; export compliance (usesNonExemptEncryption false, already set, now guarded); docs/site/ support + privacy pages; 6 screenshots x 2 sizes on the build page under store-screens/ (compositions from app code and assets, not device captures).
- Owner decision needed: what Glaze Plus unlocks (A/B/C, RELEASE_CHECKLIST §2b) — Plus currently unlocks nothing reachable (T269).
