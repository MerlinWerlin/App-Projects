# Store screenshot kit

`store/render.mjs` renders `prototype/index.html` in its demo TV state and frames it as App Store and Play Store marketing images (owner-1017 T4, backlog T59).

```sh
node store/render.mjs                    # English set, every size
node store/render.mjs --locale de        # headlines from src/i18n/catalog/de.ts -> store/screenshots/de/
node store/render.mjs --size 1320x2868   # one size only
```

## App Store set (`--ios`)

```sh
node store/render.mjs --ios              # -> store/jpg/ios/ (committed; store/listing.json points at it)
```

Six 1320x2868 JPEGs (APP_IPHONE_67, no alpha) for App Store Connect: the same headlines and order minus the themes fan, using only the four free themes (Couch Plus is not on sale yet), an iPhone-style frame with a Dynamic Island, and no infrared rows (iPhones have no IR blaster).

It needs Playwright and sharp to be installed already (globally is fine) and uses the preinstalled Chromium (`PLAYWRIGHT_BROWSERS_PATH`). It never downloads a browser or installs packages. Web fonts are blocked during rendering, so it falls back to local fonts (Inter where installed).

## Output

Output goes to `store/screenshots/`, which is git-ignored and regenerated on demand.

- `1320x2868/` App Store, iPhone 6.9"
- `1242x2688/` App Store, iPhone 6.5"
- `1080x1920/` Play Store, phone
- `previews/*.jpg` 400 px wide JPEG previews
- `index.html` contact sheet: previews linking to the full PNGs by relative path
- `publish/` every 1320x2868 shot as JPEG (quality 85) plus a small contact sheet (`index.html`); the script stops if the folder passes 2 MB

The order follows the "Store screenshot playbook" in docs/MARKET.md (T69): the outcome, the price promise, then one feature per shot. Each shot takes one accent colour from its theme (the background glow and the seal); everything else is the theme's neutrals.

| # | Headline key | Theme (accent) | Screen (`?view=`) |
|---|---|---|---|
| 01 | `ui.store.headline.everyTv` | Midnight (accent) | live remote |
| 02 | `ui.store.headline.priceFree` | Daylight (accent) | live remote with a "Free" seal (`ui.store.headline.sealFree`) |
| 03 | `ui.store.headline.findTv` | Retro Wood (glow) | Add a TV scan sheet (`add`) |
| 04 | `ui.store.headline.search` | Aurora (accent) | keyboard sheet with a typed search, hold-to-talk behind it (`keyboard`) |
| 05 | `ui.store.headline.apps` | Cinema Red (accent) | app launcher with the original abstract demo tiles (`apps`) |
| 06 | `ui.store.headline.themes` ({count} = 10) | Neon Arcade (accent) centre, plus Brushed Aluminium, Cinema Red, Pastel Candy and Aurora | fan of five remotes |
| 07 | `ui.store.headline.multiTv` | Forest (accent) | TV switcher with the generic demo TVs (`switch`) |

## Headline rules (enforced)

- The headline sits at the same position above the same device frame on every shot.
- `fitHeadline()` shrinks the headline until it is at most `HEADLINE_MAX_LINES` (2) lines, breaking at a sentence boundary when the text has one. A one-line headline grows until it is big enough.
- `assertHeadline()` then measures the rendered headline element: the line count (distinct line boxes) must be 1 or 2, nothing may overflow, and its line box height must be at least `HEADLINE_MIN_FRACTION` (7%) of the shot height. A shot that fails stops the run, in every size and locale.
- No small print, eyebrow text, star ratings or review quotes on any shot.

## How it works

1. The prototype is opened with `?shot=1&theme=<id>&view=<add|numpad|voice|tvs|apps|keyboard|switch>` at 430x932 @3x. In `shot=1` mode the demo chrome (theme picker, "Prototype" note) is hidden and generic demo TVs are used, so no maker or platform names appear.
2. Each marketing image is an HTML page at one third of the target size, rendered at deviceScaleFactor 3. It has a background in the theme's stage colours and the shot's one accent, the headline, and a generic phone frame drawn in CSS with no maker marks.
3. The visible text of every screen, and the composed page, is checked against `store/brand-guard.mjs`. The script stops if a TV maker, platform or streaming service name would appear.

## Rules

- No TV brand names, real TV interfaces or streaming service names or logos in any image. Any TV screen shown must use original abstract art.
- Headlines come only from the i18n catalogue. To change one, add or edit it there, never in this script.
- RTL locales set `dir="rtl"` on the headline only. The prototype UI inside the frame is still English. A localised prototype is follow-up work.
