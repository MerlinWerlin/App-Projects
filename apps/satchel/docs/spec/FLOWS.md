# FLOWS.md

## TRIAL scope and shared behaviour

- All trip, item, attachment, document, emergency-card and packing-list data is stored on the device. No account or network connection is required for those flows.
- The demo trip is available on first launch. The user can edit or delete it like any other trip.
- Use the device’s current light or dark appearance unless the user chooses a fixed appearance in Settings.
- Keep tap targets at least 48 pt. Use plain language, readable contrast and clear confirmation before destructive actions.
- Device permission prompts appear only when the user starts a feature that needs them. Explain why before requesting permission. Location is a single foreground check on request; it is never tracked in the background.
- System pickers and authentication prompts are platform interfaces. On cancellation, return to the screen that opened them without losing entered data.
- Each screen’s exits include system back navigation unless otherwise noted.

## 1. First launch and demo trip

### 1.1 Welcome

**Purpose:** Explain what the app does and make the demo immediately available.

**Entry points:** First app launch with no local setup completed.

**Elements, top to bottom:**
1. Satchel wordmark and short description: “A travel wallet that works in flight mode.”
2. Brief explanation that trips and saved files stay on this device.
3. “Try the demo trip” primary button.
4. “Start with my own trip” secondary button.
5. Privacy note: no account required; location is checked only when requested.

**Primary action — Try the demo trip:**
- Create or open the local Sydney → Tokyo → Kyoto demo trip, including sample timeline items, a hotel address, sample map places and a packing list.
- Mark the first-launch setup complete.
- Open the demo trip timeline.

**Secondary action — Start with my own trip:**
- Mark the first-launch setup complete.
- Open the new-trip form.

**Exits:** App close; either button leads into the app.

### 1.2 Demo trip introduction

**Purpose:** Help the user recognise sample content and start exploring.

**Entry points:** First opening of the demo trip.

**Elements, top to bottom:**
1. Demo label explaining that the trip contains sample information.
2. Trip route: Sydney → Tokyo → Kyoto.
3. Short note to replace sample details before relying on them.
4. “Open trip” primary button.
5. “Remove demo trip” secondary button.

**Primary action — Open trip:** Open the trip timeline.

**Secondary action — Remove demo trip:** Show a confirmation. On confirmation, remove the demo trip and open the trips list with an empty-state prompt to create a trip. On cancellation, stay here.

**Exits:** “Open trip”, “Remove demo trip”, or back to the trips list.

## 2. Trips list

### 2.1 Trips

**Purpose:** Show saved trips and provide access to the emergency card and other app areas.

**Entry points:** App launch after setup; Trips tab; successful trip creation or import.

**Elements, top to bottom:**
1. Screen title, “Trips”.
2. Emergency-card shortcut.
3. Upcoming and past trip groups, each showing trip name, dates and route.
4. Empty-state message and “Create a trip” button when there are no trips.
5. Floating or bottom “New trip” action.
6. Tab navigation: Trips, Map, Wallet, Emergency.

**Primary actions:**
- **Tap a trip:** Open its timeline.
- **Tap New trip / Create a trip:** Open the new-trip form.
- **Tap Emergency:** Open the emergency card.
- **Tap Map:** Open Map v0.
- **Tap Wallet:** Open the document vault.
- **Tap and hold or use a trip’s menu:** Show Edit, Export and Delete actions.

**Secondary actions:**
- **Edit:** Open the trip form with existing values.
- **Export:** Create a trip export file and open the system share sheet. If export fails, show an error and keep the trip unchanged.
- **Delete:** Ask for confirmation; on confirmation delete the trip and its locally stored trip content. On cancellation, return to the list.

**Exits:** Open a trip, create or edit a trip, open Emergency, Map, Wallet or Settings. Settings is available from the app navigation/menu.

### 2.2 New or edit trip

**Purpose:** Add or update the trip’s basic details.

**Entry points:** New trip action; trip menu → Edit.

**Elements, top to bottom:**
1. Title: “New trip” or “Edit trip”.
2. Trip name field.
3. Start and end date fields.
4. Optional route or destination summary field.
5. Save button.
6. Cancel or back action.

**Primary action — Save:**
- Validate required fields and date order.
- Save locally.
- For a new trip, create its timeline and one packing list; offer to add the first item.
- For an edit, return to the trip timeline with updated details.
- If validation fails, keep the form open and identify the field to correct.

