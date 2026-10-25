# MAP_SPIKE.md

## Purpose

Evaluate offline city maps for Satchel: a downloadable map per trip, available in flight mode. Initial target: **10–60 MB per city**. Sizes and implementation details are estimates until tested.

## 1. City map extracts

- Use Protomaps daily v4 PMTiles builds from `maps.protomaps.com/builds` as the source.
- Create a city extract with `pmtiles extract` and a bounding box. Keep the extract in our own storage rather than hotlinking the daily-build bucket: hotlinking is discouraged, and source URLs may change.
- Choose a `--maxzoom` per city. Lowering it reduces size; each additional zoom level roughly doubles size. Test representative cities and zoom levels against the 10–60 MB target before setting defaults.
- The daily-build bucket keeps the past week plus the latest build of each patch version. **Update cadence and source-version policy: to verify.**
- Published BLAKE3 hashes can be checked with `b3sum`. **How to verify hashes on-device, and whether hashes cover the exact extracts we host: to verify.**

Source: [Protomaps basemap downloads](https://docs.protomaps.com/basemaps/downloads)

## 2. iOS rendering and app boundary

- Spike MapLibre Native rendering on iOS behind a map adapter, so the app can switch between the offline renderer and its existing online system map.
- In Expo Go, keep the online system map. Test the offline renderer in a development build / native iOS app.
- **Expo integration, supported PMTiles source configuration, licensing of renderer dependencies, and build/distribution constraints: to verify.**
- Keep map rendering independent of trip, download, and POI models so the renderer can be replaced without changing those features. **Adapter API and migration cost: to verify.**

## 3. ODbL and attribution

- Protomaps basemap PMTiles are documented as an ODbL **Produced Work**. OpenStreetMap attribution is required.
- Show legible attribution near the map, such as in a map corner. Acceptable wording includes “© OpenStreetMap contributors” or, for a restyled map, “Map data from OpenStreetMap”. Make clear that the data is under the ODbL; link to [openstreetmap.org/copyright](https://www.openstreetmap.org/copyright).
- Attribution may collapse after interaction or 5 seconds if licence information remains findable, for example through an information button or an About / Data licences menu.
- Offline/downloaded maps are not specifically covered by the cited attribution guideline. Include attribution and an ODbL link in app licence information and in map-pack metadata or documentation.
- **Working distinction for this spike:** displaying the PMTiles extract as a Produced Work is different from publishing a derived database. Share-alike is a concern if Satchel publishes a derived database, such as its own POI files; whether any particular POI dataset is a derivative database, and the resulting obligations, are **to verify** before distribution. Do not assume that all in-app POIs are covered or exempt without checking their source and structure.

Sources: [OSMF attribution guideline](https://osmfoundation.org/wiki/Attribution); [Produced Work guideline](https://wiki.openstreetmap.org/wiki/Open_Data_License/Produced_Work_-_Guideline). Protomaps basemap generation code is described in its docs footer as open source under BSD + ODbL: [basemaps repository](https://github.com/protomaps/basemaps).

## 4. Hosting and delivery

- Copy city extracts to a public, static Cloudflare R2 bucket. Set cache headers appropriate for versioned, immutable map files; exact header policy and cache behaviour are **to verify**.
- Verified R2 Standard free tier, per month: **10 GB-month storage, 1 million Class A operations, 10 million Class B operations**. Above the free tier: **$0.015/GB-month, $4.50/million Class A operations, $0.36/million Class B operations**. Egress is free.
- These figures were checked via flarecalc.com on 24 Oct 2026. Re-check prices on cloudflare.com before any account or implementation decision.
- Cloudflare account creation is the owner’s decision. **No sign-ups or account creation as part of this spike.**

## 5. Phone download, update, and delete flow

**Proposed flow — implementation details to verify:**

1. Show city name, approximate download size, and available storage before download. Warn when available storage is insufficient or close to the expected file size.
2. Download over the network to a temporary file. Keep the existing usable map available until the new file has passed integrity checks.
3. Check the downloaded file against its published BLAKE3 hash where available. **On-device BLAKE3 implementation and hash-to-extract mapping: to verify.**
4. Mark the map available only after verification succeeds. On failure, discard the incomplete file and show a plain retry message.
5. For updates, download and verify a new version before replacing the current one. Show the new size and any extra storage required during replacement. **Atomic replacement behaviour and temporary-space requirements: to verify.**
6. Let the user delete a city map from the trip’s map storage screen. Confirm the action and explain that deleting the map removes offline map access; do not imply it deletes the trip. **Exact storage accounting and recovery behaviour: to verify.**
7. Keep map downloads separate from trip data so a user can remove map files without removing tickets, documents, or other trip details. **Storage layout and backup behaviour: to verify.**

## 6. Open questions for the owner

- Which cities should be tested first, and what city boundary or bounding-box policy should we use?
- What default `--maxzoom` best balances readability, detail, and the 10–60 MB target?
- Should map packs update automatically, only on request, or only when a trip is edited?
- Which R2 account, bucket ownership, public URL, and domain—if any—should be used? Account creation requires the owner’s decision.
- What storage warning threshold and download confirmation should the product use?
- Which POI layers should be included, what are their sources, and do any constitute a derived database with share-alike obligations?
- Who will review final attribution wording, placement, and the treatment of downloaded maps?
- Which iOS / Expo setup will support the native renderer, and how will the Expo Go online-map fallback be tested? **To verify.**
