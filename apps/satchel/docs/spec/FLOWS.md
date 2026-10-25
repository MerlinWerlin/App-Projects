# FLOWS.md

TRIAL milestone screen flows for Satchel. The app stores travel information on the device; there are no accounts or backend. The map uses the system map in Expo Go and may need an internet connection. Location is checked only when the traveller asks.

## 1. First launch

### 1.1 Welcome

**Purpose:** Introduce Satchel and offer a ready-to-try demo trip without requiring setup.

**Entry points:** First launch, when no trips exist and onboarding has not been completed.

**Elements, top to bottom:**
1. Satchel mark and welcome heading.
2. Short explanation: “Your travel details, ready when you need them.”
3. Privacy line: “Stored on this device. No account needed.”
4. Language-in-use line with a link to Settings > Language.
5. Demo-trip preview: Sydney → Tokyo → Kyoto.
6. Primary and secondary buttons.

**Primary action — Try the demo trip:** Create the demo trip and its sample content locally, mark onboarding complete, and open the demo intro.

**Secondary action — Start with my own trip:** Mark onboarding complete, open the Trips list, and show its empty state.

**Other taps:** Language link opens Settings > Language.

**Exits:** Continue to the demo intro or Trips list. The welcome screen does not request permissions.

### 1.2 Demo intro

**Purpose:** Show what is included in the demo and help the traveller find key features.

**Entry points:** After choosing “Try the demo trip” on Welcome.

**Elements, top to bottom:**
1. Trip title and route summary.
2. Short note that the sample trip includes example travel details.
3. Quick links or prompts for the timeline, ticket, emergency card, document vault, packing list and map.
4. “Open trip” button.

**Primary action — Open trip:** Open the demo trip timeline.

**Secondary action — Not now:** Open the Trips list.

**Other taps:** A feature prompt opens the relevant demo screen where sample data is available. For the map, open the demo trip map.

**Exits:** Trip timeline, Trips list, or selected feature.

## 2. Trips

### 2.1 Trips list

**Purpose:** Find, open and create trips; provide one-tap access to the emergency card.

**Entry points:** Trips tab; after onboarding; after closing a trip or settings screen.

**Elements, top to bottom:**
1. Screen title.
2. Low-battery essentials banner, if essentials mode is being offered.
3. Emergency-card shortcut.
4. Trips list, ordered by upcoming travel, with trip name and dates.
5. Empty state and “Create a trip” action, when there are no trips.
6. Add-trip button.

**Primary actions:**
- **Tap a trip:** Open its timeline.
- **Create a trip / Add trip:** Open the new-trip form.
- **Emergency card:** Open the emergency card.

**Secondary actions:**
- **Low-battery banner:** Open essentials mode.
- **Trip menu:** Offer edit or delete. Edit opens the trip form. Delete asks for confirmation, then removes the trip, its packing list and associated attachment files.

**Other taps:** Map, Wallet and Emergency tabs open their respective screens. Settings is reached from its available navigation entry.

**Exits:** Trip timeline, trip form, emergency card, essentials, or another tab.

### 2.2 New or edit trip form

**Purpose:** Create or update the trip’s basic details.

**Entry points:** Trips list > Create a trip / Add trip; trip menu > Edit.

**Elements, top to bottom:**
1. Form title.
2. Trip name.
3. Start and end dates.
4. Trip type, where used for packing-list templates.
5. Save button.
6. Cancel action.

**Primary action — Save:** Validate and save locally. On success, close the form and open the trip timeline for a new trip, or return to the prior screen after an edit.

**Secondary action — Cancel:** Close without saving. If there are unsaved changes, ask whether to discard them.

**Other taps:** Date fields open native date pickers.

**Exits:** Trip timeline or the screen from which editing began. If saving fails, show an error, keep the form open and preserve entered values.

## 3. Trip timeline

### 3.1 Timeline

**Purpose:** See a trip’s schedule by local day, find what is next, and manage its items and saved places.

