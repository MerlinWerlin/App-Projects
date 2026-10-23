// THE switch for the profile ("Bulk install") icon method. T60, docs/REVIEW_NOTES.md, docs/MARKET.md.
//
// true  = /install offers Bulk install (a web-clip .mobileconfig built on the iPhone) next to the
//         guided Shortcuts method.
// false = /install offers ONLY the guided Shortcuts method; the profile cards, profile tips and the
//         method picker are hidden. Nothing else changes and nothing needs migrating: a saved
//         "bulk" choice is simply ignored while this is false.
//
// Why a switch: App Review Guideline 5.5 says apps offering configuration profiles must meet the
// MDM requirements (MDM capability from Apple, enterprise / education / government use). Whether a
// profile that only holds Home Screen web clips counts is not stated anywhere public, and a leading
// theme app reportedly dropped its profile install "under App Store rules". Kept ON for TestFlight
// (TestFlight external review is lighter, and the owner can compare both methods); flip to false
// for the first App Store submission unless the owner accepts the rejection risk.
// Pure data: no React Native / Expo imports, so src/core tests can read it too.
export const PROFILE_INSTALL_ENABLED: boolean = true;