**Secondary action — Cancel:** Discard unsaved changes after confirmation if any fields have changed.

**Exits:** Save to the trip timeline or cancel to the previous screen.

## 3. Trip timeline

### 3.1 Timeline

**Purpose:** Show the trip’s days, bookings and notes in local time, with the next relevant item easy to find.

**Entry points:** Tap a trip; save a trip; back from an item or trip tool.

**Elements, top to bottom:**
1. Trip name, date range and overflow menu.
2. “Next up” card when an upcoming item exists. Show its local date/time, kind and summary.
3. Day selector or day headings, grouped by each item’s local calendar day.
4. Items in time order. Show the item’s time zone where useful and indicate overlaps without silently changing times.
5. Per-day or floating “Add item” action.
6. Shortcuts to Map and Packing list.
7. Empty-day or empty-trip prompt when appropriate.

**Primary actions:**
- **Tap Next up or a timeline item:** Open item details.
- **Tap Add item:** Open the item-kind chooser.
- **Tap Map:** Open Map v0 centred on the trip’s demo city or saved places where available.
- **Tap Packing list:** Open the trip’s packing list.
- **Tap trip header or menu → Edit trip:** Open the trip form.

**Secondary actions:**
- **Item menu → Edit:** Open the relevant item form populated with current values.
- **Item menu → Delete:** Confirm; on confirmation delete the item and its local attachments. On cancellation, stay on the timeline.
- **Item menu → Move to another day:** Choose a day and save; retain the item’s own time zone and local time.
- **Tap a hotel address shortcut, if present:** Open the hotel address card.

**Time handling:** Display and group an item using its own IANA time zone. If the zone is unavailable or invalid, ask the user to choose a valid time zone before saving. Do not convert an entered local time into a different displayed local time without making the zone clear.

**Exits:** Open item detail, add or edit an item, Map, Packing list, trip settings, or Trips list.

### 3.2 Add-item kind chooser

**Purpose:** Start manual entry for one of the supported item kinds.

**Entry points:** Timeline → Add item.

**Elements, top to bottom:**
1. Title, “Add to trip”.
2. Kind choices: Flight, Train, Ferry, Bus, Hotel, Car hire, Activity, Note.
3. Cancel action.

**Primary action — choose a kind:** Open that kind’s add form.

**Secondary action — Cancel:** Return to the timeline without creating an item.

**Exits:** Selected item form or timeline.

## 4. Add and edit items

### Shared item-form behaviour

Each form has a title identifying its kind, a Save action, and a Cancel/back action. Preserve entered values if the user opens an attachment picker and returns. Save items locally. For edits, prefill existing values and keep existing attachments unless the user removes them. Validate required fields and show errors beside the relevant fields. Offer an attachment action on supported forms. The time-zone field is per item and uses an IANA time-zone selection; show the selected zone beside local date/time.

### 4.1 Flight

**Purpose:** Save flight details for the trip.

**Entry points:** Add-item kind chooser → Flight; edit a flight item.

**Elements, top to bottom:**
1. Airline or service name field (free text).
2. Flight number field (optional).
3. From and to fields.
4. Departure date and local time.
5. Arrival date and local time.
6. Time-zone selection for the item; allow the user to specify the relevant zone for each endpoint if needed.
7. Booking reference field (optional).
8. Notes field (optional).
9. Add attachment action.
10. Save.

**Primary action — Save:** Validate and save; return to timeline. On a new flight, open item details if a ticket attachment or QR crop needs setting up.

**Secondary actions:** Attach a file or image using the attachment flow; Cancel to return without saving.

**Exits:** Timeline after save or cancel; attachment picker and back to the form.

### 4.2 Train

**Elements, top to bottom:**
1. Operator or service name field (free text).
2. Train number field (optional).
3. From and to fields.
4. Departure and arrival dates and local times.
5. Time-zone selection.
6. Booking reference (optional).
7. Notes (optional).
8. Add attachment.
9. Save.

**Actions and exits:** Save validates and returns to the timeline; attachment opens the attachment flow; Cancel returns without saving.

### 4.3 Ferry