**Entry points:** Tap a trip in Trips; save a new trip.

**Elements, top to bottom:**
1. Trip title and date range.
2. “Next up” card, when an upcoming item exists.
3. Trip actions: add item, packing list and Trip map.
4. Day sections in the trip’s local time, with items ordered by time.
5. Saved places for the trip, when present.
6. Add-item action or an empty state if the trip has no items.

**Primary actions:**
- **Tap an item:** Open its detail screen.
- **Add item:** Open the kind selector.
- **Packing list:** Open the trip’s packing list.
- **Trip map:** Open the map scoped to this trip.
- **Tap a saved place:** Open its place details or map location.

**Secondary actions:**
- **Next up card:** Open the upcoming item.
- **Trip menu:** Edit trip or delete trip. Delete asks for confirmation and removes the trip, packing list and attachment files.
- **Add saved place:** Open map place selection, then save the selected place to this trip.

**Other taps:** Use item actions to edit or delete an item. Deleting an item asks for confirmation and removes its attachment files.

**Exits:** Item detail, item form, packing list, trip map, trip form, or Trips list.

### 3.2 Item kind selector

**Purpose:** Choose the type of timeline item to add.

**Entry points:** Timeline > Add item.

**Elements, top to bottom:**
1. Sheet title.
2. Kind choices: flight, train, ferry, bus, hotel, car hire, activity and note.
3. Cancel action.

**Primary action — Choose a kind:** Open the new-item form for that kind.

**Secondary action — Cancel:** Close the selector and return to the timeline.

**Exits:** New-item form or timeline.

## 4. Add and edit timeline items

### 4.1 Shared item-form behaviour

**Purpose:** Enter or update travel details for one item kind.

**Entry points:** Item kind selector; item detail > Edit.

**Elements, top to bottom:**
1. Form title and item kind.
2. Kind-specific fields.
3. Start date and time; end date and time when relevant.
4. Time-zone selector/search list for the item’s IANA time zone.
5. Notes or other kind-specific details.
6. Attachments section, with attached files and add/remove actions.
7. Save and Cancel actions.

**Primary action — Save:** Validate and save locally. On success, close the form and show the item detail or updated timeline. Time and date display and grouping use the item’s selected time zone, including offline time-zone calculations.

**Secondary action — Cancel:** Close without saving. If there are unsaved changes, ask whether to discard them.

**Other taps:**
- **Date or time field:** Open the native picker.
- **Time-zone field:** Open the searchable time-zone list; selecting a zone returns to the form.
- **Add attachment:** Open the attachment source choices.
- **Remove attachment:** Remove it from the item and delete its local file, with confirmation where needed.

**Exits:** Item detail, timeline, attachment-source chooser, date/time picker or time-zone list. If saving fails, show an error, keep the form open and preserve entered values.

### 4.2 Kind-specific fields

Fields below are additional to the shared fields. Each kind also has an item title/name, date/time and time zone where applicable.

- **Flight:** Airline or carrier text, flight number, departure airport, arrival airport, booking reference.
- **Train:** Operator text, train number or service, departure station, arrival station, booking reference.
- **Ferry:** Operator text, departure port, arrival port, booking reference.
- **Bus:** Operator text, departure stop, arrival stop, booking reference.
- **Hotel:** Property name, address, local-language address, phone, check-in and check-out dates/times, booking reference.
- **Car hire:** Provider text, pick-up and return locations, pick-up and return dates/times, booking reference.
- **Activity:** Activity name, location and start/end date or time.
- **Note:** Title, note text and optional date/time.

**Tap behaviour:** Enter text in fields; use date/time and time-zone controls as described above. Save and Cancel behave as in Shared item-form behaviour.

## 5. Attachments and tickets

### 5.1 Attachment source chooser

**Purpose:** Add a ticket, confirmation or other file to an item.

**Entry points:** Item form > Add attachment.

