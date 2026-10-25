# Accessibility

These notes apply to every Satchel screen and control. Use native accessible controls where possible. Accessibility labels and hints must describe the action and its result, not its appearance. Do not rely on colour, position, sound or haptics alone to communicate information.

## App-wide requirements

- **VoiceOver:** Give every interactive element a concise, specific label and an action hint. Include relevant state in the label, such as “Packed” or “Off”. Use native button, switch, tab, heading and text-field semantics. Group related static text when that makes it easier to understand; do not group controls that need to be operated separately.
- **Reading order:** Follow the visual order, from screen title to main content to actions. Keep focus predictable after navigation, adding or deleting an item, opening a modal, or changing a filter. Return focus to the control that opened a modal when it closes. Announce meaningful status changes, errors and save confirmations.
- **Dynamic Type:** Support text resizing through the largest system accessibility sizes. Allow labels and values to wrap; do not truncate essential travel details. Reflow rows and cards vertically when needed. At large sizes, let screens scroll and keep actions available without overlapping content. Text inside maps may be less prominent, but map controls and a usable alternative list must remain accessible.
- **Touch:** Make every interactive target at least **48 × 48 pt**, including icon buttons, checkboxes, map controls and close buttons. Keep adequate spacing between neighbouring targets.
- **Contrast:** Check text, icons, control states, borders and focus indicators in both light and dark appearances. Do not use the orange accent alone for small text on paper or white; use ink for readable text and reserve orange for accents or sufficiently large, high-contrast elements. Do not communicate status by colour alone. Verify the complete palette against WCAG contrast guidance.
- **Motion:** Respect Reduce Motion. Avoid unnecessary movement, parallax and animated transitions; use a simple state change or fade where practical. Do not animate essential information into view.
- **Haptics:** Haptics are optional feedback, never the only feedback. Provide a setting to turn them off. Respect the device’s reduced-haptics setting where available.
- **Focus and appearance:** Maintain a visible keyboard and switch-control focus state. Support sufficient contrast and clear selected, disabled, error and pressed states. Do not convey information through font or colour alone.
- **Permissions:** Explain why a permission is needed before requesting it. Location is checked only when requested; do not imply background tracking.

## Trips tab

**Reading order:** Screen title, trip list, primary action, tab bar.

- Each trip card is one focusable control if it opens the trip. Label: “{Trip name}, {date range}, {destination summary}”. Hint: “Opens trip timeline.”
- If a card contains separate actions, expose each as a separate control with its own label and hint; do not make the card and its child actions ambiguous.
- **Add trip** button. Label: “Add trip”. Hint: “Creates a trip.”
- Empty state: announce that there are no trips and provide a labelled **Add trip** button.
- Tab bar: label tabs “Trips”, “Map”, “Wallet” and “Emergency”; hint each as “Shows {section}”. Announce the selected tab.

## Trip timeline

**Reading order:** Trip title and dates, “Next up” summary, day headings and items in chronological order, then screen actions.

- Trip title and day headings are headings. Include the day and date in each day heading.
- **Next up** card: label includes item type, title and local start time with time zone where useful. Hint: “Opens item details.”
- Each timeline item: label includes item type, title, local date and time, and location if present. Hint: “Opens item details.”
- **Add item** button. Label: “Add item”. Hint: “Adds an item to this trip.”
- **Packing list** button. Label: “Packing list”. Hint: “Opens this trip’s packing list.”
- **Map** button. Label: “Trip map”. Hint: “Shows saved places and the offline map.”
- **Trip options** button. Label: “Trip options”. Hint: “Opens trip actions.”
- If reordering or deleting items is available, expose labelled actions such as “Move {item}” and “Delete {item}”; confirm destructive actions and announce the result.

## Add or edit trip

**Reading order:** Title, fields in form order, validation messages, save and cancel actions.

- Label each text field by its purpose, for example “Trip name”, “Start date” and “End date”. Provide a concise hint when the expected format or purpose is not obvious. Use the correct keyboard type.
- Date controls: label with the field name and current value. Hint: “Choose {start/end} date.”
- **Save** button. Hint: “Saves trip details.”
- **Cancel** button. Hint: “Discards changes and returns to trips.” Confirm if unsaved changes would be lost.
- Associate validation errors with the relevant field and announce them to VoiceOver.

