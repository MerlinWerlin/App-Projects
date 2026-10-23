# Spike: delivering a .mobileconfig from Expo Go (T06)

Status: **desk spike**. Nothing here was tried on a device; it is reasoned from Apple's
public documentation and the documented behaviour of the Expo libraries we may use.
Everything marked **(needs on-device confirmation)** must be checked on the owner's iPhone
during the trial before we rely on it in store copy.

## What iOS documents

- Configuration profiles (`.mobileconfig`, plist XML) can be installed by the user from
  Safari downloads, Mail attachments, AirDrop and the Files app. After the file is opened,
  iOS shows **"Profile Downloaded"**; the user finishes in **Settings** (a "Profile
  Downloaded" row near the top, or **General > VPN & Device Management**) > the profile >
  **Install** > passcode > **Install** > **Done**.
- A downloaded profile waits about 8 minutes; after that it is discarded and must be
  opened again. (Apple Platform Deployment guide; needs on-device confirmation of the
  exact time.)
- Unsigned profiles show **"Not Verified"** in red. They still install. Signing needs a
  certificate and a server-side or native signing step we don't have in Expo Go.
- A profile made only of `com.apple.webClip.managed` payloads adds Home Screen web clips.
  It does not enrol the device in management and grants no data access.
- The MIME type for profiles is `application/x-apple-aspen-config`. The UTI is commonly
  quoted as `com.apple.mobileconfig`, but we could not confirm it from Apple's published
  UTI list, so the app **leaves `UTI` unset** (the share sheet then falls back to the file
  extension and MIME type).

## Paths compared

| Path | Works from Expo Go? | Steps for the user | Verdict |
|---|---|---|---|
| **A. expo-sharing `shareAsync(file)` → "Save to Files" → open in Files** | Yes. `expo-file-system/legacy` writes the XML to `cacheDirectory`; `expo-sharing` opens the system share sheet for a `file://` URI. | Share sheet > Save to Files > pick a folder > Save; open Files > tap the file > "Profile Downloaded"; Settings > Install. | **Primary.** No server, no account, no network. Files is documented as an install source. (needs on-device confirmation that tapping the file in Files shows "Profile Downloaded" for a file saved this way.) |
| A2. Same share sheet → **AirDrop** to the same iPhone or to another device | Yes (same sheet). | Pick your own device in AirDrop; iOS offers to open the profile straight away. | Alternative, mentioned in the sheet. AirDrop to self may need Bluetooth/Wi-Fi on and the device listed under "My devices". (needs on-device confirmation) |
| A3. Same share sheet → **Mail** | Yes, if a mail account is configured in Apple Mail. | Send to yourself, open the mail, tap the attachment. | Alternative only. Needs a configured account; we do not ship `expo-mail-composer` (not in PLAN §6). Third-party mail apps may not hand the attachment to the profile installer. |
| B. **expo-web-browser** with a `data:application/x-apple-aspen-config;base64,…` URL | Technically opens `SFSafariViewController`. | — | **Rejected.** Safari does not reliably treat `data:` URLs as downloads, `SFSafariViewController` has restricted download handling, and large data URLs (hundreds of KB to MB) can be truncated or refused. Profile install from an in-app browser is not documented. |
| C. `Linking.openURL('data:…')` into Safari | Safari blocks top-level navigation to `data:` URLs opened from other apps. | — | **Rejected.** |
| D. Local HTTP server + Safari | Needs a native module or a remote server. | — | Out of scope for Expo Go and against "no network calls". Possible later in a dev build. |
| E. `UIDocumentInteractionController` / Quick Look of the file | Not exposed by Expo Go libraries. | — | Not available. |

## Decision

- **Bulk install = expo-sharing.** `shareAsync(uri, { mimeType: 'application/x-apple-aspen-config', dialogTitle })`,
  no `UTI`. One file per profile part (the builder splits sets above ~2.5 MB).
- The install screen then shows illustrated step cards: Save to Files → open Files and tap
  the file → Settings > Profile Downloaded > Install → what "Not Verified" means → hide the
  old icons (long-press > Remove App > Remove from Home Screen, the app stays in the App
  Library) → how to remove the profile later.
- The sheet copy mentions AirDrop and Mail as alternatives.
- Icons render at 180 px for the profile (the size iOS uses for Home Screen icons at 3x)
  to keep the profile small.
- **Shortcuts fallback** needs no file delivery at all: icons are saved to Photos in a
  "Glaze icons" album (expo-media-library), and the user builds one "Open URL" (or
  "Open App") shortcut per app. Apps without a URL scheme always go this way.

## To confirm on the device (trial checklist)

1. Share sheet shows "Save to Files" for a `.mobileconfig` from Expo Go with the MIME type above and no UTI.
2. Tapping the saved file in Files shows "Profile Downloaded" (not a Quick Look preview).
3. Settings shows the profile with "Not Verified", and Install succeeds with web clips appearing.
4. Web clip with `Precomposed` true and a 180 px PNG looks sharp; URL schemes like `music:` open the app (iOS may first show an "Open in …?" prompt the first time).
5. Removing the profile removes its icons.
6. AirDrop-to-self and Mail attachment paths, as secondary options.
7. If (1) fails: try `UTI: 'com.apple.mobileconfig'` and record the result here.
