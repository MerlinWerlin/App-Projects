# EDGE_CASES.md

## Trips and timeline

| Edge case | Expected behaviour |
|---|---|
| Time zones and DST | Show each item in its own IANA time zone; apply the applicable DST offset without changing the item’s saved instant. |
| Items crossing midnight or the date line | Show the item on the relevant local day or days without shifting its saved time or date. |
| Overlapping items | Show both items and indicate the overlap; do not move or delete either item automatically. |
| Missing end time | Show the start time and no end time; do not infer a duration. |
| Very long trip or item names | Wrap or truncate text without clipping controls or making the row unusable. |
| RTL text | Respect text direction and keep times, dates, and controls legible and usable. |
| Empty trips | Show a calm empty state with a clear way to add the first item. |
| Past trips | Keep past trips and their items available; do not present past items as upcoming. |

## Attachments and documents

| Edge case | Expected behaviour |
|---|---|
| Huge PDFs | Keep the app responsive; if the file cannot be stored or opened, show a clear error and leave existing data unchanged. |
| Corrupt images | Show an attachment error or placeholder; keep the rest of the trip usable. |
| Storage full | Show a clear save or import error; do not report success or leave a partial attachment or edit. |
| Very long document names | Wrap or truncate the displayed name without hiding actions or changing the stored filename. |

## Document vault and permissions

| Edge case | Expected behaviour |
|---|---|
| Face ID unavailable | Explain that the vault cannot use Face ID and offer the available device-authentication fallback, if supported; otherwise keep vault contents locked. |
| Face ID denied or cancelled | Keep vault contents locked and offer retry or the available device-authentication fallback; never reveal contents behind the prompt. |
| Location denied | Explain why location is needed, offer Open Settings, and keep the map and saved places usable without the blue dot. |
| Photos or file access denied | Explain the permission state and offer the available Settings or alternate-import path without discarding the current edit. |
| Contacts access denied | Keep emergency contacts editable by other available means and do not block the emergency card. |

## Map and connectivity

| Edge case | Expected behaviour |
|---|---|
| Offline or flight mode | Keep locally stored tickets, trip details, and available offline map data usable; show an offline notice where relevant. |
| Map data unavailable offline | Show that the map is unavailable and retain access to saved trip details and places. |
| Location check has no fix | Say that the location is unavailable and leave the map usable without a location marker. |
| Location permission denied | Do not request location repeatedly; show the permission notice and keep non-location map features usable. |

## Low-battery essentials mode

| Edge case | Expected behaviour |
|---|---|
| Battery crosses the configured threshold | Offer essentials mode when the level is at or below the configured threshold; do not repeatedly interrupt after dismissal. |
| Battery rises above the threshold | Stop offering automatic entry based on the threshold; keep manual entry available. |
| Manual essentials switch is on | Allow entry regardless of battery level and honour the setting until the user changes it. |
| Essentials mode has incomplete trip details | Show the available ticket, address, and emergency information without inventing missing details. |

## Editing and app state

| Edge case | Expected behaviour |
|---|---|
| App is killed mid-edit | Keep the last successfully saved data; do not present an unsaved edit as saved when the app reopens. |
| Save fails | Keep the form open with entered values and show a clear error so the user can retry. |
| User dismisses an edit with unsaved changes | Ask for confirmation before discarding the changes. |
| Very long names or notes | Preserve the entered text and keep form actions and navigation accessible. |
| RTL text in forms | Accept and display RTL input correctly without reversing dates, times, or control order unexpectedly. |

## Trip export and import

| Edge case | Expected behaviour |
|---|---|
| Invalid or corrupt `.satchel` file | Reject the file with a clear error and leave existing trips and attachments unchanged. |
| Unsupported `.satchel` version | Explain that the file version is unsupported; do not partially import it. |
| Missing or mismatched attachment in an import | Import only if the file passes validation; otherwise reject it without partial changes and explain the issue. |
| Very long imported names or notes | Preserve valid text and display it safely without breaking the trip layout. |
| Imported RTL text | Preserve and display text direction correctly. |
| Import runs out of storage | Cancel the import, report the storage problem, and leave existing data unchanged. |
