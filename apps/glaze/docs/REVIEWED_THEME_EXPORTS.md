# Reviewed theme export candidates

`scripts/export-reviewed-themes.mjs` takes `--reviews <glaze-theme-reviews>` and reads the visual-review snapshot at `release-simulation/catalogue.json`. It writes only additive dated exports into the existing theme folders. It does not upload packs or increase the installed app bundle.

Each theme receives opaque 1024px square PNGs for the production catalogue's 133 generic glyphs. `icons/exports-20261101/app-map.json` maps all 983 catalogue rows to those shared images and records hashes and byte sizes. These are the app's Feather font and in-house SVG geometry, in the reviewed palette; they are not cropped concept-board icons or brand logos. Retain the Feather MIT license and notice when distributing them.

The widget exports add a clean clock face to each theme and additional date, focus or battery faces where needed. These are code-drawn UI backgrounds with no time, date, percentage or timer painted in. They are different from the original decorative artwork, which stays intact. `widgets/runtime-options-20261101.json` records `numberFree: true` and `liveFrame`, so the existing native live-art renderer places the value in the intended area. A clean face becomes a functioning widget only after its candidate pack is loaded into a build containing this support.

`liveFrame` is an optional v2 widget option field: `{ rect: [x, y, width, height], shape: "circle" | "plate" }`, normalised to the source image. It is accepted only with `numberFree: true`; every value must be finite and in 0..1 and the whole nonempty rectangle must be inside the image. The existing composition maths maps it into each size. Older manifests retain the original lower badge area. Unknown painted faces are never automatically promoted to live.

Live Fit now retains the composed image and applies the same 6% inset to the image and value layer. Plain decorative Fit still uses its raw artwork. Known painted sample values receive fully opaque covers. Swift rejects off-canvas live rectangles just as the TypeScript reader does.

Validation: run the focused live-art, widget-option and live-frame tests, then the Glaze widget contract workflow for Swift decoding and iOS SDK typechecking. Physical device checks must cover independent widget choices, Fill/Fit, theme swaps, midnight/timezone transitions and focus interaction. Browser previews and successful SDK typechecking do not establish those device results.
