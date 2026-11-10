# Couch 1.0.4: OTA updates removed (prepared, not applied)

On 10 Nov 2026 Apple rejected Backspin under Guideline 5.6, most likely because the build could change its own code after review (`expo-updates`). Couch 1.0.4 build 17 had the same setup, so Jared cancelled that submission and 1.0.4 is rebuilt without it.

## What changed in the app

- `expo-updates` removed: the dependency and its lockfile packages, `updates` and `runtimeVersion` in `app.json`, and the EAS Update `channel` in `eas.json`. `src/native/updates.ts`, `src/state/useQuietUpdate.ts` and their test are deleted.
- The EAS project id is now pinned in `app.json`, so ship-mac skips `eas update:configure` (which would otherwise add EAS Update back on the runner).
- Switching between Arabic and a left-to-right language used `Updates.reloadAsync` to restart. Store builds now set the new direction and ask the person to close and reopen Couch (new string `core.settings.language.reopenMessage` in all 11 locales). Development builds still reload with `DevSettings.reload`.
- The version stays 1.0.4 with a new build number.

## App Store Connect (Jared or the Apps master, before resubmitting)

- App Privacy: already **Data Not Collected**. No change is needed; the app never disclosed an installation ID or diagnostics.
- Review notes: `listing.json` now also says Couch does not download code or updates outside the App Store.

## Public privacy policy (`docs/couch/privacy.html`)

The page still has an **App updates** section describing Expo EAS Update and a random identifier the update library creates. It is outside `apps/couch`, so this change does not touch it. Before resubmitting, replace that section with:

> **App updates.** Couch does not download app code or updates outside the App Store. Updates come only through the App Store.
