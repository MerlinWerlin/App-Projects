# EDGE_CASES.md

## Trips and timeline

| Edge case | Expected behaviour |
|---|---|
| Time zones and daylight saving time | Store each item’s IANA time zone and show its local time; ask the user to resolve ambiguous or nonexistent times at a DST change. |
| Item crosses midnight or the date line | Calculate duration using absolute times and show the item on each affected local day without changing its stored time zone. |
| Overlapping items | Keep both items and visibly flag the overlap without blocking the user from saving. |
| Missing end time | Treat the item as having a start time only and exclude it from duration and overlap calculations that require an end time. |
| Empty trip | Show a clear empty timeline with an option to add the first item. |
| Past trip | Keep it available in the trip list and timeline without presenting it as upcoming. |
| Very long trip, day or item names | Preserve the full text and wrap or truncate it in the layout without obscuring controls. |
| RTL text | Support right-to-left text and direction-aware layout while keeping times, dates and ticket codes legible. |

## Tickets and attachments

| Edge case | Expected behaviour |
|---|---|
| Huge PDF | Import without loading the whole file into memory, show progress where available, and let the user cancel. |
| Corrupt or unreadable image | Keep the rest of the trip usable, show an attachment error placeholder and offer removal or replacement. |
| Storage full during import or save | Stop the operation safely, explain that there is not enough device storage, and preserve the last successfully saved data. |
| Ticket has no end time | Show the available ticket details without inventing an end time. |

## Document vault and emergency card

| Edge case | Expected behaviour |
|---|---|
| Face ID unavailable | Keep the vault locked and explain the available authentication options; do not expose documents. |
| Face ID denied or cancelled | Keep the vault locked and allow another authentication attempt or direct the user to device settings where appropriate. |
| Emergency card has missing details | Show the available information and clearly mark fields the user has not filled in. |
| Emergency numbers are unavailable for a country | Do not guess; show that no verified local number is available and display the source and verification date for listed numbers. |

## Map and location

| Edge case | Expected behaviour |
| Location denied | Keep the map and saved places usable without a location dot, and explain how to enable location in settings. |
| Flight mode or no connection | Keep locally stored trips, tickets and downloaded map data available; indicate when a map or feature needs data that is not stored on the device. |
| Map city has not been downloaded | Show saved trip information and explain that the offline map is not available for that city. |
| Location check fails or is unavailable | Show that the current location could not be determined without retrying continuously. |

## Low-battery essentials mode

| Edge case | Expected behaviour |
|---|---|
| Battery drops below 20% while the app is open | Offer or enter essentials mode with the next ticket, hotel address and emergency card, without animation or map. |
| Battery rises above 20% | End automatic essentials mode without changing the user’s manual mode preference. |
| User manually enables essentials mode | Show the essentials screen regardless of battery level until the user turns it off. |
| Battery status is unavailable | Keep manual essentials mode available and do not infer a battery level. |

## App state and editing

| Edge case | Expected behaviour |
|---|---|
| App is killed mid-edit | Restore the last committed version and discard any incomplete edit. |
| App is killed during attachment import | Keep existing data intact and report the incomplete import on next launch if needed. |
| Storage is full during an edit | Do not replace the last committed version with a partial save; explain that storage must be freed before saving. |

## Trip file import and export

| Edge case | Expected behaviour |
|---|---|
| Invalid or malformed `.satchel` file | Reject the file with a plain-language error and leave existing trips unchanged. |
| Unsupported `.satchel` version | Explain that the file version is unsupported and do not import partial data. |
| Missing or corrupt attachment in a `.satchel` file | Import valid trip data where safe, mark the affected attachment unavailable and report it to the user. |
| Duplicate trip imported | Ask whether to keep both or cancel; do not silently overwrite an existing trip. |
