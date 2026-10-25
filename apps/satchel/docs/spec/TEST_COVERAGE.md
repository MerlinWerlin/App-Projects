# TEST_CASES coverage (T42)

Maps every id in `docs/spec/TEST_CASES.md` (OpenAI lanes draft, 26 Oct 2026) to the `src/core` tests that cover it.
Statuses: **added** (new test in `src/core/testcases.test.ts`, named with the id), **covered-existing** (a test that was
already there), **UI-only** (needs a device, a screen or a native module; not testable in core; any core logic behind it
is named), **rejected** (the expected result contradicts the plan or a recorded decision; reason given).
Test names are quoted as they appear in `npm test`; the file is given as `file: name`.

Core bugs found and fixed by the added tests:
- `battery.ts normaliseLevel`: phones report a 32-bit float (20% = 0.20000000298), so "at or below the threshold" missed exactly 20% while the banner said 20%. Levels are now rounded to 4 decimals (TR-067).
- `trips.ts parseStoredTrips` (TR-021 load case): proposed fix (drop items with an unreadable zone) was rejected at integration because it silently deletes a user's item on the next save; done in T43: the item is kept, its row says "Time zone not recognised — edit to fix", and timeline sorting, clashes, Next up, tickets, hotel card and packing skip it (`timeline.ts zonesReadable`).
- `emergency.ts countryForZone`: old zone names in `tzzones.ts LEGACY_ZONES` (Asia/Katmandu, Asia/Rangoon, Asia/Ulan_Bator) gave no country guess. They now map like their current names (TR-055 lookup).