**Elements, top to bottom:**
1. Sheet title.
2. Choose from Files.
3. Choose from Photos.
4. Cancel.

**Primary actions:**
- **Choose from Files:** Open the system document picker. After selection, copy the file into Satchel’s local documents directory and attach it to the item.
- **Choose from Photos:** Request photo access when needed, then open the photo picker. After selection, copy the image into Satchel’s local documents directory and attach it.

**Secondary action — Cancel:** Close the chooser.

**Other taps / states:** If access is denied, show a PermissionNotice with the reason, an Open Settings action and an available fallback. If the picker is cancelled, return to the form without changing it.

**Exits:** Return to the item form, with the attachment listed if added.

### 5.2 Item detail

**Purpose:** Read an item’s travel details and open its attachments as tickets or documents.

**Entry points:** Tap an item on the timeline or in Wallet.

**Elements, top to bottom:**
1. Item kind and title.
2. Date and time in the item’s local time zone.
3. Kind-specific travel details.
4. Attachments.
5. Edit and delete actions.

**Primary actions:**
- **Tap an attachment:** Open its viewer.
- **Edit:** Open the item form with existing values.
- **Delete:** Ask for confirmation; on confirmation remove the item and its attachment files.

**Secondary actions:** Close/back returns to the previous screen.

**Exits:** Attachment viewer, item form or previous screen.

### 5.3 Ticket / attachment viewer

**Purpose:** Make an attached ticket easy to read and scan, including in flight mode.

**Entry points:** Tap a ticket attachment from item detail or Wallet.

**Elements, top to bottom:**
1. Close/back control.
2. One-handed ticket actions, including show QR where a saved QR crop exists.
3. Ticket image or PDF content.
4. Attachment name and related item context.

**Primary actions:**
- **Show QR:** Show the saved QR crop large enough to scan.
- **Tap a PDF or image:** View its content using the available Expo Go viewer.

**Secondary actions:**
- **Close/back:** Restore the previous screen and restore the prior screen brightness.
- **Brightness handling:** On entry, request full brightness for the ticket view; on every exit, restore the previous brightness. If brightness is unavailable, leave the ticket view usable at current brightness.

**Exits:** Return to the item detail or Wallet. The ticket and saved QR crop are local and remain available in flight mode.

### 5.4 Wallet

**Purpose:** Find trip tickets in time order.

**Entry points:** Wallet tab.

**Elements, top to bottom:**
1. Screen title.
2. Tickets grouped or ordered by their travel time.
3. Empty state if no tickets are attached.

**Primary action — Tap a ticket:** Open its item detail or ticket viewer.

**Secondary actions:** Use tab navigation to open Trips, Map or Emergency.

**Exits:** Ticket detail/viewer or another tab.

## 6. Emergency card

### 6.1 Emergency card

**Purpose:** Put key emergency and insurance information in one place, available locally.

**Entry points:** Emergency tab; emergency shortcut on Trips home; emergency card in essentials mode.

**Elements, top to bottom:**
1. Screen title and country/region context.
2. Local emergency numbers from the bundled sourced-and-dated table.
3. Source and checked date, with “verify locally”.
4. Confidence or “number doubted, check locally” notice where applicable.
5. Insurance policy details and insurer phone.
6. Emergency contacts.
7. Private medical notes.
8. Edit action.

**Primary actions:**
- **Tap a phone number:** Offer the phone action if available; otherwise allow the number to be read or copied.
- **Edit:** Open the emergency-card form.
- **Tap a contact:** Show its saved emergency contact details.

**Secondary actions:** Back returns to the previous screen. Emergency details are stored locally.

**Exits:** Emergency-card form or previous screen.

### 6.2 Emergency-card form

**Purpose:** Add or update emergency information.

**Entry points:** Emergency card > Edit.

**Elements, top to bottom:**
1. Form title.
2. Country/region selection and emergency-number information.
3. Insurance policy and phone fields.
4. Emergency contacts.
5. Private medical notes.
6. Save and Cancel actions.

