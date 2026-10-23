# Night pass 23 Oct 2026: feedback from the other apps (night-1023)

The owner asked: "go through and add any feedback i had across the apps which would suit each other". This pass took feedback he gave on Linework and Glaze and applied it to Couch where it fits. JS only, Expo Go-safe, every TV control still free, and the d-pad still never mirrors. Branch `night-feedback`. Guard: `tests/night-1023.test.ts`.

| Task | From | Change |
|---|---|---|
| NF1023-1 | Linework fb-1023 ("tapping Unlock Plus did nothing" → explicit message) | Couch Plus: each Buy, Restore and tip result now also shows as a toast. The toast comes with a haptic, is spoken by VoiceOver and shows wherever the page is scrolled (the tip line sat below the list). It also shows again on a repeat tap, when the inline line can't change. The inline lines stay. |
| NF1023-2 | Same rule ("never fail silently"), for VoiceOver | A failed remote key, including from the keyboard, numpad and source sheets, and a failed app launch are now spoken on iOS. Their red line uses `accessibilityLiveRegion` / `role="alert"`, which iOS doesn't read, so for VoiceOver users the button seemed to do nothing. New helper: `src/ui/useAnnounce.ts`. It speaks on iOS only and says the same text at most once per 1.5 s, so the remote and Apps tabs don't both speak one error. |

Checked, no change needed:
- **Pill / segmented labels (Linework 2-column level pills, Glaze 2×2 discovery):** Couch already measures its label rows with `rowOrStack` / `minKeyHeight` (Larger Text, T74). The nav-mode and keyboard-mode segments turn into stacks when labels don't fit, and the Apps toolbar wraps.
- **Calm fade on filter swaps (Glaze fb-1022c / fb-1023 A):** Favourites only, favourite edits and empty states already animate through `animateNextLayout` / `FadeIn`, and Reduce Motion is respected.
- **Safe-area top:** the source of this fix (fb-1022d). Toasts rise from the bottom above the tabs.
- **Couch Plus:** price, what's free and the store stub are unchanged.

Nothing needs a new build: it all reaches the phone with the next Expo Go / OTA update.