## Add or edit item

**Reading order:** Title, item type, fields in form order, attachment controls, save and cancel actions.

- Item-type selector: label “Item type, {selected type}”. Hint: “Choose a type of trip item.” Expose each option’s selected state.
- Label every field, including title, date, start and end time, time zone, location, notes and any type-specific fields. Add hints for formats where needed.
- Time-zone selector: label includes the selected time zone. Hint: “Choose the time zone used for this item.”
- **Add attachment** button. Hint: “Choose a file or image to attach.”
- Attached-file row: label includes filename and file type. Provide separate, labelled **Open** and **Remove** controls if available.
- **Save** button. Hint: “Saves this item to the trip.”
- **Cancel** button. Hint: “Discards changes and returns to the trip.”

## Item details and ticket view

**Reading order:** Item title and type, date and time, location, attachment or ticket content, then actions. Keep essential information near the top.

- **Edit** button. Hint: “Edits this item.”
- **Show ticket** button. Hint: “Opens the ticket for viewing.”
- **Open attachment** button. Hint: “Opens {filename}.”
- **Share or export** button, where available. Hint: “Shares a copy of this item.” State clearly what will be shared.
- **Delete** button, where available. Hint: “Deletes this item.” Confirm before deletion.
- Ticket and QR content must have a useful accessible description. Do not describe a QR code as a substitute for its contents; expose the associated ticket details as text. Ensure a QR code is not clipped or obscured at large text sizes.
- **Ticket view:** Keep the most important ticket details and QR code visible without requiring precise gestures. Place a large, labelled close or back control within easy reach. Label it “Close ticket”; hint: “Returns to item details.” Do not require a swipe gesture to reveal essential information. Brightness changes must not be required to read or use the ticket, and must not prevent access to system controls.

## Attachments and file selection

- Label source actions clearly, such as **Choose file** (“Selects a document from Files”) and **Choose photo** (“Selects an image from Photos”).
- Give each selected attachment a filename label and a separate remove action if provided.
- Loading, unsupported-file and failure messages must be readable and announced. Do not communicate upload or processing state by animation alone.
- When returning from a picker, restore focus to the attachment control or selected file.

## Hotel address card

**Reading order:** Hotel name, local-language address, address in the user’s language, other useful details, actions.

- Present addresses as selectable, readable text; do not make the only address available inside an image.
- **Copy address** button. Hint: “Copies the address to the clipboard.”
- If there are separate address fields, label them “Local-language address” and “Address in {language}”.
- Any phone or navigation action must state what it does, such as “Call hotel” or “Open directions”. Do not imply directions work offline if they require another app or a connection.

## Map tab

**Reading order:** Screen title and flight-mode status, map controls, map content or accessible place list, selected place details, tab bar.

- Provide an accessible list of saved places and visible points of interest; the map must not be the only way to find or understand this information.
- **Where am I?** button. Hint: “Checks your location once while the app is open.” On activation, explain the location permission request if needed. Do not start continuous or background location.
- Location result: announce that the location was checked and provide a readable place or coordinate description where available. Provide a clear error or permission-denied message.
- Map zoom controls: label “Zoom in” and “Zoom out”; hint: “Changes map scale.” Provide alternatives to pinch gestures.
- Category filters: use labelled switches or checkboxes, for example “Show toilets” or “Show pharmacies”. Include on/off state and announce filter changes.
- Place markers: label with place name and category. Hint: “Shows place details.” Provide equivalent access in the place list.
- Selected place card: expose name, category, address or distance as text, followed by separately labelled actions.
- **Download map** or **Manage maps** controls must state the city and the action. Announce download progress, completion, errors and available storage information as text.
- Map attribution must remain visible and accessible.
- When offline, state “Flight mode: map and tickets still work” only when accurate. Do not rely on a banner’s colour or icon to communicate offline status.

## Emergency tab and emergency card

**Reading order:** Screen title, local emergency information and its source/date, insurance details, emergency contacts, medical notes, actions.

