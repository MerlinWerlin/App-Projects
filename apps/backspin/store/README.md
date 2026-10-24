# Backspin store kit

- `listing.json`: the App Store Connect listing (same fields as Linework's; pushed by `scripts/asc/asc.py apply backspin` when `ASC_REQUEST.json` changes; this app has no `ASC_REQUEST.json` or `RELEASE.json` yet).
- `jpg/ios/`: 8 screenshots, 1320x2868 JPEG (APP_IPHONE_67, 6.9"), no alpha.
- `src/render.mjs`: renders them with `scripts/store/shotkit.mjs` (preinstalled Chromium, global Playwright and sharp; installs nothing):

```sh
node apps/backspin/store/src/render.mjs
```

Each shot is a headline over a faithful mock of a real screen, built from the app's own theme tokens and English strings. These are illustrative mockups, not device captures. Original art only: a generic iPhone-style frame with no maker marks, no logos, no real people. Shot 08 is the unlock screen with the 10 free goes stated, so the pricing is clear before purchase (guideline 3.1.1).
