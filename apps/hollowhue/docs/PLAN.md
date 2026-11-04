# Hollowhue plan

**Idea (Jared, 1 Nov 2026):** an iPad colouring app with infinite zoom. Each scene hides more detail as you zoom in,
so you keep zooming and colouring. Two ways to colour, switchable any time: tap to fill, or freehand with finger or
Apple Pencil. Themes for adults as well as kids: cosy places (cafés, libraries, bookshops), animals in their
environments, whimsical fantasy, dinosaurs in the jungle, patterns and mandalas, plus some cute. The app that
inspired it ("Infinity Coloring Book") has a single theme.

## How the zoom works
- A scene is a tree of **levels**. Each level is line art in its own 1200 x 900 space, placed inside a **portal**
  rectangle (or ellipse) of its parent. The child is drawn in place from when it is 10 px wide; each shape fades in
  as it grows from 1.5 to 5 px on screen, so detail emerges continuously. Once the child covers the screen the
  parent stops being drawn (invisible, since it is fully covered).
- Regions are closed SVG paths for colour fills and hit-testing (even-odd, topmost wins). The illustrated
  catalogue retains the original smooth ink curves above those regions; generated fill contours do not
  add a second outline.
- `from` links let a region show another level's colour until coloured itself (zoom into a wall you painted
  and it is still that colour; stand-ins match the detail).
- Freehand strokes are stored in the level they were drawn in (level units), optionally clipped to the shape they
  started in ("stay inside the lines"), and drawn in that shape's place so shapes on top still cover them.

## Phase 1 (first TestFlight) - done 1 Nov 2026
- Bookshop Lane, 4 levels: street -> inside the bookshop -> reading nook -> sleepy cat on a patterned cushion.
- Endless Mandala, 3 levels (each centre opens onto another mandala); Café Window; Dinosaur Jungle.
- Tap-to-fill and Draw (pencil, marker, rubber, 3 sizes, stay inside the lines), 5 curated palettes, undo/redo,
  clear, autosave per scene, gallery with progress thumbnails and theme filters (off by default), "Look closer"
  flight to the next hidden level, "You found" toasts, first-launch language line, Settings.
- No ads, no tracking, no account, no purchases.

## Phase 2 (ongoing)
- Pinch feel on device (Jared's TestFlight notes), Apple Pencil only drawing option (finger pans), pressure.
- More scenes with depth: library (shelf -> book -> illustration in the book), forest (tree -> owl hollow -> owl),
  ocean reef, dragon's hoard, a café counter to a latte-art level, jungle with a hidden nest.
- Custom colour picker + recent colours shipped 4 November. Gradient fills and texture brushes remain later work.
- Export / share a finished picture (whole scene or the current zoom), time-lapse replay.
- Scene versioning: region ids are stable per scene `version`; restore trims ids that no longer exist.

## Artwork and depth correction (5 November)

- Jared approves the new picture quality and confirms that six zooms means newly illustrated detail
  inside each individual artwork. The 42 approved pictures remain separate Single artworks.
- Six new Zoom editions each contain six discoveries within their own scene: Cottage, Camellia & Bee,
  Barn Owl, Coral Turtle, Gentle Daisy, Rose Engraving. Mega Rose Engraving contains twenty inner tiers
  of the same engraving. The cottage leads through its window into the book, its bee illustration,
  wing, pollen and pore. This uses 47 new illustrated details, with shared bee microtexture plates.
- Single artwork, Zoom artworks, Mega Zoom and My colouring are distinct collections; topic and
  difficulty filters compose with them. Singles have precision zoom without discovery controls.
- The previous seven chained illustration scenes and six original authored scenes retain exact
  geometry, region IDs and saves. Saved chains remain in My colouring. On first use only, paint from the latest
  saved source-scene timestamp can be copied into a new Single edition; existing Single saves are never overwritten.
- Canonical source/portals are in `scripts/art/nested-source.json`; full built-in image generation
  prompts/references are in `nested-generation.json`. Rebuild with `scripts/build-art-library.py`.
  Art decoding is per illustration with a bounded cache, and unpainted white cells avoid extra SVG views.
- 159 offline checks and strict type checks pass, including all six/twenty stops, landscape framing,
  deep colour persistence, and hashes of all approved/released geometry. Native iPhone checks pass
  across two reviewed captures of identical compiled app source: all six regular journeys, Mega
  twenty, deep paint/drawing and restart persistence. Receipts and qualified frames are in
  `docs/qa-nested-20261105`.
- PR234 is merged as `df0c24a7`. Production OTA `9dd44b9b` is live and its actual downloaded bundle
  hash verifies. TestFlight **0.1.0 (5)** is COMPLETE / VALID / IN_BETA_TESTING with no upload errors
  or warnings, verified by probe `41919622598`. Update through TestFlight, then open
  **Zoom artworks → Rose Cottage: Inside**. Existing installations can also apply the OTA.

## Money (later, not in phase 1)
Same factory model: free core forever, no ads, no tracking.
- **Free:** the four phase-1 scenes and one new free scene a month.
- **Packs:** one-time scene packs (about A$2.99 each, 4-6 deep scenes: Cosy Places, Fantasy, Animals at Home,
  Dinosaurs, Patterns).
- **Hollowhue Plus (optional):** one-time lifetime unlock of every current and future pack (about A$14.99) rather
  than a weekly subscription; if a subscription is ever added it is yearly only, with a free trial item the person
  starts (guideline 3.1.1) and restore on the same screen. expo-iap pinned, per docs/RELEASE_STANDARD.md section 2.
