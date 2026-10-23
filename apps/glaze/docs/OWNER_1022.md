# Owner test 22 Oct 2026 (fb-1022)

One-time import, received 22 Oct 2026 through a manual run of the "Glaze build" scheduled task (not a page comment). The owner tested the 21 Oct build (commit d428012) in Expo Go on his iPhone: "Glaze looks good". Tasks T99–T104 are tagged `fb-1022` and outrank everything except trial blockers.

The message as received:

> OWNER TEST 22 OCT 2026. The owner tested the 21 Oct build (commit d428012) in Expo Go on his iPhone: "Glaze looks good". Add tasks tagged "fb-1022" that outrank everything except trial blockers, and do G1–G4 this run, then start G5.
>
> **G1 First impression:** the info tags / tip bubbles shown when the app first opens are handy but make the app look ugly at first sight. Remove them from the first screen. Keep help available another way: a single small "?" or a dismissible one-line hint that appears once, after the user's first action, never stacked; or a short 2–3 card welcome that is skippable and never returns. The first screen must look like a finished, beautiful gallery.
>
> **G2 Icon shapes:** hide the shape options inside the theme/template flow. Show the shape picker only after a theme is selected (in the theme detail / apply step, collapsed behind a "Shape" row), not on the main screen.
>
> **G3 Categories:** the category bubbles are good but too far down. Move them to the top of the Themes screen, directly under the large title, above everything else.
>
> **G4 "Our picks" label/badge looks odd:** redesign it so the text wraps cleanly or sits as a tidy pill/section header (no clipping, no awkward line breaks, works with long translations).
>
> **G5 New themes ("get a bit creative"), several free:**
> (a) A Space collection using real James Webb Space Telescope images. Use official NASA/ESA/STScI Webb releases whose licence allows commercial use with credit (ESA/Webb images are CC BY 4.0; NASA images are generally free to use). Store each image's source URL and the exact credit line in the theme manifest, show the credit in the theme detail, and ship them as downloadable theme packs (download on demand) rather than bundled. Check the licence of each image and record it in docs/THEME_PACKS.md.
> (b) Original "game-inspired" themes: retro pixel arcade, cyber neon, fantasy RPG/quest, cosy farming-sim, racing. Styles and moods only.
> (c) Original "movie-night" mood themes: sci-fi, noir, monster/horror-cute, superhero-style with ORIGINAL heroes.
> (d) Fairy-tale / storybook themes for kids: castles, princesses, dragons, woodland friends, all original characters.
> The owner asked for themes based on Disney characters and famous games/films. We can't use those characters, names or logos (App Review rejects them under 5.2 and those owners actively enforce), so we make the original versions above, good enough that people don't miss the real ones. Any free ones are marked clearly.
>
> Finish message: list G1–G5 status and what to retest.

## Tasks

| Task | Item |
|---|---|
| T99 | G1 Calm first screen: no tip cards; help through the header "?" and one single, dismissible one-line hint shown once after the first action |
| T100 | G2 Shape picker leaves the Themes screen; theme detail gets a collapsed "Shape" row |
| T101 | G3 Category bubbles directly under the large title |
| T102 | G4 "Our picks" redesign: discovery tabs that size to their text and never clip |
| T103 | G5a Space (Webb) photo pack: licence check, manifest with source URL + credit, credit in theme detail, download on demand |
| T104 | G5b–d Original game-inspired, movie-night and storybook themes, several free |

## Follow-up: category bubble lag (fb-1022-perf, T107, run 74)

> The owner says tapping a category bubble LAGS: the big bounce looked good, but because it stutters it looks silly. Fix the performance, keep the effect.

Done in run 74 (commit 4ac242a): the bounce stays (same spring, same size), runs on the UI thread from the press itself; only the two changed bubbles re-render; the grid follows one frame later as a transition and fills in a few cards per frame; no per-card layout animations; going back to "All" mounts nothing. The apply ripple no longer rebuilds every icon. Retest: docs/TRIAL.md "New 22 Oct" item 0 (T109).

Also run 74: T106 Free pill + Games / Movie night / Storybook chips; T105/T108 Space photos end to end with a safe download and a friendly offline state.

## fb-1022c — owner test 22 Oct evening (task T110)

> The owner tested the category bubbles again and wants the BOUNCE REMOVED: "it needs to be some very generic, chill transition — the bounce is too full on and it's causing so much lag." (The PC copy he tested may have been from before T107; the decision stands either way.)

Done in run 77: no scale, no spring, no overshoot on category change. The selected bubble keeps its size and fades in a tint ring + glow (150 ms ease-out, opacity only), the old one fades out, labels keep one weight so nothing re-flows, and the row scrolls the bubble into view. Pressing a bubble dims it instead of shrinking it. The grid cross-fades (opacity only, 180 ms ease-out): no slide, no drag-follow spring, no stagger, no zoom, no layout animation. T107's performance work stays (store-driven bubbles, deferred grid swap, progressive reveal, memoised cards). Same calm rule on the rest of the Themes screen: press feedback (PressableScale) and selected cards (SquircleCard) ease with a timing curve instead of a spring app-wide, cards no longer stagger in on first open, and the centred-card icon "pop" when scrolling stops is gone. Guard: src/core/calmMotion.test.ts. Retest: docs/TRIAL.md "New since your last test".
