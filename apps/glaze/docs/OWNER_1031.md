# Owner brief 31 Oct 2026, 09:00 Sydney (tag `owner-1031`)

Jared on TestFlight build 13: "it has all of the old themes which need to go ... none of the new themes from GitHub which need to be downloaded, no upgrade to user interface". Outranks the backlog.

Facts from the chat (verified by run 189 with curl: catalog.json on release `glaze-packs-v1` returns 200, parses with `parseCatalogText`, 10 packs, manifests reachable as flat assets `art__<id>__v1__manifest.json`): the first 10 Codex themes are live as free remote art packs: alpine-starlight, desert-afterglow, rainlight, firefly-grove (Jared's favourite), cloud-atelier, opal-abyss, rosewater-reverie, indigo-current, moonpatch, meadowglow. Codex made wallpaper + square widget art only, no per-app icon PNGs, so icons for these themes come from Glaze's glyph/monogram system in the theme palette.

Note on "no upgrade to user interface": the premium UI work of runs 182-188 is JavaScript and reaches the phone as over-the-air updates on top of the TestFlight build; Glaze must be fully closed and reopened (twice) to pick up an update.

## Do now
1. **New collection is the centrepiece** of the Themes tab (T177): a top section listing every catalogue theme with its thumb/thumbhash, opening the theme page with a clear Download button and progress; after download Apply works (wallpaper, widget art, icons in the palette). Force a catalogue refresh on first launch of a new app version (not waiting for the 6 h cache) and on pull-to-refresh (T178). A 404 or offline never shows an error.
2. **Remove the old themes from the gallery** (T177): the procedural / older built-in sets (themesNew, themesStoryPlay and similar older lists, the old starter showcase, Space, the Plus packs). The gallery keeps the remote collection plus 3 bundled starters: the bundled art packs Deep Sea, Starry Night and Sunset Dunes. Themes a person already applied keep working (lookups by id are unchanged; only the gallery listing changes).
3. **Premium UI pass** continues on the Themes tab and theme page: art-led large cards (T177, T179).
4. **TRIAL.md** "New since your last test" yes/no questions for 1-3 (T180), TestFlight wording only.

The gallery stays data-driven from the catalogue: later Codex batches (same pipeline, new release assets) need no app change.

## Status (run 189)
- T177 done (1ca17b4): Themes tab = New collection (catalogue, art-led cards, thumbhash placeholders, skeletons while empty) + 3 starters; old lists out of the gallery, ids still resolve; pull to refresh (iOS overscroll allowed only at the very top for the refresh control: a one-file exception to the no-bounce rule, TRIAL question).
- T178 done (ad464d8): forced catalogue fetch when the app version / build / OTA update id changes; empty or failed fetch retried after 2 min instead of 6 h; foreground re-check; real-fixture tests.
- T179 done (0e6af11): remote theme page with art hero, one Download pill with size and progress, calm try-again copy, Apply end to end; remote ids now resolve in Widget Studio, the wallpaper maker, Your look and the Icons tab (src/native/useAnyTheme.ts).
- T180 done: TRIAL.md "31 Oct, morning: owner-1031". JS only: reaches TestFlight as an over-the-air update via auto-ship. Nothing device-tested.

## Consequence to decide later
All 10 remote packs are free (`plus: false`) and the Plus packs leave the gallery, so Glaze Plus has no gallery themes of its own until a later batch marks some packs `plus: true`. Workboard need `glaze-plus-content`.

## Run 189 findings (T178)

Why the 10 GitHub themes may not have shown on TestFlight build 13, checked against the code and the live release:

- **Live release is fine.** `catalog.json` on `glaze-packs-v1` 302-redirects to `release-assets.githubusercontent.com` and returns 200, 7,700 bytes (limit 2 MB); Range requests answer 206; manifests are flat assets (`art__alpine-starlight__v1__manifest.json`). The real copies in `src/core/fixtures/` now have tests: the catalogue parses to 10 free packs, all 10 become gallery themes with flat thumbnail URLs, no bundled id shadows them, and the alpine-starlight manifest parses (`minAppVersion` 1.0.0 is within app 1.0.1).
- **Config is fine at HEAD.** `app.json` has no `extra.packEnv`, so the build resolves to production (`glaze-packs-v1`) and `PACKS_ENABLED` is true. App fetch follows redirects; T178 also rejects a redirect off HTTPS (hosts are not pinned, every file is SHA-256 checked).
- **Most likely cause 1: the phone's JS predates hosting.** Until T169 (30 Oct, 11:34 UTC) the pack base URLs were empty, so packs were switched off and no request was ever made. If build 13's bundle (or the last over-the-air update it loaded) came before T169, it cannot show remote themes until the newer update is picked up (Glaze fully closed and reopened twice, same runtime version 1.0.1, production channel).
- **Most likely cause 2: timing plus no retry.** The release catalogue was generated 30 Oct 21:48 UTC, minutes before the brief. Before T178 the catalogue was checked only when the Themes tab first mounted. A 404 (release not there yet) or a moment offline at that point was never retried while the app stayed in memory. A 404 was not cached, so a cold relaunch would have fetched it.
- **Placement.** Remote themes were merged into the art-pack section of the All page only, below the older sets, so they were easy to miss (T177 makes them the top section).
- **Build number note.** EAS uses `appVersionSource: remote`, so `ios.buildNumber` in the app config stays "1" and does not identify a TestFlight build. The cache stamp therefore also includes the running expo-updates `updateId`, which changes with every build and every OTA, plus `CATALOG_CLIENT_REV`.

Fixes in T178:
- The cached catalogue is stamped with `catalogCacheStamp` (catalogue code revision, app version, build, `updateId`, pack base URL). A different stamp refetches on first launch.
- An empty cached catalogue, or a session whose attempt failed (404, offline, garbage), retries on the next launch or foreground after `CATALOG_RETRY_MS` (2 min) instead of waiting 6 h. Failures are never cached, and the last good copy is kept.
- Pull to refresh (`refreshRemoteCatalog`) always fetches, with no backoff.
- No error ever reaches the UI.
- `getPackState().catalogStatus` and `useRemoteCatalogStatus()` report `loading` / `ready` / `empty` / `unavailable` / `disabled`, so the Themes tab can show skeletons on first load. `useRemoteCatalogRefreshing()` is for a pull spinner.
