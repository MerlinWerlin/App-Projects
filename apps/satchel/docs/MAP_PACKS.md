# Offline city map packs (T47, owner-1031 A)

## Owner feedback, 3 November 2026

Jared reports Satchel looks good with no issues found in his phone check. PDF import is still untested because
he had no PDF; a clearly fictional sample booking is supplied by this lane. The next priority is real maps,
because the existing map still shows demo places. This is not confirmation of map download or flight-mode rendering.

The publisher was only a template under `ops/github/`, so GitHub never offered it as an Actions workflow.
It is now also installed at `.github/workflows/satchel-maps-publish.yml`. Branch pushes build real Kyoto,
central Tokyo and Sydney packs as review artifacts, with checks using the phone's actual catalog, tar and POI
parsers, PNG dimensions, complete tile coverage, archive hashes and a downtown preview mosaic per city.
These are build checks; actual iPhone installation and offline drawing still need the test below.

Sample POIs now require **Show sample places**; they are off on every fresh Map screen. Search follows the same
choice. Downloaded POIs automatically follow the visible downloaded city instead of falling back to the first
pack stored on the phone. Bookings and saved places remain available.

### Shipping and publishing

1. Review the branch artifacts and merge the scoped pull request (the existing release approval mechanism).
2. In GitHub Actions, run **satchel-maps-publish** on **main**, leave the tag `satchel-maps-v1` and ratio `2`,
   and enable **Publish verified packs**. This builds and verifies every city before uploading packs and the catalog last.
   Branch runs and dispatches with Publish off only make review artifacts. No hosting account or map key is needed.
3. On TestFlight, update if offered; close and reopen Satchel twice for the JS update. Sample places should be off.
4. Online: Map > Offline city maps > Kyoto > Download > Show on map. Turn on flight mode, close and reopen
   Satchel, then zoom into Kyoto. Check streets and labels, and real toilets/places. Repeat with Sydney if useful.
   Report download time, errors and missing labels. The three packs cover the configured city areas, not whole countries.

Run results are linked in the pull request. No downloaded-city or real-phone success is claimed until evidenced.

### Build repair, 4 November 2026

The second preview built Kyoto (811 tiles, 34.3 MB) and rendered Tokyo, then failed while collecting Tokyo places.
`tools/maps/overpass.mjs` now collects each city's places in four sequential geographic cells, deduplicated by
OSM type and ID. Each query has a 60-second server budget and a 90-second client timeout, including its response
body. Transient failures retry up to three times with a cooldown; HTTP 429 honors `Retry-After`. A runtime
`remark`, malformed response or failed cell rejects the city instead of packaging partial results.
The build artifact includes per-city `*-poi-source.json` request bounds, counts and OSM base timestamps.
Six offline collector checks cover coverage/deduplication, retry behavior, partial results, malformed responses
and stalled bodies. This follows the [Overpass resource and rate-limit guidance](https://dev.overpass-api.de/overpass-doc/en/preface/commons.html).

**Third preview passed:** [Actions run 41722754832](https://github.com/MerlinWerlin/App-Projects/actions/runs/41722754832),
source `1076eb9`, passed all 1,850 app tests, six collector checks and the all-city pack verifier.
All 12 source requests succeeded on their first attempt. Downloaded archives independently match their catalog
hashes and sizes; all 2,177 PNG structures and metadata/POI counts passed local checks. The three downtown
mosaics were visually reviewed: roads, water, parks and labels present, with no obvious blank tile or alignment gap
in those samples. The strict UI stub typecheck also passed; this is not a full Expo/native build or iPhone test.

| City | Download size (decimal MB) | Tiles | Places, including toilets |
| --- | ---: | ---: | ---: |
| Kyoto | 34.3 | 811 | 5,411 |
| Tokyo (central) | 56.6 | 985 | 20,019 |
| Sydney (city) | 16.4 | 381 | 4,075 |

The run artifact `satchel-city-maps-41722754832` contains the packs, catalog, request receipts, previews and
`verification.json`. It is retained for 14 days; the owner checkout also retains the downloaded artifact and
local validation under `output/map-build-attempt-3`. These are the earlier preview packs; the published release
and public-download checks are recorded below. The iPhone flight-mode check remains outstanding.

### Live release, 4 November 2026

[PR201](https://github.com/MerlinWerlin/App-Projects/pull/201) is merged as `64bbc92`.
[Production ship 41782740556](https://github.com/MerlinWerlin/App-Projects/actions/runs/41782740556)
installed dependencies, exported the full iOS JS bundle and published to channel `production`, runtime `0.1.0`.
Update group: `9034d409-f5e6-45e0-85e3-709bebbc6dfd`. Installed-phone uptake has not been verified.

[Map publication 41782742602](https://github.com/MerlinWerlin/App-Projects/actions/runs/41782742602)
passed all 1,850 app tests, six collector checks and the all-city pack verifier, then published
[`satchel-maps-v1`](https://github.com/MerlinWerlin/App-Projects/releases/tag/satchel-maps-v1).
The production [catalog URL](https://github.com/MerlinWerlin/App-Projects/releases/download/satchel-maps-v1/catalog.json)
and all three pack URLs were downloaded without authentication and checked independently. Catalog and archive
bytes match the verified CI artifact; archive metadata, place counts and all 2,177 tile dimensions match.
The three release mosaics were visually reviewed again. One Kyoto cell recovered from capacity errors on its
third attempt with the configured cooldown; no partial data was packaged.

| Published city | Download size (decimal MB) | Tiles | Places, including toilets |
| --- | ---: | ---: | ---: |
| Kyoto | 34.3 | 811 | 5,412 |
| Tokyo (central) | 56.6 | 985 | 20,021 |
| Sydney (city) | 16.5 | 381 | 4,082 |

These are the live counts; the preceding table describes the earlier preview snapshot. Source data and map packs
are retained in `satchel-city-maps-41782742602` (14-day CI retention). The owner checkout retains the artifact,
public downloads, logs and comparison receipts under `output/map-publish-20261104-artifact` and
`output/satchel-maps-live-20261104`, with receipts alongside them.

**Next phone check:** open Satchel online, let it fetch the update, then close and reopen it. Map > Offline city maps >
Sydney > Download > Show on map is the smallest initial test (about 16.5 MB). Enable flight mode, close and reopen
Satchel, and check streets, labels and real places inside the city area. A desktop pack check does not establish
native installation, rendering, restart behavior or actual flight-mode success.

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
