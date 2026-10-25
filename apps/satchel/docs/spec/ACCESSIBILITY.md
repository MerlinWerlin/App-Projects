# Accessibility

Accessibility is part of each screen, not a final polish pass. Keep controls understandable and usable with VoiceOver, Switch Control, larger text, reduced motion and one hand. Use the same plain wording in visible text and accessibility labels.

## App-wide requirements

### VoiceOver and control semantics

- Give every interactive control an explicit, localised accessibility label and an action-focused hint. Do not rely on an icon, placeholder, colour or position alone.
- Use native button, link, text-field, switch, checkbox and adjustable-control semantics. Expose selected, disabled, expanded, checked and loading states where relevant.
- Include meaningful values in labels or values: for example, “Appearance, Dark” or “Battery threshold, 20 per cent”. Update the value after a change.
- Hints describe the result of an action, not how to operate VoiceOver. Keep them short; omit a hint when the label and role already make the action clear.
- Mark decorative icons and illustrations as hidden from accessibility. Do not hide meaningful status or error text.
- Announce validation errors and save results. Move accessibility focus to an error summary or the first invalid field when appropriate.
- Preserve logical reading and focus order. Focus should not jump unexpectedly after navigation, dialogs, loading or content updates.
- Dialogs and sheets must have an accessible title, announce their appearance, contain focus while open and return focus to the control that opened them when dismissed.
- Ensure swipe-to-dismiss has an accessible, visible alternative, with a discard confirmation when edits would be lost.

### Text size and layout

- Support Dynamic Type through the largest accessibility sizes on every screen, including sheets, ticket details, map controls, error messages and buttons.
- Allow text to wrap. Let content grow vertically and scroll rather than clipping, truncating important text or overlapping controls. Avoid fixed-height text containers.
- At the largest sizes, stack horizontal layouts, move secondary actions below primary content and keep labels beside their values. Do not require horizontal scrolling for essential content.
- Use scalable text styles and test with the largest accessibility text size on supported iPhones. Keep important dates, times, addresses, ticket details and emergency information readable.
- Do not communicate information through font weight, colour or position alone.

### Touch, colour and motion

- Make every tappable target at least **48 × 48 pt**, including icon buttons, map category toggles, close buttons and small row actions. Keep adequate spacing between targets.
- Meet WCAG AA contrast for text and controls: at least **4.5:1** for normal text and **3:1** for large text and meaningful non-text controls. Verify actual rendered colour pairs in both light and dark appearance.
- The navy ink (`#14213D`) on paper (`#F4F1EA`) is the preferred light-theme text pairing. Do not use muted text (`#6B7280`) for essential information without checking contrast at its actual size and background.
- Treat orange as an accent, not a default text colour. Do not place small white text on the light orange accent (`#E07A2F`) or use colour alone to indicate ticket status, warnings or selection. Pair colour with a word, icon or shape.
- Check all dark-theme pairings too. Do not assume a colour that works in light appearance remains legible on dark cards.
- Respect Reduce Motion. Replace non-essential movement with an immediate state change or a brief fade; do not use parallax, repeated movement or animated transitions to communicate essential information.
- Haptics are optional. Respect the in-app haptics setting and do not make vibration the only confirmation or warning.

## Screen notes

Labels and hints below describe the minimum accessible meaning for controls. Substitute live values, selected states and localised strings as needed. Reusable controls should keep the same label and hint wherever they appear.

### Trips home

**Reading order:** screen title; welcome or demo-trip introduction when shown; low-battery notice; trip list and each trip’s summary; emergency shortcut; add-trip action; tab bar.

| Control | VoiceOver label | Hint |
|---|---|---|
| Trip row | “Trip to {destination}, {date range}” | “Opens the trip timeline.” |
| Add trip | “Add trip” | “Creates a trip.” |
| Emergency shortcut | “Emergency card” | “Opens your emergency information.” |
| Low-battery offer | “Low-battery essentials available” | “Opens your next ticket, hotel address and emergency card.” |
| Dismiss low-battery offer | “Dismiss essentials suggestion” | “Hides this suggestion.” |
| Retry loading | “Try loading trips again” | “Loads your saved trips again.” |
| Tab: Trips | “Trips” | “Shows your trips.” |
| Tab: Map | “Map” | “Opens the map.” |
| Tab: Wallet | “Wallet” | “Shows your tickets.” |
| Tab: Emergency | “Emergency” | “Opens your emergency card.” |

Announce empty and error states as text. Keep the emergency shortcut available without requiring a long scroll.

### First launch and welcome

**Reading order:** welcome heading and explanation; language-in-use line and Settings link; demo-trip explanation; available actions.

