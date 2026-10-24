# Owner test 24 Oct 2026 morning (fb-1024)

Owner, after opening Glaze on his iPhone:
- A. "when opening Glaze the animation is good but 'index' pops up at the time before it loads"
- B. "a little laggy moving around the UI"
- C. "attempting to save the wallpaper to photos to trial a theme failed"

Imported in run 97 as T117 (A), T118 (B), T119 (C), tagged `fb-1024`, outranking everything but trial blockers (oversight D128-1 agreed). All three done in run 97. Nothing below was tested on a device; the before/after notes come from reading the code.

## A. Startup flash (T117)
Cause: `app/index.tsx` (the redirect to Themes) was not registered in the root stack, so for a frame it got a default header titled with its file name, "index". `widget-studio` had the same gap. The opening animation also began fading the moment the app mounted, before the first screen had laid out.
Fix:
- `index` registered with `headerShown: false` and no transition; `(tabs)` with no transition; `widget-studio` got its translated title; the stack's default `title` is `''`, so even an unregistered route can never show its file name.
- `app/index.tsx` paints the app background behind the redirect.
- The splash is still held with `SplashScreen.preventAutoHideAsync()` and handed to the glaze-pour intro on its first frame. The intro now mounts the app under itself, waits until the tabs layout reports its first layout plus one frame (`src/core/startupHandoff.ts`), then fades. A 1.2 s cap means it can never hang.
- Tests: `src/core/routeTitles.test.ts` (every route has a translated title or no header; default title empty; index headerless) and `src/core/startupHandoff.test.ts`.

## B. Lag (T118)
Before → after, per screen:
- **Themes:**
  - Before: the first frame built about 71 previews (24 showcase cards and 47 pack cards below the fold), with about 950 per-icon animation hooks.
  - Before: every preview recomputed its wallpaper artwork, about 1 ms each in Node.
  - Before: section layout updates re-rendered the whole screen, and each search keystroke rebuilt cards that were already visible.
  - After: the first frame builds 4 cards. The rest follow at 4 per frame, and the packs at 2 per frame after the first paint.
  - After: previews have static icons, and the icon list and wallpaper artwork are cached per theme and size.
  - After: section positions are tracked on the UI thread, sections and grids are memoised, and cards that stay in the list across a search stay built.
- **Wallpapers:**
  - Before: every focus reloaded the saved loops into a new list, which re-rendered every tile, and a like or filter change re-rendered all of them.
  - After: an unchanged reload keeps the old list and tiles are memoised with stable handlers.
  - After: the grid shows 4 tiles at once, then 2 per frame behind same-sized placeholders.
- **Widgets:**
  - Before: every render re-solved each card's spec, which defeated the preview caching.
  - Before: any change re-rendered all 8–20 previews, the minute clock re-rendered them even while another tab was showing, and a size switch built every preview in one frame.
  - After: specs, sets and swatches are cached per theme, look and size, cards are memoised, and logging a habit updates only the habit cards.
  - After: the chip highlight is instant while the previews update in a background render, the clock ticks only while the tab is open, and the grid shows 2 rows then 1 row per frame.
- **Tabs:** `lazy: true` and `freezeOnBlur: true`, so a hidden tab doesn't re-render when shared stores (likes, the studio) change.

Calm motion is kept: opacity and timing only, on the UI thread, with no springs and no bounce. Guard: `src/core/perf1024.test.ts`. Not done: turning the whole Themes screen into one virtualised list, and caching icon outlines in `src/render/IconCanvas.tsx`. These are next if anything still stutters.

## C. Save to Photos (T119)
Cause (most likely): the wallpaper is drawn off screen (`left: -10000`) for a full-size capture. On iOS, react-native-view-shot's default snapshot (`drawViewHierarchyInRect`) fails for a view outside the window. The error was then shown as one generic line, so the real reason was lost.
Fix (`src/core/photoSave.ts` pipeline, used by `src/render/saveWallpaper.ts`):
- Order: add-only Photos access (`writeOnly`, which needs only NSPhotoLibraryAddUsageDescription, already in app.json, and works in Expo Go) → render → wait 3 frames → capture → make sure the file is a `file://…png` (copied if the name lacks an extension) → `saveToLibraryAsync`.
- On iOS, capture tries `useRenderInContext` first, which works off screen, and falls back to the default snapshot.
- Every failure maps to a plain-words reason: no permission, couldn't make the image, phone full, photo unreadable, too slow, still saving, or Photos refused. The technical message appears in small print, with a **Try again** button, plus **Open Settings** for permission problems. All 11 languages are covered.
- Test: `src/core/photoSave.test.ts` covers the error handling for each step and the fallback order.

## Midday follow-up (owner chat, 24 Oct)

- "glaze can't push widgets until full release it says?" Home Screen widgets need Glaze's own native widget code, which the first TestFlight build leaves out on purpose (GLAZE_NATIVE=0, so the build could not fail on never-compiled Swift). It does not need the App Store release: a second TestFlight build made with the production-native profile turns it on (T123, waiting on the owner's go-ahead; the first compile may need a fix round).
- "index still pops up after the animation" and "still a bit laggy": the build on the phone was shipped from 9203c69 (before run 97). The fixes (T117, T118) are on the build page and go out with the next auto-ship. Retest: T122.
- "couldn't find the profile in Settings" (bulk install): iOS shows a downloaded profile only for about 8 minutes, under "Profile Downloaded" below your name or General > VPN & Device Management > Downloaded Profile, and an already-open Settings may not show it until it is reopened. The install card now says all of this (T121).
