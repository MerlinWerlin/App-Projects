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
Turtle, Rose, Mega twenty and restart persistence remain pending until the recovery run is reviewed.