| id | area | status | test(s) / reason |
|---|---|---|---|
| TR-001 | First launch | UI-only | First-run seeding lives in `src/state/trips.tsx`; demo content is checked by the TR-002 tests. |
| TR-002 | Demo trip | covered-existing | timeline: 'groupByDay covers every trip date and files items by their own local date'; timeline: 'items sort by the real instant, not the wall clock' (demo Sydney → Tokyo → Kyoto) |
| TR-003 | Trips | covered-existing | trips: 'trip validation'; trips: 'list operations'; edgecases: 'saved data that was cut short or damaged is reported unreadable (null), never read as "no trips"' |
| TR-004 | Trips | added | 'TR-004: editing one trip and deleting another removes only that trip and its packing list' |
| TR-005 | Timeline | added | 'TR-005: one item of every kind saves with its kind and details' |
| TR-006 | Timeline | covered-existing | trips: 'draft round trip keeps the item' |
| TR-007 | Timeline | added | 'TR-007: an item with no optional details saves without placeholder fields' |
| TR-008 | Timeline | covered-existing | edgecases: 'killed mid-edit: editing a draft never touches the saved trip; the last committed version stays' |
| TR-009 | Timeline | UI-only | Discard dialog is UI; its check is edgecases: 'discard check: a form is "changed" only when a field differs from where it started'. |
| TR-010 | Timeline | UI-only | As TR-009; the saved item staying unchanged is the TR-008 test. |
| TR-011 | Timeline | covered-existing | edgecases: 'overlapping items are both kept and flagged; saving is not blocked'; timeline: 'clashing transport is flagged; hotel vs flight is not' |
| TR-012 | Timeline | added | 'TR-012: two items with a gap on the same local day sit under that day, in order, gap kept' |
| TR-013 | Next up | covered-existing | timeline: 'next up: before the trip, in the air, and between items'; edgecases: 'missing end time: start only, no invented end, left out of overlaps and never "now"' |
| TR-014 | Next up | covered-existing | edgecases: 'empty trip: every day is listed and empty, ready for a first item' (nextUp is null); timeline: 'next up: …' (null after the trip) |
| TR-015 | Time zones | added | 'TR-015 / TR-020: a Tokyo item reads the same whatever zone the phone is in' (phone zone set to Sydney, Los Angeles, Tokyo, UTC) |
| TR-016 | Time zones | covered-existing | tz: 'wall time in a zone maps to the right UTC instant' (fixtures incl. +5:30 and +5:45); tz: 'round-trips through fromUtc' |
| TR-017 | Time zones | added | 'TR-017: half-hour daylight saving (Lord Howe Island) gap and overlap'; 'TR-017: Europe (London 29 Mar gap, 25 Oct overlap) resolves like a clock'; 'TR-017 (midnight): a DST change at midnight (Santiago) skips 00:xx but keeps the item on its own date'; 'TR-017: a day that contains a DST change lasts 23 or 25 hours'. Already covered: tz: 'DST spring-forward gap …', 'DST fall-back overlap …', 'DST in the northern hemisphere …'; edgecases: 'DST: a skipped wall time is flagged …' |
| TR-018 | Time zones | added | 'TR-018: zones without daylight saving keep one offset all year' |
| TR-019 | Time zones | added | 'TR-019 (midnight): 00:00 starts its own day and 23:59 stays on the day before'; 'TR-019: "today" either side of the date line can differ by two calendar dates'; 'TR-019: a zone that jumped across the date line (Samoa skipped 30 Dec 2011) …'. Already covered: tz: 'cross-dateline: arrive "before" you leave, and a +1 / -1 day shift'; edgecases: 'crossing the date line backwards …', 'an overnight journey shows on its arrival day too …'; trips: 'item validation: arrival before departure is fine across the dateline, not otherwise' |
| TR-020 | Time zones | added | Core part: 'TR-015 / TR-020: …' (times are stored as wall clock + IANA zone and read the same under any phone zone). Changing the zone on a real phone stays a device check. |
| TR-021 | Time zones | added | 'TR-021: an unknown zone is refused by the form and never turned into an invented time'; load case (T43): 'TR-021 (load, T43): …' (3 tests: kept on load; listed on its stored date after timed items; Next up / tickets / hotel / packing skip it). Already covered: tz: 'dates' (isValidZone); trips: 'trip validation' (homeTz) |
| TR-022 | Flight mode | UI-only | Device check; all data is local by design. |
| TR-023 | Flight mode | UI-only | Device check. |
| TR-024 | Flight mode | UI-only | Map v0 copy; device check. |
| TR-025 | Flight mode | UI-only | Device check. |
| TR-026 | Flight mode | UI-only | Banner logic: network: 'no connection at all is offline', 'the banner shows only when offline is known'. |
| TR-027 | Flight mode | UI-only | Banner logic: network: 'connected is online, even when the internet is not reachable …'. |
| TR-028 | Flight mode | UI-only | Pins on the map are UI; pin scope logic is covered: poi: 'bookingPins: only places with coordinates, one per place per trip'; places: 'savedPins: one per saved place, with trip and sample flag'; places: 'scopeTrips: a Trip map shows one trip; …' |
| TR-029 | Map | covered-existing | poi: 'toggles start from default_on and filter the points' (filters return new arrays, input untouched) |
| TR-030 | Map | covered-existing | poi: 'OSM tags map to the Map v0 categories'; 'exclusions veto their category: a subway entrance is not a station'; 'higher priority wins when tags match two categories'; 'parsePoiCategories skips malformed rows and duplicates' |
| TR-031 | Map | UI-only | Single location check is in `src/native`; device check. |
| TR-032 | Map | UI-only | Device check. |
| TR-033 | Map | UI-only | Device check. |
| TR-034 | Map | UI-only | Permission states: permissions: 'denied is blocked unless the system will ask again (Android)'. |
| TR-035 | Map | UI-only | Empty-state screen is UI; core: poi: 'regionFor covers the points with padding and a minimum span' (no points → null region, map keeps its default). |
| TR-036 | Map | UI-only | No-results state is UI; core: poi: 'toggles start from default_on and filter the points' (empty result). |
| TR-037 | Permissions: location | UI-only | Reasons: permissions: 'every kind has a reason and heading for every state, and a fallback label'. |
| TR-038 | Permissions: location | UI-only | Logic: permissions: 'actions: blocked always offers Open Settings first, then retry and the fallback'; 'undetermined asks, unless the system says it will not'. |
| TR-039 | Permissions: location | UI-only | Logic: permissions: 'canProceed only for granted and limited'. |
| TR-040 | Permissions: Photos | UI-only | Logic: permissions: 'granted, limited and the photo access levels'. |
| TR-041 | Permissions: Files | UI-only | Picker cancel is handled in the screen; device check. |
| TR-042 | Permissions: Face ID | UI-only | Logic: permissions: 'Face ID failures map to states'; vault: 'lock: starts locked, …'. Note: the fallback is the decided 'Open without lock this time' only when the phone has no passcode (DECISIONS 2026-10-24 build run 2), not a general passcode fallback. |
| TR-043 | Permissions: contacts | UI-only | Manual entry: emergency: 'validate + clean: blank contacts dropped, half-filled ones flagged, strings trimmed'. |
| TR-044 | Permissions: recovery | UI-only | Device check. |
| TR-045 | Attachments | UI-only | File copy is native; core: tickets: 'makeAttachment fills a name and mime when the picker gives none'. |
| TR-046 | Attachments | UI-only | As TR-045. |
| TR-047 | Attachments | UI-only | Detection: tickets: 'mime and kind detection uses the picker type, falling back to the extension'. |
| TR-048 | Attachments | covered-existing | tickets: 'itemFiles lists one booking’s attachments and separate crops once' (files to delete); edgecases: 'list operations are pure, …' (removeItem). The file deletion itself is `src/native`. |
| TR-049 | Ticket | UI-only | Core: tickets: 'primary ticket prefers a QR crop, then a ticket, then a booking; …'. |
| TR-050 | Ticket | UI-only | Brightness is native. |
| TR-051 | Ticket | UI-only | Ergonomics; device check. |
| TR-052 | Ticket | UI-only | Core: tickets: 'primary ticket prefers a QR crop, …' (no crop → the ticket file itself). |
| TR-053 | Ticket | UI-only | Device check. |
| TR-054 | Emergency | UI-only | Navigation; device check. |
| TR-055 | Emergency | rejected (in part) / covered-existing / added | Rule covered: emergency: 'every bundled row: verify locally, numbers untouched, and source pending until a URL AND a date exist'; 'source: needs both an https URL and a real date; host shown without www'; 'whole table: a row shows a source only with an https URL AND an ISO checked date; …'. Added: 'TR-055 (lookup): old zone names some phones still report find the same country' (bug fixed); 'TR-055 / TR-056 (lookup): a looked-up country always says verify locally …'. **Rejected in part:** "numbers show their source and checked date" can't be true today: no bundled row has a checked date, so every row shows "verify locally · source pending" (DECISIONS 2026-10-25 T25; the same claim was rejected for store copy in T20). Numbers in `src/content/emergency_numbers.json` were not changed. |
| TR-056 | Emergency | covered-existing | emergency: 'doubted numbers: line flagged, number unchanged; …'; 'whole table: the 62 GUARD-flagged rows show doubts on exactly their flagged fields, numbers untouched'; 'row with no confirmed number shows the no-number state, not a guess' |
| TR-057 | Emergency | covered-existing | Core part: emergency: 'normalise: tolerates junk and partial stored shapes'; 'validate + clean: …'. Save/reopen on the phone is a device check. |
| TR-058 | Emergency | UI-only | Cancel is the screen's; `sameCard` drives the discard check (emergency.ts). |
| TR-059 | Hotel address | UI-only | Core: trips: 'draft round trip keeps the item' (localAddress kept). |
| TR-060 | Hotel address | UI-only | Clipboard is native. |
| TR-061 | Document vault | covered-existing | Core part: vault: 'expiry status: expired, soon (<= 90 days, incl. today), ok, none'; 'cleanDocs repairs or drops whatever storage returned'. |
| TR-062 | Document vault | UI-only | Logic: vault: 'lock: starts locked, unlocks, Lock and leaving the vault relock'. |
| TR-063 | Document vault | UI-only | Logic: vault: 'lock: background / active while locked change nothing; …'; permissions: 'Face ID failures map to states'. |
| TR-064 | Document vault | covered-existing | vault: 'expiry status: expired, soon (<= 90 days, incl. today), ok, none'; 'expiry status counts calendar days across a DST change'; 'passport 6-month reminder against each upcoming trip end date' |
| TR-065 | Document vault | UI-only | As TR-042. |
| TR-066 | Low battery | UI-only | Logic: battery: 'banner: manual switch wins, offer only in an undismissed low episode, nothing when unknown'. No battery-life claim exists in core. |
| TR-067 | Low battery | added | 'TR-067: at exactly the threshold the offer shows, even with the float noise phones report' (bug fixed). Documented rule is "at or below the threshold" (EDGE_CASES 'Battery crosses the configured threshold', battery.ts); already covered: battery: 'low means at or below the threshold and not charging'. |
| TR-068 | Low battery | UI-only | Logic: battery: 'next ticket: …', 'hotel: the stay you are in now, else the next one; address presence reported'. |
| TR-069 | Low battery | UI-only | Logic: battery: 'next ticket: something happening now counts as now; finished and point-in-time past items do not' (null when nothing). |
| TR-070 | Low battery | UI-only | Screen content; device check. |
| TR-071 | Low battery | UI-only | Logic: battery: 'banner: manual switch wins, …'; 'automatic episodes never change the manual preference'. |
| TR-072 | Low battery | added | 'TR-072: turning the manual switch off is stored and read back off, threshold kept'. Already: battery: 'stored prefs are normalised'. |
| TR-073 | Low battery | added | 'TR-073: threshold clamps to 5%..50% with both endpoints allowed'. Already: battery: 'threshold defaults to 20% and is clamped to a sensible range'; settings: 'stepper limits at each end'. |
| TR-074 | Low battery | covered-existing | battery: 'a low episode starts fresh, survives jitter around the threshold and ends on recovery or charging'; 'dismissing outside a low episode does nothing' |
| TR-075 | Packing | added | 'TR-075: a list from a template keeps its ticks through a save and reload'. Already: packing: 'builds a list from one template: …'; 'toggle, add, remove, rename and reset are immutable'. |
| TR-076 | Packing | covered-existing | packing: 'adding a template to an existing list keeps ticks and renames, skips duplicates and avoids id clashes'; 'adding a template already on the list adds nothing; …' |
| TR-077 | Appearance | UI-only | Logic: settings: 'appearance: System follows the phone, Light and Dark override it'. |
| TR-078 | Appearance | UI-only | As TR-077; contrast is a device/design check. |
| TR-079 | Appearance | UI-only | Logic: demoExtras: 'system appearance follows the setting; System hands it back to the phone'. |
| TR-080 | Appearance | UI-only | Device check. |
| TR-081 | Large text | UI-only | Device check. |
| TR-082 | Large text | UI-only | Device check. |
| TR-083 | Large text | UI-only | Device check. |
| TR-084 | Large text | UI-only | Device check. |
| TR-085 | VoiceOver | UI-only | Device check. |
| TR-086 | VoiceOver | UI-only | Device check. |
| TR-087 | VoiceOver | UI-only | Device check. |
| TR-088 | VoiceOver | UI-only | Device check. |
| TR-089 | VoiceOver | UI-only | Device check. |
| TR-090 | VoiceOver | UI-only | Device check. |
| TR-091 | Accessibility | UI-only | Static check in `ops/ui-check.mjs` (labels, 48 pt targets), not `src/core`. |
| TR-092 | Accessibility | UI-only | Device check. |
| TR-093 | Persistence | UI-only | Device check; parsing is the TR-094 test. |
| TR-094 | Persistence | covered-existing | edgecases: 'saved data that was cut short or damaged is reported unreadable (null), never read as "no trips"'; 'one damaged trip or item is dropped without losing the rest'; trips: 'recovered trips are added back without overwriting trips on the phone' |
| TR-095 | Save errors | UI-only | The failed-write path is `src/state/trips.tsx` (commit resolves false); core part: edgecases: 'list operations are pure, so a failed write cannot leave a half-applied list in memory'. |
| TR-096 | Empty states | UI-only | Copy is UI; core: edgecases: 'empty trip: every day is listed and empty, ready for a first item'. |
| TR-097 | Privacy | UI-only | Settings screen; `src/release.test.ts` checks the privacy manifest. |
| TR-098 | Settings | UI-only | Logic: settings: 'stored prefs from older builds gain the appearance default; junk is replaced'. |
| TR-099 | Settings | UI-only | Logic: languageHint: 'a saved shipped language wins over the phone'; 'system follows the first shipped phone language, else English'. |
| TR-100 | Startup | UI-only | Splash; device check. |

Totals (100 ids): added 14, covered-existing 18, UI-only 67, rejected in part 1 (TR-055, which also has added and existing tests). 21 tests added in `src/core/testcases.test.ts`.