**Elements, top to bottom:**
1. Operator or service name field (free text).
2. From and to ports.
3. Departure and arrival dates and local times.
4. Time-zone selection.
5. Booking reference (optional).
6. Notes (optional).
7. Add attachment.
8. Save.

**Actions and exits:** Save validates and returns to the timeline; attachment opens the attachment flow; Cancel returns without saving.

### 4.4 Bus

**Elements, top to bottom:**
1. Operator or service name field (free text).
2. From and to fields.
3. Departure and arrival dates and local times.
4. Time-zone selection.
5. Booking reference (optional).
6. Notes (optional).
7. Add attachment.
8. Save.

**Actions and exits:** Save validates and returns to the timeline; attachment opens the attachment flow; Cancel returns without saving.

### 4.5 Hotel

**Purpose:** Save accommodation details and make its address easy to show to a driver.

**Elements, top to bottom:**
1. Hotel or accommodation name.
2. Check-in and check-out dates and times.
3. Time-zone selection.
4. Street address.
5. Local-language address field.
6. Phone number (optional).
7. Booking reference and notes (optional).
8. Add attachment.
9. Save.

**Primary action — Save:** Save locally and return to the timeline. The item becomes available from the hotel address card.

**Secondary actions:** Attach a file or image; Cancel without saving.

**Exits:** Timeline after save or cancel; attachment flow.

### 4.6 Car hire

**Elements, top to bottom:**
1. Company or provider field (free text).
2. Pick-up location and date/time.
3. Return location and date/time.
4. Time-zone selection.
5. Booking reference (optional).
6. Notes (optional).
7. Add attachment.
8. Save.

**Actions and exits:** Save validates and returns to the timeline; attachment opens the attachment flow; Cancel returns without saving.

### 4.7 Activity

**Elements, top to bottom:**
1. Activity name.
2. Location.
3. Start and optional end date/time.
4. Time-zone selection.
5. Booking reference (optional).
6. Notes (optional).
7. Add attachment.
8. Save.

**Actions and exits:** Save validates and returns to the timeline; attachment opens the attachment flow; Cancel returns without saving.

### 4.8 Note

**Elements, top to bottom:**
1. Note title.
2. Note body.
3. Optional date/time and time-zone.
4. Add attachment (optional).
5. Save.

**Actions and exits:** Save returns to the timeline; attachment opens the attachment flow; Cancel returns without saving.

## 5. Attachments and ticket view

### 5.1 Add attachment

**Purpose:** Keep a ticket, booking document or image with its item.

**Entry points:** Add/edit item → Add attachment; item details → Add attachment.

**Elements, top to bottom:**
1. “Add attachment” title.
2. “Choose from Files” action.
3. “Choose photo” action.
4. Existing attachments, when editing, with remove controls.
5. Cancel action.

**Actions:**
- **Choose from Files:** Open the system document picker. Allow supported PDFs and images. On selection, copy the file into local app storage and return to the item. If the file cannot be copied, show an error and keep the item unchanged.
- **Choose photo:** Request Photos access only if needed, then open the system photo picker. On selection, save a local copy and return. If access is declined or the picker is cancelled, return without adding anything.
- **Tap an existing attachment:** Open its preview or ticket view, depending on type.
- **Remove:** Ask for confirmation, then remove the local attachment from the item.
- **Cancel:** Return to the form or item details.

**Exits:** Return to the originating form or item details.

### 5.2 Attachment preview

**Purpose:** Read a saved PDF or image.

**Entry points:** Tap an attachment on an item.

**Elements, top to bottom:**
1. Back action and file name.
2. Full-page document or image preview.
3. “Show as ticket” action when the attachment is an image or PDF page suitable for ticket display.
4. Overflow actions: remove attachment; share/export a copy through the system share sheet.

**Actions:** Show as ticket opens the ticket setup or ticket view. Remove confirms before deleting the local copy. Share opens the system share sheet with the selected file. If a file is unavailable, explain that it cannot be opened and offer removal.

**Exits:** Back to item details; ticket view; system share sheet.

### 5.3 Ticket setup and QR crop

**Purpose:** Prepare a saved ticket image for quick, one-handed viewing.

**Entry points:** Attachment preview → Show as ticket; item details → Set up ticket.

**Elements, top to bottom:**
1. Ticket image or selected PDF page.
2. Crop frame and adjustment handles.
3. Preview of the saved crop.
4. “Save QR crop” action.
5. “Skip” and Cancel actions.

