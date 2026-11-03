# Cue Android data review — draft, not submitted

This review describes the Play overlay and repairs at app source f572a10. It is preparation
for the Console forms, not a completed Data safety declaration or a network
capture. Recheck against the signed production AAB before submission.

| Feature | Current source behaviour | Evidence / remaining check |
| --- | --- | --- |
| Scripts and preferences | AsyncStorage on device; no app account or script upload endpoint found | `src/state/AppState.tsx`; review Android system-backup rules in the production manifest |
| Video and audio | Camera/microphone used for takes; saves own video through MediaLibrary write-only request | `app/record/[id].tsx`; emulator save test does not establish physical microphone quality |
| Voice Pace | Local microphone level metering through a cached audio recording; explicit stop/delete cleanup | `src/native/voiceRecording.ts`; cancellation, partial recording, denied permission and stop failure are unit-tested. Verify native cache cleanup and interruption before release |
| Voice Follow | Requests `requiresOnDeviceRecognition: true`; unsupported recognition returns a fallback | `src/native/speech.ts`; Google recognizer availability/resources vary; verify native fallback |
| Import and export | System document picker and share sheet; user chooses files and destinations | Native document-picker/sharing modules; no broad media-read declaration in inspected APK |
| Plus purchase | Google Play Billing queries Plus only, store handles payment; app checks ownership and caches access | `src/plus/purchases.ts`; licensed purchase/pending/cancel/restore/revocation tests still required |
| Android trial | Earliest start timestamp in local storage and SecureStore; not a Google trial SKU | `src/plus/androidTrial.ts`; clearing data/reinstall can remove local state |
| Updates | Play overlay sets `updates.enabled: false` and embeds JS | Compiled manifest/config; do not reuse iOS EAS Update disclosure as Android behaviour |
| Feedback | Opens mail composer, sending remains the user's action | Support correspondence may contain the information the user chooses to send |

On older Android versions, the capped legacy write permission also implies
storage read access. The absence of explicit read declarations does not prove
the operating system enforces add-only access there. Cue's code saves its own
takes and does not browse the collection; describe that behaviour precisely.

The installed package includes Billing and Google Android Data Transport
components from dependencies. Their presence alone proves neither collection
nor absence of collection. Audit resolved SDK behaviour and final network
traffic before answering the Console's collection/sharing questions. The
review did not find an app analytics or advertising dependency in package.json.

## Privacy page changes needed before an Android listing

The existing public `docs/cue/privacy.html` describes the shipped iOS behaviour.
Keep its iOS purchase, Keychain and update descriptions accurate, and add
explicit Android qualifications before using it for Google Play:

- Google Play processes the optional one-time Android Plus purchase. Cue does
  not receive payment-card details.
- Android's free, user-started seven-day trial is device-local. It does not
  create a store transaction or charge automatically. Clearing app data or
  reinstalling can lose its start record. Restoring Plus checks the Google
  store account; it does not create another trial.
- These Play profiles disable Expo EAS Update. The existing iOS profiles still
  use the update service described by the current policy.
- Photos/gallery sync, operating-system backups and store purchase records
  are controlled separately by the relevant platform and user settings.
- Mention Google Play purchase approval alongside Apple's approval controls.

No policy page was published and no Data safety answers were submitted by this
review. Avoid claiming that all SDK/network behaviour has been tested.
