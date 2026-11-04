# Realistic artwork release evidence — 4 November 2026

This folder records Hollowhue's artwork/category/depth release, merged in PR224 as
`94f119228f9259c8e77d67209c4e94e257edb286`. The app runtime is exactly equal to the passing native source
`2c585f9b780eb52b01b0eb5fad38656f1b2e1cf0`; only capture YAML and release documentation changed after it.
The full iPhone run41812677928 passed category/difficulty selection, six regular and twenty Mega stops,
deep painting, drawing, undo/redo, and saved work/recent colours after restart. OTA is disabled only for
reproducible simulator captures. This is not physical-device uptake evidence or an App Store screenshot approval.

Production OTA run41817626284 succeeded. `production-update.json` records the public iOS/runtime0.1.0
manifest and actual downloaded 28,726,172-byte bundle with matching SHA256. Group:
`28b985e9-003d-4211-8cba-f73de9565c9f`, published10:58:40UTC.

Signed native build **0.1.0 (4)** uploaded successfully at11:13UTC in run41817626016, submission
`1c7e39ae-8994-489a-a718-6d8487c32996`. Apple probe41819703539 reports **PROCESSING**, no errors or warnings;
`apple-upload-status.json` preserves that in-flight state. Subsequent probe **41821210892** confirms build4
**COMPLETE / VALID / IN_BETA_TESTING**, with no errors or warnings; `apple-complete-status.json` is the
final availability receipt. The same probe reverified the production update and actual bundle hash.

The squash commit inherited a skip-ci marker, so both releases were explicitly dispatched on the reviewed
main commit. GitHub's ongoing Git/PR/Actions incident caused intermittent500responses during delivery.
No SDK/native dependency or runtime change was made.

One first cottage screenshot in the passing run preceded SVG rendering. The capture-only flow now returns
from the cafe to Whole scene before taking it, reusing the exact compiled app. Retake41816934677 failed on
a software-GL simulator host; repeat41819117906 ended when XCTest lost the simulator's active-application
accessibility connection (`kAXErrorIPCTimeout`). The Whole scene assertion did not complete. These are
retained as failed retakes, not substituted for the full passing app run.

Ten usable captures from the full passing run are preserved here. Its premature initial cottage frame is
excluded; the raw frame remains in the original run artifact and local capture archive. The separately
named `reference-cottage-source-391f5ed8.png` comes from earlier native run41807826539 and is an artwork
reference only. Its generated artwork data is literally equal to the released data; it is not represented
as a capture of the release runtime. `receipt.json` records every source, exclusion and qualification.
