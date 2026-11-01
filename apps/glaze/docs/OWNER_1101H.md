# Owner brief owner-1101h (1 Nov 2026, 17:23 Sydney)

Jared, in chat, after testing TestFlight 1.0.1 (19). Imported in build run 221 as T250-T255.

## Working well (keep, guarded by tests: T255)
Starry textured icons ("really good"), icon install + theme-swap replacement, much better navigation, My widget art Manage/Delete, the clock widget with live time, Fill layout on the red-moon piece.

## Asks, in order
1. **Crash / freeze (T250, top).** After applying a new theme (Firefly Grove) and coming back into Glaze: frozen, then a long startup, then a crash. Fix: deferred, chunked after-first-frame work; nothing blocks launch; every step idempotent and crash-safe; installed-app probe throttled; launch budget guard test.
2. **Widget art blends with the wallpaper on every theme (T251).** No frame, no box, no halo. Alpine Starlight full moon (grey frame round a black square) and the red blood moon (dark box with a glow edge) are the examples. Audit every theme with contact sheets.
3. **Theme apply adds that theme's widget art automatically (T252)** and removes the previous theme's auto-added art (own photos stay). Edit Widget > Art lists the current theme's pieces straight after a swap.
4. **Themes front page with categories + All themes (T253)**, fast with 100+ themes. Categories: Space & Night, Nature, Ocean & Water, Cute & Cosy, Sweets & Treats, Dreamy & Pastel, Moody & Dark, Abstract & Art, Seasonal, City & Retro, then More.
5. **80-100 remote packs (T254):** Jared's chat publishes ~77 more themes with `category`; the app keeps listing fast (thumbnails only until opened).

## Status
See ops/RUNLOG.md run 221 and docs/TRIAL.md "New since your last test (1 Nov, night: owner-1101h)".
