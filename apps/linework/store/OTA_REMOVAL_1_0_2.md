# Linework 1.0.2: OTA updates removed

## Why

On 10 Nov 2026 Apple rejected Backspin under Guideline 5.6 (features hidden or changeable remotely) because it shipped `expo-updates`, a remote code-update mechanism (EAS Update over-the-air updates). Linework 1.0.1, live on the App Store, has the same setup. We are removing it from every App Factory app preventatively, so Linework's next submission does not draw a second 5.6. Backspin 1.0.1, Couch 1.0.4 and Cue were already rebuilt without it.

1.0.2 changes nothing else for users. No OTA update will ever be published to the live 1.0.1.

## What changed in the app

- `expo-updates` removed: the dependency and its lockfile packages, `updates` (including the `u.expo.dev` URL) and `runtimeVersion` in `app.json`, and every EAS Update `channel` in `eas.json` (including the Play profiles).
- `ops/play-variant.cjs` no longer sets `runtimeVersion` or an `updates` block (with its channel header) for the Android Play builds.
- `src/native/updates.ts` and its test are deleted, and the root layout no longer runs the quiet update check on launch.
- `PUSH_UPDATE.cmd` is deleted, and `TESTFLIGHT_LINEWORK.cmd` no longer runs `eas update:configure` (which would add EAS Update back).
- Switching between Arabic and a left-to-right language used `Updates.reloadAsync` to restart. Store builds now set the new direction and show the existing "Close and reopen Linework" message (`settings.language.restartManual`). Development builds still reload with `DevSettings.reload`. No new strings.
- The EAS project id was already pinned in `app.json` (`extra.eas.projectId`), so ship-mac skips `eas init` / `eas update:configure` on the runner.
- Version 1.0.1 → 1.0.2 in `app.json` (iOS and Android). Build numbers come from EAS (`appVersionSource: remote`, `autoIncrement`).

## Privacy

- Public privacy page (`docs/linework/privacy.html`, mirrored in `apps/linework/docs/privacy.html`): the "App updates" section now says that from 1.0.2 Linework does not download app code or updates outside the App Store or Google Play. Effective date 10 November 2026.
- App Store Connect App Privacy: stays **Data Not Collected**. 1.0.2 sends nothing to any update service, so no change is needed.

## App Review notes for 1.0.2

`store/listing.json` `reviewNotes` (point 4, External services) now includes the sentence below. If you paste notes by hand in App Store Connect, add it there:

> This version contains no over-the-air or remote code-update mechanism, so the build reviewed is exactly the build users get.

"What's New" text suggestion for 1.0.2: "Small under-the-hood changes. Updates now come only through the App Store."
