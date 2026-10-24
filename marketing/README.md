# App marketing kit

One setup for every App Factory app. An app joins by getting an entry in `apps.json`; everything below then works for it.

| Part | Where | What it does |
|---|---|---|
| Registry | `marketing/apps.json` | Stage, store name, links, colours, boards, lead points, claims to avoid, FAQ, Reddit searches |
| Launch page | `marketing/site/build.py` → `docs/<slug>/` | Product page with screenshots, comparison, FAQ, structured data (MobileApplication + FAQPage), privacy and support pages. GitHub Pages serves `docs/` at https://merlinwerlin.github.io/App-Projects/ |
| Store listing | `apps/<slug>/store/listing.json` + `scripts/asc/asc.py` + `.github/workflows/store.yml` | Pushes name, subtitle, description, keywords, promo text, categories, URLs and in-app purchases to App Store Connect. Change `apps/<slug>/store/ASC_REQUEST.json` to `{"mode":"status"}` or `{"mode":"apply"}` and commit; the report appears as a comment on that commit. Never submits for review |
| Pins | `marketing/pins/render_pins.py` + `<slug>-*.json` plans | 1000×1500 Pinterest pins: `single`/`grid` from an app's own SVG art, `shot` from a store screenshot. Branded footer only when `nameLocked` |
| Hub | claude.ai artifact "App launch room" (https://claude.ai/artifact/9dXFwsufnoapNGmrFe86A4) | Per-app pin queue, Reddit threads with draft replies, comparison, launch checklist. Its database: `apps`, `pins`, `threads`, `checks` (every doc carries `app`) |
| Weekly run | Claude scheduled task "App launch marketing weekly" (Sundays 19:37 Sydney, needs the PC) | For every app at prelaunch/launching/live: Reddit scan in the Claude app's browser, draft replies, pin top-up |

## Stages
1. **building**: nothing public.
2. **prelaunch**: idea pins from the app's own art (no app name until `nameLocked`), Reddit watch, comparison written.
3. **launching**: name locked, store listing synced, launch page live, launch pins held, TestFlight public link, review submitted.
4. **live**: store link set in `apps.json` (`appStoreUrl`) → rebuild the page, add the link to every pin, post held launch pins, launch-week posts (r/iOSapps App Shelf, r/AppHookup, r/SideProject, Product Hunt, AlternativeTo).

## Adding the next app (about an hour of Claude time)
1. Add its entry to `apps.json` (copy Linework's; fill lead, compare, faq, keywords, reddit, avoid from its `docs/MARKET.md`).
2. Write `apps/<slug>/store/listing.json` from its `docs/STORE.md`.
3. Add an `apps/<slug>` doc and checklist docs in the hub (copy Linework's checklist).
4. Make a first pin plan `marketing/pins/<slug>-month1.json`, render, publish the JPEGs to the hub at `pins/<id>.jpg`, add the pin docs.
5. Set `stage` to `prelaunch`. The weekly run picks it up.

## Rules that hold for every app
- Posting to Pinterest or Reddit happens only live in chat with Jared's OK; the weekly run drafts, never posts.
- Reddit: answer the question first; after launch disclose "I made this" once; never the same text twice; respect each subreddit's promo rules (see the hub's Reddit tab).
- No competitor or franchise names in pins or store keywords. No "only", "never" or "best" claims the app can't prove.
- Pinterest pace for a young account: about 5 pins a week; one business account for all apps, boards per app.
