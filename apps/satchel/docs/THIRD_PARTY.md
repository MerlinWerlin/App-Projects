# Third-party data, fonts, libraries and content

What Satchel ships that it did not write, the licence, and what the licence asks of us. Update this file whenever a dependency, data source or content file is added (ops/CONVENTIONS.md). Licences below are from the maintainers' published licences as known on 24 Oct 2026; anything marked **licence to confirm** must be checked against the installed package's `LICENSE` file on the PC (`node_modules/<pkg>/LICENSE`) before release, because the cloud build runs cannot install packages.

## 1. OpenStreetMap data (ODbL 1.0)

**Status (31 Oct 2026, T47/T49):** the app downloads offline city map packs (raster tiles rendered from Protomaps' OpenStreetMap build plus an OSM POI extract) from App-Projects release assets, and the Toilets tab queries the public Overpass API when online. "© OpenStreetMap contributors" shows on the map whenever offline tiles are drawn, in the offline maps section and in the Toilets tab. T59: the Emergency tab's Nearest help screen (hospitals, clinics, pharmacies, police) reads the same packs and the same Overpass API, with the same attribution. Build and licence details: docs/MAP_PACKS.md. The bundled demo points in `src/content/demo_pois_*.json` are still invented sample points (T09).

**From the NATIVE milestone (T12 offline map, T13 offline POIs)**, Satchel will ship city map extracts cut from Protomaps' OpenStreetMap builds and per-city POI extracts. Obligations (OSMF attribution guideline and the ODbL; see docs/research/MAP_SPIKE.md §3):

- **Attribution:** show "© OpenStreetMap contributors" legibly on the map (a map corner) wherever OSM map or POI data is visible, with a link or tap-through to https://www.openstreetmap.org/copyright stating the data is available under the Open Database Licence. It may collapse after interaction or about 5 seconds only if it stays findable (an info button).
- **Also show it in:** Settings > About > Data licences (an in-app licences screen), the city download screen, the offline-map pack metadata, and this file. T72: done for Settings > About (the credit line) and Settings > Licences and credits (`app/licences.tsx`, rows in `src/core/licences.ts`, which a test checks against this file and package.json). The store description should mention "Map data © OpenStreetMap contributors" once offline maps ship.
- **Rendered map tiles** (Protomaps basemap) are an ODbL *Produced Work*: attribution required; share-alike does not apply to the images themselves.
- **Share-alike for derived databases:** if Satchel publishes or distributes a database derived from OSM (for example our own POI files filtered and reshaped from OSM, or the hosted city extracts), that derived database must be offered under the ODbL (or a compatible licence), and we must state how to get it. Plan: publish the extract scripts and the derived POI files (or a way to reproduce them) in the repo, under ODbL, alongside the downloads. Whether each POI file is a derivative database is **to verify** before T13 ships (MAP_SPIKE.md §6).
- **No mixing** OSM-derived data with data under incompatible terms (for example data scraped from a commercial map service) in the same database.
- **Protomaps basemap tooling:** described as BSD (code) + ODbL (data); **licence to confirm** for any Protomaps style or font assets bundled with the renderer.
- **MapLibre Native** (renderer, T12): BSD-2-Clause, **licence to confirm** for the exact package and its bundled dependencies.

## 1b. Weather forecast: MET Norway (CC BY 4.0)

**Status (31 Oct 2026, T70):** the trip screen's "Weather & daylight" card fetches a forecast for the trip's current or next destination from the Norwegian Meteorological Institute's Locationforecast 2.0 API (`https://api.met.no/weatherapi/locationforecast/2.0/compact`), only when the phone may be online and only for a trip within about nine days. Free, no key, commercial use allowed under MET's terms of service (api.met.no/doc/TermsOfService). The data is licensed **CC BY 4.0** (and NLOD 2.0) by MET Norway.

- **Attribution:** "Weather data: MET Norway" shows on the card wherever forecast numbers show. T72: Settings > About also carries "Weather data: MET Norway (the Norwegian Meteorological Institute), licensed under CC BY 4.0", and Settings > Licences and credits lists it with a link to api.met.no/doc/License. The store description should carry it too.
- **Terms we follow:** an identifying `User-Agent` (`Satchel/<app version> github.com/MerlinWerlin/App-Projects`), coordinates rounded to four decimals, the `Expires` header respected (no request before it), `If-Modified-Since` sent with the cached `Last-Modified`, and the last forecast cached per place on the phone (AsyncStorage) so it shows offline. Only the place's rounded coordinates leave the phone; no trip details, no identifiers.
- **Icons:** the eight weather groups are drawn with Ionicons glyphs (`@expo/vector-icons`, MIT), not MET's own weather symbols.
- **Unverified online:** the cloud build box cannot reach api.met.no; the parser is written from MET's documented schema and tested on a fixture written to that schema (`src/core/fixtures/metno_compact_tokyo.json`, invented values, not MET data).

Sunrise, sunset and civil twilight are computed on the phone (`src/core/sun.ts`, the public-domain NOAA solar position equations); no data source is involved.

## 2. Fonts (SIL Open Font License 1.1)

| Font | Weights used | Source | Licence |
|---|---|---|---|
| Inter | 400 Regular, 600 SemiBold | `@expo-google-fonts/inter` (font files from Google Fonts) | SIL OFL 1.1 |
| Space Grotesk | 500 Medium, 700 Bold | `@expo-google-fonts/space-grotesk` (font files from Google Fonts) | SIL OFL 1.1 |
| Ionicons (icon font) | as used in `app/` and `src/ui/` | `@expo/vector-icons` | MIT |

OFL obligations: the fonts are bundled inside the app (allowed); don't sell the font files on their own; keep the copyright and licence notice with any redistributed font files; a modified font may not use the reserved font name. Fonts are bundled, never downloaded at run time. The `@expo-google-fonts/*` wrapper code is MIT. The release build should include the OFL text in the in-app licences screen.

## 3. App libraries (shipped in the app)

From `package.json` `dependencies`. All are open source; none is an analytics, advertising or tracking SDK.

| Package | Licence |
|---|---|
| expo, expo-router, expo-asset, expo-battery, expo-brightness, expo-clipboard, expo-constants, expo-contacts, expo-document-picker, expo-file-system, expo-font, expo-haptics, expo-image-picker, expo-keep-awake, expo-linking, expo-local-authentication, expo-localization, expo-location, expo-network, expo-sharing, expo-splash-screen, expo-status-bar, expo-updates | MIT (Expo) |
| @expo/vector-icons | MIT (only the Ionicons set is used: MIT) |
| @expo-google-fonts/inter, @expo-google-fonts/space-grotesk | MIT (code); fonts SIL OFL 1.1 (§2) |
| react, react-dom | MIT |
| react-native | MIT |
| react-native-maps | MIT |
| react-native-safe-area-context | MIT |
| react-native-screens | MIT |
| react-native-svg | MIT |
| @react-native-async-storage/async-storage | MIT |
| @react-native-community/datetimepicker | MIT |

Transitive dependencies (Babel, Metro runtime pieces, Hermes and so on) are mostly MIT, BSD or Apache-2.0: **licence to confirm** with a licence report on the PC before release (for example `npx license-checker --production --summary`), and add anything that is not MIT/BSD/Apache/ISC to this table.

MIT, BSD and Apache-2.0 ask us to keep their copyright and licence notices with copies of the software: include an in-app "Open-source licences" list (Settings > About) generated from the installed packages. T72: Settings > Licences and credits lists every package above with its licence (hand-kept, tested against package.json); the full licence texts and copyright lines, generated from `node_modules/*/LICENSE` on the PC, and the OFL text for the fonts are still to add before release.

**Platform services the app calls (not bundled data):** the map in this version is the system map (Apple Maps on iPhone; on Android react-native-maps uses Google Maps, which needs a Maps SDK key and is governed by Google's terms: **to confirm before an Android release**). expo-updates contacts Expo's update service to fetch over-the-air updates. Neither receives the user's trips.

## 4. Development-only tools (not shipped)

| Package | Licence |
|---|---|
| typescript | Apache-2.0 |
| @types/node, @types/react | MIT |
| @expo/ngrok | **licence to confirm** (fork of the `ngrok` npm wrapper, believed BSD-2-Clause); used only for `npm run tunnel` |
| Playwright / Chromium used by `scripts/render-icons.mjs` | Apache-2.0 / BSD; not a package.json dependency, not shipped |

## 5. Original art

The app icon, splash glyphs and adaptive icon are original vector art (`assets/brand/icon.svg`, T18), rasterised by `scripts/render-icons.mjs`. No logos, brand marks or third-party art. Future generated art follows docs/art/ART_PROMPTS.md and keeps its prompt in `meta.json`.

## 6. Bundled content: provenance (all unverified)

These files were drafted by the StarNet OpenAI lane and imported by the build runs (ops/DECISIONS.md). They are Satchel's own content, not third-party licensed data, but **none has been independently verified**, and the app says so where it matters.

| File | Origin | Status |
|---|---|---|
| `src/content/emergency_numbers.json` (244 countries) | OpenAI lane drop, 24 Oct 2026 (four regional files merged); GUARD review added `guard_flags` to 66 doubted fields in 39 countries | Unverified. Only 28 rows have a source URL (the EU 112 page) and none has a checked date. The app shows every row as "verify locally · source pending" until T25 adds official sources and dates. Spot-checked 20 well-known countries: all matched. Originals in docs/research/guard/. |
| `src/content/packing_templates.json` (11 templates x 20 items) | OpenAI lane drop, 24 Oct 2026 | Unverified suggestions; generic items, no brands. |
| `src/content/osm_poi_tags.json` (14 categories) | OpenAI lane drop, 24 Oct 2026 | Unverified mapping to OpenStreetMap tag names; checked to cover every PLAN category (content.test.ts). |
| `src/content/demo_pois_tokyo.json`, `demo_pois_kyoto.json` | Build run 3 (T09) | Invented sample points, labelled "sample data, not real places" in the files and the UI. Not OpenStreetMap data. |
| `src/core/demo.ts` (demo trip) | Build run 1 | Invented names and references; no real carrier or hotel brands. Real public place names (airports, stations, districts) are used only as locations. |
| docs/spec/* (flows, copy, store draft, translations) | OpenAI lane spec pack | Reference only; checked and adapted by the build runs. |
| `src/core/countrycurrency.ts` (country -> currency, 249 rows) | Build run 94 (T96), compiled 31 Oct 2026 from the ISO 4217 List One code list (SIX Group, ISO 4217 maintenance agency), including amendments in force by that date (HR EUR 2023, SL SLE, ZW ZWG 2024, CW/SX XCG 2025, BG EUR 2026) | Factual codes, not licensed content. Written from the published list as known to the build run; the list was not re-downloaded (no network in the run), so re-check against the current List One when ISO publishes an amendment. Fund and metal codes left out; PS and GS have no universal currency in ISO 4217; XK (Kosovo, EUR) is not in the ISO list. Shown on the arrival card as general guidance, verify locally. A test covers every country in emergency_numbers.json. |
