# Hollowhue plan

**Idea (Jared, 1 Nov 2026):** an iPad colouring app with infinite zoom. Each scene hides more detail as you zoom in,
so you keep zooming and colouring. Two ways to colour, switchable any time: tap to fill, or freehand with finger or
Apple Pencil. Themes for adults as well as kids: cosy places (cafés, libraries, bookshops), animals in their
environments, whimsical fantasy, dinosaurs in the jungle, patterns and mandalas, plus some cute. The app that
inspired it ("Infinity Coloring Book") has a single theme.

## How the zoom works
- A scene is a tree of **levels**. Each level is line art in its own 1200 x 900 space, placed inside a **portal**
  rectangle (or ellipse) of its parent. The parent draws a simple stand-in there; once the child fills 15% of the
  screen its real detail is drawn on top, and once it covers the screen the parent stops being drawn.
- Regions are SVG paths; the same path draws the art and drives tap hit-testing (even-odd, topmost wins).
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

## Phase 2 (next)
- Pinch feel on device (Jared's TestFlight notes), Apple Pencil only drawing option (finger pans), pressure.
- More scenes with depth: library (shelf -> book -> illustration in the book), forest (tree -> owl hollow -> owl),
  ocean reef, dragon's hoard, a café counter to a latte-art level, jungle with a hidden nest.
- Custom colour picker + recent colours, gradient fills, texture brushes (crayon, watercolour).
- Export / share a finished picture (whole scene or the current zoom), time-lapse replay.
- Scene versioning: region ids are stable per scene `version`; restore trims ids that no longer exist.

## Money (later, not in phase 1)
Same factory model: free core forever, no ads, no tracking.
- **Free:** the four phase-1 scenes and one new free scene a month.
- **Packs:** one-time scene packs (about A$2.99 each, 4-6 deep scenes: Cosy Places, Fantasy, Animals at Home,
  Dinosaurs, Patterns).
- **Hollowhue Plus (optional):** one-time lifetime unlock of every current and future pack (about A$14.99) rather
  than a weekly subscription; if a subscription is ever added it is yearly only, with a free trial item the person
  starts (guideline 3.1.1) and restore on the same screen. expo-iap pinned, per docs/RELEASE_STANDARD.md section 2.
