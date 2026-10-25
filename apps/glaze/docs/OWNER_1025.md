# Owner retest 25 Oct 2026 (fb-1025)

Source: Jared's answers in the Workboard review room after retesting TestFlight 1.0.0 (imported run 117).

| | Owner said | What we did | Task |
|---|---|---|---|
| A | Widgets "still doesn't work, just shows the same line of widgets with the same colour scheme every time" | Picking a theme on the Widgets tab now writes it to the widgets (PR #96, synced). New link check line on the Widgets tab tells whether the widgets can see Glaze's App Group (native iOS only). | T145, T146 |
| B | Icon install "can't be the main method, no one will do it": Bulk is the only/default method | Bulk is the only method; Shortcuts only appears as a fallback when Bulk cannot work. | T145 |
| C | Live Photo as wallpaper: No | Kept the Live Photo maker (saves a real Live Photo) but stopped promising a moving Lock Screen on iPhone; Apple DTS says app-made Live Photos have undocumented wallpaper requirements. Parked in docs/future/live-wallpaper. | T147 |
| D | Not tested | No change. | - |
| E | Bounce animations must go | Done in run 115 (every spring removed, guard test over all screens); Live Photo part also covered by PR #96. | T142, T145 |
| F | Glaze Plus A$2.99 one-time | Done in run 115 (PLUS_PRICE A$2.99). | T142 |
| G | Go with "Prism" for the icon | New Prism app icon, splash and intro. Redrawn from the name: the owner's Prism image was not in the repo. | T148 |

Retest questions: docs/TRIAL.md "New since your last test (25 Oct evening, fb-1025)". Nothing here was tested on a device.
