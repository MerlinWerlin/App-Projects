# Owner brief 1 Nov 2026 08:32 Sydney (tag `owner-1101`)

Jared, after testing the TestFlight build + the 31 Oct update. Arrived as the payload of a manual fire of the Glaze build task; imported directly (hard-rule exceptions noted). Outranks everything else.

Liked: the Themes tab start page ("looks really good"), the GitHub theme download ("worked really well"), the widget tool. Glaze is now "the most important app we have".

| # | Item | Task | Status |
|---|------|------|--------|
| 1 | Icons open apps through Safari ("Open in <app>?" for Instagram, Spotify, WhatsApp, Notes; YouTube and Settings "address is invalid"). Switch to the no-Safari, no-prompt method; fix invalid schemes; every catalogue app gets a bundle id; test. | T183 | done in the build: Shortcuts "Open App" is the default for every app (no Safari, no prompt; icon saved to Photos per app); Bulk optional with a Safari warning; Settings + YouTube schemes removed; `bundleId` on every entry (237 known ids, null where not certain); test `src/core/catalogueBundleIds.test.ts` |
| 2 | Applying a theme must switch Icons, Widgets and wallpaper state immediately (Cloud Atelier applied, Icons tab still showed the old theme). | T184 | done (JS): "Use this theme" writes icon style, widget theme (App Group) and the theme in use; Icons, Widgets and wallpaper re-read it on focus; downloaded themes no longer fall back to a built-in one |
| 3 | Theme page: preview + "Use this theme" + three separate entry points (Wallpaper, Icons, Widgets), each its own screen. Wallpaper shows "Saved to Photos ✓" and always "Save again". | T185 | done (JS): preview + "Use this theme" (shows "In use ✓") + separate Wallpaper / Icons / Widgets screens; wallpaper "Saved to Photos ✓" + always Save again |
| 4 | Tabs: Themes · Widgets · Icons · Pets · Wallpapers. Live moves into Wallpapers. Wallpapers keeps the collage maker + "My wallpapers". Liked stays in Themes. Old wallpapers wiped from the Wallpapers tab. | T186 | done (JS): 5 tabs; Live Photo maker at /live, reached from Wallpapers; Collage maker; My wallpapers (saved inside Glaze, Save again, Delete); old wallpaper gallery removed from the tab |
| 5 | Widgets for the new themes: every widget art piece Codex made is an option; art fitted, never cropped (medium widget cut off Cloud Atelier's paper boat); pack format v2 (widget options list), v1 still works, documented in docs/THEME_PACKS.md; premium widget menus. | T187 | done: pack format v2 (`src/core/widgetOptions.ts`, docs/THEME_PACKS.md "Remote art pack v2"); v1 art now offered in every size and fitted, never cropped; premium art menu on the Widgets tab; native widget draws art fitted (new build). Republish v2 packs only after this update is on phones (older builds reject v2). |
| 6 | Island pets (Mushy, Pip, Clover) come alive: time-of-day behaviour, idle animations, tap reactions, movement within Live Activity rules; Pets tab with state, mood, settings; battery-light. | T188 | done: `src/core/petLife.ts` day cycle (sleep, stretch, meals, wander/play), moods, tap reactions, Feed/Play, settings (pet, Island on/off, quiet hours, names); Live Activity poses per state with one free switch at each state end (new build). Cat now defaults to "Mushy". |
| 7 | Much bigger "find apps" catalogue (aim ~1,500-2,000 apps with bundle ids), our own glyphs/monograms. | T189 | part: +79 apps (676 total), every bundle id checked against Apple's public lookup; far short of 1,500-2,000 because lookups only work 2-3 ids per call from the cloud. Continues in later runs; no guessed ids. |
| 8 | Mascot + startup: the cute prism creature (docs/MASCOT.md, T116) as icon direction + mascot, short calm startup animation (no bounce/springs). | T190 | done: new original prism creature (lilac crystal, big eyes, under a rainbow) for icon, splash and mascot; 1.6 s calm intro (wake, float, one blink, shimmer); Reduce Motion = still + fade (new build). The picture he picked never reached the repo, so it was redrawn from his description. |
| 9 | docs/TRIAL.md "New since your last test" yes/no questions for each item, TestFlight wording. The widget screenshot Jared mentioned didn't arrive; item 5 covers it. | T191 | done: docs/TRIAL.md "New since your last test (1 Nov: owner-1101)" |

## Decisions on the brief

- **Item 7, "use StarNet/OpenAI for the bulk list": not followed.** This task's hard rules forbid touching StarNet. The bigger list is built in the cloud instead and checked against Apple's public iTunes lookup data (bundle ids) where it can be reached. Never a brand logo: names are labels, glyphs are generic or monograms.
- **Item 1, research result.** Home Screen web clips (the "Bulk install" profile) can only hold a URL. For a custom app scheme iOS hands the link to Safari, which asks "Open in <app>?". Apple's WebClip payload has no key that launches an app by bundle id (`TargetApplicationBundleIdentifier` only chooses which browser opens a web URL). So the profile method can't open apps without that hop. The prompt-free method is a Home Screen shortcut that runs the Shortcuts **Open App** action (the app is picked by bundle id from the list). That becomes the default. The profile stays as an optional quick method with a plain warning on the install screen, behind `src/config/install.ts`.
- Cost note: hosting the theme packs on GitHub releases is free (no account, no card).

## Addendum 1 Nov 09:18 (items 10-12, run 205)

| # | Ask | Task | State |
|---|---|---|---|
| 10 | Clean up old icons: new theme's icons replace the old Glaze ones (stable profile id; Shortcuts path names the old icons to remove), a "Clean up old icons" screen with exact steps, a tip to hide the original icons in the App Library. | T194 | done (JS): one stable profile identifier per Glaze install, so a new profile replaces the old one (profiles from older builds still need removing once); Shortcuts card lists the old set's icons to remove; Icons > Clean up old icons screen; hide-the-originals tip at the end of every install. Glaze can't delete Home Screen icons itself, and the screen says so. |
| 11 | Repo space at 15.58 of 16 MB: move big art out, never lose work, record it. | T195 | part: measured; history is half the size, so moving art out alone saves nothing (old versions stay in history). Full history archived on the build page (`history/repo-full-2026-11-01.bundle.b64.txt`). Slim bundle script ready and dry-run checked (7.9 MB, identical files). The swap changes commit hashes, so auto-ship's SHIP_BASE must be re-pinned at the same time. It waits on the overseer (Workboard glaze-repo-slim). Plan: docs/REPO_SPACE.md. |
| 12 | Keep growing Find apps toward ~1,500, verified batches every run. | T196 | this run +71 (749 total), each bundle id returned by Apple's AU lookup; continues each run as T197. |

## Owner brief 1 Nov 10:31 Sydney (owner-1101d, after testing the new TestFlight build)

First: the repo slim-down. SHIP_BASE was re-pinned to `19a742e`, and run 207 swapped the slim bundle in (verified: identical files). Pack v2 is live on glaze-packs-v1 (catalog packVersion 2, 49 widget art pieces; the chat rendered all of them and nothing was cropped), so if any art still looks cropped, the problem is in the app.

| # | Ask | Task | State |
|---|---|---|---|
| 1 | Remove pets entirely (Pets tab, Island pets, Live Activity / Dynamic Island). Tabs: Themes · Widgets · Icons · Wallpapers. Park notes in docs/future/pets-game/. | T198 | done: tabs Themes · Widgets · Icons · Wallpapers; pets, Island and Live Activities removed (code, NSSupportsLiveActivities, ActivityKit, strings); parked in docs/future/pets-game/ (new build) |
| 2 | Icon back to the 25 Oct Prism diamond; full-screen calm intro (light beam splitting into the six glaze colours), ≤ 1.5 s. Where is the picked Prism image? (Workboard glaze-prism-image) | T199 | done: 25 Oct Prism gem back as icon/splash; full-screen 1.5 s light-beam intro, dark splash so no flash, Reduce Motion fade; creature art kept in docs/mascot/rejected-prism-creature/ (new build) |
| 3 | Theme page: bold "Set it up"; drop What's inside / Palette / Style; palette shown with the matching widgets. | T200 | done: bold Set it up section header with subtitle; What's inside removed; palette swatches in Matching widgets |
| 4 | Widgets order: practical first, then art, then standard types in the palette; practical missing from theme page fixed; any art at any size; reload after applying; no cropping. | T201 | done: one widgetShelf order (practical → art → standard) on the new theme Widgets screen and the Widgets tab; every piece in every size, fitted; v2 art preferred over pre-cropped v1 strips (likely cause of the cropped fox); bridge reloads all timelines after art/Seamless writes (new build) |
| 5 | Icon install: profile always the main method (Shortcuts only as a fallback link); a new profile must replace the old icons. | T202 | done: Install all at once is the main method, Shortcuts a small fallback link; stable profile + per-app web clip ids (v5 UUIDs from install id + app) so a new theme replaces the old icons; screen says how many apps open via a Safari tap (all, for profile icons: iOS limit) |
| 6 | Widget render check: contact sheets of every option at every size, reviewed each run. | T203 | done: scripts/widget-snapshots.mjs renders all 61 art options of 13 themes at 3 sizes with the app's own placement maths; sheets in docs/widget_snapshots/; nothing cropped. Follow-ups T205-T208 (square art small in medium, fixed numbers in practical art, menu polish, preview vs native blur). macOS SwiftUI renderer plan in docs/widget_snapshots/MACOS_RENDERER.md (needs a CI change by the App Factory chat) |
| 7 | TRIAL.md yes/no questions. | T204 | done: docs/TRIAL.md "New since your last test (1 Nov, late morning: owner-1101d)" |

## owner-1101e (manual fire, 1 Nov 11:06 Sydney)
"Run builds back-to-back today, not just on schedule. Continue the open owner-1101/1101d items and the premium UI pass; review the widget render-check sheets and fix anything off; keep growing Find apps."
Tasks: T209 (widget sheets review + fixes, incl. T206 app side), T210 (premium UI on the owner-1101d screens), T211 (Find apps batch), plus T193 cleanup.

## owner-1101e brief (manual fire, 1 Nov 11:39 Sydney, run 212)
He likes the new full-screen startup animation.

| # | Brief | Task | Status |
|---|---|---|---|
| 1 | The real Prism pick is found (docs/mascot/picked-1025/glaze-prism.jpg): make it the app icon (iOS + Android foreground/monochrome) and use the same figure in the startup animation, same style. Stop redrawing guesses; record in MASCOT.md. | T216 (run 211), T220 | done (uncompiled, needs native build): icon, Android foreground + monochrome, splash and intro all from the picked picture (scripts/brand/picked-icon.py); docs/MASCOT.md |
| 2 | Several different art widgets: each widget instance configurable (iOS 17 AppIntent, long-press > Edit Widget > choose art) from a "My widget art" library (applied pieces from any theme + own photos, each its own App Group file); old single image stays the fallback. | T221 | done (Swift uncompiled, needs native build): Seamless widget is now AppIntentConfiguration with WidgetArtEntity/WidgetArtQuery; widget-art/<id>.jpg + index.json; Use on my widget adds; My widget art list with Remove |
| 3 | Downloaded packs must update when the catalogue packVersion is newer (v1 phones show only 3 pieces). | T222 | done (JS): background re-download into staging + atomic swap; "Update available" card with Update now / Try again |
| 4 | Cloud Atelier's paper boat didn't fit: verify scaledToFit over blurred fill at every size, v2 options reach it, check the sheets. | T223 | done: path verified fit everywhere; fixed the fill path to fit when the real image's shape doesn't match its declared size; findings in docs/WIDGETS.md. Most likely he was on a build from before T201 |
| - | TRIAL.md yes/no for 1-4. | - | done: docs/TRIAL.md "New since your last test (1 Nov, midday: owner-1101e brief)" |

## owner-1101f brief (manual fire, 1 Nov 14:21-14:24 Sydney, run 216)
Jared live; his chat ships this run's result straight away.
1. Crash on TestFlight 1.0.1 (17), iOS 27.0.1, applying the wallpaper from a saved theme: JS exception in a Reanimated gesture worklet. -> T228 (docs/CRASH_1101.md): the photo crop editor's UI-thread maths no longer uses default parameters or module constants (likely ReferenceError under the newer worklets plugin), momentum only runs with finite numbers, every UI-thread gesture/scroll callback is wrapped in try/catch and recovers, the editor shows a still preview if sizes are not usable; guard test src/core/workletGuard.test.ts. Root cause not confirmed on a device.
2. Automatic theming without effort -> T229: canOpenURL check of popular apps (LSApplicationQueriesSchemes via native-plugins/queryschemes.json, production-native only), on launch and after Use this theme; found apps are auto-ticked, unticks stick; Icons-tab note and Settings privacy line. 32 apps for now, not 50: only 32 non-Apple catalogue rows have verified schemes (follow-up T233).
3. Scan accepts App Library list-view screenshots; every match pre-ticked, one tap adds -> T230.
4. Apps with no icon get a themed family glyph per category (keyword rules + App Store search genre when online, cached) -> T231. Privacy page and REVIEW_NOTES updated.
TRIAL.md 'New since your last test (1 Nov, afternoon: owner-1101f brief)' questions 1-4.
