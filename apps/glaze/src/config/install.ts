// THE switch for the profile ("Install all at once") icon method. T60, docs/REVIEW_NOTES.md, docs/MARKET.md.
//
// true  = /install leads with Install all at once (a web-clip .mobileconfig built on the iPhone):
//         since T202 (owner-1101d #5) it is ALWAYS the main method, with Shortcuts only as a small
//         "Prefer Shortcuts? One icon at a time" fallback link (and for apps a profile can't open).
// false = /install offers ONLY the guided Shortcuts method; the profile section and profile tips
//         are hidden. Nothing else changes and nothing needs migrating.
//
// Why a switch: App Review Guideline 5.5 says apps offering configuration profiles must meet the
// MDM requirements (MDM capability from Apple, enterprise / education / government use). Whether a
// profile that only holds Home Screen web clips counts is not stated anywhere public. ON: the owner
// chose the profile as the main method (1 Nov). Flip to false only if App Review rejects it.
// Pure data: no React Native / Expo imports, so src/core tests can read it too.
export const PROFILE_INSTALL_ENABLED: boolean = true;
