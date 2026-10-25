# MAP_SPIKE.md

## Purpose

Evaluate a per-city offline map pipeline for Satchel. This is a design spike, not a commitment to a provider, account, or implementation.

## 1. Per-city PMTiles extracts

- Start from Protomaps daily v4 basemap builds at `maps.protomaps.com/builds`.
- Copy source data to Satchel-controlled storage rather than hotlinking: the daily-builds bucket retains the past week plus the latest of each patch version, and its URLs may change. Hotlinking is discouraged.
- Create city files with `pmtiles extract` and a bounding box.
- Aim for **10–60 MB per city**. This is a planning target, not a guaranteed file size.
- Choose `--maxzoom` per city. Lowering it reduces file size; each additional zoom level roughly doubles size. Test representative cities and zoom levels before fixing defaults.
- Protomaps publishes BLAKE3 hashes. Verify downloads with `b3sum` where a matching published hash is available. **To verify:** whether published hashes cover the exact extracted files we intend to host.

**Sources:** [Protomaps basemap downloads](https://docs.protomaps.com/basemaps/downloads)

## 2. iOS rendering and app boundary

- Render offline PMTiles with MapLibre Native on iOS, behind a Satchel map adapter. Keep app screens and map-data access decoupled from the rendering implementation.
- In Expo Go, retain the existing online system map; offline PMTiles rendering requires a native implementation outside that path.
- **To verify:** MapLibre Native integration with the chosen Expo development/build setup, PMTiles support, licensing notices for all rendering dependencies, and behaviour across supported iOS versions.
- **To verify:** the adapter interface, including map style, camera, offline/online state, and tap handling.

## 3. ODbL and attribution

- The Protomaps basemap PMTiles daily builds are described as an ODbL **Produced Work**. OpenStreetMap attribution is required.
- The basemap generation code is open source under BSD + ODbL, as stated in its documentation footer.
- Show legible attribution near the map, such as in a map corner, or on a startup splash/pop-up. Suitable wording includes “Map data from OpenStreetMap” or “© OpenStreetMap contributors”; make clear the data is under the ODbL and provide a link to `openstreetmap.org/copyright`.
- Attribution may collapse after interaction or five seconds if the licence information remains findable, for example through an information button or an About / Data licences menu.
- The OSMF guideline does not specifically cover offline/downloaded maps. For databases, include attribution and an ODbL link in readme or metadata.
- A produced work is distinct from a derivative database. Share-alike is relevant if Satchel publishes a derived database, such as derived POI files; it does not automatically follow merely from displaying a produced-work map. **To verify:** whether any proposed POI data is a derivative database and what obligations apply before publishing it. Do not publish derived POI files until reviewed.

**Sources:** [OSMF attribution guideline](https://osmfoundation.org/wiki/Attribution) · [Produced Work guideline](https://wiki.openstreetmap.org/wiki/Open_Data_License/Produced_Work_-_Guideline)

## 4. Hosting: Cloudflare R2

- Proposed approach: copy city extracts to a public R2 bucket and serve them as static files, with cache headers set for the intended update policy. **To verify:** public-bucket configuration, suitable cache headers, and delivery behaviour.
- Verified R2 Standard free tier, per month: 10 GB-month storage, 1 million Class A operations, and 10 million Class B operations. Beyond the free tier: $0.015/GB-month, $4.50 per million Class A operations, and $0.36 per million Class B operations. Egress is free.
- These prices came from flarecalc.com and must be re-checked on cloudflare.com before any account is created.
- Account creation is the owner’s decision. **No sign-ups or account creation as part of this spike.**

## 5. Phone download, update, delete

### Proposed flow

1. Show available cities, approximate download size, and whether each city is installed.
2. On request, download the selected extract and show progress. Keep the existing installed copy available until the replacement has passed validation.
3. Validate the completed file before marking the city ready for offline use.
4. For updates, offer the newer extract and its size; do not replace the installed version until the new one is validated.
5. Allow deletion per city, clearly stating the expected space to be reclaimed.

### Integrity and storage

- Use a published BLAKE3 hash with `b3sum` when it corresponds to the exact hosted file. **To verify:** hash availability and verification approach for every city extract. If extracts are hosted after generation, consider publishing a hash alongside each file; implementation and format are **to verify**.
- **To verify:** download resume/retry behaviour, handling of interrupted downloads, atomic replacement, corruption recovery, and protection against insufficient disk space.
- Warn before a download when device storage appears insufficient, and show installed map sizes. **To verify:** available-storage measurement on iOS, warning thresholds, and how estimates account for temporary space needed during updates.
- **To verify:** whether the app should support removing all maps from settings and how map removal interacts with a currently open map.

## 6. Open questions for the owner

- Which cities should be in the first test set, and what bbox padding should include useful nearby areas?
- What default maxzoom best balances readability and the 10–60 MB/city target?
- Should city downloads be available only on Wi-Fi, or should users be able to choose?
- What update policy should apply: notify only, offer updates automatically, or refresh when a user opens the city?
- Is a public R2 bucket acceptable, and should the owner approve any account creation after pricing is re-checked?
- Will Satchel ship any derived POI database? If so, what is its data source and what licence review is needed?
- Which attribution placement best fits the offline map while keeping licence information easy to find?
- Which iOS versions and Expo build path should the MapLibre Native spike target?
