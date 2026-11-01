# Backup and restore (.satchelbackup), T17

So changing phones never loses trips. Settings > Backup and restore (app/backup.tsx); pure core in
src/core/backup.ts (tests in backup.test.ts), device side in src/native/backup.ts.

## Format (version 1)
One JSON object, written to the cache folder as `Satchel backup YYYY-MM-DD.satchelbackup` and handed to the share
sheet (Save to Files, iCloud Drive, AirDrop, Mail):

| field | meaning |
| --- | --- |
| `format` | always `"satchel-backup"` |
| `version` | `1`. A file with a higher version is refused ("Made by a newer Satchel"); nothing is guessed |
| `app` | app version that made it (preview only) |
| `created` | ISO time it was made |
| `docDir` | the old phone's documents folder, so stored file paths are moved onto the new install's folder |
| `includesDocuments` | whether the vault is in it |
| `keys` | every AsyncStorage key starting `satchel.`, value exactly as stored (text) |
| `files` | `[{ path, size, sha256, data }]`: Satchel's own files as base64, `path` relative to the documents folder |
| `counts` | trips, items, files, documents, keys, bytes (preview; recomputed on read) |

The file is written in parts (head, one file entry at a time with append, tail), so only one file's base64 is in
memory while backing up. Above 100 MB the screen warns first; a picked file over 400 MB is refused before reading.

## What is in it
- Every `satchel.*` store: trips with bookings, places, spending, journal, ideas, to-dos..., packing lists, the
  emergency card and medical notes, medicines, loyalty cards, help cards, stays, rentals, lost-bag records, kids,
  postcards, leaving-home codes, settings and the other phone-only lists. New stores are picked up automatically
  (the backup reads all keys by prefix, not a fixed list).
- Files under `<documents>/attachments/` (booking files, QR crops, journal, receipt, bag and car photos).
- **Documents vault** (`satchel.vault.v1` and `<documents>/vault/`) only when "Include documents" is on. Off by
  default; when on, the screen warns that the file then holds unlocked passport copies and should be kept private.

## What is left out (src/core/backup.ts, tested)
- `satchel.weather.v1.*` forecast caches (fetched again when online).
- `satchel.trips.v1.unreadable` (this phone's recovery copy of a damaged list).
- `satchel.backup.v1` (this phone's own backup record: last date, the documents switch, dismissed reminders).
- `<documents>/maps/` offline city map packs and their catalog (download again).
- Keys of other libraries (anything without the `satchel.` prefix).

## Restore
Restore from a file (document picker) -> checks -> preview (made on, app version, trips, bookings, files, size,
documents) -> Merge or Replace.
- Checks: not JSON / not this format -> "That isn't a Satchel backup" (a `.satchel` trip file says to use Import a
  trip); newer version -> refused; cut off, a key outside `satchel.`, a bad path (`..`, outside attachments/vault),
  or a file whose size or SHA-256 doesn't match -> "This backup is damaged". Nothing changes on any refusal.
- **Merge** keeps both sides. Lists of records with ids (trips, documents, contacts...) are joined by id; on the same
  id the newer `updatedAt` wins when both have one, otherwise the backup's. Objects merge key by key; other values
  take the backup's.
- **Replace** (asks first) makes the phone match the backup; phone keys not in it are removed, except the vault
  when the backup has no documents, the caches and the backup record.
- Files are written first, then the keys; if a key write fails the changed keys are put back. Then the app starts
  again (expo-updates `reloadAsync`; in Expo Go the dev reload) so every screen reads the restored data; if that
  can't happen the screen asks to close and reopen Satchel.

## Reminder
One dismissable line on the Trips home when an own trip (not the demo) starts within 7 days and no backup was made
on this phone in the last 30 days. Dismissing hides it for that trip for good.

## Later: live iCloud sync
Automatic sync between the user's own devices is CloudKit (private database), which needs a native module and
the iCloud capability in a dev build (PLAN §3 SYNC, a Plus feature). The backup file is the free, offline path
until then; the same key/file model can feed a CloudKit record per store later. Opening a `.satchelbackup` from
Files straight into Satchel also needs the document type registered (like `.satchel`, see docs/TRIPFILE.md).
