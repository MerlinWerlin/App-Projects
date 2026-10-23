# Linework — AR tracing app (working title)

App Factory app id: `tracing` · PC mirror `Desktop\Apps\tracing` · added 12 Oct 2026 from scout pick #1 (23/25).
"Linework" is a working title only; check App Store / trademark availability before launch. Never use a competitor's name (AR Drawing, Artrace, PicTrace, SketchAR) anywhere.

## 1. Why this wins

The App Store scout (12 Oct 2026) found the AR tracing category charting high on dark patterns:
- AR Drawing: Sketch & Paint (Graphics & Design #6 US, 4.5★ / 93K), Artrace (#3 GB, 4.7★ / 72K), PicTrace (#5 GB).
- Weekly plans of $3–$11 (PicTrace up to £24.99/week). Reviewers say the weekly price is misleading (~$40/month).
- Tracing itself and most templates paywalled; ads that are hard to close.
- Overlay drifts, focus blurs when a hand crosses the view, coloured templates hide the outlines.
- Tracking SDKs (purchases, identifiers, location, user content) in a drawing app.

## 2. Positioning
1. **Tracing is free forever.** Camera overlay, opacity, scale/rotate, lock, flashlight, grid, mirror, outline mode, your own photos, a starter template set. No ads, no trial, no weekly anything. Privacy label "Data Not Collected".
2. **Linework Plus — one-time (~A$7.99 / US$4.99):** extra template packs, themes and timelapse extras. Plus never gates a tracing tool. Tip jar.
3. **Clean lines, not coloured mush:** outline mode turns any photo into clean line art on the device (no upload) with a detail slider, so the outlines stay visible while you draw.
4. **Steady:** lock position, touch-lock (screen ignores taps until long-press), keep screen awake, phone-stand tips. v1 uses a fixed overlay with the phone on a stand or glass (what reviewers actually use); world-anchored AR is a later experiment.
5. **Lightbox mode:** show the image full-bright on screen to trace directly over the phone/iPad with thin paper.

Screenshot 1 hook: "Trace anything. Free. No weekly subscription. Ever."

## 3. Screens and flows (Expo Router: bottom tabs + full-screen stack)

**Navigation (T81).** A bottom tab bar holds the four everyday places: **Trace** (Home, `/`) · **Templates** · **My drawings** · **Settings**. They live in the `app/(tabs)/` group (`Tabs` from expo-router; the group adds no path segment, so URLs are unchanged). The bar (`src/ui/v2/TabBarV2.tsx`, tab list in `src/core/tabs.ts`) is a frosted GlassBar with Feather icons (edit-3 / grid / image / settings), catalogue labels (`common.nav.*`), a rounded inkSoft pill with a selection pop on the active tab, selection haptics, `role="tab"` + selected state, ≥ 44 pt targets and the bottom safe-area inset; it sits in the layout flow so screens end above it, and its row mirrors for right-to-left languages. `/prepare`, `/trace`, `/lightbox` and `/plus` stay full-screen routes on the root Stack and cover the bar; Back (tab history) returns to the tab you came from.

| Route | What it does |
|---|---|
| `/` Home | Big "Trace a photo" (Photos picker) and "Take a photo" buttons, Templates row (categories), Recent images (last 12, local only), Settings gear. First run: 4-step setup guide (stand your phone, pick a picture, fade + lock, trace; T66), replayable from Settings. |
| `/templates` | Grid of bundled line-art templates by category (Animals, Flowers, Faces, Lettering, Shapes, Mandalas). Tap → detail sheet (large preview, level, favourite, line thickness, one "Start tracing" button → trace; T82); long press → trace at once. |
| `/prepare` | Chosen image preview with **Original / Outline** toggle; outline detail slider, line thickness, invert; crop/rotate 90°; "Start tracing". |
| `/trace` | Full-screen back camera (`CameraView`) with the overlay image on top. Controls: opacity slider (vertical, right edge), lock, flashlight, grid, mirror, touch-lock, lightbox, reset fit. Gestures: pinch to scale, two-finger rotate, one-finger pan (disabled while locked). Screen stays awake. Hint toast on first use. |
| `/lightbox` | Image full-bright on a white screen, brightness hint, lock; no camera. |
| `/drawings` | My drawings (T67): free local gallery of paper-check snapshots saved with "Save to My drawings" in the compare view. Grid newest first (cap 200), tap → before/after (CompareView), delete with confirm. Files in documents/drawings/, list in AsyncStorage `linework.drawings`. Never gated by Plus. Home shows a row once one exists. |
| `/settings` | Default opacity, haptics, keep awake, show grid by default, about/privacy ("Data Not Collected"), tip jar placeholder, version. |

Permission-denied states: camera denied → explain + "Open Settings" (Linking.openSettings) + offer Lightbox mode; photos denied → same.

## 4. Visual design
Calm studio feel: warm paper and graphite, one ink-blue accent. Big touch targets (≥ 48 pt), haptics on toggles.

```
--paper:#F5F1EA  --card:#FFFFFF  --line:#DDD5C8  --graphite:#22201C  --muted:#6E675D
--ink:#2346A8 (accent)  --ink-soft:#E3E8F7  --ok:#2C7A54  --warn:#A2620F
dark: --paper:#14130F --card:#1D1B17 --line:#34302A --graphite:#EEE8DE --muted:#A39B8F --ink:#8FA8FF --ink-soft:#1E2846
```
Fonts: Fraunces (display, headings) and Inter (body) via `@expo-google-fonts`. Camera screen controls are dark glass pills (rgba(20,19,15,.55)) with white icons (`@expo/vector-icons` Feather).

## 5. Architecture (Expo, TypeScript, no server)

```
app/                   Expo Router screens (index, templates, prepare, trace, lightbox, settings)
src/core/              pure TS, no React Native imports, tested with node:test (runs offline)
  transform.ts         overlay transform: compose pan/pinch/rotate, clamp scale, fit/reset, mirror, lock
  grid.ts              grid line geometry for N×M grids over a rect
  outline.ts           RGBA -> grayscale -> gaussian blur -> Sobel magnitude -> threshold/hysteresis -> thickness (dilate) -> invert; returns RGBA line art
  image.ts             resize math (fit ≤ 1024 px), rotate-90 index maps
  recent.ts            recent-images list logic (dedupe, cap 12, newest first)
  templates.ts         template catalogue types + lookup
src/native/            thin adapters: decode/encode image bytes (jpeg-js + upng-js, pure JS), file storage, haptics
src/ui/                components: Slider, Toast, TipsCards; v2/ (v2 glass: CameraButton, CameraPill, GlassSheet, …)
src/theme/tokens.ts    tokens above (light + dark)
assets/templates/*.svg original line art made in-house (simple, clean strokes; no traced copyrighted art)
```

**Expo Go first.** Until the TRIAL milestone, use only libraries that ship in Expo Go: expo-camera, expo-blur, expo-linear-gradient, expo-image-picker, expo-image-manipulator, expo-file-system, expo-haptics, expo-keep-awake, expo-router, react-native-gesture-handler, react-native-reanimated, react-native-svg, @react-native-async-storage/async-storage, @expo/vector-icons, @expo-google-fonts/*, plus pure-JS packages (jpeg-js, upng-js). No custom native modules, no dev-client. This is what lets the owner try it on his iPhone with Expo Go and no Apple developer account.

Outline mode pipeline: `ImageManipulator` resizes to ≤ 1024 px and returns base64 JPEG → `jpeg-js` decode to RGBA → `src/core/outline.ts` → `upng-js` encode PNG → write to cache → used as the overlay. Target < 1.5 s for a 1024 px image on an iPhone 12; run in chunks with `requestAnimationFrame`/`setTimeout` yields so the UI shows a spinner.

## 6. Monetisation
- Free: every tracing tool, own photos, outline mode, ~24 starter templates.
- Linework Plus (one-time): template packs (extra ~100), themes, timelapse export extras. Plus never gates a tracing tool. Only `src/plus/` may read the entitlement.
- Tip jar. No subscription, no ads, no analytics.

## 7. Milestones (progression points)
- **TRIAL (Expo Go on the owner's iPhone):** T01–T08 done; trial kit (`START_TRIAL.cmd`) runs the app from the PC with a QR code. Status page headline becomes "Ready to try on your iPhone".
- **OWNER-TESTED:** owner feedback (artifact comments on the build page, or OWNER_NOTES on the PC) turned into tasks and fixed.
- **RELEASE-PREP:** R1–R5 (EAS config, icon/splash, privacy page, store copy, e2e pass).
- **TESTFLIGHT:** needs the owner's Apple Developer account (owner action): `eas build -p ios --profile preview` then `eas submit`.

## 8. Risks
- Crowded clone market: ASO and the free-tracing hook matter most.
- Outline mode in pure JS may be slow on old phones: cap at 1024 px, chunk the work; Skia shader version later if needed.
- Templates must be original or public domain.
- Expo Go only supports the latest SDK: the trial kit runs `npx expo install --fix` so versions match the Expo Go on the owner's phone.
- Outline styles (T49): besides the v2 "classic" engine, `src/core/lineStyles.ts` adds Line art (Canny with CLAHE + automatic thresholds), Sketch (XDoG) and Bold lines, all pure JS (Expo Go). Golden metrics on synthetic fixtures live in `src/core/outlineMetrics.test.ts`.
- True subject cut-out / background removal (drop everything but the person, pet or object) needs a native module — iOS Vision subject lifting (`VNGenerateForegroundInstanceMaskRequest`) — so it only works in a development or TestFlight build, not Expo Go. Tracked as later NATIVE task **T53**, behind an adapter in `src/native/` with the current saliency-based "Subject only" background mode as the Expo Go fallback.
