/**
 * Bonjour (Network.framework NWBrowser) native on/off switch. The browser and resolver
 * (modules/lan-wss/ios/LanBonjour.swift) have never compiled. Set this to false and: the app never
 * loads that native code (src/native/bonjour.ts returns null), so discovery falls back to the HTTP /
 * Cast TLS subnet probe; and the iOS build compiles only a stub of LanBonjour.swift (LanWss.podspec
 * reads this exact line). Keep it a single line of this exact form (tests/bonjour-native.test.ts).
 */
export const BONJOUR_NATIVE_ON = true;
