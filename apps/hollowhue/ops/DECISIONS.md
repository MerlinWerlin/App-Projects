# Decisions

- 2026-11-01 · Jared · Build an iPad-first infinite-zoom colouring app; tap-fill and freehand (finger/Pencil),
  themes beyond cute (cosy places, animals, fantasy, dinosaurs, patterns), for adults too.
- 2026-11-01 · Claude · Name **Hollowhue** (searched: no app by that name; avoids Infini, Pigment, Lake, Colorfy,
  Recolor, Happy Color). Bundle id com.jared797.hollowhue, folder apps/hollowhue.
- 2026-11-01 · Claude · Vector levels in react-native-svg with our own hit testing, not a raster flood fill: crisp
  at any zoom, tiny saves, works in a plain Expo build (no native modules, no gesture-handler/reanimated).
- 2026-11-01 · Claude · Child detail switches on at 15% of screen width (no cross-fade ghosting).
- 2026-11-01 · Claude · No purchases in phase 1; packs + optional lifetime Plus later (docs/PLAN.md).
- 2026-11-01 · Claude · Replaced the 15% hard reveal and hand-drawn stand-ins with continuous per-shape fade-in by on-screen size (Jared saw the pop).
- 2026-11-01 · Jared · Eraser must be an obvious tool in both modes.
