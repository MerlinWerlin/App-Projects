# Owner brief 25 Oct 2026, 21:29 Sydney (manual fire of the Couch build task)

Jared's own answers. Imported in run 88; they outrank the backlog. Do not ask him these again.

1. **Home TV: TCL C7K (Google TV).** Real-TV test: Couch said it was casting to his TV's name, iOS showed "sharing via AirPlay" and the queue filled as he added photos and videos, but nothing appeared on the TV.
   - Why: a Google TV has no DLNA renderer on the two ports Couch probes and is not a Roku, so Couch had no real way to reach it. The iPhone's AirPlay route only carries audio/video that the phone itself plays, and Couch does not play the queue on the phone, so choosing the TV in the AirPlay list sends nothing from the Cast tab. The UI still said "Casting".
   - Done in run 88:
     - **T105 (honest status):** a real TV gets 25 s to confirm it is showing an item. If it does not, the Cast tab shows "Not on <TV>: the TV took the request but never started showing it…", the slideshow stops so the queue stops "filling", and the delivery line stays for a screenshot. The queue row says "Sent, waiting for the TV" and the remote's pill says "Sent to the TV: …" until the TV confirms. Before that they claimed "On the TV now" and "Casting". A Roku now confirms through ECP `/query/media-player`, unverified.
     - **T106 (Cast route for Google TVs):** a pure-TypeScript Google Cast (CASTV2) client opens TLS on port 8009 of the saved TV, launches the TV's built-in Default Media Receiver and loads the phone's file URL. It reports PLAYING / PAUSED as confirmed and maps errors to plain messages. For a Google TV it is listed before DLNA. The TLS socket is new native code in `modules/lan-wss` (iOS Network.framework, Android SSLSocket; self-signed certificates are accepted only for RFC 1918 hosts). That needs a new TestFlight build, so the version goes 1.0.1 → 1.0.2. Until then the Cast tab says "Casting to <TV> needs the next Couch update…" instead of pretending. Nothing has been tried on a real TV; tests use fixtures. No Google Cast SDK and no new npm package.
   - TRIAL.md section "25 Oct late" has yes/no questions for it.
2. **Couch Plus = the paid app features only (screen cast + the remote extras). Themes are free. A$3.99 one-time.**
   - Recorded as: Plus = full screen mirroring (T93, later) + remote extras (widgets, Watch, Live Activity, macros).
   - Every remote button and photo/video casting from the Cast tab stay free under the standing hard rule. That rule says Couch Plus may only gate widgets, watch, themes and macros, and never a basic control. If Jared wants photo/video casting itself to be paid, that rule in the build task has to change first.
   - Nothing is sold in 1.0 (release standard 2, T100).
   - Workboard couch-plus-scope closed.
3. **Family Sharing: ON** for the Couch Plus in-app purchase. Recorded in docs/RELEASE_CHECKLIST.md and T100 for when the purchase is created in App Store Connect.
4. **Tip jar: removed (T107).** Plus screen rows, `src/plus/tipJar.ts`, `tip()` on the purchase seam and the tip copy in all 11 languages are gone. PLAN and MARKET are updated.
5. **Apple multicast entitlement:** no reply yet (requested 24 Oct). No change. The Google Cast route does not need it because it connects straight to the saved TV's address.
