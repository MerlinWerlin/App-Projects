| # | id | area | steps | expected result | automatable | priority |
|---:|---|---|---|---|---|---|
| 1 | TR-001 | First launch | Install fresh; open Satchel. | Welcome and demo trip appear; no account or network sign-in is requested. | yes | P1 |
| 2 | TR-002 | Demo trip | Open the demo trip. | Sydney, Tokyo and Kyoto appear in the timeline with sample items. | yes | P1 |
| 3 | TR-003 | Trips | Create a trip with a name and dates; save and reopen it. | Trip details persist locally and appear in the trips list. | yes | P1 |
| 4 | TR-004 | Trips | Create two trips; edit one name; delete the other. | The edit persists; only the selected trip and its associated packing list are removed. | yes | P1 |
| 5 | TR-005 | Timeline | Add one item of each supported kind: flight, train, ferry, bus, hotel, car hire, activity and note. | Each item saves and appears with the correct kind and details. | yes | P1 |
| 6 | TR-006 | Timeline | Add an item with a start and end time; reopen it. | Saved date and time match the values entered. | yes | P1 |
| 7 | TR-007 | Timeline | Add an item with no optional details. | Item saves without blank or misleading placeholder details. | yes | P2 |
| 8 | TR-008 | Timeline | Edit an item, then cancel without saving. | Original item remains unchanged. | yes | P2 |
| 9 | TR-009 | Timeline | Start editing an item; dismiss the form with unsaved changes. | A discard confirmation appears; choosing to keep editing preserves the form. | no | P1 |
| 10 | TR-010 | Timeline | Start editing an item; dismiss and confirm discard. | Unsaved changes are discarded; saved item remains unchanged. | no | P1 |
| 11 | TR-011 | Timeline | Add two items that overlap in time. | Overlap is handled consistently and does not hide or corrupt either item. | yes | P2 |
| 12 | TR-012 | Timeline | Add items with a gap between them on the same local day. | Timeline groups both items under the correct day and preserves the gap. | yes | P2 |
| 13 | TR-013 | Next up | Add past, current and future items; open the trip. | Next up selects the appropriate upcoming item and does not select a past item. | yes | P1 |
| 14 | TR-014 | Next up | Create a trip with no upcoming items. | Next up shows an appropriate empty state rather than stale content. | yes | P2 |
| 15 | TR-015 | Time zones | Add an item in Tokyo time while the device uses Sydney time. | Item displays the correct Tokyo local time and date. | yes | P1 |
| 16 | TR-016 | Time zones | Add an item in a zone with a different UTC offset; compare with a trusted test fixture. | Local-time conversion is correct without a network connection. | yes | P1 |
| 17 | TR-017 | Time zones | Add an item near a daylight-saving transition in a zone that observes it. | The selected local time resolves correctly for that date and zone. | yes | P1 |
| 18 | TR-018 | Time zones | Add an item in a zone that does not observe daylight saving. | No daylight-saving adjustment is applied incorrectly. | yes | P1 |
| 19 | TR-019 | Time zones | Add a flight crossing the international date line; inspect departure and arrival. | Each endpoint shows the correct local date and time in its own zone. | yes | P1 |
| 20 | TR-020 | Time zones | Change the device time zone after saving an item. | Item retains its intended IANA zone and displays the correct local time. | no | P1 |
| 21 | TR-021 | Time zones | Enter an invalid or unavailable time-zone identifier in a core test. | Core validation handles it safely; app does not crash or silently invent a time. | yes | P2 |
| 22 | TR-022 | Flight mode | Save a trip and ticket; enable flight mode; open the trip and ticket. | Saved trip details and ticket remain available without a connection. | no | P1 |
| 23 | TR-023 | Flight mode | With flight mode on, navigate between Trips, Wallet and Emergency. | Local screens remain usable; no network-required blocking screen appears. | no | P1 |
| 24 | TR-024 | Flight mode | With flight mode on, open the map. | Map v0 communicates that its system map may need a connection; Satchel does not claim map tiles are available offline. | no | P1 |
| 25 | TR-025 | Flight mode | With flight mode on, open saved ticket attachments and emergency details. | Locally stored content remains accessible. | no | P1 |
| 26 | TR-026 | Flight mode | Enable flight mode while Satchel is open. | Offline banner updates to reflect the device’s offline state. | no | P1 |
| 27 | TR-027 | Flight mode | Disable flight mode while Satchel is open. | Offline banner updates when connectivity returns; local content remains intact. | no | P2 |
| 28 | TR-028 | Flight mode | Save a place and booking pin; inspect the trip map with a connection. | Saved place and booking pins appear in the correct trip map scope. | no | P2 |
| 29 | TR-029 | Map | Toggle each bundled demo POI category on and off. | Pins match the selected categories; changing filters does not alter saved data. | yes | P2 |
| 30 | TR-030 | Map | Use a core test to map supported OSM tags to POI categories. | Supported tags map to the intended category; unknown tags are safely ignored. | yes | P2 |
| 31 | TR-031 | Map | Tap “Where am I?” with location access granted. | Satchel requests one location fix and shows the result; it does not start background tracking. | no | P1 |
| 32 | TR-032 | Map | Tap “Where am I?” again after the first check completes. | A new check occurs only after the user requests it. | no | P2 |
| 33 | TR-033 | Map | Leave the map screen after requesting a location fix. | Location is not watched or updated in the background. | no | P1 |
| 34 | TR-034 | Map | Open map with location access denied. | Map remains usable without the user’s location and offers the permission notice and fallback. | no | P1 |
| 35 | TR-035 | Map | Open map with no saved places or demo pins available. | A clear empty state appears; map controls remain usable. | yes | P2 |
| 36 | TR-036 | Map | Toggle a POI category that has no results in the visible area. | No-results state is clear; app remains responsive. | yes | P3 |
| 37 | TR-037 | Permissions: location | On a fresh install, tap “Where am I?” and deny location access. | Satchel explains why access is requested and shows a useful fallback. | no | P1 |
| 38 | TR-038 | Permissions: location | Deny location access, then request location again. | Satchel does not repeatedly prompt when the OS will not show the prompt; it offers Open Settings where appropriate. | no | P1 |
| 39 | TR-039 | Permissions: location | Open Settings from the location permission notice; return without granting access. | Satchel remains usable and does not show a false granted state. | no | P1 |
| 40 | TR-040 | Permissions: Photos | Deny Photos access when attaching an image. | A plain permission notice and available fallback are shown; app does not crash. | no | P1 |
| 41 | TR-041 | Permissions: Files | Cancel the Files picker without selecting a file. | Attachment form remains safe; no empty or broken attachment is created. | no | P1 |
| 42 | TR-042 | Permissions: Face ID | Deny or fail local authentication when opening the vault. | Vault remains locked; the app explains the result and offers the supported passcode fallback if available. | no | P1 |
| 43 | TR-043 | Permissions: contacts | Deny contacts access when adding an emergency contact. | Manual entry remains available; no contact details are added without consent. | no | P1 |
| 44 | TR-044 | Permissions: recovery | Grant a previously denied permission in iOS Settings; return to Satchel and retry. | Satchel recognises the updated permission state and the feature works. | no | P2 |
| 45 | TR-045 | Attachments | Attach a PDF from Files to a trip item. | File is stored locally and can be reopened from the item. | no | P1 |
| 46 | TR-046 | Attachments | Attach an image from Photos to a trip item. | Image is stored locally and can be reopened from the item. | no | P1 |
| 47 | TR-047 | Attachments | Select an unsupported or unreadable file. | Satchel shows a useful error; item and existing files remain intact. | no | P2 |
| 48 | TR-048 | Attachments | Delete an item that has an attachment; inspect the item and local storage through a test seam. | Item is removed and its associated attachment file is cleaned up. | yes | P2 |
| 49 | TR-049 | Ticket | Open a saved ticket. | Ticket opens full screen with its saved details and QR crop. | no | P1 |
| 50 | TR-050 | Ticket | Open ticket, note screen brightness, then exit. | Brightness is raised for the ticket view and restored on exit. | no | P1 |
| 51 | TR-051 | Ticket | Open a ticket and use the main controls with one hand. | Important ticket actions are reachable without awkward two-handed interaction. | no | P2 |
| 52 | TR-052 | Ticket | Open ticket with no QR crop saved. | Ticket remains readable and does not show a broken image. | no | P2 |
| 53 | TR-053 | Ticket | Open a ticket while the phone is in flight mode. | Ticket content remains available; no connection is required. | no | P1 |
| 54 | TR-054 | Emergency | Open Emergency from Home. | Emergency card is reachable in one tap. | no | P1 |
| 55 | TR-055 | Emergency | Open a country card with sourced emergency numbers. | Numbers show their source and checked date, with “verify locally” guidance. | yes | P1 |
| 56 | TR-056 | Emergency | Open a card for a number marked as needing verification. | Uncertain number is clearly flagged with “check locally” guidance; it is not presented as confirmed. | yes | P1 |
| 57 | TR-057 | Emergency | Add insurance details, a contact and private medical notes; save and reopen. | Details persist locally and display in the correct fields. | no | P1 |
| 58 | TR-058 | Emergency | Edit emergency details, then cancel changes. | Saved details remain unchanged. | no | P2 |
| 59 | TR-059 | Hotel address | Add a hotel address and local-language address; open the address card. | Both address fields display clearly; the main address is prominent. | no | P1 |
| 60 | TR-060 | Hotel address | Tap “Copy address”; paste into a local text field. | The intended address is copied and pasted correctly. | no | P2 |
| 61 | TR-061 | Document vault | Add a passport document and expiry date; reopen the vault. | Document details persist locally and expiry warning state is correct. | no | P1 |
| 62 | TR-062 | Document vault | Open a locked vault and authenticate successfully. | Vault contents appear only after successful authentication. | no | P1 |
| 63 | TR-063 | Document vault | Fail or cancel authentication when opening the vault. | Vault contents remain hidden and the app remains usable. | no | P1 |
| 64 | TR-064 | Document vault | Add documents with expired, soon-to-expire and distant expiry dates in core tests. | Expiry rules assign the correct warning state for each date. | yes | P1 |
| 65 | TR-065 | Document vault | Deny authentication permission or make authentication unavailable. | Satchel communicates the lock state and fallback behaviour without exposing documents. | no | P1 |
| 66 | TR-066 | Low battery | Set device battery below 20% with essentials mode off. | Satchel offers essentials mode without claiming a battery-life amount. | no | P1 |
| 67 | TR-067 | Low battery | Set battery to exactly 20%. | Threshold behaviour matches the documented rule and does not trigger below-20% logic incorrectly. | yes | P2 |
| 68 | TR-068 | Low battery | Set battery below 20%; enter essentials mode. | Plain dark screen shows the next ticket, hotel address and emergency card when available. | no | P1 |
| 69 | TR-069 | Low battery | Enter essentials mode with no next ticket or hotel address. | Available emergency information remains accessible; missing sections do not show broken content. | no | P1 |
| 70 | TR-070 | Low battery | Enter essentials mode and inspect animation and map access. | Screen has no animation and no map; essential actions remain available. | no | P1 |
| 71 | TR-071 | Low battery | Turn essentials mode on manually in Settings. | Essentials mode opens or becomes active regardless of current battery level. | no | P1 |
| 72 | TR-072 | Low battery | Turn manual essentials mode off in Settings. | Manual override is cleared and the selected preference persists after relaunch. | yes | P2 |
| 73 | TR-073 | Low battery | Set threshold below 5, then above 50 in core tests; test the endpoints. | Threshold is clamped to 5–50%, inclusive. | yes | P2 |
| 74 | TR-074 | Low battery | Dismiss the low-battery offer; change battery state and reopen the app. | Dismissal follows the documented behaviour; manual entry remains available. | no | P2 |
| 75 | TR-075 | Packing | Create a packing list from a trip-type template; mark and unmark items. | Template items appear; checked state updates and persists. | yes | P2 |
| 76 | TR-076 | Packing | Add a template to an existing packing list. | New template items are added without deleting existing entries. | yes | P2 |
| 77 | TR-077 | Appearance | Set Appearance to Light; inspect Trips, map, forms and system-facing controls. | Light palette is legible and consistent across supported screens. | no | P2 |
| 78 | TR-078 | Appearance | Set Appearance to Dark; inspect Trips, map, forms and system-facing controls. | Dark palette is legible and text and controls retain sufficient contrast. | no | P1 |
| 79 | TR-079 | Appearance | Set Appearance to System; change the iOS appearance and return to Satchel. | Satchel follows the system appearance. | no | P2 |
| 80 | TR-080 | Appearance | Change appearance while a form is open. | Form remains readable and entered data is preserved. | no | P2 |
| 81 | TR-081 | Large text | Enable a large iOS text size; inspect Trips list and trip timeline. | Text scales without clipping key details or hiding actions. | no | P1 |
| 82 | TR-082 | Large text | Enable a large text size; inspect item forms and validation errors. | Labels, fields and errors remain readable and reachable. | no | P1 |
| 83 | TR-083 | Large text | Enable a large text size; inspect ticket and hotel address card. | Essential details remain visible; content can scroll where needed. | no | P1 |
| 84 | TR-084 | Large text | Enable a large text size; inspect Emergency and essentials screens. | Important information remains legible and actions remain accessible. | no | P1 |
| 85 | TR-085 | VoiceOver | Turn on VoiceOver; navigate Trips, Wallet, Map and Emergency tabs. | Each tab has a clear, meaningful accessible label and selected state. | no | P1 |
| 86 | TR-086 | VoiceOver | Navigate a trip timeline and focus Next up and an item. | VoiceOver announces useful item details and a sensible reading order. | no | P1 |
| 87 | TR-087 | VoiceOver | Navigate item forms, controls and validation messages. | Fields and buttons have labels; errors are announced and linked to the relevant field. | no | P1 |
| 88 | TR-088 | VoiceOver | Navigate the map controls and “Where am I?” action. | Controls have clear labels and state; the location action can be reached and activated. | no | P1 |
| 89 | TR-089 | VoiceOver | Navigate ticket, Emergency and hotel address screens. | Key details and actions are announced in a useful order; QR content has an appropriate description or fallback. | no | P1 |
| 90 | TR-090 | VoiceOver | Navigate essentials mode and dismiss or open a card. | Essential content and controls are accessible without relying on animation or colour alone. | no | P1 |
| 91 | TR-091 | Accessibility | Inspect interactive controls with an accessibility-size test or device audit. | Primary touch targets are at least 48 pt where practical and have clear labels. | yes | P2 |
| 92 | TR-092 | Accessibility | Enable Reduce Motion; navigate screens and open essentials mode. | Non-essential motion is reduced or removed; content and actions still work. | no | P2 |
| 93 | TR-093 | Persistence | Save trip, emergency and packing data; force-quit and relaunch. | Local data persists and the app returns without requiring a connection. | no | P1 |
| 94 | TR-094 | Persistence | Simulate unreadable saved trip data through a test seam; open Trips. | A clear trips-load error appears; the app does not crash. | yes | P1 |
| 95 | TR-095 | Save errors | Simulate a local save failure while saving a trip or item. | A clear save error appears and the form stays open with entered data intact. | yes | P1 |
| 96 | TR-096 | Empty states | Open a fresh trip with no items, places or packing entries. | Each empty state explains the next useful action without implying missing network data. | yes | P2 |
| 97 | TR-097 | Privacy | Open privacy information in Settings. | “Data Not Collected” is shown accurately; no account, tracking or ad controls are implied. | no | P2 |
| 98 | TR-098 | Settings | Change haptics preference; activate a supported control. | Haptics follow the selected setting and do not affect control functionality. | no | P3 |
| 99 | TR-099 | Settings | Change language using the available language picker; reopen a core screen. | Selected language is applied; missing or invalid selection falls back safely. | no | P2 |
| 100 | TR-100 | Startup | Cold-launch the app with a slow device start; observe the splash-to-screen transition. | No blank or white flash appears; first screen is shown when app state is ready. | no | P2 |