| Control | VoiceOver label | Hint |
|---|---|---|
| Language settings link | “Language: {language}. Change in Settings” | “Opens language settings.” |
| Try demo trip | “Open demo trip” | “Shows a sample trip and its features.” |
| Continue or dismiss | Use the visible action, for example “Continue” | State the next screen or result. |

Do not require a blocking welcome flow to reach saved travel information.

### Trip timeline

**Reading order:** trip title and dates; Next up card; trip-level actions; day headings in chronological order; items within each day; packing list and trip map links; add-item action.

| Control | VoiceOver label | Hint |
|---|---|---|
| Next up card | “Next: {item type}, {title}, {local time zone and time}” | “Opens this item.” |
| Day heading | “{day and local date}” | No hint unless it is interactive. |
| Timeline item | “{item type}, {title}, {local start time}, {location if present}” | “Opens item details.” |
| Add item | “Add trip item” | “Choose an item type to add.” |
| Trip map | “Map for this trip” | “Shows this trip’s places and map.” |
| Packing list | “Packing list” | “Opens this trip’s packing list.” |
| Edit trip | “Edit trip” | “Changes the trip details.” |
| Delete trip | “Delete trip” | “Deletes this trip and its saved items and packing list.” |

Read times with their relevant local date and time zone when ambiguity is possible. Do not convey day grouping by colour alone.

### Add and edit trip

**Reading order:** sheet title; fields in visual order; validation messages beside their fields; save and cancel actions.

| Control | VoiceOver label | Hint |
|---|---|---|
| Trip name | “Trip name” | “Enter a name for this trip.” |
| Destination | “Destination” | “Enter the main destination.” |
| Start date / end date | “Start date” / “End date” | “Choose the {start/end} date.” |
| Save | “Save trip” | “Saves your changes.” |
| Cancel | “Cancel editing trip” | “Discards unsaved changes after confirmation.” |

Expose field values and required status. Do not rely on placeholder text as the only label.

### Add and edit item

**Reading order:** sheet title and item type; common fields; type-specific fields; attachments; validation messages; save and cancel actions.

| Control | VoiceOver label | Hint |
|---|---|---|
| Item type | “Item type, {type}” | “Choose a different type of trip item.” |
| Title | “Title” | “Enter a name for this item.” |
| Start date and time | “Start date and time” | “Choose when this item starts.” |
| End date and time | “End date and time” | “Choose when this item ends.” |
| Time zone | “Time zone, {zone}” | “Choose the time zone used for this item.” |
| Location or address | “Location” or “Address” | “Enter the place for this item.” |
| Booking reference | “Booking reference” | “Enter the reference if you want to save it.” |
| Phone | “Phone number” | “Enter a phone number.” |
| Notes | “Notes” | “Enter additional details.” |
| Add attachment | “Add attachment” | “Choose a file or photo to attach.” |
| Attachment row | “Attachment, {file name}” | “Opens the attachment.” |
| Remove attachment | “Remove {file name}” | “Removes this file from the item.” |
| Save | “Save item” | “Saves your changes.” |
| Delete | “Delete item” | “Deletes this item and its attached files.” |
| Cancel | “Cancel editing item” | “Discards unsaved changes after confirmation.” |

Date and time pickers must expose their selected value and work with system accessibility settings. Identify time-zone search results by city and IANA zone; do not announce a bare offset as the only identifier.

### Ticket view

**Reading order:** ticket title and essential travel details; QR code or barcode; reference and attachment actions; close action. Keep the most important ticket information near the bottom of the screen for one-handed reach where practical.

| Control | VoiceOver label | Hint |
|---|---|---|
| Close ticket | “Close ticket” | “Returns to the previous screen.” |
| Ticket details | “{item type}, {title}, {date}, {local time}, {location}” | No hint unless opening more details. |
| QR code | “Ticket code for {title}” | “Show this code to the attendant.” |
| Copy booking reference | “Copy booking reference” | “Copies the reference to the clipboard.” |
| Open attachment | “Open ticket attachment, {file name}” | “Opens the saved ticket file.” |
| Brightness control, if shown | “Screen brightness” | State the current setting and what changing it does. |

Do not require a pinch gesture or precise positioning to present a code. Keep the code large, high contrast and visible without obscuring essential details. VoiceOver should announce a useful code description, not attempt to read image pixels. Preserve full-screen brightness behaviour only while the ticket is open and restore the previous setting on exit. Provide a clear, reachable close action. Do not make full brightness the only way to use the ticket.

### Wallet

**Reading order:** screen title; tickets grouped by date; each ticket’s type, title and local time; empty state.

| Control | VoiceOver label | Hint |
|---|---|---|
| Ticket row | “{item type}, {title}, {local date and time}” | “Opens the ticket.” |
| Empty-state action, if present | Name the action, such as “Add a trip item” | “Opens the form to add a ticket.” |

