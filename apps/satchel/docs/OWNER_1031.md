# Owner feedback 31 Oct 2026 (tag owner-1031)

From Jared, 31 Oct 2026 08:06 Sydney, after trying TestFlight build 3. These outrank the backlog.

"Logo is good; app works and all tabs work" — but "this is meant to be the full build, we're in TestFlight ... step up"; "it feels bland ... we can do better ... start expanding upon this now".

| Task | Ask |
|---|---|
| T47 (A) | **Map really works in TestFlight.** Real map rendering, at least one offline city map that actually downloads and renders, online map while connected. Map files hosted free as Release assets on the public GitHub repo MerlinWerlin/App-Projects (no accounts, no card), OSM ODbL attribution and the tile licence respected. Remove every "comes with the full build" / "later build" placeholder. |
| T48 (B) | **No blank emergency numbers.** Every country shows police / ambulance / fire (and 112 where it works), each with a source and date, "verify locally" kept. If genuinely unknown: 112 guidance and nearest-embassy advice. Test fails if any country has no number. |
| T49 (C) | **Toilet finder.** Nearest public toilets from OpenStreetMap (amenity=toilets; fee, wheelchair, changing table, opening hours where tagged); offline inside downloaded cities, online elsewhere; distance + walking direction; open in Apple Maps. Free, no account. |
| T50 (D) | **Less bland.** Real design pass (richer travel look, light and dark, colour, hero cards, icons, better type, nothing flat grey) and deeper tabs with features travellers love (no competitor names). Smooth timed transitions, no bounce or springs. |
| T51 (E) | docs/TRIAL.md "New since your last test": yes/no questions for A–D, phrased for TestFlight. |

Testing is TestFlight only. Never point the owner at Expo Go.