**Actions:**
- **Adjust crop:** Move or resize the frame around the QR code or barcode.
- **Save QR crop:** Store the crop locally with that ticket attachment and open Ticket view.
- **Skip:** Open Ticket view without a crop.
- **Cancel:** Return to the attachment preview without changing the saved crop.

**Exits:** Ticket view, attachment preview or item details.

### 5.4 Ticket view

**Purpose:** Show a ticket clearly at full screen and full brightness for scanning.

**Entry points:** Tap a ticket attachment or “Open ticket” from item details; save a QR crop.

**Elements, top to bottom:**
1. Close/back control and ticket name.
2. Saved QR crop, if present, large and unobstructed.
3. Ticket image or PDF page, fitted to screen.
4. Essential item details in a compact strip.
5. Optional brightness status or control.

**Actions:**
- **On open:** Request full brightness for the view; save the previous screen brightness where supported.
- **Tap the ticket image:** Toggle fit/fill or zoom.
- **Close/back:** Restore the previous brightness setting and return to the previous screen.
- **If the app backgrounds or the view closes:** Restore the previous brightness as soon as the app can do so.
- **If brightness adjustment is unavailable:** Keep the ticket usable and show no blocking error.

**Exits:** Close to item details or the attachment preview. Brightness must be restored on every exit.

## 6. Emergency card

### 6.1 Emergency card

**Purpose:** Put locally stored emergency information within one tap of the main app.

**Entry points:** Trips screen Emergency shortcut; Emergency tab; Essentials mode.

**Elements, top to bottom:**
1. “Emergency” title and selected country/region.
2. Local emergency numbers, each labelled with its purpose.
3. Source and date for the bundled numbers table; “Verify locally” reminder.
4. Insurance policy name/number and insurer phone, if entered.
5. Emergency contacts and phone numbers, if entered.
6. Private medical notes, if entered, clearly marked as stored on this device.
7. Edit action.

**Primary actions:**
- **Tap a number or phone field:** Offer the system phone action where available; do not place a call without a further system confirmation.
- **Tap Edit:** Open the emergency-card form.
- **Tap a contact:** Offer the phone action for that contact.

**Secondary actions:** Copy a number or detail; return to the previous screen. Do not imply that the bundled numbers are guaranteed current.

**Exits:** Back to the previous screen; Edit opens the form.

### 6.2 Edit emergency card

**Purpose:** Add or update private emergency information.

**Entry points:** Emergency card → Edit.

**Elements, top to bottom:**
1. Country/region selector.
2. Emergency-number reference with source/date and “Verify locally”.
3. Insurance policy and phone fields.
4. Emergency contacts: name and phone fields; add/remove contact actions.
5. Private medical notes field.
6. Save and Cancel.

**Actions:**
- **Change country/region:** Update the displayed bundled reference; retain user-entered details.
- **Add/remove contact:** Add a blank contact or confirm removal.
- **Save:** Store locally and return to Emergency card.
- **Cancel:** Discard unsaved changes after confirmation if changed.

**Exits:** Emergency card or previous screen.

## 7. Hotel address card

### 7.1 Hotel address card

**Purpose:** Show an accommodation address clearly to a taxi driver, including its local-language version.

**Entry points:** Hotel item → “Show address”; timeline hotel shortcut; Essentials mode.

**Elements, top to bottom:**
1. Hotel name.
2. Address in large, high-contrast text.
3. Local-language address in large text when provided.
4. Optional phone number.
5. “Copy address” action.
6. Edit hotel details action.

**Actions:**
- **Tap Copy address:** Copy the displayed address and show a brief confirmation.
- **Tap Edit:** Open the hotel item form.
- **Tap phone number:** Offer the system phone action where available.

**Exits:** Back to the hotel item or previous screen; Edit opens the hotel form.

## 8. Document vault and Face ID

### 8.1 Wallet / document vault lock

**Purpose:** Protect passport, visa and licence copies behind device authentication.

**Entry points:** Wallet tab; Essentials mode shortcut only if included by the user’s configured essentials.

**Elements, top to bottom:**
1. “Document vault” title and brief local-storage privacy note.
2. Lock status.
3. “Unlock with Face ID” or the platform’s available authentication label.
4. “Use device passcode” fallback where the platform provides it.
5. Cancel/back action.