Group headings should be announced as headings. Do not rely on colour or a ticket-shaped decoration to identify ticket rows.

### Emergency card

**Reading order:** screen title; relevant emergency numbers and source/date note; insurance details; emergency contacts; medical notes; hotel address shortcut; edit actions.

| Control | VoiceOver label | Hint |
|---|---|---|
| Emergency number | “{service}, {number}” | “Calls {number}” only if a call action is actually available. |
| Source and checked date | “Source: {source}. Checked {date}. Verify locally.” | No hint. |
| Number caution | Read the warning with the number; do not use a colour-only alert. | No hint. |
| Insurance details | “Insurance: {provider or policy details}” | No hint unless it opens more information. |
| Emergency contact row | “{contact name}, {phone number}” | State the available action, such as “Opens contact details.” |
| Medical notes | “Private medical notes” | State whether this opens or edits the notes. |
| Edit card | “Edit emergency card” | “Changes your saved emergency information.” |
| Hotel address shortcut | “Hotel address” | “Opens the address card.” |

Make numbers easy to select, copy or use with an available phone action. Keep source, checked date and “verify locally” text readable. Never imply emergency numbers are guaranteed current.

### Edit emergency card

**Reading order:** sheet title; country and service-number fields; source and confidence warnings; insurance fields; contact controls; medical notes; save and cancel.

| Control | VoiceOver label | Hint |
|---|---|---|
| Country | “Country” | “Choose the country for these emergency numbers.” |
| Emergency service number | “{service} number” | “Enter the local number for {service}.” |
| Insurance fields | Use the visible field name, such as “Insurance phone number” | State what information to enter. |
| Add contact | “Add emergency contact” | “Choose a contact or enter details.” |
| Contact picker | “Choose a contact” | “Select a person to add as an emergency contact.” |
| Remove contact | “Remove {contact name}” | “Removes this emergency contact from your card.” |
| Medical notes | “Private medical notes” | “Enter information stored on this device.” |
| Save | “Save emergency card” | “Saves your emergency information.” |
| Cancel | “Cancel editing emergency card” | “Discards unsaved changes after confirmation.” |

Explain the contacts permission before requesting it and provide a usable manual-entry fallback.

### Hotel address card

**Reading order:** hotel name; local-language address; other address details; copy and close actions.

| Control | VoiceOver label | Hint |
|---|---|---|
| Copy address | “Copy hotel address” | “Copies the address to the clipboard.” |
| Close | “Close address card” | “Returns to the previous screen.” |
| Edit address, if shown | “Edit hotel address” | “Changes the saved hotel address.” |

Use large, wrapping text for the address. Keep the local-language address intact and selectable; do not transliterate or truncate it. Ensure the card is legible when shown to another person.

### Document vault

**Reading order:** vault lock status; document list and expiry warnings; add-document action; settings or lock action.

| Control | VoiceOver label | Hint |
|---|---|---|
| Unlock vault | “Unlock document vault” | “Authenticates to show saved documents.” |
| Document row | “{document type}, expires {date}” | “Opens the saved document.” |
| Expiry warning | “Expiry warning: {document type}, expires {date}” | No hint. |
| Add document | “Add document” | “Choose a document type and file.” |
| Lock vault | “Lock document vault” | “Hides saved documents.” |
| Delete document | “Delete {document type}” | “Deletes this saved document from the device.” |

Never expose document contents in a label, hint or notification. Make authentication success and failure understandable and provide the device passcode fallback when available.

### Add and edit vault document

**Reading order:** sheet title; document type; document details and expiry; attached file; save and cancel.

| Control | VoiceOver label | Hint |
|---|---|---|
| Document type | “Document type, {type}” | “Choose the type of document.” |
| Document name | “Document name” | “Enter a name to recognise this document.” |
| Expiry date | “Expiry date” | “Choose the document expiry date.” |
| Add or replace file | “Add document file” or “Replace document file” | “Choose a file or photo stored on this device.” |
| Save | “Save document” | “Saves this document in the vault.” |
| Cancel | “Cancel editing document” | “Discards unsaved changes after confirmation.” |

Explain the purpose before requesting file or photo access. Make permission denial and the file-picker fallback accessible.

### Packing list

**Reading order:** trip and list title; completion summary; items in list order; template action; add-item action.

| Control | VoiceOver label | Hint |
|---|---|---|
| Packing item | “{item}, {checked/unchecked}” | “Marks this item {packed/not packed}.” |
| Add item | “Add packing item” | “Adds an item to this list.” |
| Add template | “Add template” | “Adds suggested items to this packing list.” |
| Delete item | “Delete {item}” | “Removes this item from the list.” |

