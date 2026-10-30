# Trip files (.satchel), T15

- Format: one JSON object, `format: "satchel-trip"`, `version: 1` (src/core/tripfile.ts). It holds the trip, its
  bookings, saved places, packing list and the bookings' attachments as base64. Vault documents, the emergency card
  and medical notes are never written to it. A newer version is refused with `error.import.version`.
- Export: trip screen, "Export trip". Writes `<trip name>.satchel` to the cache folder and opens the share sheet.
- Import: Trips list, "Import a trip" (document picker, any file type). Every id is new, so importing twice gives
  two trips. All-or-nothing: a failed check or write leaves the phone unchanged.
- **Import on open (not done yet).** Tapping a `.satchel` file in Files or Messages to open it in Satchel needs the
  document type declared in app.json (iOS `CFBundleDocumentTypes` + an exported UTI such as `app.satchel.trip`
  conforming to `public.json`; Android intent filter) and a handler for the incoming URL. That needs a dev build,
  so it waits for the TRIAL milestone; until then the picker path is the way in.
- **T45 (26 Oct):** an imported trip whose name matches a trip on the phone (trimmed, any case) is renamed
  `<name> (copy)`, then `(copy 2)`, ... (`uniqueTripName`, catalogue strings `tripfile.copyName[N]`). The packing
  list is saved with a checked write (`setPersistedChecked`); if that write fails the new trip is deleted again and
  the import reports `error.import.save`, so nothing is left half-imported. Import on open moved to T46.
