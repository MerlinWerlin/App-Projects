# Rebuilding the five-artwork packs

These are pack content and build tools. Glaze runtime code is unchanged. Pack publication requires Jared's explicit OK; opening or updating this PR does not publish anything.

## Authoritative baseline

`src/config/packs.ts` points production to `glaze-packs-v5/catalog.json`. Its entries select the actual per-theme release and pack version. The committed historical `scripts/packs/releases.json` is a build map, not the runtime catalogue. Using it as the source would discard 84 existing illustrations from 42 themes.

`scripts/packs/artwork-baseline/` pins the active catalogue and all 141 selected manifests as exact downloaded bytes. `baseline-lock.json` records their URLs, SHA256, versions and app-selected artwork. Five themes already have five pieces. Before semantic correction, 136 themes need 177 additions.

Visual inspection found 17 existing goal/progress/score images with baked-in numbers. `artwork-corrections.json` deliberately changes those options from `art` to `habits`, retaining their IDs, images and every other field. They remain available as functional images and no longer occupy an Artwork slot. Replacing those slots increases the additions to **194 across the same 136 themes**. Decorative objects such as an hourglass or a radio remain illustrations.

## Source assets and rebuild

Each theme has `pack-artwork/<id>/widgets/widget-options.json`, an array of pure-art options, and 1024×1024 content-hashed WebPs beside it. The theme's `provenance.json` retains each original generation prompt, source reference and final image hash. Surplus experiments are excluded.

Run from `apps/glaze` with Node 22 or newer:

```sh
node --test "scripts/packs/*.test.mjs"
node scripts/packs/artwork_progress.mjs --markdown
node scripts/packs/cache_artwork_baseline.mjs \
  --snapshot scripts/packs/artwork-baseline --out dist/published-cache
node scripts/packs/build_packs.mjs \
  --base-packs dist/published-cache --add-art pack-artwork \
  --out dist/artwork-packs --release glaze-packs-v18 --complete
node scripts/packs/release_assets.mjs \
  --dir dist/artwork-packs --out dist/artwork-release --catalog-tag glaze-packs-v5
```

Omit `--complete` only to inspect an unfinished batch. Every supplied theme must still reach exactly five real pieces. The final command set must use `--complete` and `artwork_progress.mjs --complete`.

The cache command only downloads public files and checks all hashes/lengths. The builder is offline. It copies every original asset unchanged, appends the new WebPs without re-encoding, increments each changed pack version once from the pinned baseline and preserves the existing artwork order. New artwork must fill the actual small-widget artwork plan to exactly five; duplicate bytes/IDs, functional metadata, wrong dimensions and bad hashes fail validation.

Generated `versions.json`, `releases.json`, coverage, catalogue and upload plans stay under `dist/`. The tracked historical publishing map and the live catalogue are not changed by a rebuild. The five already-complete packs retain their exact manifests and assets.

## Publication boundary

The full rebuilt set exceeds the existing publisher's 1,000-assets-per-release limit. The reviewable local layout starts with `glaze-packs-v18` and allocates complete packs to subsequent new tags as needed. It does not split a pack across releases. `release_assets.mjs --catalog-tag glaze-packs-v5` puts the active catalogue last, instead of accidentally updating the obsolete v1 catalogue.

These are proposed upload plans, not published releases. Before any approved publication, compare the live v5 catalogue hash with the pinned baseline again and reconcile any intervening change. Review the exact generated release map and upload plan with Jared. Publish only through the approved GitHub workflow; do not use `publish_r2.mjs`. No app build or TestFlight release is required for this content update.
