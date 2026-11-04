# Owner brief owner-1102a (2 Nov 2026, 14:07 Sydney)

Jared, in chat: "They are not even reviewing our other apps. May as well just do it all." So the native clocks and more native themed widgets go into Glaze now, before release. His chat ships each run to TestFlight straight away and publishes the packs.

## Part A (run 239): done

| Task | What | Status |
|---|---|---|
| T274 | **More than one pack release.** Catalogue entries may carry `release` (`glaze-packs-v2`, `-v3`, ...; only `^glaze-packs-v\d+$`). That pack's files come from that tag on MerlinWerlin/App-Projects; `catalog.json` stays on `glaze-packs-v1`. Missing = v1. `scripts/packs/releases.json` maps pack → tag; `build_packs.mjs --release <tag>` for new packs; `release_assets.mjs` writes one folder per tag; the publish workflow uploads every tag, v1 and `catalog.json` last. | done |
| T275 | **Clock editions in packs.** `build_packs.mjs` reads Codex's per-theme `widgets/runtime-options-20261101.json` (+ the runtime face PNGs) and `widgets/themed-clock-20261102.json`, puts the themed live clock first and the plain clock as "fallback". New theme kind names (`digitalClock`, `analogClock`, `dateCalendar`, `focusTimer`) map to Glaze's kinds, in the app and in the built manifests (so older builds still read them). | done |
| T286 | `build_packs.mjs --themes <glaze-theme-reviews>` builds Codex's review folders directly (wallpaper from `wallpapers/`, palette from `release-simulation/catalogue.json`, meta from `source-and-prompts.json`). | done |
| T276 | **Every practical piece works.** Clock (analog / digital / 24 h stacked / classic) live; date and countdown now change exactly at midnight (new timeline entry, native); focus 25-min timer with Start/Pause (already worked); battery live level (already worked). Plus 3 UI typing fixes Codex's full typecheck reported (PlusLockSheet, WidgetArtMenu, ThemeSetupArt). | done |
| sync | Codex's draft PR #190 (`codex/glaze-theme-release-20261101`, 0dbee8f) merged: 105 native art-clock editions' code (`ClockArtRenderer.swift`, `setClockArt` / `composeClockArtPiece` bridge methods, `liveFrame` + `clockStyle` + `ink` + `numberFree` metadata, tests). Its 105 CI fixture JPGs (5.8 MB) were left out of this repo to keep the build page under its size limit; they stay on the PR branch (`apps/glaze/docs/themed-clock-fixtures/`). Live values now also show in the Fit layout. | done |

Exact publish command: docs/PACK_HOSTING.md, sections "Clock editions (owner-1102a)" and "More than one release (glaze-packs-v2+)".

Notes:
- Native changes (bridge, widget extension) need the next TestFlight build. Not tested on a device; no Mac compile here (Swift reviewed by eye; Codex's Mac WidgetKit contract run covered PR #190).
- Builds older than this one list a v2-release pack but can't load its thumbnail or download it (calm error, no crash). Publish v2 packs once this build is on the phone.
- The staging release still holds every pack in one release.

## Part B (run 240, tagged owner-1102b): done (T277-T284)

Built: Moon (GlazeMoon, drawn lit disc, % lit, days to full, next 7 nights), Word clock (GlazeWordClock, English; other languages show big digits) and Big clock (GlazeBigClock, StandBy-friendly), Lock Screen: GlazeLockAccessory kept + GlazeLockDate / Battery / Countdown / Moon (circular, rectangular, inline), Clock widget bigger white numerals in StandBy, Next event (GlazeCalendarEvent, EventKit, asks only from glaze://widget-access after you add it), Weather (GlazeWeather, Open-Meteo, location asked the same way, ~2-decimal coordinates only to Open-Meteo, credit shown), Photo frame (theme mat + accent border, date caption, tap opens Widget Studio), Little Line now daily from 64 original lines, Streaks (GlazeHabitStreak, last 7 days, tap to tick). Store text, privacy pages, review notes and licences updated. Not compiled (no Mac) and not device-tested.

Open decisions: Open-Meteo's free API is for non-commercial use and Glaze sells Plus (T288); App Privacy answer for rounded location (docs/RELEASE_CHECKLIST.md 3a).

Original brief:

New native themed widget kinds, each in the theme's colours/art, small/medium/large where sensible: (a) moon phase (computed on-device), (b) word clock + big digital clock, (c) Lock Screen widgets (circular/rectangular/inline: clock, date, battery, countdown, moon) + StandBy-friendly large clock, (d) next calendar event (EventKit; permission only when added), (e) weather via Open-Meteo (free, no key; location only when added; privacy docs), (f) photo frame, (g) daily quote/affirmation (original lines), (h) habit/streak ticks (AppIntent buttons). Update store text, privacy answers and review notes for any permission added. Backlog T277-T284 (T285 = the PR #190 sync).
