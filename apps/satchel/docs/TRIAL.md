# Trying Satchel on your iPhone (Expo Go)

> 30 Oct 2026: PR 105 is merged and testing moves to **TestFlight** once the one-time iOS signing step is done (`npx eas-cli credentials -p ios` on the PC). The questions below apply the same in TestFlight; ignore the Expo Go-only steps.

Satchel runs in **Expo Go** (SDK 58) until the native offline map needs a development build.

## The 4 steps
1. Install **Expo Go** from the App Store on your iPhone.
2. Your PC's auto-start installs, checks and serves Satchel on port 8098 (`Desktop\Apps\_auto\STATUS.txt` shows "satchel ... ready"). On your iPhone open **Expo Go > Recently opened > Satchel**, or scan the QR code from the Satchel window in `Desktop\Apps\satchel`.
3. Try the demo trip, then turn on **flight mode** and try again.
4. Comment on the Satchel Build page with anything that looks wrong (the yes/no questions below help).

Fallback only, if the PC auto-start is not serving Satchel: the Satchel Build page also has a **Download trial kit** button with the same code.

Nothing here is confirmed on a real phone until you say so.

## New since your last test
- 31 Oct (run 83, your TestFlight feedback): real offline city maps, every country's emergency numbers filled, a new Toilets tab, and a full design pass. Install the newest Satchel build from TestFlight (it may arrive as an update inside the app: close and reopen Satchel twice).
  - **A. Map.** Map tab > Offline city maps: does it list cities (Kyoto, Tokyo, Sydney) with a size and a Download button? If it says the city maps are still being published, that part isn't live yet (yes/no)
  - Download Kyoto, then turn on flight mode and tap Show on map: does the Kyoto map still draw streets and labels, with "© OpenStreetMap contributors" on it? (yes/no)
  - With Wi-Fi or mobile data on, does the normal map show everywhere else? Is the "comes with the full build" message gone everywhere? (yes/no)
  - **B. Emergency numbers.** Emergency tab: pick Afghanistan, then Angola: does each show police, ambulance and fire numbers with a source, a date and "verify locally"? Can you find any country with no number at all? (yes/no)
  - **C. Toilets.** Toilets tab > Find toilets near me: does it list nearby toilets with distance, a walking direction and details like Free, Wheelchair or Changing table where known? (yes/no)
  - Does "Open in Apple Maps" open walking directions to that toilet? (yes/no)
  - In flight mode inside a downloaded city (e.g. Kyoto, use Near my hotel on the demo trip): does it still find toilets "from your offline Kyoto map"? (yes/no)
  - **D. Look.** Do Trips, Map, Wallet, Emergency and Toilets now have coloured hero headers and richer cards (boarding-pass trip cards, countdown, local time, quick actions in Wallet), in both light and dark mode? Does anything still feel flat or grey? (yes/no)
  - Do screens and cards fade in smoothly, with no bounce? (yes/no)
- 26 Oct (run 27): an imported trip with the same name as one you already have is now called "<name> (copy)", so the two are easy to tell apart.
  - Import a trip you already have: is the new one named "<name> (copy)"? (yes/no)
- 26 Oct (run 26): you can send a trip to someone (or to yourself) as a `.satchel` file, and bring one in. Trip screen > **Export trip** opens the share sheet (AirDrop, Messages, Files); Trips > **Import a trip** picks the file and opens it as a new, separate trip. Documents, the emergency card and medical notes are never put in the file. Opening a `.satchel` straight from Messages or Files isn't wired up yet; use Import a trip.
  - On a trip with an attached ticket, does Export trip open the share sheet with a file named after the trip, ending in .satchel? (yes/no)
  - Import that file: does a second, separate copy of the trip open with its bookings, ticket image, saved places and packing list? (yes/no)
  - Pick a file that isn't a trip (e.g. a PDF): does it say "Trip couldn't be imported" and leave your trips unchanged? (yes/no)
