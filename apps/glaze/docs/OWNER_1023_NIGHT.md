# Night pass 23 Oct 2026: feedback from the other apps (night-1023)

The owner asked: "go through and add any feedback i had across the apps which would suit each other". This pass took feedback he gave on Linework and Couch and applied it here where it fits. JS only and Expo Go-safe. Calm motion rules unchanged: no springs, bounce or scale. Branch `night-feedback`. Guard: `src/core/night1023.test.ts`.

| Task | From | Change |
|---|---|---|
| NF1023-1 | Linework fb-1022c (cramped level pills → 2 columns), Glaze fb-1023 B (All / New / Picks / Liked as 2×2) | Wallpaper editor: **Style** (Gradient / Mesh / Grain / Pattern) and **Pattern** (Dots / Grid / Waves / Checker) are now 2×2 blocks of equal pills. Each was four quarter-width segments of about 68 pt, so "Sfumatura", "Degradado", "Cuadrícula" and "グラデーション" broke mid-word on a 375 pt iPhone or with larger text. Tapping the chosen pill does nothing any more, and a change plays the selection tick, the same as the shared Segmented. |
| NF1023-2 | Couch (apps screen announces its status line), Linework fb-1023 (never fail silently) | Save and pick results on the wallpaper editor and the collage, plus the Feedback screen notes, are now spoken by VoiceOver. `accessibilityLiveRegion` only works on Android, so on iOS these results used to be silent. New helper: `src/ui/announce.ts` (iOS only, so Android doesn't hear them twice). |
| NF1023-3 | Linework fb-1023 ("tapping Unlock Plus did nothing") | Plus sheet: when Unlock can't go through, the person now feels a warning haptic (on the error path too), sees the line and hears it spoken on every tap. Restore purchases speaks "restored" / "nothing to restore" / "failed" every time, even when the line under the button stays the same. |

Checked, no change needed:
- **Safe-area top (Couch fb-1022d, volume HUD under the Dynamic Island):** toasts sit at the bottom (`insets.bottom + 72`). The large-title bars, sheets and pushed screens all clear the inset, and nothing is pinned to the top edge.
- **Other segmented controls:** the shapes rows are already vertical (fb-1017). Discovery is already 2×2 (fb-1023 B), and Themes sub-tabs are content-sized PillTabs. The 2- and 3-option rows (motion, sizes, spacing, sub-tabs, source, strength, preview mode, live kind) fit their longest translation, or wrap at a space.
- **Calm fade on chip / filter swaps (fb-1022c / fb-1023 A):** already in Glaze.
- **Favourites (Couch "favourites only", Linework template favourites):** Glaze already has Liked themes and wallpapers, plus the Liked filter. Nothing to add.
- **Fragile loads (Couch store icons, Linework templates gone):** Glaze bundles its catalogue. Likes load from local storage and fall back to an empty list if storage fails, so there's nothing to cache.
- **POLISH shared rules:** Reduce Motion, the haptics setting, press feedback and empty states are already in place.

Nothing needs a new build: it all reaches the phone with the next Expo Go / OTA update.
