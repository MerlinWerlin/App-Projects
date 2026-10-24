# Cue store kit

- `listing.json`: the App Store Connect listing (same fields as Linework's; pushed by `scripts/asc/asc.py apply cue` when `ASC_REQUEST.json` changes; this app has no `ASC_REQUEST.json` or `RELEASE.json` yet).
- `jpg/ios/`: 8 screenshots, 1320x2868 JPEG (APP_IPHONE_67, 6.9"), no alpha.
- `src/render.mjs`: renders them with `scripts/store/shotkit.mjs` (preinstalled Chromium, global Playwright and sharp; installs nothing):

```sh
node apps/cue/store/src/render.mjs
```

Each shot is a headline over a faithful mock of a real screen, built from the app's own theme tokens and English strings. These are illustrative mockups, not device captures. Original art only: a generic iPhone-style frame with no maker marks, no logos, no real people. Voice Follow is not shown (it needs the store build's speech module). The Plus shot lists "Voice Pace, unlimited" instead of the app's current "Voice Pace and Voice Follow, unlimited" string, which should change before review.
