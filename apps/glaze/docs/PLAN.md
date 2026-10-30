# Glaze — icon themes, matching widgets and wallpaper packs (working title)

App Factory app id: `glaze` · PC mirror `Desktop\Apps\glaze` · added 12 Oct 2026 at the owner's request (not a scout pick; he wanted the combined app and to undercut the incumbents).
"Glaze" is a working title only; check App Store / trademark availability before launch. Never use a competitor's name (Themify, Icon Themer, MyScreen, ScreenKit, Widgetsmith, intoLive, Loopy, Lockio) anywhere.

## 1. Why this wins

- **Icon/theme apps charge weekly.** Themify (AIBY, large studio, 4.6★ from ~328K ratings) sells weekly or annual memberships with six price points from $4.99. Icon Themer lists weekly $4.99, monthly $6.99, yearly $14.99, lifetime $15.99, plus separate "Icons Changer – Weekly $3.99". Users delete and reinstall to get more free icons.
- **Doing it by hand is miserable** (the owner did it): one Shortcut per app, one icon at a time, hundreds of taps.
- **Moving lock screens are newly possible.** iOS 26 lets apps supply *animated artwork* for the Now Playing item (Apple doc: "Providing animated artwork for media items", MediaPlayer). A handful of brand-new, tiny apps (Loopy, Lockio; single-digit ratings, iOS 26 only) use this to loop a video full-screen on the Lock Screen. Nobody big has combined that with themes yet. Before iOS 26 the only option is a Live Photo wallpaper that animates briefly on wake.
- **Android allows the real thing:** a WallpaperService plays video as a true live wallpaper, and launchers accept pinned shortcuts with custom icons.

## 2. Positioning
1. **One price, no weekly anything.** Free: make-your-own icons (unlimited), one-tap bulk install, starter themes, matching wallpapers, Live Lock Screen with your own videos/GIFs. **Glaze Plus — one-time (~A$7.99 / US$4.99)**, below every competitor's lifetime price: all theme packs, widget styles, extra icon glyph sets, themes for Live Lock Screen playlists. Tip jar. No ads, no tracking, privacy label "Data Not Collected".
2. **Bulk install instead of 60 shortcuts.** Generate one configuration profile (web clips) containing every themed icon, install once, done. Shortcuts method kept as a fallback with a clean guided flow.
3. **Live Photo maker as an extra** (changed 24 Oct, see §10): turn a clip into a Live Photo wallpaper that moves on wake. The iOS 26 continuous loop is parked. Android keeps a true looping live wallpaper.
4. **A theme is the whole look:** wallpaper + icon style + widget style + optional loop, applied in one guided flow.
5. **Original art only.** Icons are generic glyphs (camera, chat, music…) on themed shapes; no brand logos (trademark + App Review). Users may use their own images for any icon.

Screenshot 1 hook: "Themes, icons and widgets that match. One price. No weekly subscription." (changed 24 Oct, §10)