Expose the checked state semantically. Do not depend on a tick colour alone.

### Add packing item or template

**Reading order:** sheet title; item or template choices; any name field; add, save and cancel actions.

| Control | VoiceOver label | Hint |
|---|---|---|
| Template choice | “{template name}” | “Adds suggested items for this trip type.” |
| Item name | “Packing item” | “Enter an item to pack.” |
| Add | “Add to packing list” | “Adds the selected items.” |
| Cancel | “Cancel” | “Closes without adding items.” |

### Map

**Reading order:** map title and offline/flight-mode status; map content or map availability notice; category filters; saved places and booking results; location action; save-place action; map attribution.

| Control | VoiceOver label | Hint |
|---|---|---|
| Category filter | “Show {category}, {on/off}” | “Shows or hides {category} places on the map.” |
| Map point | “{place name or category}, {distance if available}” | “Opens place details.” |
| Saved place | “{place name}, saved” | “Opens this saved place.” |
| Where am I? | “Where am I?” | “Checks your location once while using the map.” |
| Save place | “Save this place” | “Adds this place to the trip.” |
| Remove saved place | “Remove {place name} from trip” | “Removes this saved place from the trip.” |
| Trip map scope | “Map for {trip name}” | “Shows places for this trip.” |
| Permission action | “Open Settings” | “Opens device settings to change location access.” |

Do not make selecting a pin the only way to access a place. Provide an accessible list or equivalent result view. Explain location use before asking permission. Location is a single check on request; do not describe or imply background tracking. Keep map attribution readable and accessible. Announce when the map is unavailable or has no saved places, with an alternative action where possible.

### Essentials mode

**Reading order:** “Low-battery essentials” heading; next ticket; hotel address; emergency card; close action. Keep this screen still and direct.

| Control | VoiceOver label | Hint |
|---|---|---|
| Next ticket card | “Next ticket: {title}, {local date and time}” | “Opens the ticket.” |
| Hotel address card | “Hotel address” | “Shows the saved address in large text.” |
| Emergency card | “Emergency card” | “Shows your emergency information.” |
| Close | “Close essentials” | “Returns to the previous screen.” |

Use a **pure black background and white text**. Keep text and controls high contrast and readable at all supported sizes. No animation or map is shown. Do not scale controls down: retain targets of at least 48 × 48 pt. Ensure this screen remains usable with VoiceOver and does not rely on a battery warning sound or haptic.

### Settings

**Reading order:** screen title; appearance and language; haptics; essentials threshold and manual switch; privacy information; other settings and support actions.

| Control | VoiceOver label | Hint |
|---|---|---|
| Appearance | “Appearance, {System/Light/Dark}” | “Choose how Satchel looks.” |
| Language | “Language, {language}” | “Choose the language used in Satchel.” |
| Haptics | “Haptics, {on/off}” | “Turns optional vibration feedback on or off.” |
| Essentials threshold | “Essentials battery threshold, {value} per cent” | “Adjusts when Satchel suggests essentials mode.” |
| Manual essentials switch | “Offer essentials mode, {on/off}” | “Turns the low-battery essentials offer on or off.” |
| Privacy information | “Data Not Collected” | “Explains how Satchel handles your data.” |
| Open device settings | “Open Settings” | “Opens device settings for this permission.” |

Switches must announce their state. The threshold must be keyboard and assistive-technology operable, expose its value and allow precise adjustment without dragging alone. Haptics must never be required for feedback.

### Tabs, navigation and system sheets

- Give each tab its name and selected state. Keep the tab bar reachable at larger text sizes.
- Give navigation back, close, edit, delete and overflow controls explicit labels. If an icon is decorative, hide it from VoiceOver.
- File and photo pickers, authentication prompts, date pickers and contact pickers must have a clear spoken context before opening and a clear result or error afterwards.
- Permission notices must explain why access is requested, offer an accessible “Open Settings” action where available, and retain a usable alternative when permission is declined.

## Verification checklist

Test on device with VoiceOver and the largest Dynamic Type sizes, in both light and dark appearance:

- Every control has a clear label, suitable role, current value or state, and a useful hint where needed.
- Reading and focus order match the screen’s visual and task order.
- Text wraps and content scrolls without hiding actions or important details.
- All touch targets are at least 48 × 48 pt.
- Text, controls, selected states, errors and warnings meet contrast requirements; meaning is not colour-only.
- Reduce Motion removes non-essential animation without removing feedback or context.
- Ticket details and essentials mode can be used one-handed; essentials mode is static, pure black and white.
- Haptics can be disabled without loss of information.
- Permission denial, empty, loading, save-error and offline states remain accessible.