**Primary action — Save:** Save locally and return to the card. If saving fails, show an error and keep the form open.

**Secondary actions:**
- **Add contact:** Request Contacts permission when needed, then choose a contact. If denied or unavailable, show a PermissionNotice and any available manual-entry fallback.
- **Cancel/back:** Return to the card. If there are unsaved changes, ask whether to discard them.

**Exits:** Emergency card or contact picker.

## 7. Hotel address card

### 7.1 Address card

**Purpose:** Show a hotel address clearly to share with a driver, including its local-language form.

**Entry points:** Open a hotel item; hotel address shortcut in essentials mode.

**Elements, top to bottom:**
1. Hotel/property name.
2. Address in large, legible text.
3. Local-language address in large, legible text when provided.
4. Phone and other relevant hotel details.
5. Copy address action.
6. Edit action, where available.

**Primary action — Copy address:** Copy the displayed address to the clipboard and confirm it has been copied.

**Secondary actions:**
- **Edit:** Open the hotel item form.
- **Back:** Return to the hotel item or essentials mode.

**Exits:** Hotel item form or previous screen.

## 8. Document vault

### 8.1 Vault

**Purpose:** Keep passport, visa and licence copies with expiry warnings behind a local authentication lock.

**Entry points:** Wallet or other available vault entry.

**Elements, top to bottom:**
1. Vault title and lock status.
2. Authentication prompt when locked.
3. Document list with type, expiry date and warning where applicable.
4. Add document action.
5. Lock/close action.

**Primary actions:**
- **Unlock:** Request Face ID or device passcode through local authentication. On success, show the vault. If authentication fails or is cancelled, keep the vault locked.
- **Tap a document:** Open its local attachment.
- **Add document:** Open the document form.

**Secondary actions:**
- **Lock/close:** Lock the vault and return to the previous screen.
- **Authentication unavailable:** Show a plain explanation and available device-authentication fallback; do not expose documents without successful authentication.

**Exits:** Document detail, document form or previous screen. Document files and details remain on device.

### 8.2 Add or edit document form

**Purpose:** Record a travel document and its expiry date, and attach a local copy.

**Entry points:** Vault > Add document; document detail > Edit.

**Elements, top to bottom:**
1. Form title.
2. Document type: passport, visa or licence.
3. Name/identifier fields as needed.
4. Expiry date.
5. Attachment section.
6. Save and Cancel actions.

**Primary action — Save:** Save locally and return to the vault. Show expiry warnings on the document list when relevant.

**Secondary actions:**
- **Add attachment:** Use the attachment source chooser.
- **Cancel/back:** Return to the vault. If there are unsaved changes, ask whether to discard them.

**Exits:** Vault, attachment chooser or date picker.

## 9. Low-battery essentials mode

### 9.1 Essentials

**Purpose:** Provide a plain, fast-access screen for the next ticket, hotel address and emergency card.

**Entry points:** Low-battery banner; manual essentials switch in Settings; other available essentials shortcut.

**Elements, top to bottom:**
1. Black background and high-contrast white text; no animation.
2. Next ticket card, when available.
3. Hotel address card, when available.
4. Emergency card.
5. Exit control.

**Primary actions:**
- **Next ticket:** Open the ticket viewer.
- **Hotel address:** Open the address card.
- **Emergency card:** Open the emergency card.

**Secondary action — Exit:** Return to the prior screen. The screen does not show a map or run location checks.

**Behaviour:** Satchel offers this mode when the device battery is below the configured threshold (20% by default), or when the traveller enables it manually. The traveller can dismiss the offer. The configured threshold can be changed in Settings.

**Exits:** Ticket viewer, address card, emergency card or prior screen.

## 10. Packing list

### 10.1 Trip packing list

**Purpose:** Track what is packed for a trip using a trip-type template or a custom list.