**Actions:**
- **Unlock:** Request local device authentication. On success, open the vault. On failure, allow retry or device passcode fallback where available. Do not reveal document details while locked.
- **Cancel:** Return to the previous screen.

**Exits:** Vault after authentication; previous screen after cancellation.

### 8.2 Document vault

**Purpose:** View and manage locally stored identity documents and expiry dates.

**Entry points:** Successful authentication.

**Elements, top to bottom:**
1. “Document vault” title and lock action.
2. Expiry warnings for documents nearing or past expiry.
3. Saved documents grouped by type: Passport, Visa, Licence.
4. “Add document” action.
5. Note that documents stay on this device unless the user later enables iCloud sync.

**Actions:**
- **Tap a document:** Open its details and saved image/PDF.
- **Tap Add document:** Open the add-document form.
- **Tap Lock:** Immediately return to the locked screen and hide document contents.

**Exits:** Document details, add-document form, or locked screen.

### 8.3 Add or edit document

**Purpose:** Save a document copy and expiry reminder.

**Entry points:** Vault → Add document; document details → Edit.

**Elements, top to bottom:**
1. Document type selector: Passport, Visa, Licence.
2. Document label and optional issuing country.
3. Expiry date.
4. Add or replace image/PDF action.
5. Save and Cancel.

**Actions:**
- **Choose image/PDF:** Use the Files or Photos picker; copy the selected file to local storage.
- **Save:** Validate and store locally; return to the vault and show any expiry warning.
- **Cancel:** Discard unsaved changes after confirmation if changed.

**Exits:** Vault, document details or picker return.

### 8.4 Document details

**Purpose:** Read or update a saved document.

**Entry points:** Tap a document in the vault.

**Elements, top to bottom:**
1. Document type, label and expiry date.
2. Saved image or PDF preview.
3. Edit action.
4. Remove action.

**Actions:** Edit opens the document form. Remove asks for confirmation, then deletes the local record and file. Back returns to the vault.

**Exits:** Vault, edit form or preview.

## 9. Low-battery essentials mode

### 9.1 Essentials mode entry

**Purpose:** Offer a plain, dark, low-distraction screen with the next ticket, hotel address and emergency card.

**Entry points:** Manual Essentials switch in the app; automatic offer when device battery falls below 20%.

**Elements, top to bottom:**
1. Automatic-entry prompt when battery is below the threshold, with “Open essentials” and “Not now”.
2. Manual switch in Settings or the app menu.
3. Brief note: no animation or map in this mode.

**Actions:**
- **Open essentials:** Open the essentials screen.
- **Not now:** Dismiss the prompt; normal app use continues.
- **Manual switch on:** Open essentials immediately.
- **Manual switch off:** Return to the screen from which it was enabled.

**Exits:** Essentials screen, dismiss to previous screen, or return to normal app.

### 9.2 Essentials screen

**Purpose:** Make a few critical trip details quick to reach.

**Entry points:** Automatic prompt accepted; manual mode enabled.

**Elements, top to bottom:**
1. Pure black background with white text; no animation and no map.
2. “Next ticket” card, if an upcoming ticket exists.
3. Hotel address card, if a hotel is saved.
4. Emergency card.
5. “Exit essentials” action.

**Actions:**
- **Tap Next ticket:** Open Ticket view, including brightness handling. Closing the ticket returns to Essentials.
- **Tap Hotel address:** Open the hotel address card.
- **Tap Emergency:** Open the emergency card.
- **Exit essentials:** Return to the originating screen and normal appearance.
- **If a section has no saved information:** Show a short prompt linking to the relevant setup screen; never invent details.

**Exits:** Ticket view, hotel address card, emergency card, relevant setup screen, or originating screen.

## 10. Packing lists

### 10.1 Trip packing list

**Purpose:** Track items to pack for one trip and start from a suitable template.

**Entry points:** Trip timeline → Packing list; first packing-list shortcut for a trip.

**Elements, top to bottom:**
1. Trip name and “Packing list”.
2. Progress count.
3. Template selector when no list has been created, with trip-type choices.
4. Checklist rows with item name and checkbox.
5. Add item action.
6. Clear or reset completed items action, if available.