- 26 Oct (run 24): timeline items that clash in time now say "Overlaps with …" on the row and on the item's page (nothing is moved), a finished trip opens with a "Past" note, the ticket view has a Copy booking reference button, the hotel address card has an Edit action, more emergency numbers carry a "Number doubted — check locally" line (a second model run disagreed), and the battery prompt now triggers at exactly your threshold (e.g. at 20%, not just below).
  - Give two demo items overlapping times: do both rows say "Overlaps with …"? (yes/no)
  - Open a ticket that has a booking reference: does Copy booking reference copy it and say so? (yes/no)
  - Open a hotel's address card: does Edit hotel address open the hotel's form? (yes/no)
- 25 Oct (run 14): a quiet "Language: English · Change" line under the Trips heading on first launch (it shows for that one session and goes as soon as you tap Change), and Settings now starts with a Language section (Phone default or English; more languages arrive later).
  - On the first open after updating, is there a "Language: English · Change" line on Trips that you can ignore without anything popping up? (yes/no)
  - Tap Change: does it open Settings with Language at the top, and is the line gone when you go back? (yes/no)
  - Close Satchel fully and reopen it: is the line gone for good? (yes/no)
- 25 Oct (run 6): Satchel now targets **Expo SDK 58**, the version your Expo Go runs (it was on 57 and would not have opened). The demo trip now comes with a sample boarding pass, a sample passport page in Documents and sample emergency-card details (all marked SAMPLE, all invented), and Light/Dark in Settings also applies to system pop-ups and the keyboard where iOS allows it. If you already have the demo trip, delete it and tap "Add the demo trip" to get the samples.
  - Does Satchel open in Expo Go at all (no "incompatible SDK" message)? (yes/no)
  - Does the demo flight's ticket open at full brightness showing the SAMPLE code? (yes/no)
  - Documents: is there a "Sample passport (demo)" that opens after Face ID or your passcode? (yes/no)
  - Emergency tab: does the card show "Sample Travel Cover (demo)" and a sample contact? (yes/no)
  - Settings → Appearance → Dark with your phone in light mode: are pop-ups like "Discard your changes?" dark too? (yes/no)
  - Map: tap "Show all trips", go back to the trip and tap "Trip map": is it scoped to that trip again? (yes/no)
- 25 Oct (run 5): date and time pickers with a searchable time-zone list, an Appearance setting (System / Light / Dark), "Number doubted — check locally" lines on emergency numbers a second review questioned, saved places on each trip's timeline with a trip-only map, a Phone field for hotels, and forms that keep what you typed if a save fails.
  - Add a flight: does tapping the date and the time open a picker you can use one-handed, with the time shown as "… Tokyo time"? (yes/no)
  - In the time-zone field, does searching "Kyoto", "Japan" or "UTC+9" find Tokyo? (yes/no)
  - Settings → Appearance: does Light or Dark change the whole app straight away and stay after reopening? (yes/no)
  - Emergency tab for a flagged country (e.g. Bahamas): does the doubted number show "Number doubted — check locally", and does VoiceOver read it out? (yes/no)
  - In essentials mode, is the doubted line still readable? (yes/no)
  - Does a trip's timeline list its saved places, and does "Trip map" show only that trip's pins, with "Show all trips" bringing the rest back? (yes/no)
  - Does the hotel Phone field bring up the phone keypad, and does the number get a Call button on the address card? (yes/no)
  - With unsaved changes on the emergency card, a document or a packing list, does Back ask "Discard your changes?" (yes/no)
  - After deleting a booking that had a ticket file, is the file gone from the Wallet? (yes/no)
