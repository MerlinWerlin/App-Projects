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

**Pack format (T62/T67).** `pois.json`, `meta.json` and each catalog entry carry `format`
(`POIS_FORMAT` in `tools/maps/pois.mjs`, `PACK_FORMAT` in `src/core/citymaps.ts`). The Overpass query and the
pois.json shaping live in `tools/maps/pois.mjs` (pure, no npm dependency) and are fixture-tested by `npm test`
(`src/core/t67.test.ts`).

| format | pois.json `places[]` |
| --- | --- |
| 1 (no `format` field, first packs) | `{ id, lat, lon, category, name? }`, category one of drinking_water, fuel, pharmacy, hospital_clinic, atm_bank, transport. No police, no phone, no hours. |
| 2 | adds category `police` (amenity=police); on every hospital_clinic, pharmacy and police place also `amenity` (hospital / clinic / pharmacy / police), `phone` (OSM phone or contact:phone, as tagged), `opening_hours` and, on hospitals, `emergency`. Help places tagged access=private/no are left out. |

`toilets[]` is unchanged. Nearest help (`src/core/help.ts`, Emergency > Find help) reads both formats: on a format 2
pack it works fully offline (police, tap-to-call, hours, emergency-department chip); on a format 1 pack it keeps the
honest note that police, numbers and hours need a connection. The catalog stays `version: 1` (a bump would hide every
city from older app builds, which reject other versions); older builds ignore the new fields and the police rows.

**Not yet verified on a phone** (owner checks in TestFlight): download + unpack time for a ~40 MB city, LocalTile
drawing in flight mode, dark mode look (tiles are the light style).
