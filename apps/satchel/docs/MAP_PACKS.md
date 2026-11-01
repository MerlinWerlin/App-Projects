# Offline city map packs (T47, owner-1031 A)

**What the app does.** Map tab > Offline city maps lists the cities in
`https://github.com/MerlinWerlin/App-Projects/releases/download/satchel-maps-v1/catalog.json`.
Download fetches `<city>.tar`, unpacks it into the app's documents folder (`maps/<id>/meta.json`, `pois.json`,
`tiles/{z}/{x}/{y}.png`, then `.complete`), and the map draws those tiles with react-native-maps `LocalTile` on top of
the phone's own map. With no connection the phone's map is blank but the downloaded tiles still draw, so the city
works in flight mode. The Toilets tab reads `pois.json` for offline toilets and asks the Overpass API when online; Nearest help reads its
hospitals/clinics, pharmacies and police.
No new native module was needed: LocalTile is in react-native-maps, already in the TestFlight binary.

**How packs are made.** `tools/maps/build.mjs`, run by the GitHub Actions workflow `ops/github/satchel-maps-publish.yml`
(installed at App-Projects `.github/workflows/`): pmtiles extract of the city bbox from the latest Protomaps OSM
build → MapLibre Native renders 256-pt PNG tiles (@2x) with the Protomaps basemap style → Overpass API for toilets and
POIs (toilets, the map categories and police, with phone / opening_hours for the help places) → ustar tar. Packs are uploaded first, `catalog.json` last. Cities: `tools/maps/cities.json` (Kyoto, central
Tokyo, Sydney city; z10-16). Hosting is free GitHub release assets (no accounts, no card, no secrets beyond the
workflow's own GITHUB_TOKEN).

**Licences.** Map data © OpenStreetMap contributors, ODbL 1.0 (attribution shown on the map and in the Toilets tab;
rendered tiles are a Produced Work; the POI extract in pois.json is a derivative database offered under the ODbL, and
the build script that makes it is public in this repo). Protomaps daily builds: ODbL data; Protomaps basemaps style
and fonts/sprites: BSD-3 / OFL. Overpass API: public instance, used once per pack build and lightly from the phone.

**Contract.** Pack format and on-device layout: `src/core/citymaps.ts` (validation, allowed entries) and
`src/core/tar.ts`. Changing the release tag means changing `MAPS_RELEASE` in `src/core/citymaps.ts` too.

**Verified contract (T153, run 109).** `src/core/mapcontract.test.ts` (part of `npm test`) reads `tools/maps/cities.json`,
the text of `tools/maps/build.mjs` and of `ops/github/satchel-maps-publish.yml`, imports `tools/maps/pois.mjs`, and
checks the app agrees. It also builds a small Kyoto pack with the exact GNU tar flags build.mjs uses and walks it the
way the phone unpacks it (plus the same pack from the in-repo tar writer, for machines without `tar`).

| Item | Pipeline (tools/maps) | App |
| --- | --- | --- |
| Release / repo | `cities.json` `release: satchel-maps-v1`; workflow default tag `satchel-maps-v1`, run in MerlinWerlin/App-Projects | `MAPS_RELEASE` |
| Catalog URL | workflow verifies `https://github.com/$R/releases/download/$TAG/catalog.json` | `CATALOG_URL` = `https://github.com/MerlinWerlin/App-Projects/releases/download/satchel-maps-v1/catalog.json`; HTTP 404 = "City maps are being published" |
| Asset names | `catalog.json` + one `<id>.tar` per city (kyoto.tar, tokyo.tar, sydney.tar); packs uploaded first, catalog last | `packUrl` = base URL + entry `file` (plain `[a-z0-9._-]+.tar` name only) |
| catalog.json | `{ version: 1, release, built, attribution, cities: [meta + bytes + sha256] }` | `parseCatalog` (version must be 1; bad cities dropped) |
| catalog entry | `id, format (2), name, country, bbox [w,s,e,n], center [lon,lat], minzoom 10, maxzoom 16, file, tiles, pois, attribution, built, bytes` (tar size), `sha256` (tar hash, hex) | `parseCity` (bytes 1 B-4 GB required; sha256 kept but not checked on the phone) |
| meta.json (in the tar) | the same keys **without `bytes` and `sha256`** (they describe the tar itself) | `parsePackMeta(meta, catalogEntry)` takes bytes/sha256 from the entry, refuses a pack for another id, and the phone saves the merged meta.json back before `.complete`, so `listInstalled` (`parseCity`) reads it later offline |
| tar layout | uncompressed ustar (`--format=ustar --owner=0 --group=0 --numeric-owner --no-recursion`), regular files only, in order `meta.json`, `pois.json`, then sorted `tiles/{z}/{x}/{y}.png` | `parseTarHeader` + `packEntryPath`: keeps only those three kinds of path (z 0-20, x/y inside the grid), skips anything else |
| Tiles | XYZ (y from the north, OSM scheme), 256-pt PNG rendered @2x (512 px), z10-16, count = `tiles` | LocalTile `tileSize={256}`, `tilePathTemplate` `…/maps/<id>/tiles/{z}/{x}/{y}.png`; `tileCountEstimate` gives the same count (Kyoto 811, Tokyo 985, Sydney 381) |
| pois.json | `toPois` (format 2) | `parsePackToilets` (Toilets), `parsePackHelp` (Nearest help), Map search |

**Mismatch found and fixed (T153).** build.mjs never wrote `bytes` into meta.json (it can't: it is the size of the tar
the meta sits in), but the phone validated the unpacked meta.json with `parseCity`, which requires `bytes`. So every
real download would have unpacked and then failed as "bad pack". The fix is app-side only (JS, over-the-air):
`parsePackMeta` plus saving the merged meta.json. No pack needs rebuilding.

**Until `satchel-maps-v1` exists** (D211-2: the workflow has to be installed in App-Projects and run by the owner /
App Factory) the catalog URL answers 404 and Map tab > Offline city maps honestly says "City maps are being
published — check again soon." That stays as is; nothing in the app fakes a list.

**Pack format (T62/T67).** `pois.json`, `meta.json` and each catalog entry carry `format`
(`POIS_FORMAT` in `tools/maps/pois.mjs`, `PACK_FORMAT` in `src/core/citymaps.ts`). The Overpass query and the
pois.json shaping live in `tools/maps/pois.mjs` (pure, no npm dependency) and are fixture-tested by `npm test`
(`src/core/t67.test.ts`).

| format | pois.json `places[]` |
| --- | --- |
| 1 (no `format` field, first packs) | `{ id, lat, lon, category, name? }`, category one of drinking_water, fuel, pharmacy, hospital_clinic, atm_bank, transport. No police, no phone, no hours. |
| 2 | adds category `police` (amenity=police); on every hospital_clinic, pharmacy and police place also `amenity` (hospital / clinic / pharmacy / police), `phone` (OSM phone or contact:phone, as tagged), `opening_hours` and, on hospitals, `emergency`. Help places tagged access=private/no are left out. |

T13 (still format 2, additive; no catalog or tar change): `places[].category` may also be `food` (restaurant, cafe,
fast_food), `supermarket` (shop=supermarket) and `embassy` (amenity=embassy or office=diplomatic). The Map tab's
offline place layer (`src/core/packpois.ts`, read from `maps/<id>/pois.json` by `src/native/packPois.ts`) shows
toilets plus these place categories with a toggle each (all on at first open, kept on the phone) and the line
"Places © OpenStreetMap contributors (ODbL)". Older app builds skip categories they do not know. Limits in the app:
pois.json over 12 M characters is not read; at most 60,000 points per city; the map draws the nearest 150, the
Nearby list the nearest 200.

T156 (still format 2, additive): `places[].category` may also be `lift` (highway=elevator), and every place carries
the OSM `wheelchair` tag (yes / limited / no / designated) when it has one. The app shows it as yes / limited / no on
Map place cards, pins and Nearby rows with the ODbL line (`src/core/stepfree.ts`); older builds ignore both.

`toilets[]` is unchanged. Nearest help (`src/core/help.ts`, Emergency > Find help) reads both formats: on a format 2
pack it works fully offline (police, tap-to-call, hours, emergency-department chip); on a format 1 pack it keeps the
honest note that police, numbers and hours need a connection. The catalog stays `version: 1` (a bump would hide every
city from older app builds, which reject other versions); older builds ignore the new fields and the police rows.

**Not yet verified on a phone** (owner checks in TestFlight): download + unpack time for a ~40 MB city, LocalTile
drawing in flight mode, dark mode look (tiles are the light style).
