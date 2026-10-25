| # | id | area | steps | expected result | automatable | priority |
|---:|---|---|---|---|---|---|
| 1 | TR-001 | Launch | Install and open the app on a fresh device. | App opens without an account or sign-in prompt. | yes | P1 |
| 2 | TR-002 | Demo trip | Open the trips list on first launch. | The Sydney → Tokyo → Kyoto demo trip is available to explore. | yes | P1 |
| 3 | TR-003 | Trips | Create a trip with a name and dates, then save. | The trip appears in the trips list with the entered details. | yes | P1 |
| 4 | TR-004 | Trips | Open a trip, edit its name or dates, and save. | The updated details appear wherever the trip is shown. | yes | P1 |
| 5 | TR-005 | Trips | Delete a trip and confirm the action. | The trip and its associated items are removed; other trips remain. | yes | P1 |
| 6 | TR-006 | Trips | Start deleting a trip, then cancel confirmation. | The trip and its data remain unchanged. | yes | P2 |
| 7 | TR-007 | Timeline | Open a trip with items on multiple days. | Items are grouped under the correct trip days. | yes | P1 |
| 8 | TR-008 | Timeline | Add a note to a trip day and reopen the trip. | The note is saved and shown on the selected day. | yes | P2 |
| 9 | TR-009 | Timeline | Open a trip with a future item and an earlier item. | “Next up” shows the nearest upcoming item, not a past item. | yes | P1 |
| 10 | TR-010 | Timeline | Open a trip with no upcoming items. | “Next up” shows a clear empty state rather than an unrelated item. | yes | P2 |
| 11 | TR-011 | Items | Add one item of each supported kind: flight, train, ferry, bus, hotel, car hire, activity and note. | Each item saves with its selected kind and appears on the timeline. | yes | P1 |
| 12 | TR-012 | Items | Add an item with a title and start time; leave optional fields blank. | The item saves, and missing optional details do not cause an error. | yes | P1 |
| 13 | TR-013 | Items | Edit an item, save, then reopen it. | The changed fields persist and the item remains on the correct trip. | yes | P1 |
| 14 | TR-014 | Items | Delete an item and confirm. | The item disappears from the timeline and “Next up” if applicable. | yes | P2 |
| 15 | TR-015 | Time zones | Create an item with an IANA time zone different from the device zone. | The item displays its local time in the item’s selected zone. | yes | P1 |
| 16 | TR-016 | Time zones | Create two items at the same instant in different IANA zones. | Each item shows the correct local time for its own zone. | yes | P1 |
| 17 | TR-017 | Time zones | Enter a time near midnight in the item’s zone. | The item is grouped under the correct local calendar day. | yes | P1 |
| 18 | TR-018 | Time zones | Add an item across a daylight-saving clock change in a zone that observes it. | The displayed local time and offset follow that zone’s rules. | yes | P1 |
| 19 | TR-019 | Time zones | Change the device time zone, then reopen an item with a saved IANA zone. | The item remains correct for its saved zone; it is not silently reassigned to the device zone. | yes | P1 |
| 20 | TR-020 | Time zones | Set an item’s zone to a valid IANA zone and restart the app. | The zone and correct local time persist offline. | yes | P1 |
| 21 | TR-021 | Time zones | Try to save an item with a missing or invalid time zone. | The app prevents an invalid save or provides a clear correction; it does not crash. | yes | P2 |
| 22 | TR-022 | Flight mode | Save a trip and ticket, enable flight mode, then open both. | Saved trip and ticket details remain accessible without a network connection. | no | P1 |
| 23 | TR-023 | Flight mode | In flight mode, add a note and edit an existing item. | Changes save locally and remain after closing and reopening the app. | no | P1 |
| 24 | TR-024 | Flight mode | In flight mode, open the map tab. | The app handles unavailable map data clearly; it does not imply that the Trial map is offline. | no | P1 |
| 25 | TR-025 | Flight mode | In flight mode, open the emergency card and hotel address card. | Previously saved local details are visible without a network connection. | no | P1 |
| 26 | TR-026 | Flight mode | In flight mode, attempt an action that requires online map tiles. | The app shows a useful unavailable state and does not freeze or crash. | no | P2 |
| 27 | TR-027 | Storage | Save trip data, force-close the app, then relaunch. | Locally saved data is still present. | no | P1 |
| 28 | TR-028 | Attachments | Attach a PDF from Files to a trip item. | The PDF is attached and can be opened from the item. | no | P1 |
| 29 | TR-029 | Attachments | Attach an image from Photos to a trip item. | The image is attached and can be viewed from the item. | no | P1 |
| 30 | TR-030 | Attachments | Try to attach a file type the app cannot preview. | The app handles the file safely and explains if it cannot display it. | no | P2 |
| 31 | TR-031 | Attachments | Remove an attachment from an item and reopen the item. | The removed attachment is no longer listed or accessible from that item. | no | P2 |
| 32 | TR-032 | Ticket | Open a saved ticket. | Ticket details are readable in a focused, full-screen view. | no | P1 |
| 33 | TR-033 | Ticket | Open a ticket with a saved QR crop. | The saved QR crop appears clearly and is not obscured by controls. | no | P1 |
| 34 | TR-034 | Ticket | Open a ticket and check screen brightness; close the ticket. | Brightness increases for the ticket view and returns to its prior level on exit. | no | P1 |
| 35 | TR-035 | Ticket | Use the ticket screen with one hand on a supported device. | Main ticket actions are reachable and usable without awkward two-handed interaction. | no | P2 |
| 36 | TR-036 | Ticket | Open a ticket with no QR crop. | The ticket remains usable and the missing QR is not shown as a broken image. | yes | P2 |
| 37 | TR-037 | Emergency card | Open Emergency from Home. | The emergency card is reachable in one tap from Home. | no | P1 |
| 38 | TR-038 | Emergency card | Open the card for a country with a bundled emergency number entry. | The number, source and date are shown with a “verify locally” reminder. | yes | P1 |
| 39 | TR-039 | Emergency card | Open the card for a country without a bundled entry. | The app does not invent a number and clearly indicates that local details need checking. | yes | P1 |
| 40 | TR-040 | Emergency card | Enter an insurance policy number and phone number; save and reopen. | The details persist locally and display correctly. | no | P1 |
| 41 | TR-041 | Emergency card | Add an emergency contact manually and reopen the card. | The contact appears with the entered details. | no | P2 |
| 42 | TR-042 | Emergency card | Add private medical notes, save, and reopen the card. | Notes persist locally and are not exposed on unrelated screens. | no | P1 |
| 43 | TR-043 | Hotel card | Add a hotel address and local-language address to an item. | Both address fields save and display on the hotel address card. | yes | P1 |
| 44 | TR-044 | Hotel card | Open the hotel address card and view it at arm’s length. | The main address is large and legible for sharing with a driver. | no | P1 |
| 45 | TR-045 | Document vault | Add passport details with an expiry date. | The document entry saves and shows the correct expiry information. | no | P1 |
| 46 | TR-046 | Document vault | Add visa and licence entries with expiry dates. | Each entry saves with its correct document type and expiry date. | no | P2 |
| 47 | TR-047 | Document vault | Open the locked vault and authenticate successfully. | The vault opens and its contents are visible. | no | P1 |
| 48 | TR-048 | Document vault | Attempt to open the locked vault and fail or cancel authentication. | The vault contents remain hidden and the app stays usable. | no | P1 |
| 49 | TR-049 | Document vault | Open the vault on a device where local authentication is unavailable or not set up. | The app handles the condition safely and does not expose protected content without an appropriate fallback. | no | P1 |
| 50 | TR-050 | Document vault | Open a document with an expiry date in the past. | The app identifies the document as expired. | yes | P2 |
| 51 | TR-051 | Document vault | Open a document nearing its expiry date. | The app shows an expiry warning according to the configured warning rule. | yes | P2 |
| 52 | TR-052 | Low-battery mode | Set device battery below 20% and open Satchel. | Essentials mode is offered or activated according to the product’s threshold behaviour. | no | P1 |
| 53 | TR-053 | Low-battery mode | Set battery to exactly 20% and open Satchel. | Threshold behaviour is consistent and matches the defined rule; no ambiguous repeated prompting occurs. | no | P2 |
| 54 | TR-054 | Low-battery mode | Set battery above 20%, then turn on the manual essentials switch. | Essentials mode activates even when battery is above the threshold. | no | P1 |
| 55 | TR-055 | Low-battery mode | Turn on manual essentials mode, close and reopen the app. | The manual setting behaves consistently with the chosen persistence rule. | no | P2 |
| 56 | TR-056 | Low-battery mode | View essentials mode with a saved next ticket, hotel and emergency details. | The plain dark screen provides the next ticket, hotel address and emergency card. | no | P1 |
| 57 | TR-057 | Low-battery mode | View essentials mode and inspect movement or map controls. | No animation or map is shown in essentials mode. | no | P1 |
| 58 | TR-058 | Low-battery mode | View essentials mode with one or more details missing. | Available essentials remain usable and missing details do not cause a crash or misleading content. | no | P1 |
| 59 | TR-059 | Low-battery mode | Exit essentials mode using its available control. | The app returns to its normal interface without losing saved data. | no | P2 |
| 60 | TR-060 | Packing lists | Create a packing list for a trip. | A list is created and associated with the selected trip. | yes | P1 |
| 61 | TR-061 | Packing lists | Choose a trip-type template when creating a packing list. | The list includes the items from the selected template. | yes | P2 |
| 62 | TR-062 | Packing lists | Add a custom packing item and mark it packed. | The item is saved and its packed state is visible. | yes | P1 |
| 63 | TR-063 | Packing lists | Reopen a trip’s packing list after app restart. | Items and packed states persist. | no | P1 |
| 64 | TR-064 | Map | Open the map tab with a working connection. | The Trial map loads using available system map data. | no | P1 |
| 65 | TR-065 | Map | Open the demo city map and inspect bundled demo points. | Demo points appear at their expected positions. | no | P1 |
| 66 | TR-066 | Map | Add a saved place and return to the map. | The saved place appears as a map pin. | no | P1 |
| 67 | TR-067 | Map | Open a map pin for a booking or saved place. | The pin shows the correct associated place or booking details. | no | P2 |
| 68 | TR-068 | Map | Toggle each available POI category on and off. | Pins for the selected category appear or disappear as expected. | no | P1 |
| 69 | TR-069 | Map | Open the map with location permission allowed and tap “Where am I?”. | A single location check is made and the current position is shown when available. | no | P1 |
| 70 | TR-070 | Map | Tap “Where am I?” with location services disabled. | The app explains that location is unavailable and remains usable. | no | P1 |
| 71 | TR-071 | Permissions | Deny location permission when prompted, then tap “Where am I?”. | The app does not crash, does not show a fabricated position and explains the limitation. | no | P1 |
| 72 | TR-072 | Permissions | Deny location permission, then open trips, tickets and emergency card. | These features remain usable without location permission. | no | P1 |
| 73 | TR-073 | Permissions | Deny photo access and try to attach an image. | The app explains that access is needed and offers a safe way to continue or change permission. | no | P1 |
| 74 | TR-074 | Permissions | Deny file access or cancel the file picker. | The attachment flow closes safely and existing trip data remains unchanged. | no | P2 |
| 75 | TR-075 | Permissions | Deny contact access when adding an emergency contact. | The app allows manual entry or clearly explains the permission limitation. | no | P2 |
| 76 | TR-076 | Permissions | Deny local authentication when opening the vault. | Protected documents remain locked; denial does not crash the app. | no | P1 |
| 77 | TR-077 | Dark mode | Enable system dark appearance and open Home, trips and timeline. | Screens use the dark palette with readable text and controls. | no | P1 |
| 78 | TR-078 | Dark mode | In dark appearance, open ticket, emergency card and hotel address card. | Important information remains legible and has sufficient contrast. | no | P1 |
| 79 | TR-079 | Dark mode | Switch from light to dark appearance while the app is open. | The interface updates without requiring data loss or an app restart. | no | P2 |
| 80 | TR-080 | Large text | Increase system text size and open trips and timeline. | Text grows where supported; key content remains readable and is not clipped. | no | P1 |
| 81 | TR-081 | Large text | At the largest supported text size, open item details and edit an item. | Labels and controls remain available; content can scroll where needed. | no | P1 |
| 82 | TR-082 | Large text | Increase text size and open the ticket view. | Ticket details remain legible and essential ticket content is not hidden. | no | P1 |
| 83 | TR-083 | VoiceOver | Enable VoiceOver and navigate Home, tabs and trips list. | Screen elements have useful accessible names and a logical reading order. | no | P1 |
| 84 | TR-084 | VoiceOver | Navigate the timeline and open an item. | Item type, title, date and time can be identified with VoiceOver. | no | P1 |
| 85 | TR-085 | VoiceOver | Navigate map controls and POI category toggles. | Controls announce their purpose and selected state; map information is not conveyed by colour alone. | no | P1 |
| 86 | TR-086 | VoiceOver | Navigate ticket and emergency card screens. | Ticket details and emergency information can be read; actionable controls have accessible labels. | no | P1 |
| 87 | TR-087 | Accessibility | Inspect interactive controls across Home, trips and settings. | Touch targets are at least 48 pt where applicable and are not unnecessarily crowded. | no | P2 |
| 88 | TR-088 | Accessibility | Use the app with reduced motion enabled. | Essential content remains available and the interface does not rely on animation. | no | P2 |
| 89 | TR-089 | Export | Export a trip with items and attachments as a `.satchel` file. | A versioned trip file is created and includes the trip data and attachment manifest. | no | P1 |
| 90 | TR-090 | Import | Import a valid `.satchel` file. | Trip details and supported attachments are restored to the app. | no | P1 |
| 91 | TR-091 | Import | Import a malformed or unsupported `.satchel` file. | The app rejects it safely, explains the problem and does not corrupt existing trips. | yes | P1 |
| 92 | TR-092 | Import | Import the same trip file twice. | The app handles the duplicate predictably and does not silently overwrite unrelated trip data. | no | P2 |
| 93 | TR-093 | Privacy | Use the app with the device offline and inspect its main flows. | Core trip and wallet actions do not require an account or server connection. | no | P1 |
| 94 | TR-094 | Privacy | Inspect the app’s permission prompts and settings. | Permissions are requested only for relevant features and explain their purpose. | no | P1 |
| 95 | TR-095 | Privacy | Deny location permission and use the app for a session. | Location is not accessed without permission or an explicit request. | no | P1 |
| 96 | TR-096 | Data safety | Add private medical notes and document details, then inspect unrelated screens. | Sensitive details are not unintentionally exposed outside their intended screens. | no | P1 |
| 97 | TR-097 | Errors | Close a picker or dismiss a system prompt during an action. | The app returns to a stable screen and retains previously saved data. | no | P2 |
| 98 | TR-098 | Navigation | Move between trips, wallet, map and emergency tabs, then reopen a trip. | Navigation remains consistent and saved trip context is available. | no | P2 |
| 99 | TR-099 | Robustness | Rapidly open and close item details and switch tabs several times. | The app remains responsive without duplicate screens, lost data or crashes. | no | P2 |
| 100 | TR-100 | Core logic | Run unit tests for time-zone conversion, timeline grouping, next-up selection and low-battery rules. | Pure logic tests pass for representative valid, boundary and invalid inputs. | yes | P1 |