## 3. Platform facts the build must respect (verify each with a spike before relying on it)
- **Icons can't be replaced, only added.** Every app in the category adds a web clip or Shortcut that opens the real app; the original icon goes in the App Library. Say so plainly in onboarding.
- **Web clip profile:** a `.mobileconfig` (plist XML) with one `com.apple.webClip.managed` payload per icon: `Label`, `URL` (the target app's URL scheme, e.g. `spotify:`), `Icon` (PNG data, 180×180 or larger), `FullScreen` false, `IsRemovable` true, `Precomposed` true. iOS installs profiles opened from Safari, Files or Mail ("Profile Downloaded" → Settings → Install). T06 spikes the delivery path that works from Expo Go: share sheet → Save to Files → open in Files (preferred, no server); fallback: a data: URL opened in Safari via expo-web-browser. Unsigned profiles show "Not Verified" — explain it in the flow.
- **URL schemes:** a curated catalogue of ~150 popular apps with their public URL schemes (or universal-link fallback). Apps with no scheme get the Shortcuts method.
- **Live Lock Screen (iOS 26+):** native module: AVAudioSession `.playback` with a silent looping audio track (the app must be a legitimate Now Playing item), `MPNowPlayingInfoCenter` with `MPMediaItemAnimatedArtwork` built from the exported loop (H.264/HEVC, portrait, sized to screen, ≤ ~15 s, no audio), play/stop/next for playlists, remote commands. Needs a development build (not Expo Go) and real-device testing. Battery cost and App Review guideline 2.5.4 (background audio) are the main risks; the existing apps were approved, which is precedent, not a guarantee.
- **Live Photo (all iOS):** pair a still JPEG and a MOV sharing a content identifier (asset identifier metadata), save with PHPhotoLibrary; user sets it with the Live Photo option. Native module, dev build.
- **Widgets:** WidgetKit extension (`@bacons/apple-targets`) reading the active theme from an App Group JSON. Dev build.
- **Expo Go limits:** none of the native features above run in Expo Go. Until TRIAL, only Expo Go libraries (below). The trial shows the full studio, bulk install, wallpapers and the loop editor; "Set on Lock Screen" shows a clear "needs the full build" sheet with Live Photo instructions.

## 4. Screens and flows (Expo Router, tabs: Themes · Icons · Live · Settings)

| Route | What it does |
|---|---|
| `/(tabs)/themes` | Gallery of themes (cards with a live mock Home Screen: wallpaper, 8 icons, a widget). Tap → `/theme/[id]` detail with "Apply this look". First run: 3 tip cards (icons are added not replaced, bulk install, live lock screen). |
| `/theme/[id]` | Preview Home + Lock Screen mocks, palette, icon style; "Apply" walks: save wallpaper → pick apps → install icons → (optional) loop. |
| `/(tabs)/icons` | Icon Studio: app picker (search catalogue, select many), style controls for the whole set (shape squircle/circle/rounded square/blob, background solid/gradient/glass, glyph colour, glyph set, label on/off), per-icon override (own photo, custom glyph, colour), live Home Screen grid preview, "Install icons" → `/install`. |
| `/install` | Method picker: **Bulk (profile)** recommended, **Shortcuts** fallback. Bulk: generate profile → share/save → step cards with screenshots-style illustrations → "Done" checklist. Shortcuts: save each icon to Photos (expo-media-library) + per-app step list with copyable URL. |
| `/(tabs)/live` | Live Lock Screen: projects list; New → pick video or GIF (expo-image-picker videos), trim (start/end, max 15 s), crop to screen aspect (pan/zoom), loop preview (expo-video), playlist of several loops, speed. "Set on Lock Screen" → native (iOS 26 dev build) or sheet explaining it needs the full build + Live Photo instructions. |
| `/wallpaper` | Wallpaper maker for a theme: gradient/mesh/pattern/grain generated in-app (react-native-svg), device-resolution export to Photos. |
| `/settings` | Default icon style, haptics, Glaze Plus (mock until R2), tip jar placeholder, about/privacy ("Data Not Collected"), "How icons work" explainer, version. |

Permission-denied states: Photos denied → explain + Open Settings; media library save denied → same.

## 5. Visual design
Glossy-ceramic feel: deep plum accent on porcelain, with one glaze-drip gradient used sparingly (theme cards, CTA). Big touch targets (≥ 48 pt), haptics on toggles.

```
--porcelain:#F6F3F5  --card:#FFFFFF  --line:#E2DAE0  --ink:#1E1A1D  --muted:#6F6570
--plum:#7A2E6B (accent)  --plum-soft:#F1E1EC  --glaze-a:#7A2E6B --glaze-b:#E0794F (drip gradient)  --ok:#2C7A54  --warn:#A2620F
dark: --porcelain:#121013 --card:#1B181B --line:#332D32 --ink:#F1ECEF --muted:#A89DA6 --plum:#E59AD3 --plum-soft:#3A1F35
```
Fonts: Unbounded (display, headings, used sparingly) and Manrope (body) via `@expo-google-fonts`. Glyphs: Lucide/Feather-style MIT icon sets via `@expo/vector-icons` plus in-repo SVG glyphs.

## 6. Architecture (Expo, TypeScript, no server)

```
app/                    Expo Router screens above
src/core/               pure TS, no React Native imports, tested with node:test (runs offline)
  catalogue.ts          app catalogue: id, name, category, urlScheme | null, glyph, aliases; search
  iconspec.ts           IconSpec {shape, bg, glyph, colours, label, overrideImage?}; theme -> per-app specs; contrast checks (WCAG ≥ 3:1 glyph/bg)
  themes.ts             Theme {id, name, palette, iconStyle, wallpaper params, widget style, plus:boolean, art}; 14 illustrated starters + Plus packs (artwork.ts: motifs, frames, textures, compositions)
  mobileconfig.ts       build .mobileconfig XML: payload UUIDs, identifiers, XML escaping, base64 PNG icons, size estimate, split into multiple profiles if > ~2.5 MB
  colour.ts             hex/hsl/oklch-lite helpers, gradients, palette from image pixels (k-means lite)
  loop.ts               trim/crop/playlist maths: clamp ranges, aspect crop rect, export settings per device size, duration caps
  wallpaper.ts          pattern/gradient/grain parameter generation (seeded RNG) at device resolutions
src/native/             thin adapters behind interfaces: livelock (iOS 26 module, Expo Go stub), livephoto, widgets bridge, media library, sharing
src/render/             IconCanvas (react-native-svg) + capture to PNG (react-native-view-shot)
src/ui/                 components: ThemeCard, HomeMock, LockMock, Slider, Toast, TipsCards
src/theme/tokens.ts     tokens above (light + dark)
modules/glaze-livelock/ Expo module (Swift): audio session + Now Playing animated artwork (T10)
modules/glaze-livephoto/ Expo module (Swift): Live Photo pairing + save (T11)
targets/widget/         iOS WidgetKit target (T12)
assets/glyphs/*.svg     in-house generic glyphs; no brand logos
```

**Expo Go first.** Until the TRIAL milestone, use only libraries that ship in Expo Go: expo-router, expo-image-picker, expo-video, expo-media-library, expo-file-system, expo-sharing, expo-web-browser, expo-haptics, expo-clipboard, expo-crypto (UUIDs), expo-mail-composer (feedback email, T23), react-native-svg, react-native-view-shot, react-native-gesture-handler, react-native-reanimated, @react-native-async-storage/async-storage, @expo/vector-icons, @expo-google-fonts/*, plus pure-JS packages. Native modules (T10+) are loaded through `src/native/*` with `requireOptionalNativeModule` so Expo Go never crashes.

## 7. Monetisation
- Free: unlimited make-your-own icons, bulk + Shortcuts install, 14 illustrated starter themes, wallpaper maker, Live Lock Screen with your own video (one loop at a time).
- Glaze Plus (one-time): all theme packs, widget styles, extra glyph sets, Live Lock playlists + theme loops. Only `src/plus/` may read the entitlement.
- Tip jar. No subscription, no ads, no analytics.

## 8. Milestones (progression points)
- **TRIAL (Expo Go on the owner's iPhone):** T01–T09 done; trial kit runs it from the PC with a QR code. The owner can make a full icon set and install it on his real Home Screen, save wallpapers, and preview loops.
- **OWNER-TESTED:** owner feedback (build page comments) turned into tasks and fixed.
- **NATIVE (T10–T13):** Live Lock Screen, Live Photo export, widgets, Android live wallpaper — code-complete against interfaces, verified on the PC with `expo prebuild` / typecheck; real-device testing needs a development build (owner action: Apple Developer account, then `eas build --profile development`).
- **RELEASE-PREP:** R1–R5. **TESTFLIGHT:** owner's Apple Developer account.

## 9. Risks
- Large incumbents with marketing budgets: compete on price ("one price, no weekly") and the moving lock screen.
- Profile install UX shows "Not Verified" and a Settings detour; must be explained well. Apple could restrict web clip profiles in a future iOS; Shortcuts fallback stays.
- Live Lock Screen depends on a new iOS 26 API and background audio: App Review and battery risk; ship it clearly labelled, with an off switch.
- Trademark: no brand logos or names on icons by default; catalogue uses app names only as labels the user chooses.
- Expo Go only supports the latest SDK: the trial kit runs `npx expo install --fix`.

## 10. Parked: true live Lock Screen wallpaper (owner decision 24 Oct 2026 21:03)
Glaze ships around themes, matching icons, themed widgets and wallpaper packs; on iPhone the Live tab makes a Live Photo (moves on wake, not a constant loop). The continuous loop via iOS 26 Now Playing animated artwork (T135) is removed from the app and the native build (no background audio). Plan, triggers and parked code: [docs/future/live-wallpaper/README.md](future/live-wallpaper/README.md) — hammer it hard if Apple opens a real API.

**30 Oct evening (owner-1030b):** Glaze is the App Factory's premium flagship. Interface direction and per-screen plan: [docs/PREMIUM_UI.md](PREMIUM_UI.md). Theme packs are hosted as GitHub Release assets: [docs/PACK_HOSTING.md](PACK_HOSTING.md). Status: [docs/OWNER_1030.md](OWNER_1030.md).
