# Languages + release (owner request, 16 Oct 2026)

Imported once into the backlog as tasks tagged `owner-1016` (T38–T42). They outrank everything except trial blockers and open owner-comment tasks (polish-1013 work is already done apart from the owner's device check T36).

> LANGUAGES + RELEASE (owner request 16 Oct 2026, one-time import; skip the import if ops/backlog.json already has tasks tagged "owner-1016"): the owner now has an Apple Developer account and ships apps to his iPhone through TestFlight (EAS Build from his PC), and wants every app available in many languages with layouts that adapt to each script. Copy this whole section into docs/OWNER_1016.md, add backlog tasks tagged "owner-1016" that outrank everything except trial blockers and open owner-comment tasks, in this order:
>
> R1 Release identity (small, first): iOS bundleIdentifier and Android package "com.jared797.linework"; ios.config.usesNonExemptEncryption false; eas.json with profiles development (developmentClient, internal), preview (internal) and production (autoIncrement). Keep START_TRIAL.cmd working.
>
> R2 Over-the-air updates: expo-updates configured for EAS Update (runtimeVersion policy "appVersion", channels development / preview / production) so JS-only changes reach the TestFlight build without a rebuild; PUSH_UPDATE.cmd at the repo root (npx eas-cli@latest update --channel production --message "<asks for a short note>", pause) and docs/RELEASING.md in plain words (OTA update vs new TestFlight build: native code, permissions, icon, new native packages need a build). Must not crash Expo Go.
>
> R3 Languages with adaptive layout: expo-localization + a small typed i18n layer (interpolation, plurals); follow the phone's language with an override in Settings. Ship English, Spanish, French, German, Italian, Portuguese (Brazil), Japanese, Korean, Simplified Chinese, Hindi and Arabic. Layout must adapt to the script: right-to-left mirroring for Arabic (I18nManager allowRTL/forceRTL with an app reload when switching direction, start/end instead of left/right in styles, mirrored chevrons and back gestures; the traced image, camera view and outline are never mirrored; numbers and percentages stay left-to-right); text expansion (German, French ~+35%) wraps instead of truncating, buttons grow; CJK, Devanagari and Arabic get suitable line heights and system font fallback; dates, numbers and units format with Intl for the locale. Every user-facing string moves to the catalogue; tests fail on hard-coded UI strings, plus a pseudo-locale (accented, 40% longer) and an RTL layout check of the main screens. docs/I18N.md marks non-English catalogues as machine translations awaiting native review.
>
> In the finish message, mention the owner-1016 items and anything that needs the owner.

## How it maps to the backlog
- T38 = R1 release identity
- T39 = R2 over-the-air updates
- T40 = R3a i18n layer, language setting, every UI string into the English catalogue, hard-coded-string test
- T41 = R3b the ten translated catalogues (machine translations, awaiting native review)
- T42 = R3c adaptive layout: RTL, text expansion, script line heights, Intl formatting, pseudo-locale + RTL checks, docs/I18N.md
