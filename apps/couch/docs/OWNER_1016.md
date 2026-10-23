# Owner request 16 Oct 2026 — languages + release (owner-1016)

Imported in run 30 from the run prompt (section E). Tasks tagged `owner-1016` (T45–T50) outrank everything except trial blockers and open owner-comment tasks. They are exempt from the D6-1 breadth freeze because the owner asked for them.

The owner now has an Apple Developer account and ships apps to his iPhone through TestFlight (EAS Build from his PC), and wants every app in many languages with layouts that adapt to each script.

## R1 Release identity (small, first)
- iOS `bundleIdentifier` and Android `package` = `com.jared797.couch`.
- `ios.config.usesNonExemptEncryption: false`.
- `eas.json` with profiles `development` (developmentClient, internal distribution), `preview` (internal) and `production` (autoIncrement).
- Declare the iOS local-network usage text and the Bonjour service types the drivers use.
- `docs/RELEASING.md`: real TV discovery on iOS needs Apple's multicast networking entitlement, which the owner must request from Apple (exact steps and the form wording) before a TestFlight build can find TVs.

## R2 Over-the-air updates
- `expo-updates` for EAS Update: `runtimeVersion` policy `appVersion`, channels `development` / `preview` / `production`.
- `PUSH_UPDATE.cmd` at the repo root: `npx eas-cli@latest update --channel production --message "<asks for a short note>"`, pause.
- Plain-words `docs/RELEASING.md` on OTA update vs new TestFlight build.
- Must not crash Expo Go.

## R3 Languages with adaptive layout
- `expo-localization` + a small typed i18n layer (interpolation, plurals); follow the phone's language with an override in Settings.
- Ship English, Spanish, French, German, Italian, Portuguese (Brazil), Japanese, Korean, Simplified Chinese, Hindi and Arabic.
- Right-to-left mirroring for Arabic (I18nManager allowRTL/forceRTL with an app reload when switching direction, start/end instead of left/right, mirrored chevrons and back gestures) EXCEPT the remote's d-pad, arrows, volume/channel rockers, rewind/fast-forward and touchpad, which keep their physical directions.
- Text expansion wraps instead of truncating and buttons grow; CJK, Devanagari and Arabic get suitable line heights and system font fallback; Intl formatting for numbers and dates; voice search uses the selected language.
- Every user-facing string moves to the catalogue; tests fail on hard-coded UI strings, plus a pseudo-locale (accented, 40% longer) and an RTL layout check that the d-pad is NOT mirrored.
- `docs/I18N.md` marks non-English catalogues as machine translations awaiting native review.

## Backlog mapping
| Task | Item |
|---|---|
| T45 | R1 release identity |
| T46 | R2 OTA updates (expo-updates guarded) |
| T47 | R3a i18n core: typed t(), plurals, Intl, locale resolution, language pref, pseudo-locale, script typography, Text + NeverMirror wrappers |
| T48 | R3b string migration: app/ screens |
| T49 | R3c string migration: src/ui + src/state; never-mirror wrapping of physical controls |
| T50 | R3d RTL switching + reload, language picker, voice language, scanners, docs/I18N.md |
| T51 | R3e user-facing copy in src/core becomes message keys |
| T52 | R3f machine-translated catalogues (10 languages) |

The WORKFLOW step 9 release item "R1 EAS config ... placeholder bundle ids" is superseded by T45 (owner's real ids).