- Display the source and date for local emergency numbers. Include “Verify locally” as readable text.
- Label each number with its service and country or region. Make calling an explicit, separate action, for example “Call emergency services, {number}”; do not trigger a call by selecting the number text.
- Contact cards: label with contact name and relationship, if provided. Give separate, explicit actions such as “Call {name}”.
- Medical notes must be readable as text and labelled as private, local-only information. Do not expose their contents in a generic control label.
- **Edit emergency card** button. Hint: “Edits emergency and contact details.”
- Any call or external-app action must make its effect clear before activation where appropriate.

## Document vault and document detail

**Reading order:** Vault title and lock state, document list, add action. For a document: document name and type, expiry information, preview or details, actions.

- Locked vault: label the unlock control “Unlock document vault”. Hint: “Uses device authentication to open your saved documents.” Clearly state when authentication is unavailable and offer an accessible alternative if supported.
- Document row: label with document type, name and expiry status/date. Hint: “Opens document details.”
- **Add document** button. Hint: “Adds a document stored on this device.”
- Document fields and expiry dates must be exposed as text, not only in a scanned image.
- **Delete document** button. Hint: “Deletes this saved document.” Confirm before deletion.
- Explain clearly if enabling iCloud sync changes where documents or private notes are stored. Do not imply local-only storage when sync is enabled.

## Packing list

**Reading order:** List title, progress summary, items in list order, add and list actions.

- Each item is a labelled checkbox or switch with its name and state, for example “Travel adaptor, packed”. Hint: “Marks this item as packed” or “Marks this item as not packed.”
- Do not use colour or a tick alone to indicate packed state.
- **Add item** button. Hint: “Adds an item to this packing list.”
- **Add template** button, if available. Hint: “Adds suggested items for this trip type.”
- **Delete item** and **Clear list** actions must be labelled and confirmed where destructive.

## Low-battery essentials mode

**Reading order:** Screen title and status, next ticket, hotel address, emergency card, exit action.

- Use a **pure black background with white text and controls**. Do not use grey text, colour-only status, decorative graphics or animation in this mode. Keep text and essential controls high contrast and readable.
- Show essential ticket, address and emergency information as selectable text where practical. Provide the same clear labels and hints as their full-screen versions.
- **Open ticket**, **Hotel address** and **Emergency card** controls must say what they open.
- **Exit essentials mode** button. Hint: “Returns to the previous screen.”
- Support Dynamic Type and scrolling; do not shrink text to fit. Keep controls at least 48 × 48 pt.
- Mode changes must be announced. The mode must remain usable without haptics, motion, sound or a map.

## Settings

**Reading order:** Screen title, settings grouped by topic, then app information and legal or data information.

- Use labelled switches with their current state and a concise effect. Examples:
  - “Haptics, on/off”. Hint: “Turns optional vibration feedback on or off.”
  - “Reduce motion, on/off”, if an in-app option is provided. Hint: “Reduces non-essential movement in Satchel.”
  - “Low-battery essentials mode, on/off”. Hint: “Manually turns essentials mode on or off.”
  - “iCloud sync, on/off”, if available. Hint: “Syncs supported data across your devices.”
- Explain the storage and privacy effect of sync before enabling it. Keep the user’s choice clear.
- **Theme** selector, if available: label the selected theme and expose each option’s name and selected state.
- **Export trip** and **Import trip** actions must identify what will be exported or imported and whether attachments are included.
- Links and disclosure controls need descriptive labels; avoid generic labels such as “More” when the destination can be named.

## Export and import

- Export action label includes the trip name. Hint: “Creates a Satchel trip file to share or save.” State which trip data and attachments are included.
- Import action label: “Import trip file”. Hint: “Selects a Satchel file to review before importing.”
- Present the trip name and import summary before confirmation. Label **Import trip** and **Cancel** actions distinctly.
- Announce success or failure in text. Do not replace a confirmation or error message with colour or a transient animation alone.

## Modals, alerts and errors

- Move VoiceOver focus into a modal or alert when it opens and return focus to its triggering control when it closes.
- Give every modal a clear title and labelled close or cancel control.
- Name the consequences of destructive actions. Provide distinct confirmation and cancellation controls.
- Associate validation and error messages with the affected control. Keep messages visible long enough to read and announce them when they appear.
