# Owner brief owner-1101s (1 Nov 2026 19:05 Sydney)

Source: payload of a manual fire of the "Satchel build" task that arrived while run 107 held the lock; that run saved a copy to
`Desktop\Apps\satchel\_drops\content\OWNER_BRIEF_1101s.md` (sha256 d5ca88a3...ba3a2) and run 108 imported it. Tag owner-1101s; it outranks the backlog.

Jared tested the latest TestFlight build: "Satchel looks good"; he can't test the map yet; "when selecting a trip, the covers are ugly".
Agreed direction: Satchel is feature-complete enough. Stop adding new features after these five, then move to release prep.

1. **Trip covers (first)** — T152. (a) Own photo as a trip cover (expo-image-picker, copied into app storage, cropped to the cover aspect, shown in the trip hero and Trips list; Remove photo goes back to the illustrated cover). (b) Replace the flat shape scenes with properly illustrated original cover art generated through the Satchel OpenAI lanes / ChatGPT image generation (city, mountains, coast, old town, countryside, snow, desert, island, at least 8; original art only, no landmarks copied from artworks, no brands), bundled as optimised images (small total), keeping the auto-pick rules and day/night variants where sensible. The SVG scenes stay only as a fallback.
2. **Map** — T153 (+ T52). Finish so the offline city map actually renders in a TestFlight build, and tell Jared exactly how to test it.
3. **Money** — T16. Satchel Plus one-time purchase (guarded expo-iap adapter, Linework pattern; free core stays free); Workboard need for the App Store Connect IAP product with its exact product id.
4. **"Save to Satchel"** — T14. Share a booking email / PDF / text into a trip (uses the existing paste-booking parser).
5. **Backup** — T17. iCloud sync, or at minimum a full export/restore so changing phones never loses trips.

Then: TRIAL.md yes/no questions for 1-5 phrased for TestFlight, and ship to TestFlight as soon as each lands. After these, release prep only (screenshots, STORE.md, privacy, RELEASE_CHECKLIST).
