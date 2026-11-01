# Save to Satchel: Open in / Copy to Satchel (T14, folds in T46)

Owner brief owner-1101s item 4: share a booking email, PDF or text into a trip. Done with iOS document types, not a
share-extension target (see "Later" below).

## How it works
1. **app.json** declares what Satchel can open: `CFBundleDocumentTypes` for PDF (`com.adobe.pdf`), images
   (`public.image`), plain text (`public.plain-text`), email messages (`com.apple.mail.email`, `public.email-message`)
   and Satchel trips (`app.satchel.trip`, exported in `UTExportedTypeDeclarations`, extension `.satchel`, conforms to
   `public.json` / `public.data`). `LSSupportsOpeningDocumentsInPlace` is false, so iOS hands Satchel a copy.
   Android: one VIEW intent filter (content:// and file://) for the same MIME types.
2. The traveller taps **Share > Satchel** (or **Copy to Satchel** under More) on a file. iOS opens Satchel with a
   `file://` URL.
3. **app/+native-intent.tsx** (`redirectSystemPath`) turns any file:// or content:// URL into `/openin?uri=...`
   (`incomingRedirect`, src/core/openin.ts), so expo-router never tries to match it as a path. **app/+not-found.tsx**
   is the safety net: an unmatched link shows a friendly screen, and a file URL that slipped through goes on to Open in.
   The root layout sets `unstable_settings.initialRouteName = '(tabs)'`, so a screen opened from outside always has
   Trips under it.
4. **app/openin/index.tsx** copies the file into `<documents>/incoming/` first (src/native/openin.ts; iOS's own
   Documents/Inbox copy is then deleted, incoming copies older than a day are pruned), reads its first 512 bytes, and
   decides the kind (`decideKind`: extension, then UTI / MIME, then the bytes) and the route (`routeFor`):
   - **email (.eml) or text** -> Paste a booking (app/paste-booking.tsx) with the text already in the box. For an
     email, Subject / From / Date go first, then the text/plain part (quoted-printable, base64, nested multipart and
     RFC 2047 headers handled), or the text/html part turned into text when there is no plain part (`parseEml`).
   - **PDF or image** -> Add to a trip (app/openin/add.tsx): pick the trip and kind, then the normal new-booking form
     opens with the file in Attachments (copied into attachments/, the same storage as the form's own picker).
     Nothing is saved until Save; leaving the form deletes the copy.
   - **.satchel** -> imported as a new trip with the T15 all-or-nothing import, then the trip opens.
   - **anything else** -> "Satchel can't read this kind of file" with Back to Trips. Nothing is saved.
5. Settings has a "Save to Satchel" line telling the traveller to tap Share > Satchel on a booking PDF or email.

## Safety
- Expo Go and builds made before this app.json never receive a file URL; the code only runs when one arrives, and
  every step returns a result instead of throwing (an over-the-air update onto an older build is harmless).
- Files over 40 MB are refused with a plain message. Nothing leaves the phone.

## Later (native step, not in this build)
- **A real share extension** ("Save to Satchel" for selected text in Mail or Safari, and for the Android SEND intent)
  needs a native extension target and a config plugin package. No App-Projects app has such a package in its
  lockfile yet and the registry is unreachable from the cloud, so it is recorded as a later native step. Until then,
  selected text goes through Copy, then Paste a booking.
- Android SEND (share sheet) is not declared: React Native's Linking can't read the shared stream, so Satchel would
  appear in the Android share sheet and then do nothing.