- 24 Oct (run 4): a flight-mode banner on the Trips screen, a fuller Settings screen (haptics, essentials switch and threshold, "Data Not Collected"), a way back to your trips from an empty Wallet, a welcome card, clearer booking forms that ask before discarding changes, an emergency shortcut on Trips, Copy address on the hotel card, adding a template to a packing list, and saving places from the map.
  - Turn on flight mode and open your ticket from the demo trip: does it open at full brightness with the QR? (yes/no)
  - With flight mode on, does the Trips screen show "Flight mode: tickets, cards and documents still work"? (yes/no)
  - Turn flight mode off again and come back to Satchel: does the banner go away? (yes/no)
  - Settings → Low-battery essentials: do the minus and plus buttons change "Offer essentials at … battery or lower", stopping at the lowest and highest settings? (yes/no)
  - Leave Settings and come back: is your threshold still the one you chose? (yes/no)
  - Turn on "Low-battery essentials mode" in Settings: does essentials open, and does the Trips screen remind you it is on until you turn it off? (yes/no)
  - Turn Haptics off in Settings: do taps stop vibrating? (yes/no)
  - Does Settings show "Data Not Collected" with a plain list of what stays on your phone? (yes/no)
  - With VoiceOver on, do the Settings switches read their name and On or Off, and the threshold buttons say what they do? (yes/no)
  - On first launch, does the welcome card appear above your trips, and does "Try the demo trip" open the Tokyo & Kyoto timeline? (yes/no)
  - Add a flight: does the form say "New flight" and repeat the date and time back with the city's time zone? (yes/no)
  - Edit a booking, change a field, then tap Back or Cancel: are you asked "Discard your changes?", and does Keep editing keep what you typed? (yes/no)
  - Does "Emergency card" on the Trips screen open the Emergency tab in one tap, with flight mode on? (yes/no)
  - On the hotel address card, does Copy address paste correctly into a message? (yes/no)
  - On the demo packing list, does "Add a template" add items without duplicating ones already there? (yes/no)
  - Map tab: tap a sample pharmacy, then Save place: does it appear under "Saved places", still marked as sample data? (yes/no)
  - Tap an empty spot on the map, save it, then Remove from trip: are you asked to confirm, and does the pin go? (yes/no)
- 24 Oct (run 3): low-battery essentials mode, the Map tab, a new app icon with a short start-up fade, and clearer "permission off" notices.
  - Tap Essentials on the Trips screen: is the screen fully black with the next ticket, the hotel address and the emergency card? (yes/no)
  - From essentials, open the ticket and close it: are you back on the black essentials screen? (yes/no)
  - At or below 20% battery and unplugged, does a banner offer essentials mode, and does "Not now" keep it away until you plug in? (yes/no)
  - Map tab (with signal): do the demo hotels and the sample points show, and do the category buttons hide and show them? (yes/no)
  - Tap "Where am I?" once: does it show you on the map without asking again or tracking you afterwards? (yes/no)
  - Turn off Photos access for Expo Go, then attach a ticket photo: do you get a plain reason with Open Settings and "Attach from Files instead"? (yes/no)
  - Does the app open with the new satchel mark and no white flash, in light and dark mode? (yes/no)
- 24 Oct: first build. Four tabs (Trips, Map, Wallet, Emergency; Map, Wallet and Emergency are placeholders for now), the demo trip Sydney → Tokyo → Kyoto starting 3 days from first launch, a Next up card, each trip as a day-by-day timeline with warnings for nights with no bed and clashing bookings, and add / edit / delete bookings (flight, train, ferry, bus, hotel, car hire, activity, note) with times in each place's own time zone.
  - Does the app open straight to "Your trips" without a white flash or a raw "index" title? (yes/no)
  - Does the Next up card show the demo flight, with the right time until it leaves? (yes/no)
  - Open the demo trip: do the flight times read 09:30 Sydney and 17:45 Tokyo? (yes/no)
  - Add a flight Tokyo 21:00 → Honolulu 09:25 the same day (zones Asia/Tokyo and Pacific/Honolulu): does it save and show 7h 25m? (yes/no)
  - Delete the Kyoto hotel: does the trip warn about nights with no bed? (yes/no)
  - With flight mode on, does everything above still work? (yes/no)
  - Does dark mode follow your phone? (yes/no)