**Entry points:** Trip timeline > Packing list.

**Elements, top to bottom:**
1. Trip name and packing-list title.
2. Completion summary.
3. Items grouped by category.
4. Add item action.
5. Add template action.

**Primary actions:**
- **Tap an item/check control:** Toggle its packed state and save locally.
- **Add item:** Add a custom packing item.
- **Add template:** Choose a template and add its items to this trip’s list.

**Secondary actions:**
- **Edit item:** Change its name or category.
- **Delete item:** Remove it from the list after confirmation.
- **Back:** Return to the trip timeline.

**Exits:** Item editor, template chooser or timeline.

### 10.2 Add-template chooser

**Purpose:** Add suggested packing items for a trip type.

**Entry points:** Packing list > Add template.

**Elements, top to bottom:**
1. Sheet title.
2. Available trip-type templates.
3. Add and Cancel actions.

**Primary action — Choose template:** Add its items to the current packing list without replacing existing items.

**Secondary action — Cancel:** Close the chooser.

**Exits:** Packing list.

## 11. Map v0

### 11.1 Map

**Purpose:** Explore the system map, view trip places and demo-city points of interest, and request one location check.

**Entry points:** Map tab; Trip timeline > Trip map; a saved place or booking location.

**Elements, top to bottom:**
1. Map header and trip scope, when applicable.
2. Category toggles for toilets, drinking water, fuel, food, pharmacy, ATM and hospital.
3. Map with pins for bookings, saved places and bundled demo-city points of interest.
4. “Where am I?” button.
5. Map attribution, including OpenStreetMap attribution for bundled POIs.
6. Save/remove place actions when a place is selected.

**Primary actions:**
- **Tap a pin:** Show its name and details.
- **Where am I?:** Request foreground location permission if needed, then make a single location check and show the result on the map. Do not track continuously.
- **Tap a category toggle:** Show or hide that POI category.
- **Save place:** Save the selected place to the trip.
- **Remove saved place:** Remove it from the trip.

**Secondary actions:**
- **Tap map:** Select a location for saving as a trip place.
- **Trip scope control:** Show places for the selected trip.
- **Permission denied or unavailable:** Show a PermissionNotice with the reason, an Open Settings action and a manual map fallback.
- **Network unavailable:** The system map may not load; retain saved trip details and show an appropriate offline or unavailable state. Do not imply that the TRIAL map is an offline map.

**Exits:** Selected place details, trip timeline or another tab. A location check ends after returning one fix; no background location is used.

## 12. Settings

### 12.1 Settings

**Purpose:** Control appearance, haptics, essentials behaviour and language; explain local data handling.

**Entry points:** Settings navigation entry.

**Elements, top to bottom:**
1. Settings title.
2. Appearance: System, Light or Dark.
3. Haptics switch.
4. Essentials mode manual switch.
5. Essentials battery threshold control.
6. Language picker, showing phone default and shipped languages.
7. Privacy section, including “Data Not Collected”.
8. About/support information where available.

**Primary actions:**
- **Appearance:** Choose System, Light or Dark. Apply the preference in the app.
- **Haptics:** Turn haptic feedback on or off.
- **Manual essentials switch:** Enable or disable essentials mode; when enabled, open essentials mode.
- **Battery threshold:** Choose a threshold from 5% to 50%; save the setting.
- **Language:** Open the language picker.

**Secondary actions:**
- **Privacy information:** Read the local-data and privacy explanation.
- **Back:** Return to the previous screen.

**Exits:** Language picker, essentials mode or previous screen. Settings are stored locally.

### 12.2 Language picker

**Purpose:** Set the app language.

**Entry points:** Settings > Language; Welcome language line.

**Elements, top to bottom:**
1. Current language.
2. Phone-default option.
3. Shipped language options.
4. Back action.

**Primary action — Choose a language:** Apply the selected language and return to Settings.

**Secondary action — Back:** Return without changing the language.

**Exits:** Settings.