**Actions:**
- **Choose template:** Add template items to the trip’s list; allow edits afterwards.
- **Tap checkbox:** Mark item packed/unpacked and update progress locally.
- **Tap item text or its menu:** Edit or remove the item.
- **Add item:** Open a short add-item form.
- **Reset completed items:** Confirm, then uncheck completed rows without deleting them.

**Exits:** Back to the trip timeline; add/edit form; template selection.

### 10.2 Add or edit packing item

**Purpose:** Add or rename a checklist entry.

**Entry points:** Packing list → Add item; item menu → Edit.

**Elements, top to bottom:**
1. Item name field.
2. Save action.
3. Cancel action.

**Actions:** Save adds or updates the row and returns to the list. Cancel returns without saving.

**Exits:** Packing list.

## 11. Map v0

### 11.1 Map

**Purpose:** Preview the map experience, saved places and demo-city points of interest. The TRIAL map uses the system map and is online in Expo Go; it is not the later offline map.

**Entry points:** Map tab; trip timeline → Map.

**Elements, top to bottom:**
1. Map area with saved places, trip bookings and bundled demo-city points where available.
2. Map controls and “Where am I?” button.
3. Category toggles: Toilets, Drinking water, Fuel, Food, Pharmacy, ATM, Hospital.
4. “Save place” action for the selected map location or pin.
5. Selected-place card, shown after tapping a pin.
6. Map/data availability note where needed.

**Primary actions:**
- **Tap Where am I?:** Explain that location is checked once while the map is open, then request foreground location permission if needed. If granted, make one location request and centre the map on the returned position. Do not continue watching location. If declined, stay on the map and explain that the user can enable permission in device settings.
- **Tap a category toggle:** Show or hide that category’s pins.
- **Tap a pin:** Open its selected-place card with its name, category and available address/details.
- **Tap Save place:** Save the selected place locally to the current trip; if no trip is selected, ask the user to choose one.
- **Tap a booking pin:** Open the related item details.

**Secondary actions:**
- **Tap a saved place:** Open its details and provide a remove-from-trip action.
- **Tap a map location:** Select that location where supported.
- **Location unavailable:** Show a brief message and leave the map usable.
- **Map tiles unavailable:** Show the system map’s available state; do not suggest that the TRIAL map works offline.

**Exits:** Trips tab, trip item details, selected place details or location permission prompt.

### 11.2 Save or remove place

**Purpose:** Keep a useful map location with a trip.

**Entry points:** Map selected-place card → Save place; saved-place details → Remove.

**Elements, top to bottom:**
1. Place name and category.
2. Trip selector when no trip is active.
3. Optional editable place name.
4. Save or Remove action.
5. Cancel/back action.

**Actions:** Save stores the place on the selected trip. Remove confirms before deletion. Cancel returns to the map.

**Exits:** Map.

## 12. Settings

### 12.1 Settings

**Purpose:** Control local display and feedback preferences and access essentials mode.

**Entry points:** Settings from app navigation/menu.

**Elements, top to bottom:**
1. “Settings” title.
2. Appearance: System, Light, Dark.
3. Haptics on/off switch.
4. Low-battery essentials mode switch and current automatic threshold explanation (“below 20%”).
5. Privacy and on-device storage note.
6. App information and emergency-number source/date reference, where available.

**Actions:**
- **Choose System / Light / Dark:** Apply the appearance immediately and save the preference locally.
- **Toggle haptics:** Enable or disable supported tactile feedback and save locally. When off, do not produce app-triggered haptics.
- **Toggle manual essentials mode:** On opens Essentials; off returns to the previous screen.
- **Tap privacy note:** Open a short explanation that there are no accounts or backend and that saved content stays on the device.
- **Tap emergency-number reference:** Show the bundled source and date with the reminder to verify locally.

**Exits:** Back to the previous screen; Essentials when enabled.

## 13. Navigation and interruption handling

- Back navigation returns to the screen that opened the current flow wherever possible.
- If the user leaves a form with unsaved changes, ask whether to discard them. Choosing to stay keeps the form and entered values.
- If a picker, authentication prompt or permission request is cancelled, return to the initiating screen without creating incomplete data.
- If the device is offline, trips, saved items, attachments, emergency details, vault content and packing lists remain available locally. The TRIAL system map may not load without connectivity.
- Do not request background location permission. “Where am I?” performs one foreground location check per user request.
