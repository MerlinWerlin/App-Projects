# Night pass 23 Oct 2026: feedback from the other apps (night-1023)

The owner asked: "go through and add any feedback i had across the apps which would suit each other". This pass checked Linework against feedback he gave on Couch and Glaze. JS only and OTA-safe. The Trace screen still never reads the entitlement. Branch `night-feedback`. Guard: `src/core/night1023.test.ts`.

Changed:
- **"Never fail silently" (Linework fb-1023, applied the way Couch and Glaze now speak their results):** when a photo can't be opened in Prepare, the error card is now also spoken by VoiceOver: the title, then what to try. The card used `accessibilityLiveRegion` / `role="alert"`, which iOS doesn't read, so VoiceOver users heard nothing (`src/ui/ImageErrorBoundary.tsx`, iOS only, once per error kind).

Checked, guarded, no change needed:
- **Safe-area top (Couch fb-1022d, volume HUD drawn into the Dynamic Island):** the camera top row, recording pill and touch-lock hint on Trace, and the Lightbox top row, all start at `insets.top + space.sm`. Toasts sit above the home indicator. The new guard test keeps it that way.
- **Pills (Linework fb-1022c, Glaze fb-1023 B 2×2):** PillSegmented wraps rather than truncating, and the level control already uses 2 columns. The Prepare background row (Subject only / Soft / Everything) can wrap to two lines in long locales, but it wraps at a space, never mid-word. Left as is: a 2+1 grid would look odd.
- **Calm fade on chip swaps (Glaze):** Templates already eases the grid on shelf, level and favourite changes (`animateListChange`), and skips it under Reduce Motion.
- **Favourites (Couch "favourites only"):** Templates already has favourites and a Favourites filter.
- **Plus / restore:** Buy, Restore and the "store not ready" case all show an alert (fb-1023). The tip jar is test-build-only.
