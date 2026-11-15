# Glaze: future features (master list)

Owner, 14 Nov 2026: "can we add a master list then for things to add in the future… We need to get this app out so we can
start marketing it and then start giving it some updates." Things parked here are **not** in the release. Add new items at
the bottom of their section with the date and who asked; move an item to "Done" with its version when it ships.

## Widgets
- **Lock Screen widgets.** The widget extension already has real Lock Screen widgets (analog clock, date, battery,
  countdown, moon: `targets/widget/LockAccessoryWidget.swift`). The Widgets tab's Lock Screen size tab was taken out in
  1.0.35 ("a lock screen one is something that we'll do. This needs to go for now"). To bring it back: add `'lock'` to
  `WIDGET_TAB_SIZES` and `WIDGET_TAB_CARD_SIZES` in `src/core/tabNav.ts` (the analog clock card rule is still there).
- **Medium and Large widgets (clocks and art).** Owner 2026-11-15: the Medium / Large tabs ("Coming soon" in 1.0.35-1.0.36)
  confused people, so 1.0.37 removes the size picker and the Widgets tab is Small only (Artwork 1-5, Custom 1-5). The
  widget extension still has the theme clock (`ClockWidget`, S/M/L) and the analog clock (`AnalogClockWidget`, S/L);
  only the in-app tabs went. Bring the tabs back once there is medium and large content (clocks plus art): restore the size
  picker in `app/(tabs)/widgets.tsx` (`WIDGET_TAB_SIZES`, `SizeArt`) and add the size to `WIDGET_TAB_CARD_SIZES`.
- **The other native widgets in the Widgets tab** (date, photo, quote, battery, habits, progress, calendar, photo album).
  They exist in the iOS Add Widget list and Widget Studio but are no longer listed in the app (1.0.34): the owner found
  them confusing ("you can't select these anymore"). Bring back only once each one is clearly useful and tappable.
- **Make your own theme: custom icons, wallpapers and community sharing of original art** (owner, 15 Nov 2026, after
  1.0.36's Your artwork slots). Next steps: custom icon pictures and custom wallpapers built the same private,
  on-device way. Public sharing (a community page) is a separate, bigger job: Apple guideline 1.2 needs a way to
  filter objectionable content, report it, block abusive users and contact us; and it must never host third-party
  IP (characters, logos or brands people don't own: guideline 5.2, and weak Australian safe harbour). Original
  art only, with moderation in place before anything goes public.

## Artwork
- **Missing small artwork** (audit 13 Nov): done in 1.0.37. The 199 pieces from #307 are published on Cloudflare R2, and
  all 141 themes have five artworks.

- **Patchwork theme: rocket pieces not distinct enough; refresh art** (owner TestFlight 1.0.37, 15 Nov 2026). The five
  pieces pass the SHA-256 check but two rocket pieces read as near-duplicates on the phone; give it new, clearly different art.
- **Bring back the original art themes** (Deep Sea, Starry Night, Sunset Dunes) once each has five distinct small artworks.
  They left the gallery in 1.0.39 with one piece each (their data stays; add the ids back to `GALLERY_STARTER_IDS`).

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
- 1.0.36: Your artwork: five private picture slots on the Widgets tab and the Custom 1–5 Home Screen widgets.
