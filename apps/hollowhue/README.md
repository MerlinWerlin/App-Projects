# Hollowhue (working title)

iPad-first colouring app for Jared's App Factory (iPhone too). Every scene hides more to colour inside it: pinch
into the bookshop window and you are inside the bookshop, then the reading nook, then a cat asleep on a cushion.
Colour by tapping a shape (fill) or freehand with finger / Apple Pencil (pencil, marker, rubber).

- Plan, phases and the money plan for later: docs/PLAN.md · what to try on TestFlight: docs/TRIAL.md
- Ops: ops/backlog.json, ops/RUNLOG.md, ops/DECISIONS.md, ops/CONVENTIONS.md, ops/SHIP_NOTES.md
- Tests run offline: `npm test` (node --test) and `npm run typecheck:ui` (strict tsc against scripts/tsc-stubs).
- Art check without a phone: `node scripts/dump-scenes.ts > /tmp/s.json && python3 scripts/preview.py /tmp/s.json /tmp/out`
  renders every level (and a composite with children pasted into their portals) to PNG.

## Current iPhone update (4 November 2026)

The active isolated checkout is `C:/Users/jared/Documents/ChatGPT/Apps/hollowhue-update`,
delivery branch `codex/hollowhue-art-delivery-20261104`; released app source is on main via PR224.
App Store Connect: **6829399355**; bundle ID:
`com.jared797.hollowhue`; Expo project: `@jared797/hollowhue`, UUID
`2f10e62c-2086-4e7d-9437-649fc240e82d`.

The November colour & discovery update adds Hidden Library and Owlwood Forest (four levels each),
an accessible custom colour mixer, and ten recent colours saved on the device. In Settings, App updates
can check/download and explicitly apply an update after all queued colouring/settings saves finish.
A failed save keeps the app open so the user can retry. Applying never interrupts the canvas automatically.
Existing scenes and their progress keys remain compatible with runtime 0.1.0; SDK 57 is unchanged.

Delivery status is in `ops/status.json` and `ops/SHIP_NOTES.md`. `scripts/iphone-flow.yaml` exercises
the native illustrated cottage/cafe, category/difficulty selection, colour entry, all six regular and twenty
Mega stops, fill/draw undo/redo and saved colours after relaunch. The capture workflow disables OTA only
in its isolated simulator build to keep screenshots
on the tested source. It does not prove physical-device uptake or production update networking.

`RELEASE.json` requests the compatible production OTA. Changing `TESTFLIGHT_REQUEST.json` on main
also dispatches the existing signed `ship-mac` build/upload, so the tested changes are embedded in
a fresh TestFlight binary. A queued build still needs upload and Apple beta-state verification.
`QA_EVIDENCE_REQUEST.json` preserves successful native-run screenshots in the app docs after checking
that the current runtime source matches the captured commit.

`python scripts/verify-update.py [expected-group]` checks the public production iOS manifest and hashes
the downloaded launch bundle. The read-only **Hollowhue release status** workflow also reports Apple's
latest build/processing/internal-beta state using existing CI credentials. Never treat a successful build
queue or upload as proof the owner can install it: check the Apple beta state too.

## Artwork and depth revision

Owner feedback on4November requests better art, Linework-style categories/difficulties, six normal zooms
and twenty in Mega Zoom. The owner also rejected the first Linework-based art preview and requested more
realistic, detailed pictures. The final replacement contains42original newly illustrated pictures across
six standard worlds and one Mega world. Beginner flowers have larger clear shapes; higher difficulties
add realistic botanical, wildlife, architectural and ornamental detail. Selected source pixels and built-in
image generation prompts are preserved in `scripts/art`; cubic ink sits above closed tappable regions.
Pure-JS fflate packs the vectors to keep the compatible update smaller; no native module was added.
`My colouring` keeps all previously saved scenes accessible without changing their shapes or region IDs.

The opening picture counts as zoom0. Standard worlds have7pictures/6transitions; Mega has21pictures/20
transitions, each a distinct illustration. `scripts/art/README.md` explains the preserved source and build
process. 57 tests include every Mega stop, deepest-level painting/persistence, ink excluded from saved fills,
and an exact legacy-art
checksum. Native iPhone QA and this revision's release status are recorded in `ops/status.json`.

The illustrated update is published as production OTA group `28b985e9-003d-4211-8cba-f73de9565c9f`.
Signed TestFlight **0.1.0 (4)** is now **VALID / IN_BETA_TESTING**. Current delivery receipts and
qualified native screenshots are in `docs/qa-art-20261104`; source images and prompts are in `scripts/art`.
