# Trip files (.satchel), T15

- Format: one JSON object, `format: "satchel-trip"`, `version: 1` (src/core/tripfile.ts). It holds the trip, its
  bookings, saved places, packing list and the bookings' attachments as base64. Vault documents, the emergency card
  and medical notes are never written to it. A newer version is refused with `error.import.version`.
- Export: trip screen, "Export trip". Writes `<trip name>.satchel` to the cache folder and opens the share sheet.
- Import: Trips list, "Import a trip" (document picker, any file type). Every id is new, so importing twice gives
  two trips. All-or-nothing: a failed check or write leaves the phone unchanged.
- **Import on open (T46, done in T14, 1 Nov).** app.json declares the exported UTI `app.satchel.trip` (conforms to
  `public.json` and `public.data`, extension `satchel`) and a `CFBundleDocumentTypes` entry for it (rank Owner), plus
  an Android VIEW intent filter. Tapping a `.satchel` file in Files, Mail or Messages (or Share > Satchel) opens
  Satchel, which copies it in and imports it with the same all-or-nothing code as the picker
  (`importTripText`, src/state/tripTransfer.ts), then opens the new trip. Needs a TestFlight build made from this
  app.json; Expo Go and older builds keep the picker path. See docs/OPEN_IN.md.
- **T45 (26 Oct):** an imported trip whose name matches a trip on the phone (trimmed, any case) is renamed
  `<name> (copy)`, then `(copy 2)`, ... (`uniqueTripName`, catalogue strings `tripfile.copyName[N]`). The packing
  list is saved with a checked write (`setPersistedChecked`); if that write fails the new trip is deleted again and
  the import reports `error.import.save`, so nothing is left half-imported. Import on open moved to T46.
- **T68 (31 Oct): journal photos.** The journal (T64) always travels as text. "Include journal photos" on the export
  (off each time; shown only when the journal has photos, with a size note: count and about how big, base64
  included) adds each photo's bytes to an optional top-level `journal_photos` array (same shape as `attachments`,
  no crop), and the page lists them in `photoFiles` (`{id, name, mime, size?}`). Photos that can't be read or would
  push the file past the import limit stay out and are counted in the page's `photoCount`. Every listed photo must
  have its bytes once, or the file is refused as damaged. On import the photos get new ids and are written to
  attachments/ (all-or-nothing, like booking files); if the file left any out, the trip opens with a notice saying
  how many stayed on the sender's phone. T15/T64 files have neither field and import as before.
- **T74 (31 Oct): airport fields.** A flight booking may carry an optional `airport` object on its item: `terminal`,
  `gate`, `boarding` and `bagDrop` ('HH:mm' on the departure airport's clock, the item's start zone), `scope`
  (`domestic` | `international`), `bufferMin` and `travelMin` (whole minutes). The file version stays 1: older files
  have no `airport` and import as before; a value this build can't read is dropped field by field (never a reason to
  refuse the trip), and keys it doesn't know, inside `airport` or on the item, are kept (`readAirport`,
  src/core/leaveby.ts).
