# Nested artwork correction, 5 November 2026

This folder records review and verification of the owner-requested correction: preserve the 42 approved
standalone pictures, and reveal newly illustrated detail within each six-step Zoom artwork and the
twenty-step Mega engraving. Source-art contact sheets are composition reviews, not iPhone screenshots.
Native captures and delivery receipts are added only after their checks complete. The live stage and
release state remain in `ops/status.json` and the master roadmap.

## First native capture (partial)

Run `41900538055` compiled app source `af7c64ba799b77c04f702540b2d1af7b61a2740f`. Four actual
regular journeys (Cottage, Camellia, Owl and Daisy) reached all six discoveries and returned to their
opening view. Standalone artwork, a custom blue fill, drawing and undo/redo were also checked. Fourteen
reviewed native frames are preserved with the `first-` prefix; source hashes and limits are in
`attempt-1.json`. These are iPhone simulator captures, with OTA disabled only for reproducibility.

The workflow failed while scrolling to the final Rose gallery card. Review also found that its Turtle
tap had selected Cottage, so that frame is excluded and does not verify Turtle. The duplicate Cottage
endpoint is excluded too. Remaining checks use the exact same compiled app, with actual scene-name
assertions, category selection and an element-anchored swipe of the topic rail. The capture repair follows
[Maestro's swipe syntax](https://docs.maestro.dev/reference/commands-available/swipe) and
[scroll visibility rules](https://docs.maestro.dev/reference/commands-available/scrolluntilvisible).
## Native coverage complete

Recovery run `41907753409` succeeded using capture workflow `94212b40` and the identical compiled app
source `af7c64ba`. Actual scene-name assertions confirm Turtle and Rose, both with six discoveries.
All twenty Mega stops passed; blue paint at the twentieth is visible on the final rose engraving.
The blue standalone daisy petal and recent colour survived a restart. All ten recovery frames were
reviewed and are preserved with the `remaining-` prefix. Combined with the four verified journeys from
the first run, this covers all six regular editions. `receipt.json` records scope and hashes.

No app/src/assets/config/package runtime files changed after the compiled source; subsequent changes
are capture tooling and evidence. Offline validation:159 tests,full/stub strict types,Expo doctor21/21,
and iOS/Hermes export. Original artwork and prior-scene geometry hashes match. Physical iPhone uptake
is not independently verified. Production OTA and Apple delivery receipts below record the released state.

## Production OTA live

PR234 merged as `df0c24a7f908ed3cbd4129665c7b4a2e2426b0a9`. Ship run `41912203479` published iOS
production update group `9dd44b9b-efec-4f06-b36d-0c75cfcdaa78` at `2026-11-04T21:03:52.170Z`.
`production-update.json` verifies the served manifest, runtime0.1.0 and the actual downloaded bundle:
42,000,780 bytes, SHA256 `d2ad60a17afad742272ed054145119c580e4f1a46679da54ee37e9c11e4b5ab9`.
Existing installations can apply it through Settings → App updates → Check → Save & apply.

## TestFlight 0.1.0 (5) ready

Signed build/upload run `41912245091` succeeded from release source `df0c24a7`. Submission
`7ee27d85-e2eb-48a4-88a6-67bfe429db55` uploaded build 5. Apple probe `41919622598` confirms
upload `0c7ab517-0f62-42c1-9fff-8a0f03afb51e` is COMPLETE, the same build is VALID, and
its internal state is IN_BETA_TESTING, with no upload errors or warnings. The actual response is
`apple-complete-status.json`; the earlier PROCESSING snapshot remains in `apple-upload-status.json`.
That probe also reverified the production OTA bundle hash in `production-update.json`.

Update Hollowhue in TestFlight to **0.1.0 (5)**. Open **Zoom artworks → Rose Cottage: Inside**
for six nested discoveries, or **Mega Zoom → Mega Rose Engraving** for twenty. The 42 approved
pictures remain in **Single artwork**. Prior scene saves and geometry are retained. A new Single
can receive paint from the latest saved source-scene timestamp on first use; an existing Single save
is never overwritten. Physical phone installation and uptake remain unverified.

The 47 detail illustrations were generated using the built-in image generation tool, saved in
`scripts/art/illustrations`, and compiled into the app. Full prompts and reference provenance are in
`scripts/art/nested-generation.json`.
