# Glaze: future features (master list)

Owner, 14 Nov 2026: "can we add a master list then for things to add in the future… We need to get this app out so we can
start marketing it and then start giving it some updates." Things parked here are **not** in the release. Add new items at
the bottom of their section with the date and who asked; move an item to "Done" with its version when it ships.

## Widgets
- **Lock Screen widgets.** The widget extension already has real Lock Screen widgets (analog clock, date, battery,
  countdown, moon: `targets/widget/LockAccessoryWidget.swift`). The Widgets tab's Lock Screen size tab was taken out in
  1.0.35 ("a lock screen one is something that we'll do. This needs to go for now"). To bring it back: add `'lock'` to
  `WIDGET_TAB_SIZES` and `WIDGET_TAB_CARD_SIZES` in `src/core/tabNav.ts` (the analog clock card rule is still there).
- **Medium and Large widgets.** Shown as "Coming soon" since 1.0.35. The theme clock (`ClockWidget`, S/M/L) and analog
  clock (`AnalogClockWidget`, S/L) are real; theme artwork is small only (Artwork 1–5). To show cards again: add the size
  to `WIDGET_TAB_CARD_SIZES`.
- **The other native widgets in the Widgets tab** (date, photo, quote, battery, habits, progress, calendar, photo album).
  They exist in the iOS Add Widget list and Widget Studio but are no longer listed in the app (1.0.34): the owner found
  them confusing ("you can't select these anymore"). Bring back only once each one is clearly useful and tappable.

## Artwork
- **Missing small artwork: 261 pieces across 136 of 141 themes** (audit 13 Nov). Every theme needs 5 plain artworks so
  Artwork 1–5 differ; short themes repeat pieces (e.g. Moonpatch shows the kite and rocket twice). The one-shot prompt
  for ChatGPT / Codex is in the session notes (`glaze-missing-artwork-prompt.md`); publishing the packs needs the owner's
  OK. No app change is needed: themes pick up new art when applied.

## Icons
- **Icon install screen "More options".** 1.0.35 opens a theme's flow on two choices (Icons / Widgets). Inside the install,
  the method, re-install and clean-up steps stay in order because each depends on the one before; a calmer layout for
  them needs its own design pass.
- *Not possible (for the record):* icon shapes other than the rounded square. iOS draws every added icon inside its own
  rounded square, so blob / circle / square / rounded were removed in 1.0.35 (one shape, `ONE_ICON_SHAPE`).

## Wallpapers
- Theme wallpapers on the Wallpapers tab arrived in 1.0.35 (downloaded themes). Later: wallpapers of themes not yet
  downloaded, as a preview with a Download button.

## Done
- 1.0.35: Lock Screen tab hidden, Medium / Large "Coming soon", one icon shape, corner Watch how on every tab, theme
  wallpapers on the Wallpapers tab, Icons / Widgets start screen.
